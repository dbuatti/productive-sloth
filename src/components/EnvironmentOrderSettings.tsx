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

const EnvironmentOrderSettings: React.FC = () => {
  const { profile, updateProfile } = useSession();
  const { environments, isLoading: isLoadingEnvironments } = useEnvironments();

  // Filter and map the custom order to actual environment objects
  const orderedEnvironments = useMemo(() => {
    if (!profile || !environments) return [];
    const customOrderValues = new Set(profile.custom_environment_order || []);
    
    const orderedById: typeof environments = [];
    const seenIds = new Set<string>();

    // 1. Add environments based on custom order, ensuring uniqueness by ID
    (profile.custom_environment_order || []).forEach(envValue => {
      const env = environments.find(e => e.value === envValue);
      if (env && !seenIds.has(env.id)) {
        orderedById.push(env);
        seenIds.add(env.id);
      }
    });

    // 2. Add any remaining environments that were not in custom_environment_order, ensuring uniqueness by ID
    environments.forEach(env => {
      if (!seenIds.has(env.id)) {
        orderedById.push(env);
        seenIds.add(env.id);
      }
    });

    console.log(`${LOG_PREFIX} Final ordered environments:`, orderedById.map(e => e.value));
    return orderedById;
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
          const IconComponent = getIconComponent(env.icon); // Use the centralized helper
          if (!IconComponent) return null; // Fallback if icon not found

          return (
            <div 
              key={env.id} // Use env.id for unique key
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