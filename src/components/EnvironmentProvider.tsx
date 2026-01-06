"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { TaskEnvironment } from '@/types/scheduler';
import { EnvironmentContext, EnvironmentContextType } from '@/hooks/use-environment-context'; // Keep EnvironmentContextType
import { useEnvironments } from '@/hooks/use-environments'; // Import useEnvironments hook
import { getEnvironmentIconComponent } from '@/lib/scheduler-utils'; // Import the new utility

const EnvironmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { environments, isLoading: isLoadingEnvironments } = useEnvironments(); // Fetch environments dynamically

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

  // Memoize environment options derived from the database
  const dynamicEnvironmentOptions = useMemo(() => {
    if (isLoadingEnvironments) return [];
    return environments.map(env => ({
      value: env.value as TaskEnvironment,
      label: env.label,
      icon: getEnvironmentIconComponent(env.icon), // Use the utility to get the component
    }));
  }, [environments, isLoadingEnvironments]);

  const value: EnvironmentContextType = {
    selectedEnvironments,
    toggleEnvironmentSelection,
    setSelectedEnvironments,
    environmentOptions: dynamicEnvironmentOptions, // Provide dynamic options
  };

  return (
    <EnvironmentContext.Provider value={value}>
      {children}
    </EnvironmentContext.Provider>
  );
};

export default EnvironmentProvider;