"use client";

import React, { useMemo, useRef, useEffect, useState } from 'react';
import { 
  ScheduledItem, FormattedSchedule, DisplayItem, FreeTimeItem, DBScheduledTask, TaskEnvironment 
} from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { formatTime, getEmojiHue } from '@/lib/scheduler-utils';
import { Button } from '@/components/ui/button';
import { 
  Trash2, Archive, Lock, Unlock, Clock, Zap, 
  CheckCircle2, Star, Home, Laptop, Globe, Music, 
  Info, Target
} from 'lucide-react';
import { format, differenceInMinutes, parseISO, min, max, isPast, addMinutes } from 'date-fns';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import ScheduledTaskDetailDialog from './ScheduledTaskDetailDialog';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';

interface SchedulerDisplayProps {
  schedule: FormattedSchedule | null;
  T_current: Date;
  onRemoveTask: (taskId: string) => void; // Changed signature
  onRetireTask: (task: DBScheduledTask) => void;
  onCompleteTask: (task: DBScheduledTask, index?: number) => void;
  activeItemId: string | null;
  selectedDayString: string;
  onAddTaskClick: () => void;
  onScrollToItem: (itemId: string) => void;
  isProcessingCommand: boolean;
  onFreeTimeClick: (startTime: Date, endTime: Date) => void;
}

const MINUTE_HEIGHT = 2.0; // Slightly more compact

const getEnvironmentIcon = (environment: TaskEnvironment) => {
  const iconClass = "h-3 w-3 opacity-70";
  switch (environment) {
    case 'home': return <Home className={iconClass} />;
    case 'laptop': return <Laptop className={iconClass} />;
    case 'away': return <Globe className={iconClass} />;
    case 'piano': return <Music className={iconClass} />;
    default: return null;
  }
};

