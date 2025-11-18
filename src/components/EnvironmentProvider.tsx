"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { TaskEnvironment } from '@/types/scheduler';
import { EnvironmentContext, environmentOptions, EnvironmentContextType } from '@/hooks/use-environment-context';

const EnvironmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentEnvironment, setCurrentEnvironment] = useState<TaskEnvironment>(() => {
    if (typeof window !== 'undefined') {
      const savedEnv = localStorage.getItem('aetherflow-environment') as TaskEnvironment;
      const validEnvironments: TaskEnvironment[] = ['home', 'laptop', 'away', 'piano', 'laptop_piano'];
      return validEnvironments.includes(savedEnv) ? savedEnv : 'laptop';
    }
    return 'laptop';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('aetherflow-environment', currentEnvironment);
    }
  }, [currentEnvironment]);

  const toggleEnvironment = () => {
    setCurrentEnvironment(prev => {
      switch (prev) {
        case 'home':
          return 'laptop';
        case 'laptop':
          return 'away';
        case 'away':
          return 'piano';
        case 'piano':
          return 'laptop_piano';
        case 'laptop_piano':
          return 'home';
        default:
          return 'laptop';
      }
    });
  };

  const currentEnvironmentDetails = useMemo(() => {
    return environmentOptions.find(opt => opt.value === currentEnvironment) || environmentOptions[1];
  }, [currentEnvironment]);

  const value: EnvironmentContextType = {
    currentEnvironment,
    currentEnvironmentDetails,
    toggleEnvironment,
    setCurrentEnvironment,
    environmentOptions,
  };

  return (
    <EnvironmentContext.Provider value={value}>
      {children}
    </EnvironmentContext.Provider>
  );
};

export default EnvironmentProvider;