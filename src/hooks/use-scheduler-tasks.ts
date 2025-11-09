import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DBScheduledTask, NewDBScheduledTask, RawTaskInput } from '@/types/scheduler';
import { useSession } from './use-session';
import { showSuccess, showError } from '@/utils/toast';

export const useSchedulerTasks = () => {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const userId = user?.id;

  // Fetch all scheduled tasks for the current user
  const { data: dbScheduledTasks = [], isLoading } = useQuery<DBScheduledTask[]>({
    queryKey: ['scheduledTasks', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('scheduled_tasks')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true }); // Order by creation to maintain queue order

      if (error) throw new Error(error.message);
      return data as DBScheduledTask[];
    },
    enabled: !!userId,
  });

  // Convert DBScheduledTask to RawTaskInput for the scheduler logic
  const rawTasks: RawTaskInput[] = dbScheduledTasks.map(dbTask => ({
    name: dbTask.name,
    duration: dbTask.duration,
    breakDuration: dbTask.break_duration ?? undefined,
  }));

  // Add a new scheduled task
  const addScheduledTaskMutation = useMutation({
    mutationFn: async (newTask: NewDBScheduledTask) => {
      if (!userId) throw new Error("User not authenticated.");
      const taskToInsert = { ...newTask, user_id: userId };
      const { data, error } = await supabase.from('scheduled_tasks').insert(taskToInsert).select().single();
      if (error) throw new Error(error.message);
      return data as DBScheduledTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId] });
      showSuccess('Task added to schedule!');
    },
    onError: (e) => {
      showError(`Failed to add task to schedule: ${e.message}`);
    }
  });

  // Remove a specific scheduled task by ID
  const removeScheduledTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      if (!userId) throw new Error("User not authenticated.");
      const { error } = await supabase.from('scheduled_tasks').delete().eq('id', taskId).eq('user_id', userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId] });
      showSuccess('Task removed from schedule.');
    },
    onError: (e) => {
      showError(`Failed to remove task from schedule: ${e.message}`);
    }
  });

  // Clear all scheduled tasks for the user
  const clearScheduledTasksMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("User not authenticated.");
      const { error } = await supabase.from('scheduled_tasks').delete().eq('user_id', userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId] });
      showSuccess('Schedule cleared!');
    },
    onError: (e) => {
      showError(`Failed to clear schedule: ${e.message}`);
    }
  });

  return {
    dbScheduledTasks, // The raw data from Supabase
    rawTasks, // Converted to RawTaskInput for scheduler logic
    isLoading,
    addScheduledTask: addScheduledTaskMutation.mutate,
    removeScheduledTask: removeScheduledTaskMutation.mutate,
    clearScheduledTasks: clearScheduledTasksMutation.mutate,
  };
};