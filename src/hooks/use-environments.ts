import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from './use-session';
import { showSuccess, showError } from '@/utils/toast';
import React from 'react'; // Import React for React.ElementType

export interface Environment {
  id: string;
  user_id: string;
  label: string;
  value: string;
  icon: React.ElementType; // Changed from string to React.ElementType
  color: string;
  is_default: boolean;
  drain_multiplier: number;
  created_at: string;
  updated_at: string;
}

export interface NewEnvironment {
  label: string;
  value: string;
  icon: React.ElementType; // Changed from string to React.ElementType
  color: string;
  is_default?: boolean;
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
      
      const { data, error } = await supabase
        .from('environments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      
      if (error) throw new Error(error.message);
      return data as Environment[];
    },
    enabled: !!userId,
  });

  const addEnvironment = useMutation({
    mutationFn: async (newEnvironment: NewEnvironment) => {
      if (!userId) throw new Error("User not authenticated.");
      
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
      
      if (error) throw new Error(error.message);
      return data as Environment;
    },
    onSuccess: () => {
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
      
      // Allow updating is_default status
      const { data, error } = await supabase
        .from('environments')
        .update({ ...environment, updated_at: new Date().toISOString() })
        .eq('id', environment.id)
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) throw new Error(error.message);
      return data as Environment;
    },
    onSuccess: () => {
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
      
      // The check for `is_default` is now removed here, as the UI will control it.
      // If `is_default` is set to false, it can be deleted.
      const { error } = await supabase
        .from('environments')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
      
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
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