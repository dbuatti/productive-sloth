import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Task, NewTask, TaskPriority, TaskStatusFilter, TemporalFilter, SortBy } from '@/types';
import { useSession } from './use-session';
import { showSuccess, showError } from '@/utils/toast';
import { startOfDay, subDays, formatISO, parseISO, isToday, isYesterday } from 'date-fns';
import { XP_PER_LEVEL, MAX_ENERGY, DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION } from '@/lib/constants'; // NEW: Import default duration
import { calculateEnergyCost } from '@/lib/scheduler-utils'; // NEW: Import calculateEnergyCost
import { TaskEnvironment } from '@/types/scheduler'; // NEW: Import TaskEnvironment

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
      .from('tasks')
      .select('*')
      .eq('user_id', userId);

    const dateRange = getDateRange(currentTemporalFilter);

    if (dateRange) {
      query = query
        .lte('due_date', dateRange.end)
        .gte('due_date', dateRange.start);
    }
    
    if (currentSortBy === 'TIME_EARLIEST_TO_LATEST') {
      query = query.order('due_date', { ascending: true });
    } else if (currentSortBy === 'TIME_LATEST_TO_EARLIEST') {
      query = query.order('due_date', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
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
      
      // NEW: Ensure energy_cost and metadata_xp are set
      const energyCost = newTask.energy_cost ?? calculateEnergyCost(DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION, newTask.is_critical ?? false, newTask.is_backburner ?? false);
      const metadataXp = energyCost * 2;

      const taskToInsert = { 
        ...newTask, 
        user_id: userId, 
        energy_cost: energyCost,
        metadata_xp: metadataXp,
        is_custom_energy_cost: newTask.is_custom_energy_cost ?? false,
        is_backburner: newTask.is_backburner ?? false,
        task_environment: newTask.task_environment ?? 'laptop', // NEW: Default environment
      };
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
      // NEW: Recalculate energy_cost and metadata_xp if not custom and critical status changes
      let updatedEnergyCost = task.energy_cost;
      let updatedMetadataXp = task.metadata_xp;

      if (task.is_custom_energy_cost === false && (task.is_critical !== undefined || task.is_backburner !== undefined || task.energy_cost === undefined)) {
        // If is_custom_energy_cost is explicitly false, or energy_cost is not provided (meaning it should be calculated)
        // We need to fetch the current task to get its is_critical/is_backburner status if not provided in the update
        const currentTask = queryClient.getQueryData<Task[]>(['tasks', userId, temporalFilter, sortBy])?.find(t => t.id === task.id);
        const effectiveIsCritical = task.is_critical !== undefined ? task.is_critical : (currentTask?.is_critical ?? false);
        const effectiveIsBackburner = task.is_backburner !== undefined ? task.is_backburner : (currentTask?.is_backburner ?? false);
        
        updatedEnergyCost = calculateEnergyCost(DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION, effectiveIsCritical, effectiveIsBackburner);
        updatedMetadataXp = updatedEnergyCost * 2;
      } else if (task.is_custom_energy_cost === true && task.energy_cost !== undefined) {
        // If custom energy cost is enabled and provided, update metadata_xp based on it
        updatedMetadataXp = task.energy_cost * 2;
      } else if (task.energy_cost !== undefined) {
        // If energy_cost is provided (and custom might be true or false), update metadata_xp
        updatedMetadataXp = task.energy_cost * 2;
      }


      const { data, error } = await supabase
        .from('tasks')
        .update({ 
          ...task, 
          energy_cost: updatedEnergyCost, // NEW: Use updated energy cost
          metadata_xp: updatedMetadataXp, // NEW: Use updated metadata XP
          updated_at: new Date().toISOString(),
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
    addTaskMutation,
    updateTaskMutation,
    deleteTaskMutation,
  };
};