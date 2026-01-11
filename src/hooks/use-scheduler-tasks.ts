import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DBScheduledTask, NewDBScheduledTask, RetiredTask, NewRetiredTask, SortBy, TimeBlock, AutoBalancePayload, UnifiedTask, CompletedTaskLogEntry, TaskEnvironment } from '@/types/scheduler';
import { useSession } from './use-session';
import { showSuccess, showError } from '@/utils/toast';
import { startOfDay, parseISO, format, addMinutes, isBefore, addDays, differenceInMinutes, addHours, isSameDay, max, min } from 'date-fns';
import { mergeOverlappingTimeBlocks, findFirstAvailableSlot, getEmojiHue, setTimeOnDate, getStaticConstraints, isMeal, sortAndChunkTasks } from '@/lib/scheduler-utils';

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
      if (error) showError(`Failed to add task: ${error.message}`);
      else showSuccess('Task added to schedule!');
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
    onSettled: (data, error) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks'] });
      if (data && data.scheduled_date === todayString) {
        queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday'] });
      }
      if (error) showError(`Failed to remove task: ${error.message}`);
      else showSuccess('Task removed from schedule.');
    }
  });

  const pullNextFromSinkMutation = useMutation({
    mutationFn: async ({ selectedDateString, workdayStart, workdayEnd, T_current, staticConstraints }: { selectedDateString: string, workdayStart: Date, workdayEnd: Date, T_current: Date, staticConstraints: TimeBlock[] }) => {
      if (!userId) throw new Error("User not authenticated.");
      
      const { data: nextTask, error: fetchError } = await supabase
        .from('aethersink')
        .select('*')
        .eq('user_id', userId)
        .eq('is_locked', false)
        .order('retired_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchError || !nextTask) throw new Error(fetchError?.message || "No unlocked tasks in Aether Sink.");

      const { data: currentTasks } = await supabase.from('scheduled_tasks').select('*').eq('user_id', userId).eq('scheduled_date', selectedDateString);
      const occupiedBlocks = (currentTasks || []).filter(t => t.start_time && t.end_time).map(t => ({
        start: parseISO(t.start_time!),
        end: parseISO(t.end_time!),
        duration: differenceInMinutes(parseISO(t.end_time!), parseISO(t.start_time!))
      }));

      const allConstraints = mergeOverlappingTimeBlocks([...occupiedBlocks, ...staticConstraints]);
      const duration = (nextTask.duration || 30) + (nextTask.break_duration || 0);
      const searchStart = isSameDay(parseISO(selectedDateString), new Date()) ? max([workdayStart, T_current]) : workdayStart;
      
      const slot = findFirstAvailableSlot(duration, allConstraints, searchStart, workdayEnd);
      if (!slot) throw new Error("No available slot found for this task today.");

      const { error: insertError } = await supabase.from('scheduled_tasks').insert({
        user_id: userId,
        name: nextTask.name,
        start_time: slot.start.toISOString(),
        end_time: slot.end.toISOString(),
        scheduled_date: selectedDateString,
        is_flexible: true,
        energy_cost: nextTask.energy_cost,
        task_environment: nextTask.task_environment,
        is_critical: nextTask.is_critical,
        is_backburner: nextTask.is_backburner,
        is_work: nextTask.is_work,
        is_break: nextTask.is_break
      });

      if (insertError) throw insertError;
      await supabase.from('aethersink').delete().eq('id', nextTask.id);
      
      return nextTask.name;
    },
    onSuccess: (name) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
      showSuccess(`"${name}" pulled from Aether Sink!`);
    },
    onError: (e) => showError(e.message)
  });

  const updateScheduledTaskDetailsMutation = useMutation({
    mutationFn: async (task: Partial<DBScheduledTask> & { id: string }) => {
      if (!userId) throw new Error("User not authenticated.");
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
      showSuccess('Scheduled task updated successfully!');
    },
    onError: (error) => {
      showError(`Failed to update scheduled task: ${error.message}`);
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
        is_work: task.is_work,
        is_break: task.is_break,
      });
      if (logError) throw logError;

      const { error: deleteError } = await supabase.from('scheduled_tasks').delete().eq('id', task.id);
      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['completedTasksTodayFromRpc'] });
      queryClient.invalidateQueries({ queryKey: ['completedTasksForSelectedDay'] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks'] });
      queryClient.invalidateQueries({ queryKey: ['weeklySchedulerTasks'] }); 
    },
    onError: (error) => {
      showError(`Failed to complete task: ${error.message}`);
    }
  });

  const toggleScheduledTaskLockMutation = useMutation({
    mutationFn: async ({ taskId, isLocked }: { taskId: string; isLocked: boolean }) => {
      if (!userId) throw new Error("User not authenticated.");
      const { error } = await supabase.from('scheduled_tasks').update({ is_locked: isLocked }).eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      if (isSelectedDayToday) queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday'] });
    },
    onError: (error) => {
      showError(`Failed to toggle task lock: ${error.message}`);
    }
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
      if (error) showError(`Failed to toggle day lock: ${error.message}`);
      else showSuccess(variables.lockState ? 'Day locked down!' : 'Day unlocked!');
    }
  });

  const clearScheduledTasksMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("User not authenticated.");
      const { error } = await supabase.from('scheduled_tasks').delete().eq('user_id', userId).eq('scheduled_date', formattedSelectedDate).eq('is_locked', false);
      if (error) throw new Error(error.message);
    },
    onSettled: (data, error) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks'] });
      if (isSelectedDayToday) queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday'] });
      if (error) showError(`Failed to clear schedule: ${error.message}`);
      else showSuccess('Schedule cleared.');
    }
  });

  const duplicateScheduledTask = useMutation({
    mutationFn: async (task: DBScheduledTask) => {
      if (!userId) throw new Error("User not authenticated.");
      const { id, created_at, updated_at, ...rest } = task;
      const { data, error } = await supabase
        .from('scheduled_tasks')
        .insert({ 
          ...rest, 
          name: `${task.name} (Copy)`,
          is_completed: false,
          is_locked: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as DBScheduledTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      showSuccess('Scheduled task duplicated!');
    },
    onError: (e) => {
      showError(`Failed to duplicate scheduled task: ${e.message}`);
    }
  });

  const moveTaskToTomorrow = useMutation({
    mutationFn: async (task: DBScheduledTask) => {
      if (!userId) throw new Error("User not authenticated.");
      const tomorrow = format(addDays(parseISO(task.scheduled_date), 1), 'yyyy-MM-dd');
      
      const { error } = await supabase
        .from('scheduled_tasks')
        .update({ 
          scheduled_date: tomorrow,
          start_time: null, // Reset times so it can be auto-scheduled on the new day
          end_time: null,
          is_locked: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', task.id)
        .eq('user_id', userId);
      
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks'] });
      showSuccess('Task moved to tomorrow!');
    },
    onError: (e) => {
      showError(`Failed to move task: ${e.message}`);
    }
  });

  const aetherDumpMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("User not authenticated.");
      const { data: flexibleTasks, error: fetchError } = await supabase.from('scheduled_tasks').select('*').eq('user_id', userId).eq('scheduled_date', formattedSelectedDate).eq('is_flexible', true).eq('is_locked', false);
      if (fetchError) throw fetchError;
      if (!flexibleTasks || flexibleTasks.length === 0) return;

      const retiredToInsert = flexibleTasks.map(t => ({
        user_id: userId, name: t.name, duration: t.start_time && t.end_time ? differenceInMinutes(parseISO(t.end_time!), parseISO(t.start_time!)) : 30,
        break_duration: t.break_duration, original_scheduled_date: t.scheduled_date, is_critical: t.is_critical,
        energy_cost: t.energy_cost, task_environment: t.task_environment, is_work: t.is_work, is_break: t.is_break
      }));

      const { error: insertError } = await supabase.from('aethersink').insert(retiredToInsert);
      if (insertError) throw insertError;
      const { error: deleteError } = await supabase.from('scheduled_tasks').delete().in('id', flexibleTasks.map(t => t.id));
      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks'] });
      if (isSelectedDayToday) queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday'] });
    },
    onError: (error) => {
      showError(`Failed to dump tasks: ${error.message}`);
    }
  });

  const aetherDumpMegaMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("User not authenticated.");
      const { data: flexibleTasks, error: fetchError } = await supabase.from('scheduled_tasks').select('*').eq('user_id', userId).gte('scheduled_date', todayString).eq('is_flexible', true).eq('is_locked', false);
      if (fetchError) throw fetchError;
      if (!flexibleTasks || flexibleTasks.length === 0) return;

      const retiredToInsert = flexibleTasks.map(t => ({
        user_id: userId, name: t.name, duration: t.start_time && t.end_time ? differenceInMinutes(parseISO(t.end_time!), parseISO(t.start_time!)) : 30,
        break_duration: t.break_duration, original_scheduled_date: t.scheduled_date, is_critical: t.is_critical,
        energy_cost: t.energy_cost, task_environment: t.task_environment, is_work: t.is_work, is_break: t.is_break
      }));

      const { error: insertError } = await supabase.from('aethersink').insert(retiredToInsert);
      if (insertError) throw insertError;
      const { error: deleteError = null } = await supabase.from('scheduled_tasks').delete().in('id', flexibleTasks.map(t => t.id));
      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks'] });
      queryClient.invalidateQueries({ queryKey: ['weeklySchedulerTasks'] }); 
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday'] }); 
    },
    onError: (error) => {
      showError(`Failed to perform global dump: ${error.message}`);
    }
  });

  const retireTaskMutation = useMutation({
    mutationFn: async (taskToRetire: DBScheduledTask) => {
      if (!userId) throw new Error("User not authenticated.");
      const newRetiredTask: NewRetiredTask = { 
        user_id: userId, 
        name: taskToRetire.name, 
        duration: taskToRetire.start_time && taskToRetire.end_time ? differenceInMinutes(parseISO(taskToRetire.end_time), parseISO(taskToRetire.start_time)) : 30, 
        break_duration: taskToRetire.break_duration, 
        original_scheduled_date: taskToRetire.scheduled_date, 
        is_critical: taskToRetire.is_critical, 
        is_locked: taskToRetire.is_locked, 
        energy_cost: taskToRetire.energy_cost ?? 0, 
        is_completed: taskToRetire.is_completed ?? false, 
        is_custom_energy_cost: taskToRetire.is_custom_energy_cost ?? false, 
        task_environment: taskToRetire.task_environment, 
        is_backburner: taskToRetire.is_backburner, 
        is_work: taskToRetire.is_work || false, 
        is_break: taskToRetire.is_break || false
      };
      const { error: insertError } = await supabase.from('aethersink').insert(newRetiredTask);
      if (insertError) throw insertError;
      const { error: deleteError } = await supabase.from('scheduled_tasks').delete().eq('id', taskToRetire.id).eq('user_id', userId);
      if (deleteError) throw deleteError;
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks'] });
      if (variables.scheduled_date === todayString) queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday'] });
      if (error) showError(`Failed to retire task: ${error.message}`);
      else showSuccess('Task moved to Aether Sink.');
    }
  });

  const compactScheduledTasksMutation = useMutation({
    mutationFn: async ({ tasksToUpdate }: { tasksToUpdate: DBScheduledTask[] }) => {
      if (!userId) throw new Error("User not authenticated.");
      const updates = tasksToUpdate.map(task => ({ ...task, user_id: userId, updated_at: new Date().toISOString() }));
      const { error } = await supabase.from('scheduled_tasks').upsert(updates, { onConflict: 'id' });
      if (error) throw new Error(error.message);
    },
    onSettled: (data, error) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      if (isSelectedDayToday) queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday'] });
      if (error) showError(`Failed to compact schedule: ${error.message}`);
      else showSuccess('Schedule compacted!');
    }
  });

  const randomizeBreaksMutation = useMutation({
    mutationFn: async ({ selectedDate, workdayStartTime, workdayEndTime, currentDbTasks }: { selectedDate: string, workdayStartTime: Date, workdayEndTime: Date, currentDbTasks: DBScheduledTask[] }) => {
      if (!userId) throw new Error("User not authenticated.");
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

      const { error } = await supabase.from('scheduled_tasks').upsert(randomizedUpdates);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      if (isSelectedDayToday) queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday'] });
    },
    onError: (error) => {
      showError(`Failed to randomize breaks: ${error.message}`);
    }
  });

  const autoBalanceScheduleMutation = useMutation< { tasksPlaced: number; tasksKeptInSink: number }, Error, AutoBalancePayload >({
    mutationFn: async (payload: AutoBalancePayload) => {
      if (!userId || !session?.access_token) throw new Error("Authentication required.");
      const { data, error } = await supabase.functions.invoke('auto-balance-schedule', { body: payload, headers: { 'Authorization': `Bearer ${session.access_token}` } });
      if (error) throw new Error(data.error || error.message);
      return data;
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks'] });
      if (variables.selectedDate === todayString) queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday'] });
      if (error) showError(`Auto-balance failed: ${error.message}`);
      else if (data) showSuccess(`Balanced: ${data.tasksPlaced} items placed.`);
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
        const { data: futureScheduled, error: fsError } = await supabase.from('scheduled_tasks').select('*').eq('user_id', user.id).gte('scheduled_date', todayString).eq('is_flexible', true).eq('is_locked', false);
        if (fsError) throw fsError;
        const { data: allRetired, error: arError } = await supabase.from('aethersink').select('*').eq('user_id', user.id).eq('is_locked', false);
        if (arError) throw arError;
        
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

        const { data: dbTasksForDay, error: dbTasksError } = await supabase.from('scheduled_tasks').select('*').eq('user_id', user.id).eq('scheduled_date', currentDateString);
        if (dbTasksError) throw dbTasksError;

        const fixedBlocks: TimeBlock[] = (dbTasksForDay || []).filter(t => {
            const isMealTask = isMeal(t.name);
            const isReflection = t.name.toLowerCase().startsWith('reflection');
            if (isMealTask || isReflection) return true;
            if (taskSource === 'sink-to-gaps') return true;
            return !t.is_flexible || t.is_locked;
        }).filter(t => t.start_time && t.end_time).map(t => {
          const start = setTimeOnDate(currentDayAsDate, format(parseISO(t.start_time!), 'HH:mm'));
          let end = setTimeOnDate(currentDayAsDate, format(parseISO(t.end_time!), 'HH:mm'));
          if (isBefore(end, start)) end = addDays(end, 1);
          return { start, end, duration: differenceInMinutes(end, start) };
        });

        const staticConstraints = getStaticConstraints(profile, currentDayAsDate, workdayStart, workdayEnd);
        let currentOccupied = mergeOverlappingTimeBlocks([...fixedBlocks, ...staticConstraints]);

        let tasksToConsiderForDay: UnifiedTask[] = [];
        
        if (taskSource === 'global-all-future') {
          tasksToConsiderForDay = [...globalTasksToPlace];
        } else if (taskSource === 'sink-only' || taskSource === 'sink-to-gaps') {
          const { data: retiredForDay, error: rfdError } = await supabase.from('aethersink').select('*').eq('user_id', user.id).eq('is_locked', false);
          if (rfdError) throw rfdError;
          (retiredForDay || []).forEach(t => {
            tasksToConsiderForDay.push({ id: t.id, name: t.name, duration: t.duration || 30, break_duration: t.break_duration, is_critical: t.is_critical, is_flexible: true, is_backburner: t.is_backburner, energy_cost: t.energy_cost, source: 'retired', originalId: t.id, is_custom_energy_cost: t.is_custom_energy_cost, created_at: t.retired_at, task_environment: t.task_environment, is_work: t.is_work || false, is_break: t.is_break || false });
            globalRetiredIdsToDelete.push(t.id);
          });
        } else if (taskSource === 'all-flexible') {
          const flexibleScheduled = (dbTasksForDay || []).filter(t => t.is_flexible && !t.is_locked && !isMeal(t.name) && !t.name.toLowerCase().startsWith('reflection'));
          flexibleScheduled.forEach(t => {
            tasksToConsiderForDay.push({ id: t.id, name: t.name, duration: t.start_time && t.end_time ? differenceInMinutes(parseISO(t.end_time), parseISO(t.start_time)) : 30, break_duration: t.break_duration, is_critical: t.is_critical, is_flexible: true, is_backburner: t.is_backburner, energy_cost: t.energy_cost, source: 'scheduled', originalId: t.id, is_custom_energy_cost: t.is_custom_energy_cost, created_at: t.created_at, task_environment: t.task_environment, is_work: t.is_work || false, is_break: t.is_break || false });
            globalScheduledIdsToDelete.push(t.id);
          });
        }

        const sortedPool = sortAndChunkTasks(tasksToConsiderForDay, profile, sortPreference);
        const filteredPool = sortedPool.filter(t => environmentsToFilterBy.length === 0 || environmentsToFilterBy.includes(t.task_environment));

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

        if (tasksRemainingForDay.length > 0) {
          tasksRemainingForDay.forEach(t => globalTasksToKeepInSink.push({ 
            user_id: user.id, 
            name: t.name, 
            duration: t.duration, 
            break_duration: t.break_duration, 
            original_scheduled_date: currentDateString, 
            is_critical: t.is_critical, 
            is_locked: false, 
            energy_cost: t.energy_cost, 
            is_completed: false, 
            is_custom_energy_cost: t.is_custom_energy_cost, 
            task_environment: t.task_environment, 
            is_backburner: t.is_backburner, 
            is_work: t.is_work, 
            is_break: t.is_break 
          }));
        }
      }

      await autoBalanceScheduleMutation.mutateAsync({ 
        scheduledTaskIdsToDelete: Array.from(new Set(globalScheduledIdsToDelete)), 
        retiredTaskIdsToDelete: Array.from(new Set(globalRetiredIdsToDelete)), 
        tasksToInsert: globalTasksToInsert, tasksToKeepInSink: globalTasksToKeepInSink, selectedDate: targetDateString 
      });

    } catch (e: any) {
      showError(`Engine Error: ${e.message}`);
    }
  }, [user, profile, autoBalanceScheduleMutation, todayString, getStaticConstraints]);

  return {
    dbScheduledTasks, isLoading, addScheduledTask: addScheduledTaskMutation.mutateAsync,
    removeScheduledTask: removeScheduledTaskMutation.mutateAsync, datesWithTasks, isLoadingDatesWithTasks,
    completedTasksForSelectedDayList, isLoadingCompletedTasksForSelectedDay, retireTask: retireTaskMutation.mutateAsync,
    compactScheduledTasks: compactScheduledTasksMutation.mutateAsync,
    toggleScheduledTaskLock: toggleScheduledTaskLockMutation.mutateAsync, toggleAllScheduledTasksLock: toggleAllScheduledTasksLockMutation.mutateAsync,
    aetherDump: aetherDumpMutation.mutateAsync, aetherDumpMega: aetherDumpMegaMutation.mutateAsync,
    sortBy, setSortBy, updateScheduledTaskDetails: updateScheduledTaskDetailsMutation.mutateAsync,
    completeScheduledTask: completeScheduledTaskMutation.mutateAsync,
    handleAutoScheduleAndSort,
    randomizeBreaks: randomizeBreaksMutation.mutateAsync,
    clearScheduledTasks: clearScheduledTasksMutation.mutateAsync,
    duplicateScheduledTask: duplicateScheduledTask.mutate,
    moveTaskToTomorrow: moveTaskToTomorrow.mutate,
    pullNextFromSink: pullNextFromSinkMutation.mutateAsync,
  };
};