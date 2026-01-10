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
  created_at: string;
  updated_at: string;
}

export interface NewEnvironment {
  label: string;
  value: string;
  icon: string;
  color: string;
  drain_multiplier?: number;
}

export const useEnvironments = () => {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const userId = user?.id;

  const { data: environments = [], isLoading } = useQuery<Environment[]>({
    queryKey: ['environments', userId],
    queryFn: async () => {
      if (!userId) return [];
      console.log(`[useEnvironments] Fetching environments for user: ${userId}`);
      
      const { data, error } = await supabase
        .from('environments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error("[useEnvironments] Error fetching environments:", error);
        throw new Error(error.message);
      }
      console.log(`[useEnvironments] Fetched ${data.length} environments.`);
      return data as Environment[];
    },
    enabled: !!userId,
  });

  const addEnvironment = useMutation({
    mutationFn: async (newEnvironment: NewEnvironment) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("[useEnvironments] Adding new environment:", newEnvironment.label);
      
      const environmentToInsert = {
        ...newEnvironment,
        user_id: userId,
        drain_multiplier: newEnvironment.drain_multiplier ?? 1.0,
      };

      const { data, error } = await supabase
        .from('environments')
        .insert(environmentToInsert)
        .select()
        .single();
      
      if (error) {
        console.error("[useEnvironments] Error adding environment:", error);
        throw new Error(error.message);
      }
      console.log("[useEnvironments] Environment added successfully:", data.label);
      return data as Environment;
    },
    onSuccess: () => {
      console.log("[useEnvironments] Invalidate queries after addEnvironment.");
      queryClient.invalidateQueries({ queryKey: ['environments'] });
      showSuccess('Environment added successfully!');
    },
    onError: (error: any) => {
      showError(`Failed to add environment: ${error.message}`);
    }
  });

  const updateEnvironment = useMutation({
    mutationFn: async (environment: Partial<Environment> & { id: string }) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("[useEnvironments] Updating environment:", environment.id, environment.label);
      
      const { data, error } = await supabase
        .from('environments')
        .update({ ...environment, updated_at: new Date().toISOString() })
        .eq('id', environment.id)
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) {
        console.error("[useEnvironments] Error updating environment:", error);
        throw new Error(error.message);
      }
      console.log("[useEnvironments] Environment updated successfully:", data.label);
      return data as Environment;
    },
    onSuccess: () => {
      console.log("[useEnvironments] Invalidate queries after updateEnvironment.");
      queryClient.invalidateQueries({ queryKey: ['environments'] });
      showSuccess('Environment updated successfully!');
    },
    onError: (error: any) => {
      showError(`Failed to update environment: ${error.message}`);
    }
  });

  const deleteEnvironment = useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("[useEnvironments] Deleting environment:", id);
      
      const { error } = await supabase
        .from('environments')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
      
      if (error) {
        console.error("[useEnvironments] Error deleting environment:", error);
        throw new Error(error.message);
      }
      console.log("[useEnvironments] Environment deleted successfully:", id);
    },
    onSuccess: () => {
      console.log("[useEnvironments] Invalidate queries after deleteEnvironment.");
      queryClient.invalidateQueries({ queryKey: ['environments'] });
      showSuccess('Environment deleted successfully!');
    },
    onError: (error: any) => {
      showError(`Failed to delete environment: ${error.message}`);
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