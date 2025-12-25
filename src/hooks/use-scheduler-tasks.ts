import { TaskStatusFilter, TemporalFilter } from '@/types'; // Removed Task, NewTask
import { DBScheduledTask, NewDBScheduledTask, RetiredTask, NewRetiredTask, SortBy, TaskPriority, TimeBlock, AutoBalancePayload, UnifiedTask, RetiredTaskSortBy, CompletedTaskLogEntry, ScheduleSummary } from '@/types/scheduler'; // Removed RawTaskInput, Added ScheduleSummary
import { useSession } from './use-session';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, isSameDay, startOfDay, addMinutes, isBefore, isAfter, differenceInMinutes, addDays } from 'date-fns';
import { showSuccess, showError } from '@/utils/toast';
import { getEmojiHue } from '@/lib/scheduler-utils'; // Assuming getEmojiHue is in scheduler-utils

// Helper to determine if a task is a break/meal for energy calculation
const isBreakOrMeal = (taskName: string) => {
  const lowerCaseName = taskName.toLowerCase();
  return lowerCaseName.includes('break') || lowerCaseName.includes('meal') || lowerCaseName.includes('lunch') || lowerCaseName.includes('dinner') || lowerCaseName.includes('breakfast');
};

// This is a local helper, not exported
const sortTasks = (tasks: DBScheduledTask[], sortBy: SortBy): DBScheduledTask[] => { // Changed Task[] to DBScheduledTask[]
  const priorityOrder: Record<TaskPriority, number> = { critical: 3, neutral: 2, backburner: 1 }; // Corrected TaskPriority values
  return [...tasks].sort((a, b) => {
    switch (sortBy) {
      case 'TIME_EARLIEST_TO_LATEST':
        return (a.start_time && b.start_time) ? parseISO(a.start_time).getTime() - parseISO(b.start_time).getTime() : 0;
      case 'TIME_LATEST_TO_EARLIEST':
        return (a.start_time && b.start_time) ? parseISO(b.start_time).getTime() - parseISO(a.start_time).getTime() : 0;
      case 'PRIORITY_HIGH_TO_LOW':
        return (priorityOrder[b.is_critical ? 'critical' : (b.is_backburner ? 'backburner' : 'neutral')] || 0) - (priorityOrder[a.is_critical ? 'critical' : (a.is_backburner ? 'backburner' : 'neutral')] || 0);
      case 'PRIORITY_LOW_TO_HIGH':
        return (priorityOrder[a.is_critical ? 'critical' : (a.is_backburner ? 'backburner' : 'neutral')] || 0) - (priorityOrder[b.is_critical ? 'critical' : (b.is_backburner ? 'backburner' : 'neutral')] || 0);
      case 'NAME_ASC':
        return a.name.localeCompare(b.name);
      case 'NAME_DESC':
        return b.name.localeCompare(a.name);
      case 'EMOJI':
        const hueA = getEmojiHue(a.name);
        const hueB = getEmojiHue(b.name);
        return hueA - hueB;
      default:
        return 0;
    }
  });
};

