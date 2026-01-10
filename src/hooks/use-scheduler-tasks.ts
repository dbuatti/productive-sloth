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
      console.log(`[useSchedulerTasks] Fetching scheduled tasks for ${formattedSelectedDate}, sorted by: ${sortBy}`);
      
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
      if (error) {
        console.error("[useSchedulerTasks] Error fetching scheduled tasks:", error);
        throw new Error(error.message);
      }
      
      if (sortBy === 'EMOJI') {
        const sortedData = (data as DBScheduledTask[]).sort((a, b) => getEmojiHue(a.name) - getEmojiHue(b.name));
        console.log("[useSchedulerTasks] Tasks sorted by EMOJI.");
        return sortedData;
      }
      console.log("[useSchedulerTasks] Fetched scheduled tasks:", data.length);
      return data as DBScheduledTask[];
    },
    enabled: !!userId && !!formattedSelectedDate,
  });

  const { data: completedTasksForSelectedDayList = [], isLoading: isLoadingCompletedTasksForSelectedDay } = useQuery<CompletedTaskLogEntry[]>({
    queryKey: ['completedTasksForSelectedDay', userId, formattedSelectedDate],
    queryFn: async () => {
      if (!userId || !formattedSelectedDate) return [];
      console.log(`[useSchedulerTasks] Fetching completed tasks for ${formattedSelectedDate}.`);
      const { data, error } = await supabase
        .from('completedtasks')
        .select('*')
        .eq('user_id', userId)
        .eq('original_scheduled_date', formattedSelectedDate);
      
      if (error) {
        console.error("[useSchedulerTasks] Error fetching completed tasks for selected day:", error);
        throw error;
      }
      
      const mappedData = (data || []).map(task => ({
        ...task,
        effective_duration_minutes: task.duration_used || task.duration_scheduled || 30,
        name: task.task_name,
        original_source: task.original_source || 'scheduled_tasks'
      })) as CompletedTaskLogEntry[];
      console.log("[useSchedulerTasks] Fetched completed tasks for selected day:", mappedData.length);
      return mappedData;
    },
    enabled: !!userId && !!formattedSelectedDate,
  });

  const { data: datesWithTasks = [], isLoading: isLoadingDatesWithTasks } = useQuery<string[]>({
    queryKey: ['datesWithTasks', userId],
    queryFn: async () => {
      if (!userId) return [];
      console.log("[useSchedulerTasks] Fetching dates with tasks.");
      const { data, error } = await supabase.from('scheduled_tasks').select('scheduled_date').eq('user_id', userId);
      if (error) {
        console.error("[useSchedulerTasks] Error fetching dates with tasks:", error);
        throw new Error(error.message);
      }
      const uniqueDates = Array.from(new Set(data.map(item => format(parseISO(item.scheduled_date), 'yyyy-MM-dd'))));
      console.log("[useSchedulerTasks] Dates with tasks:", uniqueDates.length);
      return uniqueDates;
    },
    enabled: !!userId,
  });

  // --- MUTATIONS ---

  const addScheduledTaskMutation = useMutation({
    mutationFn: async (newTask: NewDBScheduledTask) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("[useSchedulerTasks] Adding new scheduled task:", newTask.name);
      const taskToInsert = { 
        ...newTask, 
        user_id: userId, 
        energy_cost: newTask.energy_cost ?? 0, 
        is_completed: newTask.is_completed ?? false, 
        is_custom_energy_cost: newTask.is_custom_energy_cost ?? false, 
        task_environment: newTask.task_environment ?? 'laptop', // Ensure default environment
        source_calendar_id: newTask.source_calendar_id ?? null, 
        is_backburner: newTask.is_backburner ?? false, 
        is_work: newTask.is_work ?? false, 
        is_break: newTask.is_break ?? false 
      };
      const { data, error } = await supabase.from('scheduled_tasks').insert(taskToInsert).select().single();
      if (error) {
        console.error("[useSchedulerTasks] Error adding scheduled task:", error);
        throw new Error(error.message);
      }
      console.log("[useSchedulerTasks] Scheduled task added successfully:", data.name);
      return data as DBScheduledTask;
    },
    onSettled: (data, error, variables) => {
      console.log("[useSchedulerTasks] Invalidate queries after addScheduledTask.");
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
      console.log("[useSchedulerTasks] Removing scheduled task:", taskId);
      const { data: taskToDelete, error: fetchError } = await supabase.from('scheduled_tasks').select('scheduled_date').eq('id', taskId).eq('user_id', userId).single();
      if (fetchError) {
        console.error("[useSchedulerTasks] Error fetching task to delete:", fetchError);
        throw new Error(fetchError.message);
      }
      const { error } = await supabase.from('scheduled_tasks').delete().eq('id', taskId).eq('user_id', userId);
      if (error) {
        console.error("[useSchedulerTasks] Error removing scheduled task:", error);
        throw new Error(error.message);
      }
      console.log("[useSchedulerTasks] Scheduled task removed successfully:", taskId);
      return taskToDelete;
    },
    onSettled: (data, error) => {
      console.log("[useSchedulerTasks] Invalidate queries after removeScheduledTask.");
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks'] });
      if (data && data.scheduled_date === todayString) {
        queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday'] });
      }
      if (error) showError(`Failed to remove task: ${error.message}`);
      else showSuccess('Task removed from schedule.');
    }
  });

  const updateScheduledTaskDetailsMutation = useMutation({
    mutationFn: async (task: Partial<DBScheduledTask> & { id: string }) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("[useSchedulerTasks] Updating scheduled task details for:", task.id);
      const { data, error } = await supabase
        .from('scheduled_tasks')
        .update({ ...task, updated_at: new Date().toISOString() })
        .eq('id', task.id)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) {
        console.error("[useSchedulerTasks] Error updating scheduled task details:", error);
        throw error;
      }
      console.log("[useSchedulerTasks] Scheduled task details updated successfully:", data.name);
      return data;
    },
    onSuccess: (data, variables) => {
      console.log("[useSchedulerTasks] Invalidate queries after updateScheduledTaskDetails.");
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
      console.log("[useSchedulerTasks] Completing scheduled task:", task.name);
      
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
      if (logError) {
        console.error("[useSchedulerTasks] Error logging completed task:", logError);
        throw logError;
      }

      const { error: deleteError } = await supabase.from('scheduled_tasks').delete().eq('id', task.id);
      if (deleteError) {
        console.error("[useSchedulerTasks] Error deleting completed scheduled task:", deleteError);
        throw deleteError;
      }
      console.log("[useSchedulerTasks] Scheduled task completed and deleted successfully:", task.name);
    },
    onSuccess: () => {
      console.log("[useSchedulerTasks] Invalidate queries after completeScheduledTask.");
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
      console.log(`[useSchedulerTasks] Toggling lock for task ${taskId} to ${isLocked}.`);
      const { error } = await supabase.from('scheduled_tasks').update({ is_locked: isLocked }).eq('id', taskId);
      if (error) {
        console.error("[useSchedulerTasks] Error toggling task lock:", error);
        throw error;
      }
      console.log(`[useSchedulerTasks] Task ${taskId} lock toggled successfully.`);
    },
    onSuccess: () => {
      console.log("[useSchedulerTasks] Invalidate queries after toggleScheduledTaskLock.");
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
      console.log(`[useSchedulerTasks] Toggling all tasks lock for ${selectedDate} to ${lockState}.`);
      const { error } = await supabase.from('scheduled_tasks').update({ is_locked: lockState, updated_at: new Date().toISOString() }).eq('user_id', userId).eq('scheduled_date', selectedDate);
      if (error) {
        console.error("[useSchedulerTasks] Error toggling all tasks lock:", error);
        throw new Error(error.message);
      }
      console.log(`[useSchedulerTasks] All tasks for ${selectedDate} lock toggled successfully.`);
    },
    onSettled: (data, error, variables) => {
      console.log("[useSchedulerTasks] Invalidate queries after toggleAllScheduledTasksLock.");
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, variables.selectedDate] });
      if (variables.selectedDate === todayString) queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', userId] });
      if (error) showError(`Failed to toggle day lock: ${error.message}`);
      else showSuccess(variables.lockState ? 'Day locked down!' : 'Day unlocked!');
    }
  });

  const clearScheduledTasksMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("User not authenticated.");
      console.log(`[useSchedulerTasks] Clearing unlocked scheduled tasks for ${formattedSelectedDate}.`);
      const { error } = await supabase.from('scheduled_tasks').delete().eq('user_id', userId).eq('scheduled_date', formattedSelectedDate).eq('is_locked', false);
      if (error) {
        console.error("[useSchedulerTasks] Error clearing scheduled tasks:", error);
        throw new Error(error.message);
      }
      console.log("[useSchedulerTasks] Unlocked scheduled tasks cleared successfully.");
    },
    onSettled: (data, error) => {
      console.log("[useSchedulerTasks] Invalidate queries after clearScheduledTasks.");
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks'] });
      if (isSelectedDayToday) queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday'] });
      if (error) showError(`Failed to clear schedule: ${error.message}`);
      else showSuccess('Schedule cleared.');
    }
  });

  const aetherDumpMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("User not authenticated.");
      console.log(`[useSchedulerTasks] Performing Aether Dump for ${formattedSelectedDate}.`);
      const { data: flexibleTasks, error: fetchError } = await supabase.from('scheduled_tasks').select('*').eq('user_id', userId).eq('scheduled_date', formattedSelectedDate).eq('is_flexible', true).eq('is_locked', false);
      if (fetchError) {
        console.error("[useSchedulerTasks] Error fetching flexible tasks for Aether Dump:", fetchError);
        throw fetchError;
      }
      if (!flexibleTasks || flexibleTasks.length === 0) {
        console.log("[useSchedulerTasks] No flexible tasks to dump for today.");
        return;
      }

      const retiredToInsert = flexibleTasks.map(t => ({
        user_id: userId, name: t.name, duration: t.start_time && t.end_time ? differenceInMinutes(parseISO(t.end_time!), parseISO(t.start_time!)) : 30,
        break_duration: t.break_duration, original_scheduled_date: t.scheduled_date, is_critical: t.is_critical,
        energy_cost: t.energy_cost, task_environment: t.task_environment, is_work: t.is_work, is_break: t.is_break
      }));

      const { error: insertError } = await supabase.from('aethersink').insert(retiredToInsert);
      if (insertError) {
        console.error("[useSchedulerTasks] Error inserting tasks into aethersink during dump:", insertError);
        throw insertError;
      }
      const { error: deleteError } = await supabase.from('scheduled_tasks').delete().in('id', flexibleTasks.map(t => t.id));
      if (deleteError) {
        console.error("[useSchedulerTasks] Error deleting scheduled tasks during dump:", deleteError);
        throw deleteError;
      }
      console.log(`[useSchedulerTasks] Dumped ${flexibleTasks.length} tasks to Aether Sink.`);
    },
    onSuccess: () => {
      console.log("[useSchedulerTasks] Invalidate queries after aetherDump.");
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
      console.log("[useSchedulerTasks] Performing Aether Dump Mega (all future flexible tasks).");
      const { data: flexibleTasks, error: fetchError } = await supabase.from('scheduled_tasks').select('*').eq('user_id', userId).gte('scheduled_date', todayString).eq('is_flexible', true).eq('is_locked', false);
      if (fetchError) {
        console.error("[useSchedulerTasks] Error fetching flexible tasks for Aether Dump Mega:", fetchError);
        throw fetchError;
      }
      if (!flexibleTasks || flexibleTasks.length === 0) {
        console.log("[useSchedulerTasks] No future flexible tasks to dump.");
        return;
      }

      const retiredToInsert = flexibleTasks.map(t => ({
        user_id: userId, name: t.name, duration: t.start_time && t.end_time ? differenceInMinutes(parseISO(t.end_time!), parseISO(t.start_time!)) : 30,
        break_duration: t.break_duration, original_scheduled_date: t.scheduled_date, is_critical: t.is_critical,
        energy_cost: t.energy_cost, task_environment: t.task_environment, is_work: t.is_work, is_break: t.is_break
      }));

      const { error: insertError } = await supabase.from('aethersink').insert(retiredToInsert);
      if (insertError) {
        console.error("[useSchedulerTasks] Error inserting tasks into aethersink during mega dump:", insertError);
        throw insertError;
      }
      const { error: deleteError } = await supabase.from('scheduled_tasks').delete().in('id', flexibleTasks.map(t => t.id));
      if (deleteError) {
        console.error("[useSchedulerTasks] Error deleting scheduled tasks during mega dump:", deleteError);
        throw deleteError;
      }
      console.log(`[useSchedulerTasks] Dumped ${flexibleTasks.length} future tasks to Aether Sink.`);
    },
    onSuccess: () => {
      console.log("[useSchedulerTasks] Invalidate queries after aetherDumpMega.");
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
      console.log("[useSchedulerTasks] Retiring task:", taskToRetire.name);
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
      if (insertError) {
        console.error("[useSchedulerTasks] Error inserting task into aethersink during retire:", insertError);
        throw insertError;
      }
      const { error: deleteError } = await supabase.from('scheduled_tasks').delete().eq('id', taskToRetire.id).eq('user_id', userId);
      if (deleteError) {
        console.error("[useSchedulerTasks] Error deleting scheduled task during retire:", deleteError);
        throw deleteError;
      }
      console.log("[useSchedulerTasks] Task retired successfully:", taskToRetire.name);
    },
    onSettled: (data, error, variables) => {
      console.log("[useSchedulerTasks] Invalidate queries after retireTask.");
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
      console.log("[useSchedulerTasks] Compacting scheduled tasks. Tasks to update:", tasksToUpdate.length);
      const updates = tasksToUpdate.map(task => ({ ...task, user_id: userId, updated_at: new Date().toISOString() }));
      const { error } = await supabase.from('scheduled_tasks').upsert(updates, { onConflict: 'id' });
      if (error) {
        console.error("[useSchedulerTasks] Error compacting scheduled tasks:", error);
        throw new Error(error.message);
      }
      console.log("[useSchedulerTasks] Scheduled tasks compacted successfully.");
    },
    onSettled: (data, error) => {
      console.log("[useSchedulerTasks] Invalidate queries after compactScheduledTasks.");
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      if (isSelectedDayToday) queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday'] });
      if (error) showError(`Failed to compact schedule: ${error.message}`);
      else showSuccess('Schedule compacted!');
    }
  });

  const randomizeBreaksMutation = useMutation({
    mutationFn: async ({ selectedDate, workdayStartTime, workdayEndTime, currentDbTasks }: { selectedDate: string, workdayStartTime: Date, workdayEndTime: Date, currentDbTasks: DBScheduledTask[] }) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log(`[useSchedulerTasks] Randomizing breaks for ${selectedDate}.`);
      const unlockedBreaks = currentDbTasks.filter(t => t.name.toLowerCase() === 'break' && !t.is_locked);
      if (unlockedBreaks.length === 0) {
        console.log("[useSchedulerTasks] No unlocked breaks to randomize.");
        return;
      }
      
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
      if (error) {
        console.error("[useSchedulerTasks] Error randomizing breaks:", error);
        throw error;
      }
      console.log(`[useSchedulerTasks] Randomized ${randomizedUpdates.length} breaks.`);
    },
    onSuccess: () => {
      console.log("[useSchedulerTasks] Invalidate queries after randomizeBreaks.");
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
      console.log("[useSchedulerTasks] Invoking auto-balance-schedule Edge Function with payload:", payload);
      const { data, error } = await supabase.functions.invoke('auto-balance-schedule', { body: payload, headers: { 'Authorization': `Bearer ${session.access_token}` } });
      if (error) {
        console.error("[useSchedulerTasks] Error from auto-balance-schedule Edge Function:", error);
        throw new Error(data.error || error.message);
      }
      console.log("[useSchedulerTasks] auto-balance-schedule Edge Function returned:", data);
      return data;
    },
    onSettled: (data, error, variables) => {
      console.log("[useSchedulerTasks] Invalidate queries after autoBalanceScheduleMutation.");
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
    console.log(`[useSchedulerTasks] handleAutoScheduleAndSort called. Sort: ${sortPreference}, Source: ${taskSource}, Target Date: ${targetDateString}`);
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
        console.log("[useSchedulerTasks] Fetching all future flexible scheduled tasks and all unlocked retired tasks for global auto-schedule.");
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
        console.log(`[useSchedulerTasks] Global tasks to place: ${globalTasksToPlace.length}`);
      }

      const daysToProcess = taskSource === 'global-all-future' ? Array.from({ length: futureDaysToSchedule }).map((_, i) => format(addDays(startOfDay(new Date()), i), 'yyyy-MM-dd')) : [targetDateString];
      console.log(`[useSchedulerTasks] Days to process: ${daysToProcess.length}`);

      for (const currentDateString of daysToProcess) {
        const currentDayAsDate = parseISO(currentDateString);
        if (profile.blocked_days?.includes(currentDateString)) {
          console.log(`[useSchedulerTasks] Skipping blocked day: ${currentDateString}`);
          continue;
        }

        const workdayStart = profile.default_auto_schedule_start_time ? setTimeOnDate(currentDayAsDate, profile.default_auto_schedule_start_time) : startOfDay(currentDayAsDate);
        let workdayEnd = profile.default_auto_schedule_end_time ? setTimeOnDate(startOfDay(currentDayAsDate), profile.default_auto_schedule_end_time) : addHours(startOfDay(currentDayAsDate), 17);
        if (isBefore(workdayEnd, workdayStart)) workdayEnd = addDays(workdayEnd, 1);
        
        const T_current = new Date();
        const effectiveStart = (isSameDay(currentDayAsDate, T_current) && isBefore(workdayStart, T_current)) ? T_current : workdayStart;

        const { data: dbTasksForDay, error: dbTasksError } = await supabase.from('scheduled_tasks').select('*').eq('user_id', user.id).eq('scheduled_date', currentDateString);
        if (dbTasksError) throw dbTasksError;
        
        console.log(`[useSchedulerTasks] Processing day: ${currentDateString}`);

        const staticAnchors = (dbTasksForDay || []).filter(t => {
            const nameLower = t.name.toLowerCase();
            const isMealTask = isMeal(t.name);
            const isReflection = nameLower.startsWith('reflection');
            return isMealTask || isReflection;
        });

        const fixedBlocks: TimeBlock[] = (dbTasksForDay || []).filter(t => {
            const nameLower = t.name.toLowerCase();
            const isMealTask = isMeal(t.name);
            const isReflection = nameLower.startsWith('reflection');
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
        
        console.log(`[useSchedulerTasks] Fixed blocks count for ${currentDateString}: ${currentOccupied.length}`);

        let tasksToConsiderForDay: UnifiedTask[] = [];
        
        if (taskSource === 'global-all-future') {
          tasksToConsiderForDay = [...globalTasksToPlace];
        } else if (taskSource === 'sink-only' || taskSource === 'sink-to-gaps') {
          console.log("[useSchedulerTasks] Fetching unlocked retired tasks for sink-only/sink-to-gaps schedule.");
          const { data: retiredForDay, error: rfdError } = await supabase.from('aethersink').select('*').eq('user_id', user.id).eq('is_locked', false);
          if (rfdError) throw rfdError;
          (retiredForDay || []).forEach(t => {
            tasksToConsiderForDay.push({ id: t.id, name: t.name, duration: t.duration || 30, break_duration: t.break_duration, is_critical: t.is_critical, is_flexible: true, is_backburner: t.is_backburner, energy_cost: t.energy_cost, source: 'retired', originalId: t.id, is_custom_energy_cost: t.is_custom_energy_cost, created_at: t.retired_at, task_environment: t.task_environment, is_work: t.is_work || false, is_break: t.is_break || false });
            globalRetiredIdsToDelete.push(t.id);
          });
        }

        const flexibleTasksForDay = (dbTasksForDay || []).filter(t => t.is_flexible && !t.is_locked && !t.is_completed).map(t => ({
          id: t.id, name: t.name, duration: t.start_time && t.end_time ? differenceInMinutes(parseISO(t.end_time), parseISO(t.start_time)) : 30, break_duration: t.break_duration, is_critical: t.is_critical, is_flexible: true, is_backburner: t.is_backburner, energy_cost: t.energy_cost, source: 'scheduled', originalId: t.id, is_custom_energy_cost: t.is_custom_energy_cost, created_at: t.created_at, task_environment: t.task_environment, is_work: t.is_work || false, is_break: t.is_break || false
        }));

        if (taskSource === 'all-flexible' || taskSource === 'sink-to-gaps') {
          flexibleTasksForDay.forEach(t => globalScheduledIdsToDelete.push(t.id));
          tasksToConsiderForDay.push(...flexibleTasksForDay);
        }

        const sortedTasksToPlace = sortAndChunkTasks(tasksToConsiderForDay, profile, sortPreference)
          .filter(task => environmentsToFilterBy.length === 0 || environmentsToFilterBy.includes(task.task_environment));
        console.log(`[useSchedulerTasks] Sorted tasks to place for ${currentDateString}: ${sortedTasksToPlace.length}`);

        let currentPlacementCursor = effectiveStart;
        const placedTaskIds = new Set<string>();

        for (const task of sortedTasksToPlace) {
          const taskTotalDuration = (task.duration || 30) + (task.break_duration || 0);
          const slot = findFirstAvailableSlot(taskTotalDuration, currentOccupied, currentPlacementCursor, workdayEnd);

          if (slot) {
            globalTasksToInsert.push({
              id: task.source === 'scheduled' ? task.id : undefined, // Keep ID for updates, undefined for new inserts
              name: task.name,
              start_time: slot.start.toISOString(),
              end_time: slot.end.toISOString(),
              break_duration: task.break_duration,
              scheduled_date: currentDateString,
              is_critical: task.is_critical,
              is_flexible: true,
              is_locked: false,
              energy_cost: task.energy_cost,
              is_custom_energy_cost: task.is_custom_energy_cost,
              task_environment: task.task_environment,
              is_backburner: task.is_backburner,
              is_work: task.is_work,
              is_break: task.is_break,
            });
            placedTaskIds.add(task.id);
            currentOccupied.push({ start: slot.start, end: slot.end, duration: taskTotalDuration });
            currentOccupied = mergeOverlappingTimeBlocks(currentOccupied);
            currentPlacementCursor = slot.end;
            console.log(`[useSchedulerTasks] Placed "${task.name}" at ${format(slot.start, 'HH:mm')} on ${currentDateString}.`);
          } else {
            console.log(`[useSchedulerTasks] Could not place "${task.name}" on ${currentDateString}. Keeping in sink.`);
            if (task.source === 'retired') {
              globalTasksToKeepInSink.push({
                id: task.id, // Keep ID for retired tasks
                user_id: userId,
                name: task.name,
                duration: task.duration,
                break_duration: task.break_duration,
                original_scheduled_date: task.original_scheduled_date,
                is_critical: task.is_critical,
                is_locked: task.is_locked,
                energy_cost: task.energy_cost,
                is_completed: task.is_completed,
                is_custom_energy_cost: task.is_custom_energy_cost,
                task_environment: task.task_environment,
                is_backburner: task.is_backburner,
                is_work: task.is_work,
                is_break: task.is_break,
              });
            }
          }
        }
      }

      // Filter out tasks that were placed from the deletion lists
      globalScheduledIdsToDelete = globalScheduledIdsToDelete.filter(id => !placedTaskIds.has(id));
      globalRetiredIdsToDelete = globalRetiredIdsToDelete.filter(id => !placedTaskIds.has(id));

      const payload: AutoBalancePayload = {
        scheduledTaskIdsToDelete: globalScheduledIdsToDelete,
        retiredTaskIdsToDelete: globalRetiredIdsToDelete,
        tasksToInsert: globalTasksToInsert,
        tasksToKeepInSink: globalTasksToKeepInSink,
        selectedDate: targetDateString, // This is just for logging in the edge function
      };
      
      await autoBalanceScheduleMutation.mutateAsync(payload);

    } catch (error: any) {
      console.error("[useSchedulerTasks] Auto-schedule and sort failed:", error);
      throw error;
    }
  }, [user, profile, autoBalanceScheduleMutation, sortBy, todayString]);

  return {
    dbScheduledTasks,
    isLoading,
    addScheduledTask: addScheduledTaskMutation.mutateAsync,
    removeScheduledTask: removeScheduledTaskMutation.mutateAsync,
    updateScheduledTaskDetails: updateScheduledTaskDetailsMutation.mutateAsync,
    completeScheduledTask: completeScheduledTaskMutation.mutateAsync,
    toggleScheduledTaskLock: toggleScheduledTaskLockMutation.mutateAsync,
    toggleAllScheduledTasksLock: toggleAllScheduledTasksLockMutation.mutateAsync,
    clearScheduledTasks: clearScheduledTasksMutation.mutateAsync,
    aetherDump: aetherDumpMutation.mutateAsync,
    aetherDumpMega: aetherDumpMegaMutation.mutateAsync,
    retireTask: retireTaskMutation.mutateAsync,
    compactScheduledTasks: compactScheduledTasksMutation.mutateAsync,
    randomizeBreaks: randomizeBreaksMutation.mutateAsync,
    handleAutoScheduleAndSort,
    sortBy,
    setSortBy,
    datesWithTasks,
    isLoadingDatesWithTasks,
    isLoadingCompletedTasksForSelectedDay,
  };
};