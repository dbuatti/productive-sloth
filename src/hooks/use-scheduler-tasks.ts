import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  DBScheduledTask, NewDBScheduledTask, AetherSinkTask, NewAetherSinkTask,
  SortBy, TaskPriority, TimeBlock, AutoBalancePayload, UnifiedTask, AetherSinkSortBy, CompletedTask
} from '@/types/scheduler';
import { useSession } from './use-session';
import { showSuccess, showError } from '@/utils/toast';
import { startOfDay, subDays, formatISO, parseISO, isToday, isYesterday, format, addMinutes, isBefore, isAfter, addDays, differenceInMinutes } from 'date-fns';
import { XP_PER_LEVEL, MAX_ENERGY, DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION } from '@/lib/constants';
import { mergeOverlappingTimeBlocks, getFreeTimeBlocks, isSlotFree, calculateEnergyCost, compactScheduleLogic, getEmojiHue } from '@/lib/scheduler-utils';

// Define a common interface for mutation context
interface MutationContext {
  previousScheduledTasks?: DBScheduledTask[];
  previousAetherSinkTasks?: AetherSinkTask[];
  previousScrollTop?: number;
}

export const useSchedulerTasks = (selectedDate: string, scrollRef?: React.RefObject<HTMLElement>) => {
  const queryClient = useQueryClient();
  const { user, profile, refreshProfile, triggerLevelUp } = useSession();
  const userId = user?.id;

  const formattedSelectedDate = selectedDate;

  const [sortBy, setSortBy] = useState<SortBy>('TIME_EARLIEST_TO_LATEST');
  const [aetherSinkSortBy, setAetherSinkSortBy] = useState<AetherSinkSortBy>(() => {
    if (typeof window !== 'undefined') {
      const savedSortBy = localStorage.getItem('aetherSinkSortBy');
      return savedSortBy ? (savedSortBy as AetherSinkSortBy) : 'RETIRED_AT_NEWEST';
    }
    return 'RETIRED_AT_NEWEST';
  });
  const [xpGainAnimation, setXpGainAnimation] = useState<{ taskId: string, xpAmount: number } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('aetherSinkSortBy', aetherSinkSortBy);
    }
  }, [aetherSinkSortBy]);

  // Fetch scheduled tasks from FixedAppointments and CurrentSchedule
  const { data: dbScheduledTasks = [], isLoading } = useQuery<DBScheduledTask[]>({
    queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy],
    queryFn: async () => {
      if (!userId) return [];
      if (!formattedSelectedDate) return [];

      console.log("useSchedulerTasks: Fetching scheduled tasks for user:", userId, "on date:", formattedSelectedDate, "sorted by:", sortBy);

      // Fetch from FixedAppointments
      let fixedQuery = supabase
        .from('FixedAppointments')
        .select('*')
        .eq('user_id', userId)
        .eq('scheduled_date', formattedSelectedDate);

      // Fetch from CurrentSchedule
      let currentScheduleQuery = supabase
        .from('CurrentSchedule')
        .select('*')
        .eq('user_id', userId)
        .eq('scheduled_date', formattedSelectedDate);

      // Apply sorting to both queries if applicable
      if (sortBy === 'TIME_EARLIEST_TO_LATEST') {
        fixedQuery = fixedQuery.order('start_time', { ascending: true });
        currentScheduleQuery = currentScheduleQuery.order('start_time', { ascending: true });
      } else if (sortBy === 'TIME_LATEST_TO_EARLIEST') {
        fixedQuery = fixedQuery.order('start_time', { ascending: false });
        currentScheduleQuery = currentScheduleQuery.order('start_time', { ascending: false });
      } else if (sortBy === 'PRIORITY_HIGH_TO_LOW') {
        fixedQuery = fixedQuery.order('is_critical', { ascending: false }).order('start_time', { ascending: true });
        currentScheduleQuery = currentScheduleQuery.order('is_critical', { ascending: false }).order('start_time', { ascending: true });
      } else if (sortBy === 'PRIORITY_LOW_TO_HIGH') {
        fixedQuery = fixedQuery.order('is_critical', { ascending: true }).order('start_time', { ascending: true });
        currentScheduleQuery = currentScheduleQuery.order('is_critical', { ascending: true }).order('start_time', { ascending: true });
      } else {
        // Default sort by creation time if no specific time/priority sort
        fixedQuery = fixedQuery.order('created_at', { ascending: true });
        currentScheduleQuery = currentScheduleQuery.order('created_at', { ascending: true });
      }

      const { data: fixedData, error: fixedError } = await fixedQuery;
      if (fixedError) {
        console.error("useSchedulerTasks: Error fetching FixedAppointments:", fixedError.message);
        throw new Error(fixedError.message);
      }

      const { data: currentScheduleData, error: currentScheduleError } = await currentScheduleQuery;
      if (currentScheduleError) {
        console.error("useSchedulerTasks: Error fetching CurrentSchedule:", currentScheduleError.message);
        throw new Error(currentScheduleError.message);
      }

      let combinedTasks = [...(fixedData || []), ...(currentScheduleData || [])] as DBScheduledTask[];

      // Client-side sorting for EMOJI or if combined sort is needed after fetching
      if (sortBy === 'EMOJI') {
        combinedTasks = combinedTasks.sort((a, b) => {
          const hueA = getEmojiHue(a.name);
          const hueB = getEmojiHue(b.name);
          return hueA - hueB;
        });
      } else if (!sortBy.startsWith('TIME') && !sortBy.startsWith('PRIORITY')) {
        // If not sorted by time or priority in DB, sort by start_time client-side
        combinedTasks = combinedTasks.sort((a, b) => {
          const startTimeA = a.start_time ? parseISO(a.start_time).getTime() : 0;
          const startTimeB = b.start_time ? parseISO(b.start_time).getTime() : 0;
          return startTimeA - startTimeB;
        });
      }

      console.log("useSchedulerTasks: Successfully fetched combined scheduled tasks:", combinedTasks.map(t => ({ id: t.id, name: t.name, scheduled_date: t.scheduled_date, start_time: t.start_time, end_time: t.end_time, is_critical: t.is_critical, is_flexible: t.is_flexible, is_locked: t.is_locked, energy_cost: t.energy_cost, is_completed: t.is_completed, is_custom_energy_cost: t.is_custom_energy_cost })));
      return combinedTasks;
    },
    enabled: !!userId && !!formattedSelectedDate,
  });

  const { data: datesWithTasks = [], isLoading: isLoadingDatesWithTasks } = useQuery<string[]>({
    queryKey: ['datesWithTasks', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data: fixedDates, error: fixedError } = await supabase
        .from('FixedAppointments')
        .select('scheduled_date')
        .eq('user_id', userId);
      if (fixedError) console.error("Error fetching fixed appointment dates:", fixedError.message);

      const { data: currentScheduleDates, error: currentScheduleError } = await supabase
        .from('CurrentSchedule')
        .select('scheduled_date')
        .eq('user_id', userId);
      if (currentScheduleError) console.error("Error fetching current schedule dates:", currentScheduleError.message);

      const allDates = [
        ...(fixedDates || []).map(item => format(parseISO(item.scheduled_date), 'yyyy-MM-dd')),
        ...(currentScheduleDates || []).map(item => format(parseISO(item.scheduled_date), 'yyyy-MM-dd'))
      ];
      const uniqueDates = Array.from(new Set(allDates));
      return uniqueDates;
    },
    enabled: !!userId,
  });

  const { data: aetherSinkTasks = [], isLoading: isLoadingAetherSinkTasks } = useQuery<AetherSinkTask[]>({
    queryKey: ['aetherSinkTasks', userId, aetherSinkSortBy],
    queryFn: async () => {
      if (!userId) return [];
      console.log("useSchedulerTasks: Fetching AetherSink tasks for user:", userId, "sorted by:", aetherSinkSortBy);
      let query = supabase
        .from('AetherSink')
        .select('*')
        .eq('user_id', userId);

      switch (aetherSinkSortBy) {
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
        console.error("useSchedulerTasks: Error fetching AetherSink tasks:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully fetched AetherSink tasks:", data.map(t => ({ id: t.id, name: t.name, is_critical: t.is_critical, is_locked: t.is_locked, energy_cost: t.energy_cost, is_completed: t.is_completed, is_custom_energy_cost: t.is_custom_energy_cost })));
      
      if (aetherSinkSortBy === 'EMOJI') {
        return (data as AetherSinkTask[]).sort((a, b) => {
          const hueA = getEmojiHue(a.name);
          const hueB = getEmojiHue(b.name);
          return hueA - hueB;
        });
      }

      return data as AetherSinkTask[];
    },
    enabled: !!userId,
    placeholderData: (previousData) => previousData,
  });

  const { data: completedTasksForSelectedDayList = [], isLoading: isLoadingCompletedTasksForSelectedDay } = useQuery<CompletedTask[]>({
    queryKey: ['completedTasksForSelectedDayList', userId, formattedSelectedDate],
    queryFn: async () => {
      if (!userId) return [];
      
      const selectedDayDate = parseISO(formattedSelectedDate);
      const selectedDayStartUTC = new Date(Date.UTC(selectedDayDate.getFullYear(), selectedDayDate.getMonth(), selectedDayDate.getDate())).toISOString();
      const selectedDayEndUTC = new Date(Date.UTC(selectedDayDate.getFullYear(), selectedDayDate.getMonth(), selectedDayDate.getDate() + 1)).toISOString();

      console.log("useSchedulerTasks: Fetching completed tasks for selected day. User ID:", userId, "Selected Day:", formattedSelectedDate);
      console.log("useSchedulerTasks: Selected Day Start UTC:", selectedDayStartUTC);
      console.log("useSchedulerTasks: Selected Day End UTC:", selectedDayEndUTC);

      const { data, error } = await supabase
        .from('CompletedTasks')
        .select('*')
        .eq('user_id', userId)
        .gte('completed_at', selectedDayStartUTC)
        .lt('completed_at', selectedDayEndUTC)
        .order('completed_at', { ascending: false });

      if (error) {
        console.error('useSchedulerTasks: Error fetching completed tasks for selected day:', error);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Completed Tasks for selected day:", data);
      return data as CompletedTask[];
    },
    enabled: !!userId && !!formattedSelectedDate,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });


  const addScheduledTaskMutation = useMutation({
    mutationFn: async (newTask: NewDBScheduledTask & { sourceTable: 'FixedAppointments' | 'CurrentSchedule' }) => {
      if (!userId) throw new Error("User not authenticated.");
      const taskToInsert = { ...newTask, user_id: userId, energy_cost: newTask.energy_cost ?? 0, is_completed: newTask.is_completed ?? false, is_custom_energy_cost: newTask.is_custom_energy_cost ?? false };
      
      console.log(`useSchedulerTasks: Attempting to insert new task into ${newTask.sourceTable}:`, taskToInsert);
      const { data, error } = await supabase.from(newTask.sourceTable).insert(taskToInsert).select().single();
      if (error) {
        console.error(`useSchedulerTasks: Error inserting task into ${newTask.sourceTable}:`, error.message);
        throw new Error(error.message);
      }
      console.log(`useSchedulerTasks: Successfully inserted task into ${newTask.sourceTable}:`, data);
      return data as DBScheduledTask;
    },
    onMutate: async (newTask) => {
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

  const addAetherSinkTaskMutation = useMutation({
    mutationFn: async (newTask: NewAetherSinkTask) => {
      if (!userId) throw new Error("User not authenticated.");
      const taskToInsert = { ...newTask, user_id: userId, retired_at: new Date().toISOString(), energy_cost: newTask.energy_cost ?? 0, is_completed: newTask.is_completed ?? false, is_custom_energy_cost: newTask.is_custom_energy_cost ?? false };
      console.log("useSchedulerTasks: Attempting to insert new AetherSink task:", taskToInsert);
      const { data, error } = await supabase.from('AetherSink').insert(taskToInsert).select().single();
      if (error) {
        console.error("useSchedulerTasks: Error inserting AetherSink task:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully inserted AetherSink task:", data);
      return data as AetherSinkTask;
    },
    onMutate: async (newTask: NewAetherSinkTask) => {
      await queryClient.cancelQueries({ queryKey: ['aetherSinkTasks', userId, aetherSinkSortBy] });
      const previousAetherSinkTasks = queryClient.getQueryData<AetherSinkTask[]>(['aetherSinkTasks', userId, aetherSinkSortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      return { previousAetherSinkTasks, previousScrollTop };
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['aetherSinkTasks', userId, aetherSinkSortBy] });
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
      if (context?.previousAetherSinkTasks) {
        queryClient.setQueryData<AetherSinkTask[]>(['aetherSinkTasks', userId, aetherSinkSortBy], context.previousAetherSinkTasks);
      }
    }
  });


  const removeScheduledTaskMutation = useMutation({
    mutationFn: async ({ taskId, sourceTable }: { taskId: string; sourceTable: 'FixedAppointments' | 'CurrentSchedule' }) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log(`useSchedulerTasks: Attempting to remove task ID: ${taskId} from ${sourceTable}`);
      const { error } = await supabase.from(sourceTable).delete().eq('id', taskId).eq('user_id', userId);
      if (error) {
        console.error(`useSchedulerTasks: Error removing task from ${sourceTable}:`, error.message);
        throw new Error(error.message);
      }
      console.log(`useSchedulerTasks: Successfully removed task ID: ${taskId} from ${sourceTable}`);
    },
    onMutate: async ({ taskId, sourceTable }) => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], (old) =>
        (old || []).filter(task => task.id !== taskId)
      );
      return { previousScheduledTasks, previousScrollTop };
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
      showSuccess('Task removed from schedule.');
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (e, { taskId, sourceTable }, context) => {
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

      // Delete from FixedAppointments
      const { error: fixedError } = await supabase.from('FixedAppointments').delete().eq('user_id', userId).eq('scheduled_date', formattedSelectedDate);
      if (fixedError) throw new Error(`Failed to clear FixedAppointments: ${fixedError.message}`);

      // Delete from CurrentSchedule
      const { error: currentScheduleError } = await supabase.from('CurrentSchedule').delete().eq('user_id', userId).eq('scheduled_date', formattedSelectedDate);
      if (currentScheduleError) throw new Error(`Failed to clear CurrentSchedule: ${currentScheduleError.message}`);
      
      console.log("useSchedulerTasks: Successfully cleared all scheduled tasks for user:", userId, "on date:", formattedSelectedDate);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], []);
      return { previousScheduledTasks, previousScrollTop };
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
    mutationFn: async (taskToRetire: DBScheduledTask & { originalSourceTable: 'FixedAppointments' | 'CurrentSchedule' }) => {
      if (!userId) throw new Error("User not authenticated.");

      const newAetherSinkTask: NewAetherSinkTask = {
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
      const { error: insertError } = await supabase.from('AetherSink').insert(newAetherSinkTask);
      if (insertError) throw new Error(`Failed to move task to Aether Sink: ${insertError.message}`);

      const { error: deleteError } = await supabase.from(taskToRetire.originalSourceTable).delete().eq('id', taskToRetire.id).eq('user_id', userId);
      if (deleteError) throw new Error(`Failed to remove task from schedule: ${deleteError.message}`);
    },
    onMutate: async (taskToRetire) => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      await queryClient.cancelQueries({ queryKey: ['aetherSinkTasks', userId, aetherSinkSortBy] });

      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);
      const previousAetherSinkTasks = queryClient.getQueryData<AetherSinkTask[]>(['aetherSinkTasks', userId, aetherSinkSortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], (old) =>
        (old || []).filter(task => task.id !== taskToRetire.id)
      );

      return { previousScheduledTasks, previousAetherSinkTasks, previousScrollTop };
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      queryClient.invalidateQueries({ queryKey: ['aetherSinkTasks', userId, aetherSinkSortBy] });
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
      if (context?.previousAetherSinkTasks) {
        queryClient.setQueryData<AetherSinkTask[]>(['aetherSinkTasks', userId, aetherSinkSortBy], context.previousAetherSinkTasks);
      }
    }
  });

  const rezoneTaskMutation = useMutation({
    mutationFn: async (aetherSinkTaskId: string) => {
      if (!userId) throw new Error("User not authenticated.");

      const { error: deleteError } = await supabase.from('AetherSink').delete().eq('id', aetherSinkTaskId).eq('user_id', userId);
      if (deleteError) throw new Error(`Failed to remove task from Aether Sink: ${deleteError.message}`);
    },
    onMutate: async (aetherSinkTaskId: string) => {
      await queryClient.cancelQueries({ queryKey: ['aetherSinkTasks', userId, aetherSinkSortBy] });
      const previousAetherSinkTasks = queryClient.getQueryData<AetherSinkTask[]>(['aetherSinkTasks', userId, aetherSinkSortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      queryClient.setQueryData<AetherSinkTask[]>(['aetherSinkTasks', userId, aetherSinkSortBy], (old) =>
        (old || []).filter(task => task.id !== aetherSinkTaskId)
      );
      return { previousAetherSinkTasks, previousScrollTop };
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['aetherSinkTasks', userId, aetherSinkSortBy] });
      showSuccess('Task removed from Aether Sink.');
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (err, aetherSinkTaskId, context) => {
      showError(`Failed to remove task from Aether Sink: ${err.message}`);
      if (context?.previousAetherSinkTasks) {
        queryClient.setQueryData<AetherSinkTask[]>(['aetherSinkTasks', userId, aetherSinkSortBy], context.previousAetherSinkTasks);
      }
    }
  });

  const compactScheduledTasksMutation = useMutation({
    mutationFn: async ({ tasksToUpdate }: { tasksToUpdate: DBScheduledTask[] }) => {
      if (!userId) throw new Error("User not authenticated.");

      const updatesFixed = tasksToUpdate.filter(task => !task.is_flexible || task.is_locked).map(task => ({
        id: task.id, user_id: userId, name: task.name, break_duration: task.break_duration,
        start_time: task.start_time, end_time: task.end_time, scheduled_date: task.scheduled_date,
        is_critical: task.is_critical, is_flexible: false, is_locked: task.is_locked,
        energy_cost: task.energy_cost ?? 0, is_completed: task.is_completed ?? false,
        is_custom_energy_cost: task.is_custom_energy_cost ?? false, updated_at: new Date().toISOString(),
      }));

      const updatesCurrentSchedule = tasksToUpdate.filter(task => task.is_flexible && !task.is_locked).map(task => ({
        id: task.id, user_id: userId, name: task.name, break_duration: task.break_duration,
        start_time: task.start_time, end_time: task.end_time, scheduled_date: task.scheduled_date,
        is_critical: task.is_critical, is_flexible: true, is_locked: task.is_locked,
        energy_cost: task.energy_cost ?? 0, is_completed: task.is_completed ?? false,
        is_custom_energy_cost: task.is_custom_energy_cost ?? false, updated_at: new Date().toISOString(),
      }));

      if (updatesFixed.length > 0) {
        const { error } = await supabase.from('FixedAppointments').upsert(updatesFixed, { onConflict: 'id' });
        if (error) throw new Error(`Failed to update FixedAppointments during compaction: ${error.message}`);
      }
      if (updatesCurrentSchedule.length > 0) {
        const { error } = await supabase.from('CurrentSchedule').upsert(updatesCurrentSchedule, { onConflict: 'id' });
        if (error) throw new Error(`Failed to update CurrentSchedule during compaction: ${error.message}`);
      }
    },
    onMutate: async ({ tasksToUpdate }) => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], (old) => {
        const updatedTasks = (old || []).map(oldTask => {
          const newTask = tasksToUpdate.find(t => t.id === oldTask.id);
          return newTask ? newTask : oldTask;
        });
        return updatedTasks;
      });
      return { previousScheduledTasks, previousScrollTop };
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
        const { error } = await supabase.from('CurrentSchedule').upsert(updates, { onConflict: 'id' });
        if (error) throw new Error(`Failed to update placed breaks: ${error.message}`);
      }

      if (failedToPlaceBreaks.length > 0) {
        const { error: deleteError } = await supabase
          .from('CurrentSchedule')
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
    mutationFn: async ({ taskId, isLocked, sourceTable }: { taskId: string; isLocked: boolean; sourceTable: 'FixedAppointments' | 'CurrentSchedule' }) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log(`useSchedulerTasks: Attempting to toggle lock for task ID: ${taskId} in ${sourceTable} to ${isLocked}`);
      const { data, error } = await supabase
        .from(sourceTable)
        .update({ is_locked: isLocked, updated_at: new Date().toISOString() })
        .eq('id', taskId)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) {
        console.error(`useSchedulerTasks: Error toggling task lock in ${sourceTable}:`, error.message);
        throw new Error(error.message);
      }
      console.log(`useSchedulerTasks: Successfully toggled lock for task in ${sourceTable}:`, data);
      return data as DBScheduledTask;
    },
    onMutate: async ({ taskId, isLocked, sourceTable }) => {
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
    onSettled: (updatedTask, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      showSuccess(`Task "${updatedTask?.name}" ${updatedTask?.is_locked ? 'locked' : 'unlocked'}.`);
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (err, { taskId, isLocked, sourceTable }, context) => {
      showError(`Failed to toggle lock for task in ${sourceTable}: ${err.message}`);
      if (context?.previousScheduledTasks) {
        queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], context.previousScheduledTasks);
      }
    }
  });

  const toggleAetherSinkTaskLockMutation = useMutation({
    mutationFn: async ({ taskId, isLocked }: { taskId: string; isLocked: boolean }) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log(`useSchedulerTasks: Attempting to toggle lock for AetherSink task ID: ${taskId} to ${isLocked}`);
      const { data, error } = await supabase
        .from('AetherSink')
        .update({ is_locked: isLocked, retired_at: new Date().toISOString() })
        .eq('id', taskId)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) {
        console.error("useSchedulerTasks: Error toggling AetherSink task lock:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully toggled lock for AetherSink task:", data);
      return data as AetherSinkTask;
    },
    onMutate: async ({ taskId, isLocked }: { taskId: string; isLocked: boolean }) => {
      await queryClient.cancelQueries({ queryKey: ['aetherSinkTasks', userId, aetherSinkSortBy] });
      const previousAetherSinkTasks = queryClient.getQueryData<AetherSinkTask[]>(['aetherSinkTasks', userId, aetherSinkSortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      queryClient.setQueryData<AetherSinkTask[]>(['aetherSinkTasks', userId, aetherSinkSortBy], (old) =>
        (old || []).map(task =>
          task.id === taskId ? { ...task, is_locked: isLocked } : task
        )
      );
      return { previousAetherSinkTasks, previousScrollTop };
    },
    onSettled: (updatedTask, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['aetherSinkTasks', userId, aetherSinkSortBy] });
      showSuccess(`AetherSink task "${updatedTask?.name}" ${updatedTask?.is_locked ? 'locked' : 'unlocked'}.`);
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (err, { taskId, isLocked }, context) => {
      showError(`Failed to toggle lock for AetherSink task: ${err.message}`);
      if (context?.previousAetherSinkTasks) {
        queryClient.setQueryData<AetherSinkTask[]>(['aetherSinkTasks', userId, aetherSinkSortBy], context.previousAetherSinkTasks);
      }
    }
  });

  const aetherDumpMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("User not authenticated.");

      // Fetch from CurrentSchedule
      const { data: currentScheduleTasks, error: fetchCurrentScheduleError } = await supabase
        .from('CurrentSchedule')
        .select('*')
        .eq('user_id', userId)
        .eq('scheduled_date', formattedSelectedDate);
      if (fetchCurrentScheduleError) throw new Error(`Failed to fetch CurrentSchedule tasks for Aether Dump: ${fetchCurrentScheduleError.message}`);

      const tasksToDump = currentScheduleTasks.filter(task => task.is_flexible && !task.is_locked);

      if (tasksToDump.length === 0) {
        showSuccess("No flexible, unlocked tasks to dump to Aether Sink for today.");
        return;
      }

      const newAetherSinkTasks: NewAetherSinkTask[] = tasksToDump.map(task => ({
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

      const { error: insertError } = await supabase.from('AetherSink').insert(newAetherSinkTasks);
      if (insertError) throw new Error(`Failed to move tasks to Aether Sink: ${insertError.message}`);

      const { error: deleteError } = await supabase
        .from('CurrentSchedule')
        .delete()
        .in('id', tasksToDump.map(task => task.id))
        .eq('user_id', userId);
      if (deleteError) throw new Error(`Failed to remove tasks from CurrentSchedule: ${deleteError.message}`);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      await queryClient.cancelQueries({ queryKey: ['aetherSinkTasks', userId, aetherSinkSortBy] });

      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);
      const previousAetherSinkTasks = queryClient.getQueryData<AetherSinkTask[]>(['aetherSinkTasks', userId, aetherSinkSortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      const tasksToDump = (previousScheduledTasks || []).filter(task => task.is_flexible && !task.is_locked);
      const remainingScheduledTasks = (previousScheduledTasks || []).filter(task => !task.is_flexible || task.is_locked);
      
      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], remainingScheduledTasks);

      return { previousScheduledTasks, previousAetherSinkTasks, previousScrollTop };
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      queryClient.invalidateQueries({ queryKey: ['aetherSinkTasks', userId, aetherSinkSortBy] });
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
      if (context?.previousAetherSinkTasks) {
        queryClient.setQueryData<AetherSinkTask[]>(['aetherSinkTasks', userId, aetherSinkSortBy], context.previousAetherSinkTasks);
      }
    }
  });

  const aetherDumpMegaMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("User not authenticated.");

      const { data: allFlexibleScheduledTasks, error: fetchError } = await supabase
        .from('CurrentSchedule') // Only dump from CurrentSchedule
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

      const newAetherSinkTasks: NewAetherSinkTask[] = allFlexibleScheduledTasks.map(task => ({
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

      const { error: insertError } = await supabase.from('AetherSink').insert(newAetherSinkTasks);
      if (insertError) throw new Error(`Failed to move tasks to Aether Sink (Mega): ${insertError.message}`);

      const { error: deleteError } = await supabase
        .from('CurrentSchedule')
        .delete()
        .in('id', allFlexibleScheduledTasks.map(task => task.id))
        .eq('user_id', userId);
      if (deleteError) throw new Error(`Failed to remove tasks from CurrentSchedule (Mega): ${deleteError.message}`);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId] });
      await queryClient.cancelQueries({ queryKey: ['aetherSinkTasks', userId, aetherSinkSortBy] });
      await queryClient.cancelQueries({ queryKey: ['datesWithTasks', userId] });

      const previousAetherSinkTasks = queryClient.getQueryData<AetherSinkTask[]>(['aetherSinkTasks', userId, aetherSinkSortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      return { previousAetherSinkTasks, previousScrollTop };
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId] });
      queryClient.invalidateQueries({ queryKey: ['aetherSinkTasks', userId, aetherSinkSortBy] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
      showSuccess('All flexible tasks from today and future moved to Aether Sink!');
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (err, _variables, context) => {
      showError(`Failed to perform Aether Dump Mega: ${err.message}`);
      if (context?.previousAetherSinkTasks) {
        queryClient.setQueryData<AetherSinkTask[]>(['aetherSinkTasks', userId, aetherSinkSortBy], context.previousAetherSinkTasks);
      }
    }
  });

  const autoBalanceScheduleMutation = useMutation({
    mutationFn: async (payload: AutoBalancePayload) => {
      if (!userId) throw new Error("User not authenticated.");

      console.log("autoBalanceScheduleMutation: Payload received:", {
        fixedAppointmentIdsToDelete: payload.fixedAppointmentIdsToDelete,
        currentScheduleIdsToDelete: payload.currentScheduleIdsToDelete,
        aetherSinkIdsToDelete: payload.aetherSinkIdsToDelete,
        tasksToInsertIntoFixedAppointments: payload.tasksToInsertIntoFixedAppointments.map(t => ({ id: t.id, name: t.name, is_flexible: t.is_flexible, is_locked: t.is_locked })),
        tasksToInsertIntoCurrentSchedule: payload.tasksToInsertIntoCurrentSchedule.map(t => ({ id: t.id, name: t.name, is_flexible: t.is_flexible, is_locked: t.is_locked })),
        tasksToKeepInAetherSink: payload.tasksToKeepInAetherSink.map(t => ({ name: t.name })),
        selectedDate: payload.selectedDate,
      });

      // 1. Delete from FixedAppointments
      if (payload.fixedAppointmentIdsToDelete.length > 0) {
        console.log("autoBalanceScheduleMutation: Deleting FixedAppointments with IDs:", payload.fixedAppointmentIdsToDelete);
        const { error } = await supabase
          .from('FixedAppointments')
          .delete()
          .in('id', payload.fixedAppointmentIdsToDelete)
          .eq('user_id', userId)
          .eq('scheduled_date', payload.selectedDate);
        if (error) throw new Error(`Failed to delete old FixedAppointments: ${error.message}`);
        console.log("autoBalanceScheduleMutation: FixedAppointments deleted successfully.");
      }

      // 2. Delete from CurrentSchedule
      if (payload.currentScheduleIdsToDelete.length > 0) {
        console.log("autoBalanceScheduleMutation: Deleting CurrentSchedule tasks with IDs:", payload.currentScheduleIdsToDelete);
        const { error } = await supabase
          .from('CurrentSchedule')
          .delete()
          .in('id', payload.currentScheduleIdsToDelete)
          .eq('user_id', userId)
          .eq('scheduled_date', payload.selectedDate);
        if (error) throw new Error(`Failed to delete old CurrentSchedule tasks: ${error.message}`);
        console.log("autoBalanceScheduleMutation: CurrentSchedule tasks deleted successfully.");
      }

      // 3. Delete from AetherSink
      if (payload.aetherSinkIdsToDelete.length > 0) {
        console.log("autoBalanceScheduleMutation: Deleting AetherSink tasks with IDs:", payload.aetherSinkIdsToDelete);
        const { error } = await supabase
          .from('AetherSink')
          .delete()
          .in('id', payload.aetherSinkIdsToDelete)
          .eq('user_id', userId);
        if (error) throw new Error(`Failed to delete old AetherSink tasks: ${error.message}`);
        console.log("autoBalanceScheduleMutation: AetherSink tasks deleted successfully.");
      }

      // 4. Upsert new FixedAppointments
      if (payload.tasksToInsertIntoFixedAppointments.length > 0) {
        const tasksToInsertWithUserId = payload.tasksToInsertIntoFixedAppointments.map(task => ({ ...task, user_id: userId }));
        console.log("autoBalanceScheduleMutation: Upserting new FixedAppointments:", tasksToInsertWithUserId.map(t => ({ id: t.id, name: t.name, is_flexible: t.is_flexible, is_locked: t.is_locked })));
        const { error } = await supabase
          .from('FixedAppointments')
          .upsert(tasksToInsertWithUserId, { onConflict: 'id' });
        if (error) throw new Error(`Failed to upsert new FixedAppointments: ${error.message}`);
        console.log("autoBalanceScheduleMutation: New FixedAppointments upserted successfully.");
      }

      // 5. Upsert new CurrentSchedule tasks
      if (payload.tasksToInsertIntoCurrentSchedule.length > 0) {
        const tasksToInsertWithUserId = payload.tasksToInsertIntoCurrentSchedule.map(task => ({ ...task, user_id: userId }));
        console.log("autoBalanceScheduleMutation: Upserting new CurrentSchedule tasks:", tasksToInsertWithUserId.map(t => ({ id: t.id, name: t.name, is_flexible: t.is_flexible, is_locked: t.is_locked })));
        const { error } = await supabase
          .from('CurrentSchedule')
          .upsert(tasksToInsertWithUserId, { onConflict: 'id' });
        if (error) throw new Error(`Failed to upsert new CurrentSchedule tasks: ${error.message}`);
        console.log("autoBalanceScheduleMutation: New CurrentSchedule tasks upserted successfully.");
      }

      // 6. Insert tasks back into AetherSink (those that couldn't be placed)
      if (payload.tasksToKeepInAetherSink.length > 0) {
        const tasksToKeepInAetherSinkWithUserId = payload.tasksToKeepInAetherSink.map(task => ({ 
          ...task, 
          user_id: userId, 
          retired_at: new Date().toISOString() 
        }));
        console.log("autoBalanceScheduleMutation: Re-inserting tasks into AetherSink:", tasksToKeepInAetherSinkWithUserId.map(t => ({ name: t.name })));
        const { error } = await supabase
          .from('AetherSink')
          .insert(tasksToKeepInAetherSinkWithUserId);
        if (error) throw new Error(`Failed to re-insert unscheduled tasks into AetherSink: ${error.message}`);
        console.log("autoBalanceScheduleMutation: Unscheduled tasks re-inserted into AetherSink successfully.");
      }

      return {
        tasksPlacedFixed: payload.tasksToInsertIntoFixedAppointments.length,
        tasksPlacedCurrentSchedule: payload.tasksToInsertIntoCurrentSchedule.length,
        tasksKeptInAetherSink: payload.tasksToKeepInAetherSink.length
      };
    },
    onMutate: async (payload: AutoBalancePayload) => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, payload.selectedDate, sortBy] });
      await queryClient.cancelQueries({ queryKey: ['aetherSinkTasks', userId, aetherSinkSortBy] });
      await queryClient.cancelQueries({ queryKey: ['datesWithTasks', userId] });
      
      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, payload.selectedDate, sortBy]);
      const previousAetherSinkTasks = queryClient.getQueryData<AetherSinkTask[]>(['aetherSinkTasks', userId, aetherSinkSortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, payload.selectedDate, sortBy], (old) =>
        (old || []).filter(task => 
          !payload.fixedAppointmentIdsToDelete.includes(task.id) && 
          !payload.currentScheduleIdsToDelete.includes(task.id)
        )
      );
      queryClient.setQueryData<AetherSinkTask[]>(['aetherSinkTasks', userId, aetherSinkSortBy], (old) =>
        (old || []).filter(task => !payload.aetherSinkIdsToDelete.includes(task.id))
      );

      return { previousScheduledTasks, previousAetherSinkTasks, previousScrollTop };
    },
    onSettled: (result, _error, payload, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, payload.selectedDate, sortBy] });
      queryClient.invalidateQueries({ queryKey: ['aetherSinkTasks', userId, aetherSinkSortBy] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
      
      let message = `Schedule balanced! ${result?.tasksPlacedFixed + result?.tasksPlacedCurrentSchedule} task(s) placed.`;
      if (result?.tasksKeptInAetherSink && result.tasksKeptInAetherSink > 0) {
        message += ` ${result.tasksKeptInAetherSink} task${result.tasksKeptInAetherSink > 1 ? 's' : ''} returned to Aether Sink.`;
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
      if (context?.previousAetherSinkTasks) {
        queryClient.setQueryData<AetherSinkTask[]>(['aetherSinkTasks', userId, aetherSinkSortBy], context.previousAetherSinkTasks);
      }
    }
  });

  const completeScheduledTaskMutation = useMutation({
    mutationFn: async (taskToComplete: DBScheduledTask & { originalSourceTable: 'FixedAppointments' | 'CurrentSchedule' }, durationUsed: number) => {
      if (!userId || !profile) throw new Error("User not authenticated or profile not loaded.");

      if (profile.energy < taskToComplete.energy_cost) {
        showError(`Not enough energy to complete "${taskToComplete.name}". You need ${taskToComplete.energy_cost} energy, but have ${profile.energy}.`);
        throw new Error("Insufficient energy.");
      }

      let xpGained = taskToComplete.energy_cost * 2;
      if (taskToComplete.is_critical && isToday(parseISO(taskToComplete.scheduled_date))) {
        xpGained += 5;
        showSuccess(`Critical task bonus! +5 XP`);
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

      // Insert into CompletedTasks
      const durationScheduled = taskToComplete.start_time && taskToComplete.end_time
        ? differenceInMinutes(parseISO(taskToComplete.end_time), parseISO(taskToComplete.start_time))
        : null;

      const completedTaskRecord: Omit<CompletedTask, 'id' | 'created_at'> = {
        user_id: userId,
        task_name: taskToComplete.name,
        original_id: taskToComplete.id,
        duration_scheduled: durationScheduled,
        duration_used: durationUsed,
        completed_at: new Date().toISOString(),
        xp_earned: xpGained,
        energy_cost: taskToComplete.energy_cost,
        is_critical: taskToComplete.is_critical,
        original_source: taskToComplete.originalSourceTable,
        original_scheduled_date: taskToComplete.scheduled_date,
      };
      const { error: completedInsertError } = await supabase.from('CompletedTasks').insert(completedTaskRecord);
      if (completedInsertError) {
        console.error("Failed to insert into CompletedTasks:", completedInsertError.message);
        showError("Failed to record task completion.");
        throw new Error("Failed to record task completion.");
      }

      // Delete from origin table
      const { error: deleteError } = await supabase.from(taskToComplete.originalSourceTable).delete().eq('id', taskToComplete.id).eq('user_id', userId);
      if (deleteError) {
        console.error(`Failed to delete task from ${taskToComplete.originalSourceTable}:`, deleteError.message);
        showError("Failed to remove task from schedule.");
        throw new Error("Failed to remove task from schedule.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
      queryClient.invalidateQueries({ queryKey: ['completedTasksForSelectedDayList', userId, formattedSelectedDate] });
    },
    onError: (err) => {
      if (err.message !== "Insufficient energy." && err.message !== "Failed to update profile stats.") {
        showError(`Failed to complete scheduled task: ${err.message}`);
      }
    }
  });

  const completeAetherSinkTaskMutation = useMutation({
    mutationFn: async (taskToComplete: AetherSinkTask, durationUsed: number) => {
      if (!userId || !profile) throw new Error("User not authenticated or profile not loaded.");

      if (profile.energy < taskToComplete.energy_cost) {
        showError(`Not enough energy to complete AetherSink task "${taskToComplete.name}". You need ${taskToComplete.energy_cost} energy, but have ${profile.energy}.`);
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
        console.error("Failed to update user profile (XP, streak, energy, tasks_completed_today) for AetherSink task:", profileError.message);
        showError("Failed to update profile stats for AetherSink task.");
        throw new Error("Failed to update profile stats for AetherSink task.");
      } else {
        await refreshProfile();
        
        setXpGainAnimation({ taskId: taskToComplete.id, xpAmount: xpGained });

        showSuccess(`AetherSink task completed! -${taskToComplete.energy_cost} Energy`);
        if (newLevel > profile.level) {
          showSuccess(`🎉 Level Up! You reached Level ${newLevel}!`);
          triggerLevelUp(newLevel);
        }
      }

      // Insert into CompletedTasks
      const completedTaskRecord: Omit<CompletedTask, 'id' | 'created_at'> = {
        user_id: userId,
        task_name: taskToComplete.name,
        original_id: taskToComplete.id,
        duration_scheduled: taskToComplete.duration,
        duration_used: durationUsed,
        completed_at: new Date().toISOString(),
        xp_earned: xpGained,
        energy_cost: taskToComplete.energy_cost,
        is_critical: taskToComplete.is_critical,
        original_source: 'AetherSink',
        original_scheduled_date: taskToComplete.original_scheduled_date,
      };
      const { error: completedInsertError } = await supabase.from('CompletedTasks').insert(completedTaskRecord);
      if (completedInsertError) {
        console.error("Failed to insert into CompletedTasks from AetherSink:", completedInsertError.message);
        showError("Failed to record task completion from AetherSink.");
        throw new Error("Failed to record task completion from AetherSink.");
      }

      // Delete from AetherSink
      const { error: deleteError } = await supabase.from('AetherSink').delete().eq('id', taskToComplete.id).eq('user_id', userId);
      if (deleteError) {
        console.error("Failed to delete task from AetherSink:", deleteError.message);
        showError("Failed to remove task from AetherSink.");
        throw new Error("Failed to remove task from AetherSink.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      queryClient.invalidateQueries({ queryKey: ['aetherSinkTasks', userId, aetherSinkSortBy] });
      queryClient.invalidateQueries({ queryKey: ['completedTasksForSelectedDayList', userId, formattedSelectedDate] });
    },
    onError: (err) => {
      if (err.message !== "Insufficient energy." && err.message !== "Failed to update profile stats for AetherSink task.") {
        showError(`Failed to complete AetherSink task: ${err.message}`);
      }
    }
  });

  const updateScheduledTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, isCompleted, sourceTable }: { taskId: string; isCompleted: boolean; sourceTable: 'FixedAppointments' | 'CurrentSchedule' }) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log(`useSchedulerTasks: Attempting to update completion status for scheduled task ID: ${taskId} in ${sourceTable} to ${isCompleted}`);
      const { data, error } = await supabase
        .from(sourceTable)
        .update({ is_completed: isCompleted, updated_at: new Date().toISOString() })
        .eq('id', taskId)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) {
        console.error(`useSchedulerTasks: Error updating scheduled task status in ${sourceTable}:`, error.message);
        throw new Error(error.message);
      }
      console.log(`useSchedulerTasks: Successfully updated scheduled task status in ${sourceTable}:`, data);
      return data as DBScheduledTask;
    },
    onMutate: async ({ taskId, isCompleted, sourceTable }) => {
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
    onSettled: (updatedTask, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      queryClient.invalidateQueries({ queryKey: ['completedTasksForSelectedDayList', userId, formattedSelectedDate] });
      showSuccess(`Scheduled task "${updatedTask?.name}" marked as ${updatedTask?.is_completed ? 'completed' : 'incomplete'}.`);
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (err, { taskId, isCompleted, sourceTable }, context) => {
      showError(`Failed to update scheduled task status in ${sourceTable}: ${err.message}`);
      if (context?.previousScheduledTasks) {
        queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], context.previousScheduledTasks);
      }
    }
  });

  const updateAetherSinkTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, isCompleted }: { taskId: string; isCompleted: boolean }) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log(`useSchedulerTasks: Attempting to update completion status for AetherSink task ID: ${taskId} to ${isCompleted}`);
      const { data, error } = await supabase
        .from('AetherSink')
        .update({ is_completed: isCompleted, retired_at: new Date().toISOString() })
        .eq('id', taskId)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) {
        console.error("useSchedulerTasks: Error updating AetherSink task status:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully updated AetherSink task status:", data);
      return data as AetherSinkTask;
    },
    onMutate: async ({ taskId, isCompleted }: { taskId: string; isCompleted: boolean }) => {
      await queryClient.cancelQueries({ queryKey: ['aetherSinkTasks', userId, aetherSinkSortBy] });
      const previousAetherSinkTasks = queryClient.getQueryData<AetherSinkTask[]>(['aetherSinkTasks', userId, aetherSinkSortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      queryClient.setQueryData<AetherSinkTask[]>(['aetherSinkTasks', userId, aetherSinkSortBy], (old) =>
        (old || []).map(task =>
          task.id === taskId ? { ...task, is_completed: isCompleted } : task
        )
      );
      return { previousAetherSinkTasks, previousScrollTop };
    },
    onSettled: (updatedTask, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['aetherSinkTasks', userId, aetherSinkSortBy] });
      queryClient.invalidateQueries({ queryKey: ['completedTasksForSelectedDayList', userId, formattedSelectedDate] });
      showSuccess(`AetherSink task "${updatedTask?.name}" marked as ${updatedTask?.is_completed ? 'completed' : 'incomplete'}.`);
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (err, { taskId, isCompleted }, context) => {
      showError(`Failed to update AetherSink task status: ${err.message}`);
      if (context?.previousAetherSinkTasks) {
        queryClient.setQueryData<AetherSinkTask[]>(['aetherSinkTasks', userId, aetherSinkSortBy], context.previousAetherSinkTasks);
      }
    }
  });

  const updateScheduledTaskDetailsMutation = useMutation({
    mutationFn: async (task: Partial<DBScheduledTask> & { id: string; originalSourceTable: 'FixedAppointments' | 'CurrentSchedule' }) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log(`useSchedulerTasks: Attempting to update scheduled task details in ${task.originalSourceTable}:`, task);
      const { data, error } = await supabase
        .from(task.originalSourceTable)
        .update({ ...task, updated_at: new Date().toISOString() })
        .eq('id', task.id)
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) {
        console.error(`useSchedulerTasks: Error updating scheduled task details in ${task.originalSourceTable}:`, error.message);
        throw new Error(error.message);
      }
      console.log(`useSchedulerTasks: Successfully updated scheduled task details in ${task.originalSourceTable}:`, data);
      return data as DBScheduledTask;
    },
    onMutate: async (updatedTask) => {
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

  const updateAetherSinkTaskDetailsMutation = useMutation({
    mutationFn: async (task: Partial<AetherSinkTask> & { id: string }) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("useSchedulerTasks: Attempting to update AetherSink task details:", task);
      const { data, error } = await supabase
        .from('AetherSink')
        .update({ ...task, retired_at: new Date().toISOString() })
        .eq('id', task.id)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) {
        console.error("useSchedulerTasks: Error updating AetherSink task details:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully updated AetherSink task details:", data);
      return data as AetherSinkTask;
    },
    onMutate: async (updatedTask) => {
      await queryClient.cancelQueries({ queryKey: ['aetherSinkTasks', userId, aetherSinkSortBy] });
      const previousAetherSinkTasks = queryClient.getQueryData<AetherSinkTask[]>(['aetherSinkTasks', userId, aetherSinkSortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      queryClient.setQueryData<AetherSinkTask[]>(['aetherSinkTasks', userId, aetherSinkSortBy], (old) =>
        (old || []).map(task =>
          task.id === updatedTask.id ? { ...task, ...updatedTask } : task
        )
      );
      return { previousAetherSinkTasks, previousScrollTop };
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['aetherSinkTasks', userId, aetherSinkSortBy] });
      showSuccess('AetherSink task details updated!');
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (e, _variables, context) => {
      showError(`Failed to update AetherSink task details: ${e.message}`);
      if (context?.previousAetherSinkTasks) {
        queryClient.setQueryData<AetherSinkTask[]>(['aetherSinkTasks', userId, aetherSinkSortBy], context.previousAetherSinkTasks);
      }
    }
  });

  const clearXpGainAnimation = useCallback(() => {
    setXpGainAnimation(null);
  }, []);


  return {
    dbScheduledTasks,
    isLoading,
    datesWithTasks,
    isLoadingDatesWithTasks,
    aetherSinkTasks,
    isLoadingAetherSinkTasks,
    completedTasksForSelectedDayList,
    isLoadingCompletedTasksForSelectedDay,
    addScheduledTask: addScheduledTaskMutation.mutate,
    addAetherSinkTask: addAetherSinkTaskMutation.mutate,
    removeScheduledTask: removeScheduledTaskMutation.mutate,
    clearScheduledTasks: clearScheduledTasksMutation.mutate,
    retireTask: retireTaskMutation.mutate,
    rezoneTask: rezoneTaskMutation.mutateAsync,
    compactScheduledTasks: compactScheduledTasksMutation.mutate,
    randomizeBreaks: randomizeBreaksMutation.mutate,
    toggleScheduledTaskLock: toggleScheduledTaskLockMutation.mutate,
    toggleAetherSinkTaskLock: toggleAetherSinkTaskLockMutation.mutate,
    aetherDump: aetherDumpMutation.mutate,
    aetherDumpMega: aetherDumpMegaMutation.mutate,
    autoBalanceSchedule: autoBalanceScheduleMutation.mutate,
    completeScheduledTask: completeScheduledTaskMutation.mutate,
    completeAetherSinkTask: completeAetherSinkTaskMutation.mutate,
    updateScheduledTaskStatus: updateScheduledTaskStatusMutation.mutate,
    updateAetherSinkTaskStatus: updateAetherSinkTaskStatusMutation.mutate,
    updateScheduledTaskDetails: updateScheduledTaskDetailsMutation.mutate,
    updateAetherSinkTaskDetails: updateAetherSinkTaskDetailsMutation.mutate,
    sortBy,
    setSortBy,
    aetherSinkSortBy,
    setAetherSinkSortBy,
    xpGainAnimation,
    clearXpGainAnimation,
  };
};