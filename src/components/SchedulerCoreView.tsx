import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { ScheduledItem, FormattedSchedule, DisplayItem, TimeMarker, FreeTimeItem, CurrentTimeMarker, DBScheduledTask, TaskEnvironment } from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { formatTime, getEmojiHue, isMeal } from '@/lib/scheduler-utils'; // Import isMeal
import { Button } from '@/components/ui/button';
import { Trash, Archive, AlertCircle, Lock, Unlock, Clock, Zap, CheckCircle, Star, Home, Laptop, Globe, Music, Utensils, CalendarDays } from 'lucide-react'; // Import CalendarDays
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, BarChart, ListTodo, PlusCircle } from 'lucide-react';
import { startOfDay, addHours, addMinutes, isSameDay, parseISO, isBefore, isAfter, isPast, format, min, max } from 'date-fns';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import ScheduledTaskDetailDialog from './ScheduledTaskDetailDialog';

interface SchedulerCoreViewProps { // Renamed from SchedulerDisplayProps to SchedulerCoreViewProps
  schedule: FormattedSchedule | null; // Added this prop
  T_current: Date;
  onRemoveTask: (taskId: string, taskName: string, index: number) => void; // Changed signature
  onRetireTask: (task: DBScheduledTask) => void;
  onCompleteTask: (task: DBScheduledTask, index: number) => void; // Changed signature
  activeItemId: string | null;
  selectedDayString: string;
  onAddTaskClick: () => void;
  onScrollToItem: (itemId: string) => void; // NEW: Prop for scrolling to a specific item
  isProcessingCommand: boolean; // ADDED
  onFreeTimeClick: (startTime: Date, endTime: Date) => void; // NEW PROP
  scheduleContainerRef: React.RefObject<HTMLDivElement>; // NEW: Added scheduleContainerRef
}

const getBubbleHeightStyle = (duration: number, isFreeTime: boolean = false) => {
  const baseHeight = 40;
  const taskMultiplier = 1.5;
  const freeTimeMultiplier = 0.5; // Reduced multiplier for free time
  const minCalculatedHeight = 40;

  const multiplier = isFreeTime ? freeTimeMultiplier : taskMultiplier;

  let calculatedHeight = baseHeight + (duration * multiplier);
  return { minHeight: `${Math.max(calculatedHeight, minCalculatedHeight)}px` };
};

const getEnvironmentIcon = (environment: TaskEnvironment) => {
  switch (environment) {
    case 'home':
      return <Home className="h-4 w-4 text-logo-green" />; // Reduced size
    case 'laptop':
      return <Laptop className="h-4 w-4 text-primary" />; // Reduced size
    case 'away':
      return <Globe className="h-4 w-4 text-logo-orange" />; // Reduced size
    case 'piano':
      return <Music className="h-4 w-4 text-accent" />; // Reduced size
    case 'laptop_piano':
      return (
        <div className="relative">
          <Laptop className="h-4 w-4 text-primary" /> {/* Reduced size */}
          <Music className="h-2.5 w-2.5 absolute -bottom-0.5 -right-0.5 text-accent" /> {/* Reduced size */}
        </div>
      );
    default:
      return null;
  }
};

