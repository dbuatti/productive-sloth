"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DBScheduledTask, NewDBScheduledTask, RetiredTask, NewRetiredTask, SortBy, TimeBlock, AutoBalancePayload, UnifiedTask, CompletedTaskLogEntry, TaskEnvironment } from '@/types/scheduler';
import { useSession, UserProfile } from './use-session';
import { showSuccess, showError } from '@/utils/toast';
import { startOfDay, parseISO, format, addMinutes, isBefore, isAfter, addDays, differenceInMinutes, addHours, isSameDay, max, min } from 'date-fns';
import { mergeOverlappingTimeBlocks, findFirstAvailableSlot, getEmojiHue, setTimeOnDate, getStaticConstraints, isMeal, sortAndChunkTasks, formatTime, ZoneWeight, getFreeTimeBlocks } from '@/lib/scheduler-utils';

export const useSchedulerTasks = (selectedDate: string, scrollRef?: React.RefObject<HTMLElement>) => {
  const queryClient = useQueryClient();
  const { user, profile, session, isLoading: isSessionLoading } = useSession();
  const userId = user?.id;

  const formattedSelectedDate = selectedDate;
  const todayString = format(new Date(), 'yyyy-MM-dd');

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
      let query = supabase.from('scheduled_tasks').select('*').eq('user_id', userId).eq('scheduled_date', formattedSelectedDate);
      if (sortBy === 'TIME_EARLIEST_TO_LATEST') query = query.order('start_time', { ascending: true });
      else if (sortBy === 'TIME_LATEST_TO_EARLIEST') query = query.order('start_time', { ascending: false });
      else if (sortBy === 'PRIORITY_HIGH_TO_LOW') query = query.order('is_critical', { ascending: false }).order('start_time', { ascending: true });
      else if (sortBy === 'PRIORITY_LOW_TO_HIGH') query = query.order('is_critical', { ascending: true }).order('start_time', { ascending: true });
      else if (sortBy === 'NAME_ASC') query = query.order('name', { ascending: true });
      else if (sortBy === 'NAME_DESC') query = query.order('name', { ascending: false });
      else query = query.order('created_at', { ascending: true });
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      if (sortBy === 'EMOJI') return (data as DBScheduledTask[]).sort((a, b) => getEmojiHue(a.name) - getEmojiHue(b.name));
      return data as DBScheduledTask[];
    },
    enabled: !!userId && !!formattedSelectedDate,
  });

  const { data: completedTasksForSelectedDayList = [] } = useQuery<CompletedTaskLogEntry[]>({
    queryKey: ['completedTasksForSelectedDay', userId, formattedSelectedDate],
    queryFn: async () => {
      if (!user?.id || !formattedSelectedDate) return [];
      const { data, error } = await supabase.from('completedtasks').select('*').eq('user_id', user.id).eq('original_scheduled_date', formattedSelectedDate);
      if (error) throw error;
      return (data || []).map(task => ({ ...task, effective_duration_minutes: task.duration_used || task.duration_scheduled || 30, name: task.task_name, original_source: task.original_source || 'scheduled_tasks' })) as CompletedTaskLogEntry[];
    },
    enabled: !!user?.id && !!formattedSelectedDate,
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
      const taskToInsert = { ...newTask, user_id: userId, name: newTask.name || 'Untitled Task' };
      const { data, error } = await supabase.from('scheduled_tasks').insert(taskToInsert).select().single();
      if (error) throw new Error(error.message);
      return data as DBScheduledTask;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks'] });
    }
  });

  const removeScheduledTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      if (!userId) throw new Error("User not authenticated.");
      const { error } = await supabase.from('scheduled_tasks').delete().eq('id', taskId).eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] })
  });

  const completeScheduledTaskMutation = useMutation({
    mutationFn: async (task: DBScheduledTask) => {
      if (!userId) throw new Error("User not authenticated.");
      
      // Determine priority based on is_critical and is_backburner
      let priority = 'MEDIUM';
      if (task.is_critical) priority = 'HIGH';
      else if (task.is_backburner) priority = 'LOW';

      const { error: logError } = await supabase.from('completedtasks').insert({
        user_id: userId,
        task_name: task.name || 'Untitled Task',
        original_id: task.id,
        duration_scheduled: task.start_time && task.end_time ? differenceInMinutes(parseISO(task.end_time), parseISO(task.start_time)) : 30,
        duration_used: task.start_time && task.end_time ? differenceInMinutes(parseISO(task.end_time), parseISO(task.start_time)) : 30,
        xp_earned: (task.energy_cost || 0) * 2,
        energy_cost: task.energy_cost,
        is_critical: task.is_critical,
        original_source: 'scheduled_tasks',
        original_scheduled_date: task.scheduled_date,
        is_work: task.is_work,
        is_break: task.is_break,
        priority: priority, // Include priority
      });
      if (logError) throw logError;
      const { error: deleteError } = await supabase.from('aethersink').delete().eq('id', task.id); 
      const { error: deleteSchedError } = await supabase.from('scheduled_tasks').delete().eq('id', task.id);
      if (deleteSchedError) throw deleteSchedError;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['completedTasksForSelectedDay'] });
    }
  });

  const toggleScheduledTaskLockMutation = useMutation({
    mutationFn: async ({ taskId, isLocked }: { taskId: string; isLocked: boolean }) => {
      if (!userId) throw new Error("User not authenticated.");
      const { error = null } = await supabase.from('scheduled_tasks').update({ is_locked: isLocked }).eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] })
  });

  const toggleAllScheduledTasksLockMutation = useMutation({
    mutationFn: async ({ selectedDate, lockState }: { selectedDate: string; lockState: boolean }) => {
      if (!userId) throw new Error("User not authenticated.");
      
      // Fetch the IDs of tasks that are currently flexible and unlocked for the selected day
      const { data: existingTasks, error: fetchError } = await supabase
        .from('scheduled_tasks')
        .select('id')
        .eq('user_id', userId)
        .eq('scheduled_date', selectedDate)
        .eq('is_flexible', true)
        .eq('is_locked', !lockState); // Only target tasks that are currently in the opposite lock state

      if (fetchError) {
        console.error("[toggleAllScheduledTasksLockMutation] Error fetching tasks for bulk lock toggle:", fetchError.message);
        throw fetchError;
      }

      const taskIdsToUpdate = existingTasks.map(t => t.id);

      if (taskIdsToUpdate.length === 0) {
        showSuccess(`No unlocked flexible tasks to ${lockState ? 'lock' : 'unlock'}.`);
        return; // No tasks to update
      }

      console.log(`[toggleAllScheduledTasksLockMutation] Attempting to update lock state for ${taskIdsToUpdate.length} tasks.`);
      const { error: updateError } = await supabase
        .from('scheduled_tasks')
        .update({ is_locked: lockState })
        .in('id', taskIdsToUpdate) // Update only the fetched IDs
        .eq('user_id', userId); // Keep user_id filter for safety

      if (updateError) {
        console.error("[toggleAllScheduledTasksLockMutation] Error updating lock state:", updateError.message);
        throw updateError;
      }
      showSuccess(`${taskIdsToUpdate.length} tasks ${lockState ? 'locked' : 'unlocked'}.`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] })
  });

  const clearScheduledTasksMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("User not authenticated.");
      const { error = null } = await supabase.from('scheduled_tasks').delete().eq('user_id', userId).eq('scheduled_date', formattedSelectedDate).eq('is_locked', false);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] })
  });

  const compactScheduledTasksMutation = useMutation({
    mutationFn: async ({ tasksToUpdate }: { tasksToUpdate: DBScheduledTask[] }) => {
      if (!userId) throw new Error("User not authenticated.");
      // Only send tasks that actually need updating (i.e., their times changed)
      if (tasksToUpdate.length === 0) {
        showSuccess("Schedule already optimized.");
        return;
      }
      const { error = null } = await supabase.from('scheduled_tasks').upsert(tasksToUpdate, { onConflict: 'id' }); // Use upsert by ID
      if (error) throw error;
      showSuccess("Schedule compacted.");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] })
  });

  const randomizeBreaksMutation = useMutation({
    mutationFn: async ({ selectedDate, workdayStartTime, workdayEndTime, currentDbTasks }: any) => {
      const breaks = currentDbTasks.filter((t: any) => t.name?.toLowerCase() === 'break' && !t.is_locked);
      if (breaks.length === 0) return;
      const otherBlocks = currentDbTasks.filter((t: any) => t.name?.toLowerCase() !== 'break' || t.is_locked).map((t: any) => ({ start: parseISO(t.start_time!), end: parseISO(t.end_time!) }));
      const dayDate = parseISO(selectedDate);
      const staticConstraints = getStaticConstraints(profile!, dayDate, workdayStartTime, workdayEndTime);
      let occupied = mergeOverlappingTimeBlocks([...otherBlocks, ...staticConstraints]);
      const updated = [];
      for (const b of breaks) {
        const dur = differenceInMinutes(parseISO(b.end_time!), parseISO(b.start_time!));
        const slot = findFirstAvailableSlot(dur, occupied, workdayStartTime, workdayEndTime);
        if (slot) {
          updated.push({ ...b, start_time: slot.start.toISOString(), end_time: slot.end.toISOString() });
          occupied.push({ start: slot.start, end: slot.end, duration: dur });
          occupied = mergeOverlappingTimeBlocks(occupied);
        }
      }
      if (updated.length > 0) {
        const { error = null } = await supabase.from('scheduled_tasks').upsert(updated, { onConflict: 'id' });
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] })
  });

  const aetherDumpMutation = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      const { data: toDump } = await supabase.from('scheduled_tasks').select('*').eq('user_id', userId).eq('scheduled_date', formattedSelectedDate).eq('is_flexible', true).eq('is_locked', false);
      if (!toDump || toDump.length === 0) return;
      const retired = toDump.map(t => ({ 
        user_id: userId, name: t.name || 'Untitled Task', duration: t.start_time && t.end_time ? differenceInMinutes(parseISO(t.end_time), parseISO(t.start_time)) : 30, 
        break_duration: t.break_duration, original_scheduled_date: t.scheduled_date, retired_at: new Date().toISOString(), 
        is_critical: t.is_critical, is_locked: false, energy_cost: t.energy_cost, is_completed: false, 
        is_custom_energy_cost: t.is_custom_energy_cost, task_environment: t.task_environment, 
        is_backburner: t.is_backburner, is_work: t.is_work, is_break: t.is_break 
      }));
      // Use upsert to prevent 409 Conflict errors
      await supabase.from('aethersink').upsert(retired, { onConflict: 'user_id, name, original_scheduled_date' });
      await supabase.from('scheduled_tasks').delete().in('id', toDump.map(t => t.id));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
    }
  });

  const aetherDumpMegaMutation = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      const { data: toDump } = await supabase.from('scheduled_tasks').select('*').eq('user_id', userId).gte('scheduled_date', todayString).eq('is_flexible', true).eq('is_locked', false);
      if (!toDump || toDump.length === 0) return;
      const retired = toDump.map(t => ({ 
        user_id: userId, name: t.name || 'Untitled Task', duration: t.start_time && t.end_time ? differenceInMinutes(parseISO(t.end_time), parseISO(t.start_time)) : 30, 
        break_duration: t.break_duration, original_scheduled_date: t.scheduled_date, retired_at: new Date().toISOString(), 
        is_critical: t.is_critical, is_locked: false, energy_cost: t.energy_cost, is_completed: false, 
        is_custom_energy_cost: t.is_custom_energy_cost, task_environment: t.task_environment, 
        is_backburner: t.is_backburner, is_work: t.is_work, is_break: t.is_break 
      }));
      // Use upsert to prevent 409 Conflict errors
      await supabase.from('aethersink').upsert(retired, { onConflict: 'user_id, name, original_scheduled_date' });
      await supabase.from('scheduled_tasks').delete().in('id', toDump.map(t => t.id));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
    }
  });

  const pullNextFromSinkMutation = useMutation({
    mutationFn: async ({ selectedDateString, workdayStart, workdayEnd, T_current, staticConstraints }: any) => {
      if (!userId) return;
      const { data: sink } = await supabase.from('aethersink').select('*').eq('user_id', userId).eq('is_locked', false).order('is_critical', { ascending: false }).limit(1).single();
      if (!sink) return showSuccess("Aether Sink Vacant.");
      
      const { data: current } = await supabase.from('scheduled_tasks').select('*').eq('user_id', userId).eq('scheduled_date', selectedDateString);
      const blocks = (current || []).filter(t => t.start_time && t.end_time).map(t => ({ start: parseISO(t.start_time!), end: parseISO(t.end_time!), duration: differenceInMinutes(parseISO(t.end_time!), parseISO(t.start_time!)) }));
      const allConstraints = mergeOverlappingTimeBlocks([...blocks, ...staticConstraints]); // Use allConstraints here
      const searchStart = isSameDay(parseISO(selectedDateString), new Date()) ? max([workdayStart, T_current]) : workdayStart;
      const dur = sink.duration || 30;
      const slot = findFirstAvailableSlot(dur, allConstraints, searchStart, workdayEnd); // Use allConstraints here
      
      if (!slot) return showError("No valid gap available.");
      
      await supabase.from('scheduled_tasks').insert({ 
        user_id: userId, name: sink.name || 'Untitled Task', start_time: slot.start.toISOString(), end_time: slot.end.toISOString(), 
        scheduled_date: selectedDateString, is_critical: sink.is_critical, is_flexible: true, is_locked: false, 
        energy_cost: sink.energy_cost, task_environment: sink.task_environment, is_backburner: sink.is_backburner, 
        is_work: sink.is_work, is_break: sink.is_break 
      });
      await supabase.from('aethersink').delete().eq('id', sink.id);
      showSuccess(`Objective "${sink.name}" Synchronized.`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
    }
  });

  const duplicateScheduledTaskMutation = useMutation({
    mutationFn: async (task: DBScheduledTask) => {
      const { id, created_at, updated_at, ...rest } = task;
      const { data, error } = await supabase.from('scheduled_tasks').insert({ ...rest, name: `${task.name || 'Untitled Task'} (Copy)`, is_completed: false }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] })
  });

  const moveTaskToTomorrowMutation = useMutation({
    mutationFn: async (task: DBScheduledTask) => {
      const tomorrow = format(addDays(parseISO(task.scheduled_date), 1), 'yyyy-MM-dd');
      let newStart = null, newEnd = null;
      if (task.start_time && task.end_time) {
        newStart = addDays(parseISO(task.start_time), 1).toISOString();
        newEnd = addDays(parseISO(task.end_time), 1).toISOString();
      }
      const { error = null } = await supabase.from('scheduled_tasks').update({ scheduled_date: tomorrow, start_time: newStart, end_time: newEnd }).eq('id', task.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] })
  });

  const updateScheduledTaskDetailsMutation = useMutation({
    mutationFn: async (task: Partial<DBScheduledTask> & { id: string }) => {
      if (!userId) throw new Error("User not authenticated.");
      const updates = { ...task, updated_at: new Date().toISOString() };
      if (task.name !== undefined) updates.name = task.name || 'Untitled Task';
      const { data, error = null } = await supabase.from('scheduled_tasks').update(updates).eq('id', task.id).eq('user_id', userId).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      showSuccess('Task updated successfully!');
    }
  });

  const autoBalanceScheduleMutation = useMutation<{ tasksPlaced: number; tasksKeptInSink: number }, Error, AutoBalancePayload>({
    mutationFn: async (payload: AutoBalancePayload) => {
      if (!userId || !session?.access_token) throw new Error("Authentication required.");
      console.log("[autoBalanceScheduleMutation] Sending payload to Edge Function:", JSON.stringify(payload, null, 2)); // Log payload
      const { data, error } = await supabase.functions.invoke('auto-balance-schedule', { body: payload, headers: { 'Authorization': `Bearer ${session.access_token}` } });
      if (error) {
        let errorMessage = error.message;
        if (error.context) {
          try {
            const errorData = await error.context.json();
            errorMessage = errorData.error || error.message;
          } catch (jsonError) {
            console.warn("[autoBalanceScheduleMutation] Failed to parse error context JSON:", jsonError);
            // Fallback to original error message if JSON parsing fails
          }
        }
        throw new Error(errorMessage);
      }
      return data;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks'] });
    }
  });

  const retireTaskMutation = useMutation({
    mutationFn: async (task: DBScheduledTask) => {
      // Determine priority based on is_critical and is_backburner
      let priority = 'MEDIUM';
      if (task.is_critical) priority = 'HIGH';
      else if (task.is_backburner) priority = 'LOW';

      const retired = { 
        user_id: userId, name: task.name || 'Untitled Task', duration: task.start_time && task.end_time ? differenceInMinutes(parseISO(task.end_time), parseISO(task.start_time)) : 30, 
        break_duration: task.break_duration, original_scheduled_date: task.scheduled_date, retired_at: new Date().toISOString(), 
        is_critical: task.is_critical, is_locked: false, energy_cost: task.energy_cost, is_completed: false, 
        is_custom_energy_cost: task.is_custom_energy_cost, task_environment: task.task_environment, 
        is_backburner: task.is_backburner, is_work: task.is_work, is_break: task.is_break,
        priority: priority, // Include priority
      };
      // Use upsert to prevent unique constraint conflicts
      await supabase.from('aethersink').upsert(retired, { onConflict: 'user_id, name, original_scheduled_date' });
      await supabase.from('scheduled_tasks').delete().eq('id', task.id);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
    }
  });

  const handleAutoScheduleAndSort = useCallback(async (
    sortPreference: SortBy,
    taskSource: 'all-flexible' | 'sink-only' | 'sink-to-gaps' | 'global-all-future' | 'rebalance-day',
    environmentsToFilterBy: TaskEnvironment[] = [],
    targetDateString: string,
    futureDaysToSchedule: number = 30
  ) => {
    const functionName = "[handleAutoScheduleAndSort]";
    if (isSessionLoading || !userId) return;

    console.log(`${functionName} Initiating Flow Sync. Mode: ${taskSource} | Target: ${targetDateString}`);

    try {
      const [envsResponse, profileResponse] = await Promise.all([
        supabase.from('environments').select('value, target_weight').eq('user_id', userId),
        supabase.from('profiles').select('*').eq('id', userId).single()
      ]);

      if (envsResponse.error) throw envsResponse.error;
      if (profileResponse.error) throw profileResponse.error;
      
      const freshEnvs = envsResponse.data;
      const freshProfile = profileResponse.data as UserProfile;
      const zoneWeights: ZoneWeight[] = freshEnvs.map(e => ({ value: e.value, target_weight: Number(e.target_weight || 0) }));
      
      const initialTargetDayAsDate = parseISO(targetDateString);
      if (isBefore(initialTargetDayAsDate, startOfDay(new Date())) && taskSource !== 'global-all-future') {
          return showError("Historical timelines are read-only.");
      }

      let pool: UnifiedTask[] = [];
      let globalScheduledIdsToDelete: string[] = [];
      let globalRetiredIdsToDelete: string[] = [];
      let globalTasksToInsert: NewDBScheduledTask[] = [];

      // 1. Gather the pool
      if (taskSource === 'global-all-future') {
        const { data: fs } = await supabase.from('scheduled_tasks').select('*').eq('user_id', userId).gte('scheduled_date', todayString).eq('is_flexible', true).eq('is_locked', false);
        const { data: ar } = await supabase.from('aethersink').select('*').eq('user_id', userId).eq('is_locked', false);
        (fs || []).forEach(t => { 
          pool.push({ 
            id: t.id, name: t.name || 'Untitled Task', duration: t.start_time && t.end_time ? differenceInMinutes(parseISO(t.end_time), parseISO(t.start_time)) : 30, 
            break_duration: t.break_duration, is_critical: t.is_critical, is_flexible: true, is_backburner: t.is_backburner, 
            energy_cost: t.energy_cost, source: 'scheduled', originalId: t.id, is_custom_energy_cost: t.is_custom_energy_cost, 
            created_at: t.created_at, task_environment: t.task_environment, is_work: t.is_work || false, is_break: t.is_break || false 
          }); 
          globalScheduledIdsToDelete.push(t.id); 
        });
        (ar || []).forEach(t => { 
          pool.push({ 
            id: t.id, name: t.name || 'Untitled Task', duration: t.duration || 30, 
            break_duration: t.break_duration, is_critical: t.is_critical, is_flexible: true, is_backburner: t.is_backburner, 
            energy_cost: t.energy_cost, source: 'retired', originalId: t.id, is_custom_energy_cost: t.is_custom_energy_cost, 
            created_at: t.retired_at, task_environment: t.task_environment, is_work: t.is_work || false, is_break: t.is_break || false 
          }); 
          globalRetiredIdsToDelete.push(t.id); 
        });
      } else if (taskSource === 'sink-only' || taskSource === 'sink-to-gaps') {
        const { data: ret } = await supabase.from('aethersink').select('*').eq('user_id', userId).eq('is_locked', false);
        (ret || []).forEach(t => { 
          pool.push({ 
            id: t.id, name: t.name || 'Untitled Task', duration: t.duration || 30, 
            break_duration: t.break_duration, is_critical: t.is_critical, is_flexible: true, is_backburner: t.is_backburner, 
            energy_cost: t.energy_cost, source: 'retired', originalId: t.id, is_custom_energy_cost: t.is_custom_energy_cost, 
            created_at: t.retired_at, task_environment: t.task_environment, is_work: t.is_work || false, is_break: t.is_break || false 
          }); 
          globalRetiredIdsToDelete.push(t.id); 
        });
      } else if (taskSource === 'all-flexible') {
        const { data: dt } = await supabase.from('scheduled_tasks').select('*').eq('user_id', userId).eq('scheduled_date', targetDateString).eq('is_flexible', true).eq('is_locked', false);
        (dt || []).forEach(t => { 
          pool.push({ 
            id: t.id, name: t.name || 'Untitled Task', duration: t.start_time && t.end_time ? differenceInMinutes(parseISO(t.end_time), parseISO(t.start_time)) : 30, 
            break_duration: t.break_duration, is_critical: t.is_critical, is_flexible: true, is_backburner: t.is_backburner, 
            energy_cost: t.energy_cost, source: 'scheduled', originalId: t.id, is_custom_energy_cost: t.is_custom_energy_cost, 
            created_at: t.created_at, task_environment: t.task_environment, is_work: t.is_work || false, is_break: t.is_break || false 
          }); 
          globalScheduledIdsToDelete.push(t.id); 
        });
      } else if (taskSource === 'rebalance-day') {
        // UNIFIED REBALANCE: Wipe local and pull from sink
        const { data: dt } = await supabase.from('scheduled_tasks').select('*').eq('user_id', userId).eq('scheduled_date', targetDateString).eq('is_flexible', true).eq('is_locked', false);
        const { data: ret } = await supabase.from('aethersink').select('*').eq('user_id', userId).eq('is_locked', false);
        
        (dt || []).forEach(t => { 
          pool.push({ 
            id: t.id, name: t.name || 'Untitled Task', duration: t.start_time && t.end_time ? differenceInMinutes(parseISO(t.end_time), parseISO(t.start_time)) : 30, 
            break_duration: t.break_duration, is_critical: t.is_critical, is_flexible: true, is_backburner: t.is_backburner, 
            energy_cost: t.energy_cost, source: 'scheduled', originalId: t.id, is_custom_energy_cost: t.is_custom_energy_cost, 
            created_at: t.created_at, task_environment: t.task_environment, is_work: t.is_work || false, is_break: t.is_break || false 
          }); 
          globalScheduledIdsToDelete.push(t.id); 
        });
        (ret || []).forEach(t => { 
          pool.push({ 
            id: t.id, name: t.name || 'Untitled Task', duration: t.duration || 30, 
            break_duration: t.break_duration, is_critical: t.is_critical, is_flexible: true, is_backburner: t.is_backburner, 
            energy_cost: t.energy_cost, source: 'retired', originalId: t.id, is_custom_energy_cost: t.is_custom_energy_cost, 
            created_at: t.retired_at, task_environment: t.task_environment, is_work: t.is_work || false, is_break: t.is_break || false 
          }); 
          globalRetiredIdsToDelete.push(t.id); 
        });
      }

      console.log(`${functionName} Initial Pool Size: ${pool.length}`);
      console.log(`${functionName} Scheduled IDs to Delete:`, globalScheduledIdsToDelete);
      console.log(`${functionName} Retired IDs to Delete:`, globalRetiredIdsToDelete);

      const daysToProcess = taskSource === 'global-all-future' ? Array.from({ length: futureDaysToSchedule }).map((_, i) => format(addDays(startOfDay(new Date()), i), 'yyyy-MM-dd')) : [targetDateString];

      // --- LIQUID FLOW PLACEMENT LOOP: SEQUENTIAL POINTER LOCK + QUOTA GUARD ---
      for (const currentDateString of daysToProcess) {
        const currentDayAsDate = parseISO(currentDateString);
        if (freshProfile.blocked_days?.includes(currentDateString)) continue;

        const workdayStart = freshProfile.default_auto_schedule_start_time ? setTimeOnDate(currentDayAsDate, freshProfile.default_auto_schedule_start_time) : startOfDay(currentDayAsDate);
        let workdayEnd = freshProfile.default_auto_schedule_end_time ? setTimeOnDate(startOfDay(currentDayAsDate), freshProfile.default_auto_schedule_end_time) : addHours(startOfDay(currentDayAsDate), 17);
        if (isBefore(workdayEnd, workdayStart)) workdayEnd = addDays(workdayEnd, 1);
        
        const workdayTotal = differenceInMinutes(workdayEnd, workdayStart);
        const now = new Date();
        const effectiveSearchStart = isSameDay(currentDayAsDate, now) ? max([now, workdayStart]) : workdayStart;

        const { data: currentDayTasks } = await supabase.from('scheduled_tasks').select('*').eq('user_id', userId).eq('scheduled_date', currentDateString);
        
        // Filter fixed blocks: including locked tasks that weren't part of the delete list
        const fixedBlocks = (currentDayTasks || [])
          .filter(t => !globalScheduledIdsToDelete.includes(t.id))
          .filter(t => !t.is_flexible || t.is_locked || isMeal(t.name) || t.name.toLowerCase().startsWith('reflection'))
          .filter(t => t.start_time && t.end_time)
          .map(t => ({ start: parseISO(t.start_time!), end: parseISO(t.end_time!), duration: differenceInMinutes(parseISO(t.end_time!), parseISO(t.start_time!)) }));
        
        const staticConstraints = getStaticConstraints(freshProfile, currentDayAsDate, workdayStart, workdayEnd);
        let currentOccupied = mergeOverlappingTimeBlocks([...fixedBlocks, ...staticConstraints]);
        
        // Calculate Liquid Minutes for Budget Enforcement
        const occupiedDuration = currentOccupied.reduce((sum, block) => sum + block.duration, 0);
        const liquidMinutes = Math.max(0, workdayTotal - occupiedDuration);

        // Map budgets for this specific day
        const budgets = new Map<string, number>();
        zoneWeights.forEach(zw => {
            budgets.set(zw.value.toLowerCase(), (zw.target_weight / 100) * liquidMinutes);
        });
        
        // Tracking used minutes per environment
        const envUsedMinutes = new Map<string, number>();

        // STRICT GROUPING: sortAndChunkTasks ensures Env sequence is strictly ordered.
        const tasksToPlace = sortAndChunkTasks(pool, freshProfile, sortPreference, workdayTotal, zoneWeights);
        
        // POINTER LOCK: The placement cursor starts at the search beginning and ONLY moves forward.
        let placementCursor = effectiveSearchStart;

        for (const t of tasksToPlace) {
            const env = (t.task_environment || 'laptop').toLowerCase();
            const currentUsed = envUsedMinutes.get(env) || 0;
            const budget = budgets.get(env) ?? 999; // Fallback for envs without explicit weight

            // QUOTA GUARD: Stop placing if we've exceeded the allocated liquid budget for this zone.
            if (currentUsed >= budget) continue;

            const taskTotal = (t.duration || 30) + (t.break_duration || 0);
            
            // Sequential Placement: Search for the first slot available AFTER the previous task.
            const slot = findFirstAvailableSlot(taskTotal, currentOccupied, placementCursor, workdayEnd);
            
            if (slot) {
                globalTasksToInsert.push({ 
                    id: t.source === 'retired' ? undefined : t.originalId, name: t.name || 'Untitled Task', 
                    start_time: slot.start.toISOString(), end_time: slot.end.toISOString(), 
                    break_duration: t.break_duration, scheduled_date: currentDateString, is_critical: t.is_critical, 
                    is_flexible: true, is_locked: false, energy_cost: t.energy_cost, is_completed: false, 
                    is_custom_energy_cost: t.is_custom_energy_cost, task_environment: t.task_environment, 
                    is_backburner: t.is_backburner, is_work: t.is_work, is_break: t.is_break 
                });
                
                // Update tracking
                envUsedMinutes.set(env, currentUsed + (t.duration || 30));
                
                // ADVANCE POINTER: Subsequent tasks (even from other environments) MUST start after this one.
                placementCursor = slot.end;
                
                currentOccupied.push({ start: slot.start, end: slot.end, duration: taskTotal });
                currentOccupied = mergeOverlappingTimeBlocks(currentOccupied);
                
                const idx = pool.findIndex(p => p.id === t.id);
                if (idx !== -1) pool.splice(idx, 1);
            }
        }
      }

      console.log(`${functionName} Final Pool (Unplaced Tasks):`, pool.map(t => t.name));
      console.log(`${functionName} Final Tasks to Insert:`, globalTasksToInsert.map(t => t.name));

      await autoBalanceScheduleMutation.mutateAsync({ 
        scheduledTaskIdsToDelete: Array.from(new Set(globalScheduledIdsToDelete)), 
        retiredTaskIdsToDelete: Array.from(new Set(globalRetiredIdsToDelete)), 
        tasksToInsert: globalTasksToInsert, 
        tasksToKeepInSink: pool.map(t => ({ 
          user_id: userId, name: t.name || 'Untitled Task', duration: t.duration, break_duration: t.break_duration, 
          original_scheduled_date: targetDateString, is_critical: t.is_critical, is_locked: false, energy_cost: t.energy_cost, 
          is_completed: false, is_custom_energy_cost: t.is_custom_energy_cost, task_environment: t.task_environment, 
          is_backburner: t.is_backburner, is_work: t.is_work, is_break: t.is_break 
        })), 
        selectedDate: targetDateString 
      });
      showSuccess("Timeline Stream Synchronized.");
    } catch (e: any) { 
      showError(`Engine Error: ${e.message}`); 
      console.error(`${functionName} Engine Error:`, e); // Log full error
    }
  }, [userId, isSessionLoading, autoBalanceScheduleMutation, todayString]);

  return {
    dbScheduledTasks,
    isLoading,
    addScheduledTask: addScheduledTaskMutation.mutateAsync,
    removeScheduledTask: removeScheduledTaskMutation.mutateAsync,
    completeScheduledTask: completeScheduledTaskMutation.mutateAsync,
    toggleScheduledTaskLock: toggleScheduledTaskLockMutation.mutateAsync,
    toggleAllScheduledTasksLock: toggleAllScheduledTasksLockMutation.mutateAsync,
    clearScheduledTasks: clearScheduledTasksMutation.mutateAsync,
    compactScheduledTasks: compactScheduledTasksMutation.mutateAsync,
    randomizeBreaks: randomizeBreaksMutation.mutateAsync,
    aetherDump: aetherDumpMutation.mutateAsync,
    aetherDumpMega: aetherDumpMegaMutation.mutateAsync,
    pullNextFromSink: pullNextFromSinkMutation.mutateAsync,
    duplicateScheduledTask: duplicateScheduledTaskMutation.mutateAsync,
    moveTaskToTomorrow: moveTaskToTomorrowMutation.mutateAsync,
    updateScheduledTaskDetails: updateScheduledTaskDetailsMutation.mutateAsync,
    datesWithTasks,
    isLoadingDatesWithTasks,
    completedTasksForSelectedDayList,
    handleAutoScheduleAndSort,
    sortBy,
    setSortBy,
    retireTask: retireTaskMutation.mutateAsync,
    toggleScheduledTaskLockMutation,
  };
};