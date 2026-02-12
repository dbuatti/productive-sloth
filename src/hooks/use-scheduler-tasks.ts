"use client";

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DBScheduledTask, NewDBScheduledTask, RetiredTask, SortBy, AutoBalancePayload, UnifiedTask, CompletedTaskLogEntry, TaskEnvironment, TimeBlock, NewRetiredTask } from '@/types/scheduler';
import { useSession, UserProfile } from './use-session';
import { showSuccess, showError } from '@/utils/toast';
import { startOfDay, parseISO, format, differenceInMinutes, isSameDay, max, min, isBefore, addHours, addDays } from 'date-fns';
import { mergeOverlappingTimeBlocks, findFirstAvailableSlot, getEmojiHue, setTimeOnDate, getStaticConstraints, isMeal, sortAndChunkTasks, ZoneWeight } from '@/lib/scheduler-utils';

/**
 * CORE SCHEDULER HOOK
 * Manages the lifecycle of scheduled tasks, including the auto-balance engine.
 */
export const useSchedulerTasks = (selectedDate: string) => {
  const queryClient = useQueryClient();
  const { user, profile, session, isLoading: isSessionLoading } = useSession();
  const userId = user?.id;

  const [sortBy, setSortBy] = useState<SortBy>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('aetherflow-scheduler-sort');
      return (saved as SortBy) || 'ENVIRONMENT_RATIO';
    }
    return 'ENVIRONMENT_RATIO';
  });
  
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('aetherflow-scheduler-sort', sortBy);
  }, [sortBy]);

  // --- Queries ---
  const { data: dbScheduledTasks = [], isLoading } = useQuery<DBScheduledTask[]>({
    queryKey: ['scheduledTasks', userId, selectedDate, sortBy],
    queryFn: async () => {
      if (!userId || !selectedDate) return [];
      let query = supabase.from('scheduled_tasks').select('*').eq('user_id', userId).eq('scheduled_date', selectedDate);
      
      if (sortBy === 'TIME_EARLIEST_TO_LATEST') query = query.order('start_time', { ascending: true });
      else if (sortBy === 'TIME_LATEST_TO_EARLIEST') query = query.order('start_time', { ascending: false });
      else query = query.order('created_at', { ascending: true });

      const { data, error } = await query;
      if (error) throw error;
      
      if (sortBy === 'EMOJI') return (data as DBScheduledTask[]).sort((a, b) => getEmojiHue(a.name) - getEmojiHue(b.name));
      return data as DBScheduledTask[];
    },
    enabled: !!userId && !!selectedDate,
  });

  const { data: datesWithTasks = [], isLoading: isLoadingDatesWithTasks } = useQuery<string[]>({
    queryKey: ['datesWithTasks', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase.from('scheduled_tasks').select('scheduled_date').eq('user_id', userId);
      if (error) throw error;
      return Array.from(new Set(data.map(item => format(parseISO(item.scheduled_date), 'yyyy-MM-dd'))));
    },
    enabled: !!userId,
  });

  // --- Mutations ---
  const addScheduledTaskMutation = useMutation({
    mutationFn: async (newTask: NewDBScheduledTask) => {
      if (!userId) throw new Error("Unauthorized");
      const { data, error } = await supabase.from('scheduled_tasks').insert({ ...newTask, user_id: userId }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks'] });
    }
  });

  const removeScheduledTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      if (!userId) throw new Error("Unauthorized");
      const { error } = await supabase.from('scheduled_tasks').delete().eq('id', taskId).eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks'] });
    }
  });

  const completeScheduledTaskMutation = useMutation({
    mutationFn: async (task: DBScheduledTask) => {
      if (!userId) throw new Error("Unauthorized");
      const priority = task.is_critical ? 'HIGH' : (task.is_backburner ? 'LOW' : 'MEDIUM');
      const { error: logError } = await supabase.from('completedtasks').insert({
        user_id: userId, task_name: task.name, original_id: task.id,
        duration_scheduled: task.start_time && task.end_time ? differenceInMinutes(parseISO(task.end_time), parseISO(task.start_time)) : 30,
        xp_earned: (task.energy_cost || 0) * 2, energy_cost: task.energy_cost, is_critical: task.is_critical,
        original_source: 'scheduled_tasks', original_scheduled_date: task.scheduled_date, is_work: task.is_work, is_break: task.is_break, priority
      });
      if (logError) throw logError;
      await supabase.from('scheduled_tasks').delete().eq('id', task.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['completedTasksForSelectedDay'] });
      showSuccess("Objective Synchronized.");
    }
  });

  const toggleScheduledTaskLockMutation = useMutation({
    mutationFn: async ({ taskId, isLocked }: { taskId: string; isLocked: boolean }) => {
      if (!userId) throw new Error("Unauthorized");
      const { error } = await supabase.from('scheduled_tasks').update({ is_locked: isLocked }).eq('id', taskId).eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
    }
  });

  const toggleAllScheduledTasksLockMutation = useMutation({
    mutationFn: async ({ selectedDate, lockState }: { selectedDate: string; lockState: boolean }) => {
      if (!userId) throw new Error("Unauthorized");
      const { error } = await supabase.from('scheduled_tasks').update({ is_locked: lockState }).eq('user_id', userId).eq('scheduled_date', selectedDate);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
    }
  });

  const autoBalanceScheduleMutation = useMutation<{ tasksPlaced: number; tasksKeptInSink: number }, Error, AutoBalancePayload>({
    mutationFn: async (payload: AutoBalancePayload) => {
      if (!userId || !session?.access_token) throw new Error("Authentication required.");
      const { data, error } = await supabase.functions.invoke('auto-balance-schedule', { body: payload, headers: { 'Authorization': `Bearer ${session.access_token}` } });
      if (error) throw error;
      return data;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks'] });
    }
  });

  // --- Engine Logic ---
  const handleAutoScheduleAndSort = useCallback(async (
    sortPreference: SortBy,
    taskSource: 'all-flexible' | 'sink-only' | 'sink-to-gaps' | 'global-all-future' | 'rebalance-day',
    environmentsToFilterBy: TaskEnvironment[] = [],
    targetDateString: string,
    futureDaysToSchedule: number = 30
  ) => {
    if (isSessionLoading || !userId || !profile) return;

    try {
      const { data: freshEnvs } = await supabase.from('environments').select('value, target_weight').eq('user_id', userId);
      const zoneWeights: ZoneWeight[] = (freshEnvs || []).map(e => ({ value: e.value, target_weight: Number(e.target_weight || 0) }));
      
      let pool: UnifiedTask[] = [];
      let scheduledTaskIdsToDelete: string[] = [];
      let retiredTaskIdsToDelete: string[] = [];
      let tasksToInsert: NewDBScheduledTask[] = [];

      if (taskSource === 'rebalance-day' || taskSource === 'all-flexible') {
        const { data: dt } = await supabase.from('scheduled_tasks').select('*').eq('user_id', userId).eq('scheduled_date', targetDateString).eq('is_flexible', true).eq('is_locked', false);
        (dt || []).forEach(t => {
          pool.push({ 
            id: t.id, name: t.name, duration: t.start_time && t.end_time ? differenceInMinutes(parseISO(t.end_time), parseISO(t.start_time)) : 30,
            break_duration: t.break_duration, is_critical: t.is_critical, is_flexible: true, is_backburner: t.is_backburner,
            energy_cost: t.energy_cost, source: 'scheduled', originalId: t.id, is_custom_energy_cost: t.is_custom_energy_cost,
            created_at: t.created_at, task_environment: t.task_environment, is_work: t.is_work || false, is_break: t.is_break || false
          });
          scheduledTaskIdsToDelete.push(t.id);
        });
      }

      if (taskSource === 'rebalance-day' || taskSource === 'sink-only' || taskSource === 'sink-to-gaps') {
        const { data: ret } = await supabase.from('aethersink').select('*').eq('user_id', userId).eq('is_locked', false);
        (ret || []).forEach(t => {
          pool.push({
            id: t.id, name: t.name, duration: t.duration || 30, break_duration: t.break_duration,
            is_critical: t.is_critical, is_flexible: true, is_backburner: t.is_backburner,
            energy_cost: t.energy_cost, source: 'retired', originalId: t.id, is_custom_energy_cost: t.is_custom_energy_cost,
            created_at: t.retired_at, task_environment: t.task_environment, is_work: t.is_work || false, is_break: t.is_break || false
          });
          retiredTaskIdsToDelete.push(t.id);
        });
      }

      const targetDayAsDate = parseISO(targetDateString);
      const workdayStart = profile.default_auto_schedule_start_time ? setTimeOnDate(targetDayAsDate, profile.default_auto_schedule_start_time) : startOfDay(targetDayAsDate);
      let workdayEnd = profile.default_auto_schedule_end_time ? setTimeOnDate(startOfDay(targetDayAsDate), profile.default_auto_schedule_end_time) : addHours(startOfDay(targetDayAsDate), 17);
      if (isBefore(workdayEnd, workdayStart)) workdayEnd = addDays(workdayEnd, 1);

      const sortedPool = sortAndChunkTasks(pool, profile, sortPreference, differenceInMinutes(workdayEnd, workdayStart), zoneWeights);
      const staticConstraints = getStaticConstraints(profile, targetDayAsDate, workdayStart, workdayEnd);
      
      let currentOccupied = mergeOverlappingTimeBlocks(staticConstraints);
      let cursor = isSameDay(targetDayAsDate, new Date()) ? max([new Date(), workdayStart]) : workdayStart;

      for (const t of sortedPool) {
        const totalDur = (t.duration || 30) + (t.break_duration || 0);
        const slot = findFirstAvailableSlot(totalDur, currentOccupied, cursor, workdayEnd);
        if (slot) {
          tasksToInsert.push({
            name: t.name, start_time: slot.start.toISOString(), end_time: slot.end.toISOString(),
            break_duration: t.break_duration || undefined, scheduled_date: targetDateString,
            is_critical: t.is_critical, is_flexible: true, is_locked: false, energy_cost: t.energy_cost,
            is_custom_energy_cost: t.is_custom_energy_cost, task_environment: t.task_environment,
            is_backburner: t.is_backburner, is_work: t.is_work, is_break: t.is_break
          });
          cursor = slot.end;
          currentOccupied.push({ start: slot.start, end: slot.end, duration: totalDur });
          currentOccupied = mergeOverlappingTimeBlocks(currentOccupied);
          pool = pool.filter(p => p.id !== t.id);
        }
      }

      await autoBalanceScheduleMutation.mutateAsync({
        scheduledTaskIdsToDelete, retiredTaskIdsToDelete, tasksToInsert,
        tasksToKeepInSink: pool.map(t => ({
          user_id: userId, name: t.name, duration: t.duration, break_duration: t.break_duration,
          original_scheduled_date: targetDateString, is_critical: t.is_critical, is_locked: false,
          energy_cost: t.energy_cost, is_completed: false, is_custom_energy_cost: t.is_custom_energy_cost,
          task_environment: t.task_environment, is_backburner: t.is_backburner, is_work: t.is_work, is_break: t.is_break
        })),
        selectedDate: targetDateString
      });
      showSuccess("Timeline Stream Synchronized.");
    } catch (e: any) {
      showError(`Engine Error: ${e.message}`);
    }
  }, [userId, profile, isSessionLoading, autoBalanceScheduleMutation]);

  return {
    dbScheduledTasks, isLoading, datesWithTasks, isLoadingDatesWithTasks, sortBy, setSortBy,
    addScheduledTask: addScheduledTaskMutation.mutateAsync,
    removeScheduledTask: removeScheduledTaskMutation.mutateAsync,
    completeScheduledTask: completeScheduledTaskMutation.mutateAsync,
    toggleScheduledTaskLock: toggleScheduledTaskLockMutation.mutateAsync,
    toggleAllScheduledTasksLock: toggleAllScheduledTasksLockMutation.mutateAsync,
    clearScheduledTasks: async () => {
      await supabase.from('scheduled_tasks').delete().eq('user_id', userId).eq('scheduled_date', selectedDate).eq('is_locked', false);
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      showSuccess("Timeline Cleared.");
    },
    compactScheduledTasks: async ({ tasksToUpdate }: { tasksToUpdate: DBScheduledTask[] }) => {
      if (tasksToUpdate.length > 0) {
        await supabase.from('scheduled_tasks').upsert(tasksToUpdate, { onConflict: 'id' });
        queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
        showSuccess("Schedule Compacted.");
      }
    },
    randomizeBreaks: async ({ selectedDate, workdayStartTime, workdayEndTime, currentDbTasks }: { selectedDate: string; workdayStartTime: Date; workdayEndTime: Date; currentDbTasks: DBScheduledTask[] }) => {
      if (!userId || !profile) return;
      
      const breaks = currentDbTasks.filter(t => t.is_break && !t.is_locked && !t.is_completed);
      if (breaks.length === 0) return;

      const fixedTasks = currentDbTasks.filter(t => t.is_locked || !t.is_flexible || t.is_completed || !t.is_break);
      const staticConstraints = getStaticConstraints(profile, parseISO(selectedDate), workdayStartTime, workdayEndTime);
      
      let occupied = mergeOverlappingTimeBlocks([
        ...fixedTasks.filter(t => t.start_time && t.end_time).map(t => ({
          start: parseISO(t.start_time!),
          end: parseISO(t.end_time!),
          duration: differenceInMinutes(parseISO(t.end_time!), parseISO(t.start_time!))
        })),
        ...staticConstraints
      ]);

      const shuffledBreaks = [...breaks].sort(() => Math.random() - 0.5);
      const updates: DBScheduledTask[] = [];
      let cursor = isSameDay(parseISO(selectedDate), new Date()) ? max([new Date(), workdayStartTime]) : workdayStartTime;

      for (const b of shuffledBreaks) {
        const dur = b.start_time && b.end_time ? differenceInMinutes(parseISO(b.end_time), parseISO(b.start_time)) : 15;
        const slot = findFirstAvailableSlot(dur, occupied, cursor, workdayEndTime);
        if (slot) {
          updates.push({ ...b, start_time: slot.start.toISOString(), end_time: slot.end.toISOString() });
          occupied.push({ start: slot.start, end: slot.end, duration: dur });
          occupied = mergeOverlappingTimeBlocks(occupied);
        }
      }

      if (updates.length > 0) {
        await supabase.from('scheduled_tasks').upsert(updates);
        queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
        showSuccess("Breaks Randomized.");
      }
    },
    aetherDump: async () => {
      if (!userId) return;
      const { data: tasks } = await supabase.from('scheduled_tasks').select('*').eq('user_id', userId).eq('scheduled_date', selectedDate).eq('is_flexible', true).eq('is_locked', false);
      if (!tasks || tasks.length === 0) return showSuccess("No flexible tasks to dump.");
      
      const retiredTasks: NewRetiredTask[] = tasks.map(t => ({
        user_id: userId, name: t.name, duration: t.start_time && t.end_time ? differenceInMinutes(parseISO(t.end_time), parseISO(t.start_time)) : 30,
        break_duration: t.break_duration, original_scheduled_date: t.scheduled_date, retired_at: new Date().toISOString(),
        is_critical: t.is_critical, is_locked: false, energy_cost: t.energy_cost, is_completed: false,
        is_custom_energy_cost: t.is_custom_energy_cost, task_environment: t.task_environment,
        is_backburner: t.is_backburner, is_work: t.is_work, is_break: t.is_break
      }));

      await supabase.from('aethersink').upsert(retiredTasks, { onConflict: 'user_id, name, original_scheduled_date' });
      await supabase.from('scheduled_tasks').delete().in('id', tasks.map(t => t.id));
      
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
      showSuccess(`${tasks.length} objectives retired to Sink.`);
    },
    aetherDumpMega: async () => {
      if (!userId) return;
      const { data: tasks } = await supabase.from('scheduled_tasks').select('*').eq('user_id', userId).eq('is_flexible', true).eq('is_locked', false);
      if (!tasks || tasks.length === 0) return showSuccess("No flexible tasks to dump.");
      
      const retiredTasks: NewRetiredTask[] = tasks.map(t => ({
        user_id: userId, name: t.name, duration: t.start_time && t.end_time ? differenceInMinutes(parseISO(t.end_time), parseISO(t.start_time)) : 30,
        break_duration: t.break_duration, original_scheduled_date: t.scheduled_date, retired_at: new Date().toISOString(),
        is_critical: t.is_critical, is_locked: false, energy_cost: t.energy_cost, is_completed: false,
        is_custom_energy_cost: t.is_custom_energy_cost, task_environment: t.task_environment,
        is_backburner: t.is_backburner, is_work: t.is_work, is_break: t.is_break
      }));

      await supabase.from('aethersink').upsert(retiredTasks, { onConflict: 'user_id, name, original_scheduled_date' });
      await supabase.from('scheduled_tasks').delete().in('id', tasks.map(t => t.id));
      
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
      showSuccess("Global timeline flush complete.");
    },
    retireTask: async (task: DBScheduledTask) => {
      const retired = { 
        user_id: userId, name: task.name, duration: task.start_time && task.end_time ? differenceInMinutes(parseISO(task.end_time), parseISO(task.start_time)) : 30,
        break_duration: task.break_duration, original_scheduled_date: task.scheduled_date, retired_at: new Date().toISOString(),
        is_critical: task.is_critical, is_locked: false, energy_cost: task.energy_cost, is_completed: false,
        is_custom_energy_cost: task.is_custom_energy_cost, task_environment: task.task_environment,
        is_backburner: task.is_backburner, is_work: task.is_work, is_break: task.is_break
      };
      await supabase.from('aethersink').upsert(retired, { onConflict: 'user_id, name, original_scheduled_date' });
      await supabase.from('scheduled_tasks').delete().eq('id', task.id);
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
      showSuccess(`"${task.name}" retired.`);
    },
    handleAutoScheduleAndSort,
    pullNextFromSink: async ({ selectedDateString, workdayStart, workdayEnd, T_current, staticConstraints }: { selectedDateString: string; workdayStart: Date; workdayEnd: Date; T_current: Date; staticConstraints: TimeBlock[] }) => {
      if (!userId) return;
      
      const { data: sinkTasks } = await supabase.from('aethersink').select('*').eq('user_id', userId).eq('is_locked', false).order('retired_at', { ascending: false }).limit(1);
      if (!sinkTasks || sinkTasks.length === 0) return showError("Sink is empty.");
      
      const task = sinkTasks[0];
      const duration = task.duration || 30;
      const totalDur = duration + (task.break_duration || 0);

      const { data: currentTasks } = await supabase.from('scheduled_tasks').select('*').eq('user_id', userId).eq('scheduled_date', selectedDateString);
      const occupied = mergeOverlappingTimeBlocks([
        ...(currentTasks || []).filter(t => t.start_time && t.end_time).map(t => ({
          start: parseISO(t.start_time!),
          end: parseISO(t.end_time!),
          duration: differenceInMinutes(parseISO(t.end_time!), parseISO(t.start_time!))
        })),
        ...staticConstraints
      ]);

      const searchStart = isSameDay(parseISO(selectedDateString), new Date()) ? max([T_current, workdayStart]) : workdayStart;
      const slot = findFirstAvailableSlot(totalDur, occupied, searchStart, workdayEnd);

      if (!slot) return showError("No available slot found.");

      const { error: insertError } = await supabase.from('scheduled_tasks').insert({
        user_id: userId, name: task.name, start_time: slot.start.toISOString(), end_time: slot.end.toISOString(),
        break_duration: task.break_duration, scheduled_date: selectedDateString, is_critical: task.is_critical,
        is_flexible: true, is_locked: false, energy_cost: task.energy_cost, is_custom_energy_cost: task.is_custom_energy_cost,
        task_environment: task.task_environment, is_backburner: task.is_backburner, is_work: task.is_work, is_break: task.is_break
      });

      if (insertError) throw insertError;
      await supabase.from('aethersink').delete().eq('id', task.id);
      
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
      showSuccess(`Pulled "${task.name}" into timeline.`);
    },
    duplicateScheduledTask: async (task: DBScheduledTask) => {
      const { id, created_at, updated_at, ...rest } = task;
      await supabase.from('scheduled_tasks').insert({ ...rest, name: `${task.name} (Copy)`, is_completed: false });
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      showSuccess("Objective Duplicated.");
    },
    moveTaskToTomorrow: async (task: DBScheduledTask) => {
      const tomorrow = format(addDays(parseISO(task.scheduled_date), 1), 'yyyy-MM-dd');
      await supabase.from('scheduled_tasks').update({ scheduled_date: tomorrow }).eq('id', task.id);
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      showSuccess("Objective Punted.");
    },
    updateScheduledTaskDetails: async (task: Partial<DBScheduledTask> & { id: string }) => {
      await supabase.from('scheduled_tasks').update({ ...task, updated_at: new Date().toISOString() }).eq('id', task.id);
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      showSuccess("Objective Updated.");
    }
  };
};