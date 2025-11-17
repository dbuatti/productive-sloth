"use client";

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Task, NewTask, TaskStatusFilter, TemporalFilter } from '@/types';
import { DBScheduledTask, NewDBScheduledTask, RawTaskInput, RetiredTask, NewRetiredTask, SortBy, TaskPriority, TimeBlock, AutoBalancePayload, UnifiedTask, RetiredTaskSortBy } from '@/types/scheduler';
import { useSession } from './use-session';
import { showSuccess, showError } from '@/utils/toast';
import { startOfDay, subDays, formatISO, parseISO, isToday, isYesterday, format, addMinutes, isBefore, isAfter, addDays } from 'date-fns';
import { XP_PER_LEVEL, MAX_ENERGY } from '@/lib/constants';
import { mergeOverlappingTimeBlocks, getFreeTimeBlocks, isSlotFree, calculateEnergyCost, compactScheduleLogic, getEmojiHue } from '@/lib/scheduler-utils';
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
  const { user, profile, refreshProfile, triggerLevelUp } = useSession();
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
      
      // *** FIX: Use currentschedule_view which unions fixedappointments and currentschedule ***
      let query = supabase
        .from('currentschedule_view')
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
      } else {
        query = query.order('created_at', { ascending: true });
      }

      const { data, error } = await query;

      if (error) {
        console.error("useSchedulerTasks: Error fetching scheduled tasks:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully fetched tasks:", data.map(t => ({ id: t.id, name: t.name, scheduled_date: t.scheduled_date, start_time: t.start_time, end_time: t.end_time, is_critical: t.is_critical, is_flexible: t.is_flexible, is_locked: t.is_locked, energy_cost: t.energy_cost, is_completed: t.is_completed, is_custom_energy_cost: t.is_custom_energy_cost })));
      
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
      
      // *** FIX: Query both fixedappointments and currentschedule for dates ***
      const { data: fixedData, error: fixedError } = await supabase
        .from('fixedappointments')
        .select('scheduled_date')
        .eq('user_id', userId);

      if (fixedError) {
        console.error("useSchedulerTasks: Error fetching fixed dates:", fixedError.message);
        throw new Error(fixedError.message);
      }

      const { data: currentData, error: currentError } = await supabase
        .from('currentschedule')
        .select('scheduled_date')
        .eq('user_id', userId);

      if (currentError) {
        console.error("useSchedulerTasks: Error fetching current dates:", currentError.message);
        throw new Error(currentError.message);
      }

      const combinedData = [...(fixedData || []), ...(currentData || [])];
      const uniqueDates = Array.from(new Set(combinedData.map(item => format(parseISO(item.scheduled_date), 'yyyy-MM-dd'))));
      return uniqueDates;
    },
    enabled: !!userId,
  });

  const { data: retiredTasks = [], isLoading: isLoadingRetiredTasks } = useQuery<RetiredTask[]>({
    queryKey: ['retiredTasks', userId, retiredSortBy],
    queryFn: async () => {
      if (!userId) return [];
      console.log("useSchedulerTasks: Fetching retired tasks for user:", userId, "sorted by:", retiredSortBy);
      
      // *** FIX: Use aethersink table ***
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
          query = query.order('retired_at', { ascending: false });
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
      console.log("useSchedulerTasks: Successfully fetched retired tasks:", data.map(t => ({ id: t.id, name: t.name, is_critical: t.is_critical, is_locked: t.is_locked, energy_cost: t.energy_cost, is_completed: t.is_completed, is_custom_energy_cost: t.is_custom_energy_cost })));
      
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

      // *** FIX: Fetch completed tasks EXCLUSIVELY from completedtasks table ***
      const { data: completed, error: completedError } = await supabase
        .from('completedtasks')
        .select('*')
        .eq('user_id', userId)
        .gte('completed_at', selectedDayStartUTC)
        .lt('completed_at', selectedDayEndUTC);

      if (completedError) {
        console.error('useSchedulerTasks: Error fetching completed tasks:', completedError);
        throw new Error(completedError.message);
      }
      console.log("useSchedulerTasks: Completed Tasks for selected day:", completed);

      // Map completed tasks to DBScheduledTask structure for display compatibility
      const combinedTasks: DBScheduledTask[] = (completed || []).map(ct => ({
        id: ct.original_id || ct.id, // Use original_id if available, fallback to id
        user_id: ct.user_id,
        name: ct.task_name,
        break_duration: null, // Not stored in completedtasks
        start_time: null, // Not stored in completedtasks
        end_time: null, // Not stored in completedtasks
        scheduled_date: ct.original_scheduled_date || format(parseISO(ct.completed_at), 'yyyy-MM-dd'),
        created_at: ct.created_at || ct.completed_at,
        updated_at: ct.completed_at,
        is_critical: ct.is_critical,
        is_flexible: false,
        is_locked: false,
        energy_cost: ct.energy_cost,
        is_completed: true,
        is_custom_energy_cost: false, // Assume false unless stored
      }));

      console.log("useSchedulerTasks: Combined Tasks for selected day (before sorting):", combinedTasks);

      // Sort by updated_at/completed_at descending (most recent first)
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
      
      // *** FIX: Determine target table based on flexibility ***
      const targetTable = newTask.is_flexible ? 'currentschedule' : 'fixedappointments';
      
      const taskToInsert = { ...newTask, user_id: userId, energy_cost: newTask.energy_cost ?? 0, is_completed: newTask.is_completed ?? false, is_custom_energy_cost: newTask.is_custom_energy_cost ?? false };
      console.log(`useSchedulerTasks: Attempting to insert new task into ${targetTable}:`, taskToInsert);
      const { data, error } = await supabase.from(targetTable).insert(taskToInsert).select().single();
      if (error) {
        console.error(`useSchedulerTasks: Error inserting task into ${targetTable}:`, error.message);
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
      
      // *** FIX: Use aethersink table ***
      const taskToInsert = { ...newTask, user_id: userId, retired_at: new Date().toISOString(), energy_cost: newTask.energy_cost ?? 0, is_completed: newTask.is_completed ?? false, is_custom_energy_cost: newTask.is_custom_energy_cost ?? false };
      console.log("useSchedulerTasks: Attempting to insert new retired task into aethersink:", taskToInsert);
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
      
      // *** FIX: Delete from both currentschedule and fixedappointments (only one will match) ***
      const { error: currentError } = await supabase.from('currentschedule').delete().eq('id', taskId).eq('user_id', userId);
      const { error: fixedError } = await supabase.from('fixedappointments').delete().eq('id', taskId).eq('user_id', userId);
      
      if (currentError && fixedError) {
        console.error("useSchedulerTasks: Error removing task from currentschedule:", currentError.message);
        console.error("useSchedulerTasks: Error removing task from fixedappointments:", fixedError.message);
        throw new Error(currentError.message || fixedError.message);
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

  const clearScheduledTasksMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("useSchedulerTasks: Attempting to clear all scheduled tasks for user:", userId);
      
      // *** FIX: Delete from both currentschedule and fixedappointments ***
      const { error: currentError } = await supabase.from('currentschedule').delete().eq('user_id', userId).eq('scheduled_date', formattedSelectedDate);
      const { error: fixedError } = await supabase.from('fixedappointments').delete().eq('user_id', userId).eq('scheduled_date', formattedSelectedDate);

      if (currentError && fixedError) {
        console.error("useSchedulerTasks: Error clearing currentschedule:", currentError.message);
        console.error("useSchedulerTasks: Error clearing fixedappointments:", fixedError.message);
        throw new Error(currentError.message || fixedError.message);
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
        break_duration: taskToRetire.break_duration,
        original_scheduled_date: taskToRetire.scheduled_date,
        is_critical: taskToRetire.is_critical,
        is_locked: taskToRetire.is_locked,
        energy_cost: taskToRetire.energy_cost ?? 0,
        is_completed: taskToRetire.is_completed ?? false,
        is_custom_energy_cost: taskToRetire.is_custom_energy_cost ?? false,
      };
      
      // *** FIX: Insert into aethersink ***
      const { error: insertError } = await supabase.from('aethersink').insert(newRetiredTask);
      if (insertError) throw new Error(`Failed to move task to Aether Sink: ${insertError.message}`);

      // *** FIX: Delete from origin table (fixedappointments or currentschedule) ***
      const targetTable = taskToRetire.is_flexible ? 'currentschedule' : 'fixedappointments';
      const { error: deleteError } = await supabase.from(targetTable).delete().eq('id', taskToRetire.id).eq('user_id', userId);
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
    onError: (err, taskToRetire, context) => {
      showError(`Failed to retire task: ${err.message}`);
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

      // *** FIX: Delete from aethersink ***
      const { error: deleteError } = await supabase.from('aethersink').delete().eq('id', retiredTaskId).eq('user_id', userId);
      if (deleteError) throw new Error(`Failed to remove task from Aether Sink: ${deleteError.message}`);
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
      // No toast here, moved to onSettled
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      showSuccess('Task removed from Aether Sink.');
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (err, retiredTaskId, context) => {
      showError(`Failed to remove task from Aether Sink: ${err.message}`);
      if (context?.previousRetiredTasks) {
        queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], context.previousRetiredTasks);
      }
    }
  });

  const compactScheduledTasksMutation = useMutation({
    mutationFn: async ({ tasksToUpdate }: { tasksToUpdate: DBScheduledTask[] }) => {
      if (!userId) throw new Error("User not authenticated.");

      const updates = tasksToUpdate.map(task => ({
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
        updated_at: new Date().toISOString(),
      }));

      // *** FIX: Upsert into currentschedule (only flexible tasks are compacted) ***
      const flexibleUpdates = updates.filter(task => task.is_flexible);
      
      if (flexibleUpdates.length > 0) {
        const { error } = await supabase.from('currentschedule').upsert(flexibleUpdates, { onConflict: 'id' });
        if (error) {
          console.error("useSchedulerTasks: Error compacting tasks:", error.message);
          throw new Error(error.message);
        }
      }
      console.log("useSchedulerTasks: Successfully compacted tasks.");
    },
    onMutate: async ({ tasksToUpdate }: { tasksToUpdate: DBScheduledTask[] }) => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

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
          updated_at: new Date().toISOString(),
        }));
        
        // *** FIX: Upsert into currentschedule (breaks are flexible) ***
        const { error } = await supabase.from('currentschedule').upsert(updates, { onConflict: 'id' });
        if (error) throw new Error(`Failed to update placed breaks: ${error.message}`);
      }

      if (failedToPlaceBreaks.length > 0) {
        // *** FIX: Delete unplaced breaks from currentschedule ***
        const { error: deleteError } = await supabase
          .from('currentschedule')
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
      const previousScrollTop = scrollRef?.current?.scrollTop;

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
                updated_at: new Date().toISOString(),
              };
              optimisticPlacedBreaks.push(newBreakTask);
              optimisticOccupiedBlocks.push({ start: proposedStartTime, end: proposedEndTime, duration: breakDuration });
              currentOccupiedBlocks = mergeOverlappingTimeBlocks(currentOccupiedBlocks);
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
    onSettled: (data, _error, _variables, context: MutationContext | undefined) => {
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
    mutationFn: async ({ taskId, isLocked, isFlexible }: { taskId: string; isLocked: boolean; isFlexible: boolean }) => {
      if (!userId) throw new Error("User not authenticated.");
      
      // *** FIX: Determine target table based on flexibility ***
      const targetTable = isFlexible ? 'currentschedule' : 'fixedappointments';

      console.log(`useSchedulerTasks: Attempting to toggle lock for task ID: ${taskId} in ${targetTable} to ${isLocked}`);
      const { data, error } = await supabase
        .from(targetTable)
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
      const previousScrollTop = scrollRef?.current?.scrollTop;

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
      
      // *** FIX: Use aethersink table ***
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
      console.log("useSchedulerTasks: Successfully toggled lock for retired task:", data);
      return data as RetiredTask;
    },
    onMutate: async ({ taskId, isLocked }: { taskId: string; isLocked: boolean }) => {
      await queryClient.cancelQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      const previousRetiredTasks = queryClient.getQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], (old) =>
        (old || []).map(task =>
          task.id === taskId ? { ...task, is_locked: isLocked } : task
        )
      );
      return { previousRetiredTasks, previousScrollTop };
    },
    onSuccess: (updatedTask) => {
      // No toast here, moved to onSettled
    },
    onSettled: (updatedTask, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      showSuccess(`Retired task "${updatedTask?.name}" ${updatedTask?.is_locked ? 'locked' : 'unlocked'}.`);
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (err, { taskId, isLocked }, context) => {
      showError(`Failed to toggle lock for retired task: ${err.message}`);
      if (context?.previousRetiredTasks) {
        queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], context.previousRetiredTasks);
      }
    }
  });

  const aetherDumpMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("User not authenticated.");

      // *** FIX: Fetch from currentschedule (only flexible tasks) ***
      const { data: currentScheduledTasks, error: fetchError } = await supabase
        .from('currentschedule')
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
        is_completed: task.is_completed ?? false,
        is_custom_energy_cost: task.is_custom_energy_cost ?? false,
      }));

      // *** FIX: Insert into aethersink ***
      const { error: insertError } = await supabase.from('aethersink').insert(newRetiredTasks);
      if (insertError) throw new Error(`Failed to move tasks to Aether Sink: ${insertError.message}`);

      // *** FIX: Delete from currentschedule ***
      const { error: deleteError } = await supabase
        .from('currentschedule')
        .delete()
        .in('id', tasksToDump.map(task => task.id))
        .eq('user_id', userId);
      if (deleteError) throw new Error(`Failed to remove tasks from schedule: ${deleteError.message}`);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      await queryClient.cancelQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });

      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);
      const previousRetiredTasks = queryClient.getQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      const tasksToDump = (previousScheduledTasks || []).filter(task => task.is_flexible && !task.is_locked);
      const remainingScheduledTasks = (previousScheduledTasks || []).filter(task => !task.is_flexible || task.is_locked);
      
      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], remainingScheduledTasks);

      return { previousScheduledTasks, previousRetiredTasks, previousScrollTop };
    },
    onSuccess: () => {
      // No toast here, moved to onSettled
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
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
        queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], context.previousRetiredTasks);
      }
    }
  });

  const aetherDumpMegaMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("User not authenticated.");

      // *** FIX: Fetch ALL flexible tasks from currentschedule and fixedappointments (only currentschedule should have flexible tasks) ***
      const { data: allFlexibleScheduledTasks, error: fetchError } = await supabase
        .from('currentschedule')
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
        is_completed: task.is_completed ?? false,
        is_custom_energy_cost: task.is_custom_energy_cost ?? false,
      }));

      // *** FIX: Insert into aethersink ***
      const { error: insertError } = await supabase.from('aethersink').insert(newRetiredTasks);
      if (insertError) throw new Error(`Failed to move tasks to Aether Sink (Mega): ${insertError.message}`);

      // *** FIX: Delete from currentschedule ***
      const { error: deleteError } = await supabase
        .from('currentschedule')
        .delete()
        .in('id', allFlexibleScheduledTasks.map(task => task.id))
        .eq('user_id', userId);
      if (deleteError) throw new Error(`Failed to remove tasks from schedule (Mega): ${deleteError.message}`);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId] });
      await queryClient.cancelQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      await queryClient.cancelQueries({ queryKey: ['datesWithTasks', userId] });

      const previousRetiredTasks = queryClient.getQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      return { previousRetiredTasks, previousScrollTop };
    },
    onSuccess: () => {
      // No toast here, moved to onSettled
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
      showSuccess('All flexible tasks from today and future moved to Aether Sink!');
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (err, _variables, context) => {
      showError(`Failed to perform Aether Dump Mega: ${err.message}`);
      if (context?.previousRetiredTasks) {
        queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], context.previousRetiredTasks);
      }
    }
  });

  const autoBalanceScheduleMutation = useMutation({
    mutationFn: async (payload: AutoBalancePayload) => {
      if (!userId) throw new Error("User not authenticated.");

      console.log("autoBalanceScheduleMutation: Payload received:", {
        scheduledTaskIdsToDelete: payload.scheduledTaskIdsToDelete,
        retiredTaskIdsToDelete: payload.retiredTaskIdsToDelete,
        tasksToInsert: payload.tasksToInsert.map(t => ({ id: t.id, name: t.name, is_flexible: t.is_flexible, is_locked: t.is_locked })),
        tasksToKeepInSink: payload.tasksToKeepInSink.map(t => ({ name: t.name })),
        selectedDate: payload.selectedDate,
      });

      // 1. Delete scheduled tasks (from currentschedule)
      if (payload.scheduledTaskIdsToDelete.length > 0) {
        console.log("autoBalanceScheduleMutation: Deleting scheduled tasks with IDs from currentschedule:", payload.scheduledTaskIdsToDelete);
        const { error } = await supabase
          .from('currentschedule')
          .delete()
          .in('id', payload.scheduledTaskIdsToDelete)
          .eq('user_id', userId)
          .eq('scheduled_date', payload.selectedDate);
        if (error) throw new Error(`Failed to delete old scheduled tasks: ${error.message}`);
        console.log("autoBalanceScheduleMutation: Scheduled tasks deleted successfully.");
      }

      // 2. Delete retired tasks (from aethersink)
      if (payload.retiredTaskIdsToDelete.length > 0) {
        console.log("autoBalanceScheduleMutation: Deleting retired tasks with IDs from aethersink:", payload.retiredTaskIdsToDelete);
        const { error } = await supabase
          .from('aethersink')
          .delete()
          .in('id', payload.retiredTaskIdsToDelete)
          .eq('user_id', userId);
        if (error) throw new Error(`Failed to delete old retired tasks: ${error.message}`);
        console.log("autoBalanceScheduleMutation: Retired tasks deleted successfully.");
      }

      // 3. Upsert new scheduled tasks (into currentschedule or fixedappointments)
      if (payload.tasksToInsert.length > 0) {
        const fixedUpdates = payload.tasksToInsert.filter(t => !t.is_flexible).map(task => ({ ...task, user_id: userId }));
        const currentUpdates = payload.tasksToInsert.filter(t => t.is_flexible).map(task => ({ ...task, user_id: userId }));

        if (fixedUpdates.length > 0) {
          console.log("autoBalanceScheduleMutation: Upserting fixed tasks:", fixedUpdates.map(t => t.name));
          const { error } = await supabase.from('fixedappointments').upsert(fixedUpdates, { onConflict: 'id' });
          if (error) throw new Error(`Failed to upsert fixed scheduled tasks: ${error.message}`);
        }
        
        if (currentUpdates.length > 0) {
          console.log("autoBalanceScheduleMutation: Upserting current tasks:", currentUpdates.map(t => t.name));
          const { error } = await supabase.from('currentschedule').upsert(currentUpdates, { onConflict: 'id' });
          if (error) throw new Error(`Failed to upsert current scheduled tasks: ${error.message}`);
        }
        console.log("autoBalanceScheduleMutation: New scheduled tasks upserted successfully.");
      }

      // 4. Insert tasks back into the sink (those that couldn't be placed)
      if (payload.tasksToKeepInSink.length > 0) {
        const tasksToKeepInSinkWithUserId = payload.tasksToKeepInSink.map(task => ({ 
          ...task, 
          user_id: userId, 
          retired_at: new Date().toISOString() 
        }));
        console.log("autoBalanceScheduleMutation: Re-inserting tasks into aethersink:", tasksToKeepInSinkWithUserId.map(t => ({ name: t.name })));
        const { error } = await supabase
          .from('aethersink')
          .insert(tasksToKeepInSinkWithUserId);
        if (error) throw new Error(`Failed to re-insert unscheduled tasks into sink: ${error.message}`);
        console.log("autoBalanceScheduleMutation: Unscheduled tasks re-inserted into sink successfully.");
      }

      return { tasksPlaced: payload.tasksToInsert.length, tasksKeptInSink: payload.tasksToKeepInSink.length };
    },
    onMutate: async (payload: AutoBalancePayload) => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, payload.selectedDate, sortBy] });
      await queryClient.cancelQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      await queryClient.cancelQueries({ queryKey: ['datesWithTasks', userId] });
      
      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, payload.selectedDate, sortBy]);
      const previousRetiredTasks = queryClient.getQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, payload.selectedDate, sortBy], (old) =>
        (old || []).filter(task => !payload.scheduledTaskIdsToDelete.includes(task.id))
      );
      queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], (old) =>
        (old || []).filter(task => !payload.retiredTaskIdsToDelete.includes(task.id))
      );

      return { previousScheduledTasks, previousRetiredTasks, previousScrollTop };
    },
    onSuccess: (result, payload) => {
      // No toast here, moved to onSettled
    },
    onSettled: (result, _error, payload, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, payload.selectedDate, sortBy] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
      
      let message = `Schedule balanced! ${result?.tasksPlaced} task(s) placed.`;
      if (result?.tasksKeptInSink && result.tasksKeptInSink > 0) {
        message += ` ${result.tasksKeptInSink} task${result.tasksKeptInSink > 1 ? 's' : ''} returned to Aether Sink.`;
      }
      showSuccess(message);
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (err, payload, context) => {
      showError(`Failed to auto-balance schedule: ${err.message}`);
      if (context?.previousScheduledTasks) {
        queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, payload.selectedDate, sortBy], context.previousScheduledTasks);
      }
      if (context?.previousRetiredTasks) {
        queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], context.previousRetiredTasks);
      }
    }
  });

  const completeScheduledTaskMutation = useMutation({
    mutationFn: async (taskToComplete: DBScheduledTask) => {
      if (!userId || !profile) throw new Error("User not authenticated or profile not loaded.");

      if (profile.energy < taskToComplete.energy_cost) {
        showError(`Not enough energy to complete "${taskToComplete.name}". You need ${taskToComplete.energy_cost} energy, but have ${profile.energy}.`);
        throw new Error("Insufficient energy.");
      }

      let xpGained = taskToComplete.energy_cost * 2;
      if (taskToComplete.is_critical && isToday(parseISO(taskToComplete.scheduled_date))) {
        xpGained += 5;
      }

      const newXp = profile.xp + xpGained;
      const { level: newLevel } = calculateLevelAndRemainingXp(newXp);
      const newEnergy = Math.max(0, profile.energy - taskToComplete.energy_cost);
      const newTasksCompletedToday = profile.tasks_completed_today + 1;

      let newDailyStreak = profile.daily_streak;
      let newLastStreakUpdate = profile.last_streak_update ? parseISO(profile.last_streak_update) : null;
      const now = new Date();
      const today = startOfDay(now);

      if (!newLastStreakUpdate || isYesterday(newLastStreakUpdate)) {
        newDailyStreak += 1;
      } else if (!isToday(newLastStreakUpdate)) {
        newDailyStreak = 1;
      }

      // 1. Insert into CompletedTasks
      const completedTaskRecord = {
        user_id: userId,
        task_name: taskToComplete.name,
        original_id: taskToComplete.id,
        duration_scheduled: (taskToComplete.start_time && taskToComplete.end_time) 
                            ? Math.floor((parseISO(taskToComplete.end_time!).getTime() - parseISO(taskToComplete.start_time!).getTime()) / (1000 * 60)) 
                            : null,
        duration_used: (taskToComplete.start_time && taskToComplete.end_time) 
                       ? Math.floor((now.getTime() - parseISO(taskToComplete.start_time!).getTime()) / (1000 * 60)) 
                       : null,
        completed_at: now.toISOString(),
        xp_earned: xpGained,
        energy_cost: taskToComplete.energy_cost,
        is_critical: taskToComplete.is_critical,
        original_source: taskToComplete.is_flexible ? 'currentschedule' : 'fixedappointments',
        original_scheduled_date: taskToComplete.scheduled_date,
      };

      const { error: insertError } = await supabase.from('completedtasks').insert(completedTaskRecord);
      if (insertError) {
        console.error("Failed to insert into completedtasks:", insertError.message);
        throw new Error("Failed to archive task completion.");
      }

      // 2. Update Profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          xp: newXp, 
          level: newLevel, 
          daily_streak: newDailyStreak,
          last_streak_update: today.toISOString(),
          energy: newEnergy,
          tasks_completed_today: newTasksCompletedToday,
          updated_at: new Date().toISOString() 
        })
        .eq('id', user.id);

      if (profileError) {
        console.error("Failed to update user profile (XP, streak, energy, tasks_completed_today):", profileError.message);
        showError("Failed to update profile stats.");
        throw new Error("Failed to update profile stats.");
      } else {
        await refreshProfile();
        
        setXpGainAnimation({ taskId: taskToComplete.id, xpAmount: xpGained });

        if (newLevel > profile.level) {
          showSuccess(`🎉 Level Up! You reached Level ${newLevel}!`);
          triggerLevelUp(newLevel);
        }
      }
      
      // 3. Delete from origin table (This is handled by the calling component (SchedulerPage) based on flexibility)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      queryClient.invalidateQueries({ queryKey: ['completedTasksForSelectedDayList', userId, formattedSelectedDate] });
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      // Task list queries will be invalidated by the calling component (SchedulerPage)
    },
    onError: (err) => {
      if (err.message !== "Insufficient energy." && err.message !== "Failed to update profile stats.") {
        showError(`Failed to complete scheduled task: ${err.message}`);
      }
    }
  });

  const completeRetiredTaskMutation = useMutation({
    mutationFn: async (taskToComplete: RetiredTask) => {
      if (!userId || !profile) throw new Error("User not authenticated or profile not loaded.");

      if (profile.energy < taskToComplete.energy_cost) {
        showError(`Not enough energy to complete retired task "${taskToComplete.name}". You need ${taskToComplete.energy_cost} energy, but have ${profile.energy}.`);
        throw new Error("Insufficient energy.");
      }

      let xpGained = taskToComplete.energy_cost * 2;
      
      const newXp = profile.xp + xpGained;
      const { level: newLevel } = calculateLevelAndRemainingXp(newXp);
      const newEnergy = Math.max(0, profile.energy - taskToComplete.energy_cost);
      const newTasksCompletedToday = profile.tasks_completed_today + 1;

      let newDailyStreak = profile.daily_streak;
      let newLastStreakUpdate = profile.last_streak_update ? parseISO(profile.last_streak_update) : null;
      const now = new Date();
      const today = startOfDay(now);

      if (!newLastStreakUpdate || isYesterday(newLastStreakUpdate)) {
        newDailyStreak += 1;
      } else if (!isToday(newLastStreakUpdate)) {
        newDailyStreak = 1;
      }

      // 1. Insert into CompletedTasks
      const completedTaskRecord = {
        user_id: userId,
        task_name: taskToComplete.name,
        original_id: taskToComplete.id,
        duration_scheduled: taskToComplete.duration,
        duration_used: taskToComplete.duration, // Assume full duration used for sink tasks
        completed_at: now.toISOString(),
        xp_earned: xpGained,
        energy_cost: taskToComplete.energy_cost,
        is_critical: taskToComplete.is_critical,
        original_source: 'aethersink',
        original_scheduled_date: taskToComplete.original_scheduled_date,
      };

      const { error: insertError } = await supabase.from('completedtasks').insert(completedTaskRecord);
      if (insertError) {
        console.error("Failed to insert into completedtasks:", insertError.message);
        throw new Error("Failed to archive task completion.");
      }

      // 2. Update Profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          xp: newXp, 
          level: newLevel, 
          daily_streak: newDailyStreak,
          last_streak_update: today.toISOString(),
          energy: newEnergy,
          tasks_completed_today: newTasksCompletedToday,
          updated_at: new Date().toISOString() 
        })
        .eq('id', user.id);

      if (profileError) {
        console.error("Failed to update user profile (XP, streak, energy, tasks_completed_today) for retired task:", profileError.message);
        showError("Failed to update profile stats for retired task.");
        throw new Error("Failed to update profile stats for retired task.");
      } else {
        await refreshProfile();
        
        setXpGainAnimation({ taskId: taskToComplete.id, xpAmount: xpGained });

        showSuccess(`Retired task completed! -${taskToComplete.energy_cost} Energy`);
        if (newLevel > profile.level) {
          showSuccess(`🎉 Level Up! You reached Level ${newLevel}!`);
          triggerLevelUp(newLevel);
        }
      }

      // 3. Delete from origin table (aethersink)
      await rezoneTaskMutation.mutateAsync(taskToComplete.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      queryClient.invalidateQueries({ queryKey: ['completedTasksForSelectedDayList', userId, formattedSelectedDate] });
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (err) => {
      if (err.message !== "Insufficient energy." && err.message !== "Failed to update profile stats for retired task.") {
        showError(`Failed to complete retired task: ${err.message}`);
      }
    }
  });

  const updateScheduledTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, isCompleted, isFlexible }: { taskId: string; isCompleted: boolean; isFlexible: boolean }) => {
      if (!userId) throw new Error("User not authenticated.");
      
      // *** FIX: Determine target table based on flexibility ***
      const targetTable = isFlexible ? 'currentschedule' : 'fixedappointments';

      console.log(`useSchedulerTasks: Attempting to update completion status for scheduled task ID: ${taskId} in ${targetTable} to ${isCompleted}`);
      const { data, error } = await supabase
        .from(targetTable)
        .update({ is_completed: isCompleted, updated_at: new Date().toISOString() })
        .eq('id', taskId)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) {
        console.error("useSchedulerTasks: Error updating scheduled task status:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully updated scheduled task status:", data);
      return data as DBScheduledTask;
    },
    onMutate: async ({ taskId, isCompleted }: { taskId: string; isCompleted: boolean }) => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], (old) =>
        (old || []).map(task =>
          task.id === taskId ? { ...task, is_completed: isCompleted } : task
        )
      );
      return { previousScheduledTasks, previousScrollTop };
    },
    onSuccess: (updatedTask) => {
      // No toast here, moved to onSettled
    },
    onSettled: (updatedTask, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      queryClient.invalidateQueries({ queryKey: ['completedTasksForSelectedDayList', userId, formattedSelectedDate] });
      showSuccess(`Scheduled task "${updatedTask?.name}" marked as ${updatedTask?.is_completed ? 'completed' : 'incomplete'}.`);
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (err, { taskId, isCompleted }, context) => {
      showError(`Failed to update scheduled task status: ${err.message}`);
      if (context?.previousScheduledTasks) {
        queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], context.previousScheduledTasks);
      }
    }
  });

  const updateRetiredTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, isCompleted }: { taskId: string; isCompleted: boolean }) => {
      if (!userId) throw new Error("User not authenticated.");
      
      // *** FIX: Use aethersink table ***
      console.log(`useSchedulerTasks: Attempting to update completion status for retired task ID: ${taskId} to ${isCompleted}`);
      const { data, error } = await supabase
        .from('aethersink')
        .update({ is_completed: isCompleted, retired_at: new Date().toISOString() })
        .eq('id', taskId)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) {
        console.error("useSchedulerTasks: Error updating retired task status:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully updated retired task status:", data);
      return data as RetiredTask;
    },
    onMutate: async ({ taskId, isCompleted }: { taskId: string; isCompleted: boolean }) => {
      await queryClient.cancelQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      const previousRetiredTasks = queryClient.getQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], (old) =>
        (old || []).map(task =>
          task.id === taskId ? { ...task, is_completed: isCompleted } : task
        )
      );
      return { previousRetiredTasks, previousScrollTop };
    },
    onSuccess: (updatedTask) => {
      // No toast here, moved to onSettled
    },
    onSettled: (updatedTask, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      queryClient.invalidateQueries({ queryKey: ['completedTasksForSelectedDayList', userId, formattedSelectedDate] });
      showSuccess(`Retired task "${updatedTask?.name}" marked as ${updatedTask?.is_completed ? 'completed' : 'incomplete'}.`);
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (err, { taskId, isCompleted }, context) => {
      showError(`Failed to update retired task status: ${err.message}`);
      if (context?.previousRetiredTasks) {
        queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], context.previousRetiredTasks);
      }
    }
  });

  const updateScheduledTaskDetailsMutation = useMutation({
    mutationFn: async (task: Partial<DBScheduledTask> & { id: string }) => {
      if (!userId) throw new Error("User not authenticated.");
      
      // *** FIX: Determine target table based on flexibility ***
      const targetTable = task.is_flexible ? 'currentschedule' : 'fixedappointments';

      console.log(`useSchedulerTasks: Attempting to update scheduled task details in ${targetTable}:`, task);
      const { data, error } = await supabase
        .from(targetTable)
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
    onMutate: async (updatedTask: Partial<DBScheduledTask> & { id: string }) => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], (old) =>
        (old || []).map(task =>
          task.id === updatedTask.id ? { ...task, ...updatedTask } : task
        )
      );
      return { previousScheduledTasks, previousScrollTop };
    },
    onSuccess: () => {
      // No toast here, moved to onSettled
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
      showSuccess('Scheduled task details updated!');
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (e, _variables, context) => {
      showError(`Failed to update scheduled task details: ${e.message}`);
      if (context?.previousScheduledTasks) {
        queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], context.previousScheduledTasks);
      }
    }
  });

  const updateRetiredTaskDetailsMutation = useMutation({
    mutationFn: async (task: Partial<RetiredTask> & { id: string }) => {
      if (!userId) throw new Error("User not authenticated.");
      
      // *** FIX: Use aethersink table ***
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
    onMutate: async (updatedTask: Partial<RetiredTask> & { id: string }) => {
      await queryClient.cancelQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      const previousRetiredTasks = queryClient.getQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], (old) =>
        (old || []).map(task =>
          task.id === updatedTask.id ? { ...task, ...updatedTask } : task
        )
      );
      return { previousRetiredTasks, previousScrollTop };
    },
    onSuccess: () => {
      // No toast here, moved to onSettled
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      showSuccess('Retired task details updated!');
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (e, _variables, context) => {
      showError(`Failed to update retired task details: ${e.message}`);
      if (context?.previousRetiredTasks) {
        queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], context.previousRetiredTasks);
      }
    }
  });

  const clearXpGainAnimation = useCallback(() => {
    setXpGainAnimation(null);
  }, []);


  return {
    dbScheduledTasks,
    rawTasks,
    isLoading,
    datesWithTasks,
    isLoadingDatesWithTasks,
    retiredTasks,
    isLoadingRetiredTasks,
    completedTasksForSelectedDayList,
    isLoadingCompletedTasksForSelectedDay,
    addScheduledTask: addScheduledTaskMutation.mutate,
    addRetiredTask: addRetiredTaskMutation.mutate,
    removeScheduledTask: removeScheduledTaskMutation.mutate,
    clearScheduledTasks: clearScheduledTasksMutation.mutate,
    retireTask: retireTaskMutation.mutate,
    rezoneTask: rezoneTaskMutation.mutateAsync,
    compactScheduledTasks: compactScheduledTasksMutation.mutate,
    randomizeBreaks: randomizeBreaksMutation.mutate,
    toggleScheduledTaskLock: toggleScheduledTaskLockMutation.mutate,
    toggleRetiredTaskLock: toggleRetiredTaskLockMutation.mutate,
    aetherDump: aetherDumpMutation.mutate,
    aetherDumpMega: aetherDumpMegaMutation.mutate,
    autoBalanceSchedule: autoBalanceScheduleMutation.mutate,
    completeScheduledTask: completeScheduledTaskMutation.mutate,
    completeRetiredTask: completeRetiredTaskMutation.mutate,
    updateScheduledTaskStatus: updateScheduledTaskStatusMutation.mutate,
    updateRetiredTaskStatus: updateRetiredTaskStatusMutation.mutate,
    updateScheduledTaskDetails: updateScheduledTaskDetailsMutation.mutate,
    updateRetiredTaskDetails: updateRetiredTaskDetailsMutation.mutate,
    sortBy,
    setSortBy,
    retiredSortBy,
    setRetiredSortBy,
    xpGainAnimation,
    clearXpGainAnimation,
  };
};