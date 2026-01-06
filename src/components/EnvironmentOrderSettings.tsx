import React from 'react';
import { TaskEnvironment } from '@/types/scheduler';
import { useSession } from '@/hooks/use-session';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown, ListOrdered, Home } from 'lucide-react'; // Import Home
import { useEnvironmentContext } from '@/hooks/use-environment-context'; // Updated import
import { cn } from '@/lib/utils';
import { showSuccess } from '@/utils/toast';

const EnvironmentOrderSettings: React.FC = () => {
  const { profile, updateProfile } = useSession();
  const { environmentOptions } = useEnvironmentContext(); // Use environmentOptions from context
  
  // Filter for only default environments for ordering, as custom ones are managed separately
  const defaultEnvironmentKeys = environmentOptions.filter(opt => !opt.isCustom).map(opt => opt.value);

  // Ensure currentOrder only contains valid default environment keys
  const currentOrder = profile?.custom_environment_order?.filter(key => defaultEnvironmentKeys.includes(key)) || defaultEnvironmentKeys;

  const moveItem = async (index: number, direction: 'up' | 'down') => {
    const newOrder = [...currentOrder];
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-base font-semibold text-foreground">
        <ListOrdered className="h-4 w-4 text-primary" /> Default Environment Priority Sequence
      </div>
      <p className="text-sm text-muted-foreground">
        Define the order in which default environments are prioritized during an "Environment Ratio" auto-balance.
        Custom environments are managed separately.
      </p>

      <div className="space-y-2">
        {currentOrder.map((envKey, index) => {
          const option = environmentOptions.find(opt => opt.value === envKey);
          if (!option) return null; // Should not happen with filtering

          return (
            <div 
              key={envKey} 
              className="flex items-center justify-between p-3 rounded-lg border bg-secondary/30 transition-all hover:bg-secondary/50"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold font-mono opacity-30">0{index + 1}</span>
                <option.icon className="h-4 w-4 text-primary" />
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