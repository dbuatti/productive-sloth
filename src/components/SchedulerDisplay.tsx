"use client";

import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { 
  ScheduledItem, FormattedSchedule, DisplayItem, TimeMarker, 
  FreeTimeItem, DBScheduledTask, TaskEnvironment 
} from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { formatTime, getEmojiHue } from '@/lib/scheduler-utils';
import { Button } from '@/components/ui/button';
import { 
  Trash2, Archive, Lock, Unlock, Clock, Zap, 
  CheckCircle2, Star, Home, Laptop, Globe, Music, 
  Info, ChevronDown, Target
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { format, differenceInMinutes, isSameDay, parseISO, min, max, isPast, addMinutes } from 'date-fns';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import ScheduledTaskDetailDialog from './ScheduledTaskDetailDialog';
import { Badge } from '@/components/ui/badge';

interface SchedulerDisplayProps {
  schedule: FormattedSchedule | null;
  T_current: Date;
  onRemoveTask: (taskId: string, taskName: string, index: number) => void;
  onRetireTask: (task: DBScheduledTask) => void;
  onCompleteTask: (task: DBScheduledTask, index?: number) => void;
  activeItemId: string | null;
  selectedDayString: string; // Added selectedDayString prop
  onAddTaskClick: () => void;
  onScrollToItem: (itemId: string) => void;
  isProcessingCommand: boolean;
  onFreeTimeClick: (startTime: Date, endTime: Date) => void;
}

const MINUTE_HEIGHT = 2.5; // 1 minute = 2.5px height allotment

const getEnvironmentIcon = (environment: TaskEnvironment) => {
  const iconClass = "h-3.5 w-3.5 opacity-70";
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
  selectedDayString, // Destructured selectedDayString
  onFreeTimeClick,
  onScrollToItem
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { toggleScheduledTaskLock } = useSchedulerTasks(selectedDayString);
  const [selectedTask, setSelectedTask] = useState<DBScheduledTask | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showSyncButton, setShowSyncButton] = useState(false);

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
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed rounded-3xl border-white/5 bg-secondary/5">
        <Clock className="h-12 w-12 mb-4 opacity-20" />
        <p className="font-black uppercase tracking-widest text-xs text-primary/60">Timeline Flatlined</p>
        <Button variant="link" onClick={() => onFreeTimeClick(new Date(), addMinutes(new Date(), 30))} className="text-[10px] mt-2 opacity-50 uppercase tracking-tighter">
          Initialize Temporal Sequence
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      {showSyncButton && activeItemId && (
        <Button 
          onClick={() => onScrollToItem(activeItemId)}
          className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[100] rounded-full bg-primary/90 shadow-[0_0_20px_rgba(var(--primary-rgb),0.4)]"
          size="sm"
        >
          <Target className="h-4 w-4 mr-2" /> Sync to Now
        </Button>
      )}

      <div ref={containerRef} className="relative pl-14 pr-2 py-6 custom-scrollbar"> {/* Removed max-h-[70vh] and overflow-y-auto */}
        <div className="absolute left-[3.75rem] top-0 bottom-0 w-px bg-gradient-to-b from-primary/50 via-primary/10 to-transparent" />

        {finalDisplayItems.map((item, index) => {
          if (item.type === 'free-time') {
            const gap = item as FreeTimeItem;
            return (
              <div 
                key={gap.id}
                className="group relative flex gap-6 mb-4 cursor-crosshair"
                style={{ height: `${gap.duration * MINUTE_HEIGHT}px` }}
                onClick={() => onFreeTimeClick(gap.startTime, gap.endTime)}
              >
                <div className="w-10 text-right opacity-20 font-mono text-[9px] pt-1">{format(gap.startTime, 'HH:mm')}</div>
                <div className="flex-1 flex items-center justify-center border border-dashed border-white/5 rounded-2xl hover:bg-white/[0.02] transition-colors">
                  <span className="opacity-0 group-hover:opacity-100 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 transition-opacity">
                    Inject Sequence ({gap.duration}m)
                  </span>
                </div>
              </div>
            );
          }

          const taskItem = item as ScheduledItem;
          const dbTask = schedule.dbTasks.find(t => t.id === taskItem.id);
          const isActive = taskItem.id === activeItemId;
          const isPastItem = isPast(taskItem.endTime) && !isActive; // Keep visual fade for past items, but allow interaction
          const duration = differenceInMinutes(taskItem.endTime, taskItem.startTime);

          const hue = getEmojiHue(taskItem.name);
          const emojiBackgroundColor = `hsl(${hue} 50% 35% / 0.3)`; // Opaque version
          const accentBorderColor = `hsl(${hue} 70% 50%)`; // For the left border

          return (
            <div key={taskItem.id} className="relative group flex gap-6 mb-4">
              <div className="w-10 text-right shrink-0 pt-1">
                <span className={cn(
                  "text-[10px] font-black font-mono leading-none transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground/40"
                )}>
                  {format(taskItem.startTime, 'HH:mm')}
                </span>
              </div>

              <div className="relative z-10 mt-2 shrink-0">
                <div className={cn(
                  "h-3 w-3 rounded-full border-2 border-background transition-all duration-700",
                  isActive ? "bg-primary scale-150 shadow-[0_0_15px_rgba(var(--primary-rgb),0.6)]" : "bg-secondary border-primary/20",
                  isPastItem && "opacity-30 grayscale" // Keep visual fade
                )} />
              </div>

              <div 
                className={cn(
                  "flex-1 rounded-2xl border transition-all duration-300 relative overflow-hidden flex flex-col justify-between p-4",
                  isActive ? "bg-primary/10 border-primary/40 shadow-2xl ring-1 ring-primary/20" : "bg-card/30 border-white/10 hover:border-primary/30",
                  isPastItem && "opacity-40 grayscale" // Keep visual fade, removed pointer-events-none
                )}
                style={{ 
                  minHeight: `${duration * MINUTE_HEIGHT}px`,
                  backgroundColor: isActive ? undefined : emojiBackgroundColor, // Apply background only if not active
                  borderLeft: isActive ? '4px solid hsl(var(--primary))' : `4px solid ${accentBorderColor}` // Dynamic left border
                }}
                onClick={() => dbTask && handleTaskClick(dbTask)}
              >
                {isActive && <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent animate-pulse" />}

                {/* Emoji at top-left */}
                <div className="absolute top-4 left-4 text-3xl z-10 opacity-80 group-hover:scale-110 transition-transform duration-300">
                  {taskItem.emoji}
                </div>

                <div className="flex justify-between items-start relative z-10 gap-4 pl-12"> {/* Added pl-12 */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn(
                        "text-sm font-black uppercase tracking-tight truncate",
                        isActive ? "text-primary" : "text-foreground"
                      )}>
                        {taskItem.name}
                      </span>
                      {getEnvironmentIcon(taskItem.taskEnvironment)}
                    </div>
                    
                    <div className="flex items-center gap-3 text-[10px] font-mono font-bold opacity-50">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {duration}m</span>
                      {taskItem.isCritical && <span className="text-logo-yellow flex items-center gap-1"><Zap className="h-3 w-3 fill-current" /> CRITICAL</span>}
                    </div>
                  </div>

                  {/* RESTORED & IMPROVED ACTIONS AREA */}
                  <div className="flex items-center gap-1.5 shrink-0 bg-background/40 p-1 rounded-lg border border-white/5">
                    {dbTask && ( // Removed !isPastItem condition here
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
                          <TooltipContent className="glass-card text-[9px] font-black uppercase">Anchor Task</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" size="icon" className="h-7 w-7 rounded-md text-logo-green hover:bg-logo-green/20"
                              onClick={(e) => { e.stopPropagation(); onCompleteTask(dbTask, index); }}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="glass-card text-[9px] font-black uppercase">Complete</TooltipContent>
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
                          <TooltipContent className="glass-card text-[9px] font-black uppercase">Return to Sink</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" size="icon" className="h-7 w-7 rounded-md text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => { e.stopPropagation(); onRemoveTask(dbTask.id, dbTask.name, index); }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="glass-card text-[9px] font-black uppercase">Purge Data</TooltipContent>
                        </Tooltip>
                      </>
                    )}
                    
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground">
                      <Info className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="relative z-10 flex justify-between items-end mt-4">
                  <div className="text-[9px] font-black opacity-30 uppercase tracking-widest font-mono">
                    {format(taskItem.startTime, 'p')} — {format(taskItem.endTime, 'p')}
                  </div>
                  {isActive && (
                    <Badge variant="secondary" className="text-[8px] px-1.5 py-0 bg-primary/20 text-primary border-none">LIVE SEQUENCE</Badge>
                  )}
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