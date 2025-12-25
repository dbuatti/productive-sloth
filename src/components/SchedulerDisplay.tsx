import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { ScheduledItem, FormattedSchedule, DisplayItem, TimeMarker, FreeTimeItem, DBScheduledTask, TaskEnvironment } from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { formatTime, getEmojiHue } from '@/lib/scheduler-utils'; 
import { Button } from '@/components/ui/button';
import { Trash, Archive, Lock, Unlock, Clock, Zap, CheckCircle, Star, Home, Laptop, Globe, Music, Utensils, CalendarDays, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, ListTodo, PlusCircle } from 'lucide-react';
import { startOfDay, addHours, addMinutes, isSameDay, parseISO, isBefore, isAfter, isPast, format, min, max, differenceInMinutes } from 'date-fns';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import ScheduledTaskDetailDialog from './ScheduledTaskDetailDialog';

interface SchedulerDisplayProps {
  schedule: FormattedSchedule | null;
  T_current: Date;
  onRemoveTask: (taskId: string, taskName: string, index: number) => void;
  onRetireTask: (task: DBScheduledTask) => void;
  onCompleteTask: (task: DBScheduledTask, index: number) => void;
  activeItemId: string | null;
  selectedDayString: string;
  onAddTaskClick: () => void;
  onScrollToItem: (itemId: string) => void;
  isProcessingCommand: boolean;
  onFreeTimeClick: (startTime: Date, endTime: Date) => void;
}

const getBubbleHeightStyle = (duration: number, isFreeTime: boolean = false) => {
  const baseHeight = 40;
  const taskMultiplier = 1.4;
  const freeTimeMultiplier = 0.4;
  const minCalculatedHeight = 44;

  const multiplier = isFreeTime ? freeTimeMultiplier : taskMultiplier;
  let calculatedHeight = baseHeight + (duration * multiplier);
  return { minHeight: `${Math.max(calculatedHeight, minCalculatedHeight)}px` };
};

const getEnvironmentIcon = (environment: TaskEnvironment) => {
  switch (environment) {
    case 'home': return <Home className="h-3.5 w-3.5" />;
    case 'laptop': return <Laptop className="h-3.5 w-3.5" />;
    case 'away': return <Globe className="h-3.5 w-3.5" />;
    case 'piano': return <Music className="h-3.5 w-3.5" />;
    case 'laptop_piano':
      return (
        <div className="relative">
          <Laptop className="h-3.5 w-3.5" />
          <Music className="h-2 w-2 absolute -bottom-0.5 -right-0.5" />
        </div>
      );
    default: return null;
  }
};

