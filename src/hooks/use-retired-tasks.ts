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
      console.log(`[useRetiredTasks] Saved sort preference: ${retiredSortBy}`);
    }
  }, [retiredSortBy]);

  const { data: retiredTasks = [], isLoading: isLoadingRetiredTasks } = useQuery<RetiredTask[]>({
    queryKey: ['retiredTasks', userId, retiredSortBy],
    queryFn: async () => {
      if (!userId) return [];
      console.log(`[useRetiredTasks] Fetching retired tasks for user: ${userId}, sorted by: ${retiredSortBy}`);
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
      if (error) {
        console.error("[useRetiredTasks] Error fetching retired tasks:", error);
        throw new Error(error.message);
      }
      
      if (retiredSortBy === 'EMOJI') {
        const sortedData = (data as RetiredTask[]).sort((a, b) => getEmojiHue(a.name) - getEmojiHue(b.name));
        console.log("[useRetiredTasks] Tasks sorted by EMOJI.");
        return sortedData;
      }
      console.log(`[useRetiredTasks] Fetched ${data.length} retired tasks.`);
      return data as RetiredTask[];
    },
    enabled: !!userId,
  });

  const addRetiredTaskMutation = useMutation({
    mutationFn: async (newTask: NewRetiredTask) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("[useRetiredTasks] Adding new retired task:", newTask.name);
      const taskToInsert = { ...newTask, user_id: userId, retired_at: new Date().toISOString(), energy_cost: newTask.energy_cost ?? 0, is_completed: newTask.is_completed ?? false, is_custom_energy_cost: newTask.is_custom_energy_cost ?? false, task_environment: newTask.task_environment ?? 'laptop', is_backburner: newTask.is_backburner ?? false, is_work: newTask.is_work ?? false, is_break: newTask.is_break ?? false };
      const { data, error } = await supabase.from('aethersink').insert(taskToInsert).select().single();
      if (error) {
        console.error("[useRetiredTasks] Error adding retired task:", error);
        throw new Error(error.message);
      }
      console.log("[useRetiredTasks] Retired task added successfully:", data.name);
      return data as RetiredTask;
    },
    onSuccess: (data) => {
      console.log("[useRetiredTasks] Invalidate queries after addRetiredTask.");
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
      console.log("[useRetiredTasks] Removing retired task:", taskId);
      const { error } = await supabase.from('aethersink').delete().eq('id', taskId).eq('user_id', userId);
      if (error) {
        console.error("[useRetiredTasks] Error removing retired task:", error);
        throw new Error(error.message);
      }
      console.log("[useRetiredTasks] Retired task removed successfully:", taskId);
    },
    onSuccess: () => {
      console.log("[useRetiredTasks] Invalidate queries after removeRetiredTask.");
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
      showSuccess('Task removed from Aether Sink.');
    },
    onError: (e) => {
      showError(`Failed to remove retired task: ${e.message}`);
    }
  });

  const bulkRemoveRetiredTasksMutation = useMutation({
    mutationFn: async (taskIds: string[]) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("[useRetiredTasks] Bulk removing retired tasks:", taskIds.length);
      const { error } = await supabase.from('aethersink').delete().in('id', taskIds).eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
      showSuccess('Aether Sink cleared of unlocked tasks.');
    },
    onError: (e) => {
      showError(`Failed to clear sink: ${e.message}`);
    }
  });

  const updateRetiredTaskDetailsMutation = useMutation({
    mutationFn: async (task: Partial<RetiredTask> & { id: string }) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("[useRetiredTasks] Updating retired task details for:", task.id);
      const { data, error } = await supabase
        .from('aethersink')
        .update({ ...task, updated_at: new Date().toISOString() })
        .eq('id', task.id)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) {
        console.error("[useRetiredTasks] Error updating retired task details:", error);
        throw error;
      }
      console.log("[useRetiredTasks] Retired task details updated successfully:", data.name);
      return data;
    },
    onSuccess: () => {
      console.log("[useRetiredTasks] Invalidate queries after updateRetiredTaskDetails.");
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
      showSuccess('Retired task updated successfully!');
    },
    onError: (e) => {
      showError(`Failed to update retired task: ${e.message}`);
    }
  });

  const updateRetiredTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, isCompleted }: { taskId: string; isCompleted: boolean }) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log(`[useRetiredTasks] Updating completion status for retired task ${taskId} to ${isCompleted}.`);
      const { error } = await supabase.from('aethersink').update({ is_completed: isCompleted }).eq('id', taskId);
      if (error) {
        console.error("[useRetiredTasks] Error updating retired task status:", error);
        throw error;
      }
      console.log(`[useRetiredTasks] Retired task ${taskId} completion status updated.`);
    },
    onSuccess: () => {
      console.log("[useRetiredTasks] Invalidate queries after updateRetiredTaskStatus.");
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
    },
    onError: (e) => {
      showError(`Failed to update retired task status: ${e.message}`);
    }
  });

  const completeRetiredTaskMutation = useMutation({
    mutationFn: async (task: RetiredTask) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("[useRetiredTasks] Completing retired task:", task.name);
      
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
      if (logError) {
        console.error("[useRetiredTasks] Error logging completed retired task:", logError);
        throw logError;
      }

      const { error: deleteError } = await supabase.from('aethersink').delete().eq('id', task.id);
      if (deleteError) {
        console.error("[useRetiredTasks] Error deleting completed retired task from aethersink:", deleteError);
        throw deleteError;
      }
      console.log("[useRetiredTasks] Retired task completed and removed from Sink successfully:", task.name);
    },
    onSuccess: () => {
      console.log("[useRetiredTasks] Invalidate queries after completeRetiredTask.");
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
      queryClient.invalidateQueries({ queryKey: ['completedTasksForSelectedDay'] });
      showSuccess('Retired task completed and removed from Sink!');
    },
    onError: (e) => {
      showError(`Failed to complete retired task: ${e.message}`);
    }
  });

  const toggleRetiredTaskLockMutation = useMutation({
    mutationFn: async ({ taskId, isLocked }: { taskId: string; isLocked: boolean }) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log(`[useRetiredTasks] Toggling lock for retired task ${taskId} to ${isLocked}.`);
      const { error } = await supabase.from('aethersink').update({ is_locked: isLocked }).eq('id', taskId);
      if (error) {
        console.error("[useRetiredTasks] Error toggling retired task lock:", error);
        throw error;
      }
      console.log(`[useRetiredTasks] Retired task ${taskId} lock toggled successfully.`);
    },
    onSuccess: () => {
      console.log("[useRetiredTasks] Invalidate queries after toggleRetiredTaskLock.");
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
    },
    onError: (e) => {
      showError(`Failed to toggle task lock: ${e.message}`);
    }
  });

  const triggerAetherSinkBackupMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("[useRetiredTasks] Triggering Aether Sink backup via RPC.");
      const { error } = await supabase.rpc('backup_aethersink_for_user', { p_user_id: userId });
      if (error) {
        console.error("[useRetiredTasks] Error triggering Aether Sink backup:", error);
        throw error;
      }
      console.log("[useRetiredTasks] Aether Sink backup RPC called successfully.");
    },
    onSuccess: () => {
      console.log("[useRetiredTasks] Invalidate queries after triggerAetherSinkBackup.");
      queryClient.invalidateQueries({ queryKey: ['aetherSinkSnapshots'] });
      showSuccess("Aether Sink backup completed!");
    },
    onError: (e) => {
      showError(`Failed to trigger Aether Sink backup: ${e.message}`);
    }
  });

  const rezoneTaskMutation = useMutation({
    mutationFn: async (task: RetiredTask) => {
      if (!userId || !profile) throw new Error("User context missing.");
      console.log("[useRetiredTasks] Preparing task for re-zoning:", task.name);
      return task;
    },
    onSuccess: () => {
      console.log("[useRetiredTasks] Invalidate queries after rezoneTask.");
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] });
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
    bulkRemoveRetiredTasks: bulkRemoveRetiredTasksMutation.mutateAsync,
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