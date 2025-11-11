import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Task, NewTask, TaskPriority, TaskStatusFilter, TemporalFilter, SortBy } from '@/types';
import { DBScheduledTask, NewDBScheduledTask, RawTaskInput, RetiredTask, NewRetiredTask } from '@/types/scheduler'; // Import scheduler types, including RawTaskInput and new retired task types
import { useSession } from './use-session';
import { showSuccess, showError } from '@/utils/toast';
import { startOfDay, subDays, formatISO, compareDesc, parseISO, isToday, isYesterday, format } from 'date-fns'; // Import format
import { XP_PER_LEVEL, MAX_ENERGY } from '@/lib/constants'; // Import constants

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
    if (sortBy === 'PRIORITY') {
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
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
  const [sortBy, setSortBy] = useState<SortBy>('PRIORITY');
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
    if (currentSortBy === 'DUE_DATE') {
      // Sort by due date ascending (earliest first)
      query = query.order('due_date', { ascending: true });
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
    if (sortBy === 'PRIORITY') {
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
            await refreshProfile(); // Refresh profile data in session context
            
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

  // Fetch all scheduled tasks for the current user and selected date
  const { data: dbScheduledTasks = [], isLoading } = useQuery<DBScheduledTask[]>({
    queryKey: ['scheduledTasks', userId, formattedSelectedDate], // Include selectedDate in query key
    queryFn: async () => {
      if (!userId) {
        console.log("useSchedulerTasks: No user ID, returning empty array.");
        return [];
      }
      console.log("useSchedulerTasks: Fetching scheduled tasks for user:", userId, "on date:", formattedSelectedDate);
      const { data, error } = await supabase
        .from('scheduled_tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('scheduled_date', formattedSelectedDate) // Filter by scheduled_date
        .order('created_at', { ascending: true }); // Order by creation to maintain queue order

      if (error) {
        console.error("useSchedulerTasks: Error fetching scheduled tasks:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully fetched tasks:", data.map(t => ({ id: t.id, name: t.name, scheduled_date: t.scheduled_date, start_time: t.start_time, end_time: t.end_time, is_critical: t.is_critical, is_flexible: t.is_flexible }))); // Detailed log
      return data as DBScheduledTask[];
    },
    enabled: !!userId,
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
      console.log("useSchedulerTasks: Successfully fetched retired tasks:", data.map(t => ({ id: t.id, name: t.name, is_critical: t.is_critical })));
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
  }));

  // Add a new scheduled task
  const addScheduledTaskMutation = useMutation({
    mutationFn: async (newTask: NewDBScheduledTask) => {
      if (!userId) throw new Error("User not authenticated.");
      // The `newTask` already conforms to `NewDBScheduledTask` which doesn't have `duration`.
      // So, we can directly spread `newTask` and add `user_id`.
      const taskToInsert = { ...newTask, user_id: userId }; 
      console.log("useSchedulerTasks: Attempting to insert new task:", taskToInsert);
      const { data, error } = await supabase.from('scheduled_tasks').insert(taskToInsert).select().single();
      if (error) {
        console.error("useSchedulerTasks: Error inserting task:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully inserted task:", data);
      return data as DBScheduledTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate] }); // Invalidate for current date
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] }); // Invalidate for dates with tasks
      showSuccess('Task added to schedule!');
    },
    onError: (e) => {
      showError(`Failed to add task to schedule: ${e.message}`);
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate] }); // Invalidate for current date
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] }); // Invalidate for dates with tasks
      showSuccess('Task removed from schedule.');
    },
    onError: (e) => {
      showError(`Failed to remove task from schedule: ${e.message}`);
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate] }); // Invalidate for current date
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] }); // Invalidate for dates with tasks
      showSuccess('Schedule cleared for today!');
    },
    onError: (e) => {
      showError(`Failed to clear schedule: ${e.message}`);
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
        duration: Math.floor((parseISO(taskToRetire.end_time!).getTime() - parseISO(taskToRetire.start_time!).getTime()) / (1000 * 60)), // Derive duration for retired task
        break_duration: taskToRetire.break_duration,
        original_scheduled_date: taskToRetire.scheduled_date,
        is_critical: taskToRetire.is_critical, // Pass critical flag
      };
      const { error: insertError } = await supabase.from('retired_tasks').insert(newRetiredTask);
      if (insertError) throw new Error(`Failed to move task to Aether Sink: ${insertError.message}`);

      // 2. Delete from scheduled_tasks
      const { error: deleteError } = await supabase.from('scheduled_tasks').delete().eq('id', taskToRetire.id).eq('user_id', userId);
      if (deleteError) throw new Error(`Failed to remove task from schedule: ${deleteError.message}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
      showSuccess('Task moved to Aether Sink.');
    },
    onError: (e) => {
      showError(`Failed to retire task: ${e.message}`);
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId] });
      showSuccess('Task removed from Aether Sink.'); // This toast is for the deletion from sink
    },
    onError: (e) => {
      showError(`Failed to remove task from Aether Sink: ${e.message}`); // More specific error message
    }
  });

  // NEW: Compact scheduled tasks
  const compactScheduledTasksMutation = useMutation({
    mutationFn: async (tasksToUpdate: DBScheduledTask[]) => {
      if (!userId) throw new Error("User not authenticated.");

      // Perform a batch update for all tasks that need new times
      const updates = tasksToUpdate.map(task => ({
        id: task.id,
        user_id: userId, // Explicitly include user_id to satisfy RLS
        start_time: task.start_time,
        end_time: task.end_time,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate] });
      showSuccess('Schedule compacted!');
    },
    onError: (e) => {
      showError(`Failed to compact schedule: ${e.message}`);
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
    removeScheduledTask: removeScheduledTaskMutation.mutate,
    clearScheduledTasks: clearScheduledTasksMutation.mutate,
    retireTask: retireTaskMutation.mutate, // NEW: Retire task mutation
    rezoneTask: rezoneTaskMutation.mutateAsync, // NEW: Rezone task mutation (use mutateAsync for chaining)
    compactScheduledTasks: compactScheduledTasksMutation.mutate, // NEW: Compact schedule mutation
  };
};