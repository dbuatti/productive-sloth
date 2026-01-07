import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from './use-session';
import { showSuccess, showError } from '@/utils/toast';
import { useEffect } from 'react';

export interface RecoveryActivity {
  id: string;
  user_id: string;
  name: string;
  duration_minutes: number;
  created_at: string;
}

export interface NewRecoveryActivity {
  name: string;
  duration_minutes: number;
}

const DEFAULT_ACTIVITIES: NewRecoveryActivity[] = [
  { name: 'Meditate', duration_minutes: 10 },
  { name: 'Kriya Yoga', duration_minutes: 15 },
  { name: 'Sit in the Sun', duration_minutes: 5 },
  { name: 'Play a Game', duration_minutes: 20 },
  { name: 'Hydrate & Stretch', duration_minutes: 5 },
];

export const useRecoveryActivities = () => {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const userId = user?.id;

  const queryKey = ['recoveryActivities', userId];

  const fetchActivities = async (): Promise<RecoveryActivity[]> => {
    if (!userId) return [];
    const { data, error } = await supabase
      .from('recovery_activities')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true });

    if (error) throw new Error(error.message);
    return data as RecoveryActivity[];
  };

  const { data: activities = [], isLoading } = useQuery<RecoveryActivity[]>({
    queryKey,
    queryFn: fetchActivities,
    enabled: !!userId,
  });

  // Effect to initialize default activities if the list is empty
  useEffect(() => {
    if (userId && !isLoading && activities.length === 0) {
      const initializeDefaults = async () => {
        // 
        const activitiesToInsert = DEFAULT_ACTIVITIES.map(activity => ({
          ...activity,
          user_id: userId,
        }));
        
        const { error } = await supabase
          .from('recovery_activities')
          .insert(activitiesToInsert);

        if (error) {
          // 
        } else {
          queryClient.invalidateQueries({ queryKey });
        }
      };
      initializeDefaults();
    }
  }, [userId, isLoading, activities.length, queryClient]);


  const addActivityMutation = useMutation({
    mutationFn: async (newActivity: NewRecoveryActivity) => {
      if (!userId) throw new Error("User not authenticated.");
      const activityToInsert = { ...newActivity, user_id: userId };
      const { data, error } = await supabase.from('recovery_activities').insert(activityToInsert).select().single();
      if (error) throw new Error(error.message);
      return data as RecoveryActivity;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      showSuccess('Recovery activity added!');
    },
    onError: (e) => {
      showError(`Failed to add activity: ${e.message}`);
    }
  });

  const updateActivityMutation = useMutation({
    mutationFn: async (activity: Partial<RecoveryActivity> & { id: string }) => {
      if (!userId) throw new Error("User not authenticated.");
      const { data, error } = await supabase
        .from('recovery_activities')
        .update(activity)
        .eq('id', activity.id)
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) throw new Error(error.message);
      return data as RecoveryActivity;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      showSuccess('Recovery activity updated!');
    },
    onError: (e) => {
      showError(`Failed to update activity: ${e.message}`);
    }
  });

  const deleteActivityMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error("User not authenticated.");
      const { error } = await supabase.from('recovery_activities').delete().eq('id', id).eq('user_id', userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      showSuccess('Recovery activity deleted.');
    },
    onError: (e) => {
      showError(`Failed to delete activity: ${e.message}`);
    }
  });

  return {
    activities,
    isLoading,
    addActivity: addActivityMutation.mutate,
    updateActivity: updateActivityMutation.mutate,
    deleteActivity: deleteActivityMutation.mutate,
  };
};