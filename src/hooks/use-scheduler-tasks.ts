import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Task, NewTask, TaskStatusFilter, TemporalFilter } from '@/types';
import { DBScheduledTask, NewDBScheduledTask, RawTaskInput, RetiredTask, NewRetiredTask, SortBy, TaskPriority, TimeBlock, AutoBalancePayload, UnifiedTask, RetiredTaskSortBy } from '@/types/scheduler';
import { useSession } from './use-session';
import { showSuccess, showError } from '@/utils/toast';
import { startOfDay, subDays, formatISO, parseISO, isToday, isYesterday, format, addMinutes, isBefore, isAfter, addDays } from 'date-fns';
import { XP_PER_LEVEL, MAX_ENERGY } from '@/lib/constants';
import { mergeOverlappingTimeBlocks, getFreeTimeBlocks, isSlotFree, calculateEnergyCost, compactScheduleLogic, getEmojiHue } from '@/lib/scheduler-utils'; // Removed sortTasksByVibeFlow
import { useTasks } from './use-tasks';

const getDateRange = (filter: TemporalFilter): { start: string, end: string } | null => {
  const now = new Date();
  const startOfToday = startOfDay(now);
  
  let startDate: Date;
  let endDate: Date;

  switch (filter) {
    case 'TODAY':
      startDate = new Date(0);
      endDate = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
      break;
    case 'YESTERDAY':
      startDate = subDays(startOfToday, 1);
      endDate = startOfToday;
      break;
    case 'LAST_7_DAYS':
      startDate = subDays(startOfToday, 7);
      endDate = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
      break;
    default:
      return null;
  }

  return {
    start: formatISO(startDate),
    end: formatISO(endDate),
  };
};

const sortTasks = (tasks: Task[], sortBy: SortBy): Task[] => {
  const priorityOrder: Record<TaskPriority, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

  return [...tasks].sort((a, b) => {
    if (sortBy === 'PRIORITY_HIGH_TO_LOW') {
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
    } else if (sortBy === 'PRIORITY_LOW_TO_HIGH') {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
    }
    return 0; 
  });
};

const calculateLevelAndRemainingXp = (totalXp: number) => {
  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
  const xpForCurrentLevel = (level - 1) * XP_PER_LEVEL;
  const xpTowardsNextLevel = totalXp - xpForCurrentLevel;
  const xpRemainingForNextLevel = XP_PER_LEVEL - xpTowardsNextLevel;
  return { level, xpTowardsNextLevel, xpRemainingForNextLevel };
};

// Define a common interface for mutation context
interface MutationContext {
  previousScheduledTasks?: DBScheduledTask[];
  previousRetiredTasks?: RetiredTask[];
  previousScrollTop?: number;
}

