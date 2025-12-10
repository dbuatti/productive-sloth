import React, { useState, useEffect, useRef } from 'react';
import { formatTime, formatDayMonth } from '@/lib/scheduler-utils';
import { ScheduledItem, DBScheduledTask } from '@/types/scheduler';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Play, 
  Pause, 
  SkipForward, 
  RotateCcw, 
  X, 
  Zap, 
  Clock, 
  Coffee,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSession } from '@/hooks/use-session';

interface ImmersiveFocusModeProps {
  activeItem: ScheduledItem;
  T_current: Date;
  onExit: () => void;
  onAction: (
    action: 'complete' | 'skip' | 'takeBreak' | 'startNext' | 'justFinish' | 'exitFocus',
    task: DBScheduledTask,
    isEarlyCompletion?: boolean,
    remainingDurationMinutes?: number,
    index?: number | null
  ) => void;
  dbTask: DBScheduledTask | null;
  nextItem: ScheduledItem | null;
  isProcessingCommand: boolean;
}

const ImmersiveFocusMode: React.FC<ImmersiveFocusModeProps> = ({
  activeItem,
  T_current,
  onExit,
  onAction,
  dbTask,
  nextItem,
  isProcessingCommand,
}) => {
  const { profile } = useSession();
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const calculateTimeRemaining = () => {
      return Math.max(0, Math.floor((activeItem.endTime.getTime() - T_current.getTime()) / 1000));
    };

    setTimeRemaining(calculateTimeRemaining());

    if (!isPaused) {
      intervalRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            // Auto-complete when time is up
            if (dbTask) {
              onAction('complete', dbTask, false, 0, null);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [activeItem, T_current, isPaused, dbTask, onAction]);

  const formatTimeRemaining = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleComplete = () => {
    if (dbTask) {
      const remainingMinutes = Math.floor(timeRemaining / 60);
      onAction('complete', dbTask, remainingMinutes > 0, remainingMinutes, null);
    }
  };

  const handleSkip = () => {
    if (dbTask) {
      onAction('skip', dbTask);
    }
  };

  const handleExit = () => {
    onAction('exitFocus', dbTask || ({} as DBScheduledTask));
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  const energyLevel = profile?.energy || 0;
  const isLowEnergy = energyLevel < 20;

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary rounded-full p-2">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Focus Mode</h1>
            <p className="text-sm text-muted-foreground">
              {formatDayMonth(T_current)}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleExit}
          disabled={isProcessingCommand}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="text-center max-w-md w-full">
          {/* Task Info */}
          <Card className="mb-8 animate-pop-in">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-center flex-1">{activeItem.name}</h2>
                {activeItem.isCritical && (
                  <Zap className="h-5 w-5 text-destructive flex-shrink-0" />
                )}
              </div>
              
              <div className="flex items-center justify-center gap-6 mb-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">
                    {formatTimeRemaining(timeRemaining)}
                  </div>
                  <div className="text-sm text-muted-foreground">Remaining</div>
                </div>
                
                <div className="text-center">
                  <div className="text-3xl font-bold text-muted-foreground">
                    {formatTime(activeItem.startTime)}
                  </div>
                  <div className="text-sm text-muted-foreground">Start</div>
                </div>
                
                <div className="text-center">
                  <div className="text-3xl font-bold text-muted-foreground">
                    {formatTime(activeItem.endTime)}
                  </div>
                  <div className="text-sm text-muted-foreground">End</div>
                </div>
              </div>
              
              <div className="flex items-center justify-center gap-2 mb-4">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {activeItem.duration} minutes total
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Energy Indicator */}
          {isLowEnergy && (
            <Card className="mb-8 border-destructive bg-destructive/10 animate-pulse">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-destructive" />
                  <span className="font-medium text-destructive">Low Energy!</span>
                </div>
                <p className="text-sm text-destructive mt-1">
                  Consider taking a break to recharge before continuing.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
            <Button
              size="lg"
              onClick={togglePause}
              disabled={isProcessingCommand}
              className="min-w-[120px]"
            >
              {isPaused ? (
                <>
                  <Play className="h-5 w-5 mr-2" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="h-5 w-5 mr-2" />
                  Pause
                </>
              )}
            </Button>
            
            <Button
              variant="outline"
              size="lg"
              onClick={handleComplete}
              disabled={isProcessingCommand}
              className="min-w-[120px]"
            >
              <Check className="h-5 w-5 mr-2" />
              Complete
            </Button>
            
            <Button
              variant="outline"
              size="lg"
              onClick={handleSkip}
              disabled={isProcessingCommand}
              className="min-w-[120px]"
            >
              <SkipForward className="h-5 w-5 mr-2" />
              Skip
            </Button>
          </div>

          {/* Next Task Preview */}
          {nextItem && (
            <Card className="animate-pop-in">
              <CardContent className="p-4">
                <h3 className="font-medium mb-2">Next Task</h3>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{nextItem.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {formatTime(nextItem.startTime)}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t text-center text-sm text-muted-foreground">
        <p>Immersive Focus Mode - Minimize distractions and stay productive</p>
      </div>
    </div>
  );
};

export default ImmersiveFocusMode;