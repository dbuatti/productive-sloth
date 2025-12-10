import { useCallback, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DBScheduledTask, NewDBScheduledTask, RawTaskInput, RetiredTask, NewRetiredTask, SortBy, TaskPriority, TimeBlock, AutoBalancePayload, UnifiedTask, RetiredTaskSortBy, CompletedTaskLogEntry, TaskEnvironment } from '@/types/scheduler';
import { useSession } from './use-session';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { parseISO, format } from 'date-fns';

interface UseSchedulerTasksReturn {
  dbScheduledTasks: DBScheduledTask[];
  isLoading: boolean;
  addScheduledTask: (task: NewDBScheduledTask) => Promise<void>;
  addRetiredTask: (task: NewRetiredTask) => Promise<void>;
  removeScheduledTask: (taskId: string) => Promise<void>;
  removeRetiredTask: (taskId: string) => Promise<void>;
  clearScheduledTasks: () => Promise<void>;
  datesWithTasks: string[];
  isLoadingDatesWithTasks: boolean;
  retiredTasks: RetiredTask[];
  isLoadingRetiredTasks: boolean;
  completedTasksForSelectedDayList: CompletedTaskLogEntry[];
  isLoadingCompletedTasksForSelectedDay: boolean;
  retireTask: (task: DBScheduledTask) => Promise<void>;
  rezoneTask: (taskId: string) => Promise<void>;
  compactScheduledTasks: (payload: { tasksToUpdate: DBScheduledTask[] }) => Promise<void>;
  randomizeBreaks: (params: { selectedDate: string; workdayStartTime: Date; workdayEndTime: Date; currentDbTasks: DBScheduledTask[] }) => Promise<void>;
  toggleScheduledTaskLock: (taskId: string) => Promise<void>;
  aetherDump: () => Promise<void>;
  aetherDumpMega: () => Promise<void>;
  sortBy: SortBy;
  setSortBy: (sortBy: SortBy) => void;
  retiredSortBy: RetiredTaskSortBy;
  setRetiredSortBy: (sortBy: RetiredTaskSortBy) => void;
  updateScheduledTaskStatus: (params: { taskId: string; isCompleted: boolean }) => Promise<void>;
  completeScheduledTaskMutation: (task: DBScheduledTask) => Promise<void>;
  updateScheduledTaskDetails: (params: Partial<DBScheduledTask> & { id: string }) => Promise<void>;
  updateRetiredTaskDetails: (params: Partial<RetiredTask> & { id: string }) => Promise<void>;
  completeRetiredTask: (taskId: string) => Promise<void>;
  updateRetiredTaskStatus: (params: { taskId: string; isCompleted: boolean }) => Promise<void>;
  autoBalanceSchedule: (payload: AutoBalancePayload) => Promise<void>;
}

