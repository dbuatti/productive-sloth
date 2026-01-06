import React, { useState, useMemo } from 'react';
import { TaskEnvironment } from '@/types/scheduler';
import { useSession } from '@/hooks/use-session';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown, ListOrdered } from 'lucide-react';
import { cn } from '@/lib/utils';
import { showSuccess } from '@/utils/toast';
import { useEnvironments } from '@/hooks/use-environments'; // Import useEnvironments
import { getEnvironmentIconComponent } from '@/lib/scheduler-utils'; // Import the new utility

const EnvironmentOrderSettings: React.FC = () => {
  const { profile, updateProfile } = useSession();
  const { environments, isLoading: isLoadingEnvironments } = useEnvironments(); // Fetch environments dynamically

  const currentOrder = useMemo(() => {
    if (profile?.custom_environment_order && profile.custom_environment_order.length > 0) {
      // Filter out any custom environments that no longer exist in the database
      const validCustomOrder = profile.custom_environment_order.filter(envValue => 
        environments.some(env => env.value === envValue)
      );
      // Add any new environments from the database that are not in the custom order, sorted alphabetically
      const newEnvironments = environments
        .filter(env => !validCustomOrder.includes(env.value as TaskEnvironment)) // FIX: Cast env.value to TaskEnvironment
        .map(env => env.value as TaskEnvironment) // FIX: Cast env.value to TaskEnvironment
        .sort((a, b) => {
          const labelA = environments.find(e => e.value === a)?.label || a;
          const labelB = environments.find(e => e.value === b)?.label || b;
          return labelA.localeCompare(labelB);
        });
      return [...validCustomOrder, ...newEnvironments];
    }
    // Fallback to all available environments from the database, sorted by label
    return environments.map(env => env.value as TaskEnvironment).sort((a, b) => { // FIX: Cast env.value to TaskEnvironment
      const labelA = environments.find(e => e.value === a)?.label || a;
      const labelB = environments.find(e => e.value === b)?.label || b;
      return labelA.localeCompare(labelB);
    });
  }, [profile?.custom_environment_order, environments]);

  const moveItem = async (index: number, direction: 'up' | 'down') => {
    const newOrder: TaskEnvironment[] = [...currentOrder]; // FIX: Explicitly type newOrder as TaskEnvironment[]
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;

    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];

    try {
      await updateProfile({ custom_environment_order: newOrder });
      showSuccess("Environment order updated.");
    } catch (e) {
      // Error handled by hook
    }
  };

  if (isLoadingEnvironments) {
    return <div>Loading environments...</div>;
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
        {currentOrder.map((envKey, index) => {
          const option = environments.find(opt => opt.value === envKey);
          if (!option) return null; // Should not happen if logic is correct, but for safety

          const IconComponent = getEnvironmentIconComponent(option.icon);

          return (
            <div 
              key={envKey} 
              className="flex items-center justify-between p-3 rounded-lg border bg-secondary/30 transition-all hover:bg-secondary/50"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold font-mono opacity-30">0{index + 1}</span>
                <IconComponent className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold uppercase tracking-tight">{option.label}</span>
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
                  disabled={index === currentOrder.length - 1}
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