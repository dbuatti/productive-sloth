import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Task, NewTask, TaskStatusFilter, TemporalFilter } from '@/types'; // Keep Task and NewTask from '@/types' if they are distinct
import { DBScheduledTask, NewDBScheduledTask, RawTaskInput, RetiredTask, NewRetiredTask, SortBy, TaskPriority, TimeBlock, AutoBalancePayload } from '@/types/scheduler'; // Import scheduler types, including RawTaskInput, new retired task types, SortBy, and TaskPriority, TimeBlock, AutoBalancePayload
import { useSession } from './use-session';
import { showSuccess, showError } from '@/utils/toast';
import { startOfDay, subDays, formatISO, compareDesc, parseISO, isToday, isYesterday, format, addMinutes, isBefore, isAfter } from 'date-fns'; // Import format, addMinutes, isBefore, isAfter
import { XP_PER_LEVEL, MAX_ENERGY } from '@/lib/constants'; // Import constants
import { mergeOverlappingTimeBlocks, getFreeTimeBlocks, isSlotFree } from '@/lib/scheduler-utils'; // Import scheduler utility functions, including isSlotFree

// Helper function to calculate date boundaries for server-side filtering
const getDateRange = (filter: TemporalFilter): { start: string, end: string } | null => {
  const now = new Date();
  const startOfToday = startOfDay(now);
  
  let startDate: Date;
  let endDate: Date;

  switch (filter) {
    case 'TODAY':
      // For TODAY, we want tasks due anytime in the past (to catch overdue tasks) 
      // up until the end of today.
      // We use a very old date for the start to capture all past dates.
      startDate = new Date(0); // Epoch time, effectively capturing all past dates
      endDate = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000); // End of today
      break;
    case 'YESTERDAY':
      startDate = subDays(startOfToday, 1);
      endDate = startOfToday; // Start of today
      break;
    case 'LAST_7_DAYS':
      startDate = subDays(startOfToday, 7);
      endDate = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000); // End of today
      break;
    default:
      return null;
  }

  return {
    start: formatISO(startDate),
    end: formatISO(endDate),
  };
};

// Helper function for client-side sorting (only used for PRIORITY sorting)
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
    // If not sorting by priority, maintain the order returned by the server (or use a secondary sort if needed)
    // Since we rely on the server for DUE_DATE sort, we only need to handle PRIORITY here.
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

