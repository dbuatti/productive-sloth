import React from 'react';
import { ScheduledItem, DisplayItem, TimeMarker, FreeTimeItem, CurrentTimeMarker, DBScheduledTask } from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { formatTime, formatDayMonth, getEmojiHue } from '@/lib/scheduler-utils';
import { Clock, Zap, Coffee, Lock, Unlock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import InfoChip from './InfoChip';
import { useSession } from '@/hooks/use-session';
import { CustomProgress } from './CustomProgress';

interface SchedulerDisplayProps {
  schedule: DisplayItem[];
  dbTasks: DBScheduledTask[];
  T_current: Date;
  onTaskClick: (task: DBScheduledTask) => void;
  onToggleLock: (taskId: string, isLocked: boolean) => void;
  onCompleteTask: (task: DBScheduledTask) => void;
  onSkipTask: (task: DBScheduledTask) => void;
  onEnterFocusMode: (task: DBScheduledTask) => void;
}

const SchedulerDisplay: React.FC<SchedulerDisplayProps> = React.memo(({
  schedule,
  dbTasks,
  T_current,
  onTaskClick,
  onToggleLock,
  onCompleteTask,
  onSkipTask,
  onEnterFocusMode,
}) => {
  const { profile } = useSession();
  const [hoveredItemId, setHoveredItemId] = React.useState<string | null>(null);

  const getDbTask = (itemId: string): DBScheduledTask | undefined => {
    return dbTasks.find(t => t.id === itemId);
  };

  const renderItem = (item: DisplayItem) => {
    if (item.type === 'marker') {
      const marker = item as TimeMarker;
      return (
        <div key={marker.id} className="relative flex items-center h-6">
          <div className="absolute left-0 w-full border-t border-dashed border-muted-foreground/50"></div>
          <span className="relative z-10 px-2 text-xs font-medium text-muted-foreground bg-background">
            {formatTime(marker.time)} - {marker.label}
          </span>
        </div>
      );
    }

    if (item.type === 'current-time') {
      const marker = item as CurrentTimeMarker;
      const topOffset = `${(marker.time.getHours() * 60 + marker.time.getMinutes()) / 14.4}px`; // Placeholder for dynamic positioning
      return (
        <div 
          key={marker.id} 
          className="absolute left-0 right-0 h-1 bg-destructive/80 z-20 animate-pulse" 
          style={{ top: topOffset }}
        >
          <span className="absolute -left-16 -top-2 text-xs font-bold text-destructive bg-background px-1 rounded">NOW</span>
        </div>
      );
    }

    if (item.type === 'free-time') {
      const freeTime = item as FreeTimeItem;
      const height = `${freeTime.duration * 1.5}px`; // 1.5px per minute
      return (
        <div 
          key={freeTime.id} 
          className="flex flex-col items-center justify-center border border-dashed border-border/50 bg-secondary/20 text-muted-foreground text-center transition-all duration-300 ease-in-out hover:bg-secondary/50"
          style={{ height }}
        >
          <Clock className="h-4 w-4 mb-1" />
          <span className="text-xs font-medium">{freeTime.message}</span>
          <span className="text-xs font-mono">{freeTime.duration} min free</span>
        </div>
      );
    }

    // Scheduled Item (Task, Break, Time-Off)
    const scheduledItem = item as ScheduledItem;
    const dbTask = getDbTask(scheduledItem.id);
    const height = `${scheduledItem.duration * 1.5}px`; // 1.5px per minute
    const isBreak = scheduledItem.type === 'break';
    const isTimeOff = scheduledItem.type === 'time-off';
    const isTask = scheduledItem.type === 'task';
    const isCompleted = scheduledItem.isCompleted;
    const isLocked = scheduledItem.isLocked;
    const isCritical = scheduledItem.isCritical;

    const hue = isBreak ? 40 : (isTimeOff ? 100 : getEmojiHue(scheduledItem.name));
    const ambientBackgroundColor = `hsl(${hue} 50% 35% / 0.1)`;
    const accentBorderColor = `hsl(${hue} 70% 50%)`;
    const textColor = `hsl(${hue} 70% 50%)`;

    const isCurrentlyActive = T_current >= scheduledItem.startTime && T_current < scheduledItem.endTime;
    const timeElapsedPercentage = isCurrentlyActive 
      ? ((T_current.getTime() - scheduledItem.startTime.getTime()) / (scheduledItem.endTime.getTime() - scheduledItem.startTime.getTime())) * 100
      : 0;

    return (
      <div
        key={scheduledItem.id}
        className={cn(
          "relative p-3 rounded-md shadow-md overflow-hidden transition-all duration-300 ease-in-out cursor-pointer",
          "border-l-4",
          isCompleted && "opacity-60",
          isCurrentlyActive && "animate-pulse-active-row border-l-8",
          isLocked && "border-dashed",
          isTask && !isCompleted && "hover:shadow-xl hover:shadow-primary/20",
          isBreak && "bg-logo-orange/10 border-logo-orange/50",
          isTimeOff && "bg-logo-green/10 border-logo-green/50",
          isTask && !isBreak && !isTimeOff && "bg-card",
          isTask && !isBreak && !isTimeOff && !isCompleted && `border-l-[${accentBorderColor}]`,
          isTask && !isBreak && !isTimeOff && isCompleted && "border-l-muted-foreground/50",
        )}
        style={{ 
          height, 
          backgroundColor: isBreak || isTimeOff ? undefined : ambientBackgroundColor,
          borderLeftColor: isBreak || isTimeOff ? undefined : accentBorderColor,
        }}
        onMouseEnter={() => setHoveredItemId(scheduledItem.id)}
        onMouseLeave={() => setHoveredItemId(null)}
      >
        {/* Live Progress Bar */}
        {isCurrentlyActive && (
          <div 
            className="absolute top-0 left-0 h-full bg-[hsl(var(--live-progress)/0.2)] z-10 transition-all duration-1000"
            style={{ width: `${timeElapsedPercentage}%` }}
          />
        )}

        <div className="relative z-20 flex flex-col h-full justify-between">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xl shrink-0">{scheduledItem.emoji}</span>
              <span className={cn(
                "text-sm font-semibold truncate",
                isCompleted ? "line-through text-muted-foreground" : "text-foreground",
                isBreak && "text-logo-orange",
                isTimeOff && "text-logo-green"
              )}>
                {scheduledItem.name}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-xs font-mono text-muted-foreground">
                {formatTime(scheduledItem.startTime)}
              </span>
              {isCritical && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertCircle className="h-3 w-3 text-destructive" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Critical Task</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {isLocked && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Locked</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          <div className="flex items-end justify-between text-xs text-muted-foreground">
            <span className="font-mono">{scheduledItem.duration} min</span>
            {isTask && scheduledItem.energyCost > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1 text-xs font-semibold font-mono text-logo-yellow">
                    {scheduledItem.energyCost} <Zap className="h-3 w-3" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Energy Cost</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Info Chip for Task Details */}
        {dbTask && (
          <InfoChip 
            onClick={(e) => {
              e.stopPropagation();
              onTaskClick(dbTask);
            }}
            isHovered={hoveredItemId === scheduledItem.id}
            tooltipContent="View/Edit Task Details"
          />
        )}

        {/* Action Buttons (Lock/Unlock) */}
        {dbTask && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLock(dbTask.id, !isLocked);
                }}
                className={cn(
                  "absolute top-2 right-2 h-6 w-6 rounded-full p-0 z-30",
                  "bg-secondary/50 text-muted-foreground border border-transparent",
                  "transition-all duration-200 ease-in-out",
                  hoveredItemId === scheduledItem.id ? "opacity-100 scale-100 bg-primary/10 text-primary border-primary/50 shadow-md" : "opacity-0 scale-90 pointer-events-none"
                )}
              >
                {isLocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                <span className="sr-only">{isLocked ? "Unlock Task" : "Lock Task"}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isLocked ? "Unlock Task" : "Lock Task"}</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Completion/Skip Buttons (Only visible when active and unlocked) */}
        {dbTask && isCurrentlyActive && !isLocked && isTask && !isCompleted && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur-sm opacity-0 hover:opacity-100 transition-opacity duration-300">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCompleteTask(dbTask);
                  }}
                  className="h-10 w-10 bg-logo-green hover:bg-logo-green/90 text-primary-foreground mr-2"
                >
                  <CheckCircle className="h-5 w-5" />
                  <span className="sr-only">Complete</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Complete Task Now</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSkipTask(dbTask);
                  }}
                  className="h-10 w-10"
                >
                  <Clock className="h-5 w-5" />
                  <span className="sr-only">Skip/Retire</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Skip & Retire to Aether Sink</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    );
  };

  // Calculate total height for the container (1.5px per minute in a 24-hour day)
  // This is a rough estimate, the actual height is determined by the items' styles.
  const totalHeight = 24 * 60 * 1.5; 

  return (
    <div className="relative w-full h-full overflow-y-auto p-4">
      <div className="relative w-full min-h-[1440px]"> {/* 1440px = 24 hours * 60 min * 1px/min (base) */}
        {schedule.map(item => renderItem(item))}
      </div>
    </div>
  );
});

export default SchedulerDisplay;