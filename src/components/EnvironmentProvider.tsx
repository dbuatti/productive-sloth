"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { TaskEnvironment } from '@/types/scheduler';
import { EnvironmentContext, EnvironmentContextType, EnvironmentOption } from '@/hooks/use-environment-context';
import { useEnvironments } from '@/hooks/use-environments';

const EnvironmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { environments, isLoading } = useEnvironments();
  const [selectedEnvironments, setSelectedEnvironments] = useState<TaskEnvironment[]>([]);

  // Initialize from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedEnv = localStorage.getItem('aetherflow-environments');
        if (savedEnv) {
          const parsed = JSON.parse(savedEnv);
          if (Array.isArray(parsed)) {
            setSelectedEnvironments(parsed as TaskEnvironment[]);
          }
        }
      } catch (e) {
        console.error("Failed to parse stored environments:", e);
      }
    }
  }, []);

  // Persist to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && !isLoading) {
      localStorage.setItem('aetherflow-environments', JSON.stringify(selectedEnvironments));
    }
  }, [selectedEnvironments, isLoading]);

  const toggleEnvironmentSelection = (env: TaskEnvironment) => {
    setSelectedEnvironments(prev => {
      if (prev.includes(env)) {
        return prev.filter(e => e !== env);
      } else {
        return [...prev, env];
      }
    });
  };

  // Map database environments to EnvironmentOption format
  const environmentOptions = useMemo((): EnvironmentOption[] => {
    return environments.map(env => ({
      value: env.value,
      label: env.label,
      icon: env.icon
    }));
  }, [environments]);

  const value: EnvironmentContextType = {
    selectedEnvironments,
    toggleEnvironmentSelection,
    setSelectedEnvironments,
    environmentOptions,
    isLoading
  };

  return (
    <EnvironmentContext.Provider value={value}>
      {children}
    </EnvironmentContext.Provider>
  );
};

export default EnvironmentProvider;