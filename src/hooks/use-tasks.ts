import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Task, NewTask, TaskPriority, TaskStatusFilter, TemporalFilter, SortBy } from '@/types';
import { useSession } from './use-session';
import { showSuccess, showError } from '@/utils/toast';
import { startOfDay, subDays, formatISO, parseISO, isToday, isYesterday, format } from 'date-fns';
import { XP_PER_LEVEL, MAX_ENERGY, DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION } from '@/lib/constants';
import { calculateEnergyCost } from '@/lib/scheduler-utils';
import { AetherSinkTask } from '@/types/scheduler'; // Import AetherSinkTask

const getDateRange = (filter: TemporalFilter): { start: string, end: string } | null => {
  const now = new Date();
  const startOfToday = startOfDay(now);
  
  let startDate: Date;
  let endDate: Date;

  switch (filter) {
    case 'TODAY':
      startDate = startOfToday;
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
  // For AetherSink tasks, priority is derived from is_critical
  // We'll map is_critical to a pseudo-priority for sorting
  const getPseudoPriority = (task: Task) => task.is_critical ? 'HIGH' : 'MEDIUM';
  const priorityOrder: Record<TaskPriority, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

  return [...tasks].sort((a, b) => {
    if (sortBy === 'PRIORITY_HIGH_TO_LOW') {
      const priorityDiff = priorityOrder[getPseudoPriority(b)] - priorityOrder[getPseudoPriority(a)];
      if (priorityDiff !== 0) return priorityDiff;
    } else if (sortBy === 'PRIORITY_LOW_TO_HIGH') {
      const priorityDiff = priorityOrder[getPseudoPriority(a)] - priorityOrder[getPseudoPriority(b)];
      if (priorityDiff !== 0) return priorityDiff;
    }
    // Fallback to retired_at (creation time) for consistent ordering
    const dateA = parseISO(a.retired_at).getTime();
    const dateB = parseISO(b.retired_at).getTime();
    return dateB - dateA; // Newest first by default
  });
};

export const useTasks = () => {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const userId = user?.id;

  const [temporalFilter, setTemporalFilter] = useState<TemporalFilter>('TODAY');
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('ACTIVE');
  const [sortBy, setSortBy] = useState<SortBy>('PRIORITY_HIGH_TO_LOW');

  const fetchTasks = useCallback(async (currentTemporalFilter: TemporalFilter, currentSortBy: SortBy): Promise<Task[]> => {
    if (!userId) return [];
    
    let query = supabase
      .from('AetherSink') // Querying AetherSink for general tasks
      .select('*')
      .eq('user_id', userId);

    const dateRange = getDateRange(currentTemporalFilter);

    if (dateRange) {
      query = query
        .lte('original_scheduled_date', dateRange.end)
        .gte('original_scheduled_date', dateRange.start);
    }
    
    // AetherSink doesn't have 'due_date', using 'original_scheduled_date'
    if (currentSortBy === 'TIME_EARLIEST_TO_LATEST') {
      query = query.order('original_scheduled_date', { ascending: true });
    } else if (currentSortBy === 'TIME_LATEST_TO_EARLIEST') {
      query = query.order('original_scheduled_date', { ascending: false });
    } else {
      query = query.order('retired_at', { ascending: false }); // Default sort by creation/retired time
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);
    return data as Task[];
  }, [userId]);

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ['tasks', userId, temporalFilter, sortBy],
    queryFn: () => fetchTasks(temporalFilter, sortBy),
    enabled: !!userId,
  });

  const filteredTasks = useMemo(() => {
    let result = tasks;

    if (statusFilter === 'ACTIVE') {
      result = result.filter(task => !task.is_completed);
    } else if (statusFilter === 'COMPLETED') {
      result = result.filter(task => task.is_completed);
    }

    if (sortBy.startsWith('PRIORITY')) {
      return sortTasks(result, sortBy);
    }
    
    return result;
  }, [tasks, statusFilter, sortBy]);

  const addTaskMutation = useMutation({
    mutationFn: async (newTask: NewTask) => {
      if (!userId) throw new Error("User not authenticated.");
      
      const energyCost = newTask.energy_cost ?? calculateEnergyCost(newTask.duration || DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION, newTask.is_critical ?? false);

      const taskToInsert: NewTask = { 
        ...newTask, 
        user_id: userId, 
        energy_cost: energyCost,
        is_custom_energy_cost: newTask.is_custom_energy_cost ?? false,
        original_scheduled_date: newTask.original_scheduled_date ?? format(new Date(), 'yyyy-MM-dd'), // Default to today
        retired_at: new Date().toISOString(), // Set retired_at as creation time for AetherSink
        is_locked: newTask.is_locked ?? false,
        is_completed: newTask.is_completed ?? false,
      };
      const { data, error } = await supabase.from('AetherSink').insert(taskToInsert).select().single();
      if (error) throw new Error(error.message);
      return data as Task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      showSuccess('Task added to Aether Sink!');
    },
    onError: (e) => {
      showError(`Failed to add task: ${e.message}`);
    }
  });

  const updateTaskMutation = useMutation({
    mutationFn: async (task: Partial<Task> & { id: string }) => {
      // Recalculate energy_cost if not custom and critical status or duration changes
      let updatedEnergyCost = task.energy_cost;

      if (task.is_custom_energy_cost === false && (task.is_critical !== undefined || task.duration !== undefined || task.energy_cost === undefined)) {
        const currentTask = queryClient.getQueryData<Task[]>(['tasks', userId, temporalFilter, sortBy])?.find(t => t.id === task.id);
        const effectiveIsCritical = task.is_critical !== undefined ? task.is_critical : (currentTask?.is_critical ?? false);
        const effectiveDuration = task.duration !== undefined ? task.duration : (currentTask?.duration ?? DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION);
        
        updatedEnergyCost = calculateEnergyCost(effectiveDuration || DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION, effectiveIsCritical);
      } else if (task.is_custom_energy_cost === true && task.energy_cost !== undefined) {
        updatedEnergyCost = task.energy_cost;
      }

      const { data, error } = await supabase
        .from('AetherSink')
        .update({ 
          ...task, 
          energy_cost: updatedEnergyCost,
          retired_at: new Date().toISOString(), // Update retired_at to reflect modification
        })
        .eq('id', task.id)
        .select()
        .single();
      
      if (error) throw new Error(error.message);
      return data as Task;
    },
    onSuccess: async (updatedTask) => {
      await queryClient.invalidateQueries({ queryKey: ['tasks', userId] });

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
      const { error } = await supabase.from('AetherSink').delete().eq('id', id);
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
    addTaskMutation,
    updateTaskMutation,
    deleteTaskMutation,
  };
};