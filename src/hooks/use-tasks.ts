import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Task, NewTask, TaskPriority, TaskStatusFilter, TemporalFilter, SortBy } from '@/types';
import { useSession } from './use-session';
import { showSuccess, showError } from '@/utils/toast';
import { startOfDay, subDays, formatISO, compareDesc, parseISO, isToday, isYesterday } from 'date-fns';

// Helper function to calculate date boundaries for server-side filtering
const getDateRange = (filter: TemporalFilter): { start: string, end: string } | null => {
  const now = new Date();
  const startOfToday = startOfDay(now);
  
  let startDate: Date;
  let endDate: Date;

  switch (filter) {
    case 'TODAY':
      startDate = startOfToday;
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

// XP and Leveling Constants
const XP_PER_LEVEL = 100; // XP needed to gain one level
const MAX_ENERGY = 100; // Max energy for the user

const calculateLevelAndRemainingXp = (totalXp: number) => {
  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
  const xpForCurrentLevel = (level - 1) * XP_PER_LEVEL;
  const xpTowardsNextLevel = totalXp - xpForCurrentLevel;
  const xpRemainingForNextLevel = XP_PER_LEVEL - xpTowardsNextLevel;
  return { level, xpTowardsNextLevel, xpRemainingForNextLevel };
};

export const useTasks = () => {
  const queryClient = useQueryClient();
  const { user, profile, refreshProfile } = useSession(); // Get profile and refreshProfile
  const userId = user?.id;

  const [temporalFilter, setTemporalFilter] = useState<TemporalFilter>('TODAY');
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('ALL');
  const [sortBy, setSortBy] = useState<SortBy>('PRIORITY');

  const fetchTasks = useCallback(async (currentTemporalFilter: TemporalFilter, currentSortBy: SortBy): Promise<Task[]> => {
    if (!userId) return [];
    
    let query = supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId);

    const dateRange = getDateRange(currentTemporalFilter);

    if (dateRange) {
      query = query
        .gte('due_date', dateRange.start)
        .lte('due_date', dateRange.end);
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
      queryClient.setQueryData(['tasks', userId], (oldTasks: Task[] | undefined) => {
        if (!oldTasks) return [];
        return oldTasks.map(t => t.id === updatedTask.id ? updatedTask : t);
      });

      // Handle XP gain, Streak update, and Energy deduction on task completion
      if (updatedTask.is_completed && profile && user) {
        const taskBeforeUpdate = tasks.find(t => t.id === updatedTask.id);
        // Only process if the task was NOT completed before this update
        if (taskBeforeUpdate && !taskBeforeUpdate.is_completed) {
          // Energy Check
          if (profile.energy < updatedTask.energy_cost) {
            showError(`Not enough energy to complete "${updatedTask.title}". You need ${updatedTask.energy_cost} energy, but have ${profile.energy}.`);
            // Revert task completion in UI if energy is insufficient
            queryClient.setQueryData(['tasks', userId], (oldTasks: Task[] | undefined) => {
              if (!oldTasks) return [];
              return oldTasks.map(t => t.id === updatedTask.id ? { ...updatedTask, is_completed: false } : t);
            });
            return; // Stop further processing
          }

          const newXp = profile.xp + updatedTask.metadata_xp;
          const { level: newLevel } = calculateLevelAndRemainingXp(newXp);
          const newEnergy = Math.max(0, profile.energy - updatedTask.energy_cost); // Deduct energy, ensure not negative

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
              updated_at: new Date().toISOString() 
            })
            .eq('id', user.id);

          if (profileError) {
            console.error("Failed to update user profile (XP, streak, energy):", profileError.message);
            showError("Failed to update profile stats.");
          } else {
            await refreshProfile(); // Refresh profile data in session context
            showSuccess(`Task completed! +${updatedTask.metadata_xp} XP, -${updatedTask.energy_cost} Energy`);
            if (newLevel > profile.level) {
              showSuccess(`🎉 Level Up! You reached Level ${newLevel}!`);
            }
          }
        } else if (!updatedTask.is_completed && profile && user) {
          // If task is uncompleted, just refresh profile to ensure consistency if other updates happened.
          // No XP/energy deduction or streak change for uncompletion for now.
          await refreshProfile();
        }
      } else if (!updatedTask.is_completed) {
        // If task is uncompleted, just refresh profile to ensure consistency if other updates happened.
        await refreshProfile();
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
  };
};