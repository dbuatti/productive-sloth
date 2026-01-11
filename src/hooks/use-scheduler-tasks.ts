"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DBScheduledTask, NewDBScheduledTask, RetiredTask, NewRetiredTask, SortBy, TimeBlock, AutoBalancePayload, UnifiedTask, CompletedTaskLogEntry, TaskEnvironment } from '@/types/scheduler';
import { useSession, UserProfile } from './use-session';
import { showSuccess, showError } from '@/utils/toast';
import { startOfDay, parseISO, format, addMinutes, isBefore, addDays, differenceInMinutes, addHours, isSameDay, max, min, isAfter } from 'date-fns';
import { mergeOverlappingTimeBlocks, findFirstAvailableSlot, getEmojiHue, setTimeOnDate, getStaticConstraints, isMeal, sortAndChunkTasks, formatTime, calculateSpatialPhases, ZoneWeight } from '@/lib/scheduler-utils';

// --- Constants for Engine Protection ---
const LOW_TIME_THRESHOLD = 180; // 3 hours
const MIN_PHASE_DURATION = 30; // 30 minutes

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
      console.log(`[useSchedulerTasks] Fetching schedule for ${formattedSelectedDate} (Sort: ${sortBy})`);
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
      if (!userId || !formattedSelectedDate) return [];
      const { data, error } = await supabase.from('completedtasks').select('*').eq('user_id', userId).eq('original_scheduled_date', formattedSelectedDate);
      if (error) throw error;
      return (data || []).map(task => ({ ...task, effective_duration_minutes: task.duration_used || task.duration_scheduled || 30, name: task.task_name, original_source: task.original_source || 'scheduled_tasks' })) as CompletedTaskLogEntry[];
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
      const { data, error } = await supabase.from('scheduled_tasks').insert({ ...newTask, user_id: userId }).select().single();
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
      const { error: logError } = await supabase.from('completedtasks').insert({
        user_id: userId,
        task_name: task.name,
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
      });
      if (logError) throw logError;
      const { error: deleteError } = await supabase.from('scheduled_tasks').delete().eq('id', task.id);
      if (deleteError) throw deleteError;
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
      const { error = null } = await supabase.from('scheduled_tasks').update({ is_locked: lockState }).eq('user_id', userId).eq('scheduled_date', selectedDate);
      if (error) throw error;
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
      const payload = tasksToUpdate.map(({ id, start_time, end_time }) => ({ id, start_time, end_time, user_id: userId }));
      const { error = null } = await supabase.from('scheduled_tasks').upsert(payload, { onConflict: 'id' });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] })
  });

  const randomizeBreaksMutation = useMutation({
    mutationFn: async ({ selectedDate, workdayStartTime, workdayEndTime, currentDbTasks }: any) => {
      const breaks = currentDbTasks.filter((t: any) => t.name.toLowerCase() === 'break' && !t.is_locked);
      if (breaks.length === 0) return;
      const otherBlocks = currentDbTasks.filter((t: any) => t.name.toLowerCase() !== 'break' || t.is_locked).map((t: any) => ({ start: parseISO(t.start_time!), end: parseISO(t.end_time!) }));
      const dayDate = parseISO(selectedDate);
      const staticConstraints = getStaticConstraints(profile!, dayDate, workdayStartTime, workdayEndTime);
      let occupied = mergeOverlappingTimeBlocks([...otherBlocks, ...staticConstraints]);
      const updated = [];
      for (const b of breaks) {
        const dur = differenceInMinutes(parseISO(b.end_time!), parseISO(b.start_time!));
        const slot = findFirstAvailableSlot(dur, occupied, workdayStartTime, workdayEndTime);
        if (slot) {
          updated.push({ id: b.id, start_time: slot.start.toISOString(), end_time: slot.end.toISOString(), user_id: userId });
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
      const retired = toDump.map(t => ({ user_id: userId, name: t.name, duration: t.start_time && t.end_time ? differenceInMinutes(parseISO(t.end_time), parseISO(t.start_time)) : 30, break_duration: t.break_duration, original_scheduled_date: t.scheduled_date, retired_at: new Date().toISOString(), is_critical: t.is_critical, is_locked: false, energy_cost: t.energy_cost, is_completed: false, is_custom_energy_cost: t.is_custom_energy_cost, task_environment: t.task_environment, is_backburner: t.is_backburner, is_work: t.is_work, is_break: t.is_break }));
      await supabase.from('aethersink').insert(retired);
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
      const retired = toDump.map(t => ({ user_id: userId, name: t.name, duration: t.start_time && t.end_time ? differenceInMinutes(parseISO(t.end_time), parseISO(t.start_time)) : 30, break_duration: t.break_duration, original_scheduled_date: t.scheduled_date, retired_at: new Date().toISOString(), is_critical: t.is_critical, is_locked: false, energy_cost: t.energy_cost, is_completed: false, is_custom_energy_cost: t.is_custom_energy_cost, task_environment: t.task_environment, is_backburner: t.is_backburner, is_work: t.is_work, is_break: t.is_break }));
      await supabase.from('aethersink').insert(retired);
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
      console.log(`[useSchedulerTasks] PULL NEXT: Searching for objective in Aether Sink...`);
      const { data: sink } = await supabase.from('aethersink').select('*').eq('user_id', userId).eq('is_locked', false).order('is_critical', { ascending: false }).limit(1).single();
      if (!sink) return showSuccess("Aether Sink Vacant.");
      
      console.log(`[useSchedulerTasks] PULL NEXT: Attempting to schedule "${sink.name}"...`);
      const { data: current } = await supabase.from('scheduled_tasks').select('*').eq('user_id', userId).eq('scheduled_date', selectedDateString);
      const blocks = (current || []).filter(t => t.start_time && t.end_time).map(t => ({ start: parseISO(t.start_time!), end: parseISO(t.end_time!) }));
      const occupied = mergeOverlappingTimeBlocks([...blocks, ...staticConstraints]);
      const searchStart = isSameDay(parseISO(selectedDateString), new Date()) ? max([workdayStart, T_current]) : workdayStart;
      const dur = sink.duration || 30;
      const slot = findFirstAvailableSlot(dur, occupied, searchStart, workdayEnd);
      
      if (!slot) {
          console.warn(`[useSchedulerTasks] PULL NEXT: Insufficient temporal gap for "${sink.name}" (${dur}m).`);
          return showError("No valid gap available.");
      }
      
      await supabase.from('scheduled_tasks').insert({ user_id: userId, name: sink.name, start_time: slot.start.toISOString(), end_time: slot.end.toISOString(), scheduled_date: selectedDateString, is_critical: sink.is_critical, is_flexible: true, is_locked: false, energy_cost: sink.energy_cost, task_environment: sink.task_environment, is_backburner: sink.is_backburner, is_work: sink.is_work, is_break: sink.is_break });
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
      const { data, error } = await supabase.from('scheduled_tasks').insert({ ...rest, name: `${task.name} (Copy)`, is_completed: false }).select().single();
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

  const updateScheduledTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, isCompleted }: { taskId: string, isCompleted: boolean }) => {
      const { error = null } = await supabase.from('scheduled_tasks').update({ is_completed: isCompleted }).eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] })
  });

  const updateScheduledTaskDetailsMutation = useMutation({
    mutationFn: async (task: Partial<DBScheduledTask> & { id: string }) => {
      if (!userId) throw new Error("User not authenticated.");
      const { data, error = null } = await supabase.from('scheduled_tasks').update({ ...task, updated_at: new Date().toISOString() }).eq('id', task.id).eq('user_id', userId).select().single();
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
      const { data, error = null } = await supabase.functions.invoke('auto-balance-schedule', { body: payload, headers: { 'Authorization': `Bearer ${session.access_token}` } });
      if (error) throw new Error(data.error || error.message);
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
      const retired = { user_id: userId, name: task.name, duration: task.start_time && task.end_time ? differenceInMinutes(parseISO(task.end_time), parseISO(task.start_time)) : 30, break_duration: task.break_duration, original_scheduled_date: task.scheduled_date, retired_at: new Date().toISOString(), is_critical: task.is_critical, is_locked: false, energy_cost: task.energy_cost, is_completed: false, is_custom_energy_cost: task.is_custom_energy_cost, task_environment: task.task_environment, is_backburner: task.is_backburner, is_work: task.is_work, is_break: task.is_break };
      await supabase.from('aethersink').insert(retired);
      await supabase.from('scheduled_tasks').delete().eq('id', task.id);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
    }
  });

  const handleAutoScheduleAndSort = useCallback(async (
    sortPreference: SortBy,
    taskSource: 'all-flexible' | 'sink-only' | 'sink-to-gaps' | 'global-all-future',
    environmentsToFilterBy: TaskEnvironment[] = [],
    targetDateString: string,
    futureDaysToSchedule: number = 30
  ) => {
    if (isSessionLoading || !userId) {
      console.log("[useSchedulerTasks] Engine stalled: Waiting for profile synchronization.");
      return;
    }

    console.log(`[useSchedulerTasks] ENGINE TELEMETRY INITIATED. Mode: ${taskSource}, Sort: ${sortPreference}`);

    try {
      // ATOMIC FETCH: Get fresh environments AND fresh profile state simultaneously
      const [envsResponse, profileResponse] = await Promise.all([
        supabase.from('environments').select('value, target_weight').eq('user_id', userId),
        supabase.from('profiles').select('*').eq('id', userId).single()
      ]);

      if (envsResponse.error) throw envsResponse.error;
      if (profileResponse.error) throw profileResponse.error;
      
      const freshEnvs = envsResponse.data;
      const freshProfile = profileResponse.data as UserProfile;
      
      // VERIFICATION: Map weights explicitly to ZoneWeight format
      const zoneWeights: ZoneWeight[] = freshEnvs.map(e => ({
        value: e.value,
        target_weight: Number(e.target_weight || 0)
      }));
      
      let totalWeightCheck = zoneWeights.reduce((s, zw) => s + zw.target_weight, 0);
      console.log(`[useSchedulerTasks] Spatial Matrix verified. Active Zones: ${zoneWeights.length}, Total Weight: ${totalWeightCheck}%`);

      if (totalWeightCheck === 0) {
        console.warn("[useSchedulerTasks] ENGINE GUARD: Global weight is zero. Spatial balancing is impossible.");
        return showError("All zone weights are 0%. Update Spatial Budgeting in Settings.");
      }

      const initialTargetDayAsDate = parseISO(targetDateString);
      if (isBefore(initialTargetDayAsDate, startOfDay(new Date())) && taskSource !== 'global-all-future') {
        return showError("Historical timelines are read-only.");
      }

      let pool: UnifiedTask[] = [];
      let globalScheduledIdsToDelete: string[] = [];
      let globalRetiredIdsToDelete: string[] = [];
      let globalTasksToInsert: NewDBScheduledTask[] = [];

      if (taskSource === 'global-all-future') {
        const { data: fs } = await supabase.from('scheduled_tasks').select('*').eq('user_id', userId).gte('scheduled_date', todayString).eq('is_flexible', true).eq('is_locked', false);
        const { data: ar } = await supabase.from('aethersink').select('*').eq('user_id', userId).eq('is_locked', false);
        (fs || []).forEach(t => {
          pool.push({ id: t.id, name: t.name, duration: t.start_time && t.end_time ? differenceInMinutes(parseISO(t.end_time), parseISO(t.start_time)) : 30, break_duration: t.break_duration, is_critical: t.is_critical, is_flexible: true, is_backburner: t.is_backburner, energy_cost: t.energy_cost, source: 'scheduled', originalId: t.id, is_custom_energy_cost: t.is_custom_energy_cost, created_at: t.created_at, task_environment: t.task_environment, is_work: t.is_work || false, is_break: t.is_break || false });
          globalScheduledIdsToDelete.push(t.id);
        });
        (ar || []).forEach(t => {
          pool.push({ id: t.id, name: t.name, duration: t.duration || 30, break_duration: t.break_duration, is_critical: t.is_critical, is_flexible: true, is_backburner: t.is_backburner, energy_cost: t.energy_cost, source: 'retired', originalId: t.id, is_custom_energy_cost: t.is_custom_energy_cost, created_at: t.retired_at, task_environment: t.task_environment, is_work: t.is_work || false, is_break: t.is_break || false });
          globalRetiredIdsToDelete.push(t.id);
        });
      } else if (taskSource === 'sink-only' || taskSource === 'sink-to-gaps') {
        const { data: ret } = await supabase.from('aethersink').select('*').eq('user_id', userId).eq('is_locked', false);
        (ret || []).forEach(t => {
          pool.push({ id: t.id, name: t.name, duration: t.duration || 30, break_duration: t.break_duration, is_critical: t.is_critical, is_flexible: true, is_backburner: t.is_backburner, energy_cost: t.energy_cost, source: 'retired', originalId: t.id, is_custom_energy_cost: t.is_custom_energy_cost, created_at: t.retired_at, task_environment: t.task_environment, is_work: t.is_work || false, is_break: t.is_break || false });
          globalRetiredIdsToDelete.push(t.id);
        });
      } else if (taskSource === 'all-flexible') {
        const { data: dt } = await supabase.from('scheduled_tasks').select('*').eq('user_id', userId).eq('scheduled_date', targetDateString).eq('is_flexible', true).eq('is_locked', false);
        (dt || []).forEach(t => {
          pool.push({ id: t.id, name: t.name, duration: t.start_time && t.end_time ? differenceInMinutes(parseISO(t.end_time), parseISO(t.start_time)) : 30, break_duration: t.break_duration, is_critical: t.is_critical, is_flexible: true, is_backburner: t.is_backburner, energy_cost: t.energy_cost, source: 'scheduled', originalId: t.id, is_custom_energy_cost: t.is_custom_energy_cost, created_at: t.created_at, task_environment: t.task_environment, is_work: t.is_work || false, is_break: t.is_break || false });
          globalScheduledIdsToDelete.push(t.id);
        });
      }

      console.log(`[useSchedulerTasks] Unified Pool Ready. Objectives to place: ${pool.length}`);

      const daysToProcess = taskSource === 'global-all-future' ? Array.from({ length: futureDaysToSchedule }).map((_, i) => format(addDays(startOfDay(new Date()), i), 'yyyy-MM-dd')) : [targetDateString];

      for (const currentDateString of daysToProcess) {
        const currentDayAsDate = parseISO(currentDateString);
        if (freshProfile.blocked_days?.includes(currentDateString)) {
           console.log(`[useSchedulerTasks] Skipping ${currentDateString}: Day is blocked.`);
           continue;
        }

        const workdayStart = freshProfile.default_auto_schedule_start_time ? setTimeOnDate(currentDayAsDate, freshProfile.default_auto_schedule_start_time) : startOfDay(currentDayAsDate);
        let workdayEnd = freshProfile.default_auto_schedule_end_time ? setTimeOnDate(startOfDay(currentDayAsDate), freshProfile.default_auto_schedule_end_time) : addHours(startOfDay(currentDayAsDate), 17);
        if (isBefore(workdayEnd, workdayStart)) workdayEnd = addDays(workdayEnd, 1);
        
        const now = new Date();
        const effectiveStart = isSameDay(currentDayAsDate, now) ? max([now, workdayStart]) : workdayStart;
        const availableMinutes = differenceInMinutes(workdayEnd, effectiveStart);

        console.log(`[useSchedulerTasks] Processing ${currentDateString}. Window: ${formatTime(effectiveStart)} - ${formatTime(workdayEnd)} (${availableMinutes}m)`);

        if (availableMinutes <= 0) {
            console.log(`[useSchedulerTasks] Skipping ${currentDateString}: Time window closed.`);
            continue;
        }

        const { data: dt } = await supabase.from('scheduled_tasks').select('*').eq('user_id', userId).eq('scheduled_date', currentDateString);
        const fixedBlocks = (dt || []).filter(t => !t.is_flexible || t.is_locked || isMeal(t.name) || t.name.toLowerCase().startsWith('reflection')).filter(t => t.start_time && t.end_time).map(t => ({ start: parseISO(t.start_time!), end: parseISO(t.end_time!), duration: differenceInMinutes(parseISO(t.end_time!), parseISO(t.start_time!)) }));
        const staticConstraints = getStaticConstraints(freshProfile, currentDayAsDate, workdayStart, workdayEnd);
        let currentOccupied = mergeOverlappingTimeBlocks([...fixedBlocks, ...staticConstraints]);

        const validEnvValues = zoneWeights.map(e => e.value);
        
        // FIX: Robust Sequence Derivation
        let envSequence = freshProfile.custom_environment_order?.length 
          ? freshProfile.custom_environment_order.filter(val => validEnvValues.includes(val))
          : validEnvValues;
        
        if (envSequence.length === 0 && validEnvValues.length > 0) {
            console.warn("[useSchedulerTasks] Sequence was empty after strict validation. Falling back to valid matrix values.");
            envSequence = validEnvValues;
        }
        
        console.log(`[useSchedulerTasks] Validated Sequence: ${envSequence.join(' -> ')}`);

        // --- SPATIAL PHASE GENERATION ---
        let iterativeWeights = [...zoneWeights];

        if (availableMinutes < LOW_TIME_THRESHOLD && iterativeWeights.length > 1) {
          console.log(`[useSchedulerTasks] TEMPORAL COMPRESSION: Consolidating zones (Remaining: ${availableMinutes}m).`);
          const sortedEnvs = [...iterativeWeights].filter(zw => zw.target_weight > 0).sort((a, b) => b.target_weight - a.target_weight);
          const limit = availableMinutes < 90 ? 1 : (availableMinutes < 120 ? 2 : 3);
          const topEnvs = sortedEnvs.slice(0, limit);
          if (topEnvs.length > 0) {
            const totalTopWeight = topEnvs.reduce((s, e) => s + e.target_weight, 0);
            iterativeWeights = topEnvs.map(zw => ({ value: zw.value, target_weight: (zw.target_weight / totalTopWeight) * 100 }));
          }
        }

        const phases = calculateSpatialPhases(availableMinutes, effectiveStart, workdayEnd, iterativeWeights, envSequence, freshProfile.enable_macro_spread || false, MIN_PHASE_DURATION);

        console.log(`[useSchedulerTasks] Generated ${phases.length} spatial phases for ${currentDateString}.`);

        // --- PHASE-BASED PLACEMENT ---
        if (phases.length > 0) {
          let placementCursor = effectiveStart;
          for (const phase of phases) {
            const phaseTasks = pool.filter(t => t.task_environment === phase.env);
            if (phaseTasks.length === 0) continue;

            phaseTasks.sort((a, b) => {
                if (a.is_critical !== b.is_critical) return a.is_critical ? -1 : 1;
                if (a.is_break !== b.is_break) return a.is_break ? -1 : 1;
                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            });

            for (const t of phaseTasks) {
                const taskTotal = (t.duration || 30) + (t.break_duration || 0);
                const searchStart = max([placementCursor, phase.start]);
                const searchEnd = min([workdayEnd, phase.end]);
                
                if (isBefore(searchEnd, searchStart)) continue;

                const slot = findFirstAvailableSlot(taskTotal, currentOccupied, searchStart, searchEnd);
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
                  
                  const idx = pool.findIndex(pt => pt.id === t.id);
                  if (idx !== -1) pool.splice(idx, 1);
                }
            }
          }
        } 
        
        // --- FALLBACK: PRIORITY-FILL ---
        if (pool.length > 0 && isBefore(effectiveStart, workdayEnd)) {
            console.log(`[useSchedulerTasks] Running Priority-Fill Fallback for ${pool.length} tasks.`);
            
            pool.sort((a, b) => {
                if (a.is_critical !== b.is_critical) return a.is_critical ? -1 : 1;
                if (a.is_break !== b.is_break) return a.is_break ? -1 : 1;
                return 0;
            });

            let fallbackCursor = effectiveStart;
            for (let i = 0; i < pool.length; i++) {
                const t = pool[i];
                const taskTotal = (t.duration || 30) + (t.break_duration || 0);
                const slot = findFirstAvailableSlot(taskTotal, currentOccupied, fallbackCursor, workdayEnd);
                
                if (slot) {
                  globalTasksToInsert.push({ 
                      id: t.source === 'retired' ? undefined : t.originalId, name: t.name, start_time: slot.start.toISOString(), end_time: slot.end.toISOString(), 
                      break_duration: t.break_duration, scheduled_date: currentDateString, is_critical: t.is_critical, is_flexible: true, is_locked: false, 
                      energy_cost: t.energy_cost, is_completed: false, is_custom_energy_cost: t.is_custom_energy_cost, task_environment: t.task_environment, 
                      is_backburner: t.is_backburner, is_work: t.is_work, is_break: t.is_break 
                  });
                  currentOccupied.push({ start: slot.start, end: slot.end, duration: taskTotal });
                  currentOccupied = mergeOverlappingTimeBlocks(currentOccupied);
                  fallbackCursor = slot.end;
                  
                  pool.splice(i, 1);
                  i--;
                }
            }
        }
      }

      console.log(`[useSchedulerTasks] Engine Sync Complete. Placed: ${globalTasksToInsert.length}, Unplaced: ${pool.length}`);

      const globalTasksToKeepInSink: NewRetiredTask[] = pool.map(t => ({
        user_id: userId,
        name: t.name,
        duration: t.duration,
        break_duration: t.break_duration,
        original_scheduled_date: targetDateString,
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

      await autoBalanceScheduleMutation.mutateAsync({ 
        scheduledTaskIdsToDelete: Array.from(new Set(globalScheduledIdsToDelete)), 
        retiredTaskIdsToDelete: Array.from(new Set(globalRetiredIdsToDelete)), 
        tasksToInsert: globalTasksToInsert, tasksToKeepInSink: globalTasksToKeepInSink, selectedDate: targetDateString 
      });

    } catch (e: any) { 
      console.error(`[useSchedulerTasks] ENGINE CRITICAL FAILURE:`, e);
      showError(`Engine Error: ${e.message}`); 
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
    updateScheduledTaskStatus: updateScheduledTaskStatusMutation.mutateAsync,
    retireTask: retireTaskMutation.mutateAsync,
    datesWithTasks,
    isLoadingDatesWithTasks,
    completedTasksForSelectedDayList,
    handleAutoScheduleAndSort,
    sortBy,
    setSortBy,
    updateScheduledTaskDetails: updateScheduledTaskDetailsMutation.mutateAsync,
    toggleScheduledTaskLockMutation,
  };
};