"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { intervalToDuration, formatDuration, isBefore } from 'date-fns';
import { X, CheckCircle, Archive, Clock, Zap, Sparkles, Coffee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatTime, formatDayMonth } from '@/lib/scheduler-utils';
import { ScheduledItem, DBScheduledTask } from '@/types/scheduler';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ImmersiveFocusModeProps {
  activeItem: ScheduledItem;
  T_current: Date;
  onExit: () => void;
  onComplete: (task: DBScheduledTask) => void;
  onSkip: (task: DBScheduledTask) => void;
  dbTask: DBScheduledTask | null; // The actual DB task for completion/skip
}

const ImmersiveFocusMode: React.FC<ImmersiveFocusModeProps> = ({
  activeItem,
  T_current,
  onExit,
  onComplete,
  onSkip,
  dbTask,
}) => {
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

  const updateRemaining = useCallback(() => {
    if (!activeItem || isBefore(activeItem.endTime, T_current)) {
      setTimeRemaining('0s');
      return;
    }
    const duration = intervalToDuration({ start: T_current, end: activeItem.endTime });
    const formatted = formatDuration(duration, {
      format: ['hours', 'minutes', 'seconds'],
      delimiter: ' ',
      zero: false,
      locale: {
        formatDistance: (token, count) => {
          if (token === 'xSeconds') return `${count}s`;
          if (token === 'xMinutes') return `${count}m`;
          if (token === 'xHours') return `${count}h`;
          return `${count}${token.charAt(0)}`;
        },
      },
    });
    setTimeRemaining(formatted || '0s');
  }, [activeItem, T_current]);

  useEffect(() => {
    updateRemaining(); // Initial update
    const interval = setInterval(updateRemaining, 1000); // Update every second
    return () => clearInterval(interval);
  }, [updateRemaining]);

  // NEW: Effect for Escape key to exit focus mode
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onExit();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onExit]); // Dependency on onExit to ensure it's always the latest function

  if (!activeItem || !dbTask) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-lg animate-fade-in">
        <div className="text-center text-muted-foreground">
          <Clock className="h-12 w-12 mx-auto mb-4 animate-pulse" />
          <p className="text-xl font-semibold">No active task to focus on.</p>
          <Button onClick={onExit} className="mt-6">
            Back to Scheduler
          </Button>
        </div>
      </div>
    );
  }

  const isBreak = activeItem.type === 'break';
  const isTimeOff = activeItem.type === 'time-off';
  const statusIcon = isBreak ? <Coffee className="h-10 w-10 text-logo-orange animate-pulse" /> : <Zap className="h-10 w-10 text-primary animate-pulse" />;
  const textColor = isBreak ? 'text-logo-orange' : 'text-primary';

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-lg p-4 text-foreground animate-fade-in">
      {/* Exit Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onExit}
            className="absolute top-4 left-4 h-10 w-10 text-muted-foreground hover:text-primary hover:bg-secondary/50 transition-all duration-200"
          >
            <X className="h-6 w-6" />
            <span className="sr-only">Exit Focus Mode</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Exit Focus Mode</p>
        </TooltipContent>
      </Tooltip>

      {/* Main Content */}
      <div className="flex flex-col items-center text-center space-y-6 max-w-2xl w-full">
        <div className="flex items-center gap-3 text-5xl font-extrabold text-foreground animate-pulse-glow-subtle">
          {statusIcon}
          <span className={cn("text-5xl font-extrabold leading-tight", textColor)}>
            {activeItem.emoji} {activeItem.name}
          </span>
        </div>

        <p className="text-2xl text-muted-foreground mt-2">
          ({activeItem.duration} min)
        </p>

        <div className="flex flex-col items-center space-y-2">
          <p className="text-muted-foreground text-lg">Time Remaining:</p>
          <p className={cn("text-7xl font-extrabold font-mono", textColor, "animate-pulse-text")}>
            {timeRemaining}
          </p>
        </div>

        <div className="text-lg text-muted-foreground">
          Finishes At: <span className="font-bold text-foreground">{formatTime(activeItem.endTime)}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="absolute bottom-8 flex space-x-4">
        {!isBreak && !isTimeOff && !activeItem.isCompleted && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => onComplete(dbTask)}
                disabled={dbTask.is_locked}
                className={cn(
                  "h-12 px-6 text-lg font-semibold bg-logo-green text-primary-foreground hover:bg-logo-green/90 transition-all duration-200",
                  dbTask.is_locked && "opacity-50 cursor-not-allowed"
                )}
                style={dbTask.is_locked ? { pointerEvents: 'auto' } : undefined}
              >
                <CheckCircle className="h-6 w-6 mr-2" />
                Complete Task
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{dbTask.is_locked ? "Unlock to Complete" : "Mark task as completed"}</p>
            </TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={() => onSkip(dbTask)}
              disabled={dbTask.is_locked}
              className={cn(
                "h-12 px-6 text-lg font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all duration-200",
                dbTask.is_locked && "opacity-50 cursor-not-allowed"
              )}
              style={dbTask.is_locked ? { pointerEvents: 'auto' } : undefined}
            >
              <Archive className="h-6 w-6 mr-2" />
              Skip / Retire
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{dbTask.is_locked ? "Unlock to Skip/Retire" : "Move task to Aether Sink"}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};

export default ImmersiveFocusMode;