import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Task, NewTask, TaskStatusFilter, TemporalFilter } from '@/types';
import { DBScheduledTask, NewDBScheduledTask, RawTaskInput, RetiredTask, NewRetiredTask, SortBy, TaskPriority, TimeBlock, AutoBalancePayload, UnifiedTask, RetiredTaskSortBy, CompletedTaskLogEntry, TaskEnvironment } from '@/types/scheduler';
import { useSession } from './use-session';
import { showSuccess, showError } from '@/utils/toast';
import { startOfDay, subDays, formatISO, parseISO, isToday, isYesterday, format, addMinutes, isBefore, isAfter, addDays, differenceInMinutes, addHours, isSameDay, max, min, isEqual } from 'date-fns';
import { XP_PER_LEVEL, MAX_ENERGY, DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION, LOW_ENERGY_THRESHOLD } from '@/lib/constants';
import { mergeOverlappingTimeBlocks, getFreeTimeBlocks, findFirstAvailableSlot, isSlotFree, calculateEnergyCost, compactScheduleLogic, getEmojiHue, setTimeOnDate } from '@/lib/scheduler-utils';

// Helper to log to both console and toast for visibility
const engineLog = (message: string, type: 'info' | 'warn' | 'error' = 'info') => {
  console.log(`[SchedulerEngine] ${message}`);
  if (type === 'error') showError(message);
  // We only toast info/warn if it's a significant event to avoid spamming, 
  // but for debugging we can toast everything temporarily.
  // For now, let's toast specific critical steps.
};

