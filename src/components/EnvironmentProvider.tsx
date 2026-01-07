"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { TaskEnvironment } from '@/types/scheduler';
import { EnvironmentContext, EnvironmentContextType, EnvironmentOption, getIconComponent } from '@/context/EnvironmentContext.ts';
import { useEnvironments } from '@/hooks/use-environments';

const LOG_PREFIX = "[ENVIRONMENT_PROVIDER]";

const EnvironmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { environments, isLoading: isLoadingEnvironments } = useEnvironments();
  
  const [selectedEnvironments, setSelectedEnvironments] = useState<TaskEnvironment[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedEnv = localStorage.getItem('aetherflow-environments');
        if (savedEnv) {
          const parsed = JSON.parse(savedEnv);
          // Basic validation to ensure it's an array of strings
          if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
            console.log(`${LOG_PREFIX} Loaded saved environments from localStorage:`, parsed);
            return parsed as TaskEnvironment[];
          }
        }
      } catch (e) {
        console.error(`${LOG_PREFIX} Failed to parse stored environments:`, e);
      }
    }
    console.log(`${LOG_PREFIX} No saved environments found, defaulting to empty array`);
    return []; // Default to NO environment selected
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('aetherflow-environments', JSON.stringify(selectedEnvironments));
      console.log(`${LOG_PREFIX} Saved environments to localStorage:`, selectedEnvironments);
    }
  }, [selectedEnvironments]);

  // Memoize toggleEnvironmentSelection
  const toggleEnvironmentSelection = useCallback((env: TaskEnvironment) => {
    console.log(`${LOG_PREFIX} Toggling environment selection:`, env);
    setSelectedEnvironments(prev => {
      if (prev.includes(env)) {
        const newSelection = prev.filter(e => e !== env);
        console.log(`${LOG_PREFIX} Environment removed, new selection:`, newSelection);
        return newSelection;
      } else {
        const newSelection = [...prev, env];
        console.log(`${LOG_PREFIX} Environment added, new selection:`, newSelection);
        return newSelection;
      }
    });
  }, []); // No dependencies needed as setSelectedEnvironments is stable

  const environmentOptions: EnvironmentOption[] = useMemo(() => {
    const options = environments.map(env => ({
      id: env.id, // Add id here
      value: env.value as TaskEnvironment,
      label: env.label,
      icon: getIconComponent(env.icon),
      color: env.color,
    }));
    console.log(`${LOG_PREFIX} Computed environment options:`, options);
    return options;
  }, [environments]);

  // Memoize the context value
  const value: EnvironmentContextType = useMemo(() => ({
    selectedEnvironments,
    toggleEnvironmentSelection,
    setSelectedEnvironments, // useState setter is stable
    environmentOptions,
    isLoadingEnvironments,
  }), [selectedEnvironments, toggleEnvironmentSelection, setSelectedEnvironments, environmentOptions, isLoadingEnvironments]);

  console.log(`${LOG_PREFIX} Rendering provider with state:`, { selectedEnvironments, optionCount: environmentOptions.length, isLoadingEnvironments });

  return (
    <EnvironmentContext.Provider value={value}>
      {children}
    </EnvironmentContext.Provider>
  );
};

export default EnvironmentProvider;