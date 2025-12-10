import { useState, useEffect, useMemo, useContext, createContext } from 'react';
import { TaskEnvironment } from '@/types/scheduler';
import { Home, Laptop, Globe, Music, Check } from 'lucide-react';

interface EnvironmentOption {
  value: TaskEnvironment;
  label: string;
  icon: React.ReactNode;
  color: string;
}

interface EnvironmentContextType {
  selectedEnvironments: TaskEnvironment[];
  toggleEnvironment: (environment: TaskEnvironment) => void;
  clearEnvironments: () => void;
  environmentOptions: EnvironmentOption[];
}

const EnvironmentContext = createContext<EnvironmentContextType | undefined>(undefined);

export const useEnvironmentContext = () => {
  const context = useContext(EnvironmentContext);
  if (!context) {
    throw new Error('useEnvironmentContext must be used within an EnvironmentProvider');
  }
  return context;
};

export const environmentOptions: EnvironmentOption[] = [
  {
    value: 'home',
    label: 'Home',
    icon: <Home className="h-4 w-4" />,
    color: 'bg-blue-100 text-blue-800',
  },
  {
    value: 'laptop',
    label: 'Laptop',
    icon: <Laptop className="h-4 w-4" />,
    color: 'bg-green-100 text-green-800',
  },
  {
    value: 'globe',
    label: 'Globe',
    icon: <Globe className="h-4 w-4" />,
    color: 'bg-purple-100 text-purple-800',
  },
  {
    value: 'music',
    label: 'Music',
    icon: <Music className="h-4 w-4" />,
    color: 'bg-yellow-100 text-yellow-800',
  },
  {
    value: 'away',
    label: 'Away',
    icon: <Check className="h-4 w-4" />,
    color: 'bg-gray-100 text-gray-800',
  },
];

export const EnvironmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedEnvironments, setSelectedEnvironments] = useState<TaskEnvironment[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('aetherflow-selected-environments');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.every(env => 
            ['home', 'laptop', 'globe', 'music', 'away'].includes(env))) {
            return parsed;
          }
        } catch {
          return ['laptop'];
        }
      }
    }
    return ['laptop'];
  });

  useEffect(() => {
    localStorage.setItem('aetherflow-selected-environments', JSON.stringify(selectedEnvironments));
  }, [selectedEnvironments]);

  const toggleEnvironment = (environment: TaskEnvironment) => {
    setSelectedEnvironments(prev => 
      prev.includes(environment) 
        ? prev.filter(env => env !== environment) 
        : [...prev, environment]
    );
  };

  const clearEnvironments = () => {
    setSelectedEnvironments([]);
  };

  const value = useMemo(() => ({
    selectedEnvironments,
    toggleEnvironment,
    clearEnvironments,
    environmentOptions,
  }), [selectedEnvironments]);

  return (
    <EnvironmentContext.Provider value={value}>
      {children}
    </EnvironmentContext.Provider>
  );
};