export const useTasks = () => {
  const queryClient = useQueryClient();
  const { user, profile, refreshProfile, triggerLevelUp } = useSession(); // Get profile, refreshProfile, and triggerLevelUp
  const userId = user?.id;

  const [temporalFilter, setTemporalFilter] = useState<TemporalFilter>('TODAY');
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('ACTIVE'); // Changed default to 'ACTIVE'
  const [sortBy, setSortBy] = useState<SortBy>('PRIORITY_HIGH_TO_LOW'); // Updated default sort
  const [xpGainAnimation, setXpGainAnimation] = useState<{ taskId: string, xpAmount: number } | null>(null); // New state for XP animation

  const fetchTasks = useCallback(async (currentTemporalFilter: TemporalFilter, currentSortBy: SortBy): Promise<Task[]> => {
    if (!userId) return [];
    
    let query = supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId);

    const dateRange = getDateRange(currentTemporalFilter);

    if (dateRange) {
      // Use gte for start date and lte for end date
      query = query
        .lte('due_date', dateRange.end)
        .gte('due_date', dateRange.start);
    }
    
    // Server-side sorting optimization
    if (currentSortBy === 'TIME_EARLIEST_TO_LATEST') {
      query = query.order('due_date', { ascending: true });
    } else if (currentSortBy === 'TIME_LATEST_TO_EARLIEST') {
      query = query.order('due_date', { ascending: false });
    } else {
      // Default stable sort for PRIORITY client-side sort
      query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);
    return data as Task[];
  }, [userId]);

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ['tasks', userId, temporalFilter, sortBy], // Refetch when temporal filter or sort changes
    queryFn: () => fetchTasks(temporalFilter, sortBy),
    enabled: !!userId,
  });

  // --- Filtering and Sorting Logic (Status filtering and PRIORITY sorting remain client-side) ---
  const filteredTasks = useMemo(() => {
    let result = tasks;

    if (statusFilter === 'ACTIVE') {
      result = result.filter(task => !task.is_completed);
    } else if (statusFilter === 'COMPLETED') {
      result = result.filter(task => task.is_completed);
    }

    // Only apply client-side sort if sorting by PRIORITY (due date is handled by the server)
    if (sortBy.startsWith('PRIORITY')) {
      return sortTasks(result, sortBy);
    }
    
    return result;
  }, [tasks, statusFilter, sortBy]);

  // --- CRUD Mutations ---

  const addTaskMutation = useMutation({
    mutationFn: async (newTask: NewTask) => {
      if (!userId) throw new Error("User not authenticated.");
      const taskToInsert = { ...newTask, user_id: userId };
      const { data, error } = await supabase.from('tasks').insert(taskToInsert).select().single();
      if (error) throw new Error(error.message);
      return data as Task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      showSuccess('Task added successfully!');
    },
    onError: (e) => {
      showError(`Failed to add task: ${e.message}`);
    }
  });

  const updateTaskMutation = useMutation({
    mutationFn: async (task: Partial<Task> & { id: string }) => {
      const { data, error } = await supabase
        .from('tasks')
        .update(task)
        .eq('id', task.id)
        .select()
        .single();
      
      if (error) throw new Error(error.message);
      return data as Task;
    },
    onSuccess: async (updatedTask) => {
      // Invalidate queries to force a refetch/re-evaluation of tasks
      await queryClient.invalidateQueries({ queryKey: ['tasks', userId] });

      // Handle XP gain, Streak update, Energy deduction, and tasks_completed_today increment on task completion
      if (updatedTask.is_completed && profile && user) {
        const taskBeforeUpdate = tasks.find(t => t.id === updatedTask.id);
        // Only process if the task was NOT completed before this update
        if (taskBeforeUpdate && !taskBeforeUpdate.is_completed) {
          // Energy Check
          if (profile.energy < updatedTask.energy_cost) {
            showError(`Not enough energy to complete "${updatedTask.title}". You need ${updatedTask.energy_cost} energy, but have ${profile.energy}.`);
            // Revert task completion in UI if energy is insufficient
            // This optimistic update needs to be reverted if the server-side logic fails
            // For now, the invalidateQueries above will handle fetching the correct state from DB
            return; // Stop further processing
          }

          let xpGained = updatedTask.metadata_xp;
          // Add XP bonus for critical tasks completed on the day they are flagged
          if (updatedTask.is_critical && isToday(parseISO(updatedTask.due_date))) {
            xpGained += 5; // +5 XP bonus for critical tasks
            showSuccess(`Critical task bonus! +5 XP`);
          }

          const newXp = profile.xp + xpGained;
          const { level: newLevel } = calculateLevelAndRemainingXp(newXp);
          const newEnergy = Math.max(0, profile.energy - updatedTask.energy_cost); // Deduct energy, ensure not negative
          const newTasksCompletedToday = profile.tasks_completed_today + 1; // Increment tasks completed today

          let newDailyStreak = profile.daily_streak;
          let newLastStreakUpdate = profile.last_streak_update ? parseISO(profile.last_streak_update) : null;
          const now = new Date();
          const today = startOfDay(now);

          if (!newLastStreakUpdate || isYesterday(newLastStreakUpdate)) {
            // If no previous update or last update was yesterday, increment streak
            newDailyStreak += 1;
          } else if (!isToday(newLastStreakUpdate)) {
            // If last update was not today or yesterday, reset streak
            newDailyStreak = 1;
          }
          // If isToday(newLastStreakUpdate), streak doesn't change for today

          const { error: profileError } = await supabase
            .from('profiles')
            .update({ 
              xp: newXp, 
              level: newLevel, 
              daily_streak: newDailyStreak,
              last_streak_update: today.toISOString(), // Update streak date to today
              energy: newEnergy, // Update energy
              tasks_completed_today: newTasksCompletedToday, // Update tasks completed today
              updated_at: new Date().toISOString() 
            })
            .eq('id', user.id);

          if (profileError) {
            console.error("Failed to update user profile (XP, streak, energy, tasks_completed_today):", profileError.message);
            showError("Failed to update profile stats.");
          } else {
            await refreshProfile(); // Refresh local profile state
            
            // --- Trigger XP Animation ---
            setXpGainAnimation({ taskId: updatedTask.id, xpAmount: xpGained }); // Use xpGained
            // ---------------------------

            showSuccess(`Task completed! -${updatedTask.energy_cost} Energy`);
            if (newLevel > profile.level) {
              showSuccess(`🎉 Level Up! You reached Level ${newLevel}!`);
              triggerLevelUp(newLevel); // Trigger the level up celebration
            }
          }
        } else if (!updatedTask.is_completed && profile && user) {
          // If task is uncompleted, just refresh profile to ensure consistency if other updates happened.
          await refreshProfile();
        }
      } else if (updatedTask.is_completed) {
        // If task was already completed, just show success (no XP/streak/energy change)
        showSuccess('Task completed!');
      }
    },
    onError: (e) => {
      showError(`Failed to update task: ${e.message}`);
    }
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      showSuccess('Task deleted.');
    },
    onError: (e) => {
      showError(`Failed to delete task: ${e.message}`);
    }
  });

  const clearXpGainAnimation = useCallback(() => {
    setXpGainAnimation(null);
  }, []);

  return {
    tasks: filteredTasks,
    allTasks: tasks,
    isLoading,
    temporalFilter,
    setTemporalFilter,
    statusFilter,
    setStatusFilter,
    sortBy,
    setSortBy,
    addTask: addTaskMutation.mutate,
    updateTask: updateTaskMutation.mutate,
    deleteTask: deleteTaskMutation.mutate,
    xpGainAnimation, // Expose XP animation state
    clearXpGainAnimation, // Expose clear function
  };
};