export const useSchedulerTasks = (selectedDate: string, scrollRef?: React.RefObject<HTMLElement>) => {
  const queryClient = useQueryClient();
  const { user, profile, session, T_current } = useSession();
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

  const { data: mealAssignments = [] } = useQuery({
    queryKey: ['mealAssignments', userId, formattedSelectedDate],
    queryFn: async () => {
      if (!userId || !formattedSelectedDate) return [];
      const { data, error } = await supabase
        .from('meal_assignments')
        .select('*, meal_idea:meal_ideas(*)')
        .eq('assigned_date', formattedSelectedDate)
        .eq('user_id', userId);
      if (error) throw error;
      return data;
    },
    enabled: !!userId && !!formattedSelectedDate,
  });

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

  const dbScheduledTasksWithMeals = useMemo(() => {
    return dbScheduledTasks.map(task => {
      const isMealTask = ['breakfast', 'lunch', 'dinner'].includes(task.name.toLowerCase());
      if (isMealTask) {
        const assignment = mealAssignments.find(a => a.meal_type === task.name.toLowerCase());
        if (assignment?.meal_idea?.name) {
          return { ...task, name: assignment.meal_idea.name };
        }
      }
      return task;
    });
  }, [dbScheduledTasks, mealAssignments]);

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

  const { data: completedTasksForSelectedDayList = [], isLoading: isLoadingCompletedTasksForSelectedDay } = useQuery<CompletedTaskLogEntry[]>({
    queryKey: ['completedTasksForSelectedDayList', userId, formattedSelectedDate],
    queryFn: async () => {
      if (!userId) return [];
      const selectedDayDate = parseISO(formattedSelectedDate);
      const selectedDayStartUTC = new Date(Date.UTC(selectedDayDate.getFullYear(), selectedDayDate.getMonth(), selectedDayDate.getDate())).toISOString();
      const selectedDayEndUTC = new Date(Date.UTC(selectedDayDate.getFullYear(), selectedDayDate.getMonth(), selectedDayDate.getDate() + 1)).toISOString();

      const { data: scheduled } = await supabase.from('scheduled_tasks').select('*').eq('user_id', userId).eq('is_completed', true).gte('updated_at', selectedDayStartUTC).lt('updated_at', selectedDayEndUTC);
      const { data: retired } = await supabase.from('aethersink').select('*').eq('user_id', userId).eq('is_completed', true).gte('retired_at', selectedDayStartUTC).lt('retired_at', selectedDayEndUTC);
      const { data: generalTasks } = await supabase.from('tasks').select('*').eq('user_id', userId).eq('is_completed', true).gte('updated_at', selectedDayStartUTC).lt('updated_at', selectedDayEndUTC);

      const combined: CompletedTaskLogEntry[] = [
        ...(scheduled || []).map(t => ({ ...t, effective_duration_minutes: t.start_time && t.end_time ? differenceInMinutes(parseISO(t.end_time), parseISO(t.start_time)) : 30, original_source: 'scheduled_tasks' as const, task_environment: t.task_environment || 'laptop', is_flexible: t.is_flexible ?? false, is_locked: t.is_locked ?? false })),
        ...(retired || []).map(rt => ({ id: rt.id, user_id: rt.user_id, name: rt.name, effective_duration_minutes: rt.duration || 30, break_duration: rt.break_duration, start_time: null, end_time: null, scheduled_date: rt.original_scheduled_date, created_at: rt.retired_at, updated_at: rt.retired_at, is_critical: rt.is_critical, is_flexible: false, is_locked: rt.is_locked, energy_cost: rt.energy_cost, is_completed: rt.is_completed, is_custom_energy_cost: rt.is_custom_energy_cost, task_environment: rt.task_environment, original_source: 'aethersink' as const })),
        ...(generalTasks || []).map(gt => ({ id: gt.id, user_id: gt.user_id, name: gt.title, effective_duration_minutes: 30, break_duration: null, start_time: null, end_time: null, scheduled_date: format(parseISO(gt.updated_at), 'yyyy-MM-dd'), created_at: gt.created_at, updated_at: gt.updated_at, is_critical: gt.is_critical, is_flexible: false, is_locked: false, energy_cost: gt.energy_cost, is_completed: true, is_custom_energy_cost: gt.is_custom_energy_cost, task_environment: 'laptop' as const, original_source: 'tasks' as const })),
      ];

      return combined.sort((a, b) => parseISO(b.updated_at || b.created_at).getTime() - parseISO(a.updated_at || a.created_at).getTime());
    },
    enabled: !!userId && !!formattedSelectedDate,
  });

  const addScheduledTaskMutation = useMutation({
    mutationFn: async (newTask: NewDBScheduledTask) => {
      if (!userId) throw new Error("User not authenticated.");
      const taskToInsert = { ...newTask, user_id: userId, energy_cost: newTask.energy_cost ?? 0, is_completed: newTask.is_completed ?? false, is_custom_energy_cost: newTask.is_custom_energy_cost ?? false, task_environment: newTask.task_environment ?? 'laptop', source_calendar_id: newTask.source_calendar_id ?? null, is_backburner: newTask.is_backburner ?? false };
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
      const taskToInsert = { ...newTask, user_id: userId, retired_at: new Date().toISOString(), energy_cost: newTask.energy_cost ?? 0, is_completed: newTask.is_completed ?? false, is_custom_energy_cost: newTask.is_custom_energy_cost ?? false, task_environment: newTask.task_environment ?? 'laptop', is_backburner: newTask.is_backburner ?? false };
      const { data, error } = await supabase.from('aethersink').insert(taskToInsert).select().single();
      if (error) throw new Error(error.message);
      return data as RetiredTask;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
      // If a task is added to sink, it might have been from today's schedule (e.g. failed placement)
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday'] });
      showSuccess('Task sent directly to Aether Sink!');
    }
  });

  const removeScheduledTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      if (!userId) throw new Error("User not authenticated.");
      // Fetch the task to get its scheduled_date before deleting
      const { data: taskToDelete, error: fetchError } = await supabase
        .from('scheduled_tasks')
        .select('scheduled_date')
        .eq('id', taskId)
        .eq('user_id', userId)
        .single();

      if (fetchError) throw new Error(fetchError.message);

      const { error } = await supabase.from('scheduled_tasks').delete().eq('id', taskId).eq('user_id', userId);
      if (error) throw new Error(error.message);
      return taskToDelete; // Return the deleted task's info for onSettled
    },
    onSettled: (data) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks'] });
      if (data && data.scheduled_date === todayString) {
        queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday'] });
      }
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
      if (isSelectedDayToday) {
        queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday'] });
      }
      showSuccess('Schedule cleared.');
    }
  });

  const removeRetiredTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      if (!userId) throw new Error("User not authenticated.");
      const { error } = await supabase.from('aethersink').delete().eq('id', taskId).eq('user_id', userId);
      if (error) throw new Error(error.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
      showSuccess('Retired task permanently deleted.');
    }
  });

  const retireTaskMutation = useMutation({
    mutationFn: async (taskToRetire: DBScheduledTask) => {
      if (!userId) throw new Error("User not authenticated.");
      const newRetiredTask: NewRetiredTask = { user_id: userId, name: taskToRetire.name, duration: taskToRetire.start_time && taskToRetire.end_time ? differenceInMinutes(parseISO(taskToRetire.end_time), parseISO(taskToRetire.start_time)) : 30, break_duration: taskToRetire.break_duration, original_scheduled_date: taskToRetire.scheduled_date, is_critical: taskToRetire.is_critical, is_locked: taskToRetire.is_locked, energy_cost: taskToRetire.energy_cost ?? 0, is_completed: taskToRetire.is_completed ?? false, is_custom_energy_cost: taskToRetire.is_custom_energy_cost ?? false, task_environment: taskToRetire.task_environment, is_backburner: taskToRetire.is_backburner };
      await supabase.from('aethersink').insert(newRetiredTask);
      await supabase.from('scheduled_tasks').delete().eq('id', taskToRetire.id).eq('user_id', userId);
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks'] });
      if (variables.scheduled_date === todayString) {
        queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday'] });
      }
      showSuccess('Task moved to Aether Sink.');
    }
  });

  const rezoneTaskMutation = useMutation({
    mutationFn: async (task: RetiredTask) => {
      if (!userId || !profile) throw new Error("User context missing.");
      
      // CRITICAL FIX: Ensure formattedSelectedDate is valid, defaulting to today if empty
      const effectiveSelectedDate = formattedSelectedDate || format(new Date(), 'yyyy-MM-dd');

      if (!effectiveSelectedDate) {
        throw new Error("Target date is missing or invalid.");
      }

      const targetDateAsDate = parseISO(effectiveSelectedDate);
      
      if (isNaN(targetDateAsDate.getTime())) {
        throw new Error(`Invalid target date format: ${effectiveSelectedDate}`);
      }

      const targetWorkdayStart = profile.default_auto_schedule_start_time ? setTimeOnDate(targetDateAsDate, profile.default_auto_schedule_start_time) : startOfDay(targetDateAsDate);
      let targetWorkdayEnd = profile.default_auto_schedule_end_time ? setTimeOnDate(startOfDay(targetDateAsDate), profile.default_auto_schedule_end_time) : addHours(startOfDay(targetDateAsDate), 17);
      if (isBefore(targetWorkdayEnd, targetWorkdayStart)) targetWorkdayEnd = addDays(targetWorkdayEnd, 1);

      const isTodaySelected = isSameDay(targetDateAsDate, T_current);
      const effectiveStart = (isTodaySelected && isBefore(targetWorkdayStart, T_current)) ? T_current : targetWorkdayStart;

      // --- START DEBUG LOGGING ---
      console.log(`[REZONE DEBUG] Attempting to rezone task: ${task.name} (${(task.duration || 30) + (task.break_duration || 0)}m)`);
      console.log(`[REZONE DEBUG] Target Date: ${effectiveSelectedDate}`);
      console.log(`[REZONE DEBUG] Workday Window: ${format(targetWorkdayStart, 'HH:mm')} - ${format(targetWorkdayEnd, 'HH:mm')}`);
      console.log(`[REZONE DEBUG] Effective Search Start: ${format(effectiveStart, 'HH:mm')}`);
      // --- END DEBUG LOGGING ---

      // 1. Identify Fixed Blocks (Scheduled Tasks + Static Anchors)
      
      // Scheduled Fixed/Locked Tasks
      // For a single rezone operation, treat ALL existing scheduled tasks as occupied blocks
      // to prevent overlap, as we are not running a full re-balance.
      const scheduledFixedBlocks: TimeBlock[] = dbScheduledTasks
        .filter(t => t.start_time && t.end_time)
        .map(t => {
          const start = setTimeOnDate(targetDateAsDate, format(parseISO(t.start_time!), 'HH:mm'));
          let end = setTimeOnDate(targetDateAsDate, format(parseISO(t.end_time!), 'HH:mm'));
          if (isBefore(end, start)) end = addDays(end, 1);
          return { start, end, duration: differenceInMinutes(end, start) };
        });

      const staticConstraints: TimeBlock[] = [];
      const addStaticConstraint = (name: string, timeStr: string | null, duration: number | null) => {
        const effectiveDuration = (duration !== null && duration !== undefined && !isNaN(duration)) ? duration : 15;

        if (timeStr && effectiveDuration > 0) {
          let anchorStart = setTimeOnDate(targetDateAsDate, timeStr);
          let anchorEnd = addMinutes(anchorStart, effectiveDuration);

          if (isBefore(anchorEnd, anchorStart)) {
            anchorEnd = addDays(anchorEnd, 1);
          }

          // Check if the anchor overlaps with the workday window
          const overlaps = (isBefore(anchorEnd, targetWorkdayEnd) || isEqual(anchorEnd, targetWorkdayEnd)) && 
                           (isAfter(anchorStart, targetWorkdayStart) || isEqual(anchorStart, targetWorkdayStart));
          
          if (overlaps) {
            const intersectionStart = max([anchorStart, targetWorkdayStart]);
            const intersectionEnd = min([anchorEnd, targetWorkdayEnd]);
            const finalDuration = differenceInMinutes(intersectionEnd, intersectionStart);

            if (finalDuration > 0) { 
              staticConstraints.push({
                start: intersectionStart,
                end: intersectionEnd,
                duration: finalDuration,
              });
            }
          }
        }
      };

      addStaticConstraint('Breakfast', profile.breakfast_time, profile.breakfast_duration_minutes);
      addStaticConstraint('Lunch', profile.lunch_time, profile.lunch_duration_minutes);
      addStaticConstraint('Dinner', profile.dinner_time, profile.dinner_duration_minutes);

      for (let r = 0; r < (profile.reflection_count || 0); r++) {
          const rTime = profile.reflection_times?.[r];
          const rDur = profile.reflection_durations?.[r];
          if (rTime && rDur) addStaticConstraint(`Reflection Point ${r + 1}`, rTime, rDur);
      }

      const occupiedBlocks: TimeBlock[] = mergeOverlappingTimeBlocks([...scheduledFixedBlocks, ...staticConstraints]);
      
      // --- START DEBUG LOGGING ---
      console.log(`[REZONE DEBUG] Total Occupied Blocks: ${occupiedBlocks.length}`);
      occupiedBlocks.forEach((block, index) => {
        console.log(`[REZONE DEBUG] Occupied Block ${index + 1}: ${format(block.start, 'HH:mm')} - ${format(block.end, 'HH:mm')} (${block.duration}m)`);
      });
      // --- END DEBUG LOGGING ---

      const taskTotalDuration = (task.duration || 30) + (task.break_duration || 0);
      const slot = findFirstAvailableSlot(taskTotalDuration, occupiedBlocks, effectiveStart, targetWorkdayEnd);

      // --- START DEBUG LOGGING ---
      if (slot) {
        console.log(`[REZONE DEBUG] SUCCESS: Found slot: ${format(slot.start, 'HH:mm')} - ${format(slot.end, 'HH:mm')}`);
      } else {
        const freeBlocks = getFreeTimeBlocks(occupiedBlocks, effectiveStart, targetWorkdayEnd);
        console.log(`[REZONE DEBUG] FAILURE: No slot found for ${taskTotalDuration}m.`);
        console.log(`[REZONE DEBUG] Available Free Blocks: ${freeBlocks.length}`);
        freeBlocks.forEach((block, index) => {
          console.log(`[REZONE DEBUG] Free Block ${index + 1}: ${format(block.start, 'HH:mm')} - ${format(block.end, 'HH:mm')} (Duration: ${block.duration}m)`);
        });
      }
      // --- END DEBUG LOGGING ---

      if (!slot) {
        throw new Error("No free slot available in the schedule window.");
      }

      const { error: insertError } = await supabase.from('scheduled_tasks').insert({
        user_id: userId,
        name: task.name,
        start_time: slot.start.toISOString(),
        end_time: slot.end.toISOString(),
        break_duration: task.break_duration,
        scheduled_date: effectiveSelectedDate, // Use effectiveSelectedDate
        is_critical: task.is_critical,
        is_flexible: true,
        is_locked: false,
        energy_cost: task.energy_cost,
        is_completed: task.is_completed,
        is_custom_energy_cost: task.is_custom_energy_cost,
        task_environment: task.task_environment,
        is_backburner: task.is_backburner,
      });

      if (insertError) throw new Error(insertError.message);
      
      const { error: deleteError } = await supabase.from('aethersink').delete().eq('id', task.id).eq('user_id', userId);
      if (deleteError) throw new Error(deleteError.message);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks'] });
      if (variables.original_scheduled_date === todayString) { // If rezoned to today
        queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday'] });
      }
      showSuccess("Objective rezoned successfully!");
    },
    onError: (e) => {
        showError(`Rezone failed: ${e.message}`);
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
      if (isSelectedDayToday) {
        queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday'] });
      }
    }
  });

  const randomizeBreaksMutation = useMutation({
    mutationFn: async ({ selectedDate, workdayStartTime, workdayEndTime, currentDbTasks }: { selectedDate: string; workdayStartTime: Date; workdayEndTime: Date; currentDbTasks: DBScheduledTask[]; }) => {
      if (!userId) throw new Error("User not authenticated.");
      let breaks = currentDbTasks.filter(task => task.name.toLowerCase() === 'break' && !task.is_locked);
      if (breaks.length === 0) return;
      for (let i = breaks.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [breaks[i], breaks[j]] = [breaks[j], breaks[i]]; }
      let blocks: TimeBlock[] = mergeOverlappingTimeBlocks(currentDbTasks.filter(task => task.name.toLowerCase() !== 'break' || task.is_locked).map(t => ({ start: parseISO(t.start_time!), end: parseISO(t.end_time!), duration: differenceInMinutes(parseISO(t.end_time!), parseISO(t.start_time!)) })));
      const placed: DBScheduledTask[] = [];
      for (const b of breaks) {
        const dur = b.break_duration || 15;
        let free = getFreeTimeBlocks(blocks, workdayStartTime, workdayEndTime);
        for (let i = free.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [free[i], free[j]] = [free[j], free[i]]; }
        const slot = free.find(f => f.duration >= dur);
        if (slot) {
          const start = slot.start;
          const end = addMinutes(start, dur);
          const updated = { ...b, start_time: start.toISOString(), end_time: end.toISOString(), scheduled_date: selectedDate, updated_at: new Date().toISOString() };
          placed.push(updated);
          blocks.push({ start, end, duration: dur });
          blocks = mergeOverlappingTimeBlocks(blocks);
        }
      }
      if (placed.length > 0) await supabase.from('scheduled_tasks').upsert(placed.map(p => ({ ...p, user_id: userId })), { onConflict: 'id' });
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      if (variables.selectedDate === todayString) {
        queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday'] });
      }
      showSuccess('Breaks randomized!');
    }
  });

  const toggleScheduledTaskLockMutation = useMutation({
    mutationFn: async ({ taskId, isLocked }: { taskId: string; isLocked: boolean }) => {
      if (!userId) throw new Error("User not authenticated.");
      const { data, error } = await supabase.from('scheduled_tasks').update({ is_locked: isLocked, updated_at: new Date().toISOString() }).eq('id', taskId).eq('user_id', userId).select().single();
      if (error) throw new Error(error.message);
      return data as DBScheduledTask;
    },
    onSettled: (data) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      if (data && data.scheduled_date === todayString) {
        queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday'] });
      }
    }
  });

  const toggleAllScheduledTasksLockMutation = useMutation({
    mutationFn: async ({ selectedDate, lockState }: { selectedDate: string; lockState: boolean }) => {
      if (!userId) throw new Error("User not authenticated.");
      const { error } = await supabase
        .from('scheduled_tasks')
        .update({ is_locked: lockState, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('scheduled_date', selectedDate);
      if (error) throw new Error(error.message);
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, variables.selectedDate] });
      if (variables.selectedDate === todayString) {
        queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', userId] });
      }
      showSuccess(variables.lockState ? 'Day locked down!' : 'Day unlocked!');
    },
    onError: (e) => {
      showError(`Failed to toggle day lock: ${e.message}`);
    }
  });

  const toggleRetiredTaskLockMutation = useMutation({
    mutationFn: async ({ taskId, isLocked }: { taskId: string; isLocked: boolean }) => {
      if (!userId) throw new Error("User not authenticated.");
      const { data, error } = await supabase.from('aethersink').update({ is_locked: isLocked, retired_at: new Date().toISOString() }).eq('id', taskId).eq('user_id', userId).select().single();
      if (error) throw new Error(error.message);
      return data as RetiredTask;
    },
    onSettled: (data) => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
    }
  });

  const aetherDumpMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("User not authenticated.");
      const { data: tasks } = await supabase.from('scheduled_tasks').select('*').eq('user_id', userId).eq('scheduled_date', formattedSelectedDate).eq('is_flexible', true).eq('is_locked', false);
      if (!tasks || tasks.length === 0) return;
      const retired = tasks.map(t => ({ user_id: userId, name: t.name, duration: t.start_time && t.end_time ? differenceInMinutes(parseISO(t.end_time), parseISO(t.start_time)) : 30, break_duration: t.break_duration, original_scheduled_date: t.scheduled_date, is_critical: t.is_critical, is_locked: t.is_locked, energy_cost: t.energy_cost ?? 0, is_completed: t.is_completed ?? false, is_custom_energy_cost: t.is_custom_energy_cost ?? false, task_environment: t.task_environment, is_backburner: t.is_backburner }));
      await supabase.from('aethersink').insert(retired);
      await supabase.from('scheduled_tasks').delete().in('id', tasks.map(t => t.id)).eq('user_id', userId);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks'] });
      if (isSelectedDayToday) {
        queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday'] });
      }
      showSuccess('Timeline flushed to Aether Sink.');
    }
  });

  const aetherDumpMegaMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("User not authenticated.");
      const { data: tasks } = await supabase.from('scheduled_tasks').select('*').eq('user_id', userId).eq('is_flexible', true).eq('is_locked', false);
      if (!tasks || tasks.length === 0) return;
      const retired = tasks.map(t => ({ user_id: userId, name: t.name, duration: t.start_time && t.end_time ? differenceInMinutes(parseISO(t.end_time), parseISO(t.start_time)) : 30, break_duration: t.break_duration, original_scheduled_date: t.scheduled_date, is_critical: t.is_critical, is_locked: t.is_locked, energy_cost: t.energy_cost ?? 0, is_completed: t.is_completed ?? false, is_custom_energy_cost: t.is_custom_energy_cost ?? false, task_environment: t.task_environment, is_backburner: t.is_backburner }));
      await supabase.from('aethersink').insert(retired);
      await supabase.from('scheduled_tasks').delete().in('id', tasks.map(t => t.id)).eq('user_id', userId);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks'] });
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday'] }); // Always invalidate, as it affects all days
      showSuccess('All future timelines flushed.');
    }
  });

  const updateScheduledTaskDetailsMutation = useMutation({
    mutationFn: async (task: Partial<DBScheduledTask> & { id: string }) => {
      if (!userId) throw new Error("User not authenticated.");
      const { data, error } = await supabase.from('scheduled_tasks').update({ ...task, updated_at: new Date().toISOString() }).eq('id', task.id).eq('user_id', userId).select().single();
      if (error) throw new Error(error.message);
      return data as DBScheduledTask;
    },
    onSettled: (data) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      if (data && data.scheduled_date === todayString) {
        queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday'] });
      }
    }
  });

  const updateScheduledTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, isCompleted }: { taskId: string, isCompleted: boolean }) => {
      if (!userId) throw new Error("User not authenticated.");
      const { data, error } = await supabase.from('scheduled_tasks').update({ is_completed: isCompleted, updated_at: new Date().toISOString() }).eq('id', taskId).eq('user_id', userId).select().single();
      if (error) throw new Error(error.message);
      return data as DBScheduledTask;
    },
    onSettled: (data) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      if (data && data.scheduled_date === todayString) {
        queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday'] });
      }
    }
  });

  const updateRetiredTaskDetailsMutation = useMutation({
    mutationFn: async (task: Partial<RetiredTask> & { id: string }) => {
      console.log(`[useSchedulerTasks] updateRetiredTaskDetails called for task ${task.id}:`, task);
      if (!userId) throw new Error("User not authenticated.");
      const { data, error } = await supabase.from('aethersink').update({ ...task, retired_at: new Date().toISOString() }).eq('id', task.id).eq('user_id', userId).select().single();
      if (error) throw new Error(error.message);
      return data as RetiredTask;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
    }
  });

  const updateRetiredTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, isCompleted }: { taskId: string, isCompleted: boolean }) => {
      if (!userId) throw new Error("User not authenticated.");
      const { data, error } = await supabase.from('aethersink').update({ is_completed: isCompleted, retired_at: new Date().toISOString() }).eq('id', taskId).eq('user_id', userId).select().single();
      if (error) throw new Error(error.message);
      return data as RetiredTask;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
    }
  });

  const completeScheduledTaskMutation = useMutation({
    mutationFn: async (task: DBScheduledTask) => {
      if (!userId) throw new Error("User not authenticated.");
      const { error } = await supabase.from('scheduled_tasks').delete().eq('id', task.id).eq('user_id', userId);
      if (error) throw new Error(error.message);
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks'] });
      if (variables.scheduled_date === todayString) {
        queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday'] });
      }
    }
  });

  const completeRetiredTaskMutation = useMutation({
    mutationFn: async (task: RetiredTask) => {
      if (!userId) throw new Error("User not authenticated.");
      const { error } = await supabase.from('aethersink').update({ is_completed: true, retired_at: new Date().toISOString() }).eq('id', task.id).eq('user_id', userId);
      if (error) throw new Error(error.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
    }
  });

  const triggerAetherSinkBackupMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("User not authenticated.");
      const { error } = await supabase.rpc('backup_aethersink_for_user', { p_user_id: userId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      showSuccess("Aether Sink snapshot created.");
    }
  });

  const autoBalanceScheduleMutation = useMutation<
    { tasksPlaced: number; tasksKeptInSink: number },
    Error,
    AutoBalancePayload
  >({
    mutationFn: async (payload: AutoBalancePayload) => {
      if (!userId || !session?.access_token) throw new Error("Authentication required.");
      const { data, error } = await supabase.functions.invoke('auto-balance-schedule', { body: payload, headers: { 'Authorization': `Bearer ${session.access_token}` } });
      if (error) throw new Error(data.error || error.message);
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks'] });
      if (variables.selectedDate === todayString) {
        queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday'] });
      }
      if (data) showSuccess(`Balanced: ${data.tasksPlaced} items placed.`);
    }
  });

  const handleAutoScheduleAndSort = useCallback(async (
    sortPreference: SortBy,
    taskSource: 'all-flexible' | 'sink-only' | 'sink-to-gaps',
    environmentsToFilterBy: TaskEnvironment[] = [],
    targetDateString: string
  ) => {
    if (!user || !profile) {
      return showError("Profile context missing.");
    }

    showSuccess("Engine: Starting...");
    console.log(`[SchedulerEngine] Initiating auto-schedule. Mode: ${taskSource}, Sort: ${sortPreference}`);

    const [year, month, day] = targetDateString.split('-').map(Number);
    const targetDayAsDate = new Date(year, month - 1, day);

    if (isBefore(targetDayAsDate, startOfDay(new Date()))) {
      return showError("Historical timelines are read-only.");
    }

    try {
      const targetWorkdayStart = profile.default_auto_schedule_start_time ? setTimeOnDate(targetDayAsDate, profile.default_auto_schedule_start_time) : startOfDay(targetDayAsDate);
      let targetWorkdayEnd = profile.default_auto_schedule_end_time ? setTimeOnDate(startOfDay(targetDayAsDate), profile.default_auto_schedule_end_time) : addHours(startOfDay(targetDayAsDate), 17);
      if (isBefore(targetWorkdayEnd, targetWorkdayStart)) targetWorkdayEnd = addDays(targetWorkdayEnd, 1);
      
      const isTodaySelected = isSameDay(targetDayAsDate, T_current);
      const effectiveStart = (isTodaySelected && isBefore(targetWorkdayStart, T_current)) ? T_current : targetWorkdayStart;

      showSuccess(`Window: ${format(targetWorkdayStart, 'HH:mm')} to ${format(targetWorkdayEnd, 'HH:mm')}`);
      console.log(`[SchedulerEngine] Target Window: ${format(targetWorkdayStart, 'HH:mm')} to ${format(targetWorkdayEnd, 'HH:mm')}`);

      const { data: dbTasks } = await supabase.from('scheduled_tasks').select('*').eq('user_id', user.id).eq('scheduled_date', targetDateString);
      
      // 1. Identify Fixed Blocks (Scheduled Tasks + Static Anchors)
      
      // Scheduled Fixed/Locked Tasks
      // For a single rezone operation, treat ALL existing scheduled tasks as occupied blocks.
      // For auto-balance, only truly fixed/locked tasks are constraints.
      const scheduledFixedBlocks: TimeBlock[] = (dbTasks || []).filter(t => {
        if (taskSource === 'sink-to-gaps') return true; // All existing scheduled tasks are constraints
        return (!t.is_flexible || t.is_locked); // Only truly fixed/locked tasks are constraints
      }).filter(t => t.start_time && t.end_time).map(t => {
        const start = setTimeOnDate(targetDayAsDate, format(parseISO(t.start_time!), 'HH:mm'));
        let end = setTimeOnDate(targetDayAsDate, format(parseISO(t.end_time!), 'HH:mm'));
        if (isBefore(end, start)) end = addDays(end, 1);
        return { start, end, duration: differenceInMinutes(end, start) };
      });

      // Static Constraints (Meals/Reflections)
      const staticConstraints: TimeBlock[] = [];
      const addStaticConstraint = (name: string, timeStr: string | null, duration: number | null) => {
        const effectiveDuration = (duration !== null && duration !== undefined && !isNaN(duration)) ? duration : 15;

        if (timeStr && effectiveDuration > 0) {
          let anchorStart = setTimeOnDate(targetDayAsDate, timeStr);
          let anchorEnd = addMinutes(anchorStart, effectiveDuration);

          if (isBefore(anchorEnd, anchorStart)) {
            anchorEnd = addDays(anchorEnd, 1);
          }

          // Check if the anchor overlaps with the workday window
          const overlaps = (isBefore(anchorEnd, targetWorkdayEnd) || isEqual(anchorEnd, targetWorkdayEnd)) && 
                           (isAfter(anchorStart, targetWorkdayStart) || isEqual(anchorStart, targetWorkdayStart));
          
          if (overlaps) {
            const intersectionStart = max([anchorStart, targetWorkdayStart]);
            const intersectionEnd = min([anchorEnd, targetWorkdayEnd]);
            const finalDuration = differenceInMinutes(intersectionEnd, intersectionStart);

            if (finalDuration > 0) { 
              staticConstraints.push({
                start: intersectionStart,
                end: intersectionEnd,
                duration: finalDuration,
              });
              console.log(`[SchedulerEngine] Constraint Added: ${name} (${finalDuration}m) from ${format(intersectionStart, 'HH:mm')} to ${format(intersectionEnd, 'HH:mm')}`);
            }
          }
        }
      };

      addStaticConstraint('Breakfast', profile.breakfast_time, profile.breakfast_duration_minutes);
      addStaticConstraint('Lunch', profile.lunch_time, profile.lunch_duration_minutes);
      addStaticConstraint('Dinner', profile.dinner_time, profile.dinner_duration_minutes);

      for (let r = 0; r < (profile.reflection_count || 0); r++) {
          const rTime = profile.reflection_times?.[r];
          const rDur = profile.reflection_durations?.[r];
          if (rTime && rDur) addStaticConstraint(`Reflection Point ${r + 1}`, rTime, rDur);
      }

      // CRITICAL FIX: Merge all fixed blocks (scheduled + static constraints) before starting placement
      let currentOccupied: TimeBlock[] = mergeOverlappingTimeBlocks([...scheduledFixedBlocks, ...staticConstraints]);
      
      showSuccess(`Fixed Constraints: ${currentOccupied.length} blocks`);
      console.log(`[SchedulerEngine] Total Fixed Constraints (Scheduled + Static): ${currentOccupied.length} blocks`);
      currentOccupied.forEach(block => {
        console.log(`[SchedulerEngine] Fixed Block: ${format(block.start, 'HH:mm')} - ${format(block.end, 'HH:mm')} (${block.duration}m)`);
      });

      const totalWorkdayMinutes = differenceInMinutes(targetWorkdayEnd, effectiveStart);
      const occupiedInWindow = currentOccupied.reduce((acc, block) => {
        const intersectionStart = max([block.start, effectiveStart]);
        const intersectionEnd = min([block.end, targetWorkdayEnd]);
        const dur = differenceInMinutes(intersectionEnd, intersectionStart);
        return acc + (dur > 0 ? dur : 0);
      }, 0);
      
      const netAvailableTime = totalWorkdayMinutes - occupiedInWindow;
      showSuccess(`Available Time: ${netAvailableTime} minutes`);
      console.log(`[SchedulerEngine] Available time in window: ${netAvailableTime} minutes`);

      // 2. Identify Pool of Tasks to Place
      const flexibleScheduled = (dbTasks || []).filter(t => t.is_flexible && !t.is_locked);
      const unlockedRetired = retiredTasks.filter(t => !t.is_locked);
      const unifiedPool: UnifiedTask[] = [];
      const scheduledIdsToDelete: string[] = [];
      const retiredIdsToDelete: string[] = [];
      const tasksToInsert: NewDBScheduledTask[] = [];
      const tasksToKeepInSink: NewRetiredTask[] = [];

      // Tasks to keep in the schedule (fixed/locked tasks, and all tasks if in sink-to-gaps mode)
      if (taskSource === 'sink-to-gaps') {
          // Keep all existing scheduled tasks as constraints, so we don't add them to tasksToInsert yet.
          // We only insert the newly placed retired tasks later.
          (dbTasks || []).forEach(t => {
              if (!tasksToInsert.some(inserted => inserted.id === t.id)) {
                  if (!Array.isArray(tasksToInsert)) { console.error("[SchedulerEngine ERROR] tasksToInsert is not an array before push (sink-to-gaps)"); return; } // DEFENSIVE CHECK
                  tasksToInsert.push(t);
              }
          });
      } else {
          // Global Reshuffle: Keep only fixed/locked tasks, delete all flexible ones.
          (dbTasks || []).filter(t => !t.is_flexible || t.is_locked).forEach(t => {
              if (!Array.isArray(tasksToInsert)) { console.error("[SchedulerEngine ERROR] tasksToInsert is not an array before push (all-flexible fixed)"); return; } // DEFENSIVE CHECK
              tasksToInsert.push({ ...t });
          });
      }

      // Determine which tasks go into the placement pool
      if (taskSource === 'all-flexible') {
        flexibleScheduled.forEach(t => {
          if (!Array.isArray(unifiedPool)) { console.error("[SchedulerEngine ERROR] unifiedPool is not an array before push (flexible scheduled)"); return; } // DEFENSIVE CHECK
          unifiedPool.push({ id: t.id, name: t.name, duration: t.start_time && t.end_time ? differenceInMinutes(parseISO(t.end_time), parseISO(t.start_time)) : 30, break_duration: t.break_duration, is_critical: t.is_critical, is_flexible: true, is_backburner: t.is_backburner, energy_cost: t.energy_cost, source: 'scheduled', originalId: t.id, is_custom_energy_cost: t.is_custom_energy_cost, created_at: t.created_at, task_environment: t.task_environment });
          scheduledIdsToDelete.push(t.id);
        });
      }
      
      unlockedRetired.forEach(t => {
          if (!Array.isArray(unifiedPool)) { console.error("[SchedulerEngine ERROR] unifiedPool is not an array before push (unlocked retired)"); return; } // DEFENSIVE CHECK
          unifiedPool.push({ id: t.id, name: t.name, duration: t.duration || 30, break_duration: t.break_duration, is_critical: t.is_critical, is_flexible: true, is_backburner: t.is_backburner, energy_cost: t.energy_cost, source: 'retired', originalId: t.id, is_custom_energy_cost: t.is_custom_energy_cost, created_at: t.retired_at, task_environment: t.task_environment });
      });

      const tasksToConsider = unifiedPool.filter(t => environmentsToFilterBy.length === 0 || environmentsToFilterBy.includes(t.task_environment));
      showSuccess(`Pool to Place: ${tasksToConsider.length} items`);
      console.log(`[SchedulerEngine] Unlocked Unified Pool: ${unifiedPool.length} items. Filtering for ${environmentsToFilterBy.length || 'all'} environments -> ${tasksToConsider.length} items.`);
      
      // 3. Sort the Pool
      let finalSortedPool: UnifiedTask[] = [];
      if (sortPreference === 'ENVIRONMENT_RATIO') {
        const chunking = profile.enable_environment_chunking ?? true;
        const spread = profile.enable_macro_spread ?? false;

        const groups: Record<TaskEnvironment, UnifiedTask[]> = { home: [], laptop: [], away: [], piano: [], laptop_piano: [] };
        tasksToConsider.forEach(t => {
          if (!groups[t.task_environment]) groups[t.task_environment] = []; // Ensure group exists
          groups[t.task_environment].push(t);
        });

        // FIX: Ensure groups[env] is defined before accessing .length
        const activeEnvs = (Object.keys(groups) as TaskEnvironment[]).filter(env => groups[env] && groups[env].length > 0);
        
        const envOrder = profile.custom_environment_order || ['home', 'laptop', 'away', 'piano', 'laptop_piano'];
        // FIX: Ensure groups[env] is defined before accessing .length
        const orderedEnvs = envOrder.filter(env => groups[env] && groups[env].length > 0);
        const quotaPerEnv = orderedEnvs.length > 0 ? Math.floor(netAvailableTime / orderedEnvs.length) : netAvailableTime;

        activeEnvs.forEach(env => {
          groups[env].sort((a, b) => {
            if (a.is_critical && !b.is_critical) return -1;
            if (!a.is_critical && b.is_critical) return 1;
            if (a.is_backburner && !b.is_backburner) return 1;
            if (!a.is_backburner && b.is_backburner) return -1;
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          });
        });

        const fillQuotaPass = (quotaMinutes: number) => {
            for (const env of orderedEnvs) {
                const group = groups[env];
                if (!group) { // Defensive check
                    console.warn(`[SchedulerEngine] Group for environment ${env} is undefined during fillQuotaPass.`);
                    continue;
                }
                let envTimeUsed = 0;
                while (group.length > 0 && envTimeUsed < quotaMinutes) {
                    const task = group[0];
                    const taskTotal = (task.duration || 30) + (task.break_duration || 0);
                    if (envTimeUsed > 0 && (envTimeUsed + taskTotal > quotaMinutes)) break; 
                    if (!Array.isArray(finalSortedPool)) { console.error("[SchedulerEngine ERROR] finalSortedPool is not an array before push (fillQuotaPass)"); return; } // DEFENSIVE CHECK
                    finalSortedPool.push(group.shift()!);
                    envTimeUsed += taskTotal;
                }
            }
        };

        if (chunking && spread) {
            fillQuotaPass(Math.floor(quotaPerEnv / 2));
            fillQuotaPass(Math.floor(quotaPerEnv / 2));
        } else if (chunking) {
            fillQuotaPass(quotaPerEnv);
        } else {
            let hasRemaining = true;
            while (hasRemaining) {
                hasRemaining = false;
                for (const env of orderedEnvs) {
                    const group = groups[env];
                    if (!group) { // Defensive check
                        console.warn(`[SchedulerEngine] Group for environment ${env} is undefined during non-chunking pass.`);
                        continue;
                    }
                    if (group.length > 0) {
                        if (!Array.isArray(finalSortedPool)) { console.error("[SchedulerEngine ERROR] finalSortedPool is not an array before push (non-chunking)"); return; } // DEFENSIVE CHECK
                        finalSortedPool.push(group.shift()!);
                        hasRemaining = true;
                    }
                }
            }
        }
        
        orderedEnvs.forEach(env => {
            const group = groups[env];
            if (!group) { // Defensive check
                console.warn(`[SchedulerEngine] Group for environment ${env} is undefined during final cleanup.`);
                return;
            }
            while (group.length > 0) {
              if (!Array.isArray(finalSortedPool)) { console.error("[SchedulerEngine ERROR] finalSortedPool is not an array before push (remaining groups)"); return; } // DEFENSIVE CHECK
              finalSortedPool.push(group.shift()!);
            }
        });

      } else {
        finalSortedPool = [...tasksToConsider].sort((a, b) => {
            if (a.is_critical && !b.is_critical) return -1;
            if (!a.is_critical && b.is_critical) return 1;
            if (a.is_backburner && !b.is_backburner) return 1;
            if (!a.is_backburner && b.is_backburner) return -1;

            switch (sortPreference) {
              case 'TIME_EARLIEST_TO_LATEST': return (a.duration || 0) - (b.duration || 0);
              case 'PRIORITY_HIGH_TO_LOW': return (b.energy_cost || 0) - (a.energy_cost || 0);
              case 'NAME_ASC': return a.name.localeCompare(b.name);
              case 'EMOJI': return getEmojiHue(a.name) - getEmojiHue(b.name);
              default: return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            }
        });
      }
      
      showSuccess(`Processing ${finalSortedPool.length} items...`);
      console.log(`[SchedulerEngine] Processing placement for ${finalSortedPool.length} sorted items...`);
      let placementCursor = effectiveStart;
      for (const t of finalSortedPool) {
        let placed = false;
        const taskTotalDuration = (t.duration || 30) + (t.break_duration || 0);

        // Skip critical tasks if energy is low, and move them to sink
        if (t.is_critical && profile.energy < LOW_ENERGY_THRESHOLD) {
          if (t.source === 'scheduled') {
            if (!Array.isArray(tasksToKeepInSink)) { console.error("[SchedulerEngine ERROR] tasksToKeepInSink is not an array before push (skipped critical scheduled)"); return; } // DEFENSIVE CHECK
            tasksToKeepInSink.push({ user_id: user.id, name: t.name, duration: t.duration, break_duration: t.break_duration, original_scheduled_date: targetDateString, is_critical: t.is_critical, is_locked: false, energy_cost: t.energy_cost, is_completed: false, is_custom_energy_cost: t.is_custom_energy_cost, task_environment: t.task_environment, is_backburner: t.is_backburner });
            scheduledIdsToDelete.push(t.originalId);
          }
          console.log(`[SchedulerEngine] Skipped Critical Task (Low Energy): ${t.name}`);
          // CRITICAL FIX: Advance placementCursor even if task is skipped
          const freeBlocksAfterCursor = getFreeTimeBlocks(currentOccupied, placementCursor, targetWorkdayEnd);
          if (freeBlocksAfterCursor.length > 0) {
            placementCursor = freeBlocksAfterCursor[0].start;
          } else {
            placementCursor = targetWorkdayEnd;
          }
          continue; 
        }

        // Find the first available slot starting from the current placementCursor
        const slot = findFirstAvailableSlot(taskTotalDuration, currentOccupied, placementCursor, targetWorkdayEnd);

        if (slot) {
          // Task successfully placed
          const start = slot.start;
          const end = addMinutes(start, taskTotalDuration);
          
          tasksToInsert.push({ 
              id: t.source === 'retired' ? undefined : t.originalId, 
              name: t.name, start_time: start.toISOString(), end_time: end.toISOString(), 
              break_duration: t.break_duration, scheduled_date: targetDateString, is_critical: t.is_critical, 
              is_flexible: true, is_locked: false, energy_cost: t.energy_cost, is_completed: false, 
              is_custom_energy_cost: t.is_custom_energy_cost, task_environment: t.task_environment, is_backburner: t.is_backburner 
          });
          
          // Update currentOccupied immediately with the newly placed block
          currentOccupied.push({ start, end, duration: taskTotalDuration });
          currentOccupied = mergeOverlappingTimeBlocks(currentOccupied);
          placementCursor = end; // Advance cursor to the end of the placed task
          placed = true;
          
          if (t.source === 'retired') retiredIdsToDelete.push(t.originalId);
          
          console.log(`[SchedulerEngine] Placed: ${t.name} (${t.source}) at ${format(start, 'HH:mm')}`);
        }

        if (!placed) {
          // Task failed to place.
          // We need to advance the placementCursor past the current problematic area.
          // Find the next available free block or the end of the next occupied block.
          const freeBlocksAfterCursor = getFreeTimeBlocks(currentOccupied, placementCursor, targetWorkdayEnd);
          if (freeBlocksAfterCursor.length > 0) {
            // If there are free blocks, advance cursor to the start of the first one
            placementCursor = freeBlocksAfterCursor[0].start;
          } else {
            // If no more free blocks, advance cursor to workdayEnd
            placementCursor = targetWorkdayEnd;
          }

          if (t.source === 'scheduled') {
            tasksToKeepInSink.push({ user_id: user.id, name: t.name, duration: t.duration, break_duration: t.break_duration, original_scheduled_date: targetDateString, is_critical: t.is_critical, is_locked: false, energy_cost: t.energy_cost, is_completed: false, is_custom_energy_cost: t.is_custom_energy_cost, task_environment: t.task_environment, is_backburner: t.is_backburner });
            console.log(`[SchedulerEngine] Failed to place: ${t.name}. Returning to Sink.`);
          } else {
            console.log(`[SchedulerEngine] Failed to place: ${t.name}. Remains in Sink.`);
          }
        }
      }

      // 4. Finalize Payload
      if (taskSource === 'sink-to-gaps') {
          (dbTasks || []).forEach(t => {
              if (!tasksToInsert.some(inserted => inserted.id === t.id)) {
                  if (!Array.isArray(tasksToInsert)) { console.error("[SchedulerEngine ERROR] tasksToInsert is not an array before push (sink-to-gaps finalization)"); return; } // DEFENSIVE CHECK
                  tasksToInsert.push(t);
              }
          });
      }

      showSuccess(`Cycle Complete. Payload: ${tasksToInsert.length} inserts.`);
      console.log(`[SchedulerEngine] Cycle Complete. Payload: ${tasksToInsert.length} inserts/updates, ${scheduledIdsToDelete.length} scheduled deletions, ${retiredIdsToDelete.length} retired deletions, ${tasksToKeepInSink.length} sink returns.`);
      
      console.log(`[SchedulerEngine Debug] Final tasksToInsert:`, tasksToInsert);
      console.log(`[SchedulerEngine Debug] Final tasksToKeepInSink:`, tasksToKeepInSink);

      const payload: AutoBalancePayload = { scheduledTaskIdsToDelete: Array.from(new Set(scheduledIdsToDelete)), retiredTaskIdsToDelete: Array.from(new Set(retiredIdsToDelete)), tasksToInsert, tasksToKeepInSink, selectedDate: targetDateString };
      await autoBalanceScheduleMutation.mutateAsync(payload);
    } catch (e: any) {
      showError(`Engine Error: ${e.message}`);
    } finally {
      // Note: isProcessingCommand reset is handled by the calling component (SchedulerPage)
    }
  }, [user, profile, retiredTasks, T_current, autoBalanceScheduleMutation, queryClient, dbScheduledTasks, todayString]);

  const [isProcessingCommand, setIsProcessingCommand] = useState(false);

  return {
    dbScheduledTasks: dbScheduledTasksWithMeals,
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
    toggleAllScheduledTasksLock: toggleAllScheduledTasksLockMutation.mutateAsync, // NEW
    toggleRetiredTaskLock: toggleRetiredTaskLockMutation.mutateAsync,
    aetherDump: aetherDumpMutation.mutateAsync,
    aetherDumpMega: aetherDumpMegaMutation.mutateAsync,
    sortBy,
    setSortBy,
    retiredSortBy,
    setRetiredSortBy,
    autoBalanceSchedule: autoBalanceScheduleMutation.mutateAsync,
    updateScheduledTaskDetails: updateScheduledTaskDetailsMutation.mutateAsync,
    updateScheduledTaskStatus: updateScheduledTaskStatusMutation.mutateAsync,
    updateRetiredTaskDetails: updateRetiredTaskDetailsMutation.mutateAsync,
    updateRetiredTaskStatus: updateRetiredTaskStatusMutation.mutateAsync,
    completeScheduledTask: completeScheduledTaskMutation.mutateAsync,
    completeRetiredTask: completeRetiredTaskMutation.mutateAsync,
    removeRetiredTask: removeRetiredTaskMutation.mutateAsync,
    triggerAetherSinkBackup: triggerAetherSinkBackupMutation.mutateAsync,
    handleAutoScheduleAndSort,
  };
};