import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from './use-session';
import { showSuccess, showError } from '@/utils/toast';

export interface MealIdea {
  id: string;
  user_id: string;
  name: string;
  difficulty_rating: number;
  has_ingredients: boolean;
  created_at: string;
}

export interface MealAssignment {
  id: string;
  user_id: string;
  meal_idea_id: string;
  assigned_date: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner';
  meal_idea?: MealIdea;
}

export const useMeals = (selectedDate?: string) => {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const userId = user?.id;

  const { data: mealIdeas = [], isLoading: isLoadingIdeas } = useQuery<MealIdea[]>({
    queryKey: ['mealIdeas', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('meal_ideas')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return data as MealIdea[];
    },
    enabled: !!userId,
  });

  const { data: assignments = [], isLoading: isLoadingAssignments } = useQuery<MealAssignment[]>({
    queryKey: ['mealAssignments', userId, selectedDate],
    queryFn: async () => {
      if (!userId) return [];
      let query = supabase
        .from('meal_assignments')
        .select('*, meal_idea:meal_ideas(*)');
      
      if (selectedDate) {
        query = query.eq('assigned_date', selectedDate);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as MealAssignment[];
    },
    enabled: !!userId,
  });

  const addIdea = useMutation({
    mutationFn: async (newIdea: Partial<MealIdea>) => {
      const { data, error } = await supabase
        .from('meal_ideas')
        .insert([{ ...newIdea, user_id: userId }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mealIdeas'] });
      showSuccess("Meal idea added!");
    },
  });

  const updateIdea = useMutation({
    mutationFn: async (updatedIdea: Partial<MealIdea> & { id: string }) => {
      const { data, error } = await supabase
        .from('meal_ideas')
        .update(updatedIdea)
        .eq('id', updatedIdea.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mealIdeas'] });
      queryClient.invalidateQueries({ queryKey: ['mealAssignments'] });
    },
  });

  const deleteIdea = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('meal_ideas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mealIdeas'] });
      queryClient.invalidateQueries({ queryKey: ['mealAssignments'] });
      showSuccess("Meal idea removed.");
    },
  });

  const assignMeal = useMutation({
    mutationFn: async (assignment: { meal_idea_id: string, assigned_date: string, meal_type: string }) => {
      const { data, error } = await supabase
        .from('meal_assignments')
        .upsert([{ ...assignment, user_id: userId }], { onConflict: 'user_id, assigned_date, meal_type' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mealAssignments'] });
      queryClient.invalidateQueries({ queryKey: ['weeklyScheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday'] });
      showSuccess("Meal assigned to schedule!");
    },
  });

  const removeAssignment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('meal_assignments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mealAssignments'] });
      queryClient.invalidateQueries({ queryKey: ['weeklyScheduledTasks'] });
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday'] });
    },
  });

  return {
    mealIdeas,
    assignments,
    isLoading: isLoadingIdeas || isLoadingAssignments,
    addIdea: addIdea.mutate,
    updateIdea: updateIdea.mutate,
    deleteIdea: deleteIdea.mutate,
    assignMeal: assignMeal.mutate,
    removeAssignment: removeAssignment.mutate,
  };
};