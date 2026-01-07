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
  is_default: boolean;
  drain_multiplier: number;
  created_at: string;
  updated_at: string;
}

export interface NewEnvironment {
  label: string;
  value: string;
  icon: string;
  color: string;
  is_default?: boolean;
  drain_multiplier?: number;
}

const LOG_PREFIX = "[ENVIRONMENTS]";

export const useEnvironments = () => {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const userId = user?.id;

  const { data: environments = [], isLoading } = useQuery<Environment[]>({
    queryKey: ['environments', userId],
    queryFn: async () => {
      console.log(`${LOG_PREFIX} Fetching environments for user: ${userId}`);
      
      if (!userId) {
        console.log(`${LOG_PREFIX} No user ID, returning empty array`);
        return [];
      }
      
      const { data, error } = await supabase
        .from('environments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error(`${LOG_PREFIX} Error fetching environments:`, error.message);
        throw new Error(error.message);
      }
      
      console.log(`${LOG_PREFIX} Successfully fetched ${data.length} environments`);
      return data as Environment[];
    },
    enabled: !!userId,
  });

  const addEnvironment = useMutation({
    mutationFn: async (newEnvironment: NewEnvironment) => {
      console.log(`${LOG_PREFIX} Adding new environment:`, newEnvironment);
      
      if (!userId) {
        console.error(`${LOG_PREFIX} Cannot add environment: No user ID`);
        throw new Error("User not authenticated.");
      }
      
      const environmentToInsert = {
        ...newEnvironment,
        user_id: userId,
        is_default: newEnvironment.is_default ?? false,
        drain_multiplier: newEnvironment.drain_multiplier ?? 1.0,
      };

      const { data, error } = await supabase
        .from('environments')
        .insert(environmentToInsert)
        .select()
        .single();
      
      if (error) {
        console.error(`${LOG_PREFIX} Error adding environment:`, error.message);
        throw new Error(error.message);
      }
      
      console.log(`${LOG_PREFIX} Successfully added environment:`, data);
      return data as Environment;
    },
    onSuccess: (data) => {
      console.log(`${LOG_PREFIX} addEnvironment onSuccess: Invalidating queries`);
      queryClient.invalidateQueries({ queryKey: ['environments'] });
      showSuccess('Environment added successfully!');
    },
    onError: (error: any) => {
      console.error(`${LOG_PREFIX} addEnvironment onError:`, error.message);
      showError(`Failed to add environment: ${error.message}`);
    }
  });

  const updateEnvironment = useMutation({
    mutationFn: async (environment: Partial<Environment> & { id: string }) => {
      console.log(`${LOG_PREFIX} Updating environment:`, environment);
      
      if (!userId) {
        console.error(`${LOG_PREFIX} Cannot update environment: No user ID`);
        throw new Error("User not authenticated.");
      }
      
      const { data, error } = await supabase
        .from('environments')
        .update({ ...environment, updated_at: new Date().toISOString() })
        .eq('id', environment.id)
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) {
        console.error(`${LOG_PREFIX} Error updating environment:`, error.message);
        throw new Error(error.message);
      }
      
      console.log(`${LOG_PREFIX} Successfully updated environment:`, data);
      return data as Environment;
    },
    onSuccess: (data) => {
      console.log(`${LOG_PREFIX} updateEnvironment onSuccess: Invalidating queries`);
      queryClient.invalidateQueries({ queryKey: ['environments'] });
      showSuccess('Environment updated successfully!');
    },
    onError: (error: any) => {
      console.error(`${LOG_PREFIX} updateEnvironment onError:`, error.message);
      showError(`Failed to update environment: ${error.message}`);
    }
  });

  const deleteEnvironment = useMutation({
    mutationFn: async (id: string) => {
      console.log(`${LOG_PREFIX} Deleting environment with ID: ${id}`);
      
      if (!userId) {
        console.error(`${LOG_PREFIX} Cannot delete environment: No user ID`);
        throw new Error("User not authenticated.");
      }
      
      // Check if this is a default environment
      const { data: env } = await supabase
        .from('environments')
        .select('is_default')
        .eq('id', id)
        .eq('user_id', userId)
        .single();
      
      if (env?.is_default) {
        console.error(`${LOG_PREFIX} Cannot delete default environment: ${id}`);
        throw new Error("Cannot delete default environments.");
      }
      
      const { error } = await supabase
        .from('environments')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
      
      if (error) {
        console.error(`${LOG_PREFIX} Error deleting environment:`, error.message);
        throw new Error(error.message);
      }
      
      console.log(`${LOG_PREFIX} Successfully deleted environment: ${id}`);
    },
    onSuccess: (data, id) => {
      console.log(`${LOG_PREFIX} deleteEnvironment onSuccess: Invalidating queries`);
      queryClient.invalidateQueries({ queryKey: ['environments'] });
      showSuccess('Environment deleted successfully!');
    },
    onError: (error: any) => {
      console.error(`${LOG_PREFIX} deleteEnvironment onError:`, error.message);
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