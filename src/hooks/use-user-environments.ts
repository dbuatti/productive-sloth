import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from './use-session';
import { showSuccess, showError } from '@/utils/toast';
import { TaskEnvironment } from '@/types/scheduler'; // Re-using TaskEnvironment type for consistency

export interface UserEnvironment {
  id: string;
  user_id: string;
  name: string;
  icon_name: string; // Stores Lucide icon name as a string
  order_index: number;
  created_at: string;
}

export interface NewUserEnvironment {
  name: string;
  icon_name: string;
  order_index?: number; // Optional, will be set by hook
}

// Default environments to initialize for new users
const DEFAULT_ENVIRONMENTS: NewUserEnvironment[] = [
  { name: 'At Home', icon_name: 'Home', order_index: 0 },
  { name: 'Laptop/Desk', icon_name: 'Laptop', order_index: 1 },
  { name: 'Away/Errands', icon_name: 'Globe', order_index: 2 },
  { name: 'Piano Practice', icon_name: 'Music', order_index: 3 },
  { name: 'Recording/Production', icon_name: 'Laptop', order_index: 4 }, // Using Laptop for now, can be changed
];

export const useUserEnvironments = () => {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const userId = user?.id;

  const queryKey = ['userEnvironments', userId];

  const fetchEnvironments = useCallback(async (): Promise<UserEnvironment[]> => {
    if (!userId) return [];
    const { data, error } = await supabase
      .from('user_environments')
      .select('*')
      .eq('user_id', userId)
      .order('order_index', { ascending: true });

    if (error) throw new Error(error.message);
    return data as UserEnvironment[];
  }, [userId]);

  const { data: environments = [], isLoading, isFetching } = useQuery<UserEnvironment[]>({
    queryKey,
    queryFn: fetchEnvironments,
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Effect to initialize default environments if the list is empty
  useEffect(() => {
    if (userId && !isLoading && !isFetching && environments.length === 0) {
      const initializeDefaults = async () => {
        console.log("[useUserEnvironments] Initializing default environments...");
        const environmentsToInsert = DEFAULT_ENVIRONMENTS.map((env, index) => ({
          ...env,
          user_id: userId,
          order_index: index,
        }));
        
        const { error } = await supabase
          .from('user_environments')
          .insert(environmentsToInsert);

        if (error) {
          console.error("[useUserEnvironments] Failed to insert default environments:", error.message);
          showError("Failed to load default environments.");
        } else {
          queryClient.invalidateQueries({ queryKey });
          showSuccess("Default environments loaded!");
        }
      };
      initializeDefaults();
    }
  }, [userId, isLoading, isFetching, environments.length, queryClient, queryKey]);


  const addEnvironmentMutation = useMutation({
    mutationFn: async (newEnv: NewUserEnvironment) => {
      if (!userId) throw new Error("User not authenticated.");
      const order_index = environments.length > 0 ? Math.max(...environments.map(e => e.order_index)) + 1 : 0;
      const envToInsert = { ...newEnv, user_id: userId, order_index };
      const { data, error } = await supabase.from('user_environments').insert(envToInsert).select().single();
      if (error) throw new Error(error.message);
      return data as UserEnvironment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      showSuccess('Environment added!');
    },
    onError: (e) => {
      showError(`Failed to add environment: ${e.message}`);
    }
  });

  const updateEnvironmentMutation = useMutation({
    mutationFn: async (updatedEnv: Partial<UserEnvironment> & { id: string }) => {
      if (!userId) throw new Error("User not authenticated.");
      const { data, error } = await supabase
        .from('user_environments')
        .update(updatedEnv)
        .eq('id', updatedEnv.id)
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) throw new Error(error.message);
      return data as UserEnvironment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      showSuccess('Environment updated!');
    },
    onError: (e) => {
      showError(`Failed to update environment: ${e.message}`);
    }
  });

  const deleteEnvironmentMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error("User not authenticated.");
      const { error } = await supabase.from('user_environments').delete().eq('id', id).eq('user_id', userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      showSuccess('Environment deleted.');
    },
    onError: (e) => {
      showError(`Failed to delete environment: ${e.message}`);
    }
  });

  // Function to update the order of environments
  const updateEnvironmentOrder = useCallback(async (newOrder: UserEnvironment[]) => {
    if (!userId) throw new Error("User not authenticated.");
    const updates = newOrder.map((env, index) => ({
      id: env.id,
      user_id: userId,
      order_index: index,
    }));

    const { error } = await supabase
      .from('user_environments')
      .upsert(updates, { onConflict: 'id' });

    if (error) {
      console.error("[useUserEnvironments] Failed to update environment order:", error.message);
      showError("Failed to update environment order.");
      throw new Error(error.message);
    }
    queryClient.invalidateQueries({ queryKey });
  }, [userId, queryClient, queryKey]);


  return {
    environments,
    isLoading,
    addEnvironment: addEnvironmentMutation.mutate,
    updateEnvironment: updateEnvironmentMutation.mutate,
    deleteEnvironment: deleteEnvironmentMutation.mutate,
    updateEnvironmentOrder,
  };
};