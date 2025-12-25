import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Pause, SkipForward, CheckCircle, Coffee, XCircle, Zap, Star, Utensils, PowerOff } from 'lucide-react';
import { format, differenceInMinutes, isSameDay, isBefore, isAfter } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/scheduler-utils'; // Removed formatDayMonth
import { ScheduledItem } from '@/types/scheduler';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getEnvironmentIcon } from '@/lib/scheduler-utils'; // Assuming this utility exists

interface NowFocusCardProps {
  currentTask: ScheduledItem | null;
  nextTask: ScheduledItem | null;
  onSchedulerAction: (
    action: 'complete' | 'skip' | 'takeBreak' | 'startNext' | 'justFinish' | 'exitFocus',
    task: any, // DBScheduledTask, but using any for now to avoid circular dependency or complex mapping
    isEarlyCompletion?: boolean,
    remainingDurationMinutes?: number,
    index?: number
  ) => Promise<void>;
  isProcessingCommand: boolean;
  profile: any; // UserProfile, using any for now
  T_current: Date;
  onStartFocusMode: () => void;
}

const NowFocusCard: React.FC<NowFocusCardProps> = ({
  currentTask,
  nextTask,
  onSchedulerAction,
  isProcessingCommand,
  profile,
  T_current,
  onStartFocusMode,
}) => {
  const remainingMinutes = currentTask ? differenceInMinutes(currentTask.endTime, T_current) : 0;
  const elapsedMinutes = currentTask ? differenceInMinutes(T_current, currentTask.startTime) : 0;
  const totalDuration = currentTask ? differenceInMinutes(currentTask.endTime, currentTask.startTime) : 0;
  const progressPercentage = totalDuration > 0 ? (elapsedMinutes / totalDuration) * 100 : 0;

  const energyColorClass = cn(
    profile && profile.energy > 75 && "text-logo-green",
    profile && profile.energy <= 75 && profile.energy > 25 && "text-logo-yellow",
    profile && profile.energy <= 25 && "text-red-500"
  );

  const currentDbTask: any = currentTask ? { // Using any for now
    id: currentTask.id,
    name: currentTask.name,
    start_time: currentTask.startTime.toISOString(),
    end_time: currentTask.endTime.toISOString(),
    scheduled_date: format(currentTask.startTime, 'yyyy-MM-dd'),
    is_critical: currentTask.isCritical,
    is_flexible: currentTask.isFlexible,
    is_locked: currentTask.isLocked,
    is_completed: currentTask.isCompleted,
    energy_cost: currentTask.energyCost,
    break_duration: currentTask.breakDuration,
    is_custom_energy_cost: false,
    task_environment: currentTask.taskEnvironment,
    is_backburner: currentTask.isBackburner,
    user_id: profile?.id || '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    source_calendar_id: null,
  } : null;

  const nextDbTask: any = nextTask ? { // Using any for now
    id: nextTask.id,
    name: nextTask.name,
    start_time: nextTask.startTime.toISOString(),
    end_time: nextTask.endTime.toISOString(),
    scheduled_date: format(nextTask.startTime, 'yyyy-MM-dd'),
    is_critical: nextTask.isCritical,
    is_flexible: nextTask.isFlexible,
    is_locked: nextTask.isLocked,
    is_completed: nextTask.isCompleted,
    energy_cost: nextTask.energyCost,
    break_duration: nextTask.breakDuration,
    is_custom_energy_cost: false,
    task_environment: nextTask.taskEnvironment,
    is_backburner: nextTask.isBackburner,
    user_id: profile?.id || '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    source_calendar_id: null,
  } : null;

  return (
    <Card className="animate-pop-in animate-hover-lift">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Play className="h-5 w-5 text-primary" /> Now Focusing
        </CardTitle>
        <div className="flex items-center gap-2">
          <span className={cn("flex items-center gap-1 text-sm font-semibold", energyColorClass)}>
            <Zap className="h-4 w-4" /> {profile?.energy !== undefined ? profile.energy : 'N/A'} Energy
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onStartFocusMode} disabled={isProcessingCommand}>
                <PowerOff className="h-4 w-4" />
                <span className="sr-only">Start Immersive Focus Mode</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Start Immersive Focus Mode</TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentTask ? (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{currentTask.emoji}</span>
                <h3 className="text-lg font-semibold">{currentTask.name}</h3>
                {currentTask.isCritical && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Star className="h-4 w-4 text-logo-yellow" />
                    </TooltipTrigger>
                    <TooltipContent>Critical Task</TooltipContent>
                  </Tooltip>
                )}
                {currentTask.taskEnvironment && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="h-4 w-4 flex items-center justify-center shrink-0">
                        {getEnvironmentIcon(currentTask.taskEnvironment)}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Environment: {currentTask.taskEnvironment.charAt(0).toUpperCase() + currentTask.taskEnvironment.slice(1)}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              <span className="text-sm text-muted-foreground">
                {formatTime(currentTask.startTime)} - {formatTime(currentTask.endTime)}
              </span>
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
            <div className="flex gap-2">
              <Button
                onClick={() => currentDbTask && onSchedulerAction('complete', currentDbTask)}
                disabled={isProcessingCommand}
                className="flex-1 bg-logo-green hover:bg-logo-green/90 text-white"
              >
                <CheckCircle className="h-4 w-4 mr-2" /> Complete
              </Button>
              <Button
                onClick={() => currentDbTask && onSchedulerAction('skip', currentDbTask)}
                disabled={isProcessingCommand}
                variant="outline"
                className="flex-1 text-red-500 border-red-500 hover:bg-red-500/10"
              >
                <SkipForward className="h-4 w-4 mr-2" /> Skip
              </Button>
            </div>
          </>
        ) : (
          <p className="text-muted-foreground text-center">No task is currently active.</p>
        )}

        {nextTask && (
          <div className="mt-4 pt-4 border-t border-dashed border-muted-foreground/30">
            <h4 className="text-md font-semibold text-muted-foreground flex items-center gap-2">
              <Pause className="h-4 w-4" /> Up Next
            </h4>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{nextTask.emoji}</span>
                <span className="font-medium">{nextTask.name}</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {formatTime(nextTask.startTime)} - {formatTime(nextTask.endTime)}
              </span>
            </div>
            <Button
              onClick={() => nextDbTask && onSchedulerAction('startNext', nextDbTask)}
              disabled={isProcessingCommand}
              variant="secondary"
              className="w-full mt-3"
            >
              <Play className="h-4 w-4 mr-2" /> Start Next Task
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default NowFocusCard;