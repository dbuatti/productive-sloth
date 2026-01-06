import { useState, useEffect, useMemo, useContext, createContext } from 'react';
import { TaskEnvironment } from '@/types/scheduler';
import { Home, Laptop, Globe, Music, Check, LucideIcon } from 'lucide-react';
import { Environment } from '@/hooks/use-environments'; // Only import type

// Helper to map string icon name to Lucide icon component
export const getIconComponent = (iconName: string): LucideIcon => {
  switch (iconName) {
    case 'Home': return Home;
    case 'Laptop': return Laptop;
    case 'Globe': return Globe;
    case 'Music': return Music;
    default: return Home; // Fallback
  }
};

export interface EnvironmentOption {
  value: TaskEnvironment;
  label: string;
  icon: LucideIcon;
  color: string;
}

export interface EnvironmentContextType {
  selectedEnvironments: TaskEnvironment[];
  toggleEnvironmentSelection: (env: TaskEnvironment) => void;
  setSelectedEnvironments: (envs: TaskEnvironment[]) => void;
  environmentOptions: EnvironmentOption[];
  isLoadingEnvironments: boolean;
}

export const EnvironmentContext = createContext<EnvironmentContextType | undefined>(undefined);

export const useEnvironmentContext = () => {
  const context = useContext(EnvironmentContext);
  if (context === undefined) {
    throw new Error('useEnvironmentContext must be used within an EnvironmentProvider');
  }
  return context;
};