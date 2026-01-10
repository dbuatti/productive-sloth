import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from './use-session';
import { showSuccess, showError } from '@/utils/toast';
import { format, parseISO } from 'date-fns';

export interface Reflection {
  id: string;
  user_id: string;
  reflection_date: string; // YYYY-MM-DD
  prompt: string;
  notes: string;
  xp_bonus_awarded: boolean;
  created_at: string;
}

export interface NewReflection {
  reflection_date: string;
  prompt: string;
  notes: string;
  xp_bonus_awarded?: boolean;
}

export const useReflections = (reflectionDate?: string) => {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const userId = user?.id;

  const queryKey = ['reflections', userId, reflectionDate];

  const fetchReflections = async (): Promise<Reflection[]> => {
    if (!userId) return [];
    let query = supabase
      .from('reflections')
      .select('*')
      .eq('user_id', userId);

    if (reflectionDate) {
      query = query.eq('reflection_date', reflectionDate);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data as Reflection[];
  };

  const { data: reflections = [], isLoading } = useQuery<Reflection[]>({
    queryKey,
    queryFn: fetchReflections,
    enabled: !!userId,
  });

  const addReflectionMutation = useMutation({
    mutationFn: async (newReflection: NewReflection) => {
      if (!userId) throw new Error("User not authenticated.");
      const reflectionToInsert = { ...newReflection, user_id: userId };
      const { data, error } = await supabase.from('reflections').insert(reflectionToInsert).select().single();
      if (error) throw new Error(error.message);
      return data as Reflection;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reflections'] });
      showSuccess('Reflection saved!');
    },
    onError: (e) => {
      showError(`Failed to save reflection: ${e.message}`);
    }
  });

  const updateReflectionMutation = useMutation({
    mutationFn: async (updatedReflection: Partial<Reflection> & { id: string }) => {
      if (!userId) throw new Error("User not authenticated.");
      const { data, error } = await supabase
        .from('reflections')
        .update(updatedReflection)
        .eq('id', updatedReflection.id)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as Reflection;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reflections'] });
      showSuccess('Reflection updated!');
    },
    onError: (e) => {
      showError(`Failed to update reflection: ${e.message}`);
    }
  });

  const deleteReflectionMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error("User not authenticated.");
      const { error } = await supabase.from('reflections').delete().eq('id', id).eq('user_id', userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reflections'] });
      showSuccess('Reflection deleted.');
    },
    onError: (e) => {
      showError(`Failed to delete reflection: ${e.message}`);
    }
  });

  return {
    reflections,
    isLoading,
    addReflection: addReflectionMutation.mutate,
    updateReflection: updateReflectionMutation.mutate,
    deleteReflection: deleteReflectionMutation.mutate,
  };
};