import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Task, NewTask, TaskStatusFilter, TemporalFilter } from '@/types';
import { DBScheduledTask, NewDBScheduledTask, RawTaskInput, RetiredTask, NewRetiredTask, SortBy, TaskPriority, TimeBlock, AutoBalancePayload, UnifiedTask } from '@/types/scheduler';
import { useSession } from './use-session';
import { showSuccess, showError } from '@/utils/toast';
import { startOfDay, subDays, formatISO, parseISO, isToday, isYesterday, format, addMinutes, isBefore, isAfter } from 'date-fns';
import { XP_PER_LEVEL, MAX_ENERGY } from '@/lib/constants';
import { mergeOverlappingTimeBlocks, getFreeTimeBlocks, isSlotFree, calculateEnergyCost, compactScheduleLogic, getEmojiHue } from '@/lib/scheduler-utils'; // Removed sortTasksByVibeFlow
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

export const useSchedulerTasks = (selectedDate: string) => {
  const queryClient = useQueryClient();
  const { user, profile, refreshProfile, triggerLevelUp } = useSession();
  const userId = user?.id;
  const { addTaskMutation, updateTaskMutation } = useTasks();

  const formattedSelectedDate = selectedDate;

  const [sortBy, setSortBy] = useState<SortBy>('TIME_EARLIEST_TO_LATEST');
  const [xpGainAnimation, setXpGainAnimation] = useState<{ taskId: string, xpAmount: number } | null>(null);

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
      } else if (sortBy === 'EMOJI') {
        // EMOJI sorting is client-side as it depends on task name parsing
        // We'll fetch by creation time and sort client-side
        query = query.order('created_at', { ascending: true });
      } else {
        query = query.order('created_at', { ascending: true });
      }

      const { data, error } = await query;

      if (error) {
        console.error("useSchedulerTasks: Error fetching scheduled tasks:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully fetched tasks:", data.map(t => ({ id: t.id, name: t.name, scheduled_date: t.scheduled_date, start_time: t.start_time, end_time: t.end_time, is_critical: t.is_critical, is_flexible: t.is_flexible, is_locked: t.is_locked, energy_cost: t.energy_cost, is_completed: t.is_completed })));
      
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
      const { data, error } = await supabase
        .from('scheduled_tasks')
        .select('scheduled_date')
        .eq('user_id', userId);

      if (error) {
        console.error("useSchedulerTasks: Error fetching dates with tasks:", error.message);
        throw new Error(error.message);
      }
      const uniqueDates = Array.from(new Set(data.map(item => format(parseISO(item.scheduled_date), 'yyyy-MM-dd'))));
      return uniqueDates;
    },
    enabled: !!userId,
  });

  const { data: retiredTasks = [], isLoading: isLoadingRetiredTasks } = useQuery<RetiredTask[]>({
    queryKey: ['retiredTasks', userId],
    queryFn: async () => {
      if (!userId) return [];
      console.log("useSchedulerTasks: Fetching retired tasks for user:", userId);
      const { data, error } = await supabase
        .from('retired_tasks')
        .select('*')
        .eq('user_id', userId)
        .order('retired_at', { ascending: false });

      if (error) {
        console.error("useSchedulerTasks: Error fetching retired tasks:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully fetched retired tasks:", data.map(t => ({ id: t.id, name: t.name, is_critical: t.is_critical, is_locked: t.is_locked, energy_cost: t.energy_cost })));
      return data as RetiredTask[];
    },
    enabled: !!userId,
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
      const taskToInsert = { ...newTask, user_id: userId, energy_cost: newTask.energy_cost ?? 0, is_completed: newTask.is_completed ?? false };
      console.log("useSchedulerTasks: Attempting to insert new task:", taskToInsert);
      const { data, error } = await supabase.from('scheduled_tasks').insert(taskToInsert).select().single();
      if (error) {
        console.error("useSchedulerTasks: Error inserting task:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully inserted task:", data);
      return data as DBScheduledTask;
    },
    onMutate: async (newTask: NewDBScheduledTask) => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });

      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);

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
        };
        return [...(old || []), optimisticTask];
      });

      return { previousScheduledTasks };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
      showSuccess('Task added to schedule!');
    },
    onError: (e) => {
      showError(`Failed to add task to schedule: ${e.message}`);
    }
  });

  const addRetiredTaskMutation = useMutation({
    mutationFn: async (newTask: NewRetiredTask) => {
      if (!userId) throw new Error("User not authenticated.");
      const taskToInsert = { ...newTask, user_id: userId, retired_at: new Date().toISOString(), energy_cost: newTask.energy_cost ?? 0 };
      console.log("useSchedulerTasks: Attempting to insert new retired task:", taskToInsert);
      const { data, error } = await supabase.from('retired_tasks').insert(taskToInsert).select().single();
      if (error) {
        console.error("useSchedulerTasks: Error inserting retired task:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully inserted retired task:", data);
      return data as RetiredTask;
    },
    onMutate: async (newTask: NewRetiredTask) => {
      await queryClient.cancelQueries({ queryKey: ['retiredTasks', userId] });
      const previousRetiredTasks = queryClient.getQueryData<RetiredTask[]>(['retiredTasks', userId]);

      // Removed optimistic update for retiredTasks to prevent duplicates
      // queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId], (old) => {
      //   const tempId = Math.random().toString(36).substring(2, 9);
      //   const optimisticTask: RetiredTask = {
      //     id: tempId,
      //     user_id: userId!,
      //     name: newTask.name,
      //     duration: newTask.duration ?? null,
      //     break_duration: newTask.break_duration ?? null,
      //     original_scheduled_date: newTask.original_scheduled_date,
      //     retired_at: new Date().toISOString(),
      //     is_critical: newTask.is_critical ?? false,
      //     is_locked: newTask.is_locked ?? false,
      //     energy_cost: newTask.energy_cost ?? 0,
      //   };
      //   return [optimisticTask, ...(old || [])];
      // });
      return { previousRetiredTasks };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId] });
      showSuccess('Task sent directly to Aether Sink!');
    },
    onError: (err, newTask, context) => {
      // Check if the error message indicates a unique constraint violation (409 Conflict)
      if (err instanceof Error && err.message.includes('409 (Conflict)')) {
        showError(`A task named "${newTask.name}" for the original date ${format(parseISO(newTask.original_scheduled_date), 'MMM d, yyyy')} already exists in the Aether Sink. If you wish to add it again, consider modifying its name slightly.`);
      } else {
        showError(`Failed to send task to Aether Sink: ${err.message}`);
      }
      if (context?.previousRetiredTasks) {
        queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId], context.previousRetiredTasks);
      }
    }
  });


  const removeScheduledTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("useSchedulerTasks: Attempting to remove task ID:", taskId);
      const { error } = await supabase.from('scheduled_tasks').delete().eq('id', taskId).eq('user_id', userId);
      if (error) {
        console.error("useSchedulerTasks: Error removing task:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully removed task ID:", taskId);
    },
    onMutate: async (taskId: string) => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);

      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], (old) =>
        (old || []).filter(task => task.id !== taskId)
      );
      return { previousScheduledTasks };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
      showSuccess('Task removed from schedule.');
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
      const { error } = await supabase.from('scheduled_tasks').delete().eq('user_id', userId).eq('scheduled_date', formattedSelectedDate);
      if (error) {
        console.error("useSchedulerTasks: Error clearing scheduled tasks:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully cleared all scheduled tasks for user:", userId, "on date:", formattedSelectedDate);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);

      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], []);
      return { previousScheduledTasks };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
      showSuccess('Schedule cleared for today!');
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
                  ? Math.floor((parseISO(taskToRetire.end_time).getTime() - parseISO(taskToRetire.start_time).getTime()) / (1000 * 60)) 
                  : null,
        break_duration: taskToRetire.break_duration,
        original_scheduled_date: taskToRetire.scheduled_date,
        is_critical: taskToRetire.is_critical,
        is_locked: taskToRetire.is_locked,
        energy_cost: taskToRetire.energy_cost ?? 0,
      };
      const { error: insertError } = await supabase.from('retired_tasks').insert(newRetiredTask);
      if (insertError) throw new Error(`Failed to move task to Aether Sink: ${insertError.message}`);

      const { error: deleteError } = await supabase.from('scheduled_tasks').delete().eq('id', taskToRetire.id).eq('user_id', userId);
      if (deleteError) throw new Error(`Failed to remove task from schedule: ${deleteError.message}`);
    },
    onMutate: async (taskToRetire: DBScheduledTask) => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      await queryClient.cancelQueries({ queryKey: ['retiredTasks', userId] });

      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);
      const previousRetiredTasks = queryClient.getQueryData<RetiredTask[]>(['retiredTasks', userId]);

      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], (old) =>
        (old || []).filter(task => task.id !== taskToRetire.id)
      );

      // Removed optimistic update for retiredTasks to prevent duplicates
      // const newRetiredTask: RetiredTask = {
      //   id: taskToRetire.id,
      //   user_id: userId!,
      //   name: taskToRetire.name,
      //   duration: (taskToRetire.start_time && taskToRetire.end_time) 
      //             ? Math.floor((parseISO(taskToRetire.end_time).getTime() - parseISO(taskToRetire.start_time).getTime()) / (1000 * 60)) 
      //             : null,
      //   break_duration: taskToRetire.break_duration,
      //   original_scheduled_date: taskToRetire.scheduled_date,
      //   retired_at: new Date().toISOString(),
      //   is_critical: taskToRetire.is_critical, 
      //   is_locked: taskToRetire.is_locked,
      //   energy_cost: taskToRetire.energy_cost ?? 0,
      // };
      // queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId], (old) =>
      //   [newRetiredTask, ...(old || [])]
      // );

      return { previousScheduledTasks, previousRetiredTasks };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
      showSuccess('Task moved to Aether Sink.');
    },
    onError: (err, taskToRetire, context) => {
      showError(`Failed to retire task: ${err.message}`);
      if (context?.previousScheduledTasks) {
        queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], context.previousScheduledTasks);
      }
      if (context?.previousRetiredTasks) {
        queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId], context.previousRetiredTasks);
      }
    }
  });

  const rezoneTaskMutation = useMutation({
    mutationFn: async (retiredTaskId: string) => {
      if (!userId) throw new Error("User not authenticated.");

      const { error: deleteError } = await supabase.from('retired_tasks').delete().eq('id', retiredTaskId).eq('user_id', userId);
      if (deleteError) throw new Error(`Failed to remove task from Aether Sink: ${deleteError.message}`);
    },
    onMutate: async (retiredTaskId: string) => {
      await queryClient.cancelQueries({ queryKey: ['retiredTasks', userId] });
      const previousRetiredTasks = queryClient.getQueryData<RetiredTask[]>(['retiredTasks', userId]);

      queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId], (old) =>
        (old || []).filter(task => task.id !== retiredTaskId)
      );
      return { previousRetiredTasks };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId] });
      showSuccess('Task removed from Aether Sink.');
    },
    onError: (err, retiredTaskId, context) => {
      showError(`Failed to remove task from Aether Sink: ${err.message}`);
      if (context?.previousRetiredTasks) {
        queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId], context.previousRetiredTasks);
      }
    }
  });

  const compactScheduledTasksMutation = useMutation({
    mutationFn: async ({ tasksToUpdate }: { tasksToUpdate: DBScheduledTask[] }) => { // Removed isVibeFlowEnabled
      if (!userId) throw new Error("User not authenticated.");

      const updatableTasks = tasksToUpdate.filter(task => task.is_flexible && !task.is_locked);
      const nonUpdatableTasks = tasksToUpdate.filter(task => !task.is_flexible || task.is_locked);

      if (updatableTasks.length === 0 && nonUpdatableTasks.length > 0) {
        showSuccess("No flexible tasks to compact, fixed/locked tasks were skipped.");
        return;
      } else if (updatableTasks.length === 0) {
        showSuccess("No flexible tasks to compact.");
        return;
      }

      const updates = updatableTasks.map(task => ({
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
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from('scheduled_tasks').upsert(updates, { onConflict: 'id' });

      if (error) {
        console.error("useSchedulerTasks: Error compacting tasks:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully compacted tasks.");
    },
    onMutate: async ({ tasksToUpdate }: { tasksToUpdate: DBScheduledTask[] }) => { // Removed isVibeFlowEnabled
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);

      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], (old) => {
        const updatedTasks = (old || []).map(oldTask => {
          const newTask = tasksToUpdate.find(t => t.id === oldTask.id);
          return newTask && newTask.is_flexible && !newTask.is_locked ? newTask : oldTask;
        });
        return updatedTasks;
      });
      return { previousScheduledTasks };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      showSuccess('Schedule compacted!');
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
          updated_at: new Date().toISOString(),
        }));
        const { error } = await supabase.from('scheduled_tasks').upsert(updates, { onConflict: 'id' });
        if (error) throw new Error(`Failed to update placed breaks: ${error.message}`);
      }

      if (failedToPlaceBreaks.length > 0) {
        const { error: deleteError } = await supabase
          .from('scheduled_tasks')
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

      const nonBreakTasks = currentDbTasks.filter(task => task.name.toLowerCase() !== 'break');
      let breakTasksToRandomize = currentDbTasks.filter(task => task.name.toLowerCase() === 'break' && !task.is_locked);

      if (breakTasksToRandomize.length === 0) {
        return { previousScheduledTasks };
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
        ...currentDbTasks.filter(task => task.name.toLowerCase() === 'break' && task.is_locked),
        ...optimisticPlacedBreaks
      ];

      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, selectedDate, sortBy], newScheduledTasks);

      return { previousScheduledTasks };
    },
    onSuccess: ({ placedBreaks, failedToPlaceBreaks }) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      if (placedBreaks.length > 0) {
        showSuccess(`Successfully randomized and placed ${placedBreaks.length} breaks.`);
      }
      if (failedToPlaceBreaks.length > 0) {
        showError(`Failed to place ${failedToPlaceBreaks.length} breaks due to no available slots.`);
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
    mutationFn: async ({ taskId, isLocked }: { taskId: string; isLocked: boolean }) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log(`useSchedulerTasks: Attempting to toggle lock for task ID: ${taskId} to ${isLocked}`);
      const { data, error } = await supabase
        .from('scheduled_tasks')
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

      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], (old) =>
        (old || []).map(task =>
          task.id === taskId ? { ...task, is_locked: isLocked } : task
        )
      );
      return { previousScheduledTasks };
    },
    onSuccess: (updatedTask) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      showSuccess(`Task "${updatedTask.name}" ${updatedTask.is_locked ? 'locked' : 'unlocked'}.`);
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
      console.log(`useSchedulerTasks: Attempting to toggle lock for retired task ID: ${taskId} to ${isLocked}`);
      const { data, error } = await supabase
        .from('retired_tasks')
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
      await queryClient.cancelQueries({ queryKey: ['retiredTasks', userId] });
      const previousRetiredTasks = queryClient.getQueryData<RetiredTask[]>(['retiredTasks', userId]);

      queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId], (old) =>
        (old || []).map(task =>
          task.id === taskId ? { ...task, is_locked: isLocked } : task
        )
      );
      return { previousRetiredTasks };
    },
    onSuccess: (updatedTask) => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId] });
      showSuccess(`Retired task "${updatedTask.name}" ${updatedTask.is_locked ? 'locked' : 'unlocked'}.`);
    },
    onError: (err, { taskId, isLocked }, context) => {
      showError(`Failed to toggle lock for retired task: ${err.message}`);
      if (context?.previousRetiredTasks) {
        queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId], context.previousRetiredTasks);
      }
    }
  });

  const aetherDumpMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("User not authenticated.");

      const { data: currentScheduledTasks, error: fetchError } = await supabase
        .from('scheduled_tasks')
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
      }));

      const { error: insertError } = await supabase.from('retired_tasks').insert(newRetiredTasks);
      if (insertError) throw new Error(`Failed to move tasks to Aether Sink: ${insertError.message}`);

      const { error: deleteError } = await supabase
        .from('scheduled_tasks')
        .delete()
        .in('id', tasksToDump.map(task => task.id))
        .eq('user_id', userId);
      if (deleteError) throw new Error(`Failed to remove tasks from schedule: ${deleteError.message}`);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      await queryClient.cancelQueries({ queryKey: ['retiredTasks', userId] });

      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);
      const previousRetiredTasks = queryClient.getQueryData<RetiredTask[]>(['retiredTasks', userId]);

      const tasksToDump = (previousScheduledTasks || []).filter(task => task.is_flexible && !task.is_locked);
      const remainingScheduledTasks = (previousScheduledTasks || []).filter(task => !task.is_flexible || task.is_locked);
      
      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], remainingScheduledTasks);

      // Removed optimistic update for retiredTasks to prevent duplicates
      // const now = new Date().toISOString();
      // const optimisticRetiredTasks: RetiredTask[] = tasksToDump.map(task => ({
      //   id: task.id,
      //   user_id: userId!,
      //   name: task.name,
      //   duration: (task.start_time && task.end_time) 
      //             ? Math.floor((parseISO(task.end_time).getTime() - parseISO(task.start_time).getTime()) / (1000 * 60)) 
      //             : null,
      //   break_duration: task.break_duration,
      //   original_scheduled_date: task.scheduled_date,
      //   retired_at: now,
      //   is_critical: task.is_critical,
      //   is_locked: task.is_locked,
      //   energy_cost: task.energy_cost ?? 0,
      // }));
      // queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId], (old) =>
      //   [...optimisticRetiredTasks, ...(old || [])]
      // );

      return { previousScheduledTasks, previousRetiredTasks };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
      showSuccess('Flexible tasks moved to Aether Sink!');
    },
    onError: (err, _variables, context) => {
      showError(`Failed to perform Aether Dump: ${err.message}`);
      if (context?.previousScheduledTasks) {
        queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], context.previousScheduledTasks);
      }
      if (context?.previousRetiredTasks) {
        queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId], context.previousRetiredTasks);
      }
    }
  });

  const aetherDumpMegaMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("User not authenticated.");

      const { data: allFlexibleScheduledTasks, error: fetchError } = await supabase
        .from('scheduled_tasks')
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
      }));

      const { error: insertError } = await supabase.from('retired_tasks').insert(newRetiredTasks);
      if (insertError) throw new Error(`Failed to move tasks to Aether Sink (Mega): ${insertError.message}`);

      const { error: deleteError } = await supabase
        .from('scheduled_tasks')
        .delete()
        .in('id', allFlexibleScheduledTasks.map(task => task.id))
        .eq('user_id', userId);
      if (deleteError) throw new Error(`Failed to remove tasks from schedule (Mega): ${deleteError.message}`);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId] });
      await queryClient.cancelQueries({ queryKey: ['retiredTasks', userId] });
      await queryClient.cancelQueries({ queryKey: ['datesWithTasks', userId] });

      const previousRetiredTasks = queryClient.getQueryData<RetiredTask[]>(['retiredTasks', userId]);

      // Removed optimistic update for retiredTasks to prevent duplicates
      // const currentScheduledTasksSnapshot = queryClient.getQueriesData<DBScheduledTask[]>({ queryKey: ['scheduledTasks', userId] })
      //   .flatMap(([_key, data]) => data || [])
      //   .filter(task => task.is_flexible && !task.is_locked && isAfter(parseISO(task.scheduled_date), subDays(startOfDay(new Date()), 1)));

      // const now = new Date().toISOString();
      // const optimisticRetiredTasks: RetiredTask[] = currentScheduledTasksSnapshot.map(task => ({
      //   id: task.id,
      //   user_id: userId!,
      //   name: task.name,
      //   duration: (task.start_time && task.end_time) 
      //             ? Math.floor((parseISO(task.end_time).getTime() - parseISO(task.start_time).getTime()) / (1000 * 60)) 
      //             : null,
      //   break_duration: task.break_duration,
      //   original_scheduled_date: task.scheduled_date,
      //   retired_at: now,
      //   is_critical: task.is_critical,
      //   is_locked: task.is_locked,
      //   energy_cost: task.energy_cost ?? 0,
      // }));
      // queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId], (old) =>
      //   [...optimisticRetiredTasks, ...(old || [])]
      // );

      return { previousRetiredTasks };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
      showSuccess('All flexible tasks from today and future moved to Aether Sink!');
    },
    onError: (err, _variables, context) => {
      showError(`Failed to perform Aether Dump Mega: ${err.message}`);
      if (context?.previousRetiredTasks) {
        queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId], context.previousRetiredTasks);
      }
    }
  });

  const autoBalanceScheduleMutation = useMutation({
    mutationFn: async (payload: AutoBalancePayload) => {
      if (!userId) throw new Error("User not authenticated.");

      // 1. Delete scheduled tasks
      if (payload.scheduledTaskIdsToDelete.length > 0) {
        const { error } = await supabase
          .from('scheduled_tasks')
          .delete()
          .in('id', payload.scheduledTaskIdsToDelete)
          .eq('user_id', userId)
          .eq('scheduled_date', payload.selectedDate);
        if (error) throw new Error(`Failed to delete old scheduled tasks: ${error.message}`);
      }

      // 2. Delete retired tasks
      if (payload.retiredTaskIdsToDelete.length > 0) {
        const { error } = await supabase
          .from('retired_tasks')
          .delete()
          .in('id', payload.retiredTaskIdsToDelete)
          .eq('user_id', userId);
        if (error) throw new Error(`Failed to delete old retired tasks: ${error.message}`);
      }

      // 3. Insert new scheduled tasks
      if (payload.tasksToInsert.length > 0) {
        const tasksToInsertWithUserId = payload.tasksToInsert.map(task => ({ ...task, user_id: userId }));
        const { error } = await supabase
          .from('scheduled_tasks')
          .insert(tasksToInsertWithUserId);
        if (error) throw new Error(`Failed to insert new scheduled tasks: ${error.message}`);
      }

      // 4. Insert tasks back into the sink (those that couldn't be placed)
      if (payload.tasksToKeepInSink.length > 0) {
        const tasksToKeepInSinkWithUserId = payload.tasksToKeepInSink.map(task => ({ 
          ...task, 
          user_id: userId, 
          retired_at: new Date().toISOString() 
        }));
        const { error } = await supabase
          .from('retired_tasks')
          .insert(tasksToKeepInSinkWithUserId);
        if (error) throw new Error(`Failed to re-insert unscheduled tasks into sink: ${error.message}`);
      }

      return { tasksPlaced: payload.tasksToInsert.length, tasksKeptInSink: payload.tasksToKeepInSink.length };
    },
    onMutate: async (payload: AutoBalancePayload) => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, payload.selectedDate, sortBy] });
      await queryClient.cancelQueries({ queryKey: ['retiredTasks', userId] });
      await queryClient.cancelQueries({ queryKey: ['datesWithTasks', userId] });
      
      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, payload.selectedDate, sortBy]);
      const previousRetiredTasks = queryClient.getQueryData<RetiredTask[]>(['retiredTasks', userId]);

      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, payload.selectedDate, sortBy], (old) =>
        (old || []).filter(task => !payload.scheduledTaskIdsToDelete.includes(task.id))
      );
      queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId], (old) =>
        (old || []).filter(task => !payload.retiredTaskIdsToDelete.includes(task.id))
      );

      return { previousScheduledTasks, previousRetiredTasks };
    },
    onSuccess: (result, payload) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, payload.selectedDate, sortBy] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
      
      let message = `Schedule balanced! ${result.tasksPlaced} task(s) placed.`;
      if (result.tasksKeptInSink > 0) {
        message += ` ${result.tasksKeptInSink} task(s) returned to Aether Sink.`;
      }
      showSuccess(message);
    },
    onError: (err, payload, context) => {
      showError(`Failed to auto-balance schedule: ${err.message}`);
      if (context?.previousScheduledTasks) {
        queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, payload.selectedDate, sortBy], context.previousScheduledTasks);
      }
      if (context?.previousRetiredTasks) {
        queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId], context.previousRetiredTasks);
      }
    }
  });

  const updateScheduledTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, isCompleted }: { taskId: string; isCompleted: boolean }) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log(`useSchedulerTasks: Attempting to update completion status for task ID: ${taskId} to ${isCompleted}`);
      const { data, error } = await supabase
        .from('scheduled_tasks')
        .update({ is_completed: isCompleted, updated_at: new Date().toISOString() })
        .eq('id', taskId)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) {
        console.error("useSchedulerTasks: Error updating task completion status:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully updated completion status for task:", data);
      return data as DBScheduledTask;
    },
    onMutate: async ({ taskId, isCompleted }: { taskId: string; isCompleted: boolean }) => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);

      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], (old) =>
        (old || []).map(task =>
          task.id === taskId ? { ...task, is_completed: isCompleted } : task
        )
      );
      return { previousScheduledTasks };
    },
    onSuccess: (updatedTask) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      showSuccess(`Task "${updatedTask.name}" marked as ${updatedTask.is_completed ? 'completed' : 'incomplete'}.`);
    },
    onError: (err, { taskId, isCompleted }, context) => {
      showError(`Failed to update completion status for task: ${err.message}`);
      if (context?.previousScheduledTasks) {
        queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], context.previousScheduledTasks);
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

        showSuccess(`Task completed! -${taskToComplete.energy_cost} Energy`);
        if (newLevel > profile.level) {
          showSuccess(`🎉 Level Up! You reached Level ${newLevel}!`);
          triggerLevelUp(newLevel);
        }
      }

      // Conditional completion logic
      if (taskToComplete.is_flexible) {
        await removeScheduledTaskMutation.mutateAsync(taskToComplete.id);
      } else {
        await updateScheduledTaskStatusMutation.mutateAsync({ taskId: taskToComplete.id, isCompleted: true });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
    },
    onError: (err) => {
      if (err.message !== "Insufficient energy." && err.message !== "Failed to update profile stats.") {
        showError(`Failed to complete scheduled task: ${err.message}`);
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
    updateScheduledTaskStatus: updateScheduledTaskStatusMutation.mutate, // Expose for other uses if needed
    sortBy,
    setSortBy,
    xpGainAnimation,
    clearXpGainAnimation,
  };
};