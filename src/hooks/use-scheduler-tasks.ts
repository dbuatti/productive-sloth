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
import { useEnvironments, Environment } from './use-environments';

const LOG_PREFIX = "[SCHEDULER_ENGINE]";

export const useSchedulerTasks = (selectedDate: string, scrollRef?: React.RefObject<HTMLElement>) => {
  const queryClient = useQueryClient();
  const { user, profile, session, T_current } = useSession();
  const { environments } = useEnvironments(); // Fetch environments dynamically
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
      const retired = tasks.map(t => ({ user_id: userId, name: t.name, duration: t.start_time && t.end_time ? differenceInMinutes(parseISO(t.end_time), parseISO(t.start_time)) : 30, break_duration: t.break_duration, original_scheduled_date: t.scheduled_date, is_critical: t.<dyad-problem-report summary="2 problems">
<problem file="src/components/RetiredTaskDetailDialog.tsx" line="169" column="8" code="17008">JSX element 'SheetContent' has no corresponding closing tag.</problem>
<problem file="src/lib/scheduler-utils.ts" line="1013" column="30" code="2552">Cannot find name 'midnightRoloverMessage'. Did you mean 'midnightRolloverMessage'?</problem>
</dyad-problem-report><think>**Diagnosing the Syntax Issue**

I've homed in on a critical TypeScript error in the `RetiredTaskDetailDialog.tsx` file. Specifically, line 169 indicates a missing closing tag for a `<SheetContent>` JSX element. It's a fundamental syntax error, which requires immediate attention for the code to compile correctly.


**Correcting Syntax and Scope**

I've fixed the missing closing tag in `RetiredTaskDetailDialog.tsx`, resolving the JSX syntax error. Now, I'm focusing on the `scheduler-utils.ts` file. I've pinpointed the undeclared variable `midnightRolloverMessage` which is needed in the `calculateSchedule` function. I'm declaring it now using `let` and ensuring its proper scope.


</think>You're right, those errors need to be fixed!

1.  The `SheetContent` component in `RetiredTaskDetailDialog.tsx` was missing its closing tag.
2.  The `midnightRolloverMessage` variable in `src/lib/scheduler-utils.ts` was not properly declared within the `calculateSchedule` function.

Here are the fixes:

<dyad-write path="src/components/RetiredTaskDetailDialog.tsx" description="Adding the missing closing tag for SheetContent.">
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, parseISO } from "date-fns";
import { X, Save, Loader2, Zap, Lock, Unlock } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from '@/components/ui/switch';
import { RetiredTask, TaskEnvironment } from "@/types/scheduler";
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import { showSuccess, showError } from "@/utils/toast";
import { calculateEnergyCost } from '@/lib/scheduler-utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEnvironments } from '@/hooks/use-environments'; // Import useEnvironments
import { getIconComponent } from '@/context/EnvironmentContext'; // Import from context

const formSchema = z.object({
  name: z.string().min(1, { message: "Name is required." }).max(255),
  duration: z.coerce.number().min(1, "Duration must be at least 1 minute.").optional().nullable(),
  break_duration: z.coerce.number().min(0).optional().nullable(),
  is_critical: z.boolean().default(false),
  is_backburner: z.boolean().default(false),
  is_locked: z.boolean().default(false),
  is_completed: z.boolean().default(false),
  energy_cost: z.coerce.number().min(0).default(0),
  is_custom_energy_cost: z.boolean().default(false),
  task_environment: z.enum(['home', 'laptop', 'away', 'piano', 'laptop_piano']).default('laptop'),
});

type RetiredTaskDetailFormValues = z.infer<typeof formSchema>;

interface RetiredTaskDetailSheetProps {
  task: RetiredTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const RetiredTaskDetailSheet: React.FC<RetiredTaskDetailSheetProps> = ({
  task,
  open,
  onOpenChange,
}) => {
  const { updateRetiredTaskDetails, completeRetiredTask, updateRetiredTaskStatus } = useSchedulerTasks('');
  const { environments, isLoading: isLoadingEnvironments } = useEnvironments(); // Fetch environments
  const [calculatedEnergyCost, setCalculatedEnergyCost] = useState(0);

  const form = useForm<RetiredTaskDetailFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      duration: 30,
      break_duration: 0,
      is_critical: false,
      is_backburner: false,
      is_locked: false,
      is_completed: false,
      energy_cost: 0,
      is_custom_energy_cost: false,
      task_environment: 'laptop',
    },
  });

  useEffect(() => {
    if (task) {
      form.reset({
        name: task.name,
        duration: task.duration ?? 30,
        break_duration: task.break_duration ?? 0,
        is_critical: task.is_critical,
        is_backburner: task.is_backburner,
        is_locked: task.is_locked,
        is_completed: task.is_completed,
        energy_cost: task.energy_cost,
        is_custom_energy_cost: task.is_custom_energy_cost,
        task_environment: task.task_environment,
      });
      if (!task.is_custom_energy_cost) {
        setCalculatedEnergyCost(calculateEnergyCost(task.duration || 30, task.is_critical, task.is_backburner));
      } else {
        setCalculatedEnergyCost(task.energy_cost);
      }
    }
  }, [task, form]);

  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (!value.is_custom_energy_cost && (name === 'duration' || name === 'is_critical' || name === 'is_backburner')) {
        const duration = value.duration ?? 0;
        const isCritical = value.is_critical;
        const isBackburner = value.is_backburner;
        const newEnergyCost = calculateEnergyCost(duration, isCritical ?? false, isBackburner ?? false);
        setCalculatedEnergyCost(newEnergyCost);
        form.setValue('energy_cost', newEnergyCost, { shouldValidate: true });
      } else if (name === 'is_custom_energy_cost' && !value.is_custom_energy_cost) {
        const duration = form.getValues('duration') ?? 0;
        const isCritical = form.getValues('is_critical');
        const isBackburner = form.getValues('is_backburner');
        const newEnergyCost = calculateEnergyCost(duration, isCritical ?? false, isBackburner ?? false);
        setCalculatedEnergyCost(newEnergyCost);
        form.setValue('energy_cost', newEnergyCost, { shouldValidate: true });
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const handleSubmit = async (values: RetiredTaskDetailFormValues) => {
    if (!task) return;

    try {
      if (values.is_completed !== task.is_completed) {
        if (values.is_completed) {
          await completeRetiredTask(task);
        } else {
          await updateRetiredTaskStatus({ taskId: task.id, isCompleted: false });
        }
      }

      await updateRetiredTaskDetails({
        id: task.id,
        name: values.name,
        duration: values.duration === 0 ? null : values.duration,
        break_duration: values.break_duration === 0 ? null : values.break_duration,
        is_critical: values.is_critical,
        is_backburner: values.is_backburner,
        is_locked: values.is_locked,
        energy_cost: values.energy_cost,
        is_custom_energy_cost: values.is_custom_energy_cost,
        task_environment: values.task_environment,
      });
      showSuccess("Retired task updated successfully!");
      onOpenChange(false);
    } catch (error) {
      showError("Failed to save retired task.");
      console.error("Failed to save retired task:", error);
    }
  };

  const isSubmitting = form.formState.isSubmitting;
  const isValid = form.formState.isValid;
  const isCustomEnergyCostEnabled = form.watch('is_custom_energy_cost');
  const isCritical = form.watch('is_critical');
  const isBackburner = form.watch('is_backburner');

  if (!task) return null;

  const formattedRetiredAt = task.retired_at ? format(parseISO(task.retired_at), 'MMM d, yyyy HH:mm') : 'N/A';
  const formattedOriginalDate = task.original_scheduled_date ? format(parseISO(task.original_scheduled_date), 'MMM d, yyyy') : 'N/A';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-80 flex flex-col p-6 space-y-6 animate-slide-in-right">
        <SheetHeader className="border-b pb-4">
          <SheetTitle className="text-2xl font-bold flex items-center justify-between">
            Retired Task Details
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-5 w-5" />
            </Button>
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            Retired: {formattedRetiredAt} | Original Date: {formattedOriginalDate}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col h-full space-y-6">
            
            <div className="flex-grow overflow-y-auto space-y-6 pb-8">
              {/* Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Task Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Task name" {...field} className="text-lg font-semibold" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Duration & Break Duration */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration (min)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} min="1" />
                      </FormControl>
                      <FormDescription>
                        Estimated time to complete.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="break_duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Break Duration (min)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} min="0" />
                      </FormControl>
                      <FormDescription>
                        Break associated with this task.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Task Environment */}
              <FormField
                control={form.control}
                name="task_environment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Task Environment</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingEnvironments}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select environment" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {environments.map(env => {
                          const IconComponent = getIconComponent(env.icon);
                          return (
                            <SelectItem key={env.value} value={env.value}>
                              <div className="flex items-center gap-2">
                                <IconComponent className="h-4 w-4" />
                                {env.label}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Where this task is typically performed.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Is Critical Switch */}
              <FormField
                control={form.control}
                name="is_critical"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Critical Task (P: High)</FormLabel>
                      <FormDescription>
                        Must be scheduled first.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          field.onChange(checked);
                          if (checked) form.setValue('is_backburner', false);
                        }}
                        disabled={task.is_locked}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Is Backburner Switch */}
              <FormField
                control={form.control}
                name="is_backburner"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Backburner Task (P: Low)</FormLabel>
                      <FormDescription>
                        Only scheduled if free time remains.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          field.onChange(checked);
                          if (checked) form.setValue('is_critical', false);
                        }}
                        disabled={isCritical || task.is_locked}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Is Locked Switch */}
              <FormField
                control={form.control}
                name="is_locked"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Locked Task</FormLabel>
                      <FormDescription>
                        Prevent re-zoning or deletion from Aether Sink.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Is Completed Switch */}
              <FormField
                control={form.control}
                name="is_completed"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Completed</FormLabel>
                      <FormDescription>
                        Mark this task as completed.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={task.is_locked}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Custom Energy Cost Switch */}
              <FormField
                control={form.control}
                name="is_custom_energy_cost"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Custom Energy Cost</FormLabel>
                      <FormDescription>
                        Manually set the energy cost instead of automatic calculation.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Energy Cost (Editable if custom, read-only if auto-calculated) */}
              <FormField
                control={form.control}
                name="energy_cost"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Energy Cost</FormLabel>
                      <FormDescription>
                        Energy consumed upon completion.
                      </FormDescription>
                    </div>
                    <div className="flex items-center gap-1 text-lg font-bold text-logo-yellow">
                      <Zap className="h-5 w-5" />
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          min="0" 
                          className="w-20 text-right font-mono text-lg font-bold border-none focus-visible:ring-0 focus-visible:ring-offset-0"
                          readOnly={!isCustomEnergyCostEnabled}
                          value={isCustomEnergyCostEnabled ? field.value : calculatedEnergyCost}
                          onChange={(e) => {
                            if (isCustomEnergyCostEnabled) {
                              field.onChange(e);
                            }
                          }}
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
              
            <div className="sticky bottom-0 bg-card pt-4 border-t shrink-0">
              <Button 
                type="submit" 
                disabled={isSubmitting || !isValid} 
                className="w-full flex items-center gap-2 bg-primary hover:bg-primary/90"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Changes
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
};

export default RetiredTaskDetailSheet;