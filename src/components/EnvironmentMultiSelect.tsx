import React from 'react';
import { useEnvironmentContext, environmentOptions } from "@/hooks/use-environment-context";
import { TaskEnvironment } from "@/types/scheduler";
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const EnvironmentMultiSelect: React.FC = () => {
  const { selectedEnvironments, toggleEnvironment } = useEnvironmentContext();

  return (
    <Card className="animate-pop-in">
      <CardContent className="p-4">
        <div className="flex flex-wrap gap-2">
          {environmentOptions.map((option) => (
            <Button
              key={option.value}
              variant="outline"
              size="sm"
              onClick={() => toggleEnvironment(option.value as TaskEnvironment)}
              className={cn(
                "flex items-center gap-1.5 transition-all duration-200",
                selectedEnvironments.includes(option.value as TaskEnvironment) 
                  ? `${option.color} border-current` 
                  : "bg-background"
              )}
            >
              {option.icon}
              <span>{option.label}</span>
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Select environments to filter tasks by context
        </p>
      </CardContent>
    </Card>
  );
};

export default EnvironmentMultiSelect;