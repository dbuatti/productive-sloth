import { useState, useEffect, useMemo, useContext, createContext } from 'react';
import { TaskEnvironment } from '@/types/scheduler';
import { Home, Laptop, Globe, Music, Check } from 'lucide-react';
import { useUserEnvironments, UserEnvironment } from './use-user-environments'; // NEW: Import useUserEnvironments
import { getLucideIcon } from '@/lib/icons'; // NEW: Import getLucideIcon

export interface EnvironmentOption {
  value: TaskEnvironment; // This will now be the ID of the user environment
  label: string;
  icon: React.ElementType;
  originalEnvId: string; // NEW: Store the actual ID from the DB
}

// Removed hardcoded environmentOptions, now generated dynamically

export interface EnvironmentContextType {
  selectedEnvironments: TaskEnvironment[];
  toggleEnvironmentSelection: (envId: TaskEnvironment) => void; // Changed to accept env ID
  setSelectedEnvironments: (envIds: TaskEnvironment[]) => void; // Changed to accept env IDs
  environmentOptions: EnvironmentOption[]; // Now dynamic
  isLoadingEnvironments: boolean; // NEW: Loading state for environments
}

export const EnvironmentContext = createContext<EnvironmentContextType | undefined>(undefined);

export const useEnvironmentContext = () => {
  const context = useContext(EnvironmentContext);
  if (context === undefined) {
    throw new Error('useEnvironmentContext must be used within an EnvironmentProvider');
  }
  return context;
};