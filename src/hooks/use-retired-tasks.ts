import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RetiredTask, NewRetiredTask, RetiredTaskSortBy } from '@/types/scheduler';
import { useSession } from './use-session';
import { showSuccess, showError } from '@/utils/toast';
import { getEmojiHue } from '@/lib/scheduler-utils';
import { format } from 'date-fns';

export const useRetiredTasks = () => {
  const queryClient = useQueryClient();
  const { user, profile } = useSession();
  const userId = user?.id;

  const [retiredSortBy, setRetiredSortBy] = useState<RetiredTaskSortBy>(() => {
    if (typeof window !== 'undefined') {
      const savedSortBy = localStorage.getItem('aetherSinkSortBy');
      return savedSortBy ? (savedSortBy as RetiredTaskSortBy) : 'RETIRED_AT_NEWEST';
    }
    return 'RETIRED_AT_NEWEST';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('aetherSinkSortBy', retiredSortBy);
    }
  }, [retiredSortBy]);

  const { data: retiredTasks = [], isLoading: isLoadingRetiredTasks } = useQuery<RetiredTask[]>({
    queryKey: ['retiredTasks', userId, retiredSortBy],
    queryFn: async () => {
      if (!userId) return [];
      let query = supabase.from('aethersink').select('*').eq('user_id', userId);

      switch (retiredSortBy) {
        case 'NAME_ASC': query = query.order('name', { ascending: true }); break;
        case 'NAME_DESC': query = query.order('name', { ascending: false }); break;
        case 'DURATION_ASC': query = query.order('duration', { ascending: true, nullsFirst: true }); break;
        case 'DURATION_DESC': query = query.order('duration', { ascending: false }); break;
        case 'ENERGY_ASC': query = query.order('energy_cost', { ascending: true }); break;
        case 'ENERGY_DESC': query = query.order('energy_cost', { ascending: false }); break;
        case 'RETIRED_AT_OLDEST': query = query.order('retired_at', { ascending: true }); break;
        case 'RETIRED_AT_NEWEST': default: query = query.order('retired_at', { ascending: false }); break;
        case 'CRITICAL_FIRST': query = query.order('is_critical', { ascending: false }).order('retired_at', { ascending: false }); break;
        case 'CRITICAL_LAST': query = query.order('is_critical', { ascending: true }).order('retired_at', { ascending: false }); break;
        case 'LOCKED_FIRST': query = query.order('is_locked', { ascending: false }).order('retired_at', { ascending: false }); break;
        case 'LOCKED_LAST': query = query.order('is_locked', { ascending: true }).order('retired_at', { ascending: false }); break;
        case 'COMPLETED_FIRST': query = query.order('is_completed', { ascending: false }).order('retired_at', { ascending: false }); break;
        case 'COMPLETED_LAST': query = query.order('is_completed', { ascending: true }).order('retired_at', { ascending: false }); break;
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      
      if (retiredSortBy === 'EMOJI') {
        return (data as RetiredTask[]).sort((a, b) => getEmojiHue(a.name) - getEmojiHue(b.name));
      }
      return data as RetiredTask[];
    },
    enabled: !!userId,
  });

  const addRetiredTaskMutation = useMutation({
    mutationFn: async (newTask: NewRetiredTask) => {
      if (!userId) throw new Error("User not authenticated.");
      const taskToInsert = { ...newTask, user_id: userId, retired_at: new Date().toISOString(), energy_cost: newTask.energy_cost ?? 0, is_completed: newTask.is_completed ?? false, is_custom_energy_cost: newTask.is_custom_energy_cost ?? false, task_environment: newTask.task_environment ?? 'laptop', is_backburner: newTask.is_backburner ?? false, is_work: newTask.is_work ?? false, is_break: newTask.is_break ?? false };
      const { data, error } = await supabase.from('aethersink').insert(taskToInsert).select().single();
      if (error) throw new Error(error.message);
      return data as RetiredTask;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
      showSuccess(`Task "${data?.name}" added to Aether Sink!`);
    },
    onError: (e) => {
      showError(`Failed to add retired task: ${e.message}`);
    }
  });

  const removeRetiredTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      if (!userId) throw new Error("User not authenticated.");
      const { error } = await supabase.from('aethersink').delete().eq('id', taskId).eq('user_id', userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
      showSuccess('Task removed from Aether Sink.');
    },
    onError: (e) => {
      showError(`Failed to remove retired task: ${e.message}`);
    }
  });

  const updateRetiredTaskDetailsMutation = useMutation({
    mutationFn: async (task: Partial<RetiredTask> & { id: string }) => {
      const { data, error } = await supabase
        .from('aethersink')
        .update({ ...task, updated_at: new Date().toISOString() })
        .eq('id', task.id)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
      showSuccess('Retired task updated successfully!');
    },
    onError: (e) => {
      showError(`Failed to update retired task: ${e.message}`);
    }
  });

  const updateRetiredTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, isCompleted }: { taskId: string; isCompleted: boolean }) => {
      const { error } = await supabase.from('aethersink').update({ is_completed: isCompleted }).eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['retiredTasks'] })
  });

  const completeRetiredTaskMutation = useMutation({
    mutationFn: async (task: RetiredTask) => {
      if (!userId) throw new Error("User not authenticated.");
      
      const { error: logError } = await supabase.from('completedtasks').insert({
        user_id: userId,
        task_name: task.name,
        original_id: task.id,
        duration_scheduled: task.duration,
        duration_used: task.duration,
        xp_earned: (task.energy_cost || 0) * 2,
        energy_cost: task.energy_cost,
        is_critical: task.is_critical,
        original_source: 'aethersink',
        original_scheduled_date: task.original_scheduled_date,
        is_work: task.is_work,
        is_break: task.is_break,
      });
      if (logError) throw logError;

      const { error: deleteError } = await supabase.from('aethersink').delete().eq('id', task.id);
      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
      queryClient.invalidateQueries({ queryKey: ['completedTasksForSelectedDay'] });
      showSuccess('Retired task completed and removed from Sink!');
    }
  });

  const toggleRetiredTaskLockMutation = useMutation({
    mutationFn: async ({ taskId, isLocked }: { taskId: string; isLocked: boolean }) => {
      const { error } = await supabase.from('aethersink').update({ is_locked: isLocked }).eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['retiredTasks'] })
  });

  const triggerAetherSinkBackupMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("User not authenticated.");
      const { error } = await supabase.rpc('backup_aethersink_for_user', { p_user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => showSuccess("Aether Sink backup completed!")
  });

  const rezoneTaskMutation = useMutation({
    mutationFn: async (task: RetiredTask) => {
      if (!userId || !profile) throw new Error("User context missing.");
      // Return the task data to the caller, so it can be scheduled by useSchedulerTasks
      return task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
      showSuccess("Objective prepared for re-zoning!");
    },
    onError: (e) => {
      showError(`Failed to prepare task for re-zoning: ${e.message}`);
    }
  });

  return {
    retiredTasks,
    isLoadingRetiredTasks,
    addRetiredTask: addRetiredTaskMutation.mutateAsync,
    removeRetiredTask: removeRetiredTaskMutation.mutateAsync,
    updateRetiredTaskDetails: updateRetiredTaskDetailsMutation.mutateAsync,
    updateRetiredTaskStatus: updateRetiredTaskStatusMutation.mutateAsync,
    completeRetiredTask: completeRetiredTaskMutation.mutateAsync,
    toggleRetiredTaskLock: toggleRetiredTaskLockMutation.mutateAsync,
    triggerAetherSinkBackup: triggerAetherSinkBackupMutation.mutateAsync,
    rezoneTask: rezoneTaskMutation.mutateAsync,
    retiredSortBy,
    setRetiredSortBy,
  };
};