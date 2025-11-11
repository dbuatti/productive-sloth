import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Task, NewTask, TaskPriority, TaskStatusFilter, TemporalFilter, SortBy } from '@/types';
import { useSession } from './use-session';
import { showSuccess, showError } from '@/utils/toast';
import { startOfDay, subDays, formatISO, compareDesc, parseISO, isToday, isYesterday } from 'date-fns';
import { XP_PER_LEVEL, MAX_ENERGY } from '@/lib/constants';

// Helper function to calculate date boundaries for server-side filtering
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

// Helper function for client-side sorting (only used for PRIORITY sorting)
const sortTasks = (tasks: Task[], sortBy: SortBy): Task[] => {
  const priorityOrder: Record<TaskPriority, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

  return [...tasks].sort((a, b) => {
    if (sortBy === 'PRIORITY') {
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
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

export const useTasks = () => {
  const queryClient = useQueryClient();
  const { user, profile, refreshProfile, triggerLevelUp } = useSession();
  const userId = user?.id;

  const [temporalFilter, setTemporalFilter] = useState<TemporalFilter>('TODAY');
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('ACTIVE');
  const [sortBy, setSortBy] = useState<SortBy>('PRIORITY');
  const [xpGainAnimation, setXpGainAnimation] = useState<{ taskId: string, xpAmount: number } | null>(null);

  const fetchTasks = useCallback(async (currentTemporalFilter: TemporalFilter, currentStatusFilter: TaskStatusFilter, currentSortBy: SortBy): Promise<Task[]> => {
    if (!userId) return [];
    
    let query = supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId);

    // Apply status filter server-side
    if (currentStatusFilter === 'ACTIVE') {
      query = query.eq('is_completed', false);
    } else if (currentStatusFilter === 'COMPLETED') {
      query = query.eq('is_completed', true);
    }

    const dateRange = getDateRange(currentTemporalFilter);

    if (dateRange) {
      query = query
        .lte('due_date', dateRange.end)
        .gte('due_date', dateRange.start);
    }
    
    // Server-side sorting for DUE_DATE and PRIORITY
    if (currentSortBy === 'DUE_DATE') {
      query = query.order('due_date', { ascending: true });
    } else if (currentSortBy === 'PRIORITY') {
      // Assuming 'HIGH' > 'MEDIUM' > 'LOW' for descending priority
      query = query.order('priority', { ascending: false });
    } else {
      // Default stable sort
      query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);
    return data as Task[];
  }, [userId]);

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ['tasks', userId, temporalFilter, statusFilter, sortBy], // Include statusFilter in query key
    queryFn: () => fetchTasks(temporalFilter, statusFilter, sortBy), // Pass statusFilter to fetchTasks
    enabled: !!userId,
  });

  // --- Filtering and Sorting Logic (Only PRIORITY sorting remains client-side) ---
  const filteredTasks = useMemo(() => {
    // Since statusFilter and PRIORITY sortBy are now handled server-side,
    // `tasks` already contains the filtered and sorted data.
    return tasks;
  }, [tasks]);

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
      await queryClient.invalidateQueries({ queryKey: ['tasks', userId] });

      if (updatedTask.is_completed && profile && user) {
        const taskBeforeUpdate = tasks.find(t => t.id === updatedTask.id);
        if (taskBeforeUpdate && !taskBeforeUpdate.is_completed) {
          if (profile.energy < updatedTask.energy_cost) {
            showError(`Not enough energy to complete "${updatedTask.title}". You need ${updatedTask.energy_cost} energy, but have ${profile.energy}.`);
            return;
          }

          let xpGained = updatedTask.metadata_xp;
          if (updatedTask.is_critical && isToday(parseISO(updatedTask.due_date))) {
            xpGained += 5;
            showSuccess(`Critical task bonus! +5 XP`);
          }

          const newXp = profile.xp + xpGained;
          const { level: newLevel } = calculateLevelAndRemainingXp(newXp);
          const newEnergy = Math.max(0, profile.energy - updatedTask.energy_cost);
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
          } else {
            await refreshProfile();
            
            setXpGainAnimation({ taskId: updatedTask.id, xpAmount: xpGained });

            showSuccess(`Task completed! -${updatedTask.energy_cost} Energy`);
            if (newLevel > profile.level) {
              showSuccess(`🎉 Level Up! You reached Level ${newLevel}!`);
              triggerLevelUp(newLevel);
            }
          }
        } else if (!updatedTask.is_completed && profile && user) {
          await refreshProfile();
        }
      } else if (updatedTask.is_completed) {
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
    xpGainAnimation,
    clearXpGainAnimation,
  };
};