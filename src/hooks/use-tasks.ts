import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Task, NewTask, TaskPriority, TaskStatusFilter, TemporalFilter, SortBy } from '@/types';
import { useSession } from './use-session';
import { showSuccess, showError } from '@/utils/toast';
import { startOfDay, subDays, formatISO, parseISO, isToday, isYesterday } from 'date-fns';
import { XP_PER_LEVEL, MAX_ENERGY } from '@/lib/constants';

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

// Removed calculateLevelAndRemainingXp as gamification logic is moved

export const useTasks = () => {
  const queryClient = useQueryClient();
  const { user } = useSession(); // Removed profile, refreshProfile, triggerLevelUp
  const userId = user?.id;

  const [temporalFilter, setTemporalFilter] = useState<TemporalFilter>('TODAY');
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('ACTIVE'); // Changed default to 'ACTIVE'
  const [sortBy, setSortBy] = useState<SortBy>('PRIORITY_HIGH_TO_LOW'); // Updated default sort
  // Removed xpGainAnimation state

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
      // Removed metadata_xp and energy_cost from taskToInsert
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
      // Removed metadata_xp and energy_cost from task update
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

      // Removed all gamification logic (XP gain, streak update, energy deduction, tasks_completed_today increment, level up trigger, XP animation)
      if (updatedTask.is_completed) {
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

  // Removed clearXpGainAnimation

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
    addTask: addTaskMutation.mutate, // Expose mutate as addTask
    updateTask: updateTaskMutation.mutate, // Expose mutate as updateTask
    deleteTask: deleteTaskMutation.mutate, // Expose mutate as deleteTask
    addTaskMutation, // Expose the mutation object directly for advanced use (e.g., mutateAsync)
    updateTaskMutation, // Expose the mutation object directly for advanced use (e.g., mutateAsync)
    deleteTaskMutation, // Expose the mutation object directly for advanced use (e.g., mutateAsync)
    // Removed xpGainAnimation and clearXpGainAnimation
  };
};