export const useSchedulerTasks = (selectedDate: string, scrollRef?: React.RefObject<HTMLElement>) => {
  const queryClient = useQueryClient();
  const { user, profile, refreshProfile, triggerLevelUp, session } = useSession(); // Destructure session here
  const userId = user?.id;

  const formattedSelectedDate = selectedDate;

  const [sortBy, setSortBy] = useState<SortBy>('TIME_EARLIEST_TO_LATEST');
  // Initialize retiredSortBy from localStorage or default
  const [retiredSortBy, setRetiredSortBy] = useState<RetiredTaskSortBy>(() => {
    if (typeof window !== 'undefined') {
      const savedSortBy = localStorage.getItem('aetherSinkSortBy');
      return savedSortBy ? (savedSortBy as RetiredTaskSortBy) : 'RETIRED_AT_NEWEST';
    }
    return 'RETIRED_AT_NEWEST';
  });
  const [xpGainAnimation, setXpGainAnimation] = useState<{ taskId: string, xpAmount: number } | null>(null);

  // Effect to save retiredSortBy to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('aetherSinkSortBy', retiredSortBy);
    }
  }, [retiredSortBy]);

  const { data: dbScheduledTasks = [], isLoading } = useQuery<DBScheduledTask[]>({
    queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy],
    queryFn: async () => {
      if (!userId) {
        console.log("useSchedulerTasks: No user ID, returning empty array.");
        return [];
      }
      if (!formattedSelectedDate) {
        console.log("useSchedulerTasks: No selected date, returning empty array.");
        return [];
      }
      console.log("useSchedulerTasks: Fetching scheduled tasks for user:", userId, "on date:", formattedSelectedDate, "sorted by:", sortBy);
      let query = supabase
        .from('scheduled_tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('scheduled_date', formattedSelectedDate);

      if (sortBy === 'TIME_EARLIEST_TO_LATEST') {
        query = query.order('start_time', { ascending: true });
      } else if (sortBy === 'TIME_LATEST_TO_EARLIEST') {
        query = query.order('start_time', { ascending: false });
      } else if (sortBy === 'PRIORITY_HIGH_TO_LOW') {
        query = query.order('is_critical', { ascending: false }).order('start_time', { ascending: true });
      } else if (sortBy === 'PRIORITY_LOW_TO_HIGH') {
        query = query.order('is_critical', { ascending: true }).order('start_time', { ascending: true });
      } else if (sortBy === 'EMOJI') {
        // EMOJI sorting is client-side as it depends on task name parsing
        // We'll fetch by creation time and sort client-side
        query = query.order('created_at', { ascending: true });
      } else {
        query = query.order('created_at', { ascending: true });
      }

      const { data, error } = await query;

      if (error) {
        console.error("useSchedulerTasks: Error fetching scheduled tasks:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully fetched tasks:", data.map(t => ({ id: t.id, name: t.name, scheduled_date: t.scheduled_date, start_time: t.start_time, end_time: t.end_time, is_critical: t.is_critical, is_flexible: t.is_flexible, is_locked: t.is_locked, energy_cost: t.energy_cost, is_completed: t.is_completed, is_custom_energy_cost: t.is_custom_energy_cost, task_environment: t.task_environment })));
      
      // Client-side sorting for EMOJI
      if (sortBy === 'EMOJI') {
        return (data as DBScheduledTask[]).sort((a, b) => {
          const hueA = getEmojiHue(a.name);
          const hueB = getEmojiHue(b.name);
          return hueA - hueB;
        });
      }

      return data as DBScheduledTask[];
    },
    enabled: !!userId && !!formattedSelectedDate,
  });

  const { data: datesWithTasks = [], isLoading: isLoadingDatesWithTasks } = useQuery<string[]>({
    queryKey: ['datesWithTasks', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('scheduled_tasks')
        .select('scheduled_date')
        .eq('user_id', userId);

      if (error) {
        console.error("useSchedulerTasks: Error fetching dates with tasks:", error.message);
        throw new Error(error.message);
      }
      const uniqueDates = Array.from(new Set(data.map(item => format(parseISO(item.scheduled_date), 'yyyy-MM-dd'))));
      return uniqueDates;
    },
    enabled: !!userId,
  });

  const { data: retiredTasks = [], isLoading: isLoadingRetiredTasks } = useQuery<RetiredTask[]>({
    queryKey: ['retiredTasks', userId, retiredSortBy], // NEW: Add retiredSortBy to queryKey
    queryFn: async () => {
      if (!userId) return [];
      console.log("useSchedulerTasks: Fetching retired tasks for user:", userId, "sorted by:", retiredSortBy);
      let query = supabase
        .from('aethersink') // CORRECTED: Use 'aethersink'
        .select('*')
        .eq('user_id', userId);

      // Apply sorting based on retiredSortBy
      switch (retiredSortBy) {
        case 'NAME_ASC':
          query = query.order('name', { ascending: true });
          break;
        case 'NAME_DESC':
          query = query.order('name', { ascending: false });
          break;
        case 'DURATION_ASC':
          query = query.order('duration', { ascending: true, nullsFirst: true });
          break;
        case 'DURATION_DESC':
          query = query.order('duration', { ascending: false }); // Removed nullsLast: true
          break;
        case 'CRITICAL_FIRST':
          query = query.order('is_critical', { ascending: false }).order('retired_at', { ascending: false });
          break;
        case 'CRITICAL_LAST':
          query = query.order('is_critical', { ascending: true }).order('retired_at', { ascending: false });
          break;
        case 'LOCKED_FIRST':
          query = query.order('is_locked', { ascending: false }).order('retired_at', { ascending: false });
          break;
        case 'LOCKED_LAST':
          query = query.order('is_locked', { ascending: true }).order('retired_at', { ascending: false });
          break;
        case 'ENERGY_ASC':
          query = query.order('energy_cost', { ascending: true });
          break;
        case 'ENERGY_DESC':
          query = query.order('energy_cost', { ascending: false });
          break;
        case 'RETIRED_AT_OLDEST':
          query = query.order('retired_at', { ascending: true });
          break;
        case 'COMPLETED_FIRST':
          query = query.order('is_completed', { ascending: false }).order('retired_at', { ascending: false });
          break;
        case 'COMPLETED_LAST':
          query = query.order('is_completed', { ascending: true }).order('retired_at', { ascending: false });
          break;
        case 'EMOJI': // NEW: EMOJI sort
          // Fetch all and sort client-side
          query = query.order('retired_at', { ascending: false }); // Default DB sort
          break;
        case 'RETIRED_AT_NEWEST': // Default or fallback
        default:
          query = query.order('retired_at', { ascending: false });
          break;
      }

      const { data, error } = await query;

      if (error) {
        console.error("useSchedulerTasks: Error fetching retired tasks:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully fetched retired tasks:", data.map(t => ({ id: t.id, name: t.name, is_critical: t.is_critical, is_locked: t.is_locked, energy_cost: t.energy_cost, is_completed: t.is_completed, is_custom_energy_cost: t.is_custom_energy_cost, task_environment: t.task_environment })));
      
      // Client-side sorting for EMOJI
      if (retiredSortBy === 'EMOJI') {
        return (data as RetiredTask[]).sort((a, b) => {
          const hueA = getEmojiHue(a.name);
          const hueB = getEmojiHue(b.name);
          return hueA - hueB;
        });
      }

      return data as RetiredTask[];
    },
    enabled: !!userId,
    placeholderData: (previousData) => previousData, // Keep previous data while fetching new data
  });

  // Renamed from completedTasksTodayList to completedTasksForSelectedDayList
  const { data: completedTasksForSelectedDayList = [], isLoading: isLoadingCompletedTasksForSelectedDay } = useQuery<DBScheduledTask[]>({
    queryKey: ['completedTasksForSelectedDayList', userId, formattedSelectedDate], // Key includes selectedDate
    queryFn: async () => {
      if (!userId) return [];
      
      // Correctly calculate UTC start and end of the selected day
      const selectedDayDate = parseISO(formattedSelectedDate);
      const selectedDayStartUTC = new Date(Date.UTC(selectedDayDate.getFullYear(), selectedDayDate.getMonth(), selectedDayDate.getDate())).toISOString();
      const selectedDayEndUTC = new Date(Date.UTC(selectedDayDate.getFullYear(), selectedDayDate.getMonth(), selectedDayDate.getDate() + 1)).toISOString();

      console.log("useSchedulerTasks: Fetching completed tasks for selected day. User ID:", userId, "Selected Day:", formattedSelectedDate);
      console.log("useSchedulerTasks: Selected Day Start UTC:", selectedDayStartUTC);
      console.log("useSchedulerTasks: Selected Day End UTC:", selectedDayEndUTC);

      // Fetch completed scheduled tasks for selected day
      const { data: scheduled, error: scheduledError } = await supabase
        .from('scheduled_tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('is_completed', true)
        .gte('updated_at', selectedDayStartUTC)
        .lt('updated_at', selectedDayEndUTC);

      if (scheduledError) {
        console.error('useSchedulerTasks: Error fetching completed scheduled tasks for selected day:', scheduledError);
        throw new Error(scheduledError.message);
      }
      console.log("useSchedulerTasks: Completed Scheduled Tasks for selected day:", scheduled);

      // Fetch completed retired tasks for selected day
      const { data: retired, error: retiredError } = await supabase
        .from('aethersink') // CORRECTED: Use 'aethersink'
        .select('*')
        .eq('user_id', userId)
        .eq('is_completed', true)
        .gte('retired_at', selectedDayStartUTC) // Use retired_at for completion time
        .lt('retired_at', selectedDayEndUTC);

      if (retiredError) {
        console.error('useSchedulerTasks: Error fetching completed retired tasks for selected day:', retiredError);
        throw new Error(retiredError.message);
      }
      console.log("useSchedulerTasks: Completed Retired Tasks for selected day:", retired);

      // Fetch completed general tasks for selected day
      const { data: generalTasks, error: generalTasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('is_completed', true)
        .gte('updated_at', selectedDayStartUTC) // Use updated_at for completion time
        .lt('updated_at', selectedDayEndUTC);

      if (generalTasksError) {
        console.error('useSchedulerTasks: Error fetching completed general tasks for selected day:', generalTasksError);
        throw new Error(generalTasksError.message);
      }
      console.log("useSchedulerTasks: Completed General Tasks for selected day:", generalTasks);

      // Combine and map tasks
      const combinedTasks: DBScheduledTask[] = [
        ...(scheduled || []).map(t => ({ ...t, task_environment: t.task_environment || 'laptop' })),
        ...(retired || []).map(rt => ({
          id: rt.id,
          user_id: rt.user_id,
          name: rt.name,
          break_duration: rt.break_duration,
          start_time: null,
          end_time: null,
          scheduled_date: rt.original_scheduled_date,
          created_at: rt.retired_at,
          updated_at: rt.retired_at,
          is_critical: rt.is_critical,
          is_flexible: false,
          is_locked: rt.is_locked,
          energy_cost: rt.energy_cost,
          is_completed: rt.is_completed,
          is_custom_energy_cost: rt.is_custom_energy_cost,
          task_environment: rt.task_environment, // Include environment
        })),
        ...(generalTasks || []).map(gt => ({
          id: gt.id,
          user_id: gt.user_id,
          name: gt.title,
          break_duration: null,
          start_time: null,
          end_time: null,
          scheduled_date: format(parseISO(gt.updated_at), 'yyyy-MM-dd'),
          created_at: gt.created_at,
          updated_at: gt.updated_at,
          is_critical: gt.is_critical,
          is_flexible: false,
          is_locked: false,
          energy_cost: gt.energy_cost,
          is_completed: gt.is_completed,
          is_custom_energy_cost: gt.is_custom_energy_cost,
          task_environment: 'laptop', // Default environment for general tasks
        })),
      ];

      console.log("useSchedulerTasks: Combined Tasks for selected day (before sorting):", combinedTasks);
      combinedTasks.forEach(task => console.log(`useSchedulerTasks: Task: ${task.name}, Energy Cost: ${task.energy_cost}, Is Completed: ${task.is_completed}`));

      // Sort by updated_at/retired_at descending (most recent first)
      return combinedTasks.sort((a, b) => {
        const timeA = parseISO(a.updated_at || a.created_at).getTime();
        const timeB = parseISO(b.updated_at || b.created_at).getTime();
        return timeB - timeA;
      });
    },
    enabled: !!userId && !!formattedSelectedDate, // Always enabled if userId and selectedDate are present
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });


  const rawTasks: RawTaskInput[] = dbScheduledTasks.map(dbTask => ({
    name: dbTask.name,
    duration: Math.floor((parseISO(dbTask.end_time!).getTime() - parseISO(dbTask.start_time!).getTime()) / (1000 * 60)),
    breakDuration: dbTask.break_duration ?? undefined,
    isCritical: dbTask.is_critical,
    energyCost: dbTask.energy_cost,
  }));

  const addScheduledTaskMutation = useMutation({
    mutationFn: async (newTask: NewDBScheduledTask) => {
      if (!userId) throw new Error("User not authenticated.");
      const taskToInsert = { ...newTask, user_id: userId, energy_cost: newTask.energy_cost ?? 0, is_completed: newTask.is_completed ?? false, is_custom_energy_cost: newTask.is_custom_energy_cost ?? false, task_environment: newTask.task_environment ?? 'laptop' };
      console.log("useSchedulerTasks: Attempting to insert new task:", taskToInsert);
      const { data, error } = await supabase.from('scheduled_tasks').insert(taskToInsert).select().single();
      if (error) {
        console.error("useSchedulerTasks: Error inserting task:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully inserted task:", data);
      return data as DBScheduledTask;
    },
    onMutate: async (newTask: NewDBScheduledTask) => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });

      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop; // Capture scroll position

      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], (old) => {
        const tempId = Math.random().toString(36).substring(2, 9);
        const now = new Date().toISOString();
        const optimisticTask: DBScheduledTask = { // <-- FIX 2: Add task_environment
          id: tempId,
          user_id: userId!,
          name: newTask.name,
          break_duration: newTask.break_duration ?? null,
          start_time: newTask.start_time ?? now,
          end_time: newTask.end_time ?? now,
          scheduled_date: newTask.scheduled_date,
          created_at: now, // FIX 3: Directly set created_at
          updated_at: now,
          is_critical: newTask.is_critical ?? false,
          is_flexible: newTask.is_flexible ?? true,
          is_locked: newTask.is_locked ?? false,
          energy_cost: newTask.energy_cost ?? 0,
          is_completed: newTask.is_completed ?? false,
          is_custom_energy_cost: newTask.is_custom_energy_cost ?? false,
          task_environment: newTask.task_environment ?? 'laptop', // <-- FIX 2: Added task_environment
        };
        return [...(old || []), optimisticTask];
      });

      return { previousScheduledTasks, previousScrollTop };
    },
    onSuccess: () => {
      // No toast here, moved to onSettled
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
      showSuccess('Task added to schedule!');
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (e) => {
      showError(`Failed to add task to schedule: ${e.message}`);
    }
  });

  const addRetiredTaskMutation = useMutation({
    mutationFn: async (newTask: NewRetiredTask) => {
      if (!userId) throw new Error("User not authenticated.");
      const taskToInsert = { ...newTask, user_id: userId, retired_at: new Date().toISOString(), energy_cost: newTask.energy_cost ?? 0, is_completed: newTask.is_completed ?? false, is_custom_energy_cost: newTask.is_custom_energy_cost ?? false, task_environment: newTask.task_environment ?? 'laptop' };
      console.log("useSchedulerTasks: Attempting to insert new retired task:", taskToInsert);
      const { data, error } = await supabase.from('aethersink').insert(taskToInsert).select().single(); // CORRECTED
      if (error) {
        console.error("useSchedulerTasks: Error inserting retired task:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully inserted retired task:", data);
      return data as RetiredTask;
    },
    onMutate: async (newTask: NewRetiredTask) => {
      await queryClient.cancelQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] }); // NEW: Update queryKey
      const previousRetiredTasks = queryClient.getQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy]); // NEW: Update queryKey
      const previousScrollTop = scrollRef?.current?.scrollTop; // Capture scroll position

      // Removed optimistic update for retiredTasks to prevent duplicates
      // queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId], (old) => {
      //   const tempId = Math.random().toString(36).substring(2, 9);
      //   const optimisticTask: RetiredTask = {
      //     id: tempId,
      //     user_id: userId!,
      //     name: newTask.name,
      //     duration: newTask.duration ?? null,
      //     break_duration: newTask.break_duration ?? null,
      //     original_scheduled_date: newTask.original_scheduled_date,
      //     retired_at: new Date().toISOString(),
      //     is_critical: newTask.is_critical ?? false,
      //     is_locked: newTask.is_locked ?? false,
      //     energy_cost: newTask.energy_cost ?? 0,
      //   };
      //   return [optimisticTask, ...(old || [])];
      // });
      return { previousRetiredTasks, previousScrollTop };
    },
    onSuccess: () => {
      // No toast here, moved to onSettled
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] }); // NEW: Update queryKey
      showSuccess('Task sent directly to Aether Sink!');
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (err, newTask, context) => {
      // Check if the error message indicates a unique constraint violation (409 Conflict)
      if (err instanceof Error && err.message.includes('409 (Conflict)')) {
        showError(`A task named "${newTask.name}" for the original date ${format(parseISO(newTask.original_scheduled_date), 'MMM d, yyyy')} already exists in the Aether Sink. If you wish to add it again, consider modifying its name slightly.`);
      } else {
        showError(`Failed to send task to Aether Sink: ${err.message}`);
      }
      if (context?.previousRetiredTasks) {
        queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], context.previousRetiredTasks); // NEW: Update queryKey
      }
    }
  });


  const removeScheduledTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("useSchedulerTasks: Attempting to remove task ID:", taskId);
      const { error } = await supabase.from('scheduled_tasks').delete().eq('id', taskId).eq('user_id', userId);
      if (error) {
        console.error("useSchedulerTasks: Error removing task:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully removed task ID:", taskId);
    },
    onMutate: async (taskId: string) => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop; // Capture scroll position

      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], (old) =>
        (old || []).filter(task => task.id !== taskId)
      );
      return { previousScheduledTasks, previousScrollTop };
    },
    onSuccess: () => {
      // No toast here, moved to onSettled
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
      showSuccess('Task removed from schedule.');
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop; // Restore scroll position
      }
    },
    onError: (e, taskId, context) => {
      showError(`Failed to remove task from schedule: ${e.message}`);
      if (context?.previousScheduledTasks) {
        queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], context.previousScheduledTasks);
      }
    }
  });

  const removeRetiredTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("useSchedulerTasks: Attempting to remove retired task ID:", taskId);
      const { error } = await supabase.from('aethersink').delete().eq('id', taskId).eq('user_id', userId);
      if (error) {
        console.error("useSchedulerTasks: Error removing retired task:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully removed retired task ID:", taskId);
    },
    onMutate: async (taskId: string) => {
      await queryClient.cancelQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      const previousRetiredTasks = queryClient.getQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], (old) =>
        (old || []).filter(task => task.id !== taskId)
      );
      return { previousRetiredTasks, previousScrollTop };
    },
    onSuccess: () => {
      // No toast here, moved to onSettled
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      showSuccess('Retired task permanently deleted.');
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (e, taskId, context) => {
      showError(`Failed to remove retired task: ${e.message}`);
      if (context?.previousRetiredTasks) {
        queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], context.previousRetiredTasks);
      }
    }
  });

  const clearScheduledTasksMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("useSchedulerTasks: Attempting to clear all scheduled tasks for user:", userId);
      const { error } = await supabase.from('scheduled_tasks').delete().eq('user_id', userId).eq('scheduled_date', formattedSelectedDate);
      if (error) {
        console.error("useSchedulerTasks: Error clearing scheduled tasks:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully cleared all scheduled tasks for user:", userId, "on date:", formattedSelectedDate);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop; // Capture scroll position

      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], []);
      return { previousScheduledTasks, previousScrollTop };
    },
    onSuccess: () => {
      // No toast here, moved to onSettled
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
      showSuccess('Schedule cleared for today!');
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (e, _variables, context) => {
      showError(`Failed to clear schedule: ${e.message}`);
      if (context?.previousScheduledTasks) {
        queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], context.previousScheduledTasks);
      }
    }
  });

  const retireTaskMutation = useMutation({
    mutationFn: async (taskToRetire: DBScheduledTask) => {
      if (!userId) throw new Error("User not authenticated.");

      const newRetiredTask: NewRetiredTask = {
        user_id: userId,
        name: taskToRetire.name,
        duration: (taskToRetire.start_time && taskToRetire.end_time) 
                  ? Math.floor((parseISO(taskToRetire.end_time!).getTime() - parseISO(taskToRetire.start_time!).getTime()) / (1000 * 60)) 
                  : null,
        break_duration: taskToRetire.break_duration,
        original_scheduled_date: taskToRetire.scheduled_date,
        is_critical: taskToRetire.is_critical,
        is_locked: taskToRetire.is_locked,
        energy_cost: taskToRetire.energy_cost ?? 0,
        is_completed: taskToRetire.is_completed ?? false, // Pass completion status
        is_custom_energy_cost: taskToRetire.is_custom_energy_cost ?? false, // Pass custom energy cost flag
        task_environment: taskToRetire.task_environment, // NEW: Add environment
      };
      const { error: insertError } = await supabase.from('aethersink').insert(newRetiredTask); // CORRECTED
      if (insertError) throw new Error(`Failed to move task to Aether Sink: ${insertError.message}`);

      const { error: deleteError } = await supabase.from('scheduled_tasks').delete().eq('id', taskToRetire.id).eq('user_id', userId);
      if (deleteError) throw new Error(`Failed to remove task from schedule: ${deleteError.message}`);
    },
    onMutate: async (taskToRetire: DBScheduledTask) => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      await queryClient.cancelQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] }); // NEW: Update queryKey

      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);
      const previousRetiredTasks = queryClient.getQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy]); // NEW: Update queryKey
      const previousScrollTop = scrollRef?.current?.scrollTop; // Capture scroll position

      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], (old) =>
        (old || []).filter(task => task.id !== taskToRetire.id)
      );

      // Removed optimistic update for retiredTasks to prevent duplicates
      // const newRetiredTask: RetiredTask = {
      //   id: taskToRetire.id,
      //   user_id: userId!,
      //   name: taskToRetire.name,
      //   duration: (taskToRetire.start_time && taskToRetire.end_time) 
      //             ? Math.floor((parseISO(taskToRetire.end_time).getTime() - parseISO(taskToRetire.start_time).getTime()) / (1000 * 60)) 
      //             : null,
      //   break_duration: taskToRetire.break_duration,
      //   original_scheduled_date: taskToRetire.scheduled_date,
      //   retired_at: new Date().toISOString(),
      //   is_critical: taskToRetire.is_critical, 
      //   is_locked: taskToRetire.is_locked,
      //   energy_cost: taskToRetire.energy_cost ?? 0,
      // };
      // queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId], (old) =>
      //   [newRetiredTask, ...(old || [])]
      // );

      return { previousScheduledTasks, previousRetiredTasks, previousScrollTop };
    },
    onSuccess: () => {
      // No toast here, moved to onSettled
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] }); // NEW: Update queryKey
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
      showSuccess('Task moved to Aether Sink.');
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (err, taskToRetire, context) => {
      showError(`Failed to retire task: ${err.message}`);
      if (context?.previousScheduledTasks) {
        queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], context.previousScheduledTasks);
      }
      if (context?.previousRetiredTasks) {
        queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], context.previousRetiredTasks); // NEW: Update queryKey
      }
    }
  });

  const rezoneTaskMutation = useMutation({
    mutationFn: async (retiredTaskId: string) => {
      if (!userId) throw new Error("User not authenticated.");

      const { error: deleteError } = await supabase.from('aethersink').delete().eq('id', retiredTaskId).eq('user_id', userId); // CORRECTED
      if (deleteError) throw new Error(`Failed to remove task from Aether Sink: ${deleteError.message}`);
    },
    onMutate: async (retiredTaskId: string) => {
      await queryClient.cancelQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] }); // NEW: Update queryKey
      const previousRetiredTasks = queryClient.getQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy]); // NEW: Update queryKey
      const previousScrollTop = scrollRef?.current?.scrollTop; // Capture scroll position

      queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], (old) => // NEW: Update queryKey
        (old || []).filter(task => task.id !== retiredTaskId)
      );
      return { previousRetiredTasks, previousScrollTop };
    },
    onSuccess: () => {
      // No toast here, moved to onSettled
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] }); // NEW: Update queryKey
      showSuccess('Task removed from Aether Sink.');
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (err, retiredTaskId, context) => {
      showError(`Failed to remove task from Aether Sink: ${err.message}`);
      if (context?.previousRetiredTasks) {
        queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], context.previousRetiredTasks); // NEW: Update queryKey
      }
    }
  });

  const compactScheduledTasksMutation = useMutation({
    mutationFn: async ({ tasksToUpdate }: { tasksToUpdate: DBScheduledTask[] }) => { // Removed isVibeFlowEnabled
      if (!userId) throw new Error("User not authenticated.");

      const updatableTasks = tasksToUpdate.filter(task => task.is_flexible && !task.is_locked);
      const nonUpdatableTasks = tasksToUpdate.filter(task => !task.is_flexible || task.is_locked);

      if (updatableTasks.length === 0 && nonUpdatableTasks.length > 0) {
        showSuccess("No flexible tasks to compact, fixed/locked tasks were skipped.");
        return;
      } else if (updatableTasks.length === 0) {
        showSuccess("No flexible tasks to compact.");
        return;
      }

      const updates = updatableTasks.map(task => ({
        id: task.id,
        user_id: userId,
        name: task.name,
        break_duration: task.break_duration,
        start_time: task.start_time,
        end_time: task.end_time,
        scheduled_date: task.scheduled_date,
        is_critical: task.is_critical,
        is_flexible: task.is_flexible,
        is_locked: task.is_locked,
        energy_cost: task.energy_cost ?? 0,
        is_completed: task.is_completed ?? false,
        is_custom_energy_cost: task.is_custom_energy_cost ?? false,
        task_environment: task.task_environment,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from('scheduled_tasks').upsert(updates, { onConflict: 'id' });

      if (error) {
        console.error("useSchedulerTasks: Error compacting tasks:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully compacted tasks.");
    },
    onMutate: async ({ tasksToUpdate }: { tasksToUpdate: DBScheduledTask[] }) => { // Removed isVibeFlowEnabled
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop; // Capture scroll position

      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], (old) => {
        const updatedTasks = (old || []).map(oldTask => {
          const newTask = tasksToUpdate.find(t => t.id === oldTask.id);
          return newTask && newTask.is_flexible && !newTask.is_locked ? newTask : oldTask;
        });
        return updatedTasks;
      });
      return { previousScheduledTasks, previousScrollTop };
    },
    onSuccess: () => {
      // No toast here, moved to onSettled
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      showSuccess('Schedule compacted!');
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (e, _variables, context) => {
      showError(`Failed to compact schedule: ${e.message}`);
      if (context?.previousScheduledTasks) {
        queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], context.previousScheduledTasks);
      }
    }
  });

  const randomizeBreaksMutation = useMutation({
    mutationFn: async ({ selectedDate, workdayStartTime, workdayEndTime, currentDbTasks }: {
      selectedDate: string;
      workdayStartTime: Date;
      workdayEndTime: Date;
      currentDbTasks: DBScheduledTask[];
    }) => {
      if (!userId) throw new Error("User not authenticated.");

      const nonBreakTasks = currentDbTasks.filter(task => task.name.toLowerCase() !== 'break');
      let breakTasksToRandomize = currentDbTasks.filter(task => task.name.toLowerCase() === 'break' && !task.is_locked);

      if (breakTasksToRandomize.length === 0) {
        showSuccess("No flexible break tasks to randomize.");
        return { placedBreaks: [], failedToPlaceBreaks: [] };
      }

      for (let i = breakTasksToRandomize.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [breakTasksToRandomize[i], breakTasksToRandomize[j]] = [breakTasksToRandomize[j], breakTasksToRandomize[i]];
      }

      const placedBreaks: DBScheduledTask[] = [];
      const failedToPlaceBreaks: DBScheduledTask[] = [];

      let currentOccupiedBlocks: TimeBlock[] = mergeOverlappingTimeBlocks(
        currentDbTasks.filter(task => task.name.toLowerCase() !== 'break' || task.is_locked)
          .map(task => ({
            start: parseISO(task.start_time!),
            end: parseISO(task.end_time!),
            duration: Math.floor((parseISO(task.end_time!).getTime() - parseISO(task.start_time!).getTime()) / (1000 * 60))
          }))
      );

      for (const breakTask of breakTasksToRandomize) {
        const breakDuration = breakTask.break_duration || 15;
        let placed = false;

        let freeBlocks = getFreeTimeBlocks(currentOccupiedBlocks, workdayStartTime, workdayEndTime);

        for (let i = freeBlocks.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [freeBlocks[i], freeBlocks[j]] = [freeBlocks[j], freeBlocks[i]];
        }

        for (const freeBlock of freeBlocks) {
          if (breakDuration <= freeBlock.duration) {
            let proposedStartTime: Date;
            const remainingFreeTime = freeBlock.duration - breakDuration;

            const MIN_BUFFER_FOR_CENTERING = 30;
            if (remainingFreeTime >= MIN_BUFFER_FOR_CENTERING * 2) {
              proposedStartTime = addMinutes(freeBlock.start, Math.floor(remainingFreeTime / 2));
            } else {
              proposedStartTime = freeBlock.start;
            }
            
            let proposedEndTime = addMinutes(proposedStartTime, breakDuration);

            if (isBefore(proposedStartTime, freeBlock.start)) proposedStartTime = freeBlock.start;
            if (isAfter(proposedEndTime, freeBlock.end)) proposedEndTime = freeBlock.end;

            if (isSlotFree(proposedStartTime, proposedEndTime, currentOccupiedBlocks)) {
              const newBreakTask: DBScheduledTask = {
                ...breakTask,
                start_time: proposedStartTime.toISOString(),
                end_time: proposedEndTime.toISOString(),
                scheduled_date: selectedDate,
                is_flexible: true,
                is_locked: breakTask.is_locked,
                energy_cost: breakTask.energy_cost ?? 0,
                is_completed: breakTask.is_completed ?? false,
                is_custom_energy_cost: breakTask.is_custom_energy_cost ?? false,
                task_environment: breakTask.task_environment,
                updated_at: new Date().toISOString(),
              };
              placedBreaks.push(newBreakTask);
              currentOccupiedBlocks.push({ start: proposedStartTime, end: proposedEndTime, duration: breakDuration });
              currentOccupiedBlocks = mergeOverlappingTimeBlocks(currentOccupiedBlocks);
              placed = true;
              break;
            }
          }
        }

        if (!placed) {
          failedToPlaceBreaks.push(breakTask);
        }
      }

      if (placedBreaks.length > 0) {
        const updates = placedBreaks.map(task => ({
          id: task.id,
          user_id: userId,
          name: task.name,
          break_duration: task.break_duration,
          start_time: task.start_time,
          end_time: task.end_time,
          scheduled_date: selectedDate,
          is_critical: task.is_critical,
          is_flexible: task.is_flexible,
          is_locked: task.is_locked,
          energy_cost: task.energy_cost ?? 0,
          is_completed: task.is_completed ?? false,
          is_custom_energy_cost: task.is_custom_energy_cost ?? false,
          task_environment: task.task_environment,
          updated_at: new Date().toISOString(),
        }));
        const { error } = await supabase.from('scheduled_tasks').upsert(updates, { onConflict: 'id' });
        if (error) throw new Error(`Failed to update placed breaks: ${error.message}`);
      }

      if (failedToPlaceBreaks.length > 0) {
        const { error: deleteError } = await supabase
          .from('scheduled_tasks')
          .delete()
          .in('id', failedToPlaceBreaks.map(task => task.id))
          .eq('user_id', userId);
        if (deleteError) console.error("Failed to delete unplaced breaks:", deleteError.message);
      }

      return { placedBreaks, failedToPlaceBreaks };
    },
    onMutate: async ({ selectedDate, workdayStartTime, workdayEndTime, currentDbTasks }) => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, selectedDate, sortBy] });
      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, selectedDate, sortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop; // Capture scroll position

      const nonBreakTasks = currentDbTasks.filter(task => task.name.toLowerCase() !== 'break');
      let breakTasksToRandomize = currentDbTasks.filter(task => task.name.toLowerCase() === 'break' && !task.is_locked);

      if (breakTasksToRandomize.length === 0) {
        return { previousScheduledTasks, previousScrollTop };
      }

      const optimisticPlacedBreaks: DBScheduledTask[] = [];
      const optimisticFailedToPlaceBreaks: DBScheduledTask[] = [];

      for (let i = breakTasksToRandomize.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [breakTasksToRandomize[i], breakTasksToRandomize[j]] = [breakTasksToRandomize[j], breakTasksToRandomize[i]];
      }

      let optimisticOccupiedBlocks: TimeBlock[] = mergeOverlappingTimeBlocks(
        currentDbTasks.filter(task => task.name.toLowerCase() !== 'break' || task.is_locked)
          .map(task => ({
            start: parseISO(task.start_time!),
            end: parseISO(task.end_time!),
            duration: Math.floor((parseISO(task.end_time!).getTime() - parseISO(task.start_time!).getTime()) / (1000 * 60))
          }))
      );

      for (const breakTask of breakTasksToRandomize) {
        const breakDuration = breakTask.break_duration || 15;
        let placed = false;

        let freeBlocks = getFreeTimeBlocks(optimisticOccupiedBlocks, workdayStartTime, workdayEndTime);

        for (let i = freeBlocks.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [freeBlocks[i], freeBlocks[j]] = [freeBlocks[j], freeBlocks[i]];
        }

        for (const freeBlock of freeBlocks) {
          if (breakDuration <= freeBlock.duration) {
            let proposedStartTime: Date;
            const remainingFreeTime = freeBlock.duration - breakDuration;
            const MIN_BUFFER_FOR_CENTERING = 30;

            if (remainingFreeTime >= MIN_BUFFER_FOR_CENTERING * 2) {
              proposedStartTime = addMinutes(freeBlock.start, Math.floor(remainingFreeTime / 2));
            } else {
              proposedStartTime = freeBlock.start;
            }
            
            let proposedEndTime = addMinutes(proposedStartTime, breakDuration);

            if (isBefore(proposedStartTime, freeBlock.start)) proposedStartTime = freeBlock.start;
            if (isAfter(proposedEndTime, freeBlock.end)) proposedEndTime = freeBlock.end;

            if (isSlotFree(proposedStartTime, proposedEndTime, optimisticOccupiedBlocks)) {
              const newBreakTask: DBScheduledTask = {
                ...breakTask,
                start_time: proposedStartTime.toISOString(),
                end_time: proposedEndTime.toISOString(),
                scheduled_date: selectedDate,
                is_flexible: true,
                is_locked: breakTask.is_locked,
                energy_cost: breakTask.energy_cost ?? 0,
                is_completed: breakTask.is_completed ?? false,
                is_custom_energy_cost: breakTask.is_custom_energy_cost ?? false,
                task_environment: breakTask.task_environment,
                updated_at: new Date().toISOString(),
              };
              optimisticPlacedBreaks.push(newBreakTask);
              optimisticOccupiedBlocks.push({ start: proposedStartTime, end: proposedEndTime, duration: breakDuration });
              optimisticOccupiedBlocks = mergeOverlappingTimeBlocks(optimisticOccupiedBlocks);
              placed = true;
              break;
            }
          }
        }

        if (!placed) {
          optimisticFailedToPlaceBreaks.push(breakTask);
        }
      }

      const newScheduledTasks = [
        ...nonBreakTasks,
        ...currentDbTasks.filter(task => task.name.toLowerCase() !== 'break' && task.is_locked),
        ...optimisticPlacedBreaks
      ];

      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, selectedDate, sortBy], newScheduledTasks);

      return { previousScheduledTasks, previousScrollTop };
    },
    onSuccess: ({ placedBreaks, failedToPlaceBreaks }) => {
      // No toast here, moved to onSettled
    },
    onSettled: (data, _error, _variables, context: MutationContext | undefined) => { // Destructure data here
      const { placedBreaks, failedToPlaceBreaks } = data || { placedBreaks: [], failedToPlaceBreaks: [] };
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      if (placedBreaks.length > 0) {
        showSuccess(`Successfully randomized and placed ${placedBreaks.length} breaks.`);
      }
      if (failedToPlaceBreaks.length > 0) {
        showError(`Failed to place ${failedToPlaceBreaks.length} breaks due to no available slots.`);
      }
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (e, variables, context) => {
      showError(`Failed to randomize breaks: ${e.message}`);
      if (context?.previousScheduledTasks) {
        queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, variables.selectedDate, sortBy], context.previousScheduledTasks);
      }
    }
  });

  const toggleScheduledTaskLockMutation = useMutation({
    mutationFn: async ({ taskId, isLocked }: { taskId: string; isLocked: boolean }) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log(`useSchedulerTasks: Attempting to toggle lock for task ID: ${taskId} to ${isLocked}`);
      const { data, error } = await supabase
        .from('scheduled_tasks')
        .update({ is_locked: isLocked, updated_at: new Date().toISOString() })
        .eq('id', taskId)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) {
        console.error("useSchedulerTasks: Error toggling task lock:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully toggled lock for task:", data);
      return data as DBScheduledTask;
    },
    onMutate: async ({ taskId, isLocked }: { taskId: string; isLocked: boolean }) => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop; // Capture scroll position

      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], (old) =>
        (old || []).map(task =>
          task.id === taskId ? { ...task, is_locked: isLocked } : task
        )
      );
      return { previousScheduledTasks, previousScrollTop };
    },
    onSuccess: (updatedTask) => {
      // No toast here, moved to onSettled
    },
    onSettled: (updatedTask, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      showSuccess(`Task "${updatedTask?.name}" ${updatedTask?.is_locked ? 'locked' : 'unlocked'}.`);
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (err, { taskId, isLocked }, context) => {
      showError(`Failed to toggle lock for task: ${err.message}`);
      if (context?.previousScheduledTasks) {
        queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], context.previousScheduledTasks);
      }
    }
  });

  const toggleRetiredTaskLockMutation = useMutation({
    mutationFn: async ({ taskId, isLocked }: { taskId: string; isLocked: boolean }) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log(`useSchedulerTasks: Attempting to toggle lock for retired task ID: ${taskId} to ${isLocked}`);
      const { data, error } = await supabase
        .from('aethersink') // CORRECTED
        .update({ is_locked: isLocked, retired_at: new Date().toISOString() }) // Update retired_at to reflect modification
        .eq('id', taskId)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) {
        console.error("useSchedulerTasks: Error toggling retired task lock:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully toggled lock for retired task:", data);
      return data as RetiredTask;
    },
    onMutate: async ({ taskId, isLocked }: { taskId: string; isLocked: boolean }) => {
      await queryClient.cancelQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] }); // NEW: Update queryKey
      const previousRetiredTasks = queryClient.getQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy]); // NEW: Update queryKey
      const previousScrollTop = scrollRef?.current?.scrollTop; // Capture scroll position

      queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], (old) => // NEW: Update queryKey
        (old || []).map(task =>
          task.id === taskId ? { ...task, is_locked: isLocked } : task
        )
      );
      return { previousRetiredTasks, previousScrollTop };
    },
    onSuccess: (updatedTask) => {
      // No toast here, moved to onSettled
    },
    onSettled: (updatedTask, _error, _variables, context: MutationContext | undefined) => { // Explicitly type context
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] }); // NEW: Update queryKey
      showSuccess(`Retired task "${updatedTask?.name}" ${updatedTask?.is_locked ? 'locked' : 'unlocked'}.`);
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (err, { taskId, isLocked }, context) => {
      showError(`Failed to toggle lock for retired task: ${err.message}`);
      if (context?.previousRetiredTasks) {
        queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], context.previousRetiredTasks); // NEW: Update queryKey
      }
    }
  });

  const aetherDumpMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("User not authenticated.");

      const { data: currentScheduledTasks, error: fetchError } = await supabase
        .from('scheduled_tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('scheduled_date', formattedSelectedDate);

      if (fetchError) throw new Error(`Failed to fetch scheduled tasks for Aether Dump: ${fetchError.message}`);

      const tasksToDump = currentScheduledTasks.filter(task => task.is_flexible && !task.is_locked);

      if (tasksToDump.length === 0) {
        showSuccess("No flexible, unlocked tasks to dump to Aether Sink for today.");
        return;
      }

      const newRetiredTasks: NewRetiredTask[] = tasksToDump.map(task => ({
        user_id: userId,
        name: task.name,
        duration: (task.start_time && task.end_time) 
                  ? Math.floor((parseISO(task.end_time).getTime() - parseISO(task.start_time).getTime()) / (1000 * 60)) 
                  : null,
        break_duration: task.break_duration,
        original_scheduled_date: task.scheduled_date,
        is_critical: task.is_critical,
        is_locked: task.is_locked,
        energy_cost: task.energy_cost ?? 0,
        is_completed: task.is_completed ?? false, // Pass completion status
        is_custom_energy_cost: task.is_custom_energy_cost ?? false, // Pass custom energy cost flag
        task_environment: task.task_environment, // NEW: Add environment
      }));

      const { error: insertError } = await supabase.from('aethersink').insert(newRetiredTasks); // CORRECTED
      if (insertError) throw new Error(`Failed to move tasks to Aether Sink: ${insertError.message}`);

      const { error: deleteError } = await supabase
        .from('scheduled_tasks')
        .delete()
        .in('id', tasksToDump.map(task => task.id))
        .eq('user_id', userId);
      if (deleteError) throw new Error(`Failed to remove tasks from schedule: ${deleteError.message}`);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      await queryClient.cancelQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] }); // NEW: Update queryKey

      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);
      const previousRetiredTasks = queryClient.getQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy]); // NEW: Update queryKey
      const previousScrollTop = scrollRef?.current?.scrollTop; // Capture scroll position

      const tasksToDump = (previousScheduledTasks || []).filter(task => task.is_flexible && !task.is_locked);
      const remainingScheduledTasks = (previousScheduledTasks || []).filter(task => !task.is_flexible || task.is_locked);
      
      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], remainingScheduledTasks);

      // Removed optimistic update for retiredTasks to prevent duplicates
      // const now = new Date().toISOString();
      // const optimisticRetiredTasks: RetiredTask[] = tasksToDump.map(task => ({
      //   id: task.id,
      //   user_id: userId!,
      //   name: task.name,
      //   duration: (task.start_time && task.end_time) 
      //             ? Math.floor((parseISO(task.end_time).getTime() - parseISO(task.start_time).getTime()) / (1000 * 60)) 
      //             : null,
      //   break_duration: task.break_duration,
      //   original_scheduled_date: task.scheduled_date,
      //   retired_at: now,
      //   is_critical: task.is_critical,
      //   is_locked: task.is_locked,
      //   energy_cost: task.energy_cost ?? 0,
      // }));
      // queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId], (old) =>
      //   [...optimisticRetiredTasks, ...(old || [])]
      // );

      return { previousScheduledTasks, previousRetiredTasks, previousScrollTop };
    },
    onSuccess: () => {
      // No toast here, moved to onSettled
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] }); // NEW: Update queryKey
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
      showSuccess('Flexible tasks moved to Aether Sink!');
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (err, _variables, context) => {
      showError(`Failed to perform Aether Dump: ${err.message}`);
      if (context?.previousScheduledTasks) {
        queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], context.previousScheduledTasks);
      }
      if (context?.previousRetiredTasks) {
        queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], context.previousRetiredTasks); // NEW: Update queryKey
      }
    }
  });

  const aetherDumpMegaMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("User not authenticated.");

      const { data: allFlexibleScheduledTasks, error: fetchError } = await supabase
        .from('scheduled_tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('is_flexible', true)
        .eq('is_locked', false)
        .gte('scheduled_date', format(startOfDay(new Date()), 'yyyy-MM-dd'));

      if (fetchError) throw new Error(`Failed to fetch all flexible scheduled tasks for Aether Dump Mega: ${fetchError.message}`);

      if (allFlexibleScheduledTasks.length === 0) {
        showSuccess("No flexible, unlocked tasks to dump to Aether Sink from today or future days.");
        return;
      }

      const newRetiredTasks: NewRetiredTask[] = allFlexibleScheduledTasks.map(task => ({
        user_id: userId,
        name: task.name,
        duration: (task.start_time && task.end_time) 
                  ? Math.floor((parseISO(task.end_time).getTime() - parseISO(task.start_time).getTime()) / (1000 * 60)) 
                  : null,
        break_duration: task.break_duration,
        original_scheduled_date: task.scheduled_date,
        is_critical: task.is_critical,
        is_locked: task.is_locked,
        energy_cost: task.energy_cost ?? 0,
        is_completed: task.is_completed ?? false, // Pass completion status
        is_custom_energy_cost: task.is_custom_energy_cost ?? false, // Pass custom energy cost flag
        task_environment: task.task_environment, // NEW: Add environment
      }));

      const { error: insertError } = await supabase.from('aethersink').insert(newRetiredTasks); // CORRECTED
      if (insertError) throw new Error(`Failed to move tasks to Aether Sink (Mega): ${insertError.message}`);

      const { error: deleteError } = await supabase
        .from('scheduled_tasks')
        .delete()
        .in('id', allFlexibleScheduledTasks.map(task => task.id))
        .eq('user_id', userId);
      if (deleteError) throw new Error(`Failed to remove tasks from schedule (Mega): ${deleteError.message}`);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId] });
      await queryClient.cancelQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] }); // NEW: Update queryKey
      await queryClient.cancelQueries({ queryKey: ['datesWithTasks', userId] });

      const previousRetiredTasks = queryClient.getQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy]); // NEW: Update queryKey
      const previousScrollTop = scrollRef?.current?.scrollTop; // Capture scroll position

      // Removed optimistic update for retiredTasks to prevent duplicates
      // const currentScheduledTasksSnapshot = queryClient.getQueriesData<DBScheduledTask[]>({ queryKey: ['scheduledTasks', userId] })
      //   .flatMap(([_key, data]) => data || [])
      //   .filter(task => task.is_flexible && !task.is_locked && isAfter(parseISO(task.scheduled_date), subDays(startOfDay(new Date()), 1)));

      // const now = new Date().toISOString();
      // const optimisticRetiredTasks: RetiredTask[] = currentScheduledTasksSnapshot.map(task => ({
      //   id: task.id,
      //   user_id: userId!,
      //   name: task.name,
      //   duration: (task.start_time && task.end_time) 
      //             ? Math.floor((parseISO(task.end_time).getTime() - parseISO(task.start_time).getTime()) / (1000 * 60)) 
      //             : null,
      //   break_duration: task.break_duration,
      //   original_scheduled_date: task.scheduled_date,
      //   retired_at: now,
      //   is_critical: task.is_critical,
      //   is_locked: task.is_locked,
      //   energy_cost: task.energy_cost ?? 0,
      // }));
      // queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId], (old) =>
      //   [...optimisticRetiredTasks, ...(old || [])]
      // );

      return { previousRetiredTasks, previousScrollTop };
    },
    onSuccess: () => {
      // No toast here, moved to onSettled
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] }); // NEW: Update queryKey
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
      showSuccess('All flexible tasks from today and future moved to Aether Sink!');
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (err, _variables, context) => {
      showError(`Failed to perform Aether Dump Mega: ${err.message}`);
      if (context?.previousRetiredTasks) {
        queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], context.previousRetiredTasks); // NEW: Update queryKey
      }
    }
  });

  const autoBalanceScheduleMutation = useMutation<
    { tasksPlaced: number; tasksKeptInSink: number },
    Error,
    AutoBalancePayload
  >({
    mutationFn: async (payload: AutoBalancePayload) => {
      if (!userId) throw new Error("User not authenticated.");
      if (!session?.access_token) throw new Error("User session token not available."); // FIX 1

      console.log("autoBalanceScheduleMutation: Payload received:", {
        scheduledTaskIdsToDelete: payload.scheduledTaskIdsToDelete,
        retiredTaskIdsToDelete: payload.retiredTaskIdsToDelete,
        tasksToInsert: payload.tasksToInsert.map(t => ({ id: t.id, name: t.name, is_flexible: t.is_flexible, is_locked: t.is_locked })),
        tasksToKeepInSink: payload.tasksToKeepInSink.map(t => ({ name: t.name })),
        selectedDate: payload.selectedDate,
      });

      console.log(`autoBalanceScheduleMutation: Sending token (masked) to Edge Function: ${session.access_token.substring(0, 10)}...${session.access_token.substring(session.access_token.length - 10)}`); // NEW LOG

      const { data, error } = await supabase.functions.invoke('auto-balance-schedule', {
        body: payload,
        headers: {
          'Authorization': `Bearer ${session.access_token}`, // FIX 2
        },
      });

      if (error) {
        console.error("autoBalanceScheduleMutation: Error invoking Edge Function:", error);
        throw new Error(error.message);
      }

      if (data.error) {
        console.error("autoBalanceScheduleMutation: Edge Function returned error:", data.error);
        throw new Error(data.error);
      }

      return data as { tasksPlaced: number; tasksKeptInSink: number };
    },
    onMutate: async (payload: AutoBalancePayload) => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      await queryClient.cancelQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      await queryClient.cancelQueries({ queryKey: ['datesWithTasks', userId] });

      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);
      const previousRetiredTasks = queryClient.getQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      // 1. Identify the IDs of the fixed/locked tasks that were NOT deleted (i.e., they are kept)
      // These are tasks that are either fixed OR locked, and are NOT in the list of tasks to be deleted.
      const remainingFixedTasks = (previousScheduledTasks || []).filter(task => 
        (!task.is_flexible || task.is_locked) && !payload.scheduledTaskIdsToDelete.includes(task.id)
      );
      const remainingFixedIds = remainingFixedTasks.map(t => t.id);

      // 2. Identify the newly placed tasks from the payload (these are the ones that were NOT fixed/locked before)
      // We filter tasksToInsert to exclude fixed/locked tasks, as they are already in remainingFixedTasks.
      const newlyPlacedFlexibleTasks = payload.tasksToInsert.filter(t => !remainingFixedIds.includes(t.id));
      
      // 3. Construct the new optimistic scheduled state: fixed tasks + newly placed tasks
      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], (old) => {
        
        const newTasks: DBScheduledTask[] = newlyPlacedFlexibleTasks.map(t => {
          // Find the original task (if it was a flexible scheduled task being replaced) to preserve created_at
          const originalTask = (old || []).find(oldT => oldT.id === t.id);
          
          return { 
            id: t.id || Math.random().toString(36).substring(2, 9), 
            user_id: userId!,
            name: t.name,
            break_duration: t.break_duration ?? null,
            start_time: t.start_time ?? new Date().toISOString(), 
            end_time: t.end_time ?? new Date().toISOString(),     
            scheduled_date: t.scheduled_date ?? formattedSelectedDate, 
            created_at: originalTask?.created_at ?? new Date().toISOString(), // Preserve created_at if possible
            updated_at: new Date().toISOString(),
            is_critical: t.is_critical ?? false,
            is_flexible: t.is_flexible ?? true,
            is_locked: t.is_locked ?? false,
            energy_cost: t.energy_cost ?? 0,
            is_completed: t.is_completed ?? false,
            is_custom_energy_cost: t.is_custom_energy_cost ?? false,
            task_environment: t.task_environment ?? 'laptop',
          };
        });
        
        return [...remainingFixedTasks, ...newTasks];
      });

      // Optimistic update for retired tasks (remove placed tasks, add retired scheduled tasks)
      queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], (old) => {
        // Filter out retired tasks that were successfully placed in the schedule (retiredTaskIdsToDelete)
        const remainingRetired = (old || []).filter(task => !payload.retiredTaskIdsToDelete.includes(task.id));
        
        // Add tasks that were flexible scheduled tasks but couldn't be placed (now moved to sink)
        const newSinkTasks: RetiredTask[] = payload.tasksToKeepInSink.map(t => ({ 
          id: Math.random().toString(36).substring(2, 9), // Generate new ID for tasks moved from schedule to sink
          user_id: userId!,
          name: t.name,
          duration: t.duration ?? null,
          break_duration: t.break_duration ?? null,
          original_scheduled_date: t.original_scheduled_date ?? formattedSelectedDate,
          retired_at: new Date().toISOString(),
          is_critical: t.is_critical ?? false,
          is_locked: t.is_locked ?? false,
          energy_cost: t.energy_cost ?? 0,
          is_completed: t.is_completed ?? false,
          is_custom_energy_cost: t.is_custom_energy_cost ?? false,
          task_environment: t.task_environment ?? 'laptop',
        }));
        return [...remainingRetired, ...newSinkTasks];
      });


      return { previousScheduledTasks, previousRetiredTasks, previousScrollTop };
    },
    onSuccess: (data) => {
      showSuccess(`Schedule auto-balanced! Placed ${data.tasksPlaced} tasks, ${data.tasksKeptInSink} returned to Aether Sink.`);
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (err, _variables, context: MutationContext | undefined) => { // Explicitly type context
      showError(`Failed to auto-balance schedule: ${err.message}`);
      if (context?.previousScheduledTasks) {
        queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], context.previousScheduledTasks);
      }
      if (context?.previousRetiredTasks) {
        queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], context.previousRetiredTasks);
      }
    }
  });

  const completeScheduledTaskMutation = useMutation({
    mutationFn: async (task: DBScheduledTask) => {
      if (!userId) throw new Error("User not authenticated.");
      if (!profile) throw new Error("User profile not loaded.");
      if (profile.energy < task.energy_cost) {
        throw new Error("Insufficient energy.");
      }

      const newXp = profile.xp + (task.energy_cost * 2);
      const newLevel = Math.floor(newXp / XP_PER_LEVEL) + 1;
      const newEnergy = profile.energy - task.energy_cost;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          xp: newXp,
          level: newLevel,
          energy: newEnergy,
          tasks_completed_today: profile.tasks_completed_today + 1,
          daily_streak: isToday(parseISO(profile.last_streak_update || new Date().toISOString())) ? profile.daily_streak : profile.daily_streak + 1,
          last_streak_update: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (profileError) throw new Error(`Failed to update profile: ${profileError.message}`);

      // Mark task as completed in scheduled_tasks
      const { error: taskError } = await supabase
        .from('scheduled_tasks')
        .update({ is_completed: true, updated_at: new Date().toISOString() })
        .eq('id', task.id)
        .eq('user_id', userId);

      if (taskError) throw new Error(`Failed to mark scheduled task as completed: ${taskError.message}`);

      // Add to completedtasks log
      const { error: completedLogError } = await supabase
        .from('completedtasks')
        .insert({
          user_id: userId,
          task_name: task.name,
          original_id: task.id,
          duration_scheduled: Math.floor((parseISO(task.end_time!).getTime() - parseISO(task.start_time!).getTime()) / (1000 * 60)),
          duration_used: Math.floor((parseISO(task.end_time!).getTime() - parseISO(task.start_time!).getTime()) / (1000 * 60)), // For now, assume scheduled duration
          xp_earned: task.energy_cost * 2,
          energy_cost: task.energy_cost,
          is_critical: task.is_critical,
          original_source: 'scheduled_tasks',
          original_scheduled_date: task.scheduled_date,
        });
      if (completedLogError) console.error("Failed to log completed task:", completedLogError.message);

      return { newXp, newLevel, newEnergy };
    },
    onSuccess: async ({ newXp, newLevel, newEnergy }) => {
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ['completedTasksForSelectedDayList', userId, formattedSelectedDate] });
      if (profile && newLevel > profile.level) {
        triggerLevelUp(newLevel);
      }
    },
    onError: (e) => {
      showError(`Failed to complete task: ${e.message}`);
    }
  });

  const updateScheduledTaskDetailsMutation = useMutation({
    mutationFn: async (task: Partial<DBScheduledTask> & { id: string }) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("useSchedulerTasks: Attempting to update scheduled task details:", task);
      const { data, error } = await supabase
        .from('scheduled_tasks')
        .update({ ...task, updated_at: new Date().toISOString() })
        .eq('id', task.id)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) {
        console.error("useSchedulerTasks: Error updating scheduled task details:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully updated scheduled task details:", data);
      return data as DBScheduledTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', userId] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
      showSuccess('Scheduled task details updated.');
    },
    onError: (e) => {
      showError(`Failed to update scheduled task details: ${e.message}`);
    }
  });

  const updateScheduledTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, isCompleted }: { taskId: string; isCompleted: boolean }) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log(`useSchedulerTasks: Attempting to update completion status for scheduled task ID: ${taskId} to ${isCompleted}`);

      const { data: currentTask, error: fetchError } = await supabase
        .from('scheduled_tasks')
        .select('*')
        .eq('id', taskId)
        .eq('user_id', userId)
        .single();

      if (fetchError) throw new Error(`Failed to fetch task for status update: ${fetchError.message}`);
      if (!currentTask) throw new Error("Task not found.");

      if (isCompleted && !currentTask.is_completed) {
        // If marking as complete, trigger the full completion logic
        await completeScheduledTaskMutation.mutateAsync(currentTask);
      } else if (!isCompleted && currentTask.is_completed) {
        // If marking as incomplete, only update the task status and profile (reverse XP/Energy if needed)
        // For simplicity, we'll just update the task status here. Reversing XP/Energy is more complex
        // and usually handled by a dedicated "undo" or "uncomplete" feature.
        const { error } = await supabase
          .from('scheduled_tasks')
          .update({ is_completed: isCompleted, updated_at: new Date().toISOString() })
          .eq('id', taskId)
          .eq('user_id', userId);
        if (error) throw new Error(`Failed to update scheduled task completion status: ${error.message}`);
        await refreshProfile(); // Refresh profile to reflect potential changes
      } else {
        // No change needed if status is already as requested
        return currentTask;
      }
      
      return currentTask; // Return the task (or updated task)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      queryClient.invalidateQueries({ queryKey: ['completedTasksForSelectedDayList', userId, formattedSelectedDate] });
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', userId] });
      showSuccess('Scheduled task status updated.');
    },
    onError: (e) => {
      showError(`Failed to update scheduled task status: ${e.message}`);
    }
  });

  const updateRetiredTaskDetailsMutation = useMutation({
    mutationFn: async (task: Partial<RetiredTask> & { id: string }) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("useSchedulerTasks: Attempting to update retired task details:", task);
      const { data, error } = await supabase
        .from('aethersink')
        .update({ ...task, retired_at: new Date().toISOString() }) // Update retired_at to reflect modification
        .eq('id', task.id)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) {
        console.error("useSchedulerTasks: Error updating retired task details:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully updated retired task details:", data);
      return data as RetiredTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      queryClient.invalidateQueries({ queryKey: ['completedTasksForSelectedDayList', userId, formattedSelectedDate] });
      showSuccess('Retired task details updated.');
    },
    onError: (e) => {
      showError(`Failed to update retired task details: ${e.message}`);
    }
  });

  const updateRetiredTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, isCompleted }: { taskId: string; isCompleted: boolean }) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log(`useSchedulerTasks: Attempting to update completion status for retired task ID: ${taskId} to ${isCompleted}`);

      const { data: currentTask, error: fetchError } = await supabase
        .from('aethersink')
        .select('*')
        .eq('id', taskId)
        .eq('user_id', userId)
        .single();

      if (fetchError) throw new Error(`Failed to fetch retired task for status update: ${fetchError.message}`);
      if (!currentTask) throw new Error("Retired task not found.");

      if (isCompleted && !currentTask.is_completed) {
        // If marking as complete, trigger the full completion logic for retired tasks
        await completeRetiredTaskMutation.mutateAsync(currentTask);
      } else if (!isCompleted && currentTask.is_completed) {
        // If marking as incomplete, only update the task status
        const { error } = await supabase
          .from('aethersink')
          .update({ is_completed: isCompleted, retired_at: new Date().toISOString() })
          .eq('id', taskId)
          .eq('user_id', userId);
        if (error) throw new Error(`Failed to update retired task completion status: ${error.message}`);
        await refreshProfile(); // Refresh profile to reflect potential changes
      } else {
        // No change needed if status is already as requested
        return currentTask;
      }
      
      return currentTask; // Return the task (or updated task)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      queryClient.invalidateQueries({ queryKey: ['completedTasksForSelectedDayList', userId, formattedSelectedDate] });
      showSuccess('Retired task status updated.');
    },
    onError: (e) => {
      showError(`Failed to update retired task status: ${e.message}`);
    }
  });

  const completeRetiredTaskMutation = useMutation({
    mutationFn: async (task: RetiredTask) => {
      if (!userId) throw new Error("User not authenticated.");
      if (!profile) throw new Error("User profile not loaded.");
      if (profile.energy < task.energy_cost) {
        throw new Error("Insufficient energy.");
      }

      const newXp = profile.xp + (task.energy_cost * 2);
      const newLevel = Math.floor(newXp / XP_PER_LEVEL) + 1;
      const newEnergy = profile.energy - task.energy_cost;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          xp: newXp,
          level: newLevel,
          energy: newEnergy,
          tasks_completed_today: profile.tasks_completed_today + 1,
          daily_streak: isToday(parseISO(profile.last_streak_update || new Date().toISOString())) ? profile.daily_streak : profile.daily_streak + 1,
          last_streak_update: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (profileError) throw new Error(`Failed to update profile: ${profileError.message}`);

      // Mark task as completed in aethersink
      const { error: taskError } = await supabase
        .from('aethersink')
        .update({ is_completed: true, retired_at: new Date().toISOString() })
        .eq('id', task.id)
        .eq('user_id', userId);

      if (taskError) throw new Error(`Failed to mark retired task as completed: ${taskError.message}`);

      // Add to completedtasks log
      const { error: completedLogError } = await supabase
        .from('completedtasks')
        .insert({
          user_id: userId,
          task_name: task.name,
          original_id: task.id,
          duration_scheduled: task.duration,
          duration_used: task.duration, // For now, assume scheduled duration
          xp_earned: task.energy_cost * 2,
          energy_cost: task.energy_cost,
          is_critical: task.is_critical,
          original_source: 'aethersink',
          original_scheduled_date: task.original_scheduled_date,
        });
      if (completedLogError) console.error("Failed to log completed retired task:", completedLogError.message);

      return { newXp, newLevel, newEnergy };
    },
    onSuccess: async ({ newXp, newLevel, newEnergy }) => {
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      queryClient.invalidateQueries({ queryKey: ['completedTasksForSelectedDayList', userId, formattedSelectedDate] });
      if (profile && newLevel > profile.level) {
        triggerLevelUp(newLevel);
      }
    },
    onError: (e) => {
      showError(`Failed to complete retired task: ${e.message}`);
    }
  });


  return {
    dbScheduledTasks,
    isLoading: isLoading || isLoadingRetiredTasks || isLoadingCompletedTasksForSelectedDay,
    addScheduledTask: addScheduledTaskMutation.mutateAsync,
    addRetiredTask: addRetiredTaskMutation.mutateAsync,
    removeScheduledTask: removeScheduledTaskMutation.mutateAsync,
    clearScheduledTasks: clearScheduledTasksMutation.mutateAsync,
    datesWithTasks,
    isLoadingDatesWithTasks,
    retiredTasks,
    isLoadingRetiredTasks,
    completedTasksForSelectedDayList,
    isLoadingCompletedTasksForSelectedDay,
    retireTask: retireTaskMutation.mutateAsync,
    rezoneTask: rezoneTaskMutation.mutateAsync,
    compactScheduledTasks: compactScheduledTasksMutation.mutateAsync,
    randomizeBreaks: randomizeBreaksMutation.mutateAsync,
    toggleScheduledTaskLock: toggleScheduledTaskLockMutation.mutateAsync,
    toggleRetiredTaskLock: toggleRetiredTaskLockMutation.mutateAsync,
    aetherDump: aetherDumpMutation.mutateAsync,
    aetherDumpMega: aetherDumpMegaMutation.mutateAsync,
    sortBy,
    setSortBy,
    retiredSortBy,
    setRetiredSortBy,
    autoBalanceSchedule: autoBalanceScheduleMutation.mutateAsync,
    completeScheduledTask: completeScheduledTaskMutation.mutateAsync,
    updateScheduledTaskDetails: updateScheduledTaskDetailsMutation.mutateAsync,
    updateScheduledTaskStatus: updateScheduledTaskStatusMutation.mutateAsync,
    updateRetiredTaskDetails: updateRetiredTaskDetailsMutation.mutateAsync,
    updateRetiredTaskStatus: updateRetiredTaskStatusMutation.mutateAsync,
    completeRetiredTask: completeRetiredTaskMutation.mutateAsync,
    removeRetiredTask: removeRetiredTaskMutation.mutateAsync, // ADDED: Export removeRetiredTask
  };
};