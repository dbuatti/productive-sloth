import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, CalendarCheck, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface AutoScheduleButtonProps {
  onAutoSchedule: () => Promise<void>;
  isProcessingCommand: boolean;
  disabled: boolean;
}

const AutoScheduleButton: React.FC<AutoScheduleButtonProps> = ({ onAutoSchedule, isProcessingCommand, disabled }) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          onClick={onAutoSchedule}
          disabled={isProcessingCommand || disabled}
          className={cn(
            "w-full h-14 text-lg font-bold flex items-center gap-3 transition-all duration-300 ease-in-out",
            // Use logo-green for a more energetic, positive action
            "bg-logo-green text-primary-foreground hover:bg-logo-green/90 shadow-lg hover:shadow-xl hover:shadow-logo-green/30",
            "animate-pop-in animate-hover-lift",
            (isProcessingCommand || disabled) && "opacity-70 cursor-not-allowed"
          )}
          style={(isProcessingCommand || disabled) ? { pointerEvents: 'auto' } : undefined}
        >
          {isProcessingCommand ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <CalendarCheck className="h-6 w-6" />
          )}
          Auto Schedule Day
          <Sparkles className="h-5 w-5 text-logo-yellow" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Automatically organize all flexible tasks (from schedule and sink) for today.</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default AutoScheduleButton;