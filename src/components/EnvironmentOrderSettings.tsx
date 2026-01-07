import React, { useMemo } from 'react';
import { TaskEnvironment } from '@/types/scheduler';
import { useSession } from '@/hooks/use-session';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown, ListOrdered, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { showSuccess, showError } from '@/utils/toast';
import { useEnvironments } from '@/hooks/use-environments';
import { getIconComponent } from '@/context/EnvironmentContext.ts';

const LOG_PREFIX = "[ENVIRONMENT_ORDER_SETTINGS]";

// Helper to get icon component from environment value
const getEnvironmentIconComponent = (value: string, environments: any[]) => {
  const env = environments.find(opt => opt.value === value);
  return env ? getIconComponent(env.icon) : null;
};

const EnvironmentOrderSettings: React.FC = () => {
  const { profile, updateProfile } = useSession();
  const { environments, isLoading: isLoadingEnvironments } = useEnvironments();

  // Filter and map the custom order to actual environment objects
  const orderedEnvironments = useMemo(() => {
    if (!profile || !environments) return [];
    const customOrder = profile.custom_environment_order || [];
    console.log(`${LOG_PREFIX} Computing ordered environments. Custom order:`, customOrder);
    
    // Create a map for quick lookup of environment objects by their 'value'
    const envMap = new Map(environments.map(env => [env.value, env]));

    // Filter customOrder to only include environments that actually exist for the user
    // Then map them to their full object representation
    const ordered = customOrder
      .map(envValue => envMap.get(envValue))
      .filter((env): env is typeof environments[0] => env !== undefined); // Type guard for non-null/undefined

    // Add any environments that are present in the user's list but not in the custom order
    // This ensures all user environments are always displayed and can be ordered
    const existingEnvValues = new Set(ordered.map(env => env.value));
    environments.forEach(env => {
      if (!existingEnvValues.has(env.value)) {
        ordered.push(env);
      }
    });

    console.log(`${LOG_PREFIX} Final ordered environments:`, ordered.map(e => e.value));
    return ordered;
  }, [profile, environments]);

  const moveItem = async (index: number, direction: 'up' | 'down') => {
    if (isLoadingEnvironments) return;

    const newOrder = [...orderedEnvironments.map(env => env.value)]; // Use 'value' strings for the order
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;

    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];

    console.log(`${LOG_PREFIX} Moving item at index ${index} ${direction}. New order:`, newOrder);

    try {
      // Cast newOrder to TaskEnvironment[] to resolve the TypeScript error
      await updateProfile({ custom_environment_order: newOrder as TaskEnvironment[] });
      showSuccess("Environment order updated.");
    } catch (e) {
      showError("Failed to update environment order.");
      console.error(`${LOG_PREFIX} Error updating environment order:`, e);
    }
  };

  if (isLoadingEnvironments) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-base font-semibold text-foreground">
        <ListOrdered className="h-4 w-4 text-primary" /> Environment Priority Sequence
      </div>
      <p className="text-sm text-muted-foreground">
        Define the order in which environments are prioritized during an "Environment Ratio" auto-balance.
      </p>

      <div className="space-y-2">
        {orderedEnvironments.map((env, index) => {
          const IconComponent = getEnvironmentIconComponent(env.value, environments);
          if (!IconComponent) return null; // Fallback if icon not found

          return (
            <div 
              key={env.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-secondary/30 transition-all hover:bg-secondary/50"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold font-mono opacity-30">0{index + 1}</span>
                <IconComponent className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold uppercase tracking-tight">{env.label}</span>
              </div>
              
              <div className="flex items-center gap-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8" 
                  onClick={() => moveItem(index, 'up')}
                  disabled={index === 0}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8" 
                  onClick={() => moveItem(index, 'down')}
                  disabled={index === orderedEnvironments.length - 1}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EnvironmentOrderSettings;