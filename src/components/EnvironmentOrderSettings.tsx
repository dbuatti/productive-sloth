import React from 'react';
import { TaskEnvironment } from '@/types/scheduler';
import { useSession } from '@/hooks/use-session';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown, ListOrdered, Loader2 } from 'lucide-react'; // NEW: Import Loader2
import { useUserEnvironments } from '@/hooks/use-user-environments';
import { getLucideIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { showSuccess } from '@/utils/toast';

const EnvironmentOrderSettings: React.FC = () => {
  const { environments, isLoading, updateEnvironmentOrder } = useUserEnvironments();

  const moveItem = async (index: number, direction: 'up' | 'down') => {
    const newOrder = [...environments];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;

    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];

    try {
      await updateEnvironmentOrder(newOrder);
      showSuccess("Environment order updated.");
    } catch (e) {
      // Error handled by hook
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-24">
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
        {environments.map((env, index) => {
          const Icon = getLucideIcon(env.icon_name); // Use env.icon_name directly
          if (!Icon) return null;

          return (
            <div 
              key={env.id} 
              className="flex items-center justify-between p-3 rounded-lg border bg-background/50 transition-all hover:bg-secondary/50"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold font-mono opacity-30">0{index + 1}</span>
                <Icon className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold uppercase tracking-tight">{env.name}</span>
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
                  disabled={index === environments.length - 1}
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