const SchedulerCoreView: React.FC<SchedulerCoreViewProps> = React.memo(({ schedule, T_current, onRemoveTask, onRetireTask, onCompleteTask, activeItemId, selectedDayString, onAddTaskClick, onScrollToItem, isProcessingCommand, onFreeTimeClick, scheduleContainerRef }) => {
  const startOfTemplate = useMemo(() => startOfDay(T_current), [T_current]);
  const endOfTemplate = useMemo(() => addHours(startOfTemplate, 24), [startOfTemplate]);
  // const containerRef = useRef<HTMLDivElement>(null); // Removed local ref, using prop

  const { toggleScheduledTaskLock, updateScheduledTaskStatus } = useSchedulerTasks(selectedDayString);

  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedScheduledTask, setSelectedScheduledTask] = useState<DBScheduledTask | null>(null);

  const { finalDisplayItems, firstItemStartTime, lastItemEndTime } = useMemo(() => {
    const scheduledTasks = schedule ? schedule.items : [];
    
    if (scheduledTasks.length === 0) {
        // If no tasks, use the workday start/end as the boundary for display
        const workdayStart = schedule?.dbTasks.length > 0 ? parseISO(schedule.dbTasks[0].scheduled_date) : startOfDay(parseISO(selectedDayString));
        const workdayEnd = schedule?.summary.sessionEnd || addHours(workdayStart, 8);
        
        return {
            finalDisplayItems: [
                { id: `marker-start-empty`, type: 'marker', time: workdayStart, label: formatTime(workdayStart) },
                { id: `marker-end-empty`, type: 'marker', time: workdayEnd, label: formatTime(workdayEnd) },
            ] as DisplayItem[],
            firstItemStartTime: workdayStart,
            lastItemEndTime: workdayEnd,
        };
    }

    // Determine the actual start and end times of the scheduled items
    const allStartTimes = scheduledTasks.map(item => item.startTime);
    const allEndTimes = scheduledTasks.map(item => item.endTime);
    
    const actualStart = min(allStartTimes);
    const actualEnd = max(allEndTimes);

    const allEvents: (ScheduledItem | TimeMarker)[] = [...scheduledTasks];

    // Add markers only at the actual start and end of the schedule
    allEvents.push({ id: `marker-start-${format(actualStart, 'HHmm')}`, type: 'marker', time: actualStart, label: formatTime(actualStart) });
    allEvents.push({ id: `marker-end-${format(actualEnd, 'HHmm')}`, type: 'marker', time: actualEnd, label: formatTime(actualEnd) }); 

    allEvents.sort((a, b) => {
        const timeA = 'time' in a ? a.time : a.startTime;
        const timeB = 'time' in b ? b.time : b.startTime;
        return timeA.getTime() - timeB.getTime();
    });

    const processedItems: DisplayItem[] = [];
    let currentCursor = actualStart; // Start cursor at the actual start time

    allEvents.forEach(event => {
        const eventStartTime = 'time' in event ? event.time : event.startTime;
        const eventEndTime = 'time' in event ? event.time : event.endTime;

        // Only generate free time if the gap is within the actual scheduled range
        if (eventStartTime.getTime() > currentCursor.getTime()) {
            const freeDurationMs = eventStartTime.getTime() - currentCursor.getTime();
            const freeDurationMinutes = Math.floor(freeDurationMs / (1000 * 60));
            if (freeDurationMinutes > 0) {
                processedItems.push({
                    id: `free-${currentCursor.toISOString()}-${eventStartTime.toISOString()}`,
                    type: 'free-time',
                    startTime: currentCursor,
                    endTime: eventStartTime,
                    duration: freeDurationMinutes,
                    message: `${Math.floor(freeDurationMinutes / 60)}h ${freeDurationMinutes % 60}min Free Time`,
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
        
        // FIX: Ensure the cursor only advances, preventing time markers that share a start time 
        // with a preceding task from resetting the cursor back to the start time.
        const nextCursorTime = event.type === 'marker' ? event.time : eventEndTime;
        currentCursor = new Date(Math.max(currentCursor.getTime(), nextCursorTime.getTime()));
    });

    // Filter out redundant markers (markers that fall exactly on the start/end of a task/free-time block)
    const filteredItems: DisplayItem[] = [];
    processedItems.forEach(item => {
        if (item.type === 'marker') {
            const isCovered = processedItems.some(pItem => {
                if (pItem.type === 'free-time' || pItem.type === 'task' || pItem.type === 'break' || pItem.type === 'time-off' || pItem.type === 'meal' || pItem.type === 'calendar-event') {
                    return item.time > pItem.startTime && item.time < pItem.endTime; // Marker is strictly inside a block
                }
                return false;
            });
            // Keep markers that are at the start/end of the overall schedule, or are not covered by a block
            if (!isCovered) {
                filteredItems.push(item);
            }
        } else {
            filteredItems.push(item);
        }
    });

    // Ensure the first and last markers are present
    const hasStartMarker = filteredItems.some(item => ('startTime' in item ? item.startTime : item.time).getTime() === actualStart.getTime());
    if (!hasStartMarker) {
        filteredItems.unshift({ id: `marker-start-final-${format(actualStart, 'HHmm')}`, type: 'marker', time: actualStart, label: formatTime(actualStart) });
    }
    const hasEndMarker = filteredItems.some(item => ('endTime' in item ? item.endTime : item.time).getTime() === actualEnd.getTime());
    if (!hasEndMarker) {
        filteredItems.push({ id: `marker-end-final-${format(actualEnd, 'HHmm')}`, type: 'marker', time: actualEnd, label: formatTime(actualEnd) });
    }

    filteredItems.sort((a, b) => {
        const timeA = 'time' in a ? a.time : a.startTime;
        const timeB = 'time' in b ? b.time : b.startTime;
        return timeA.getTime() - timeB.getTime();
    });

    return {
        finalDisplayItems: filteredItems,
        firstItemStartTime: actualStart,
        lastItemEndTime: actualEnd,
    };
  }, [schedule, T_current, selectedDayString]);

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

    const timeIntoItemMs = T_current.getTime() - itemStartTime;
    return (timeIntoItemMs / itemDurationMs) * 100;
  }, [activeItemInDisplay, T_current]);

  const globalProgressLineTopPercentage = useMemo(() => {
    if (!scheduleContainerRef.current || !firstItemStartTime || !lastItemEndTime) return 0;

    const totalScheduleDurationMs = lastItemEndTime.getTime() - firstItemStartTime.getTime();
    if (totalScheduleDurationMs <= 0) return 0;

    const timeIntoScheduleMs = T_current.getTime() - firstItemStartTime.getTime();
    return (timeIntoScheduleMs / totalScheduleDurationMs) * 100;
  }, [T_current, firstItemStartTime, lastItemEndTime, scheduleContainerRef]);


  useEffect(() => {
    if (scheduleContainerRef.current) {
      scheduleContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [selectedDayString, scheduleContainerRef]);

  const handleInfoChipClick = (dbTask: DBScheduledTask) => {
    console.log("SchedulerCoreView: InfoChip clicked for task:", dbTask.name);
    setSelectedScheduledTask(dbTask);
    setIsDialogOpen(true);
  };

  const handleTaskItemClick = (event: React.MouseEvent, dbTask: DBScheduledTask) => {
    console.log("SchedulerCoreView: Task item clicked for task:", dbTask.name, "Event target:", event.target);
    const target = event.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) {
      console.log("SchedulerCoreView: Click originated from an interactive child, preventing dialog open.");
      return;
    }
    setSelectedScheduledTask(dbTask);
    setIsDialogOpen(true);
    console.log("SchedulerCoreView: Setting isDialogOpen to true for task:", dbTask.name);
  };

  const totalScheduledMinutes = schedule ? (schedule.summary.activeTime.hours * 60 + schedule.summary.activeTime.minutes + schedule.summary.breakTime) : 0;

  const isTodaySelected = isSameDay(parseISO(selectedDayString), T_current);

  const renderDisplayItem = (item: DisplayItem, index: number) => {
    const isCurrentlyActive = activeItemInDisplay?.id === item.id;
    const isHighlightedBySession = activeItemId === item.id;
    const isPastItem = (item.type === 'task' || item.type === 'break' || item.type === 'time-off' || item.type === 'meal' || item.type === 'calendar-event') && item.endTime <= T_current;

    if (item.type === 'marker') {
      return (
        <React.Fragment key={item.id}>
          {/* Column 1: Time Label (Right Aligned) */}
          <div className="flex items-center justify-end pr-2 relative">
            <span className="text-base font-bold text-foreground whitespace-nowrap">
              {item.label}
            </span>
          </div>
          {/* Column 2: Horizontal line extending into task area */}
          <div className="relative flex items-center h-0">
            <div className="h-px w-full bg-border" />
          </div>
        </React.Fragment>
      );
    } else if (item.type === 'free-time') {
      const freeTimeItem = item as FreeTimeItem;
      const isActive = T_current >= freeTimeItem.startTime && T_current < freeTimeItem.endTime;
      const isHighlightedByNowCard = activeItemId === freeTimeItem.id;

      return (
        <React.Fragment key={freeTimeItem.id}>
          {/* Column 1: Empty space */}
          <div></div>
          {/* Column 2: Free Time Bubble */}
          <div 
            id={`scheduled-item-${freeTimeItem.id}`}
            className={cn(
              "relative flex flex-col items-center justify-center text-muted-foreground italic text-sm h-[25px] rounded-lg shadow-sm transition-all duration-200 ease-in-out cursor-pointer", 
              "border-2 border-dashed", 
              isHighlightedByNowCard ? "opacity-50 border-border" :
              isActive ? "bg-live-progress/10 border-live-progress animate-pulse-active-row" : "bg-secondary/50 hover:bg-secondary/70 border-secondary hover:border-primary/50", 
              isPastItem && "opacity-50 border-muted-foreground/30"
            )}
            style={getBubbleHeightStyle(freeTimeItem.duration, true)} 
            onClick={() => onFreeTimeClick(freeTimeItem.startTime, freeTimeItem.endTime)} 
          >
            <span className="text-base font-semibold text-muted-foreground/80">{freeTimeItem.message}</span>
            <span className="text-xs text-muted-foreground/60 mt-1">Click to inject a task here</span>
          </div>
        </React.Fragment>
      );
    } else {
      const scheduledItem = item as ScheduledItem;
      const isActive = T_current >= scheduledItem.startTime && T_current < scheduledItem.endTime;
      const isHighlightedBySession = activeItemId === scheduledItem.id;
      const isLocked = scheduledItem.isLocked;
      const isFixed = !scheduledItem.isFlexible;
      const isCompleted = scheduledItem.isCompleted;
      const isMissed = isLocked && isPast(scheduledItem.endTime) && !isSameDay(scheduledItem.endTime, T_current) && !isCompleted;
      const isCalendarEvent = scheduledItem.type === 'calendar-event'; // NEW: Calendar event flag

      if (scheduledItem.endTime < startOfTemplate) return null;

      const hue = getEmojiHue(scheduledItem.name);
      const saturation = 50;
      const lightness = isLocked ? 25 : 35;
      const ambientBackgroundColor = `hsl(${hue} ${saturation}% ${lightness}%)`;

      // Find the corresponding DB task only if it's not the dynamic Pod item
      const dbTask = scheduledItem.id !== 'regen-pod-active' 
        ? schedule?.dbTasks.find(t => t.id === scheduledItem.id) 
        : null;

      const isTimeOff = scheduledItem.type === 'time-off';
      const isBreak = scheduledItem.type === 'break';
      const isMealTask = scheduledItem.type === 'meal';
      const isRegenPod = scheduledItem.id === 'regen-pod-active';

      // Determine background color based on type
      let itemBgColor = ambientBackgroundColor;
      if (isTimeOff) {
        itemBgColor = undefined; // Use default card background for time off
      } else if (isMealTask) {
        itemBgColor = `hsl(140 50% 35% / 0.3)`; // Fixed green hue for meals
      } else if (isRegenPod) { // NEW: Pod styling
        itemBgColor = `hsl(120 50% 35% / 0.5)`; // Green hue for recovery
      } else if (isCalendarEvent) { // NEW: Calendar event styling
        itemBgColor = `hsl(240 50% 30% / 0.5)`; // Darker blue/purple for external events
      }

      // Determine text color
      const itemTextColor = isTimeOff ? 'text-logo-green' : (isMealTask ? 'text-logo-green' : (isRegenPod ? 'text-logo-green' : (isCalendarEvent ? 'text-primary-foreground' : 'text-[hsl(var(--always-light-text))]')));

      // Determine completion visual style
      const isFixedOrTimed = isFixed || isTimeOff || isMealTask || isRegenPod || isCalendarEvent; // UPDATED: Include calendar events
      const completionClasses = isCompleted && isFixedOrTimed ? "opacity-70" : (isCompleted ? "hidden" : "opacity-100");
      
      // If the task is completed and is NOT a fixed/timed event, we hide it.
      if (isCompleted && !isFixedOrTimed) {
        return null;
      }

      // Calendar events are read-only: disable actions
      const isReadOnly = isCalendarEvent;

      return (
        <React.Fragment key={scheduledItem.id}>
          {/* Column 1: Time Label */}
          <div className="flex items-center justify-end pr-2">
            <span className={cn(
              "px-3 py-1 rounded-md text-sm font-mono transition-colors duration-200",
              isHighlightedBySession ? "bg-primary text-primary-foreground" :
              isActive ? "bg-primary/20 text-primary" :
              isPastItem ? "bg-muted text-muted-foreground" : "bg-secondary text-secondary-foreground",
              "hover:scale-105",
              isCompleted && isFixedOrTimed && "line-through opacity-70"
            )}>
              {formatTime(scheduledItem.startTime)}
            </span>
          </div>

          {/* Column 2: Task Bubble */}
          <div
            id={`scheduled-item-${scheduledItem.id}`}
            className={cn(
              "relative flex flex-col justify-center gap-1 p-3 rounded-lg shadow-md transition-all duration-200 ease-in-out animate-pop-in overflow-hidden cursor-pointer", 
              "border-2",
              isHighlightedBySession ? "opacity-50" :
              isActive ? "border-live-progress animate-pulse-active-row" :
              isPastItem ? "opacity-50 border-muted-foreground/30" : "border-border",
              isLocked && "border-[3px] border-primary/70",
              scheduledItem.isCritical && "ring-2 ring-logo-yellow/50",
              completionClasses,
              "hover:scale-[1.03] hover:shadow-xl hover:shadow-primary/30 hover:border-primary",
              isCalendarEvent && "border-blue-500/70 bg-blue-900/50 hover:border-blue-500" // Calendar specific styling
            )}
            style={{ ...getBubbleHeightStyle(scheduledItem.duration), backgroundColor: itemBgColor }}
            onMouseEnter={() => setHoveredItemId(scheduledItem.id)}
            onMouseLeave={() => setHoveredItemId(null)}
            onClick={(e) => {
              if (!isReadOnly) {
                dbTask && handleTaskItemClick(e, dbTask);
              }
            }}
          >
            <div className="absolute inset-0 flex items-center justify-end pointer-events-none">
              <span className="text-[8rem] opacity-10 select-none"> 
                {scheduledItem.emoji}
              </span>
            </div>

            <div className="relative z-10 flex flex-col w-full">
              
              {/* Row 1: Completion Button (Left) and Task Name/Metadata (Right) */}
              <div className="flex items-center justify-between w-full">
                {/* Completion Button (Left) */}
                {dbTask && !isTimeOff && !isRegenPod && !isCalendarEvent && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={(e) => {
                          e.stopPropagation();
                          onCompleteTask(dbTask, index);
                        }}
                        disabled={isLocked || isReadOnly}
                        className={cn(
                          "h-6 w-6 p-0 shrink-0 mr-2", 
                          (isLocked || isReadOnly) ? "text-muted-foreground/50 cursor-not-allowed" : "text-logo-green hover:bg-logo-green/20"
                        )}
                        style={(isLocked || isReadOnly) ? { pointerEvents: 'auto' } : undefined}
                      >
                        <CheckCircle className="h-4 w-4" /> 
                        <span className="sr-only">Complete task</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{isLocked ? "Unlock to Complete" : "Mark as Complete"}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                {isCalendarEvent && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <CalendarDays className="h-5 w-5 text-blue-300 shrink-0 mr-2" />
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>iCloud Calendar Event</p>
                        </TooltipContent>
                    </Tooltip>
                )}

                {/* Task Name & Condensed Metadata */}
                <span className={cn(
                  "text-sm flex-grow min-w-0 pr-2", 
                  itemTextColor,
                  isCompleted && isFixedOrTimed && "line-through text-muted-foreground"
                )}>
                  <div className="flex items-center gap-2 w-full">
                    {scheduledItem.isCritical && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="relative flex items-center justify-center h-3 w-3 rounded-full bg-logo-yellow text-white shrink-0"> 
                            <Star className="h-2.5 w-2.5" strokeWidth={2.5} /> 
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Critical Task</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    <span className="text-lg">{scheduledItem.emoji}</span> 
                    <span className={cn("font-bold truncate block text-base", isLocked ? "text-primary" : "text-foreground")}>{scheduledItem.name}</span> 
                    
                    {/* Energy Cost / Gain */}
                    {scheduledItem.energyCost !== undefined && scheduledItem.energyCost !== 0 && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className={cn(
                                    "flex items-center gap-1 font-semibold font-mono text-xs px-1 py-0.5 rounded-sm",
                                    scheduledItem.energyCost < 0 ? "text-logo-green bg-logo-green/30" : "text-logo-yellow bg-logo-yellow/30",
                                    isCompleted && isFixedOrTimed && "text-muted-foreground/80"
                                )}>
                                    {scheduledItem.energyCost > 0 ? scheduledItem.energyCost : `+${Math.abs(scheduledItem.energyCost)}`} 
                                    {scheduledItem.energyCost > 0 ? <Zap className="h-3 w-3" /> : <Utensils className="h-3 w-3" />} 
                                </span>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{scheduledItem.energyCost > 0 ? "Energy Cost" : "Energy Gain (Meal)"}</p>
                            </TooltipContent>
                        </Tooltip>
                    )}

                    {/* Environment Icon */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="h-4 w-4 flex items-center justify-center shrink-0"> 
                                {getEnvironmentIcon(scheduledItem.taskEnvironment)}
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Environment: {scheduledItem.taskEnvironment.charAt(0).toUpperCase() + scheduledItem.taskEnvironment.slice(1)}</p>
                        </TooltipContent>
                    </Tooltip>
                  </div>
                </span>

                {/* Action Buttons (Right) */}
                <div className="flex items-center gap-1 ml-auto shrink-0 mt-2 sm:mt-0">
                  {scheduledItem.isFlexible && !isReadOnly && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleScheduledTaskLock({ taskId: scheduledItem.id, isLocked: !isLocked });
                          }}
                          disabled={isProcessingCommand || isReadOnly}
                          className={cn(
                            "h-6 w-6 p-0 shrink-0", 
                            (isLocked || isProcessingCommand || isReadOnly) ? "text-muted-foreground/50 cursor-not-allowed" : (isLocked ? "text-primary hover:bg-primary/20" : "text-[hsl(var(--always-light-text))] hover:bg-white/10")
                          )}
                          style={(isLocked || isProcessingCommand || isReadOnly) ? { pointerEvents: 'auto' } : undefined}
                        >
                          {isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />} 
                          <span className="sr-only">{isLocked ? "Unlock task" : "Lock task"}</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{isLocked ? "Unlock Task" : "Lock Task"}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {dbTask && !isReadOnly && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={(e) => {
                            e.stopPropagation();
                            onRetireTask(dbTask);
                          }}
                          disabled={isLocked || isProcessingCommand || isReadOnly}
                          className={cn(
                            "h-6 w-6 p-0 shrink-0", 
                            (isLocked || isProcessingCommand || isReadOnly) ? "text-muted-foreground/50 cursor-not-allowed" : (isTimeOff ? "text-logo-green hover:bg-logo-green/20" : "text-[hsl(var(--always-light-text))] hover:bg-white/10")
                          )}
                          style={(isLocked || isProcessingCommand || isReadOnly) ? { pointerEvents: 'auto' } : undefined}
                        >
                          <Archive className="h-4 w-4" /> 
                          <span className="sr-only">Retire task</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{isLocked ? "Unlock to Retire" : "Move to Aether Sink"}</p>
                    </TooltipContent>
                    </Tooltip>
                  )}
                  {!isReadOnly && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveTask(scheduledItem.id, scheduledItem.name, index);
                          }}
                          disabled={isLocked || isProcessingCommand || isReadOnly}
                          className={cn(
                            "h-6 w-6 p-0 shrink-0", 
                            (isLocked || isProcessingCommand || isReadOnly) ? "text-muted-foreground/50 cursor-not-allowed" : (isTimeOff ? "text-logo-green hover:bg-logo-green/20" : "text-[hsl(var(--always-light-text))] hover:bg-white/10")
                          )}
                          style={(isLocked || isProcessingCommand || isReadOnly) ? { pointerEvents: 'auto' } : undefined}
                        >
                          <Trash className="h-4 w-4" /> 
                          <span className="sr-only">Remove task</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{isLocked ? "Unlock to Delete" : "Permanently delete"}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>

              {/* Row 2: Time Range, Duration, Missed Badge (Aligned with Task Name) */}
              <div className={cn(
                "flex items-center justify-between w-full mt-1 text-sm",
                // Adjust margin-left based on whether the completion button is present
                dbTask && !isTimeOff && !isRegenPod && !isCalendarEvent && (scheduledItem.type === 'task' || scheduledItem.type === 'break' || scheduledItem.type === 'meal') && !isCompleted ? "ml-[32px]" : "ml-0" 
              )}>
                  <div className="flex items-center gap-3">
                      {/* Time Range */}
                      <span className={cn(
                          "font-semibold font-mono text-xs",
                          isTimeOff || isRegenPod ? "text-logo-green/80" : "text-[hsl(var(--always-light-text))] opacity-80",
                          isCompleted && isFixedOrTimed && "line-through text-muted-foreground/80"
                      )}>
                          {formatTime(scheduledItem.startTime)} - {formatTime(scheduledItem.endTime)}
                      </span>
                      
                      {/* Duration */}
                      <span className={cn(
                          "font-semibold opacity-80 text-xs",
                          isTimeOff || isRegenPod ? "text-logo-green/80" : "text-[hsl(var(--always-light-text))] opacity-80",
                          isCompleted && isFixedOrTimed && "line-through text-muted-foreground/80"
                      )}>
                          ({scheduledItem.duration} min)
                      </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                      {/* Missed Badge */}
                      {isMissed && (
                          <Badge variant="destructive" className="px-2 py-0.5 text-xs font-semibold">
                              MISSED
                          </Badge>
                      )}
                  </div>
              </div>
            </div>
            {scheduledItem.type === 'break' && scheduledItem.description && (
              <p className={cn("relative z-10 text-xs mt-1 text-[hsl(var(--always-light-text))] opacity-80")}>{scheduledItem.description}</p> 
            )}
            {isTimeOff && (
              <p className={cn("relative z-10 text-xs mt-1 text-logo-green/80")}>This block is reserved for personal time.</p> 
            )}
            {isRegenPod && (
              <p className={cn("relative z-10 text-xs mt-1 text-logo-green/80")}>Energy regeneration in progress. Exit via the Pod Modal.</p> 
            )}
            {isCalendarEvent && (
              <p className={cn("relative z-10 text-xs mt-1 text-blue-300/80")}>Read-only event synced from iCloud Calendar.</p> 
            )}

            {isActive && isTodaySelected && (
              <>
                <div 
                  className="absolute left-0 right-0 h-[4px] bg-live-progress z-20 border-b-4 border-live-progress"
                  style={{ top: `${progressLineTopPercentage}%` }}
                ></div>
                <div className="absolute left-0 -translate-x-full mr-2 z-50" style={{ top: '-10px' }}>
                  <span className="px-2 py-1 rounded-md bg-live-progress text-black text-xs font-semibold whitespace-nowrap"> 
                    {formatTime(T_current)}
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
    <>
      <div className="space-y-4 animate-slide-in-up">
        <Card className="animate-pop-in animate-hover-lift">
          <CardContent className="p-0">
            {/* 1. Main Schedule Display Area */}
            <div ref={scheduleContainerRef} className="relative p-4 overflow-y-auto">
              
              {/* Absolute Timeline Line (Placed between the two grid columns) */}
              <div className="absolute left-[60px] top-0 bottom-0 w-px border-l border-dashed border-border/50" />

              <div className="grid grid-cols-[60px_1fr] gap-x-4 gap-y-2">
                {schedule?.items.length === 0 ? (
                  <div className="col-span-2 text-center text-muted-foreground flex flex-col items-center justify-center space-y-4 py-12">
                    <ListTodo className="h-12 w-12 text-muted-foreground" />
                    <p className="text-lg font-semibold">Your schedule is clear for today!</p>
                    <p className="text-base">Ready to plan? Add a task using the input above.</p>
                    <Button onClick={onAddTaskClick} className="mt-4 flex items-center gap-2 h-11 text-base bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-200">
                      <PlusCircle className="h-5 w-5" /> Add a Task
                    </Button>
                  </div>
                ) : (
                  <>
                    {!activeItemInDisplay && T_current < firstItemStartTime && isTodaySelected && (
                      <div className={cn(
                        "col-span-2 text-center text-muted-foreground text-base py-2 border-y border-dashed border-primary/50 animate-pulse-glow",
                        "top-0"
                      )}>
                        <p className="font-semibold">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</p>
                        <p className="font-semibold text-primary flex items-center justify-center gap-2">
                          ⏳ Schedule starts later today
                        </p>
                        <p className="font-semibold">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</p>
                      </div>
                    )}
                    {!activeItemInDisplay && T_current >= lastItemEndTime && isTodaySelected && (
                      <div className="col-span-2 text-center text-muted-foreground text-base py-2 border-y border-dashed border-primary/50 animate-pulse-glow">
                        <p className="font-semibold">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</p>
                        <p className="font-semibold text-primary flex items-center justify-center gap-2">
                          ✅ All tasks completed!
                        </p>
                        <p className="font-semibold">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</p>
                      </div>
                    )}

                    {finalDisplayItems.map((item, index) => (
                      <React.Fragment key={item.id}>
                        {renderDisplayItem(item, index)}
                      </React.Fragment>
                    ))}
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. Smart Suggestions Card */}
        {totalScheduledMinutes > 0 && schedule?.summary.totalTasks > 0 && (
          <Card className="animate-pop-in animate-hover-lift">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Sparkles className="h-5 w-5 text-logo-yellow" /> Smart Suggestions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-base text-muted-foreground">
              {schedule?.summary.extendsPastMidnight && (
                <p className="text-orange-500 font-semibold">⚠️ {schedule.summary.midnightRolloverMessage}</p>
              )}
              {schedule?.summary.criticalTasksRemaining > 0 && (
                <p className="text-red-500 font-semibold">
                  ⚠️ Critical task{schedule.summary.criticalTasksRemaining > 1 ? 's' : ''} remain. Rezone now!
                </p>
              )}
              {totalScheduledMinutes < 6 * 60 && (
                <p>💡 Light day! Consider adding buffer time for flexibility.</p>
              )}
              {totalScheduledMinutes > 12 * 60 && (
                <p className="text-red-500">⚠️ Intense schedule. Remember to include meals and rest.</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
      <ScheduledTaskDetailDialog
        task={selectedScheduledTask}
        open={isDialogOpen}
        onOpenChange={(open) => {
          console.log("SchedulerCoreView: Dialog onOpenChange. New state:", open);
          setIsDialogOpen(open);
          if (!open) setSelectedScheduledTask(null);
        }}
        selectedDayString={selectedDayString}
      />
    </>
  );
});

export default SchedulerCoreView;