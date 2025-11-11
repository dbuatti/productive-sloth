import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from './use-session';
import { DBScheduledTask, NewDBScheduledTask, NewRetiredTask, RetiredTask, SortBy, TaskPriority, TimeBlock } from '@/types/scheduler'; // Removed RawTaskInput
import { showError, showSuccess } from '@/utils/toast';
import { format, parseISO, isSameDay, startOfDay, addDays, isBefore, isAfter, addMinutes } from 'date-fns'; // Added addMinutes, isBefore, isAfter
import { compactScheduleLogic } from '@/lib/scheduler-utils';
// import { TimeBlock } from '@/types/scheduler'; // TimeBlock is already imported above

export const useSchedulerTasks = (selectedDay: string) => {
  const { user, profile, refreshProfile } = useSession();
  const queryClient = useQueryClient();

  const userId = user?.id;

  // --- Fetch Scheduled Tasks ---
  const { data: dbScheduledTasks, isLoading: isSchedulerTasksLoading, error: scheduledTasksError } = useQuery<DBScheduledTask[], Error>({
    queryKey: ['scheduledTasks', userId, selectedDay],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('scheduled_tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('scheduled_date', selectedDay)
        .order('start_time', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    placeholderData: [], // Provide empty array as placeholder
  });

  // --- Fetch Dates With Tasks (for Calendar Strip) ---
  const { data: datesWithTasks, isLoading: isLoadingDatesWithTasks } = useQuery<string[], Error>({
    queryKey: ['datesWithTasks', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('scheduled_tasks')
        .select('scheduled_date')
        .eq('user_id', userId);

      if (error) throw error;
      return Array.from(new Set(data.map(item => item.scheduled_date)));
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (Replaced cacheTime with gcTime)
    placeholderData: [],
  });

  // --- Fetch Retired Tasks (Aether Sink) ---
  const { data: retiredTasks, isLoading: isLoadingRetiredTasks } = useQuery<RetiredTask[], Error>({
    queryKey: ['retiredTasks', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('retired_tasks')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    placeholderData: [],
  });

  // --- Add Scheduled Task ---
  const { mutateAsync: addScheduledTask } = useMutation<void, Error, NewDBScheduledTask>({
    mutationFn: async (newTask) => {
      if (!userId) throw new Error("User not logged in.");
      const { error } = await supabase
        .from('scheduled_tasks')
        .insert({ ...newTask, user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, selectedDay] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
    },
    onError: (error) => {
      showError(`Failed to add task: ${error.message}`);
    },
  });

  // --- Remove Scheduled Task ---
  const { mutateAsync: removeScheduledTask } = useMutation<void, Error, string>({ // Changed to mutateAsync
    mutationFn: async (taskId) => {
      if (!userId) throw new Error("User not logged in.");
      const { error } = await supabase
        .from('scheduled_tasks')
        .delete()
        .eq('id', taskId)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, selectedDay] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
    },
    onError: (error) => {
      showError(`Failed to remove task: ${error.message}`);
    },
  });

  // --- Clear All Scheduled Tasks for the day ---
  const { mutateAsync: clearScheduledTasks } = useMutation<void, Error, void>({
    mutationFn: async () => {
      if (!userId) throw new Error("User not logged in.");
      const { error } = await supabase
        .from('scheduled_tasks')
        .delete()
        .eq('user_id', userId)
        .eq('scheduled_date', selectedDay);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, selectedDay] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
      showSuccess("Schedule cleared!");
    },
    onError: (error) => {
      showError(`Failed to clear schedule: ${error.message}`);
    },
  });

  // --- Add Retired Task (to Aether Sink) ---
  const { mutateAsync: addRetiredTask } = useMutation<void, Error, NewRetiredTask>({
    mutationFn: async (newRetiredTask) => {
      if (!userId) throw new Error("User not logged in.");
      const { error } = await supabase
        .from('retired_tasks')
        .insert({ ...newRetiredTask, user_id: userId, created_at: new Date().toISOString() }); // Changed retired_at to created_at
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId] });
      showSuccess("Task sent to Aether Sink!");
    },
    onError: (error) => {
      showError(`Failed to send task to Aether Sink: ${error.message}`);
    },
  });

  // --- Retire Task (move from scheduled to retired) ---
  const { mutateAsync: retireTask } = useMutation<void, Error, DBScheduledTask>({
    mutationFn: async (taskToRetire) => {
      if (!userId) throw new Error("User not logged in.");

      // 1. Add to retired_tasks
      const newRetiredTask: NewRetiredTask = {
        user_id: userId,
        name: taskToRetire.name,
        duration: taskToRetire.start_time && taskToRetire.end_time
          ? Math.floor((parseISO(taskToRetire.end_time).getTime() - parseISO(taskToRetire.start_time).getTime()) / (1000 * 60))
          : null,
        break_duration: taskToRetire.break_duration,
        original_scheduled_date: taskToRetire.scheduled_date,
        is_critical: taskToRetire.is_critical,
      };
      const { error: addError } = await supabase.from('retired_tasks').insert({ ...newRetiredTask, created_at: new Date().toISOString() }); // Changed retired_at to created_at
      if (addError) throw addError;

      // 2. Remove from scheduled_tasks
      const { error: removeError } = await supabase
        .from('scheduled_tasks')
        .delete()
        .eq('id', taskToRetire.id)
        .eq('user_id', userId);
      if (removeError) throw removeError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, selectedDay] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId] });
      showSuccess("Task retired to Aether Sink!");
    },
    onError: (error) => {
      showError(`Failed to retire task: ${error.message}`);
    },
  });

  // --- Rezone Task (move from retired to scheduled) ---
  const { mutateAsync: rezoneTask } = useMutation<void, Error, string>({
    mutationFn: async (retiredTaskId) => {
      if (!userId) throw new Error("User not logged in.");
      const { error } = await supabase
        .from('retired_tasks')
        .delete()
        .eq('id', retiredTaskId)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId] });
      // The task is added back to scheduled_tasks by the calling component (SchedulerPage)
      // so we don't invalidate scheduledTasks here directly, but it will be triggered by addScheduledTask.
    },
    onError: (error) => {
      showError(`Failed to rezone task: ${error.message}`);
    },
  });

  // --- Compact Scheduled Tasks ---
  const { mutateAsync: compactScheduledTasks } = useMutation<void, Error, DBScheduledTask[]>({
    mutationFn: async (compactedTasks) => {
      if (!userId) throw new Error("User not logged in.");

      // Delete all existing tasks for the day
      const { error: deleteError } = await supabase
        .from('scheduled_tasks')
        .delete()
        .eq('user_id', userId)
        .eq('scheduled_date', selectedDay);
      if (deleteError) throw deleteError;

      // Insert the newly compacted tasks
      const tasksToInsert = compactedTasks.map(task => ({
        user_id: userId,
        name: task.name,
        start_time: task.start_time,
        end_time: task.end_time,
        scheduled_date: task.scheduled_date,
        is_critical: task.is_critical,
        is_flexible: task.is_flexible,
        break_duration: task.break_duration,
      }));

      const { error: insertError } = await supabase
        .from('scheduled_tasks')
        .insert(tasksToInsert);
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, selectedDay] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
    },
    onError: (error) => {
      showError(`Failed to compact schedule: ${error.message}`);
    },
  });

  // --- Randomize Breaks ---
  interface RandomizeBreaksParams {
    selectedDate: string;
    workdayStartTime: Date;
    workdayEndTime: Date;
    currentDbTasks: DBScheduledTask[];
  }

  const { mutateAsync: randomizeBreaks } = useMutation<void, Error, RandomizeBreaksParams>({
    mutationFn: async ({ selectedDate, workdayStartTime, workdayEndTime, currentDbTasks }) => {
      if (!userId) throw new Error("User not logged in.");

      const breaks = currentDbTasks.filter(task => task.name.toLowerCase() === 'break');
      const nonBreaks = currentDbTasks.filter(task => task.name.toLowerCase() !== 'break');

      if (breaks.length === 0) {
        showSuccess("No break tasks to randomize.");
        return;
      }

      // 1. Remove all existing breaks
      const { error: deleteBreaksError } = await supabase
        .from('scheduled_tasks')
        .delete()
        .eq('user_id', userId)
        .eq('scheduled_date', selectedDate)
        .eq('name', 'Break'); // Only delete breaks
      if (deleteBreaksError) throw deleteBreaksError;

      // 2. Calculate free time blocks based on non-break tasks
      const occupiedBlocks: TimeBlock[] = nonBreaks
        .filter(task => task.start_time && task.end_time)
        .map(task => ({
          start: parseISO(task.start_time!),
          end: parseISO(task.end_time!),
          duration: Math.floor((parseISO(task.end_time!).getTime() - parseISO(task.start_time!).getTime()) / (1000 * 60)),
        }))
        .sort((a, b) => a.start.getTime() - b.start.getTime());

      // Simple merge for now, assuming non-breaks are already well-formed
      // In a real scenario, you might want a more robust merge here.
      const mergedOccupiedBlocks = occupiedBlocks; // For simplicity, assume no overlaps in non-breaks

      const freeBlocks: TimeBlock[] = [];
      let currentFreeTimeStart = workdayStartTime;

      for (const block of mergedOccupiedBlocks) {
        if (isBefore(currentFreeTimeStart, block.start)) {
          freeBlocks.push({ start: currentFreeTimeStart, end: block.start, duration: Math.floor((block.start.getTime() - currentFreeTimeStart.getTime()) / (1000 * 60)) });
        }
        currentFreeTimeStart = isAfter(block.end, currentFreeTimeStart) ? block.end : currentFreeTimeStart;
      }
      if (isBefore(currentFreeTimeStart, workdayEndTime)) {
        freeBlocks.push({ start: currentFreeTimeStart, end: workdayEndTime, duration: Math.floor((workdayEndTime.getTime() - currentFreeTimeStart.getTime()) / (1000 * 60)) });
      }

      // 3. Randomly place breaks into free blocks
      const newBreaksToInsert: NewDBScheduledTask[] = [];
      let availableFreeTime = freeBlocks.reduce((sum, block) => sum + block.duration, 0);
      const totalBreakDuration = breaks.reduce((sum, b) => b.break_duration || 0, 0); // Assuming break_duration is the actual duration for 'break' tasks

      if (totalBreakDuration > availableFreeTime) {
        showError("Not enough free time to re-allocate all breaks.");
        // Decide how to handle: place as many as possible, or fail entirely
        // For now, we'll try to place as many as possible.
      }

      const shuffledBreaks = [...breaks].sort(() => 0.5 - Math.random()); // Randomize order

      for (const breakTask of shuffledBreaks) {
        const breakDuration = breakTask.break_duration || 30; // Default break duration
        let placed = false;

        // Try to find a random free slot
        const shuffledFreeBlocks = [...freeBlocks].sort(() => 0.5 - Math.random());
        for (const freeBlock of shuffledFreeBlocks) {
          if (freeBlock.duration >= breakDuration) {
            // Place break at a random start time within the free block
            const maxStartTime = addDays(freeBlock.end, 0); // Ensure same day
            const minStartTime = addDays(freeBlock.start, 0); // Ensure same day

            const possibleStartTimes: Date[] = [];
            let currentPossibleStart = minStartTime;
            while (isBefore(addMinutes(currentPossibleStart, breakDuration), maxStartTime) || isSameDay(addMinutes(currentPossibleStart, breakDuration), maxStartTime)) {
              possibleStartTimes.push(currentPossibleStart);
              currentPossibleStart = addMinutes(currentPossibleStart, 1); // Increment by 1 minute for granularity
            }

            if (possibleStartTimes.length > 0) {
              const randomStartIndex = Math.floor(Math.random() * possibleStartTimes.length);
              const proposedStartTime = possibleStartTimes[randomStartIndex];
              const proposedEndTime = addMinutes(proposedStartTime, breakDuration);

              newBreaksToInsert.push({
                name: breakTask.name,
                start_time: proposedStartTime.toISOString(),
                end_time: proposedEndTime.toISOString(),
                scheduled_date: selectedDate,
                is_critical: breakTask.is_critical,
                is_flexible: breakTask.is_flexible,
                break_duration: breakTask.break_duration,
              });

              // Update the free blocks (this is a simplified approach, a more robust one would re-merge)
              // For now, we'll just mark this block as used and rely on a full refresh.
              // A more complex solution would involve splitting the free block.
              freeBlock.duration = 0; // Mark as used for this iteration
              placed = true;
              break;
            }
          }
        }
        if (!placed) {
          console.warn(`Could not place break "${breakTask.name}" of duration ${breakDuration} min.`);
        }
      }

      // 4. Insert new breaks
      if (newBreaksToInsert.length > 0) {
        const { error: insertBreaksError } = await supabase
          .from('scheduled_tasks')
          .insert(newBreaksToInsert);
        if (insertBreaksError) throw insertBreaksError;
        showSuccess(`Randomly re-allocated ${newBreaksToInsert.length} breaks.`);
      } else {
        showError("No breaks could be re-allocated.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, selectedDay] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
    },
    onError: (error) => {
      showError(`Failed to randomize breaks: ${error.message}`);
    },
  });


  return {
    dbScheduledTasks: dbScheduledTasks || [],
    isLoading: isSchedulerTasksLoading,
    scheduledTasksError,
    addScheduledTask,
    removeScheduledTask,
    clearScheduledTasks,
    datesWithTasks: datesWithTasks || [],
    isLoadingDatesWithTasks,
    retiredTasks: retiredTasks || [],
    isLoadingRetiredTasks,
    addRetiredTask,
    retireTask,
    rezoneTask,
    compactScheduledTasks,
    randomizeBreaks,
  };
};