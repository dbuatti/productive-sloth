import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from './use-session';
import { showSuccess, showError } from '@/utils/toast';

export interface Environment {
  id: string;
  user_id: string;
  label: string;
  value: string;
  icon: string;
  color: string;
  drain_multiplier: number;
  target_weight: number;
  created_at: string;
  updated_at: string;
}

export interface NewEnvironment {
  label: string;
  value: string;
  icon: string;
  color: string;
  drain_multiplier?: number;
  target_weight?: number;
}

export const useEnvironments = () => {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const userId = user?.id;

  const { data: environments = [], isLoading } = useQuery<Environment[]>({
    queryKey: ['environments', userId],
    queryFn: async () => {
      if (!userId) return [];
      console.log(`[useEnvironments] Synchronizing Spatial Matrix...`);
      
      const { data, error } = await supabase
        .from('environments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      
      if (error) throw new Error(error.message);
      return data as Environment[];
    },
    enabled: !!userId,
    staleTime: 60000, // 1 minute stale time to prevent loops during re-renders
    gcTime: 5 * 60 * 1000,
  });

  const addEnvironment = useMutation({
    mutationFn: async (newEnvironment: NewEnvironment) => {
      if (!userId) throw new Error("User not authenticated.");
      const { data, error } = await supabase.from('environments').insert({ ...newEnvironment, user_id: userId }).select().single();
      if (error) throw new Error(error.message);
      return data as Environment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['environments', userId] });
      showSuccess('Zone Initialized.');
    }
  });

  const updateEnvironment = useMutation({
    mutationFn: async (environment: Partial<Environment> & { id: string }) => {
      if (!userId) throw new Error("User not authenticated.");
      const { data, error } = await supabase.from('environments').update({ ...environment, updated_at: new Date().toISOString() }).eq('id', environment.id).eq('user_id', userId).select().single();
      if (error) throw new Error(error.message);
      return data as Environment;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['environments', userId] })
  });

  const deleteEnvironment = useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error("User not authenticated.");
      const { error } = await supabase.from('environments').delete().eq('id', id).eq('user_id', userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['environments', userId] });
      showSuccess('Zone Decommissioned.');
    }
  });

  return {
    environments,
    isLoading,
    addEnvironment: addEnvironment.mutate,
    updateEnvironment: updateEnvironment.mutate,
    deleteEnvironment: deleteEnvironment.mutate,
  };
};