const SchedulerDisplay: React.FC<SchedulerDisplayProps> = React.memo(({ schedule, T_current, onRemoveTask, onRetireTask, onCompleteTask, activeItemId, selectedDayString, onAddTaskClick, onScrollToItem, isProcessingCommand, onFreeTimeClick }) => {
  const startOfTemplate = useMemo(() => startOfDay(T_current), [T_current]);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toggleScheduledTaskLock } = useSchedulerTasks(selectedDayString);

  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedScheduledTask, setSelectedScheduledTask] = useState<DBScheduledTask | null>(null);

  const { finalDisplayItems, firstItemStartTime, lastItemEndTime } = useMemo(() => {
    const scheduledTasks = schedule ? schedule.items : [];
    if (scheduledTasks.length === 0) {
        const workdayStart = startOfDay(parseISO(selectedDayString));
        const workdayEnd = addHours(workdayStart, 8);
        return {
            finalDisplayItems: [
                { id: `marker-start-empty`, type: 'marker', time: workdayStart, label: formatTime(workdayStart) },
                { id: `marker-end-empty`, type: 'marker', time: workdayEnd, label: formatTime(workdayEnd) },
            ] as DisplayItem[],
            firstItemStartTime: workdayStart,
            lastItemEndTime: workdayEnd,
        };
    }

    const allStartTimes = scheduledTasks.map(item => item.startTime);
    const allEndTimes = scheduledTasks.map(item => item.endTime);
    const actualStart = min(allStartTimes);
    const actualEnd = max(allEndTimes);

    const allEvents: (ScheduledItem | TimeMarker)[] = [...scheduledTasks];
    allEvents.push({ id: `marker-start-${format(actualStart, 'HHmm')}`, type: 'marker', time: actualStart, label: formatTime(actualStart) });
    allEvents.push({ id: `marker-end-${format(actualEnd, 'HHmm')}`, type: 'marker', time: actualEnd, label: formatTime(actualEnd) }); 

    allEvents.sort((a, b) => {
        const timeA = 'time' in a ? a.time : a.startTime;
        const timeB = 'time' in b ? b.time : b.startTime;
        return timeA.getTime() - timeB.getTime();
    });

    const processedItems: DisplayItem[] = [];
    let currentCursor = actualStart;

    allEvents.forEach(event => {
        const eventStartTime = 'time' in event ? event.time : event.startTime;
        const eventEndTime = 'time' in event ? event.time : event.endTime;

        if (eventStartTime.getTime() > currentCursor.getTime()) {
            const freeDurationMinutes = Math.floor((eventStartTime.getTime() - currentCursor.getTime()) / (1000 * 60));
            if (freeDurationMinutes > 0) {
                processedItems.push({
                    id: `free-${currentCursor.toISOString()}-${eventStartTime.toISOString()}`,
                    type: 'free-time',
                    startTime: currentCursor,
                    endTime: eventStartTime,
                    duration: freeDurationMinutes,
                    message: `${Math.floor(freeDurationMinutes / 60)}h ${freeDurationMinutes % 60}m Free Time`,
                });
            }
        }

        const isRedundantMarker = event.type === 'marker' && processedItems.some(pItem => 
            ('startTime' in pItem && pItem.startTime.getTime() === event.time.getTime()) ||
            ('endTime' in pItem && pItem.endTime.getTime() === event.time.getTime())
        );

        if (!isRedundantMarker) {
            processedItems.push(event);
        }
        
        const nextCursorTime = event.type === 'marker' ? event.time : eventEndTime;
        currentCursor = new Date(Math.max(currentCursor.getTime(), nextCursorTime.getTime()));
    });

    const filteredItems: DisplayItem[] = [];
    processedItems.forEach(item => {
        if (item.type === 'marker') {
            const isCovered = processedItems.some(pItem => {
                if (pItem.type === 'free-time' || pItem.type === 'task' || pItem.type === 'break' || pItem.type === 'time-off' || pItem.type === 'meal' || pItem.type === 'calendar-event') {
                    return item.time > pItem.startTime && item.time < pItem.endTime;
                }
                return false;
            });
            if (!isCovered) filteredItems.push(item);
        } else {
            filteredItems.push(item);
        }
    });

    return {
        finalDisplayItems: filteredItems.sort((a, b) => ('time' in a ? a.time : a.startTime).getTime() - ('time' in b ? b.time : b.startTime).getTime()),
        firstItemStartTime: actualStart,
        lastItemEndTime: actualEnd,
    };
  }, [schedule, selectedDayString]);

  const activeItemInDisplay = useMemo(() => {
    for (const item of finalDisplayItems) {
      if ((item.type === 'task' || item.type === 'break' || item.type === 'time-off' || item.type === 'meal' || item.type === 'calendar-event') && T_current >= item.startTime && T_current < item.endTime) {
        return item;
      }
    }
    return null;
  }, [finalDisplayItems, T_current]);

  const progressLineTopPercentage = useMemo(() => {
    if (!activeItemInDisplay) return 0;
    const itemStartTime = activeItemInDisplay.startTime.getTime();
    const itemEndTime = activeItemInDisplay.endTime.getTime();
    const itemDurationMs = itemEndTime - itemStartTime;
    if (itemDurationMs === 0) return 0;
    return ((T_current.getTime() - itemStartTime) / itemDurationMs) * 100;
  }, [activeItemInDisplay, T_current]);

  const isTodaySelected = isSameDay(parseISO(selectedDayString), T_current);

  const handleTaskItemClick = (event: React.MouseEvent, dbTask: DBScheduledTask) => {
    const target = event.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) return;
    setSelectedScheduledTask(dbTask);
    setIsDialogOpen(true);
  };

  const renderDisplayItem = (item: DisplayItem, index: number) => {
    const isCurrentlyActive = activeItemInDisplay?.id === item.id;
    const isHighlightedBySession = activeItemId === item.id;
    const isPastItem = (item.type === 'task' || item.type === 'break' || item.type === 'time-off' || item.type === 'meal' || item.type === 'calendar-event') && item.endTime <= T_current;

    if (item.type === 'marker') {
      return (
        <React.Fragment key={item.id}>
          <div className="flex items-center justify-end pr-3 py-1">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/60 whitespace-nowrap">
              {item.label}
            </span>
          </div>
          <div className="relative flex items-center h-0">
            <div className="h-px w-full bg-border/40 border-t border-dashed" />
          </div>
        </React.Fragment>
      );
    } else if (item.type === 'free-time') {
      const freeTimeItem = item as FreeTimeItem;
      const isActive = T_current >= freeTimeItem.startTime && T_current < freeTimeItem.endTime;

      return (
        <React.Fragment key={freeTimeItem.id}>
          <div></div>
          <div 
            id={`scheduled-item-${freeTimeItem.id}`}
            className={cn(
              "relative flex flex-col items-center justify-center rounded-xl transition-all duration-300 group cursor-pointer",
              "border-2 border-dashed border-muted-foreground/20 bg-muted/5",
              "hover:bg-primary/5 hover:border-primary/40 hover:scale-[1.01] shadow-sm hover:shadow-inner",
              isActive && isTodaySelected && "bg-live-progress/5 border-live-progress/40 animate-pulse-glow"
            )}
            style={getBubbleHeightStyle(freeTimeItem.duration, true)} 
            onClick={() => onFreeTimeClick(freeTimeItem.startTime, freeTimeItem.endTime)} 
          >
            <div className="flex items-center gap-2 text-muted-foreground/60 font-semibold group-hover:text-primary/60 transition-colors">
              <Plus className="h-4 w-4" />
              <span className="text-xs uppercase tracking-widest">{freeTimeItem.message}</span>
            </div>
          </div>
        </React.Fragment>
      );
    } else {
      const scheduledItem = item as ScheduledItem;
      const isActive = T_current >= scheduledItem.startTime && T_current < scheduledItem.endTime;
      const isLocked = scheduledItem.isLocked;
      const isFixed = !scheduledItem.isFlexible;
      const isCompleted = scheduledItem.isCompleted;
      const isCalendarEvent = scheduledItem.type === 'calendar-event';

      const hue = getEmojiHue(scheduledItem.name);
      const ambientBackgroundColor = `hsl(${hue} 45% ${isLocked ? '25%' : '35%'}% / 0.95)`;
      const dbTask = scheduledItem.id !== 'regen-pod-active' ? schedule?.dbTasks.find(t => t.id === scheduledItem.id) : null;

      const isFixedOrTimed = isFixed || scheduledItem.type === 'time-off' || scheduledItem.type === 'meal' || scheduledItem.id === 'regen-pod-active' || isCalendarEvent;
      
      if (isCompleted && !isFixedOrTimed) return null;

      return (
        <React.Fragment key={scheduledItem.id}>
          {/* Time Marker Column */}
          <div className="flex items-center justify-end pr-3">
            <div className={cn(
              "px-2 py-1 rounded-md text-[10px] font-mono font-bold transition-all duration-300",
              isActive && isTodaySelected ? "bg-primary text-primary-foreground shadow-glow scale-110" : "bg-secondary/80 text-muted-foreground",
              isPastItem && "opacity-40 grayscale"
            )}>
              {formatTime(scheduledItem.startTime)}
            </div>
          </div>

          {/* Task Bubble Column */}
          <div
            id={`scheduled-item-${scheduledItem.id}`}
            className={cn(
              "relative flex flex-col justify-center gap-1 p-4 rounded-xl shadow-md transition-all duration-500 ease-out animate-pop-in overflow-hidden cursor-pointer border-2",
              isActive && isTodaySelected ? "border-live-progress shadow-[0_0_15px_rgba(var(--live-progress),0.3)] animate-pulse-active-row z-10" : "border-white/5",
              isLocked && "ring-2 ring-primary/40 ring-offset-1 ring-offset-background",
              scheduledItem.isCritical && "ring-2 ring-logo-yellow/40",
              isCompleted && isFixedOrTimed ? "opacity-50 line-through scale-[0.98]" : "opacity-100",
              isPastItem && "opacity-60 grayscale-[0.3]",
              "hover:scale-[1.02] hover:shadow-2xl hover:border-white/20"
            )}
            style={{ ...getBubbleHeightStyle(scheduledItem.duration), backgroundColor: ambientBackgroundColor }}
            onClick={(e) => !isCalendarEvent && dbTask && handleTaskItemClick(e, dbTask)}
          >
            {/* Background Emoji Icon */}
            <div className="absolute top-1/2 -right-2 -translate-y-1/2 pointer-events-none opacity-10 blur-[1px]">
              <span className="text-[7rem] leading-none">{scheduledItem.emoji}</span>
            </div>

            <div className="relative z-10 flex flex-col w-full gap-1">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2 min-w-0">
                  {dbTask && !isFixedOrTimed && !isCalendarEvent && (
                    <Button 
                      variant="ghost" size="icon" 
                      onClick={(e) => { e.stopPropagation(); onCompleteTask(dbTask, index); }}
                      className="h-6 w-6 rounded-full bg-black/20 text-logo-green hover:bg-black/40"
                    >
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                  )}
                  {isCalendarEvent && <CalendarDays className="h-4 w-4 text-blue-300" />}
                  
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                       <span className="text-sm">{scheduledItem.emoji}</span>
                       <h3 className="font-bold text-white truncate text-base tracking-tight leading-none uppercase">
                        {scheduledItem.name}
                       </h3>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {scheduledItem.energyCost !== 0 && (
                    <div className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-black/20 flex items-center gap-1",
                      scheduledItem.energyCost < 0 ? "text-logo-green" : "text-logo-yellow"
                    )}>
                      {scheduledItem.energyCost > 0 ? scheduledItem.energyCost : `+${Math.abs(scheduledItem.energyCost)}`}
                      {scheduledItem.energyCost > 0 ? <Zap className="h-3 w-3" /> : <Utensils className="h-3 w-3" />}
                    </div>
                  )}
                  <div className="p-1 rounded bg-black/20 text-white/70">
                    {getEnvironmentIcon(scheduledItem.taskEnvironment)}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-1">
                <div className="flex items-center gap-3 text-[10px] font-bold text-white/80 uppercase tracking-widest">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTime(scheduledItem.startTime)} - {formatTime(scheduledItem.endTime)}
                  </div>
                  <span className="bg-white/10 px-1 rounded">{scheduledItem.duration}m</span>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                   {/* Context specific action buttons could go here */}
                </div>
              </div>
            </div>

            {isActive && isTodaySelected && (
              <>
                <div 
                  className="absolute left-0 right-0 h-[3px] bg-live-progress z-20 shadow-[0_0_8px_hsl(var(--live-progress))]"
                  style={{ top: `${progressLineTopPercentage}%` }}
                />
                <div className="absolute left-0 -translate-x-full pr-3 z-30" style={{ top: `calc(${progressLineTopPercentage}% - 8px)` }}>
                  <span className="px-1.5 py-0.5 rounded bg-live-progress text-black text-[9px] font-black uppercase whitespace-nowrap tracking-tighter"> 
                    NOW
                  </span>
                </div>
              </>
            )}
          </div>
        </React.Fragment>
      );
    }
  };

  return (
    <div className="space-y-4">
        <div ref={containerRef} className="relative p-2 overflow-y-auto">
          <div className="absolute left-[54px] top-0 bottom-0 w-px border-l-2 border-dashed border-border/20 z-0" />
          <div className="grid grid-cols-[54px_1fr] gap-x-4 gap-y-3">
            {schedule?.items.length === 0 ? (
              <div className="col-span-2 text-center text-muted-foreground flex flex-col items-center justify-center space-y-6 py-16">
                <div className="h-20 w-20 rounded-full bg-secondary/30 flex items-center justify-center border-2 border-dashed border-border">
                  <ListTodo className="h-10 w-10 text-muted-foreground/40" />
                </div>
                <div className="space-y-1">
                  <p className="text-xl font-bold text-foreground">Schedule Vacant</p>
                  <p className="text-sm">Initiate your daily flow by adding a new objective.</p>
                </div>
                <Button onClick={onAddTaskClick} className="rounded-full px-8 h-12 text-base font-bold bg-primary hover:bg-primary/90 shadow-lg animate-pulse-glow">
                  <PlusCircle className="h-5 w-5 mr-2" /> Add Objective
                </Button>
              </div>
            ) : (
              finalDisplayItems.map((item, index) => renderDisplayItem(item, index))
            )}
          </div>
        </div>
      <ScheduledTaskDetailDialog
        task={selectedScheduledTask}
        open={isDialogOpen}
        onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setSelectedScheduledTask(null); }}
        selectedDayString={selectedDayString}
      />
    </div>
  );
});

export default SchedulerDisplay;