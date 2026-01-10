import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Task, NewTask, TaskStatusFilter, TemporalFilter, SortBy, TaskPriority } from '@/types'; // Added TaskPriority import
import { useSession } from './use-session';
import { showSuccess, showError } from '@/utils/toast';
import { startOfDay, subDays, formatISO, parseISO, isToday, isYesterday } from 'date-fns';
import { XP_PER_LEVEL, MAX_ENERGY, DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION } from '@/lib/constants';
import { calculateEnergyCost } from '@/lib/scheduler-utils';

const getDateRange = (filter: TemporalFilter): { start: string, end: string } | null => {
  const now = new Date();
  const startOfToday = startOfDay(now);
  
  let startDate: Date;
  let endDate: Date;

  switch (filter) {
    case 'TODAY':
      startDate = new Date(0); // Effectively all tasks up to end of today
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
    // Fallback to due date if priorities are the same
    if (a.due_date && b.due_date) {
      return parseISO(a.due_date).getTime() - parseISO(b.due_date).getTime();
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
    console.log(`[useTasks] Fetching tasks for user: ${userId}, temporalFilter: ${currentTemporalFilter}, sortBy: ${currentSortBy}`);
    
    let query = supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId);

    const dateRange = getDateRange(currentTemporalFilter);

    if (dateRange) {
      query = query
        .lte('due_date', dateRange.end)
        .gte('due_date', dateRange.start);
      console.log(`[useTasks] Applying date range: ${dateRange.start} to ${dateRange.end}`);
    }
    
    if (currentSortBy === 'TIME_EARLIEST_TO_LATEST') {
      query = query.order('due_date', { ascending: true });
    } else if (currentSortBy === 'TIME_LATEST_TO_EARLIEST') {
      query = query.order('due_date', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false }); // Default sort
    }

    const { data, error } = await query;

    if (error) {
      console.error("[useTasks] Error fetching tasks:", error);
      throw new Error(error.message);
    }
    console.log(`[useTasks] Fetched ${data.length} tasks.`);
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
      console.log(`[useTasks] Filtered to ${result.length} active tasks.`);
    } else if (statusFilter === 'COMPLETED') {
      result = result.filter(task => task.is_completed);
      console.log(`[useTasks] Filtered to ${result.length} completed tasks.`);
    }

    if (sortBy.startsWith('PRIORITY')) {
      const sortedResult = sortTasks(result, sortBy);
      console.log(`[useTasks] Sorted by priority. Result count: ${sortedResult.length}`);
      return sortedResult;
    }
    
    return result;
  }, [tasks, statusFilter, sortBy]);

  const addTaskMutation = useMutation({
    mutationFn: async (newTask: NewTask) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("[useTasks] Adding new task:", newTask.title);
      
      const energyCost = newTask.energy_cost ?? calculateEnergyCost(DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION, newTask.is_critical ?? false, newTask.is_backburner ?? false, newTask.is_break ?? false);
      const metadataXp = energyCost * 2;

      const taskToInsert = { 
        ...newTask, 
        user_id: userId, 
        energy_cost: energyCost,
        metadata_xp: metadataXp,
        is_custom_energy_cost: newTask.is_custom_energy_cost ?? false,
        is_backburner: newTask.is_backburner ?? false,
        is_work: newTask.is_work ?? false, // NEW: Add is_work flag
        is_break: newTask.is_break ?? false, // NEW: Add is_break flag
      };
      const { data, error } = await supabase.from('tasks').insert(taskToInsert).select().single();
      if (error) {
        console.error("[useTasks] Error adding task:", error);
        throw new Error(error.message);
      }
      console.log("[useTasks] Task added successfully:", data.title);
      return data as Task;
    },
    onSuccess: () => {
      console.log("[useTasks] Invalidate queries after addTask.");
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      showSuccess('Task added successfully!');
    },
    onError: (e) => {
      showError(`Failed to add task: ${e.message}`);
    }
  });

  const updateTaskMutation = useMutation({
    mutationFn: async (task: Partial<Task> & { id: string }) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("[useTasks] Updating task:", task.id, task.title);
      
      // NEW: Recalculate energy_cost and metadata_xp if not custom and critical status changes
      let updatedEnergyCost = task.energy_cost;
      let updatedMetadataXp = task.metadata_xp;

      if (task.is_custom_energy_cost === false && (task.is_critical !== undefined || task.is_backburner !== undefined || task.is_break !== undefined || task.energy_cost === undefined)) {
        // If is_custom_energy_cost is explicitly false, or energy_cost is not provided (meaning it should be calculated)
        // We need to fetch the current task to get its is_critical/is_backburner status if not provided in the update
        const currentTask = queryClient.getQueryData<Task[]>(['tasks', userId, temporalFilter, sortBy])?.find(t => t.id === task.id);
        const effectiveIsCritical = task.is_critical !== undefined ? task.is_critical : (currentTask?.is_critical ?? false);
        const effectiveIsBackburner = task.is_backburner !== undefined ? task.is_backburner : (currentTask?.is_backburner ?? false);
        const effectiveIsBreak = task.is_break !== undefined ? task.is_break : (currentTask?.is_break ?? false);
        
        updatedEnergyCost = calculateEnergyCost(DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION, effectiveIsCritical, effectiveIsBackburner, effectiveIsBreak);
        updatedMetadataXp = updatedEnergyCost * 2;
        console.log(`[useTasks] Recalculated energy_cost: ${updatedEnergyCost}, metadata_xp: ${updatedMetadataXp}`);
      } else if (task.is_custom_energy_cost === true && task.energy_cost !== undefined) {
        // If custom energy cost is enabled and provided, update metadata_xp based on it
        updatedMetadataXp = task.energy_cost * 2;
        console.log(`[useTasks] Custom energy_cost: ${task.energy_cost}, updated metadata_xp: ${updatedMetadataXp}`);
      } else if (task.energy_cost !== undefined) {
        // If energy_cost is provided (and custom might be true or false), update metadata_xp
        updatedMetadataXp = task.energy_cost * 2;
        console.log(`[useTasks] Energy_cost provided: ${task.energy_cost}, updated metadata_xp: ${updatedMetadataXp}`);
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
      
      if (error) {
        console.error("[useTasks] Error updating task:", error);
        throw new Error(error.message);
      }
      console.log("[useTasks] Task updated successfully:", data.title);
      return data as Task;
    },
    onSuccess: async (updatedTask) => {
      console.log("[useTasks] Invalidate queries after updateTask.");
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
      if (!userId) throw new Error("User not authenticated.");
      console.log("[useTasks] Deleting task:", id);
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) {
        console.error("[useTasks] Error deleting task:", error);
        throw new Error(error.message);
      }
      console.log("[useTasks] Task deleted successfully:", id);
    },
    onSuccess: () => {
      console.log("[useTasks] Invalidate queries after deleteTask.");
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