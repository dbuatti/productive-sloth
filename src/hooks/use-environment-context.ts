import { useState, useEffect, useMemo, useContext, createContext } from 'react';
import { TaskEnvironment } from '@/types/scheduler';
import { Home, Laptop, Globe, Music } from 'lucide-react';

export interface EnvironmentContextType {
  currentEnvironment: TaskEnvironment;
  currentEnvironmentDetails: { value: TaskEnvironment, label: string, icon: React.ElementType };
  toggleEnvironment: () => void;
  setCurrentEnvironment: (env: TaskEnvironment) => void;
  environmentOptions: { value: TaskEnvironment, label: string, icon: React.ElementType }[];
}

export const EnvironmentContext = createContext<EnvironmentContextType | undefined>(undefined);

export const useEnvironmentContext = () => {
  const context = useContext(EnvironmentContext);
  if (context === undefined) {
    throw new Error('useEnvironmentContext must be used within an EnvironmentProvider');
  }
  return context;
};

export const environmentOptions: { value: TaskEnvironment, label: string, icon: React.ElementType }[] = [
  { value: 'home', label: '🏠 At Home', icon: Home },
  { value: 'laptop', label: '💻 Laptop/Desk', icon: Laptop },
  { value: 'away', label: '🗺️ Away/Errands', icon: Globe },
  { value: 'piano', label: '🎹 Piano Practice', icon: Music },
  { value: 'laptop_piano', label: '💻 + 🎹 Recording/Production', icon: Laptop },
];

// Removed state management logic from here.