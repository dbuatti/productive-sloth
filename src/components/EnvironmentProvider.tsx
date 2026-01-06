"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { TaskEnvironment } from '@/types/scheduler';
import { EnvironmentContext, EnvironmentContextType, EnvironmentOption, getIconComponent } from '@/hooks/use-environment-context';
import { useEnvironments } from '@/hooks/use-environments';

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

  const environmentOptions: EnvironmentOption[] = useMemo(() => {
    return environments.map(env => ({
      value: env.value as TaskEnvironment,
      label: env.label,
      icon: getIconComponent(env.icon),
      color: env.color,
    }));
  }, [environments]);

  const value: EnvironmentContextType = {
    selectedEnvironments,
    toggleEnvironmentSelection,
    setSelectedEnvironments,
    environmentOptions,
    isLoadingEnvironments,
  };

  return (
    <EnvironmentContext.Provider value={value}>
      {children}
    </EnvironmentContext.Provider>
  );
};

export default EnvironmentProvider;