import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useEnvironmentContext } from '@/hooks/use-environment-context';
import { cn } from '@/lib/utils';

const EnvironmentToggle: React.FC = () => {
  const { currentEnvironmentDetails, toggleEnvironment } = useEnvironmentContext();
  const Icon = currentEnvironmentDetails.icon;

  const getButtonClasses = (env: string) => {
    switch (env) {
      case 'home':
        return 'bg-logo-green/20 text-logo-green border-logo-green/50 hover:bg-logo-green/30';
      case 'laptop':
        return 'bg-primary/20 text-primary border-primary/50 hover:bg-primary/30';
      case 'away':
        return 'bg-logo-orange/20 text-logo-orange border-logo-orange/50 hover:bg-logo-orange/30';
      case 'piano':
        return 'bg-accent/20 text-accent border-accent/50 hover:bg-accent/30';
      case 'laptop_piano':
        return 'bg-primary/20 text-primary border-primary/50 hover:bg-primary/30';
      default:
        return 'bg-secondary text-secondary-foreground border-border';
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          onClick={toggleEnvironment}
          className={cn(
            "flex items-center gap-2 h-8 px-3 text-sm font-semibold transition-all duration-200 border-2 animate-hover-lift",
            getButtonClasses(currentEnvironmentDetails.value)
          )}
        >
          <Icon className="h-4 w-4" />
          <span>{currentEnvironmentDetails.label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Click to switch environment context.</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default EnvironmentToggle;