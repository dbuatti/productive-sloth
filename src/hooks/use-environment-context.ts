import { useState, useEffect, useMemo, useContext, createContext } from 'react';
import { TaskEnvironment } from '@/types/scheduler';
import { Home, Laptop, Globe, Music, Check } from 'lucide-react';

export interface EnvironmentOption {
  value: TaskEnvironment;
  label: string;
  icon: string; // Changed to string
}

export const environmentOptions: EnvironmentOption[] = [
  { value: 'home', label: '🏠 At Home', icon: 'Home' }, // Use string name
  { value: 'laptop', label: '💻 Laptop/Desk', icon: 'Laptop' }, // Use string name
  { value: 'away', label: '🗺️ Away/Errands', icon: 'Globe' }, // Use string name
  { value: 'piano', label: '🎹 Piano Practice', icon: 'Music' }, // Use string name
  { value: 'laptop_piano', label: '💻 + 🎹 Recording/Production', icon: 'Laptop' }, // Use string name
];

export interface EnvironmentContextType {
  selectedEnvironments: TaskEnvironment[];
  toggleEnvironmentSelection: (env: TaskEnvironment) => void;
  setSelectedEnvironments: (envs: TaskEnvironment[]) => void;
  environmentOptions: EnvironmentOption[];
}

export const EnvironmentContext = createContext<EnvironmentContextType | undefined>(undefined);

export const useEnvironmentContext = () => {
  const context = useContext(EnvironmentContext);
  if (context === undefined) {
    throw new Error('useEnvironmentContext must be used within an EnvironmentProvider');
  }
  return context;
};