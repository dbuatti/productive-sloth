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
    console.log(`[useRecoveryActivities] Fetching activities for user: ${userId}`);
    const { data, error } = await supabase
      .from('recovery_activities')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true });

    if (error) {
      console.error("[useRecoveryActivities] Error fetching activities:", error);
      throw new Error(error.message);
    }
    console.log(`[useRecoveryActivities] Fetched ${data.length} activities.`);
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
        console.log("[useRecoveryActivities] Initializing default recovery activities...");
        const activitiesToInsert = DEFAULT_ACTIVITIES.map(activity => ({
          ...activity,
          user_id: userId,
        }));
        
        const { error } = await supabase
          .from('recovery_activities')
          .insert(activitiesToInsert);

        if (error) {
          console.error("[useRecoveryActivities] Failed to insert default recovery activities:", error.message);
        } else {
          console.log("[useRecoveryActivities] Default recovery activities inserted, invalidating queries.");
          queryClient.invalidateQueries({ queryKey });
        }
      };
      initializeDefaults();
    }
  }, [userId, isLoading, activities.length, queryClient]);


  const addActivityMutation = useMutation({
    mutationFn: async (newActivity: NewRecoveryActivity) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("[useRecoveryActivities] Adding new activity:", newActivity.name);
      const activityToInsert = { ...newActivity, user_id: userId };
      const { data, error } = await supabase.from('recovery_activities').insert(activityToInsert).select().single();
      if (error) {
        console.error("[useRecoveryActivities] Error adding activity:", error);
        throw new Error(error.message);
      }
      console.log("[useRecoveryActivities] Activity added successfully:", data.name);
      return data as RecoveryActivity;
    },
    onSuccess: () => {
      console.log("[useRecoveryActivities] Invalidate queries after addActivity.");
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
      console.log("[useRecoveryActivities] Updating activity:", activity.id, activity.name);
      const { data, error } = await supabase
        .from('recovery_activities')
        .update(activity)
        .eq('id', activity.id)
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) {
        console.error("[useRecoveryActivities] Error updating activity:", error);
        throw new Error(error.message);
      }
      console.log("[useRecoveryActivities] Activity updated successfully:", data.name);
      return data as RecoveryActivity;
    },
    onSuccess: () => {
      console.log("[useRecoveryActivities] Invalidate queries after updateActivity.");
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
      console.log("[useRecoveryActivities] Deleting activity:", id);
      const { error } = await supabase.from('recovery_activities').delete().eq('id', id).eq('user_id', userId);
      if (error) {
        console.error("[useRecoveryActivities] Error deleting activity:", error);
        throw new Error(error.message);
      }
      console.log("[useRecoveryActivities] Activity deleted successfully:", id);
    },
    onSuccess: () => {
      console.log("[useRecoveryActivities] Invalidate queries after deleteActivity.");
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