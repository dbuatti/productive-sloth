import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DBScheduledTask, NewDBScheduledTask, RetiredTask, NewRetiredTask, SortBy, TimeBlock, AutoBalancePayload, UnifiedTask, RetiredTaskSortBy, CompletedTaskLogEntry, TaskEnvironment } from '@/types/scheduler';
import { useSession } from './use-session';
import { showSuccess, showError } from '@/utils/toast';
import { startOfDay, parseISO, format, addMinutes, isBefore, addDays, differenceInMinutes, addHours, isSameDay, max, min } from 'date-fns';
import { mergeOverlappingTimeBlocks, findFirstAvailableSlot, getEmojiHue, setTimeOnDate } from '@/lib/scheduler-utils';

export const useSchedulerTasks = (selectedDate: string, scrollRef?: React.RefObject<HTMLElement>) => {
  const queryClient = useQueryClient();
  const { user, profile, session } = useSession();
  const userId = user?.id;

  const formattedSelectedDate = selectedDate;
  const todayString = format(new Date(), 'yyyy-MM-dd');
  const isSelectedDayToday = selectedDate === todayString;

  const [sortBy, setSortBy] = useState<SortBy>(() => {
    if (typeof window !== 'undefined') {
      const savedSortBy = localStorage.getItem('aetherflow-scheduler-sort');
      if (!savedSortBy || savedSortBy === 'PRIORITY_HIGH_TO_LOW') return 'ENVIRONMENT_RATIO';
      return savedSortBy as SortBy;
    }
    return 'ENVIRONMENT_RATIO';
  });
  
  const [retiredSortBy, setRetiredSortBy] = useState<RetiredTaskSortBy>(() => {
    if (typeof window !== 'undefined') {
      const savedSortBy = localStorage.getItem('aetherSinkSortBy');
      return savedSortBy ? (savedSortBy as RetiredTaskSortBy) : 'RETIRED_AT_NEWEST';
    }
    return 'RETIRED_AT_NEWEST';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('aetherSinkSortBy', retiredSortBy);
    }
  }, [retiredSortBy]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('aetherflow-scheduler-sort', sortBy);
    }
  }, [sortBy]);

  const { data: dbScheduledTasks = [], isLoading } = useQuery<DBScheduledTask[]>({
    queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy],
    queryFn: async () => {
      if (!userId || !formattedSelectedDate) return [];
      
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
      } else if (sortBy === 'NAME_ASC') {
        query = query.order('name', { ascending: true });
      } else if (sortBy === 'NAME_DESC') {
        query = query.order('name', { ascending: false });
      } else {
        query = query.order('created_at', { ascending: true });
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      
      if (sortBy === 'EMOJI') {
        return (data as DBScheduledTask[]).sort((a, b) => getEmojiHue(a.name) - getEmojiHue(b.name));
      }

      return data as DBScheduledTask[];
    },
    enabled: !!userId && !!formattedSelectedDate,
  });

  const { data: completedTasksForSelectedDayList = [], isLoading: isLoadingCompletedTasksForSelectedDay } = useQuery<CompletedTaskLogEntry[]>({
    queryKey: ['completedTasksForSelectedDay', userId, formattedSelectedDate],
    queryFn: async () => {
      if (!userId || !formattedSelectedDate) return [];
      const { data, error } = await supabase
        .from('completedtasks')
        .select('*')
        .eq('user_id', userId)
        .eq('original_scheduled_date', formattedSelectedDate);
      
      if (error) throw error;
      
      return (data || []).map(task => ({
        ...task,
        effective_duration_minutes: task.duration_used || task.duration_scheduled || 30,
        name: task.task_name,
        original_source: task.original_source || 'scheduled_tasks'
      })) as CompletedTaskLogEntry[];
    },
    enabled: !!userId && !!formattedSelectedDate,
  });

  const { data: datesWithTasks = [], isLoading: isLoadingDatesWithTasks } = useQuery<string[]>({
    queryKey: ['datesWithTasks', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase.from('scheduled_tasks').select('scheduled_date').eq('user_id', userId);
      if (error) throw new Error(error.message);
      return Array.from(new Set(data.map(item => format(parseISO(item.scheduled_date), 'yyyy-MM-dd'))));
    },
    enabled: !!userId,
  });

  const { data: retiredTasks = [], isLoading: isLoadingRetiredTasks } = useQuery<RetiredTask[]>({
    queryKey: ['retiredTasks', userId, retiredSortBy],
    queryFn: async () => {
      if (!userId) return [];
      let query = supabase.from('aethersink').select('*').eq('user_id', userId);

      switch (retiredSortBy) {
        case 'NAME_ASC': query = query.order('name', { ascending: true }); break;
        case 'NAME_DESC': query = query.order('name', { ascending: false }); break;
        case 'DURATION_ASC': query = query.order('duration', { ascending: true, nullsFirst: true }); break;
        case 'DURATION_DESC': query = query.order('duration', { ascending: false }); break;
        case 'ENERGY_ASC': query = query.order('energy_cost', { ascending: true }); break;
        case 'ENERGY_ASC': query = query.order('energy_cost', { ascending: true }); break;
        case 'ENERGY_DESC': query = query.order('energy_cost', { ascending: false }); break;
        case 'RETIRED_AT_OLDEST': query = query.order('retired_at', { ascending: true }); break;
        case 'RETIRED_AT_NEWEST': default: query = query.order('retired_at', { ascending: false }); break;
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      
      if (retiredSortBy === 'EMOJI') {
        return (data as RetiredTask[]).sort((a, b) => getEmojiHue(a.name) - getEmojiHue(b.name));
      }
      return data as RetiredTask[];
    },
    enabled: !!userId,
  });

  // --- MUTATIONS ---

  const addScheduledTaskMutation = useMutation({
    mutationFn: async (newTask: NewDBScheduledTask) => {
      if (!userId) throw new Error("User not authenticated.");
      const taskToInsert = { ...newTask, user_id: userId, energy_cost: newTask.energy_cost ?? 0, is_completed: newTask.is_completed ?? false, is_custom_energy_cost: newTask.is_custom_energy_cost ?? false, task_environment: newTask.task_environment ?? 'laptop', source_calendar_id: newTask.source_calendar_id ?? null, is_backburner: newTask.is_backburner ?? false, is_work: newTask.is_work ?? false, is_break: newTask.is_break ?? false };
      const { data, error } = await supabase.from('scheduled_tasks').insert(taskToInsert).select().single();
      if (error) throw new Error(error.message);
      return data as DBScheduledTask;
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks'] });
      if (isSelectedDayToday || variables.scheduled_date === todayString) {
        queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday'] });
      }
      showSuccess('Task added to schedule!');
    }
  });

  const addRetiredTaskMutation = useMutation({
    mutationFn: async (newTask: NewRetiredTask) => {
      if (!userId) throw new Error("User not authenticated.");
      const taskToInsert = { ...newTask, user_id: userId, retired_at: new Date().toISOString(), energy_cost: newTask.energy_cost ?? 0, is_completed: newTask.is_completed ?? false, is_custom_energy_cost: newTask.is_custom_energy_cost ?? false, task_environment: newTask.task_environment ?? 'laptop', is_backburner: newTask.is_backburner ?? false, is_work: newTask.is_work ?? false, is_break: newTask.is_break ?? false };
      const { data, error } = await supabase.from('aethersink').insert(taskToInsert).select().single();
      if (error) throw new Error(error.message);
      return data as RetiredTask;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday'] });
      showSuccess('Task sent directly to Aether Sink!');
    }
  });

  const removeScheduledTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      if (!userId) throw new Error("User not authenticated.");
      const { data: taskToDelete, error: fetchError } = await supabase.from('scheduled_tasks').select('scheduled_date').eq('id', taskId).eq('user_id', userId).single();
      if (fetchError) throw new Error(fetchError.message);
      const { error } = await supabase.from('scheduled_tasks').delete().eq('id', taskId).eq('user_id', userId);
      if (error) throw new Error(error.message);
      return taskToDelete;
    },
    onSettled: (data) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks'] });
      if (data && data.scheduled_date === todayString) {
        queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday'] });
      }
    }
  });

  const updateScheduledTaskDetailsMutation = useMutation({
    mutationFn: async (task: Partial<DBScheduledTask> & { id: string }) => {
      const { data, error } = await supabase
        .from('scheduled_tasks')
        .update({ ...task, updated_at: new Date().toISOString() })
        .eq('id', task.id)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      if (isSelectedDayToday) queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday'] });
    }
  });

  const completeScheduledTaskMutation = useMutation({
    mutationFn: async (task: DBScheduledTask) => {
      if (!userId) throw new Error("User not authenticated.");
      
      const duration = task.start_time && task.end_time 
        ? differenceInMinutes(parseISO(task.end_time), parseISO(task.start_time)) 
        : 30;

      const { error: logError } = await supabase.from('completedtasks').insert({
        user_id: userId,
        task_name: task.name,
        original_id: task.id,
        duration_scheduled: duration,
        duration_used: duration,
        xp_earned: (task.energy_cost || 0) * 2,
        energy_cost: task.energy_cost,
        is_critical: task.is_critical,
        original_source: 'scheduled_tasks',
        original_scheduled_date: task.scheduled_date,
        is_work: task.is_work
      });
      if (logError) throw logError;

      const { error: deleteError } = await supabase.from('scheduled_tasks').delete().eq('id', task.id);
      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['completedTasksTodayFromRpc'] });
      queryClient.invalidateQueries({ queryKey: ['completedTasksForSelectedDay'] });
    }
  });

  const toggleScheduledTaskLockMutation = useMutation({
    mutationFn: async ({ taskId, isLocked }: { taskId: string; isLocked: boolean }) => {
      const { error } = await supabase.from('scheduled_tasks').update({ is_locked: isLocked }).eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] })
  });

  const toggleAllScheduledTasksLockMutation = useMutation({
    mutationFn: async ({ selectedDate, lockState }: { selectedDate: string; lockState: boolean }) => {
      if (!userId) throw new Error("User not authenticated.");
      const { error } = await supabase.from('scheduled_tasks').update({ is_locked: lockState, updated_at: new Date().toISOString() }).eq('user_id', userId).eq('scheduled_date', selectedDate);
      if (error) throw new Error(error.message);
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, variables.selectedDate] });
      if (variables.selectedDate === todayString) queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', userId] });
      showSuccess(variables.lockState ? 'Day locked down!' : 'Day unlocked!');
    }
  });

  const clearScheduledTasksMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("User not authenticated.");
      const { error } = await supabase.from('scheduled_tasks').delete().eq('user_id', userId).eq('scheduled_date', formattedSelectedDate).eq('is_locked', false);
      if (error) throw new Error(error.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks'] });
      if (isSelectedDayToday) queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday'] });
      showSuccess('Schedule cleared.');
    }
  });

  const removeRetiredTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      if (!userId) throw new Error("User not authenticated.");
      const { error } = await supabase.from('aethersink').delete().eq('id', taskId).eq('user_id', userId);
      if (error) throw new Error(error.message);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['retiredTasks'] })
  });

  const updateRetiredTaskDetailsMutation = useMutation({
    mutationFn: async (task: Partial<RetiredTask> & { id: string }) => {
      const { data, error } = await supabase
        .from('aethersink')
        .update({ ...task })
        .eq('id', task.id)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['retiredTasks'] })
  });

  const updateRetiredTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, isCompleted }: { taskId: string; isCompleted: boolean }) => {
      const { error } = await supabase.from('aethersink').update({ is_completed: isCompleted }).eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['retiredTasks'] })
  });

  const completeRetiredTaskMutation = useMutation({
    mutationFn: async (task: RetiredTask) => {
      const { error: logError } = await supabase.from('completedtasks').insert({
        user_id: userId,
        task_name: task.name,
        original_id: task.id,
        duration_scheduled: task.duration,
        duration_used: task.duration,
        xp_earned: (task.energy_cost || 0) * 2,
        energy_cost: task.energy_cost,
        is_critical: task.is_critical,
        original_source: 'aethersink',
        original_scheduled_date: task.original_scheduled_date,
        is_work: task.is_work
      });
      if (logError) throw logError;
      await supabase.from('aethersink').delete().eq('id', task.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
      queryClient.invalidateQueries({ queryKey: ['completedTasksForSelectedDay'] });
    }
  });

  const toggleRetiredTaskLockMutation = useMutation({
    mutationFn: async ({ taskId, isLocked }: { taskId: string; isLocked: boolean }) => {
      const { error } = await supabase.from('aethersink').update({ is_locked: isLocked }).eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['retiredTasks'] })
  });

  const aetherDumpMutation = useMutation({
    mutationFn: async () => {
      const { data: flexibleTasks } = await supabase.from('scheduled_tasks').select('*').eq('user_id', userId).eq('scheduled_date', formattedSelectedDate).eq('is_flexible', true).eq('is_locked', false);
      if (!flexibleTasks || flexibleTasks.length === 0) return;

      const retiredToInsert = flexibleTasks.map(t => ({
        user_id: userId, name: t.name, duration: differenceInMinutes(parseISO(t.end_time!), parseISO(t.start_time!)),
        break_duration: t.break_duration, original_scheduled_date: t.scheduled_date, is_critical: t.is_critical,
        energy_cost: t.energy_cost, task_environment: t.task_environment, is_work: t.is_work
      }));

      await supabase.from('aethersink').insert(retiredToInsert);
      await supabase.from('scheduled_tasks').delete().in('id', flexibleTasks.map(t => t.id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
    }
  });

  const aetherDumpMegaMutation = useMutation({
    mutationFn: async () => {
      const { data: flexibleTasks } = await supabase.from('scheduled_tasks').select('*').eq('user_id', userId).gte('scheduled_date', todayString).eq('is_flexible', true).eq('is_locked', false);
      if (!flexibleTasks || flexibleTasks.length === 0) return;

      const retiredToInsert = flexibleTasks.map(t => ({
        user_id: userId, name: t.name, duration: differenceInMinutes(parseISO(t.end_time!), parseISO(t.start_time!)),
        break_duration: t.break_duration, original_scheduled_date: t.scheduled_date, is_critical: t.is_critical,
        energy_cost: t.energy_cost, task_environment: t.task_environment, is_work: t.is_work
      }));

      await supabase.from('aethersink').insert(retiredToInsert);
      await supabase.from('scheduled_tasks').delete().in('id', flexibleTasks.map(t => t.id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
    }
  });

  const triggerAetherSinkBackupMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('backup_aethersink_for_user', { p_user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => showSuccess("Backup completed!")
  });

  const retireTaskMutation = useMutation({
    mutationFn: async (taskToRetire: DBScheduledTask) => {
      if (!userId) throw new Error("User not authenticated.");
      const newRetiredTask: NewRetiredTask = { user_id: userId, name: taskToRetire.name, duration: taskToRetire.start_time && taskToRetire.end_time ? differenceInMinutes(parseISO(taskToRetire.end_time), parseISO(taskToRetire.start_time)) : 30, break_duration: taskToRetire.break_duration, original_scheduled_date: taskToRetire.scheduled_date, is_critical: taskToRetire.is_critical, is_locked: taskToRetire.is_locked, energy_cost: taskToRetire.energy_cost ?? 0, is_completed: taskToRetire.is_completed ?? false, is_custom_energy_cost: taskToRetire.is_custom_energy_cost ?? false, task_environment: taskToRetire.task_environment, is_backburner: taskToRetire.is_backburner, is_work: taskToRetire.is_work || false, is_break: taskToRetire.is_break || false };
      await supabase.from('aethersink').insert(newRetiredTask);
      await supabase.from('scheduled_tasks').delete().eq('id', taskToRetire.id).eq('user_id', userId);
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks'] });
      if (variables.scheduled_date === todayString) queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday'] });
      showSuccess('Task moved to Aether Sink.');
    }
  });

  const rezoneTaskMutation = useMutation({
    mutationFn: async (task: RetiredTask) => {
      if (!userId || !profile) throw new Error("User context missing.");
      const effectiveSelectedDate = formattedSelectedDate || format(new Date(), 'yyyy-MM-dd');
      const targetDateAsDate = parseISO(effectiveSelectedDate);
      const targetWorkdayStart = profile.default_auto_schedule_start_time ? setTimeOnDate(targetDateAsDate, profile.default_auto_schedule_start_time) : startOfDay(targetDateAsDate);
      let targetWorkdayEnd = profile.default_auto_schedule_end_time ? setTimeOnDate(startOfDay(targetDateAsDate), profile.default_auto_schedule_end_time) : addHours(startOfDay(targetDateAsDate), 17);
      if (isBefore(targetWorkdayEnd, targetWorkdayStart)) targetWorkdayEnd = addDays(targetWorkdayEnd, 1);
      
      const T_current = new Date();
      const isTodaySelected = isSameDay(targetDateAsDate, T_current);
      const effectiveStart = (isTodaySelected && isBefore(targetWorkdayStart, T_current)) ? T_current : targetWorkdayStart;

      const scheduledFixedBlocks: TimeBlock[] = dbScheduledTasks.filter(t => t.start_time && t.end_time).map(t => {
        const start = setTimeOnDate(targetDateAsDate, format(parseISO(t.start_time!), 'HH:mm'));
        let end = setTimeOnDate(targetDateAsDate, format(parseISO(t.end_time!), 'HH:mm'));
        if (isBefore(end, start)) end = addDays(end, 1);
        return { start, end, duration: differenceInMinutes(end, start) };
      });

      const taskTotalDuration = (task.duration || 30) + (task.break_duration || 0);
      const slot = findFirstAvailableSlot(taskTotalDuration, mergeOverlappingTimeBlocks(scheduledFixedBlocks), effectiveStart, targetWorkdayEnd);

      if (!slot) throw new Error("No free slot available in the schedule window.");

      const { error: insertError } = await supabase.from('scheduled_tasks').insert({
        user_id: userId, name: task.name, start_time: slot.start.toISOString(), end_time: slot.end.toISOString(), break_duration: task.break_duration, scheduled_date: effectiveSelectedDate, is_critical: task.is_critical, is_flexible: true, is_locked: false, energy_cost: task.energy_cost, is_completed: task.is_completed, is_custom_energy_cost: task.is_custom_energy_cost, task_environment: task.task_environment, is_backburner: task.is_backburner, is_work: task.is_work || false, is_break: task.is_break || false
      });
      if (insertError) throw new Error(insertError.message);
      await supabase.from('aethersink').delete().eq('id', task.id).eq('user_id', userId);
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks'] });
      if (variables.original_scheduled_date === todayString) queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday'] });
      showSuccess("Objective rezoned successfully!");
    }
  });

  const compactScheduledTasksMutation = useMutation({
    mutationFn: async ({ tasksToUpdate }: { tasksToUpdate: DBScheduledTask[] }) => {
      if (!userId) throw new Error("User not authenticated.");
      const updates = tasksToUpdate.map(task => ({ ...task, user_id: userId, updated_at: new Date().toISOString() }));
      const { error } = await supabase.from('scheduled_tasks').upsert(updates, { onConflict: 'id' });
      if (error) throw new Error(error.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      if (isSelectedDayToday) queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday'] });
    }
  });

  const randomizeBreaksMutation = useMutation({
    mutationFn: async ({ selectedDate, workdayStartTime, workdayEndTime, currentDbTasks }: { selectedDate: string, workdayStartTime: Date, workdayEndTime: Date, currentDbTasks: DBScheduledTask[] }) => {
      const unlockedBreaks = currentDbTasks.filter(t => t.name.toLowerCase() === 'break' && !t.is_locked);
      if (unlockedBreaks.length === 0) return;
      
      const fixedBlocks = currentDbTasks.filter(t => t.name.toLowerCase() !== 'break' || t.is_locked).map(t => ({
        start: parseISO(t.start_time!),
        end: parseISO(t.end_time!),
        duration: differenceInMinutes(parseISO(t.end_time!), parseISO(t.start_time!))
      }));

      const randomizedUpdates = unlockedBreaks.map(t => {
        const duration = differenceInMinutes(parseISO(t.end_time!), parseISO(t.start_time!));
        const slot = findFirstAvailableSlot(duration, mergeOverlappingTimeBlocks(fixedBlocks), workdayStartTime, workdayEndTime);
        if (slot) {
          fixedBlocks.push({ start: slot.start, end: slot.end, duration });
          return { ...t, start_time: slot.start.toISOString(), end_time: slot.end.toISOString() };
        }
        return t;
      });

      await supabase.from('scheduled_tasks').upsert(randomizedUpdates);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] })
  });

  const autoBalanceScheduleMutation = useMutation< { tasksPlaced: number; tasksKeptInSink: number }, Error, AutoBalancePayload >({
    mutationFn: async (payload: AutoBalancePayload) => {
      if (!userId || !session?.access_token) throw new Error("Authentication required.");
      const { data, error } = await supabase.functions.invoke('auto-balance-schedule', { body: payload, headers: { 'Authorization': `Bearer ${session.access_token}` } });
      if (error) throw new Error(error.message);
      if (data && data.error) throw new Error(data.error);
      return data;
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks'] });
      if (variables.selectedDate === todayString) queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday'] });
      if (data) showSuccess(`Balanced: ${data.tasksPlaced} items placed.`);
    }
  });

  const handleAutoScheduleAndSort = useCallback(async (
    sortPreference: SortBy,
    taskSource: 'all-flexible' | 'sink-only' | 'sink-to-gaps' | 'global-all-future',
    environmentsToFilterBy: TaskEnvironment[] = [],
    targetDateString: string,
    futureDaysToSchedule: number = 30
  ) => {
    if (!user || !profile) return showError("Profile context missing.");

    const initialTargetDayAsDate = parseISO(targetDateString);
    if (isBefore(initialTargetDayAsDate, startOfDay(new Date())) && taskSource !== 'global-all-future') {
      return showError("Historical timelines are read-only.");
    }

    try {
      let globalTasksToPlace: UnifiedTask[] = [];
      let globalScheduledIdsToDelete: string[] = [];
      let globalRetiredIdsToDelete: string[] = [];
      let globalTasksToInsert: NewDBScheduledTask[] = [];
      let globalTasksToKeepInSink: NewRetiredTask[] = [];

      if (taskSource === 'global-all-future') {
        const { data: futureScheduled } = await supabase.from('scheduled_tasks').select('*').eq('user_id', user.id).gte('scheduled_date', todayString).eq('is_flexible', true).eq('is_locked', false);
        const { data: allRetired } = await supabase.from('aethersink').select('*').eq('user_id', user.id).eq('is_locked', false);
        
        (futureScheduled || []).forEach(t => {
          globalTasksToPlace.push({ id: t.id, name: t.name, duration: t.start_time && t.end_time ? differenceInMinutes(parseISO(t.end_time), parseISO(t.start_time)) : 30, break_duration: t.break_duration, is_critical: t.is_critical, is_flexible: true, is_backburner: t.is_backburner, energy_cost: t.energy_cost, source: 'scheduled', originalId: t.id, is_custom_energy_cost: t.is_custom_energy_cost, created_at: t.created_at, task_environment: t.task_environment, is_work: t.is_work || false, is_break: t.is_break || false });
          globalScheduledIdsToDelete.push(t.id);
        });
        (allRetired || []).forEach(t => {
          globalTasksToPlace.push({ id: t.id, name: t.name, duration: t.duration || 30, break_duration: t.break_duration, is_critical: t.is_critical, is_flexible: true, is_backburner: t.is_backburner, energy_cost: t.energy_cost, source: 'retired', originalId: t.id, is_custom_energy_cost: t.is_custom_energy_cost, created_at: t.retired_at, task_environment: t.task_environment, is_work: t.is_work || false, is_break: t.is_break || false });
          globalRetiredIdsToDelete.push(t.id);
        });
      }

      const daysToProcess = taskSource === 'global-all-future' ? Array.from({ length: futureDaysToSchedule }).map((_, i) => format(addDays(startOfDay(new Date()), i), 'yyyy-MM-dd')) : [targetDateString];

      for (const currentDateString of daysToProcess) {
        const currentDayAsDate = parseISO(currentDateString);
        if (profile.blocked_days?.includes(currentDateString)) continue;

        const workdayStart = profile.default_auto_schedule_start_time ? setTimeOnDate(currentDayAsDate, profile.default_auto_schedule_start_time) : startOfDay(currentDayAsDate);
        let workdayEnd = profile.default_auto_schedule_end_time ? setTimeOnDate(startOfDay(currentDayAsDate), profile.default_auto_schedule_end_time) : addHours(startOfDay(currentDayAsDate), 17);
        if (isBefore(workdayEnd, workdayStart)) workdayEnd = addDays(workdayEnd, 1);
        
        const T_current = new Date();
        const effectiveStart = (isSameDay(currentDayAsDate, T_current) && isBefore(workdayStart, T_current)) ? T_current : workdayStart;

        const { data: dbTasksForDay } = await supabase.from('scheduled_tasks').select('*').eq('user_id', user.id).eq('scheduled_date', currentDateString);
        
        const fixedBlocks: TimeBlock[] = (dbTasksForDay || []).filter(t => (taskSource === 'sink-to-gaps' || !t.is_flexible || t.is_locked)).filter(t => t.start_time && t.end_time).map(t => {
          const start = setTimeOnDate(currentDayAsDate, format(parseISO(t.start_time!), 'HH:mm'));
          let end = setTimeOnDate(currentDayAsDate, format(parseISO(t.end_time!), 'HH:mm'));
          if (isBefore(end, start)) end = addDays(end, 1);
          return { start, end, duration: differenceInMinutes(end, start) };
        });

        let currentOccupied = mergeOverlappingTimeBlocks(fixedBlocks);
        let tasksToConsiderForDay: UnifiedTask[] = [];
        
        if (taskSource === 'global-all-future') {
          tasksToConsiderForDay = [...globalTasksToPlace];
        } else {
          const flexibleScheduled = (dbTasksForDay || []).filter(t => t.is_flexible && !t.is_locked);
          const unlockedRetired = retiredTasks.filter(t => !t.is_locked);
          flexibleScheduled.forEach(t => {
            tasksToConsiderForDay.push({ id: t.id, name: t.name, duration: t.start_time && t.end_time ? differenceInMinutes(parseISO(t.end_time), parseISO(t.start_time)) : 30, break_duration: t.break_duration, is_critical: t.is_critical, is_flexible: true, is_backburner: t.is_backburner, energy_cost: t.energy_cost, source: 'scheduled', originalId: t.id, is_custom_energy_cost: t.is_custom_energy_cost, created_at: t.created_at, task_environment: t.task_environment, is_work: t.is_work || false, is_break: t.is_break || false });
            globalScheduledIdsToDelete.push(t.id);
          });
          unlockedRetired.forEach(t => {
            tasksToConsiderForDay.push({ id: t.id, name: t.name, duration: t.duration || 30, break_duration: t.break_duration, is_critical: t.is_critical, is_flexible: true, is_backburner: t.is_backburner, energy_cost: t.energy_cost, source: 'retired', originalId: t.id, is_custom_energy_cost: t.is_custom_energy_cost, created_at: t.retired_at, task_environment: t.task_environment, is_work: t.is_work || false, is_break: t.is_break || false });
            globalRetiredIdsToDelete.push(t.id);
          });
        }

        const filteredPool = tasksToConsiderForDay.filter(t => environmentsToFilterBy.length === 0 || environmentsToFilterBy.includes(t.task_environment)).sort((a, b) => {
          if (a.is_critical && !b.is_critical) return -1;
          if (!a.is_critical && b.is_critical) return 1;
          if (a.is_backburner && !b.is_backburner) return 1;
          if (!a.is_backburner && b.is_backburner) return -1;
          if (a.is_break && !b.is_break) return -1;
          if (!a.is_break && b.is_break) return 1;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });

        let placementCursor = effectiveStart;
        const tasksRemainingForDay: UnifiedTask[] = [];

        for (const t of filteredPool) {
          const taskTotal = (t.duration || 30) + (t.break_duration || 0);
          const slot = findFirstAvailableSlot(taskTotal, currentOccupied, placementCursor, workdayEnd);

          if (slot) {
            globalTasksToInsert.push({ 
              id: t.source === 'retired' ? undefined : t.originalId, name: t.name, start_time: slot.start.toISOString(), end_time: slot.end.toISOString(), 
              break_duration: t.break_duration, scheduled_date: currentDateString, is_critical: t.is_critical, is_flexible: true, is_locked: false, 
              energy_cost: t.energy_cost, is_completed: false, is_custom_energy_cost: t.is_custom_energy_cost, task_environment: t.task_environment, 
              is_backburner: t.is_backburner, is_work: t.is_work, is_break: t.is_break 
            });
            currentOccupied.push({ start: slot.start, end: slot.end, duration: taskTotal });
            currentOccupied = mergeOverlappingTimeBlocks(currentOccupied);
            placementCursor = slot.end;
          } else {
            tasksRemainingForDay.push(t);
          }
        }

        if (taskSource === 'global-all-future') {
          globalTasksToPlace.length = 0;
          globalTasksToPlace.push(...tasksRemainingForDay);
        } else {
          tasksRemainingForDay.forEach(t => globalTasksToKeepInSink.push({ user_id: user.id, name: t.name, duration: t.duration, break_duration: t.break_duration, original_scheduled_date: currentDateString, is_critical: t.is_critical, is_locked: false, energy_cost: t.energy_cost, is_completed: false, is_custom_energy_cost: t.is_custom_energy_cost, task_environment: t.task_environment, is_backburner: t.is_backburner, is_work: t.is_work, is_break: t.is_break }));
        }
      }

      if (taskSource === 'global-all-future' && globalTasksToPlace.length > 0) {
        globalTasksToPlace.forEach(t => globalTasksToKeepInSink.push({ user_id: user.id, name: t.name, duration: t.duration, break_duration: t.break_duration, original_scheduled_date: targetDateString, is_critical: t.is_critical, is_locked: false, energy_cost: t.energy_cost, is_completed: false, is_custom_energy_cost: t.is_custom_energy_cost, task_environment: t.task_environment, is_backburner: t.is_backburner, is_work: t.is_work, is_break: t.is_break }));
      }

      await autoBalanceScheduleMutation.mutateAsync({ 
        scheduledTaskIdsToDelete: Array.from(new Set(globalScheduledIdsToDelete)), 
        retiredTaskIdsToDelete: Array.from(new Set(globalRetiredIdsToDelete)), 
        tasksToInsert: globalTasksToInsert, tasksToKeepInSink: globalTasksToKeepInSink, selectedDate: targetDateString 
      });

    } catch (e: any) {
      showError(`Engine Error: ${e.message}`);
    }
  }, [user, profile, retiredTasks, autoBalanceScheduleMutation, dbScheduledTasks, todayString]);

  return {
    dbScheduledTasks, dbScheduledTasksWithMeals: dbScheduledTasks, isLoading, addScheduledTask: addScheduledTaskMutation.mutateAsync, addRetiredTask: addRetiredTaskMutation.mutateAsync,
    removeScheduledTask: removeScheduledTaskMutation.mutateAsync, clearScheduledTasks: clearScheduledTasksMutation.mutateAsync, datesWithTasks, isLoadingDatesWithTasks,
    retiredTasks, isLoadingRetiredTasks, completedTasksForSelectedDayList, isLoadingCompletedTasksForSelectedDay, retireTask: retireTaskMutation.mutateAsync,
    rezoneTask: rezoneTaskMutation.mutateAsync, compactScheduledTasks: compactScheduledTasksMutation.mutateAsync,
    toggleScheduledTaskLock: toggleScheduledTaskLockMutation.mutateAsync, toggleAllScheduledTasksLock: toggleAllScheduledTasksLockMutation.mutateAsync,
    toggleRetiredTaskLock: toggleRetiredTaskLockMutation.mutateAsync, aetherDump: aetherDumpMutation.mutateAsync, aetherDumpMega: aetherDumpMegaMutation.mutateAsync,
    sortBy, setSortBy, retiredSortBy, setRetiredSortBy, updateScheduledTaskDetails: updateScheduledTaskDetailsMutation.mutateAsync,
    updateRetiredTaskDetails: updateRetiredTaskDetailsMutation.mutateAsync, updateRetiredTaskStatus: updateRetiredTaskStatusMutation.mutateAsync,
    completeScheduledTask: completeScheduledTaskMutation.mutateAsync, completeRetiredTask: completeRetiredTaskMutation.mutateAsync,
    removeRetiredTask: removeRetiredTaskMutation.mutateAsync, triggerAetherSinkBackup: triggerAetherSinkBackupMutation.mutateAsync, handleAutoScheduleAndSort,
    randomizeBreaks: randomizeBreaksMutation.mutateAsync
  };
};