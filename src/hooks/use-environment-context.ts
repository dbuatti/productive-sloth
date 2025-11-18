import { useState, useEffect, useMemo } from 'react';
import { TaskEnvironment } from '@/types/scheduler';
import { Home, Laptop, Globe } from 'lucide-react';

export const environmentOptions: { value: TaskEnvironment, label: string, icon: React.ElementType }[] = [
  { value: 'home', label: '🏠 At Home', icon: Home },
  { value: 'laptop', label: '💻 Laptop/Desk', icon: Laptop },
  { value: 'away', label: '🗺️ Away/Errands', icon: Globe },
];

export function useEnvironmentContext() {
  const [currentEnvironment, setCurrentEnvironment] = useState<TaskEnvironment>(() => {
    if (typeof window !== 'undefined') {
      const savedEnv = localStorage.getItem('aetherflow-environment') as TaskEnvironment;
      return savedEnv || 'laptop';
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
          return 'home';
        default:
          return 'laptop';
      }
    });
  };

  const currentEnvironmentDetails = useMemo(() => {
    return environmentOptions.find(opt => opt.value === currentEnvironment) || environmentOptions[1];
  }, [currentEnvironment]);

  return {
    currentEnvironment,
    currentEnvironmentDetails,
    toggleEnvironment,
    setCurrentEnvironment,
    environmentOptions,
  };
}