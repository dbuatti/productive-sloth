import { useState, useEffect, useMemo, useContext, createContext } from 'react';
import { TaskEnvironment, UserEnvironment, NewUserEnvironment } from '@/types/scheduler';
import { Home, Laptop, Globe, Music, Check, Icon as LucideIcon, Plus, Edit, Trash2 } from 'lucide-react'; // Import LucideIcon and management icons
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from './use-session';
import { showError, showSuccess } from '@/utils/toast';

// Map of Lucide icon names to components for dynamic rendering
export const lucideIconMap: { [key: string]: React.ElementType } = {
  Home, Laptop, Globe, Music, Check, Plus, Edit, Trash2, // Add other icons as needed
  // Default icons used in the app
  Target: Home, // Example default if not found
  // Add more icons as needed for user environments
  Dumbbell: Home, // Placeholder
  BookOpen: Home, // Placeholder
  Coffee: Home, // Placeholder
  // ...
};

export interface EnvironmentOption {
  value: TaskEnvironment;
  label: string;
  icon: React.ElementType;
  iconName: string; // NEW: Store the icon name string
  isCustom: boolean; // NEW: Flag to identify custom environments
}

// Default hardcoded environments
export const defaultEnvironmentOptions: EnvironmentOption[] = [
  { value: 'home', label: '🏠 At Home', icon: Home, iconName: 'Home', isCustom: false },
  { value: 'laptop', label: '💻 Laptop/Desk', icon: Laptop, iconName: 'Laptop', isCustom: false },
  { value: 'away', label: '🗺️ Away/Errands', icon: Globe, iconName: 'Globe', isCustom: false },
  { value: 'piano', label: '🎹 Piano Practice', icon: Music, iconName: 'Music', isCustom: false },
  { value: 'laptop_piano', label: '💻 + 🎹 Recording/Production', icon: Laptop, iconName: 'Laptop', isCustom: false },
];

export interface EnvironmentContextType {
  selectedEnvironments: TaskEnvironment[];
  toggleEnvironmentSelection: (env: TaskEnvironment) => void;
  setSelectedEnvironments: (envs: TaskEnvironment[]) => void;
  environmentOptions: EnvironmentOption[];
  isLoadingEnvironments: boolean;
  addEnvironment: (newEnv: NewUserEnvironment) => Promise<void>;
  updateEnvironment: (id: string, updates: Partial<NewUserEnvironment>) => Promise<void>;
  deleteEnvironment: (id: string) => Promise<void>;
}

export const EnvironmentContext = createContext<EnvironmentContextType>({
  selectedEnvironments: [],
  toggleEnvironmentSelection: () => {},
  setSelectedEnvironments: () => {},
  environmentOptions: defaultEnvironmentOptions,
  isLoadingEnvironments: false,
  addEnvironment: async () => {},
  updateEnvironment: async () => {},
  deleteEnvironment: async () => {},
});

export const useEnvironmentContext = () => {
  const context = useContext(EnvironmentContext);
  if (context === undefined) {
    throw new Error('useEnvironmentContext must be used within an EnvironmentProvider');
  }
  return context;
};

export const EnvironmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const userId = user?.id;

  const [selectedEnvironments, setSelectedEnvironments] = useState<TaskEnvironment[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedEnv = localStorage.getItem('aetherflow-environments');
        if (savedEnv) {
          const parsed = JSON.parse(savedEnv);
          if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
            return parsed as TaskEnvironment[];
          }
        }
      } catch (e) {
        console.error("Failed to parse stored environments:", e);
      }
    }
    return []; 
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('aetherflow-environments', JSON.stringify(selectedEnvironments));
    }
  }, [selectedEnvironments]);

  const toggleEnvironmentSelection = (env: TaskEnvironment) => {
    setSelectedEnvironments(prev => {
      if (prev.includes(env)) {
        return prev.filter(e => e !== env);
      } else {
        return [...prev, env];
      }
    });
  };

  // --- Fetch User Environments ---
  const fetchUserEnvironments = async (): Promise<UserEnvironment[]> => {
    if (!userId) return [];
    const { data, error } = await supabase
      .from('user_environments')
      .select('*')
      .eq('user_id', userId)
      .order('order_index', { ascending: true })
      .order('name', { ascending: true }); // Secondary sort
    
    if (error) throw new Error(error.message);
    return data as UserEnvironment[];
  };

  const { data: userEnvironments = [], isLoading: isLoadingUserEnvironments } = useQuery<UserEnvironment[]>({
    queryKey: ['userEnvironments', userId],
    queryFn: fetchUserEnvironments,
    enabled: !!userId,
  });

  // --- Combine Default and User Environments ---
  const combinedEnvironmentOptions = useMemo(() => {
    const customOptions: EnvironmentOption[] = userEnvironments.map(env => ({
      value: env.name,
      label: `✨ ${env.name}`,
      icon: lucideIconMap[env.icon_name] || Home,
      iconName: env.icon_name, // Use the stored icon name
      isCustom: true,
    }));
    return [...defaultEnvironmentOptions, ...customOptions];
  }, [userEnvironments]);

  // --- Mutations for User Environments ---
  const addEnvironmentMutation = useMutation({
    mutationFn: async (newEnv: NewUserEnvironment) => {
      if (!userId) throw new Error("User not authenticated.");
      const { data, error } = await supabase
        .from('user_environments')
        .insert([{ ...newEnv, user_id: userId }])
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userEnvironments'] });
      showSuccess("Custom environment added!");
    },
    onError: (e) => {
      showError(`Failed to add environment: ${e.message}`);
    }
  });

  const updateEnvironmentMutation = useMutation({
    mutationFn: async (payload: { id: string, updates: Partial<NewUserEnvironment> }) => {
      if (!userId) throw new Error("User not authenticated.");
      const { data, error } = await supabase
        .from('user_environments')
        .update(payload.updates)
        .eq('id', payload.id)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userEnvironments'] });
      showSuccess("Environment updated!");
    },
    onError: (e) => {
      showError(`Failed to update environment: ${e.message}`);
    }
  });

  const deleteEnvironmentMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error("User not authenticated.");
      const { error } = await supabase
        .from('user_environments')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userEnvironments'] });
      showSuccess("Environment deleted!");
    },
    onError: (e) => {
      showError(`Failed to delete environment: ${e.message}`);
    }
  });

  const value: EnvironmentContextType = {
    selectedEnvironments,
    toggleEnvironmentSelection,
    setSelectedEnvironments,
    environmentOptions: combinedEnvironmentOptions,
    isLoadingEnvironments: isLoadingUserEnvironments,
    addEnvironment: addEnvironmentMutation.mutateAsync,
    updateEnvironment: (id, updates) => updateEnvironmentMutation.mutateAsync({ id, updates }),
    deleteEnvironment: deleteEnvironmentMutation.mutateAsync,
  };

  return (
    <EnvironmentContext.Provider value={value}>
      {children}
    </EnvironmentContext.Provider>
  );
};