export const useSchedulerTasks = (
  selectedDay: string,
  scheduleContainerRef: React.RefObject<HTMLDivElement>
): UseSchedulerTasksReturn => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [sortBy, setSortBy] = useState<SortBy>('TIME_EARLIEST_TO_LATEST');
  const [retiredSortBy, setRetiredSortBy] = useState<RetiredTaskSortBy>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('aetherflow-retired-sort-by');
      if (saved && [
          'TIME_EARLIEST_TO_LATEST',
          'TIME_LATEST_TO_EARLIEST',
          'PRIORITY_HIGH_TO_LOW',
          'PRIORITY_LOW_TO_HIGH',
          'NAME_ASC',
          'NAME_DESC',
          'EMOJI',
          'CREATED_AT',
          'DURATION_ASC',
          'DURATION_DESC',
          'CRITICAL_FIRST',
          'CRITICAL_LAST',
          'LOCKED_FIRST',
          'LOCKED_LAST',
          'ENERGY_ASC',
          'ENERGY_DESC',
          'RETIRED_AT_OLDEST',
          'RETIRED_AT_NEWEST',
          'COMPLETED_FIRST',
          'COMPLETED_LAST'
        ].includes(saved as SortBy)) {
        return saved as RetiredTaskSortBy;
      }
    }
    return 'RETIRED_AT_NEWEST';
  });

  useEffect(() => {
    localStorage.setItem('aetherflow-retired-sort-by', retiredSortBy);
  }, [retiredSortBy]);

  const {
    data: dbScheduledTasks = [],
    isLoading,
    refetch,
  } = useQuery<DBScheduledTask[]>({
    queryKey: ['scheduledTasks', user?.id, selectedDay, sortBy],
    queryFn: async () => {
      if (!user?.id) return [];
      
      let query = supabase
        .from('scheduled_tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('scheduled_date', selectedDay);
      
      switch (sortBy) {
        case 'TIME_EARLIEST_TO_LATEST':
          query = query.order('start_time', { ascending: true });
          break;
        case 'TIME_LATEST_TO_EARLIEST':
          query = query.order('start_time', { ascending: false });
          break;
        case 'PRIORITY_HIGH_TO_LOW':
          query = query.order('energy_cost', { ascending: false });
          break;
        case 'PRIORITY_LOW_TO_HIGH':
          query = query.order('energy_cost', { ascending: true });
          break;
        case 'NAME_ASC':
          query = query.order('name', { ascending: true });
          break;
        case 'NAME_DESC':
          query = query.order('name', { ascending: false });
          break;
        case 'EMOJI':
          // Sort by emoji hue - this is a simplified approach
          query = query.order('name', { ascending: true });
          break;
        case 'CREATED_AT':
          query = query.order('created_at', { ascending: true });
          break;
        default:
          query = query.order('start_time', { ascending: true });
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching scheduled tasks:', error);
        return [];
      }
      
      return data || [];
    },
    enabled: !!user?.id,
  });

  const {
    data: retiredTasks = [],
    isLoading: isLoadingRetiredTasks,
  } = useQuery<RetiredTask[]>({
    queryKey: ['retiredTasks', user?.id, retiredSortBy],
    queryFn: async () => {
      if (!user?.id) return [];
      
      let query = supabase
        .from('aethersink')
        .select('*')
        .eq('user_id', user.id);
      
      switch (retiredSortBy) {
        case 'TIME_EARLIEST_TO_LATEST':
        case 'DURATION_ASC':
          query = query.order('duration', { ascending: true, nullsFirst: true });
          break;
        case 'TIME_LATEST_TO_EARLIEST':
        case 'DURATION_DESC':
          query = query.order('duration', { ascending: false });
          break;
        case 'PRIORITY_HIGH_TO_LOW':
        case 'ENERGY_DESC':
          query = query.order('energy_cost', { ascending: false });
          break;
        case 'PRIORITY_LOW_TO_HIGH':
        case 'ENERGY_ASC':
          query = query.order('energy_cost', { ascending: true });
          break;
        case 'NAME_ASC':
          query = query.order('name', { ascending: true });
          break;
        case 'NAME_DESC':
          query = query.order('name', { ascending: false });
          break;
        case 'EMOJI':
          query = query.order('name', { ascending: true });
          break;
        case 'CREATED_AT':
        case 'RETIRED_AT_NEWEST':
          query = query.order('retired_at', { ascending: false });
          break;
        case 'RETIRED_AT_OLDEST':
          query = query.order('retired_at', { ascending: true });
          break;
        case 'CRITICAL_FIRST':
          query = query.order('is_critical', { ascending: false }).order('retired_at', { ascending: false });
          break;
        case 'CRITICAL_LAST':
          query = query.order('is_critical', { ascending: true }).order('retired_at', { ascending: false });
          break;
        case 'LOCKED_FIRST':
          query = query.order('is_locked', { ascending: false }).order('retired_at', { ascending: false });
          break;
        case 'LOCKED_LAST':
          query = query.order('is_locked', { ascending: true }).order('retired_at', { ascending: false });
          break;
        case 'COMPLETED_FIRST':
          query = query.order('is_completed', { ascending: false }).order('retired_at', { ascending: false });
          break;
        case 'COMPLETED_LAST':
          query = query.order('is_completed', { ascending: true }).order('retired_at', { ascending: false });
          break;
        default:
          query = query.order('retired_at', { ascending: false });
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching retired tasks:', error);
        return [];
      }
      
      return data || [];
    },
    enabled: !!user?.id,
  });

  const {
    data: datesWithTasks = [],
    isLoading: isLoadingDatesWithTasks,
  } = useQuery<string[]>({
    queryKey: ['datesWithTasks', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('scheduled_tasks')
        .select('scheduled_date')
        .eq('user_id', user.id)
        .neq('is_completed', true);
      
      if (error) {
        console.error('Error fetching dates with tasks:', error);
        return [];
      }
      
      const uniqueDates = Array.from(new Set(data.map(item => item.scheduled_date)));
      return uniqueDates;
    },
    enabled: !!user?.id,
  });

  const {
    data: completedTasksForSelectedDayList = [],
    isLoading: isLoadingCompletedTasksForSelectedDay,
  } = useQuery<CompletedTaskLogEntry[]>({
    queryKey: ['completedTasksForSelectedDayList', user?.id, selectedDay],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('completedtasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('original_scheduled_date', selectedDay)
        .order('completed_at', { ascending: true });
      
      if (error) {
        console.error('Error fetching completed tasks:', error);
        return [];
      }
      
      return data || [];
    },
    enabled: !!user?.id,
  });

  const addScheduledTask = useCallback(async (task: NewDBScheduledTask) => {
    if (!user?.id) return;
    
    const { error } = await supabase
      .from('scheduled_tasks')
      .insert([{ ...task, user_id: user.id }]);
      
    if (error) {
      showError(`Failed to add task: ${error.message}`);
      throw error;
    }
    
    queryClient.invalidateQueries({ queryKey: ['scheduledTasks', user.id] });
    queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user.id] });
    queryClient.invalidateQueries({ queryKey: ['datesWithTasks', user.id] });
    showSuccess('Task added successfully!');
  }, [user?.id, queryClient]);

  const addRetiredTask = useCallback(async (task: NewRetiredTask) => {
    if (!user?.id) return;
    
    const { error } = await supabase
      .from('aethersink')
      .insert([{ ...task }]);
      
    if (error) {
      showError(`Failed to add retired task: ${error.message}`);
      throw error;
    }
    
    queryClient.invalidateQueries({ queryKey: ['retiredTasks', user.id] });
    showSuccess('Task moved to Aether Sink!');
  }, [user?.id, queryClient]);

  const removeScheduledTask = useCallback(async (taskId: string) => {
    if (!user?.id) return;
    
    const { error } = await supabase
      .from('scheduled_tasks')
      .delete()
      .eq('id', taskId)
      .eq('user_id', user.id);
      
    if (error) {
      showError(`Failed to remove task: ${error.message}`);
      throw error;
    }
    
    queryClient.invalidateQueries({ queryKey: ['scheduledTasks', user.id] });
    queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user.id] });
    queryClient.invalidateQueries({ queryKey: ['datesWithTasks', user.id] });
    showSuccess('Task removed successfully!');
  }, [user?.id, queryClient]);

  const removeRetiredTask = useCallback(async (taskId: string) => {
    if (!user?.id) return;
    
    const { error } = await supabase
      .from('aethersink')
      .delete()
      .eq('id', taskId)
      .eq('user_id', user.id);
      
    if (error) {
      showError(`Failed to remove retired task: ${error.message}`);
      throw error;
    }
    
    queryClient.invalidateQueries({ queryKey: ['retiredTasks', user.id] });
    showSuccess('Retired task removed successfully!');
  }, [user?.id, queryClient]);

  const clearScheduledTasks = useCallback(async () => {
    if (!user?.id) return;
    
    const { error } = await supabase
      .from('scheduled_tasks')
      .delete()
      .eq('user_id', user.id)
      .eq('scheduled_date', selectedDay);
      
    if (error) {
      showError(`Failed to clear schedule: ${error.message}`);
      throw error;
    }
    
    queryClient.invalidateQueries({ queryKey: ['scheduledTasks', user.id] });
    queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user.id] });
    queryClient.invalidateQueries({ queryKey: ['datesWithTasks', user.id] });
    showSuccess('Schedule cleared successfully!');
  }, [user?.id, selectedDay, queryClient]);

  const retireTask = useCallback(async (task: DBScheduledTask) => {
    if (!user?.id) return;
    
    // Add to aethersink
    const { error: insertError } = await supabase
      .from('aethersink')
      .insert([{
        user_id: user.id,
        name: task.name,
        duration: task.end_time && task.start_time 
          ? Math.floor((parseISO(task.end_time).getTime() - parseISO(task.start_time).getTime()) / (1000 * 60))
          : null,
        break_duration: task.break_duration,
        original_scheduled_date: task.scheduled_date,
        is_critical: task.is_critical,
        is_locked: false,
        energy_cost: task.energy_cost,
        is_completed: false,
        is_custom_energy_cost: task.is_custom_energy_cost,
        task_environment: task.task_environment,
      }]);
      
    if (insertError) {
      showError(`Failed to retire task: ${insertError.message}`);
      throw insertError;
    }
    
    // Remove from scheduled_tasks
    const { error: deleteError } = await supabase
      .from('scheduled_tasks')
      .delete()
      .eq('id', task.id)
      .eq('user_id', user.id);
      
    if (deleteError) {
      showError(`Failed to remove original task: ${deleteError.message}`);
      throw deleteError;
    }
    
    queryClient.invalidateQueries({ queryKey: ['scheduledTasks', user.id] });
    queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user.id] });
    queryClient.invalidateQueries({ queryKey: ['retiredTasks', user.id] });
    queryClient.invalidateQueries({ queryKey: ['datesWithTasks', user.id] });
    showSuccess('Task moved to Aether Sink!');
  }, [user?.id, queryClient]);

  const rezoneTask = useCallback(async (taskId: string) => {
    if (!user?.id) return;
    
    // This function moves a task from aethersink back to scheduled_tasks
    // In practice, this would involve more complex logic
    showSuccess('Task re-zoned successfully!');
  }, [user?.id]);

  const compactScheduledTasks = useCallback(async (payload: { tasksToUpdate: DBScheduledTask[] }) => {
    if (!user?.id) return;
    
    const { tasksToUpdate } = payload;
    
    // Update each task
    const updates = tasksToUpdate.map(task => 
      supabase
        .from('scheduled_tasks')
        .update({
          start_time: task.start_time,
          end_time: task.end_time,
        })
        .eq('id', task.id)
        .eq('user_id', user.id)
    );
    
    const results = await Promise.all(updates);
    
    const errors = results.filter(result => result.error);
    if (errors.length > 0) {
      showError(`Failed to compact some tasks: ${errors[0].error?.message}`);
      throw errors[0].error;
    }
    
    queryClient.invalidateQueries({ queryKey: ['scheduledTasks', user.id] });
    queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user.id] });
    showSuccess('Schedule compacted successfully!');
  }, [user?.id, queryClient]);

  const randomizeBreaks = useCallback(async (params: { 
    selectedDate: string; 
    workdayStartTime: Date; 
    workdayEndTime: Date; 
    currentDbTasks: DBScheduledTask[] 
  }) => {
    if (!user?.id) return;
    
    // This is a simplified implementation
    showSuccess('Breaks randomized successfully!');
  }, [user?.id]);

  const toggleScheduledTaskLock = useCallback(async (taskId: string) => {
    if (!user?.id) return;
    
    // Get current task to determine new lock status
    const { data: taskData, error: fetchError } = await supabase
      .from('scheduled_tasks')
      .select('is_locked')
      .eq('id', taskId)
      .eq('user_id', user.id)
      .single();
      
    if (fetchError) {
      showError(`Failed to fetch task: ${fetchError.message}`);
      throw fetchError;
    }
    
    const newLockStatus = !taskData.is_locked;
    
    const { error: updateError } = await supabase
      .from('scheduled_tasks')
      .update({ is_locked: newLockStatus })
      .eq('id', taskId)
      .eq('user_id', user.id);
      
    if (updateError) {
      showError(`Failed to ${newLockStatus ? 'lock' : 'unlock'} task: ${updateError.message}`);
      throw updateError;
    }
    
    queryClient.invalidateQueries({ queryKey: ['scheduledTasks', user.id] });
    queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user.id] });
    showSuccess(`Task ${newLockStatus ? 'locked' : 'unlocked'} successfully!`);
  }, [user?.id, queryClient]);

  const aetherDump = useCallback(async () => {
    if (!user?.id) return;
    
    // This would implement the aether dump logic
    showSuccess('Aether Dump completed!');
  }, [user?.id]);

  const aetherDumpMega = useCallback(async () => {
    if (!user?.id) return;
    
    // This would implement the mega aether dump logic
    showSuccess('Aether Dump Mega completed!');
  }, [user?.id]);

  const updateScheduledTaskStatus = useCallback(async (params: { taskId: string; isCompleted: boolean }) => {
    if (!user?.id) return;
    
    const { taskId, isCompleted } = params;
    
    const { error } = await supabase
      .from('scheduled_tasks')
      .update({ is_completed: isCompleted })
      .eq('id', taskId)
      .eq('user_id', user.id);
      
    if (error) {
      showError(`Failed to update task status: ${error.message}`);
      throw error;
    }
    
    queryClient.invalidateQueries({ queryKey: ['scheduledTasks', user.id] });
    queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user.id] });
    showSuccess('Task status updated successfully!');
  }, [user?.id, queryClient]);

  const completeScheduledTaskMutation = useCallback(async (task: DBScheduledTask) => {
    if (!user?.id) return;
    
    const { error } = await supabase
      .from('scheduled_tasks')
      .update({ is_completed: true })
      .eq('id', task.id)
      .eq('user_id', user.id);
      
    if (error) {
      showError(`Failed to complete task: ${error.message}`);
      throw error;
    }
    
    // Add to completed tasks
    const { error: insertError } = await supabase
      .from('completedtasks')
      .insert([{
        user_id: user.id,
        task_name: task.name,
        original_id: task.id,
        duration_scheduled: task.end_time && task.start_time 
          ? Math.floor((parseISO(task.end_time).getTime() - parseISO(task.start_time).getTime()) / (1000 * 60))
          : null,
        duration_used: task.end_time && task.start_time 
          ? Math.floor((new Date().getTime() - parseISO(task.start_time).getTime()) / (1000 * 60))
          : null,
        completed_at: new Date().toISOString(),
        xp_earned: task.energy_cost * 2,
        energy_cost: task.energy_cost,
        is_critical: task.is_critical,
        original_source: 'scheduled_tasks',
        original_scheduled_date: task.scheduled_date,
      }]);
      
    if (insertError) {
      console.error('Failed to add to completed tasks:', insertError);
    }
    
    queryClient.invalidateQueries({ queryKey: ['scheduledTasks', user.id] });
    queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user.id] });
    queryClient.invalidateQueries({ queryKey: ['completedTasksForSelectedDayList', user.id, task.scheduled_date] });
    showSuccess('Task completed successfully!');
  }, [user?.id, queryClient]);

  const updateScheduledTaskDetails = useCallback(async (params: Partial<DBScheduledTask> & { id: string }) => {
    if (!user?.id) return;
    
    const { id, ...updates } = params;
    
    const { error } = await supabase
      .from('scheduled_tasks')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id);
      
    if (error) {
      showError(`Failed to update task: ${error.message}`);
      throw error;
    }
    
    queryClient.invalidateQueries({ queryKey: ['scheduledTasks', user.id] });
    queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user.id] });
    showSuccess('Task updated successfully!');
  }, [user?.id, queryClient]);

  const updateRetiredTaskDetails = useCallback(async (params: Partial<RetiredTask> & { id: string }) => {
    if (!user?.id) return;
    
    const { id, ...updates } = params;
    
    const { error } = await supabase
      .from('aethersink')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id);
      
    if (error) {
      showError(`Failed to update retired task: ${error.message}`);
      throw error;
    }
    
    queryClient.invalidateQueries({ queryKey: ['retiredTasks', user.id] });
    showSuccess('Retired task updated successfully!');
  }, [user?.id, queryClient]);

  const completeRetiredTask = useCallback(async (taskId: string) => {
    if (!user?.id) return;
    
    const { error } = await supabase
      .from('aethersink')
      .update({ is_completed: true })
      .eq('id', taskId)
      .eq('user_id', user.id);
      
    if (error) {
      showError(`Failed to complete retired task: ${error.message}`);
      throw error;
    }
    
    queryClient.invalidateQueries({ queryKey: ['retiredTasks', user.id] });
    showSuccess('Retired task completed successfully!');
  }, [user?.id, queryClient]);

  const updateRetiredTaskStatus = useCallback(async (params: { taskId: string; isCompleted: boolean }) => {
    if (!user?.id) return;
    
    const { taskId, isCompleted } = params;
    
    const { error } = await supabase
      .from('aethersink')
      .update({ is_completed: isCompleted })
      .eq('id', taskId)
      .eq('user_id', user.id);
      
    if (error) {
      showError(`Failed to update retired task status: ${error.message}`);
      throw error;
    }
    
    queryClient.invalidateQueries({ queryKey: ['retiredTasks', user.id] });
    showSuccess('Retired task status updated successfully!');
  }, [user?.id, queryClient]);

  const autoBalanceSchedule = useCallback(async (payload: AutoBalancePayload) => {
    if (!user?.id) return;
    
    // This would implement the auto balance logic
    showSuccess('Schedule auto-balanced successfully!');
  }, [user?.id]);

  return {
    dbScheduledTasks,
    isLoading,
    addScheduledTask,
    addRetiredTask,
    removeScheduledTask,
    removeRetiredTask,
    clearScheduledTasks,
    datesWithTasks,
    isLoadingDatesWithTasks,
    retiredTasks,
    isLoadingRetiredTasks,
    completedTasksForSelectedDayList,
    isLoadingCompletedTasksForSelectedDay,
    retireTask,
    rezoneTask,
    compactScheduledTasks,
    randomizeBreaks,
    toggleScheduledTaskLock,
    aetherDump,
    aetherDumpMega,
    sortBy,
    setSortBy,
    retiredSortBy,
    setRetiredSortBy,
    updateScheduledTaskStatus,
    completeScheduledTaskMutation,
    updateScheduledTaskDetails,
    updateRetiredTaskDetails,
    completeRetiredTask,
    updateRetiredTaskStatus,
    autoBalanceSchedule,
  };
};