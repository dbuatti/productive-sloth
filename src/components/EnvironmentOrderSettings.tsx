import React from 'react';
import { TaskEnvironment } from '@/types/scheduler';
import { useSession } from '@/hooks/use-session';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown, ListOrdered } from 'lucide-react';
import { useEnvironments } from '@/hooks/use-environments';
import { showSuccess } from '@/utils/toast';
import { getLucideIconComponent } from '@/lib/utils'; // Import getLucideIconComponent

const DEFAULT_ORDER: TaskEnvironment[] = ['home', 'laptop', 'away', 'piano', 'laptop_piano'];

const EnvironmentOrderSettings: React.FC = () => {
  const { profile, updateProfile } = useSession();
  const { environments, isLoading } = useEnvironments();
  
  // Use profile order if it exists, otherwise default, but ensure it includes all available environments
  const currentOrder = profile?.custom_environment_order || DEFAULT_ORDER;
  
  // Filter out any environments from currentOrder that don't exist in the user's environments
  // and append any missing environments from the user's list to the end
  const validEnvironments = environments.map(e => e.value);
  const filteredOrder = currentOrder.filter(env => validEnvironments.includes(env));
  const missingEnvironments = validEnvironments.filter(env => !filteredOrder.includes(env));
  const finalOrder = [...filteredOrder, ...missingEnvironments];

  const moveItem = async (index: number, direction: 'up' | 'down') => {
    const newOrder = [...finalOrder];
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

  if (isLoading) return <div>Loading environments...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-base font-semibold text-foreground">
        <ListOrdered className="h-4 w-4 text-primary" /> Environment Priority Sequence
      </div>
      <p className="text-sm text-muted-foreground">
        Define the order in which environments are prioritized during an "Environment Ratio" auto-balance.
      </p>

      <div className="space-y-2">
        {finalOrder.map((envKey, index) => {
          const option = environments.find(opt => opt.value === envKey);
          if (!option) return null;

          // Get the actual Lucide icon component using the shared utility
          const IconComponent = getLucideIconComponent(option.icon);

          return (
            <div 
              key={envKey} 
              className="flex items-center justify-between p-3 rounded-lg border bg-secondary/30 transition-all hover:bg-secondary/50"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold font-mono opacity-30">{index + 1}</span>
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
                  disabled={index === finalOrder.length - 1}
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