import { useState, useEffect, useMemo, useContext, createContext } from 'react';
import { TaskEnvironment } from '@/types/scheduler';
import { Home, Laptop, Globe, Music, Check } from 'lucide-react'; // Keep imports for type definition, but actual components will be dynamic

export interface EnvironmentOption {
  value: TaskEnvironment;
  label: string;
  icon: React.ElementType;
}

// This array will now be populated dynamically by EnvironmentProvider
export const environmentOptions: EnvironmentOption[] = []; 

export interface EnvironmentContextType {
  selectedEnvironments: TaskEnvironment[];
  toggleEnvironmentSelection: (env: TaskEnvironment) => void;
  setSelectedEnvironments: (envs: TaskEnvironment[]) => void;
  environmentOptions: EnvironmentOption[]; // This will be dynamic
}

export const EnvironmentContext = createContext<EnvironmentContextType | undefined>(undefined);

export const useEnvironmentContext = () => {
  const context = useContext(EnvironmentContext);
  if (context === undefined) {
    throw new Error('useEnvironmentContext must be used within an EnvironmentProvider');
  }
  return context;
};