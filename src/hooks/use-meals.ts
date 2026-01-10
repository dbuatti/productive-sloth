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
      console.log(`[useMeals] Fetching meal ideas for user: ${userId}`);
      const { data, error } = await supabase
        .from('meal_ideas')
        .select('*')
        .order('name', { ascending: true });
      if (error) {
        console.error("[useMeals] Error fetching meal ideas:", error);
        throw error;
      }
      console.log(`[useMeals] Fetched ${data.length} meal ideas.`);
      return data as MealIdea[];
    },
    enabled: !!userId,
  });

  const { data: assignments = [], isLoading: isLoadingAssignments } = useQuery<MealAssignment[]>({
    queryKey: ['mealAssignments', userId, selectedDate],
    queryFn: async () => {
      if (!userId) return [];
      console.log(`[useMeals] Fetching meal assignments for user: ${userId}, date: ${selectedDate || 'all'}`);
      let query = supabase
        .from('meal_assignments')
        .select('*, meal_idea:meal_ideas(*)');
      
      if (selectedDate) {
        query = query.eq('assigned_date', selectedDate);
      }
      
      const { data, error } = await query;
      if (error) {
        console.error("[useMeals] Error fetching meal assignments:", error);
        throw error;
      }
      console.log(`[useMeals] Fetched ${data.length} meal assignments.`);
      return data as MealAssignment[];
    },
    enabled: !!userId,
  });

  const addIdea = useMutation({
    mutationFn: async (newIdea: Partial<MealIdea>) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("[useMeals] Adding new meal idea:", newIdea.name);
      const { data, error } = await supabase
        .from('meal_ideas')
        .insert([{ ...newIdea, user_id: userId }])
        .select()
        .single();
      if (error) {
        console.error("[useMeals] Error adding meal idea:", error);
        throw error;
      }
      console.log("[useMeals] Meal idea added successfully:", data.name);
      return data;
    },
    onSuccess: () => {
      console.log("[useMeals] Invalidate queries after addIdea.");
      queryClient.invalidateQueries({ queryKey: ['mealIdeas'] });
      showSuccess("Meal idea added!");
    },
    onError: (e) => {
      showError(`Failed to add meal idea: ${e.message}`);
    }
  });

  const updateIdea = useMutation({
    mutationFn: async (updatedIdea: Partial<MealIdea> & { id: string }) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("[useMeals] Updating meal idea:", updatedIdea.id, updatedIdea.name);
      const { data, error } = await supabase
        .from('meal_ideas')
        .update(updatedIdea)
        .eq('id', updatedIdea.id)
        .select()
        .single();
      if (error) {
        console.error("[useMeals] Error updating meal idea:", error);
        throw error;
      }
      console.log("[useMeals] Meal idea updated successfully:", data.name);
      return data;
    },
    onSuccess: () => {
      console.log("[useMeals] Invalidate queries after updateIdea.");
      queryClient.invalidateQueries({ queryKey: ['mealIdeas'] });
      queryClient.invalidateQueries({ queryKey: ['mealAssignments'] });
      showSuccess("Meal idea updated!");
    },
    onError: (e) => {
      showError(`Failed to update meal idea: ${e.message}`);
    }
  });

  const deleteIdea = useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("[useMeals] Deleting meal idea:", id);
      const { error } = await supabase.from('meal_ideas').delete().eq('id', id);
      if (error) {
        console.error("[useMeals] Error deleting meal idea:", error);
        throw error;
      }
      console.log("[useMeals] Meal idea deleted successfully:", id);
    },
    onSuccess: () => {
      console.log("[useMeals] Invalidate queries after deleteIdea.");
      queryClient.invalidateQueries({ queryKey: ['mealIdeas'] });
      queryClient.invalidateQueries({ queryKey: ['mealAssignments'] });
      showSuccess("Meal idea removed.");
    },
    onError: (e) => {
      showError(`Failed to delete meal idea: ${e.message}`);
    }
  });

  const assignMeal = useMutation({
    mutationFn: async (assignment: { meal_idea_id: string, assigned_date: string, meal_type: string }) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("[useMeals] Assigning meal:", assignment.meal_idea_id, "to", assignment.assigned_date, assignment.meal_type);
      const { data, error } = await supabase
        .from('meal_assignments')
        .upsert([{ ...assignment, user_id: userId }], { onConflict: 'user_id, assigned_date, meal_type' })
        .select()
        .single();
      if (error) {
        console.error("[useMeals] Error assigning meal:", error);
        throw error;
      }
      console.log("[useMeals] Meal assigned successfully:", data.id);
      return data;
    },
    onSuccess: () => {
      console.log("[useMeals] Invalidate queries after assignMeal.");
      queryClient.invalidateQueries({ queryKey: ['mealAssignments'] });
      queryClient.invalidateQueries({ queryKey: ['weeklySchedulerTasks'] });
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday'] });
      showSuccess("Meal assigned to schedule!");
    },
    onError: (e) => {
      showError(`Failed to assign meal: ${e.message}`);
    }
  });

  const removeAssignment = useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("[useMeals] Removing meal assignment:", id);
      const { error } = await supabase.from('meal_assignments').delete().eq('id', id);
      if (error) {
        console.error("[useMeals] Error removing meal assignment:", error);
        throw error;
      }
      console.log("[useMeals] Meal assignment removed successfully:", id);
    },
    onSuccess: () => {
      console.log("[useMeals] Invalidate queries after removeAssignment.");
      queryClient.invalidateQueries({ queryKey: ['mealAssignments'] });
      queryClient.invalidateQueries({ queryKey: ['weeklySchedulerTasks'] });
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday'] });
      showSuccess("Meal assignment removed.");
    },
    onError: (e) => {
      showError(`Failed to remove meal assignment: ${e.message}`);
    }
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