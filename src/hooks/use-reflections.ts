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
    console.log(`[useReflections] Fetching reflections for user: ${userId}, date: ${reflectionDate || 'all'}`);
    let query = supabase
      .from('reflections')
      .select('*')
      .eq('user_id', userId);

    if (reflectionDate) {
      query = query.eq('reflection_date', reflectionDate);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[useReflections] Error fetching reflections:", error);
      throw new Error(error.message);
    }
    console.log(`[useReflections] Fetched ${data.length} reflections.`);
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
      console.log("[useReflections] Adding new reflection for date:", newReflection.reflection_date);
      const reflectionToInsert = { ...newReflection, user_id: userId };
      const { data, error } = await supabase.from('reflections').insert(reflectionToInsert).select().single();
      if (error) {
        console.error("[useReflections] Error adding reflection:", error);
        throw new Error(error.message);
      }
      console.log("[useReflections] Reflection added successfully:", data.id);
      return data as Reflection;
    },
    onSuccess: () => {
      console.log("[useReflections] Invalidate queries after addReflection.");
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
      console.log("[useReflections] Updating reflection:", updatedReflection.id, "for date:", updatedReflection.reflection_date);
      const { data, error } = await supabase
        .from('reflections')
        .update(updatedReflection)
        .eq('id', updatedReflection.id)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) {
        console.error("[useReflections] Error updating reflection:", error);
        throw new Error(error.message);
      }
      console.log("[useReflections] Reflection updated successfully:", data.id);
      return data as Reflection;
    },
    onSuccess: () => {
      console.log("[useReflections] Invalidate queries after updateReflection.");
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
      console.log("[useReflections] Deleting reflection:", id);
      const { error } = await supabase.from('reflections').delete().eq('id', id).eq('user_id', userId);
      if (error) {
        console.error("[useReflections] Error deleting reflection:", error);
        throw new Error(error.message);
      }
      console.log("[useReflections] Reflection deleted successfully:", id);
    },
    onSuccess: () => {
      console.log("[useReflections] Invalidate queries after deleteReflection.");
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