const SchedulerDisplay: React.FC<SchedulerDisplayProps> = React.memo(({
  schedule,
  T_current,
  onRemoveTask,
  onRetireTask,
  onCompleteTask,
  activeItemId,
  selectedDayString,
  onFreeTimeClick,
  onScrollToItem
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { toggleScheduledTaskLock } = useSchedulerTasks(selectedDayString);
  const [selectedTask, setSelectedTask] = useState<DBScheduledTask | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showSyncButton, setShowSyncButton] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current) {
        setShowSyncButton(containerRef.current.scrollTop > 300);
      }
    };
    const el = containerRef.current;
    el?.addEventListener('scroll', handleScroll);
    return () => el?.removeEventListener('scroll', handleScroll);
  }, []);

  const finalDisplayItems = useMemo(() => {
    if (!schedule || schedule.items.length === 0) return [];
    const items = [...schedule.items];
    const actualStart = min(items.map(i => i.startTime));
    const processed: DisplayItem[] = [];
    let cursor = actualStart;

    items.forEach(item => {
      if (differenceInMinutes(item.startTime, cursor) > 0) {
        processed.push({
          id: `gap-${cursor.getTime()}`,
          type: 'free-time',
          startTime: cursor,
          endTime: item.startTime,
          duration: differenceInMinutes(item.startTime, cursor),
          message: 'Temporal Gap'
        } as FreeTimeItem);
      }
      processed.push(item);
      cursor = item.endTime;
    });
    return processed;
  }, [schedule]);

  const handleTaskClick = (task: DBScheduledTask) => {
    setSelectedTask(task);
    setIsDialogOpen(true);
  };

  if (!schedule || schedule.items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed rounded-2xl border-white/5 bg-secondary/5">
        <Clock className="h-10 w-10 mb-3 opacity-20" />
        <p className="font-bold uppercase tracking-widest text-xs text-primary/60">Timeline Flatlined</p>
        <Button variant="link" onClick={() => onFreeTimeClick(new Date(), addMinutes(new Date(), 30))} className="text-[10px] mt-2 opacity-50 uppercase tracking-tighter">
          Initialize Sequence
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      {showSyncButton && activeItemId && (
        <Button 
          onClick={() => onScrollToItem(activeItemId)}
          className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[100] rounded-full bg-primary/90 shadow-lg"
          size="sm"
        >
          <Target className="h-4 w-4 mr-2" /> Sync to Now
        </Button>
      )}

      <div ref={containerRef} className="relative pl-12 pr-2 py-4 custom-scrollbar">
        {/* Timeline Axis */}
        <div className="absolute left-[3.25rem] top-0 bottom-0 w-px bg-gradient-to-b from-primary/50 via-primary/10 to-transparent" />

        {finalDisplayItems.map((item, index) => {
          if (item.type === 'free-time') {
            const gap = item as FreeTimeItem;
            return (
              <div 
                key={gap.id}
                className="group relative flex gap-4 mb-3 cursor-crosshair"
                style={{ height: `${gap.duration * MINUTE_HEIGHT}px` }}
                onClick={() => onFreeTimeClick(gap.startTime, gap.endTime)}
              >
                <div className="w-10 text-right opacity-20 font-mono text-[8px] pt-1">{format(gap.startTime, 'HH:mm')}</div>
                <div className="flex-1 flex items-center justify-center border border-dashed border-white/5 rounded-lg hover:bg-white/[0.02] transition-colors">
                  <span className="opacity-0 group-hover:opacity-100 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 transition-opacity">
                    +{gap.duration}m
                  </span>
                </div>
              </div>
            );
          }

          const taskItem = item as ScheduledItem;
          const dbTask = schedule.dbTasks.find(t => t.id === taskItem.id);
          const isActive = taskItem.id === activeItemId;
          const isPastItem = isPast(taskItem.endTime) && !isActive;
          const duration = differenceInMinutes(taskItem.endTime, taskItem.startTime);

          const hue = getEmojiHue(taskItem.name);
          const accentColor = `hsl(${hue} 70% 50%)`;

          return (
            <div key={taskItem.id} className="relative group flex gap-4 mb-3">
              {/* Time Marker */}
              <div className="w-10 text-right shrink-0 pt-1.5">
                <span className={cn(
                  "text-[9px] font-bold font-mono leading-none transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground/40"
                )}>
                  {format(taskItem.startTime, 'HH:mm')}
                </span>
              </div>

              {/* Dot Indicator */}
              <div className="relative z-10 mt-2 shrink-0">
                <div className={cn(
                  "h-2.5 w-2.5 rounded-full border-2 border-background transition-all duration-700",
                  isActive ? "bg-primary scale-125 shadow-[0_0_10px_rgba(var(--primary-rgb),0.6)]" : "bg-secondary border-primary/20",
                  isPastItem && "opacity-30 grayscale"
                )} />
              </div>

              {/* Task Card */}
              <div 
                className={cn(
                  "flex-1 rounded-xl border-none transition-all duration-300 relative overflow-hidden flex flex-col justify-between p-3", // Removed border, changed rounded-lg to rounded-xl
                  isActive ? "bg-primary/10 shadow-md ring-1 ring-primary/20" : "bg-card/40 hover:bg-primary/5", // Adjusted hover background
                  isPastItem && "opacity-40 grayscale"
                )}
                style={{ 
                  height: `${duration * MINUTE_HEIGHT}px`, // Task height directly related to duration
                  borderLeft: `3px solid ${isActive ? 'hsl(var(--primary))' : accentColor}`
                }}
                onClick={() => dbTask && handleTaskClick(dbTask)}
              >
                {isActive && <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent animate-pulse" />}

                <div className="flex items-center justify-between gap-3"> {/* Changed items-start to items-center */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-lg leading-none">{taskItem.emoji}</span>
                      <span className={cn(
                        "text-sm font-bold truncate",
                        isActive ? "text-primary" : "text-foreground"
                      )}>
                        {taskItem.name}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-mono font-semibold text-muted-foreground/70 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {duration}m
                      </span>
                      {taskItem.isCritical && (
                        <Badge variant="secondary" className="h-4 px-1.5 text-[8px] font-black bg-logo-yellow/20 text-logo-yellow border-logo-yellow/30">
                          CRIT
                        </Badge>
                      )}
                      {getEnvironmentIcon(taskItem.taskEnvironment)}
                    </div>
                  </div>

                  {/* Actions - Visible on hover/tap */}
                  <div className={cn(
                    "flex flex-col gap-1 shrink-0",
                    "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                  )}>
                    {dbTask && (
                      <>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" size="icon" 
                              className={cn(
                                "h-7 w-7 rounded-md transition-colors",
                                dbTask.is_locked ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
                              )}
                              onClick={(e) => { e.stopPropagation(); toggleScheduledTaskLock({ taskId: dbTask.id, isLocked: !dbTask.is_locked }); }}
                            >
                              {dbTask.is_locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5 opacity-50" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Lock</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" size="icon" className="h-7 w-7 rounded-md text-logo-green hover:bg-logo-green/20"
                              onClick={(e) => { e.stopPropagation(); onCompleteTask(dbTask); }}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Complete</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" size="icon" className="h-7 w-7 rounded-md text-logo-orange hover:bg-logo-orange/20"
                              onClick={(e) => { e.stopPropagation(); onRetireTask(dbTask); }}
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Archive</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" size="icon" className="h-7 w-7 rounded-md text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => { e.stopPropagation(); onRemoveTask(dbTask.id); }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <ScheduledTaskDetailDialog
        task={selectedTask}
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setSelectedTask(null);
        }}
        selectedDayString={selectedDayString}
      />
    </div>
  );
});

SchedulerDisplay.displayName = 'SchedulerDisplay';

export default SchedulerDisplay;