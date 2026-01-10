"use client";

import { useState, useEffect, useMemo, useContext, createContext } from 'react';
import { TaskEnvironment } from '@/types/scheduler';
import { Environment, useEnvironments } from './use-environments'; // Import Environment and useEnvironments
import { Loader2 } from 'lucide-react'; // Import Loader2 for loading state

export interface EnvironmentOption {
  value: TaskEnvironment;
  label: string;
  icon: string;
}

// Removed hardcoded environmentOptions

export interface EnvironmentContextType {
  selectedEnvironments: TaskEnvironment[];
  toggleEnvironmentSelection: (env: TaskEnvironment) => void;
  setSelectedEnvironments: (envs: TaskEnvironment[]) => void;
  allUserEnvironments: Environment[]; // Now dynamic
  isLoadingEnvironments: boolean; // Add loading state
}

export const EnvironmentContext = createContext<EnvironmentContextType | undefined>(undefined);

export const useEnvironmentContext = () => {
  const context = useContext(EnvironmentContext);
  if (context === undefined) {
    throw new Error('useEnvironmentContext must be used within an EnvironmentProvider');
  }
  return context;
};

// The EnvironmentProvider component
const EnvironmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { environments: allUserEnvironments, isLoading: isLoadingEnvironments } = useEnvironments(); // Fetch environments dynamically

  const [selectedEnvironments, setSelectedEnvironments] = useState<TaskEnvironment[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedEnv = localStorage.getItem('aetherflow-environments');
        if (savedEnv) {
          const parsed = JSON.parse(savedEnv);
          // Basic validation to ensure it's an array of strings
          if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
            return parsed as TaskEnvironment[];
          }
        }
      } catch (e) {
        // console.error("Failed to parse stored environments:", e);
      }
    }
    return []; // Default to NO environment selected
  });

  // Filter out any selected environments that no longer exist in allUserEnvironments
  // This ensures consistency if environments are deleted by the user
  useEffect(() => {
    if (!isLoadingEnvironments && allUserEnvironments.length > 0) {
      const validEnvironmentValues = allUserEnvironments.map(env => env.value);
      setSelectedEnvironments(prev => prev.filter(env => validEnvironmentValues.includes(env)));
    }
  }, [allUserEnvironments, isLoadingEnvironments]);


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

  const value: EnvironmentContextType = {
    selectedEnvironments,
    toggleEnvironmentSelection,
    setSelectedEnvironments,
    allUserEnvironments, // Provide dynamic environments
    isLoadingEnvironments, // Provide loading state
  };

  return (
    <EnvironmentContext.Provider value={value}>
      {children}
    </EnvironmentContext.Provider>
  );
};

export default EnvironmentProvider;