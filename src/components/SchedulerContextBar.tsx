import React from 'react';
import { Button } from '@/components/ui/button';
import { UserProfile } from '@/types/scheduler';
import { format, isSameDay, parseISO, differenceInMinutes, addMinutes } from 'date-fns';
import { Zap, Clock, Play, Pause, PowerOff, Settings, RefreshCcw } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { REGEN_POD_MAX_DURATION_MINUTES } from '@/lib/constants';

interface SchedulerContextBarProps {
  selectedDay: string; // Added this prop
  profile: UserProfile | null;
  T_current: Date;
  isRegenPodActive: boolean;
  regenPodStartTime: Date | null;
  regenPodDurationMinutes: number;
  onStartRegenPod: () => Promise<void>;
  onExitRegenPod: () => Promise<void>;
  isProcessingCommand: boolean;
  onOpenWorkdayWindow: () => void;
}

const SchedulerContextBar: React.FC<SchedulerContextBarProps> = ({
  selectedDay,
  profile,
  T_current,
  isRegenPodActive,
  regenPodStartTime,
  regenPodDurationMinutes,
  onStartRegenPod,
  onExitRegenPod,
  isProcessingCommand,
  onOpenWorkdayWindow,
}) => {
  const isToday = isSameDay(parseISO(selectedDay), T_current);

  const timeInPod = regenPodStartTime ? differenceInMinutes(T_current, regenPodStartTime) : 0;
  const remainingPodTime = regenPodDurationMinutes - timeInPod;

  const energyPercentage = profile ? Math.round((profile.energy / 100) * 100) : 0;
  const energyColorClass = cn(
    energyPercentage > 75 && "text-logo-green",
    energyPercentage <= 75 && energyPercentage > 25 && "text-logo-yellow",
    energyPercentage <= 25 && "text-red-500"
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-background border-b">
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn("flex items-center gap-1 text-sm font-semibold", energyColorClass)}>
              <Zap className="h-4 w-4" /> {profile?.energy !== undefined ? profile.energy : 'N/A'} Energy
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Your current energy level. Max: 100.</p>
          </TooltipContent>
        </Tooltip>

        {isToday && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1 text-sm font-semibold text-muted-foreground">
                <Clock className="h-4 w-4" /> {format(T_current, 'h:mm a')}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Current time</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isRegenPodActive ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onExitRegenPod}
                disabled={isProcessingCommand}
                className="flex items-center gap-1 bg-logo-green/20 text-logo-green border-logo-green hover:bg-logo-green/30"
              >
                <PowerOff className="h-4 w-4" />
                <span>Pod Active ({remainingPodTime > 0 ? `${remainingPodTime} min left` : 'Finishing'})</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Exit Energy Regen Pod</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onStartRegenPod}
                disabled={isProcessingCommand || !isToday || profile?.energy === 100}
                className="flex items-center gap-1 text-primary hover:bg-primary/10"
              >
                <Play className="h-4 w-4" />
                <span>Start Regen Pod</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {profile?.energy === 100
                  ? "Energy is full!"
                  : !isToday
                  ? "Can only start Pod for today's schedule"
                  : `Recharge energy (max ${REGEN_POD_MAX_DURATION_MINUTES} min)`}
              </p>
            </TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenWorkdayWindow}
              disabled={isProcessingCommand}
            >
              <Settings className="h-4 w-4" />
              <span className="sr-only">Workday Window Settings</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Adjust Workday Window</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};

export default SchedulerContextBar;