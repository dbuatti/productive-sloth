"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { TaskEnvironment } from '@/types/scheduler';
import { EnvironmentContext, EnvironmentContextType, EnvironmentOption } from '@/hooks/use-environment-context';
import { useUserEnvironments } from '@/hooks/use-user-environments'; // NEW: Import useUserEnvironments
import { getLucideIcon } from '@/lib/icons'; // NEW: Import getLucideIcon

const EnvironmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { environments, isLoading: isLoadingEnvironments } = useUserEnvironments();

  // Dynamically create environmentOptions from fetched user environments
  const environmentOptions: EnvironmentOption[] = useMemo(() => {
    return environments.map(env => {
      const Icon = getLucideIcon(env.icon_name);
      return {
        value: env.id as TaskEnvironment, // Use environment ID as the value
        label: env.name,
        icon: Icon || Home, // Fallback to Home icon if not found
        originalEnvId: env.id,
      };
    });
  }, [environments]);

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
    return []; // Default to NO environment selected
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('aetherflow-environments', JSON.stringify(selectedEnvironments));
    }
  }, [selectedEnvironments]);

  const toggleEnvironmentSelection = (envId: TaskEnvironment) => {
    setSelectedEnvironments(prev => {
      if (prev.includes(envId)) {
        return prev.filter(e => e !== envId);
      } else {
        return [...prev, envId];
      }
    });
  };

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