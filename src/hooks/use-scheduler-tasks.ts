import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Task, NewTask, TaskStatusFilter, TemporalFilter } from '@/types';
import { DBScheduledTask, NewDBScheduledTask, RawTaskInput, RetiredTask, NewRetiredTask, SortBy, TaskPriority, TimeBlock, AutoBalancePayload, UnifiedTask, RetiredTaskSortBy } from '@/types/scheduler';
import { useSession } from './use-session';
import { showSuccess, showError } from '@/utils/toast';
import { startOfDay, subDays, formatISO, parseISO, isToday, isYesterday, format, addMinutes, isBefore, isAfter, addDays, addHours, setHours, setMinutes } from 'date-fns';
import { XP_PER_LEVEL, MAX_ENERGY } from '@/lib/constants';
import { mergeOverlappingTimeBlocks, getFreeTimeBlocks, isSlotFree, calculateEnergyCost, compactScheduleLogic, getEmojiHue, setTimeOnDate } from '@/lib/scheduler-utils';
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
  const { user, profile, refreshProfile, triggerLevelUp, session } = useSession();
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
    queryKey: ['retiredTasks', userId, retiredSortBy],
    queryFn: async () => {
      if (!userId) return [];
      console.log("useSchedulerTasks: Fetching retired tasks for user:", userId, "sorted by:", retiredSortBy);
      let query = supabase
        .from('aethersink')
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
          query = query.order('duration', { ascending: false });
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
        case 'EMOJI':
          // Fetch all and sort client-side
          query = query.order('retired_at', { ascending: false }); // Default DB sort
          break;
        case 'RETIRED_AT_NEWEST':
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
    placeholderData: (previousData) => previousData,
  });

  // Renamed from completedTasksTodayList to completedTasksForSelectedDayList
  const { data: completedTasksForSelectedDayList = [], isLoading: isLoadingCompletedTasksForSelectedDay } = useQuery<DBScheduledTask[]>({
    queryKey: ['completedTasksForSelectedDayList', userId, formattedSelectedDate],
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
        .from('aethersink')
        .select('*')
        .eq('user_id', userId)
        .eq('is_completed', true)
        .gte('retired_at', selectedDayStartUTC)
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
        .gte('updated_at', selectedDayStartUTC)
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
          task_environment: rt.task_environment,
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
          task_environment: 'laptop',
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
    enabled: !!userId && !!formattedSelectedDate,
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
      const previousScrollTop = scrollRef?.current?.scrollTop;

      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], (old) => {
        const tempId = Math.random().toString(36).substring(2, 9);
        const now = new Date().toISOString();
        const optimisticTask: DBScheduledTask = {
          id: tempId,
          user_id: userId!,
          name: newTask.name,
          break_duration: newTask.break_duration ?? null,
          start_time: newTask.start_time ?? now,
          end_time: newTask.end_time ?? now,
          scheduled_date: newTask.scheduled_date,
          created_at: now,
          updated_at: now,
          is_critical: newTask.is_critical ?? false,
          is_flexible: newTask.is_flexible ?? true,
          is_locked: newTask.is_locked ?? false,
          energy_cost: newTask.energy_cost ?? 0,
          is_completed: newTask.is_completed ?? false,
          is_custom_energy_cost: newTask.is_custom_energy_cost ?? false,
          task_environment: newTask.task_environment ?? 'laptop',
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
      const { data, error } = await supabase.from('aethersink').insert(taskToInsert).select().single();
      if (error) {
        console.error("useSchedulerTasks: Error inserting retired task:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully inserted retired task:", data);
      return data as RetiredTask;
    },
    onMutate: async (newTask: NewRetiredTask) => {
      await queryClient.cancelQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      const previousRetiredTasks = queryClient.getQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

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
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
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
        queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], context.previousRetiredTasks);
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
      const previousScrollTop = scrollRef?.current?.scrollTop;

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
        scrollRef.current.scrollTop = context.previousScrollTop;
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
      const previousScrollTop = scrollRef?.current?.scrollTop;

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
        break_duration: taskToRetire.break_duration ?? null,
        original_scheduled_date: taskToRetire.scheduled_date,
        is_critical: taskToRetire.is_critical,
        is_locked: taskToRetire.is_locked,
        energy_cost: taskToRetire.energy_cost,
        is_completed: taskToRetire.is_completed,
        is_custom_energy_cost: taskToRetire.is_custom_energy_cost,
        task_environment: taskToRetire.task_environment,
      };

      const { error: insertError } = await supabase.from('aethersink').insert(newRetiredTask);
      if (insertError) throw new Error(`Failed to add task to Aether Sink: ${insertError.message}`);

      const { error: deleteError } = await supabase.from('scheduled_tasks').delete().eq('id', taskToRetire.id).eq('user_id', userId);
      if (deleteError) throw new Error(`Failed to remove task from schedule: ${deleteError.message}`);
    },
    onMutate: async (taskToRetire: DBScheduledTask) => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      await queryClient.cancelQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);
      const previousRetiredTasks = queryClient.getQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], (old) =>
        (old || []).filter(task => task.id !== taskToRetire.id)
      );
      queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], (old) => {
        const newRetiredTask: RetiredTask = {
          id: taskToRetire.id, // Use original ID for optimistic update
          user_id: userId!,
          name: taskToRetire.name,
          duration: (taskToRetire.start_time && taskToRetire.end_time) 
                    ? Math.floor((parseISO(taskToRetire.end_time!).getTime() - parseISO(taskToRetire.start_time!).getTime()) / (1000 * 60)) 
                    : null,
          break_duration: taskToRetire.break_duration ?? null,
          original_scheduled_date: taskToRetire.scheduled_date,
          retired_at: new Date().toISOString(),
          is_critical: taskToRetire.is_critical,
          is_locked: taskToRetire.is_locked,
          energy_cost: taskToRetire.energy_cost,
          is_completed: taskToRetire.is_completed,
          is_custom_energy_cost: taskToRetire.is_custom_energy_cost,
          task_environment: taskToRetire.task_environment,
        };
        return [newRetiredTask, ...(old || [])];
      });
      return { previousScheduledTasks, previousRetiredTasks, previousScrollTop };
    },
    onSuccess: () => {
      // No toast here, moved to onSettled
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
      showSuccess('Task moved to Aether Sink.');
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (e, _variables, context) => {
      showError(`Failed to retire task: ${e.message}`);
      if (context?.previousScheduledTasks) {
        queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], context.previousScheduledTasks);
      }
      if (context?.previousRetiredTasks) {
        queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], context.previousRetiredTasks);
      }
    }
  });

  const rezoneTaskMutation = useMutation({
    mutationFn: async (retiredTaskId: string) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("useSchedulerTasks: Attempting to rezone retired task ID:", retiredTaskId);
      const { error } = await supabase.from('aethersink').delete().eq('id', retiredTaskId).eq('user_id', userId);
      if (error) {
        console.error("useSchedulerTasks: Error rezoning task (deleting from sink):", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully rezoned task (deleted from sink) ID:", retiredTaskId);
    },
    onMutate: async (retiredTaskId: string) => {
      await queryClient.cancelQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      const previousRetiredTasks = queryClient.getQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], (old) =>
        (old || []).filter(task => task.id !== retiredTaskId)
      );
      return { previousRetiredTasks, previousScrollTop };
    },
    onSuccess: () => {
      // No toast here, handled by the calling function
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (e, retiredTaskId, context) => {
      showError(`Failed to rezone task: ${e.message}`);
      if (context?.previousRetiredTasks) {
        queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], context.previousRetiredTasks);
      }
    }
  });

  const compactScheduledTasksMutation = useMutation({
    mutationFn: async ({ tasksToUpdate }: { tasksToUpdate: DBScheduledTask[] }) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("useSchedulerTasks: Attempting to upsert compacted tasks:", tasksToUpdate.map(t => ({ id: t.id, name: t.name, start_time: t.start_time, end_time: t.end_time })));
      const { data, error } = await supabase
        .from('scheduled_tasks')
        .upsert(tasksToUpdate, { onConflict: 'id' })
        .select();
      if (error) {
        console.error("useSchedulerTasks: Error upserting compacted tasks:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully upserted compacted tasks:", data);
      return data as DBScheduledTask[];
    },
    onMutate: async ({ tasksToUpdate }: { tasksToUpdate: DBScheduledTask[] }) => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], tasksToUpdate);
      return { previousScheduledTasks, previousScrollTop };
    },
    onSuccess: () => {
      // No toast here, handled by the calling function
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
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
    mutationFn: async ({ selectedDate, workdayStartTime, workdayEndTime, currentDbTasks }: { selectedDate: string, workdayStartTime: Date, workdayEndTime: Date, currentDbTasks: DBScheduledTask[] }) => {
      if (!userId) throw new Error("User not authenticated.");

      const breaksToRandomize = currentDbTasks.filter(task => task.name.toLowerCase() === 'break' && !task.is_locked);
      const fixedAndLockedTasks = currentDbTasks.filter(task => task.name.toLowerCase() !== 'break' || task.is_locked);

      let currentOccupiedBlocks: TimeBlock[] = mergeOverlappingTimeBlocks(
        fixedAndLockedTasks
          .filter(task => task.start_time && task.end_time)
          .map(task => {
            const utcStart = parseISO(task.start_time!);
            const utcEnd = parseISO(task.end_time!);

            let localStart = setHours(setMinutes(parseISO(selectedDate), utcStart.getMinutes()), utcStart.getHours());
            let localEnd = setHours(setMinutes(parseISO(selectedDate), utcEnd.getMinutes()), utcEnd.getHours());

            if (isBefore(localEnd, localStart)) {
              localEnd = addDays(localEnd, 1);
            }
            return { start: localStart, end: localEnd, duration: Math.floor((localEnd.getTime() - localStart.getTime()) / (1000 * 60)) };
          })
      );

      const updatedBreaks: DBScheduledTask[] = [];
      const availableSlots: TimeBlock[] = [];

      // Collect all possible free slots
      let currentFreeTimeCursor = workdayStartTime;
      for (const occupiedBlock of currentOccupiedBlocks) {
        if (currentFreeTimeCursor < occupiedBlock.start) {
          availableSlots.push({
            start: currentFreeTimeCursor,
            end: occupiedBlock.start,
            duration: Math.floor((occupiedBlock.start.getTime() - currentFreeTimeCursor.getTime()) / (1000 * 60)),
          });
        }
        currentFreeTimeCursor = new Date(Math.max(currentFreeTimeCursor.getTime(), occupiedBlock.end.getTime()));
      }
      if (currentFreeTimeCursor < workdayEndTime) {
        availableSlots.push({
          start: currentFreeTimeCursor,
          end: workdayEndTime,
          duration: Math.floor((workdayEndTime.getTime() - currentFreeTimeCursor.getTime()) / (1000 * 60)),
        });
      }

      // Shuffle breaks and try to place them
      const shuffledBreaks = [...breaksToRandomize].sort(() => 0.5 - Math.random());
      let tempOccupiedBlocks = [...currentOccupiedBlocks];

      for (const breakTask of shuffledBreaks) {
        const breakDuration = Math.floor((parseISO(breakTask.end_time!).getTime() - parseISO(breakTask.start_time!).getTime()) / (1000 * 60));
        let placed = false;

        // Find a random suitable slot
        const shuffledAvailableSlots = [...availableSlots].sort(() => 0.5 - Math.random());
        for (const slot of shuffledAvailableSlots) {
          if (slot.duration >= breakDuration) {
            // Try to place it randomly within the slot
            const maxStartTime = addMinutes(slot.end, -breakDuration);
            if (isBefore(slot.start, maxStartTime) || isSameDay(slot.start, maxStartTime)) {
              const randomOffset = Math.floor(Math.random() * (differenceInMinutes(maxStartTime, slot.start) + 1));
              const proposedStartTime = addMinutes(slot.start, randomOffset);
              const proposedEndTime = addMinutes(proposedStartTime, breakDuration);

              if (isSlotFree(proposedStartTime, proposedEndTime, tempOccupiedBlocks)) {
                updatedBreaks.push({
                  ...breakTask,
                  start_time: proposedStartTime.toISOString(),
                  end_time: proposedEndTime.toISOString(),
                  updated_at: new Date().toISOString(),
                });
                tempOccupiedBlocks.push({ start: proposedStartTime, end: proposedEndTime, duration: breakDuration });
                tempOccupiedBlocks = mergeOverlappingTimeBlocks(tempOccupiedBlocks);
                placed = true;
                break;
              }
            }
          }
        }
        if (!placed) {
          // If a break can't be placed, keep its original position or handle as unplaced
          updatedBreaks.push(breakTask);
        }
      }

      const { error } = await supabase
        .from('scheduled_tasks')
        .upsert(updatedBreaks, { onConflict: 'id' });

      if (error) throw new Error(`Failed to randomize breaks: ${error.message}`);
      return updatedBreaks;
    },
    onMutate: async ({ currentDbTasks }) => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      // Optimistically update breaks
      const breaksToRandomize = currentDbTasks.filter(task => task.name.toLowerCase() === 'break' && !task.is_locked);
      const fixedAndLockedTasks = currentDbTasks.filter(task => task.name.toLowerCase() !== 'break' || task.is_locked);

      const optimisticBreaks = breaksToRandomize.map(b => ({
        ...b,
        start_time: new Date().toISOString(), // Placeholder for visual update
        end_time: addMinutes(new Date(), b.break_duration || 15).toISOString(),
        updated_at: new Date().toISOString(),
      }));

      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], [...fixedAndLockedTasks, ...optimisticBreaks]);
      return { previousScheduledTasks, previousScrollTop };
    },
    onSuccess: () => {
      showSuccess('Breaks randomized!');
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (e, _variables, context) => {
      showError(`Failed to randomize breaks: ${e.message}`);
      if (context?.previousScheduledTasks) {
        queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], context.previousScheduledTasks);
      }
    }
  });

  const toggleScheduledTaskLockMutation = useMutation({
    mutationFn: async ({ taskId, isLocked }: { taskId: string; isLocked: boolean }) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log(`useSchedulerTasks: Attempting to toggle lock for scheduled task ID: ${taskId} to ${isLocked}`);
      const { data, error } = await supabase
        .from('scheduled_tasks')
        .update({ is_locked: isLocked, updated_at: new Date().toISOString() })
        .eq('id', taskId)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) {
        console.error("useSchedulerTasks: Error toggling scheduled task lock:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully toggled scheduled task lock:", data);
      return data as DBScheduledTask;
    },
    onMutate: async ({ taskId, isLocked }: { taskId: string; isLocked: boolean }) => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], (old) =>
        (old || []).map(task =>
          task.id === taskId ? { ...task, is_locked: isLocked, updated_at: new Date().toISOString() } : task
        )
      );
      return { previousScheduledTasks, previousScrollTop };
    },
    onSuccess: (_data, { isLocked }) => {
      showSuccess(`Task ${isLocked ? 'locked' : 'unlocked'}!`);
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (e, _variables, context) => {
      showError(`Failed to toggle task lock: ${e.message}`);
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
        .from('aethersink')
        .update({ is_locked: isLocked, retired_at: new Date().toISOString() })
        .eq('id', taskId)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) {
        console.error("useSchedulerTasks: Error toggling retired task lock:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully toggled retired task lock:", data);
      return data as RetiredTask;
    },
    onMutate: async ({ taskId, isLocked }: { taskId: string; isLocked: boolean }) => {
      await queryClient.cancelQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      const previousRetiredTasks = queryClient.getQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], (old) =>
        (old || []).map(task =>
          task.id === taskId ? { ...task, is_locked: isLocked, retired_at: new Date().toISOString() } : task
        )
      );
      return { previousRetiredTasks, previousScrollTop };
    },
    onSuccess: (_data, { isLocked }) => {
      showSuccess(`Retired task ${isLocked ? 'locked' : 'unlocked'}!`);
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (e, _variables, context) => {
      showError(`Failed to toggle retired task lock: ${e.message}`);
      if (context?.previousRetiredTasks) {
        queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], context.previousRetiredTasks);
      }
    }
  });

  const aetherDumpMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("useSchedulerTasks: Performing Aether Dump for user:", userId, "on date:", formattedSelectedDate);

      const flexibleUnlockedTasks = dbScheduledTasks.filter(task => task.is_flexible && !task.is_locked);

      if (flexibleUnlockedTasks.length === 0) {
        showSuccess("No flexible, unlocked tasks to dump to Aether Sink.");
        return;
      }

      const newRetiredTasks: NewRetiredTask[] = flexibleUnlockedTasks.map(task => ({
        user_id: userId,
        name: task.name,
        duration: (task.start_time && task.end_time) 
                  ? Math.floor((parseISO(task.end_time!).getTime() - parseISO(task.start_time!).getTime()) / (1000 * 60)) 
                  : null,
        break_duration: task.break_duration ?? null,
        original_scheduled_date: task.scheduled_date,
        is_critical: task.is_critical,
        is_locked: false, // Tasks dumped to sink are not locked by default
        energy_cost: task.energy_cost,
        is_completed: task.is_completed,
        is_custom_energy_cost: task.is_custom_energy_cost,
        task_environment: task.task_environment,
      }));

      const { error: insertError } = await supabase.from('aethersink').insert(newRetiredTasks);
      if (insertError) throw new Error(`Failed to add tasks to Aether Sink: ${insertError.message}`);

      const { error: deleteError } = await supabase.from('scheduled_tasks').delete().in('id', flexibleUnlockedTasks.map(task => task.id)).eq('user_id', userId);
      if (deleteError) throw new Error(`Failed to remove tasks from schedule: ${deleteError.message}`);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      await queryClient.cancelQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);
      const previousRetiredTasks = queryClient.getQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      const flexibleUnlockedTasks = dbScheduledTasks.filter(task => task.is_flexible && !task.is_locked);
      const remainingScheduledTasks = dbScheduledTasks.filter(task => !task.is_flexible || task.is_locked);

      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], remainingScheduledTasks);
      queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], (old) => {
        const newRetiredTasks = flexibleUnlockedTasks.map(task => ({
          id: task.id,
          user_id: userId!,
          name: task.name,
          duration: (task.start_time && task.end_time) 
                    ? Math.floor((parseISO(task.end_time!).getTime() - parseISO(task.start_time!).getTime()) / (1000 * 60)) 
                    : null,
          break_duration: task.break_duration ?? null,
          original_scheduled_date: task.scheduled_date,
          retired_at: new Date().toISOString(),
          is_critical: task.is_critical,
          is_locked: false,
          energy_cost: task.energy_cost,
          is_completed: task.is_completed,
          is_custom_energy_cost: task.is_custom_energy_cost,
          task_environment: task.task_environment,
        }));
        return [...newRetiredTasks, ...(old || [])];
      });
      return { previousScheduledTasks, previousRetiredTasks, previousScrollTop };
    },
    onSuccess: () => {
      showSuccess('Flexible tasks moved to Aether Sink!');
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (e, _variables, context) => {
      showError(`Failed to perform Aether Dump: ${e.message}`);
      if (context?.previousScheduledTasks) {
        queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], context.previousScheduledTasks);
      }
      if (context?.previousRetiredTasks) {
        queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], context.previousRetiredTasks);
      }
    }
  });

  const aetherDumpMegaMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("useSchedulerTasks: Performing Aether Dump Mega for user:", userId);

      const { data: allFlexibleUnlockedTasks, error: fetchError } = await supabase
        .from('scheduled_tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('is_flexible', true)
        .eq('is_locked', false);

      if (fetchError) throw new Error(`Failed to fetch all flexible tasks: ${fetchError.message}`);

      if (allFlexibleUnlockedTasks.length === 0) {
        showSuccess("No flexible, unlocked tasks across all schedules to dump to Aether Sink.");
        return;
      }

      const newRetiredTasks: NewRetiredTask[] = allFlexibleUnlockedTasks.map(task => ({
        user_id: userId,
        name: task.name,
        duration: (task.start_time && task.end_time) 
                  ? Math.floor((parseISO(task.end_time!).getTime() - parseISO(task.start_time!).getTime()) / (1000 * 60)) 
                  : null,
        break_duration: task.break_duration ?? null,
        original_scheduled_date: task.scheduled_date,
        is_critical: task.is_critical,
        is_locked: false,
        energy_cost: task.energy_cost,
        is_completed: task.is_completed,
        is_custom_energy_cost: task.is_custom_energy_cost,
        task_environment: task.task_environment,
      }));

      const { error: insertError } = await supabase.from('aethersink').insert(newRetiredTasks);
      if (insertError) throw new Error(`Failed to add tasks to Aether Sink: ${insertError.message}`);

      const { error: deleteError } = await supabase.from('scheduled_tasks').delete().in('id', allFlexibleUnlockedTasks.map(task => task.id)).eq('user_id', userId);
      if (deleteError) throw new Error(`Failed to remove tasks from all schedules: ${deleteError.message}`);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId] }); // Cancel all scheduled tasks queries
      await queryClient.cancelQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      const previousScheduledTasks = queryClient.getQueriesData<DBScheduledTask[]>({ queryKey: ['scheduledTasks', userId] });
      const previousRetiredTasks = queryClient.getQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      // Optimistically clear all flexible tasks from all scheduled queries
      queryClient.setQueriesData<DBScheduledTask[]>({ queryKey: ['scheduledTasks', userId] }, (old) => {
        if (!old) return old;
        const flexibleUnlockedTasks = old.filter(task => task.is_flexible && !task.is_locked);
        const remainingScheduledTasks = old.filter(task => !task.is_flexible || task.is_locked);

        queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], (oldRetired) => {
          const newRetiredTasks = flexibleUnlockedTasks.map(task => ({
            id: task.id,
            user_id: userId!,
            name: task.name,
            duration: (task.start_time && task.end_time) 
                      ? Math.floor((parseISO(task.end_time!).getTime() - parseISO(task.start_time!).getTime()) / (1000 * 60)) 
                      : null,
            break_duration: task.break_duration ?? null,
            original_scheduled_date: task.scheduled_date,
            retired_at: new Date().toISOString(),
            is_critical: task.is_critical,
            is_locked: false,
            energy_cost: task.energy_cost,
            is_completed: task.is_completed,
            is_custom_energy_cost: task.is_custom_energy_cost,
            task_environment: task.task_environment,
          }));
          return [...newRetiredTasks, ...(oldRetired || [])];
        });
        return remainingScheduledTasks;
      });
      return { previousScheduledTasks, previousRetiredTasks, previousScrollTop };
    },
    onSuccess: () => {
      showSuccess('All flexible tasks moved to Aether Sink!');
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (e, _variables, context) => {
      showError(`Failed to perform Aether Dump Mega: ${e.message}`);
      if (context?.previousScheduledTasks) {
        // Restore previous scheduled tasks for all queries
        context.previousScheduledTasks.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
      }
      if (context?.previousRetiredTasks) {
        queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], context.previousRetiredTasks);
      }
    }
  });

  const autoBalanceScheduleMutation = useMutation({
    mutationFn: async (payload: AutoBalancePayload) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("useSchedulerTasks: Invoking auto-balance-schedule Edge Function with payload:", payload);

      const edgeFunctionUrl = `${supabase.supabaseUrl}/functions/v1/auto-balance-schedule`;
      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to auto-balance schedule via Edge Function');
      }
      return response.json();
    },
    onMutate: async (payload: AutoBalancePayload) => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      await queryClient.cancelQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);
      const previousRetiredTasks = queryClient.getQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      // Optimistic update: remove deleted tasks, add inserted tasks, update sink
      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], (old) => {
        const remaining = (old || []).filter(task => !payload.scheduledTaskIdsToDelete.includes(task.id));
        return [...remaining, ...payload.tasksToInsert];
      });

      queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], (old) => {
        const remaining = (old || []).filter(task => !payload.retiredTaskIdsToDelete.includes(task.id));
        const newSinkTasks = payload.tasksToKeepInSink.map(t => ({
          id: Math.random().toString(36).substring(2, 9), // Temp ID
          user_id: userId!,
          name: t.name,
          duration: t.duration,
          break_duration: t.break_duration,
          original_scheduled_date: t.original_scheduled_date,
          retired_at: new Date().toISOString(),
          is_critical: t.is_critical ?? false,
          is_locked: t.is_locked ?? false,
          energy_cost: t.energy_cost ?? 0,
          is_completed: t.is_completed ?? false,
          is_custom_energy_cost: t.is_custom_energy_cost ?? false,
          task_environment: t.task_environment ?? 'laptop',
        }));
        return [...remaining, ...newSinkTasks];
      });

      return { previousScheduledTasks, previousRetiredTasks, previousScrollTop };
    },
    onSuccess: () => {
      // No toast here, handled by the calling function
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (e, _variables, context) => {
      showError(`Failed to auto-balance schedule: ${e.message}`);
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
          duration_scheduled: (task.start_time && task.end_time) ? Math.floor((parseISO(task.end_time).getTime() - parseISO(task.start_time).getTime()) / (1000 * 60)) : null,
          duration_used: (task.start_time && task.end_time) ? Math.floor((parseISO(task.end_time).getTime() - parseISO(task.start_time).getTime()) / (1000 * 60)) : null,
          xp_earned: task.energy_cost * 2,
          energy_cost: task.energy_cost,
          is_critical: task.is_critical,
          original_source: 'scheduled_tasks',
          original_scheduled_date: task.scheduled_date,
        });
      if (completedLogError) console.error("Failed to log completed scheduled task:", completedLogError.message);

      return { newXp, newLevel, newEnergy };
    },
    onSuccess: async ({ newXp, newLevel, newEnergy }) => {
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      queryClient.invalidateQueries({ queryKey: ['completedTasksForSelectedDayList', userId, formattedSelectedDate] });
      if (profile && newLevel > profile.level) {
        triggerLevelUp(newLevel);
      }
    },
    onError: (e) => {
      showError(`Failed to complete scheduled task: ${e.message}`);
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
        await refreshProfile();
      } else {
        // No change needed if status is already as requested
        return currentTask;
      }
      
      return currentTask;
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
        .update({ ...task, retired_at: new Date().toISOString() })
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
        await refreshProfile();
      } else {
        // No change needed if status is already as requested
        return currentTask;
      }
      
      return currentTask;
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
          duration_used: task.duration,
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

  // NEW: Mutation to trigger Aether Sink backup
  const triggerAetherSinkBackupMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("useSchedulerTasks: Triggering Aether Sink backup for user:", userId);
      const { data, error } = await supabase.rpc('backup_aethersink_for_user', { p_user_id: userId });
      if (error) {
        console.error("useSchedulerTasks: Error triggering Aether Sink backup:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully triggered Aether Sink backup.");
      return data;
    },
    onSuccess: () => {
      showSuccess('Aether Sink backup created successfully!');
    },
    onError: (e) => {
      showError(`Failed to create Aether Sink backup: ${e.message}`);
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
    removeRetiredTask: removeRetiredTaskMutation.mutateAsync,
    triggerAetherSinkBackup: triggerAetherSinkBackupMutation.mutateAsync, // NEW: Export backup trigger
  };
};