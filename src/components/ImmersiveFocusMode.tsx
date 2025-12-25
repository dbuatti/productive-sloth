import React, { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScheduledItem, DBScheduledTask, UserProfile } from '@/types/scheduler';
import { format, differenceInMinutes, isSameDay, isBefore, isAfter } from 'date-fns';
import { Play, Pause, SkipForward, CheckCircle, Coffee, XCircle, Zap, Star, Utensils, PowerOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getEnvironmentIcon } from '@/lib/scheduler-utils'; // Assuming this utility exists

interface ImmersiveFocusModeProps {
  isActive: boolean;
  setIsActive: React.Dispatch<React.SetStateAction<boolean>>;
  currentTask: ScheduledItem | null;
  nextTask: ScheduledItem | null;
  onSchedulerAction: (
    action: 'complete' | 'skip' | 'takeBreak' | 'startNext' | 'justFinish' | 'exitFocus',
    task: DBScheduledTask,
    isEarlyCompletion?: boolean,
    remainingDurationMinutes?: number,
    index?: number
  ) => Promise<void>;
  isProcessingCommand: boolean;
  profile: UserProfile | null;
  T_current: Date;
}

const ImmersiveFocusMode: React.FC<ImmersiveFocusModeProps> = ({
  isActive,
  setIsActive,
  currentTask,
  nextTask,
  onSchedulerAction,
  isProcessingCommand,
  profile,
  T_current,
}) => {
  const focusModeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive) {
      document.body.style.overflow = 'hidden';
      if (focusModeRef.current) {
        focusModeRef.current.focus();
      }
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isActive]);

  if (!isActive) return null;

  const currentDbTask: DBScheduledTask | null = currentTask ? {
    id: currentTask.id,
    user_id: '', // Placeholder
    name: currentTask.name,
    start_time: currentTask.startTime.toISOString(),
    end_time: currentTask.endTime.toISOString(),
    scheduled_date: format(currentTask.startTime, 'yyyy-MM-dd'),
    is_critical: currentTask.isCritical,
    is_flexible: currentTask.isFlexible,
    is_locked: currentTask.isLocked,
    is_completed: currentTask.isCompleted,
    energy_cost: currentTask.energyCost,
    break_duration: currentTask.breakDuration || null, // Use || null for optional
    is_custom_energy_cost: false, // Placeholder
    task_environment: currentTask.taskEnvironment,
    is_backburner: currentTask.isBackburner,
    created_at: new Date().toISOString(), // Placeholder
    updated_at: new Date().toISOString(), // Added
    source_calendar_id: null, // Added
  } : null;

  const nextDbTask: DBScheduledTask | null = nextTask ? {
    id: nextTask.id,
    user_id: '', // Placeholder
    name: nextTask.name,
    start_time: nextTask.startTime.toISOString(),
    end_time: nextTask.endTime.toISOString(),
    scheduled_date: format(nextTask.startTime, 'yyyy-MM-dd'),
    is_critical: nextTask.isCritical,
    is_flexible: nextTask.isFlexible,
    is_locked: nextTask.isLocked,
    is_completed: nextTask.isCompleted,
    energy_cost: nextTask.energyCost,
    break_duration: nextTask.breakDuration || null, // Use || null for optional
    is_custom_energy_cost: false, // Placeholder
    task_environment: nextTask.taskEnvironment,
    is_backburner: nextTask.isBackburner,
    created_at: new Date().toISOString(), // Placeholder
    updated_at: new Date().toISOString(), // Added
    source_calendar_id: null, // Added
  } : null;

  const remainingMinutes = currentTask ? differenceInMinutes(currentTask.endTime, T_current) : 0;
  const elapsedMinutes = currentTask ? differenceInMinutes(T_current, currentTask.startTime) : 0;
  const totalDuration = currentTask ? differenceInMinutes(currentTask.endTime, currentTask.startTime) : 0;
  const progressPercentage = totalDuration > 0 ? (elapsedMinutes / totalDuration) * 100 : 0;

  const energyColorClass = cn(
    profile && profile.energy > 75 && "text-logo-green",
    profile && profile.energy <= 75 && profile.energy > 25 && "text-logo-yellow",
    profile && profile.energy <= 25 && "text-red-500"
  );

  return (
    <div
      ref={focusModeRef}
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center p-4 overflow-auto"
      tabIndex={-1}
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
        onClick={() => onSchedulerAction('exitFocus', currentDbTask!)}
        disabled={isProcessingCommand}
      >
        <XCircle className="h-6 w-6" />
        <span className="sr-only">Exit Focus Mode</span>
      </Button>

      <div className="w-full max-w-2xl space-y-6">
        <Card className="animate-pop-in">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-primary">
              {currentTask ? currentTask.name : "No Active Task"}
            </CardTitle>
            {currentTask && (
              <p className="text-muted-foreground text-lg">
                {format(currentTask.startTime, 'h:mm a')} - {format(currentTask.endTime, 'h:mm a')}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {currentTask ? (
              <>
                <div className="flex items-center justify-center gap-4 text-lg">
                  <span className="flex items-center gap-1">
                    {currentTask.emoji}
                  </span>
                  {currentTask.isCritical && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Star className="h-5 w-5 text-logo-yellow" />
                      </TooltipTrigger>
                      <TooltipContent>Critical Task</TooltipContent>
                    </Tooltip>
                  )}
                  {currentTask.taskEnvironment && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="h-5 w-5 flex items-center justify-center shrink-0">
                          {getEnvironmentIcon(currentTask.taskEnvironment)}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Environment: {currentTask.taskEnvironment.charAt(0).toUpperCase() + currentTask.taskEnvironment.slice(1)}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {currentTask.energyCost !== undefined && currentTask.energyCost !== 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={cn(
                          "flex items-center gap-1 font-semibold font-mono text-sm px-2 py-1 rounded-md",
                          currentTask.energyCost < 0 ? "text-logo-green bg-logo-green/30" : "text-logo-yellow bg-logo-yellow/30"
                        )}>
                          {currentTask.energyCost > 0 ? currentTask.energyCost : `+${Math.abs(currentTask.energyCost)}`}
                          {currentTask.energyCost > 0 ? <Zap className="h-4 w-4" /> : <Utensils className="h-4 w-4" />}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{currentTask.energyCost > 0 ? "Energy Cost" : "Energy Gain (Meal)"}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>

                <div className="w-full bg-muted rounded-full h-2.5">
                  <div
                    className="bg-primary h-2.5 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progressPercentage}%` }}
                  ></div>
                </div>

                <div className="flex justify-between text-muted-foreground text-sm">
                  <span>Elapsed: {elapsedMinutes} min</span>
                  <span>Remaining: {remainingMinutes} min</span>
                </div>

                <div className="flex flex-wrap justify-center gap-3">
                  {currentDbTask && (
                    <>
                      <Button
                        onClick={() => onSchedulerAction('complete', currentDbTask)}
                        disabled={isProcessingCommand}
                        className="flex items-center gap-2 bg-logo-green hover:bg-logo-green/90 text-white"
                      >
                        <CheckCircle className="h-5 w-5" /> Complete
                      </Button>
                      <Button
                        onClick={() => onSchedulerAction('skip', currentDbTask)}
                        disabled={isProcessingCommand}
                        variant="outline"
                        className="flex items-center gap-2 text-red-500 border-red-500 hover:bg-red-500/10"
                      >
                        <SkipForward className="h-5 w-5" /> Skip
                      </Button>
                      <Button
                        onClick={() => onSchedulerAction('takeBreak', currentDbTask, true, remainingMinutes)}
                        disabled={isProcessingCommand}
                        variant="outline"
                        className="flex items-center gap-2 text-primary border-primary hover:bg-primary/10"
                      >
                        <Coffee className="h-5 w-5" /> Take Break
                      </Button>
                    </>
                  )}
                </div>
              </>
            ) : (
              <p className="text-center text-muted-foreground">No task is currently active.</p>
            )}
          </CardContent>
        </Card>

        {nextTask && (
          <Card className="animate-pop-in">
            <CardHeader className="text-center">
              <CardTitle className="text-xl font-semibold text-secondary-foreground">Up Next</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-2">
              <p className="text-lg font-bold">{nextTask.emoji} {nextTask.name}</p>
              <p className="text-muted-foreground text-base">
                {format(nextTask.startTime, 'h:mm a')} - {format(nextTask.endTime, 'h:mm a')} ({nextTask.duration} min)
              </p>
              {nextDbTask && (
                <Button
                  onClick={() => onSchedulerAction('startNext', nextDbTask)}
                  disabled={isProcessingCommand}
                  variant="secondary"
                  className="flex items-center gap-2 mt-2"
                >
                  <Play className="h-4 w-4" /> Start Next Task
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <div className="text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
          <Zap className={cn("h-4 w-4", energyColorClass)} />
          Current Energy: {profile?.energy !== undefined ? profile.energy : 'N/A'}
        </div>
      </div>
    </div>
  );
};

export default ImmersiveFocusMode;