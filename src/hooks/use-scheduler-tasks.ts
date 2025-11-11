import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from './use-session';
import { DBScheduledTask, NewDBScheduledTask, NewRetiredTask, RetiredTask, SortBy, TaskPriority, TimeBlock } from '@/types/scheduler'; // Removed RawTaskInput
import { showError, showSuccess } from '@/utils/toast';
import { format, parseISO, isSameDay, startOfDay, addDays, isBefore, isAfter, addMinutes } from 'date-fns'; // Added addMinutes, isBefore, isAfter
import { compactScheduleLogic, mergeOverlappingTimeBlocks, getFreeTimeBlocks, isSlotFree } from '@/lib/scheduler-utils'; // Import getFreeTimeBlocks and isSlotFree

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

      // 2. Prepare occupied blocks from non-break tasks
      let occupiedBlocks: TimeBlock[] = nonBreaks
        .filter(task => task.start_time && task.end_time)
        .map(task => ({
          start: parseISO(task.start_time!),
          end: parseISO(task.end_time!),
          duration: Math.floor((parseISO(task.end_time!).getTime() - parseISO(task.start_time!).getTime()) / (1000 * 60)),
        }));
      occupiedBlocks = mergeOverlappingTimeBlocks(occupiedBlocks); // Ensure occupied blocks are merged

      // 3. Randomly place breaks into free blocks
      const newBreaksToInsert: NewDBScheduledTask[] = [];
      const shuffledBreaks = [...breaks].sort(() => 0.5 - Math.random()); // Randomize order

      for (const breakTask of shuffledBreaks) {
        const breakDuration = breakTask.break_duration || 30; // Default break duration
        let placed = false;

        // Recalculate free blocks for each break placement to ensure accuracy
        const currentFreeBlocks = getFreeTimeBlocks(occupiedBlocks, workdayStartTime, workdayEndTime);
        const shuffledFreeBlocks = [...currentFreeBlocks].sort(() => 0.5 - Math.random()); // Randomize free block search order

        for (const freeBlock of shuffledFreeBlocks) {
          if (freeBlock.duration >= breakDuration) {
            // Calculate possible start times within the free block
            const possibleStartTimes: Date[] = [];
            let currentPossibleStart = freeBlock.start;
            while (isBefore(addMinutes(currentPossibleStart, breakDuration), freeBlock.end) || isSameDay(addMinutes(currentPossibleStart, breakDuration), freeBlock.end)) {
              possibleStartTimes.push(currentPossibleStart);
              currentPossibleStart = addMinutes(currentPossibleStart, 5); // Increment by 5 minutes for reasonable granularity
            }

            if (possibleStartTimes.length > 0) {
              const randomStartIndex = Math.floor(Math.random() * possibleStartTimes.length);
              const proposedStartTime = possibleStartTimes[randomStartIndex];
              const proposedEndTime = addMinutes(proposedStartTime, breakDuration);

              // Double-check for slot freedom with the *current* occupied blocks
              if (isSlotFree(proposedStartTime, proposedEndTime, occupiedBlocks)) {
                newBreaksToInsert.push({
                  name: breakTask.name,
                  start_time: proposedStartTime.toISOString(),
                  end_time: proposedEndTime.toISOString(),
                  scheduled_date: selectedDate,
                  is_critical: breakTask.is_critical,
                  is_flexible: breakTask.is_flexible,
                  break_duration: breakTask.break_duration,
                });

                // Update occupied blocks immediately after placing a break
                occupiedBlocks.push({ start: proposedStartTime, end: proposedEndTime, duration: breakDuration });
                occupiedBlocks = mergeOverlappingTimeBlocks(occupiedBlocks); // Re-merge to keep it clean
                
                placed = true;
                break; // Move to the next breakTask
              }
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