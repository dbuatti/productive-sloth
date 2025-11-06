import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Task, NewTask, TaskPriority, TaskStatusFilter, TemporalFilter, SortBy } from '@/types';
import { useSession } from './use-session';
import { showSuccess, showError } from '@/utils/toast';
import { isToday, isYesterday, parseISO, compareDesc, subDays, isAfter } from 'date-fns';

// Helper function to determine if a task falls under the current temporal filter
const applyTemporalFilter = (task: Task, filter: TemporalFilter): boolean => {
  const date = parseISO(task.due_date);
  const now = new Date();
  
  switch (filter) {
    case 'TODAY':
      return isToday(date);
    case 'YESTERDAY':
      return isYesterday(date);
    case 'LAST_7_DAYS':
      // Check if the date is within the last 7 days (including today)
      const sevenDaysAgo = subDays(now, 7);
      return isAfter(date, sevenDaysAgo);
    default:
      return true;
  }
};

// Helper function to sort tasks
const sortTasks = (tasks: Task[], sortBy: SortBy): Task[] => {
  const priorityOrder: Record<TaskPriority, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

  return [...tasks].sort((a, b) => {
    if (sortBy === 'PRIORITY') {
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
    }
    // Default or secondary sort by Due Date (descending)
    return compareDesc(parseISO(a.due_date), parseISO(b.due_date));
  });
};

export const useTasks = () => {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const userId = user?.id;

  const [temporalFilter, setTemporalFilter] = useState<TemporalFilter>('TODAY');
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('ALL');
  const [sortBy, setSortBy] = useState<SortBy>('PRIORITY');

  const fetchTasks = useCallback(async (): Promise<Task[]> => {
    if (!userId) return [];
    
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId);

    if (error) throw new Error(error.message);
    return data as Task[];
  }, [userId]);

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ['tasks', userId],
    queryFn: fetchTasks,
    enabled: !!userId,
  });

  // --- Filtering and Sorting Logic ---
  const filteredTasks = useMemo(() => {
    let result = tasks.filter(task => applyTemporalFilter(task, temporalFilter));

    if (statusFilter === 'ACTIVE') {
      result = result.filter(task => !task.is_completed);
    } else if (statusFilter === 'COMPLETED') {
      result = result.filter(task => task.is_completed);
    }

    return sortTasks(result, sortBy);
  }, [tasks, temporalFilter, statusFilter, sortBy]);

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
    onSuccess: (updatedTask) => {
      queryClient.setQueryData(['tasks', userId], (oldTasks: Task[] | undefined) => {
        if (!oldTasks) return [];
        return oldTasks.map(t => t.id === updatedTask.id ? updatedTask : t);
      });
      if (updatedTask.is_completed) {
        showSuccess('Task completed!');
      } else {
        // Only show success for completion/uncompletion, not general updates
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