export const useSchedulerTasks = (selectedDate: string) => { // Changed to string
  const queryClient = useQueryClient();
  const { user } = useSession();
  const userId = user?.id;

  const formattedSelectedDate = selectedDate; // Now directly use selectedDate

  const [sortBy, setSortBy] = useState<SortBy>('TIME_EARLIEST_TO_LATEST'); // NEW: State for sorting

  // Fetch all scheduled tasks for the current user and selected date
  const { data: dbScheduledTasks = [], isLoading } = useQuery<DBScheduledTask[]>({
    queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy], // Include sortBy in query key
    queryFn: async () => {
      if (!userId) {
        console.log("useSchedulerTasks: No user ID, returning empty array.");
        return [];
      }
      // NEW: Prevent query if selectedDate is empty
      if (!formattedSelectedDate) {
        console.log("useSchedulerTasks: No selected date, returning empty array.");
        return [];
      }
      console.log("useSchedulerTasks: Fetching scheduled tasks for user:", userId, "on date:", formattedSelectedDate, "sorted by:", sortBy);
      let query = supabase
        .from('scheduled_tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('scheduled_date', formattedSelectedDate); // Filter by scheduled_date

      // Apply sorting based on sortBy state
      if (sortBy === 'TIME_EARLIEST_TO_LATEST') {
        query = query.order('start_time', { ascending: true });
      } else if (sortBy === 'TIME_LATEST_TO_EARLIEST') {
        query = query.order('start_time', { ascending: false });
      } else if (sortBy === 'PRIORITY_HIGH_TO_LOW') {
        // For priority, we need to sort by is_critical first (true comes before false), then by start_time
        query = query.order('is_critical', { ascending: false }).order('start_time', { ascending: true });
      } else if (sortBy === 'PRIORITY_LOW_TO_HIGH') {
        // For priority, we need to sort by is_critical first (false comes before true), then by start_time
        query = query.order('is_critical', { ascending: true }).order('start_time', { ascending: true });
      } else {
        query = query.order('created_at', { ascending: true }); // Default stable sort
      }

      const { data, error } = await query;

      if (error) {
        console.error("useSchedulerTasks: Error fetching scheduled tasks:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully fetched tasks:", data.map(t => ({ id: t.id, name: t.name, scheduled_date: t.scheduled_date, start_time: t.start_time, end_time: t.end_time, is_critical: t.is_critical, is_flexible: t.is_flexible, is_locked: t.is_locked, energy_cost: t.energy_cost }))); // Detailed log
      return data as DBScheduledTask[];
    },
    enabled: !!userId && !!formattedSelectedDate, // Also update enabled condition
  });

  // Fetch all unique dates that have scheduled tasks for the calendar strip indicators
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
      // Extract unique dates and format them as 'YYYY-MM-DD'
      const uniqueDates = Array.from(new Set(data.map(item => format(parseISO(item.scheduled_date), 'yyyy-MM-dd'))));
      return uniqueDates;
    },
    enabled: !!userId,
  });

  // NEW: Fetch all retired tasks for the current user
  const { data: retiredTasks = [], isLoading: isLoadingRetiredTasks } = useQuery<RetiredTask[]>({
    queryKey: ['retiredTasks', userId],
    queryFn: async () => {
      if (!userId) return [];
      console.log("useSchedulerTasks: Fetching retired tasks for user:", userId);
      const { data, error } = await supabase
        .from('retired_tasks')
        .select('*')
        .eq('user_id', userId)
        .order('retired_at', { ascending: false }); // Order by most recently retired

      if (error) {
        console.error("useSchedulerTasks: Error fetching retired tasks:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully fetched retired tasks:", data.map(t => ({ id: t.id, name: t.name, is_critical: t.is_critical, is_locked: t.is_locked, energy_cost: t.energy_cost }))); // Removed is_flexible from log
      return data as RetiredTask[];
    },
    enabled: !!userId,
  });


  // Convert DBScheduledTask to RawTaskInput for the scheduler logic
  const rawTasks: RawTaskInput[] = dbScheduledTasks.map(dbTask => ({
    name: dbTask.name,
    duration: Math.floor((parseISO(dbTask.end_time!).getTime() - parseISO(dbTask.start_time!).getTime()) / (1000 * 60)), // Derive duration
    breakDuration: dbTask.break_duration ?? undefined,
    isCritical: dbTask.is_critical, // Pass critical flag
    energyCost: dbTask.energy_cost, // NEW: Pass energyCost (now required)
  }));

  // Add a new scheduled task
  const addScheduledTaskMutation = useMutation({
    mutationFn: async (newTask: NewDBScheduledTask) => {
      if (!userId) throw new Error("User not authenticated.");
      const taskToInsert = { ...newTask, user_id: userId, energy_cost: newTask.energy_cost ?? 0 }; // Ensure energy_cost is always a number
      console.log("useSchedulerTasks: Attempting to insert new task:", taskToInsert);
      const { data, error } = await supabase.from('scheduled_tasks').insert(taskToInsert).select().single();
      if (error) {
        console.error("useSchedulerTasks: Error inserting task:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully inserted task:", data);
      return data as DBScheduledTask;
    },
    // NEW: Optimistic update logic
    onMutate: async (newTask: NewDBScheduledTask) => {
      // Cancel any outgoing refetches for the scheduled tasks query
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });

      // Snapshot the previous value
      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);

      // Optimistically update to the new value
      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], (old) => {
        const tempId = Math.random().toString(36).substring(2, 9); // Temporary ID for optimistic item
        const now = new Date().toISOString();
        const optimisticTask: DBScheduledTask = {
          id: tempId, // Use temp ID
          user_id: userId!,
          name: newTask.name,
          break_duration: newTask.break_duration ?? null,
          start_time: newTask.start_time ?? now, // Provide fallback if not present
          end_time: newTask.end_time ?? now, // Provide fallback if not present
          scheduled_date: newTask.scheduled_date,
          created_at: now,
          updated_at: now,
          is_critical: newTask.is_critical ?? false,
          is_flexible: newTask.is_flexible ?? true,
          is_locked: newTask.is_locked ?? false, // ADDED: is_locked property
          energy_cost: newTask.energy_cost ?? 0, // NEW: Ensure energy_cost is always a number
        };
        return [...(old || []), optimisticTask];
      });

      // Return a context object with the snapshotted value
      return { previousScheduledTasks };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] }); // Invalidate for current date
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] }); // Invalidate for dates with tasks
      showSuccess('Task added to schedule!');
    },
    onError: (err, newTask, context) => {
      showError(`Failed to add task to schedule: ${err.message}`);
      // Rollback to the previous cached value on error
      if (context?.previousScheduledTasks) {
        queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], context.previousScheduledTasks);
      }
    }
  });

  // NEW: Add a new retired task directly to the Aether Sink
  const addRetiredTaskMutation = useMutation({
    mutationFn: async (newTask: NewRetiredTask) => {
      if (!userId) throw new Error("User not authenticated.");
      const taskToInsert = { ...newTask, user_id: userId, retired_at: new Date().toISOString(), energy_cost: newTask.energy_cost ?? 0 }; // Ensure energy_cost is always a number
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

      queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId], (old) => {
        const tempId = Math.random().toString(36).substring(2, 9);
        const optimisticTask: RetiredTask = {
          id: tempId,
          user_id: userId!,
          name: newTask.name,
          duration: newTask.duration ?? null,
          break_duration: newTask.break_duration ?? null,
          original_scheduled_date: newTask.original_scheduled_date,
          retired_at: new Date().toISOString(),
          is_critical: newTask.is_critical ?? false,
          is_locked: newTask.is_locked ?? false, // ADDED: is_locked property
          energy_cost: newTask.energy_cost ?? 0, // NEW: Ensure energy_cost is always a number
        };
        return [optimisticTask, ...(old || [])];
      });
      return { previousRetiredTasks };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId] });
      showSuccess('Task sent directly to Aether Sink!');
    },
    onError: (err, newTask, context) => {
      showError(`Failed to send task to Aether Sink: ${err.message}`);
      if (context?.previousRetiredTasks) {
        queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId], context.previousRetiredTasks);
      }
    }
  });


  // Remove a specific scheduled task by ID
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
    // NEW: Optimistic update for removeScheduledTask
    onMutate: async (taskId: string) => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);

      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], (old) =>
        (old || []).filter(task => task.id !== taskId)
      );
      return { previousScheduledTasks };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] }); // Invalidate for current date
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] }); // Invalidate for dates with tasks
      showSuccess('Task removed from schedule.');
    },
    onError: (e, taskId, context) => {
      showError(`Failed to remove task from schedule: ${e.message}`);
      if (context?.previousScheduledTasks) {
        queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], context.previousScheduledTasks);
      }
    }
  });

  // Clear all scheduled tasks for the user
  const clearScheduledTasksMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("useSchedulerTasks: Attempting to clear all scheduled tasks for user:", userId);
      const { error } = await supabase.from('scheduled_tasks').delete().eq('user_id', userId).eq('scheduled_date', formattedSelectedDate); // Clear only for selected date
      if (error) {
        console.error("useSchedulerTasks: Error clearing scheduled tasks:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully cleared all scheduled tasks for user:", userId, "on date:", formattedSelectedDate);
    },
    // NEW: Optimistic update for clearScheduledTasks
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);

      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], []);
      return { previousScheduledTasks };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] }); // Invalidate for current date
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] }); // Invalidate for dates with tasks
      showSuccess('Schedule cleared for today!');
    },
    onError: (e, _variables, context) => {
      showError(`Failed to clear schedule: ${e.message}`);
      if (context?.previousScheduledTasks) {
        queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], context.previousScheduledTasks);
      }
    }
  });

  // NEW: Retire a task (move from scheduled_tasks to retired_tasks)
  const retireTaskMutation = useMutation({
    mutationFn: async (taskToRetire: DBScheduledTask) => {
      if (!userId) throw new Error("User not authenticated.");

      // 1. Insert into retired_tasks
      const newRetiredTask: NewRetiredTask = {
        user_id: userId,
        name: taskToRetire.name,
        duration: (taskToRetire.start_time && taskToRetire.end_time) 
                  ? Math.floor((parseISO(taskToRetire.end_time).getTime() - parseISO(taskToRetire.start_time).getTime()) / (1000 * 60)) 
                  : null, // Derive duration for retired task
        break_duration: taskToRetire.break_duration,
        original_scheduled_date: taskToRetire.scheduled_date,
        is_critical: taskToRetire.is_critical, // Pass critical flag
        is_locked: taskToRetire.is_locked, // Pass locked flag
        energy_cost: taskToRetire.energy_cost ?? 0, // NEW: Ensure energy_cost is always a number
      };
      const { error: insertError } = await supabase.from('retired_tasks').insert(newRetiredTask);
      if (insertError) throw new Error(`Failed to move task to Aether Sink: ${insertError.message}`);

      // 2. Delete from scheduled_tasks
      const { error: deleteError } = await supabase.from('scheduled_tasks').delete().eq('id', taskToRetire.id).eq('user_id', userId);
      if (deleteError) throw new Error(`Failed to remove task from schedule: ${deleteError.message}`);
    },
    // NEW: Optimistic update for retireTask
    onMutate: async (taskToRetire: DBScheduledTask) => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      await queryClient.cancelQueries({ queryKey: ['retiredTasks', userId] });

      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);
      const previousRetiredTasks = queryClient.getQueryData<RetiredTask[]>(['retiredTasks', userId]);

      // Optimistically remove from scheduledTasks
      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], (old) =>
        (old || []).filter(task => task.id !== taskToRetire.id)
      );

      // Optimistically add to retiredTasks
      const newRetiredTask: RetiredTask = {
        id: taskToRetire.id, // Use original ID for optimistic update
        user_id: userId!,
        name: taskToRetire.name,
        duration: (taskToRetire.start_time && taskToRetire.end_time) 
                  ? Math.floor((parseISO(taskToRetire.end_time).getTime() - parseISO(taskToRetire.start_time).getTime()) / (1000 * 60)) 
                  : null,
        break_duration: taskToRetire.break_duration,
        original_scheduled_date: taskToRetire.scheduled_date,
        retired_at: new Date().toISOString(),
        is_critical: taskToRetire.is_critical,
        is_locked: taskToRetire.is_locked, // ADDED: is_locked property
        energy_cost: taskToRetire.energy_cost ?? 0, // NEW: Ensure energy_cost is always a number
      };
      queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId], (old) =>
        [newRetiredTask, ...(old || [])]
      );

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
      // Revert optimistic updates on error
      if (context?.previousScheduledTasks) {
        queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], context.previousScheduledTasks);
      }
      if (context?.previousRetiredTasks) {
        queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId], context.previousRetiredTasks);
      }
    }
  });

  // NEW: Rezone a task (delete from retired_tasks)
  const rezoneTaskMutation = useMutation({
    mutationFn: async (retiredTaskId: string) => { // Changed to take taskId
      if (!userId) throw new Error("User not authenticated.");

      // Delete from retired_tasks
      const { error: deleteError } = await supabase.from('retired_tasks').delete().eq('id', retiredTaskId).eq('user_id', userId);
      if (deleteError) throw new Error(`Failed to remove task from Aether Sink: ${deleteError.message}`);
    },
    // NEW: Optimistic update for rezoneTask (only handles removal from retiredTasks cache)
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
      showSuccess('Task removed from Aether Sink.'); // This toast is for the deletion from sink
    },
    onError: (err, retiredTaskId, context) => {
      showError(`Failed to remove task from Aether Sink: ${err.message}`); // More specific error message
      if (context?.previousRetiredTasks) {
        queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId], context.previousRetiredTasks);
      }
    }
  });

  // NEW: Compact scheduled tasks
  const compactScheduledTasksMutation = useMutation({
    mutationFn: async (tasksToUpdate: DBScheduledTask[]) => {
      if (!userId) throw new Error("User not authenticated.");

      // Filter out locked tasks AND non-flexible tasks from being updated by compaction
      const updatableTasks = tasksToUpdate.filter(task => task.is_flexible && !task.is_locked);
      const nonUpdatableTasks = tasksToUpdate.filter(task => !task.is_flexible || task.is_locked);

      if (updatableTasks.length === 0 && nonUpdatableTasks.length > 0) {
        showSuccess("No flexible tasks to compact, fixed/locked tasks were skipped.");
        return; // No actual update needed if only non-updatable tasks are present
      } else if (updatableTasks.length === 0) {
        showSuccess("No flexible tasks to compact.");
        return;
      }

      // Perform a batch update for all tasks that need new times
      const updates = updatableTasks.map(task => ({
        id: task.id,
        user_id: userId, // Explicitly include user_id to satisfy RLS
        name: task.name, // Include name
        break_duration: task.break_duration, // Include break_duration
        start_time: task.start_time,
        end_time: task.end_time,
        scheduled_date: task.scheduled_date, // Include scheduled_date
        is_critical: task.is_critical, // Include is_critical
        is_flexible: task.is_flexible, // Include is_flexible
        is_locked: task.is_locked, // Include is_locked
        energy_cost: task.energy_cost ?? 0, // NEW: Ensure energy_cost is always a number
        updated_at: new Date().toISOString(),
      }));

      // Use a transaction or multiple updates. For simplicity, multiple updates for now.
      // Supabase `upsert` can handle updates if `id` is present.
      const { error } = await supabase.from('scheduled_tasks').upsert(updates, { onConflict: 'id' });

      if (error) {
        console.error("useSchedulerTasks: Error compacting tasks:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully compacted tasks.");
    },
    // NEW: Optimistic update for compactScheduledTasks
    onMutate: async (tasksToUpdate: DBScheduledTask[]) => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);

      // Optimistically update only flexible and non-locked tasks
      const updatedTasks = (previousScheduledTasks || []).map(oldTask => {
        const newTask = tasksToUpdate.find(t => t.id === oldTask.id);
        // Only update if the task is flexible and not locked
        return newTask && newTask.is_flexible && !newTask.is_locked ? newTask : oldTask;
      });

      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], updatedTasks);
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

  // NEW: Randomize breaks mutation
  const randomizeBreaksMutation = useMutation({
    mutationFn: async ({ selectedDate, workdayStartTime, workdayEndTime, currentDbTasks }: {
      selectedDate: string;
      workdayStartTime: Date;
      workdayEndTime: Date;
      currentDbTasks: DBScheduledTask[];
    }) => {
      if (!userId) throw new Error("User not authenticated.");

      const nonBreakTasks = currentDbTasks.filter(task => task.name.toLowerCase() !== 'break'); // All non-breaks, regardless of lock status
      let breakTasksToRandomize = currentDbTasks.filter(task => task.name.toLowerCase() === 'break' && !task.is_locked); // Only randomize unlocked breaks

      if (breakTasksToRandomize.length === 0) {
        showSuccess("No flexible break tasks to randomize.");
        return { placedBreaks: [], failedToPlaceBreaks: [] }; // No changes needed
      }

      // Shuffle break tasks for randomness
      for (let i = breakTasksToRandomize.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [breakTasksToRandomize[i], breakTasksToRandomize[j]] = [breakTasksToRandomize[j], breakTasksToRandomize[i]];
      }

      const placedBreaks: DBScheduledTask[] = [];
      const failedToPlaceBreaks: DBScheduledTask[] = [];

      // Create a temporary set of occupied blocks from non-break tasks and locked breaks
      let currentOccupiedBlocks: TimeBlock[] = mergeOverlappingTimeBlocks(
        currentDbTasks.filter(task => task.name.toLowerCase() !== 'break' || task.is_locked) // Fixed non-breaks and locked breaks
          .map(task => ({
            start: parseISO(task.start_time!),
            end: parseISO(task.end_time!),
            duration: Math.floor((parseISO(task.end_time!).getTime() - parseISO(task.start_time!).getTime()) / (1000 * 60))
          }))
      );

      for (const breakTask of breakTasksToRandomize) {
        const breakDuration = breakTask.break_duration || 15; // Default break duration
        let placed = false;

        // Recalculate free blocks for each break placement
        let freeBlocks = getFreeTimeBlocks(currentOccupiedBlocks, workdayStartTime, workdayEndTime);

        // Shuffle free blocks to add randomness to which gap is chosen
        for (let i = freeBlocks.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [freeBlocks[i], freeBlocks[j]] = [freeBlocks[j], freeBlocks[i]];
        }

        for (const freeBlock of freeBlocks) {
          if (breakDuration <= freeBlock.duration) {
            let proposedStartTime: Date;
            const remainingFreeTime = freeBlock.duration - breakDuration;

            // Heuristic: If there's significant extra free time, try to center the break
            // This helps prevent breaks from clustering at the very start/end of large free blocks
            const MIN_BUFFER_FOR_CENTERING = 30; // e.g., 30 minutes buffer on either side
            if (remainingFreeTime >= MIN_BUFFER_FOR_CENTERING * 2) {
              proposedStartTime = addMinutes(freeBlock.start, Math.floor(remainingFreeTime / 2));
            } else {
              // If the free block is just large enough or slightly larger, place at the start
              proposedStartTime = freeBlock.start;
            }
            
            let proposedEndTime = addMinutes(proposedStartTime, breakDuration);

            // Ensure proposed times are within the free block boundaries
            if (isBefore(proposedStartTime, freeBlock.start)) proposedStartTime = freeBlock.start;
            if (isAfter(proposedEndTime, freeBlock.end)) proposedEndTime = freeBlock.end;

            // Final check for slot freedom (should always be true if freeBlock was correctly identified)
            if (isSlotFree(proposedStartTime, proposedEndTime, currentOccupiedBlocks)) {
              const newBreakTask: DBScheduledTask = {
                ...breakTask,
                start_time: proposedStartTime.toISOString(),
                end_time: proposedEndTime.toISOString(),
                scheduled_date: selectedDate, // Ensure it's for the selected date
                is_flexible: true, // Breaks are always flexible
                is_locked: breakTask.is_locked, // Include is_locked
                energy_cost: breakTask.energy_cost ?? 0, // NEW: Ensure energy_cost is always a number
                updated_at: new Date().toISOString(),
              };
              placedBreaks.push(newBreakTask);
              // Update currentOccupiedBlocks for subsequent break placements
              currentOccupiedBlocks.push({ start: proposedStartTime, end: proposedEndTime, duration: breakDuration });
              currentOccupiedBlocks = mergeOverlappingTimeBlocks(currentOccupiedBlocks);
              placed = true;
              break; // Move to the next breakTask
            }
          }
        }

        if (!placed) {
          failedToPlaceBreaks.push(breakTask);
        }
      }

      // Perform batch update for all tasks that need new times
      if (placedBreaks.length > 0) {
        const updates = placedBreaks.map(task => ({
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
          energy_cost: task.energy_cost ?? 0, // NEW: Ensure energy_cost is always a number
          updated_at: new Date().toISOString(),
        }));
        const { error } = await supabase.from('scheduled_tasks').upsert(updates, { onConflict: 'id' });
        if (error) throw new Error(`Failed to update placed breaks: ${error.message}`);
      }

      // Delete any breaks that failed to be placed
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

      // Optimistic update logic mirrors the mutationFn's placement logic
      const optimisticPlacedBreaks: DBScheduledTask[] = [];
      const optimisticFailedToPlaceBreaks: DBScheduledTask[] = [];

      // Shuffle break tasks for randomness (client-side for optimistic update)
      for (let i = breakTasksToRandomize.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [breakTasksToRandomize[i], breakTasksToRandomize[j]] = [breakTasksToRandomize[j], breakTasksToRandomize[i]];
      }

      // Create a temporary set of occupied blocks from non-break tasks and locked breaks
      let optimisticOccupiedBlocks: TimeBlock[] = mergeOverlappingTimeBlocks(
        currentDbTasks.filter(task => task.name.toLowerCase() !== 'break' || task.is_locked) // Fixed non-breaks and locked breaks
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

        // Shuffle free blocks for randomness
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
                energy_cost: breakTask.energy_cost ?? 0, // NEW: Ensure energy_cost is always a number
                updated_at: new Date().toISOString(),
              };
              optimisticPlacedBreaks.push(newBreakTask);
              // Update optimistic occupied blocks for subsequent break placements
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

      // Construct the new scheduled tasks array for optimistic update
      // It should include non-break tasks, locked breaks, and newly placed breaks
      const newScheduledTasks = [
        ...nonBreakTasks,
        ...currentDbTasks.filter(task => task.name.toLowerCase() === 'break' && task.is_locked), // Add back locked breaks
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

  // NEW: Toggle is_locked status for a scheduled task
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

  // NEW: Toggle is_locked status for a retired task
  const toggleRetiredTaskLockMutation = useMutation({
    mutationFn: async ({ taskId, isLocked }: { taskId: string; isLocked: boolean }) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log(`useSchedulerTasks: Attempting to toggle lock for retired task ID: ${taskId} to ${isLocked}`);
      const { data, error } = await supabase
        .from('retired_tasks')
        .update({ is_locked: isLocked, retired_at: new Date().toISOString() }) // Update retired_at to reflect change
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

  // NEW: Aether Dump mutation (for current day only)
  const aetherDumpMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("User not authenticated.");

      // 1. Fetch all scheduled tasks for the current day
      const { data: currentScheduledTasks, error: fetchError } = await supabase
        .from('scheduled_tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('scheduled_date', formattedSelectedDate);

      if (fetchError) throw new Error(`Failed to fetch scheduled tasks for Aether Dump: ${fetchError.message}`);

      // 2. Filter for flexible and unlocked tasks
      const tasksToDump = currentScheduledTasks.filter(task => task.is_flexible && !task.is_locked);

      if (tasksToDump.length === 0) {
        showSuccess("No flexible, unlocked tasks to dump to Aether Sink for today.");
        return; // No tasks to dump
      }

      // 3. Prepare tasks for insertion into retired_tasks
      const newRetiredTasks: NewRetiredTask[] = tasksToDump.map(task => ({
        user_id: userId,
        name: task.name,
        duration: (task.start_time && task.end_time) 
                  ? Math.floor((parseISO(task.end_time).getTime() - parseISO(task.start_time).getTime()) / (1000 * 60)) 
                  : null, // Set duration to null if start/end times are missing
        break_duration: task.break_duration,
        original_scheduled_date: task.scheduled_date,
        is_critical: task.is_critical,
        is_locked: task.is_locked,
        energy_cost: task.energy_cost ?? 0, // NEW: Ensure energy_cost is always a number
      }));

      // 4. Insert into retired_tasks
      const { error: insertError } = await supabase.from('retired_tasks').insert(newRetiredTasks);
      if (insertError) throw new Error(`Failed to move tasks to Aether Sink: ${insertError.message}`);

      // 5. Delete from scheduled_tasks
      const { error: deleteError } = await supabase
        .from('scheduled_tasks')
        .delete()
        .in('id', tasksToDump.map(task => task.id))
        .eq('user_id', userId); // Ensure RLS is respected
      if (deleteError) throw new Error(`Failed to remove tasks from schedule: ${deleteError.message}`);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      await queryClient.cancelQueries({ queryKey: ['retiredTasks', userId] });

      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);
      const previousRetiredTasks = queryClient.getQueryData<RetiredTask[]>(['retiredTasks', userId]);

      // Optimistically update scheduledTasks: remove flexible, unlocked tasks
      const tasksToDump = (previousScheduledTasks || []).filter(task => task.is_flexible && !task.is_locked);
      const remainingScheduledTasks = (previousScheduledTasks || []).filter(task => !task.is_flexible || task.is_locked);
      
      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], remainingScheduledTasks);

      // Optimistically update retiredTasks: add the dumped tasks
      const now = new Date().toISOString();
      const optimisticRetiredTasks: RetiredTask[] = tasksToDump.map(task => ({
        id: task.id,
        user_id: userId!,
        name: task.name,
        duration: (task.start_time && task.end_time) 
                  ? Math.floor((parseISO(task.end_time).getTime() - parseISO(task.start_time).getTime()) / (1000 * 60)) 
                  : null, // Set duration to null if start/end times are missing
        break_duration: task.break_duration,
        original_scheduled_date: task.scheduled_date,
        retired_at: now,
        is_critical: task.is_critical,
        is_locked: task.is_locked,
        energy_cost: task.energy_cost ?? 0, // NEW: Ensure energy_cost is always a number
      }));
      queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId], (old) =>
        [...optimisticRetiredTasks, ...(old || [])]
      );

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

  // NEW: Aether Dump Mega mutation (for all days)
  const aetherDumpMegaMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("User not authenticated.");

      // 1. Fetch ALL flexible and unlocked scheduled tasks for the current user
      const { data: allFlexibleScheduledTasks, error: fetchError } = await supabase
        .from('scheduled_tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('is_flexible', true)
        .eq('is_locked', false)
        .gte('scheduled_date', format(startOfDay(new Date()), 'yyyy-MM-dd')); // NEW: Filter for today and future dates

      if (fetchError) throw new Error(`Failed to fetch all flexible scheduled tasks for Aether Dump Mega: ${fetchError.message}`);

      if (allFlexibleScheduledTasks.length === 0) {
        showSuccess("No flexible, unlocked tasks to dump to Aether Sink from today or future days.");
        return; // No tasks to dump
      }

      // 2. Prepare tasks for insertion into retired_tasks
      const newRetiredTasks: NewRetiredTask[] = allFlexibleScheduledTasks.map(task => ({
        user_id: userId,
        name: task.name,
        duration: (task.start_time && task.end_time) 
                  ? Math.floor((parseISO(task.end_time).getTime() - parseISO(task.start_time).getTime()) / (1000 * 60)) 
                  : null, // Set duration to null if start/end times are missing
        break_duration: task.break_duration,
        original_scheduled_date: task.scheduled_date, // Keep original scheduled date
        is_critical: task.is_critical,
        is_locked: task.is_locked,
        energy_cost: task.energy_cost ?? 0, // NEW: Ensure energy_cost is always a number
      }));

      // 3. Insert into retired_tasks
      const { error: insertError } = await supabase.from('retired_tasks').insert(newRetiredTasks);
      if (insertError) throw new Error(`Failed to move tasks to Aether Sink (Mega): ${insertError.message}`);

      // 4. Delete from scheduled_tasks
      const { error: deleteError } = await supabase
        .from('scheduled_tasks')
        .delete()
        .in('id', allFlexibleScheduledTasks.map(task => task.id))
        .eq('user_id', userId); // Ensure RLS is respected
      if (deleteError) throw new Error(`Failed to remove tasks from schedule (Mega): ${deleteError.message}`);
    },
    onMutate: async () => {
      // Optimistic update for Aether Dump Mega is complex due to affecting all dates.
      // For simplicity and safety, we will invalidate all relevant queries.
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId] }); // Cancel all scheduled tasks queries
      await queryClient.cancelQueries({ queryKey: ['retiredTasks', userId] });
      await queryClient.cancelQueries({ queryKey: ['datesWithTasks', userId] });

      // No direct optimistic update of scheduledTasks cache across all dates.
      // Instead, we'll rely on refetching after success.
      // We can optimistically add to retiredTasks.
      const previousRetiredTasks = queryClient.getQueryData<RetiredTask[]>(['retiredTasks', userId]);

      // Fetch current flexible tasks to optimistically add to retired sink
      // Filter for today and future dates in the optimistic update as well
      const currentScheduledTasksSnapshot = queryClient.getQueriesData<DBScheduledTask[]>({ queryKey: ['scheduledTasks', userId] })
        .flatMap(([_key, data]) => data || [])
        .filter(task => task.is_flexible && !task.is_locked && isAfter(parseISO(task.scheduled_date), subDays(startOfDay(new Date()), 1))); // Filter for today and future

      const now = new Date().toISOString();
      const optimisticRetiredTasks: RetiredTask[] = currentScheduledTasksSnapshot.map(task => ({
        id: task.id,
        user_id: userId!,
        name: task.name,
        duration: (task.start_time && task.end_time) 
                  ? Math.floor((parseISO(task.end_time).getTime() - parseISO(task.start_time).getTime()) / (1000 * 60)) 
                  : null, // Set duration to null if start/end times are missing
        break_duration: task.break_duration,
        original_scheduled_date: task.scheduled_date,
        retired_at: now,
        is_critical: task.is_critical,
        is_locked: task.is_locked,
        energy_cost: task.energy_cost ?? 0, // NEW: Ensure energy_cost is always a number
      }));
      queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId], (old) =>
        [...optimisticRetiredTasks, ...(old || [])]
      );

      return { previousRetiredTasks };
    },
    onSuccess: () => {
      // Invalidate all scheduledTasks queries to ensure all dates are refetched
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
      // Note: Rolling back scheduledTasks across all dates is complex,
      // relying on refetch on error for consistency.
    }
  });


  // NEW: Auto-Balance Schedule Mutation (Stage 2)
  const autoBalanceScheduleMutation = useMutation({
    mutationFn: async (payload: AutoBalancePayload) => {
      if (!userId) throw new Error("User not authenticated.");
      const { scheduledTaskIdsToDelete, retiredTaskIdsToDelete, tasksToInsert, tasksToKeepInSink, selectedDate } = payload;

      // 1. Delete old flexible tasks from scheduled_tasks
      if (scheduledTaskIdsToDelete.length > 0) {
        const { error: deleteScheduledError } = await supabase
          .from('scheduled_tasks')
          .delete()
          .in('id', scheduledTaskIdsToDelete)
          .eq('user_id', userId)
          .eq('scheduled_date', selectedDate);
        if (deleteScheduledError) throw new Error(`Failed to clear old schedule tasks: ${deleteScheduledError.message}`);
      }

      // 2. Delete old retired tasks from retired_tasks
      if (retiredTaskIdsToDelete.length > 0) {
        const { error: deleteRetiredError } = await supabase
          .from('retired_tasks')
          .delete()
          .in('id', retiredTaskIdsToDelete)
          .eq('user_id', userId);
        if (deleteRetiredError) throw new Error(`Failed to clear old retired tasks: ${deleteRetiredError.message}`);
      }

      // 3. Insert newly timed tasks into scheduled_tasks
      if (tasksToInsert.length > 0) {
        const tasksToInsertWithUserId = tasksToInsert.map(task => ({ ...task, user_id: userId, energy_cost: task.energy_cost ?? 0 })); // Ensure energy_cost is always a number
        const { error: insertScheduledError } = await supabase
          .from('scheduled_tasks')
          .insert(tasksToInsertWithUserId);
        if (insertScheduledError) throw new Error(`Failed to insert new scheduled tasks: ${insertScheduledError.message}`);
      }

      // 4. Re-insert failed tasks back into retired_tasks
      if (tasksToKeepInSink.length > 0) {
        const tasksToKeepInSinkWithUserId = tasksToKeepInSink.map(task => ({ 
          ...task, 
          user_id: userId, 
          retired_at: new Date().toISOString(),
          energy_cost: task.energy_cost ?? 0 // Ensure energy_cost is always a number
        }));
        const { error: reinsertRetiredError } = await supabase
          .from('retired_tasks')
          .insert(tasksToKeepInSinkWithUserId);
        if (reinsertRetiredError) throw new Error(`Failed to re-insert unscheduled tasks into sink: ${reinsertRetiredError.message}`);
      }
      
      return { tasksPlaced: tasksToInsert.length, tasksKeptInSink: tasksToKeepInSink.length };
    },
    onMutate: async (payload: AutoBalancePayload) => {
      // Optimistic update is too complex for this atomic operation, rely on refetch
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, payload.selectedDate, sortBy] });
      await queryClient.cancelQueries({ queryKey: ['retiredTasks', userId] });
      await queryClient.cancelQueries({ queryKey: ['datesWithTasks', userId] });
      
      // Snapshot previous state for rollback
      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, payload.selectedDate, sortBy]);
      const previousRetiredTasks = queryClient.getQueryData<RetiredTask[]>(['retiredTasks', userId]);

      // Optimistically clear the flexible tasks from the schedule and all deleted tasks from the sink
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
      // Rollback to previous state on error
      if (context?.previousScheduledTasks) {
        queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, payload.selectedDate, sortBy], context.previousScheduledTasks);
      }
      if (context?.previousRetiredTasks) {
        queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId], context.previousRetiredTasks);
      }
    }
  });


  return {
    dbScheduledTasks, // The raw data from Supabase
    rawTasks, // Converted to RawTaskInput for scheduler logic
    isLoading,
    datesWithTasks, // New: Dates that have scheduled tasks
    isLoadingDatesWithTasks, // NEW: Loading state for dates with tasks
    retiredTasks, // NEW: Retired tasks
    isLoadingRetiredTasks, // NEW: Loading state for retired tasks
    addScheduledTask: addScheduledTaskMutation.mutate,
    addRetiredTask: addRetiredTaskMutation.mutate, // NEW: Add retired task mutation
    removeScheduledTask: removeScheduledTaskMutation.mutate,
    clearScheduledTasks: clearScheduledTasksMutation.mutate,
    retireTask: retireTaskMutation.mutate, // NEW: Retire task mutation
    rezoneTask: rezoneTaskMutation.mutateAsync, // NEW: Rezone task mutation (use mutateAsync for chaining)
    compactScheduledTasks: compactScheduledTasksMutation.mutate, // NEW: Compact schedule mutation
    randomizeBreaks: randomizeBreaksMutation.mutate, // NEW: Randomize breaks mutation
    toggleScheduledTaskLock: toggleScheduledTaskLockMutation.mutate, // NEW: Toggle scheduled task lock
    toggleRetiredTaskLock: toggleRetiredTaskLockMutation.mutate, // NEW: Toggle retired task lock
    aetherDump: aetherDumpMutation.mutate, // NEW: Expose Aether Dump mutation
    aetherDumpMega: aetherDumpMegaMutation.mutate, // NEW: Expose Aether Dump Mega mutation
    autoBalanceSchedule: autoBalanceScheduleMutation.mutate, // NEW: Expose Auto Balance Schedule mutation
    sortBy, // Expose sortBy state
    setSortBy, // Expose setSortBy function
  };
};