export const useSchedulerTasks = (selectedDay: string, scheduleContainerRef: React.RefObject<HTMLDivElement>) => {
  const { user, T_current } = useSession();
  const queryClient = useQueryClient();

  // Initialize sortBy from localStorage or default
  const [sortBy, setSortBy] = useState<SortBy>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('schedulerSortBy') as SortBy) || 'TIME_EARLIEST_TO_LATEST';
    }
    return 'TIME_EARLIEST_TO_LATEST';
  });

  // Initialize retiredSortBy from localStorage or default
  const [retiredSortBy, setRetiredSortBy] = useState<RetiredTaskSortBy>(() => { // Corrected type
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('retiredTaskSortBy') as RetiredTaskSortBy) || 'NEWEST_FIRST'; // Corrected literal
    }
    return 'NEWEST_FIRST'; // Corrected literal
  });

  // Persist sortBy to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('schedulerSortBy', sortBy);
    }
  }, [sortBy]);

  // Persist retiredSortBy to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('retiredTaskSortBy', retiredSortBy);
    }
  }, [retiredSortBy]);

  const { data: dbScheduledTasks, isLoading: isSchedulerTasksLoading } = useQuery<DBScheduledTask[]>({
    queryKey: ['scheduledTasks', user?.id, selectedDay, sortBy],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('scheduled_tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('scheduled_date', selectedDay);

      if (error) {
        throw error;
      }
      return sortTasks(data || [], sortBy);
    },
    enabled: !!user,
  });

  const { data: datesWithTasks, isLoading: isLoadingDatesWithTasks } = useQuery<string[]>({
    queryKey: ['datesWithTasks', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('scheduled_tasks')
        .select('scheduled_date')
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }
      const uniqueDates = Array.from(new Set(data.map(task => task.scheduled_date)));
      return uniqueDates;
    },
    enabled: !!user,
  });

  const { data: retiredTasks, isLoading: isLoadingRetiredTasks } = useQuery<RetiredTask[]>({
    queryKey: ['retiredTasks', user?.id, retiredSortBy],
    queryFn: async () => {
      if (!user) return [];
      let query = supabase
        .from('retired_tasks')
        .select('*')
        .eq('user_id', user.id);

      switch (retiredSortBy) {
        case 'OLDEST_FIRST': // Corrected literal
          query = query.order('retired_at', { ascending: true });
          break;
        case 'NEWEST_FIRST': // Corrected literal
          query = query.order('retired_at', { ascending: false });
          break;
        case 'DURATION_SHORTEST_FIRST': // Corrected literal
          query = query.order('duration', { ascending: true, nullsFirst: true });
          break;
        case 'DURATION_LONGEST_FIRST': // Corrected literal
          query = query.order('duration', { ascending: false });
          break;
        case 'PRIORITY_HIGH_TO_LOW': // Corrected literal
          query = query.order('is_critical', { ascending: false }).order('energy_cost', { ascending: false });
          break;
        case 'PRIORITY_LOW_TO_TO_HIGH': // Corrected literal
          query = query.order('is_critical', { ascending: true }).order('energy_cost', { ascending: true });
          break;
        case 'NAME_ASC':
          query = query.order('name', { ascending: true });
          break;
        case 'NAME_DESC':
          query = query.order('name', { ascending: false });
          break;
        default: // Default to NEWEST_FIRST
          query = query.order('retired_at', { ascending: false });
          break;
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }
      // Client-side sorting for EMOJI (if implemented, currently not in RetiredTaskSortBy)
      // if (retiredSortBy === 'EMOJI') {
      //   return (data as RetiredTask[]).sort((a, b) => {
      //     const hueA = getEmojiHue(a.name);
      //     const hueB = getEmojiHue(b.name);
      //     return hueA - hueB;
      //   });
      // }
      return data || [];
    },
    enabled: !!user,
  });

  const { data: completedTasksForSelectedDayList, isLoading: isLoadingCompletedTasksForSelectedDay } = useQuery<CompletedTaskLogEntry[]>({
    queryKey: ['completedTasksForSelectedDayList', user?.id, selectedDay],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('completed_tasks_log')
        .select('*')
        .eq('user_id', user.id)
        .eq('scheduled_date', selectedDay); // Assuming scheduled_date is stored in log

      if (error) {
        throw error;
      }

      // Combine with any completed tasks from dbScheduledTasks that are not yet in the log
      const scheduledCompletedTasks = dbScheduledTasks?.filter(task => task.is_completed && isSameDay(parseISO(task.scheduled_date), parseISO(selectedDay)))
        .map(task => ({
          id: task.id,
          name: task.name,
          is_completed: true,
          energy_cost: task.energy_cost,
          duration: task.duration || differenceInMinutes(parseISO(task.end_time!), parseISO(task.start_time!)),
          completed_at: task.updated_at || task.created_at, // Use updated_at if available
          created_at: task.created_at, // Added
          updated_at: task.updated_at, // Added
        })) || [];

      const combinedTasks = [...(data || []), ...scheduledCompletedTasks];

      // Filter out duplicates if a task is in both the log and scheduledCompletedTasks
      const uniqueCombinedTasks = Array.from(new Map(combinedTasks.map(item => [item.id, item])).values());

      return uniqueCombinedTasks.sort((a, b) => {
        const timeA = parseISO(a.updated_at || a.created_at || a.completed_at).getTime(); // Added nullish coalescing
        const timeB = parseISO(b.updated_at || b.created_at || b.completed_at).getTime(); // Added nullish coalescing
        return timeB - timeA;
      });
    },
    enabled: !!user && !!dbScheduledTasks, // Enable only after dbScheduledTasks are loaded
  });


  const addScheduledTask = useMutation({
    mutationFn: async (newTask: NewDBScheduledTask) => {
      if (!user) throw new Error("User not authenticated.");
      const taskWithUserId = { ...newTask, user_id: user.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      const { data, error } = await supabase.from('scheduled_tasks').insert(taskWithUserId).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', user?.id] });
    },
    onError: (error) => {
      showError(`Failed to add task: ${error.message}`);
    }
  });

  const addRetiredTask = useMutation({
    mutationFn: async (newRetiredTask: NewRetiredTask) => {
      if (!user) throw new Error("User not authenticated.");
      const taskWithUserId = { ...newRetiredTask, user_id: user.id, retired_at: new Date().toISOString(), created_at: new Date().toISOString() }; // Ensure created_at is set
      const { data, error } = await supabase.from('retired_tasks').insert(taskWithUserId).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', user?.id] });
    },
    onError: (error) => {
      showError(`Failed to add retired task: ${error.message}`);
    }
  });

  const removeScheduledTask = useMutation({
    mutationFn: async (taskId: string) => {
      if (!user) throw new Error("User not authenticated.");
      const { error } = await supabase.from('scheduled_tasks').delete().eq('id', taskId).eq('user_id', user.id);
      if (error) throw error;
      return taskId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', user?.id] });
    },
    onError: (error) => {
      showError(`Failed to remove task: ${error.message}`);
    }
  });

  const removeRetiredTask = useMutation({
    mutationFn: async (taskId: string) => {
      if (!user) throw new Error("User not authenticated.");
      const { error } = await supabase.from('retired_tasks').delete().eq('id', taskId).eq('user_id', user.id);
      if (error) throw error;
      return taskId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', user?.id] });
    },
    onError: (error) => {
      showError(`Failed to remove retired task: ${error.message}`);
    }
  });

  const clearScheduledTasks = useMutation({
    mutationFn: async (taskIds: string[]) => {
      if (!user) throw new Error("User not authenticated.");
      const { error } = await supabase.from('scheduled_tasks').delete().in('id', taskIds).eq('user_id', user.id);
      if (error) throw error;
      return taskIds;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', user?.id] });
      showSuccess("Unlocked tasks cleared!");
    },
    onError: (error) => {
      showError(`Failed to clear tasks: ${error.message}`);
    }
  });

  const retireTask = useMutation({
    mutationFn: async (task: DBScheduledTask) => {
      if (!user) throw new Error("User not authenticated.");

      // 1. Add to retired_tasks
      const { error: addError } = await supabase.from('retired_tasks').insert({
        user_id: user.id,
        name: task.name,
        duration: task.duration || differenceInMinutes(parseISO(task.end_time!), parseISO(task.start_time!)),
        break_duration: task.break_duration,
        original_scheduled_date: task.scheduled_date,
        is_critical: task.is_critical,
        is_locked: task.is_locked,
        is_completed: task.is_completed,
        energy_cost: task.energy_cost,
        is_custom_energy_cost: task.is_custom_energy_cost,
        task_environment: task.task_environment,
        is_backburner: task.is_backburner,
        retired_at: new Date().toISOString(),
        created_at: task.created_at, // Preserve original creation date
      });
      if (addError) throw addError;

      // 2. Remove from scheduled_tasks
      const { error: removeError } = await supabase.from('scheduled_tasks').delete().eq('id', task.id).eq('user_id', user.id);
      if (removeError) throw removeError;

      return task.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', user?.id] });
    },
    onError: (error) => {
      showError(`Failed to retire task: ${error.message}`);
    }
  });

  const rezoneTask = useMutation({
    mutationFn: async (retiredTaskId: string) => {
      if (!user) throw new Error("User not authenticated.");

      // 1. Fetch the retired task
      const { data: retiredTask, error: fetchError } = await supabase
        .from('retired_tasks')
        .select('*')
        .eq('id', retiredTaskId)
        .eq('user_id', user.id)
        .single();

      if (fetchError) throw fetchError;
      if (!retiredTask) throw new Error("Retired task not found.");

      // 2. Remove from retired_tasks
      const { error: removeError } = await supabase.from('retired_tasks').delete().eq('id', retiredTaskId).eq('user_id', user.id);
      if (removeError) throw removeError;

      // 3. Add to scheduled_tasks (without specific times, will be auto-scheduled)
      const { error: addError } = await supabase.from('scheduled_tasks').insert({
        user_id: user.id,
        name: retiredTask.name,
        duration: retiredTask.duration,
        break_duration: retiredTask.break_duration,
        scheduled_date: format(T_current, 'yyyy-MM-dd'), // Rezone to current day
        is_critical: retiredTask.is_critical,
        is_flexible: true, // Re-zoned tasks are flexible
        is_locked: false, // Re-zoned tasks are unlocked
        is_completed: false,
        energy_cost: retiredTask.energy_cost,
        is_custom_energy_cost: retiredTask.is_custom_energy_cost,
        task_environment: retiredTask.task_environment,
        is_backburner: retiredTask.is_backburner,
        created_at: retiredTask.created_at || new Date().toISOString(), // Preserve original creation date
        updated_at: new Date().toISOString(),
      });
      if (addError) throw addError;

      return retiredTaskId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', user?.id] });
    },
    onError: (error) => {
      showError(`Failed to rezone task: ${error.message}`);
    }
  });

  const compactScheduledTasks = useMutation({
    mutationFn: async ({ tasksToUpdate }: { tasksToUpdate: NewDBScheduledTask[] }) => { // Changed to NewDBScheduledTask[]
      if (!user) throw new Error("User not authenticated.");

      const updates = tasksToUpdate.map(task => ({
        ...task,
        user_id: user.id, // Ensure user_id is present
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from('scheduled_tasks').upsert(updates, { onConflict: 'id' });
      if (error) throw error;
      return updates;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
    },
    onError: (error) => {
      showError(`Failed to compact tasks: ${error.message}`);
    }
  });

  const randomizeBreaks = useMutation({
    mutationFn: async ({ selectedDate, workdayStartTime, workdayEndTime, currentDbTasks }: { selectedDate: string, workdayStartTime: Date, workdayEndTime: Date, currentDbTasks: DBScheduledTask[] }) => {
      if (!user) throw new Error("User not authenticated.");

      const breaks = currentDbTasks.filter(task => task.name.toLowerCase() === 'break' && !task.is_locked);
      const nonBreaks = currentDbTasks.filter(task => task.name.toLowerCase() !== 'break' || task.is_locked);

      const nonBreakBlocks = nonBreaks
        .filter(task => task.start_time && task.end_time)
        .map(task => ({
          start: parseISO(task.start_time!),
          end: parseISO(task.end_time!),
          duration: differenceInMinutes(parseISO(task.end_time!), parseISO(task.start_time!)),
        }));

      const mergedNonBreakBlocks = mergeOverlappingTimeBlocks(nonBreakBlocks);
      let availableFreeBlocks = getFreeTimeBlocks(mergedNonBreakBlocks, workdayStartTime, workdayEndTime);

      const updatedBreaks: NewDBScheduledTask[] = [];

      for (const breakTask of breaks) {
        const breakDuration = breakTask.duration || differenceInMinutes(parseISO(breakTask.end_time!), parseISO(breakTask.start_time!));
        if (breakDuration <= 0) continue;

        // Find a random suitable free block
        const suitableBlocks = availableFreeBlocks.filter(block => block.duration >= breakDuration);

        if (suitableBlocks.length > 0) {
          const randomIndex = Math.floor(Math.random() * suitableBlocks.length);
          const chosenBlock = suitableBlocks[randomIndex];

          const proposedStartTime = addMinutes(chosenBlock.start, Math.floor(Math.random() * (chosenBlock.duration - breakDuration + 1)));
          const proposedEndTime = addMinutes(proposedStartTime, breakDuration);

          updatedBreaks.push({
            ...breakTask,
            start_time: proposedStartTime.toISOString(),
            end_time: proposedEndTime.toISOString(),
            scheduled_date: selectedDate,
            is_locked: false, // Ensure randomized breaks are not locked
            updated_at: new Date().toISOString(),
          });

          // Update available free blocks by re-calculating
          const newOccupiedBlocks = [...mergedNonBreakBlocks, { start: proposedStartTime, end: proposedEndTime, duration: breakDuration }];
          availableFreeBlocks = getFreeTimeBlocks(mergeOverlappingTimeBlocks(newOccupiedBlocks), workdayStartTime, workdayEndTime);
        } else {
          // If no suitable block, keep original time or move to sink
          updatedBreaks.push({
            ...breakTask,
            scheduled_date: selectedDate,
            updated_at: new Date().toISOString(),
          });
        }
      }

      const { error } = await supabase.from('scheduled_tasks').upsert(updatedBreaks, { onConflict: 'id' });
      if (error) throw error;
      return updatedBreaks;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
      showSuccess("Breaks randomized!");
    },
    onError: (error) => {
      showError(`Failed to randomize breaks: ${error.message}`);
    }
  });

  const toggleScheduledTaskLock = useMutation({
    mutationFn: async ({ taskId, isLocked }: { taskId: string; isLocked: boolean }) => {
      if (!user) throw new Error("User not authenticated.");
      const { data, error } = await supabase
        .from('scheduled_tasks')
        .update({ is_locked: isLocked, updated_at: new Date().toISOString() })
        .eq('id', taskId)
        .eq('user_id', user.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
    },
    onError: (error) => {
      showError(`Failed to toggle lock: ${error.message}`);
    }
  });

  const aetherDump = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User not authenticated.");

      const flexibleTasks = dbScheduledTasks?.filter(task => task.is_flexible && !task.is_locked) || [];

      if (flexibleTasks.length === 0) {
        showSuccess("No flexible tasks to dump to Aether Sink.");
        return;
      }

      const retiredTasksToInsert = flexibleTasks.map(task => ({
        user_id: user.id,
        name: task.name,
        duration: task.duration || differenceInMinutes(parseISO(task.end_time!), parseISO(task.start_time!)),
        break_duration: task.break_duration,
        original_scheduled_date: task.scheduled_date,
        is_critical: task.is_critical,
        is_locked: task.is_locked,
        is_completed: task.is_completed,
        energy_cost: task.energy_cost,
        is_custom_energy_cost: task.is_custom_energy_cost,
        task_environment: task.task_environment,
        is_backburner: task.is_backburner,
        retired_at: new Date().toISOString(),
        created_at: task.created_at,
      }));

      const { error: insertError } = await supabase.from('retired_tasks').insert(retiredTasksToInsert);
      if (insertError) throw insertError;

      const { error: deleteError } = await supabase.from('scheduled_tasks').delete().in('id', flexibleTasks.map(t => t.id)).eq('user_id', user.id);
      if (deleteError) throw deleteError;

      showSuccess(`${flexibleTasks.length} flexible tasks moved to Aether Sink.`);
      return flexibleTasks.length;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', user?.id] });
    },
    onError: (error) => {
      showError(`Failed to Aether Dump: ${error.message}`);
    }
  });

  const aetherDumpMega = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User not authenticated.");

      const allScheduledTasks = dbScheduledTasks || [];

      if (allScheduledTasks.length === 0) {
        showSuccess("No tasks to dump to Aether Sink.");
        return;
      }

      const retiredTasksToInsert = allScheduledTasks.map(task => ({
        user_id: user.id,
        name: task.name,
        duration: task.duration || differenceInMinutes(parseISO(task.end_time!), parseISO(task.start_time!)),
        break_duration: task.break_duration,
        original_scheduled_date: task.scheduled_date,
        is_critical: task.is_critical,
        is_locked: task.is_locked,
        is_completed: task.is_completed,
        energy_cost: task.energy_cost,
        is_custom_energy_cost: task.is_custom_energy_cost,
        task_environment: task.task_environment,
        is_backburner: task.is_backburner,
        retired_at: new Date().toISOString(),
        created_at: task.created_at,
      }));

      const { error: insertError } = await supabase.from('retired_tasks').insert(retiredTasksToInsert);
      if (insertError) throw insertError;

      const { error: deleteError } = await supabase.from('scheduled_tasks').delete().in('id', allScheduledTasks.map(t => t.id)).eq('user_id', user.id);
      if (deleteError) throw deleteError;

      showSuccess(`${allScheduledTasks.length} tasks moved to Aether Sink.`);
      return allScheduledTasks.length;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', user?.id] });
    },
    onError: (error) => {
      showError(`Failed to Aether Dump Mega: ${error.message}`);
    }
  });

  const autoBalanceSchedule = useMutation({
    mutationFn: async (payload: AutoBalancePayload) => {
      if (!user) throw new Error("User not authenticated.");

      const { scheduledTaskIdsToDelete, retiredTaskIdsToDelete, tasksToInsert, tasksToKeepInSink, selectedDate } = payload;

      // 1. Delete scheduled tasks
      if (scheduledTaskIdsToDelete.length > 0) {
        const { error } = await supabase.from('scheduled_tasks').delete().in('id', scheduledTaskIdsToDelete).eq('user_id', user.id);
        if (error) throw error;
      }

      // 2. Delete retired tasks
      if (retiredTaskIdsToDelete.length > 0) {
        const { error } = await supabase.from('retired_tasks').delete().in('id', retiredTaskIdsToDelete).eq('user_id', user.id);
        if (error) throw error;
      }

      // 3. Insert new scheduled tasks
      if (tasksToInsert.length > 0) {
        const tasksWithUserId = tasksToInsert.map(task => ({
          ...task,
          user_id: user.id,
          created_at: task.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));
        const { error } = await supabase.from('scheduled_tasks').upsert(tasksWithUserId, { onConflict: 'id' });
        if (error) throw error;
      }

      // 4. Insert/Update tasks to keep in sink (e.g., flexible tasks that couldn't be placed)
      if (tasksToKeepInSink.length > 0) {
        const now = new Date().toISOString();
        const newSinkTasks: NewRetiredTask[] = tasksToKeepInSink.map(t => ({
          ...t,
          user_id: user.id,
          retired_at: now,
          created_at: t.created_at || now,
          is_locked: t.is_locked || false, // Ensure is_locked is present
        }));
        const { error } = await supabase.from('retired_tasks').upsert(newSinkTasks, { onConflict: 'id' });
        if (error) throw error;
      }

      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', user?.id] });
    },
    onError: (error) => {
      showError(`Failed to auto-balance schedule: ${error.message}`);
    }
  });

  const completeScheduledTask = useMutation({
    mutationFn: async (task: DBScheduledTask) => {
      if (!user) throw new Error("User not authenticated.");

      // 1. Log completion
      const { error: logError } = await supabase.from('completed_tasks_log').insert({
        user_id: user.id,
        task_id: task.id,
        name: task.name,
        scheduled_date: task.scheduled_date,
        completed_at: new Date().toISOString(),
        energy_cost: task.energy_cost,
        duration: task.duration || differenceInMinutes(parseISO(task.end_time!), parseISO(task.start_time!)),
        is_completed: true,
      });
      if (logError) throw logError;

      // 2. Remove from scheduled_tasks
      const { error: removeError } = await supabase.from('scheduled_tasks').delete().eq('id', task.id).eq('user_id', user.id);
      if (removeError) throw removeError;

      return task.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['completedTasksForSelectedDayList', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', user?.id] });
    },
    onError: (error) => {
      showError(`Failed to complete task: ${error.message}`);
    }
  });

  const updateScheduledTaskDetails = useMutation({
    mutationFn: async (task: DBScheduledTask) => {
      if (!user) throw new Error("User not authenticated.");
      const { data, error } = await supabase
        .from('scheduled_tasks')
        .update({ ...task, updated_at: new Date().toISOString() })
        .eq('id', task.id)
        .eq('user_id', user.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
    },
    onError: (error) => {
      showError(`Failed to update task details: ${error.message}`);
    }
  });

  const updateScheduledTaskStatus = useMutation({
    mutationFn: async ({ taskId, isCompleted }: { taskId: string; isCompleted: boolean }) => {
      if (!user) throw new Error("User not authenticated.");
      const { data, error } = await supabase
        .from('scheduled_tasks')
        .update({ is_completed: isCompleted, updated_at: new Date().toISOString() })
        .eq('id', taskId)
        .eq('user_id', user.id)
        .select()
        .single();
      if (error) throw error;

      // If completing a fixed task, also log it
      if (isCompleted && data) {
        const { error: logError } = await supabase.from('completed_tasks_log').insert({
          user_id: user.id,
          task_id: data.id,
          name: data.name,
          scheduled_date: data.scheduled_date,
          completed_at: new Date().toISOString(),
          energy_cost: data.energy_cost,
          duration: data.duration || differenceInMinutes(parseISO(data.end_time!), parseISO(data.start_time!)),
          is_completed: true,
        });
        if (logError) console.error("Failed to log completed fixed task:", logError);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['completedTasksForSelectedDayList', user?.id] });
    },
    onError: (error) => {
      showError(`Failed to update task status: ${error.message}`);
    }
  });


  return {
    dbScheduledTasks,
    isLoading: isSchedulerTasksLoading,
    addScheduledTask: addScheduledTask.mutateAsync,
    addRetiredTask: addRetiredTask.mutateAsync,
    removeScheduledTask: removeScheduledTask.mutateAsync,
    clearScheduledTasks: clearScheduledTasks.mutateAsync,
    datesWithTasks,
    isLoadingDatesWithTasks,
    retiredTasks,
    isLoadingRetiredTasks,
    completedTasksForSelectedDayList,
    isLoadingCompletedTasksForSelectedDay,
    retireTask: retireTask.mutateAsync,
    rezoneTask: rezoneTask.mutateAsync,
    compactScheduledTasks: compactScheduledTasks.mutateAsync,
    randomizeBreaks: randomizeBreaks.mutateAsync,
    toggleScheduledTaskLock: toggleScheduledTaskLock.mutate,
    aetherDump: aetherDump.mutateAsync,
    aetherDumpMega: aetherDumpMega.mutateAsync,
    sortBy,
    setSortBy,
    retiredSortBy,
    setRetiredSortBy,
    autoBalanceSchedule: autoBalanceSchedule.mutateAsync,
    completeScheduledTask: completeScheduledTask.mutateAsync,
    updateScheduledTaskDetails: updateScheduledTaskDetails.mutateAsync,
    updateScheduledTaskStatus: updateScheduledTaskStatus.mutateAsync,
    removeRetiredTask: removeRetiredTask.mutateAsync,
  };
};