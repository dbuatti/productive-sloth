import React, { useMemo, useRef, useEffect, useState } from 'react';
import { ScheduledItem, FormattedSchedule, DBScheduledTask, TimeBlock, ScheduledTaskItem, ScheduledBreakItem, FreeSlotItem, ScheduledTimeOffItem, ScheduleSummary } from '@/types/scheduler'; // Removed DisplayItem, TimeMarker, FreeTimeItem, CurrentTimeMarker
import { cn } from '@/lib/utils';
import { formatTime, getEmojiHue } from '@/lib/scheduler-utils';
import { Button } from '@/components/ui/button';
import { Trash, Archive, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, BarChart, ListTodo, PlusCircle } from 'lucide-react';
import { startOfDay, addHours, addMinutes, isSameDay, parseISO, isBefore, isAfter, format } from 'date-fns';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SchedulerDisplayProps {
  schedule: FormattedSchedule | null;
  T_current: Date;
  onRemoveTask: (taskId: string) => Promise<void>;
  onRetireTask: (task: DBScheduledTask) => Promise<void>;
  activeItemId: string | null;
  selectedDayString: string;
  onAddTaskClick: () => void;
}

const getBubbleHeightStyle = (duration: number) => {
  const baseHeight = 40;
  const multiplier = 1.5;
  const minCalculatedHeight = 40;

  let calculatedHeight = baseHeight + (duration * multiplier);
  return { minHeight: `${Math.max(calculatedHeight, minCalculatedHeight)}px` };
};

// Define a type for events that will be processed and displayed
type DisplayEvent = {
  id: string;
  type: ScheduledItem['type'];
  name: string;
  start: Date; // Unified start time
  end: Date;   // Unified end time
  duration: number;
  originalItem: ScheduledItem; // Reference to the original ScheduledItem
};

type DisplayItemWithMarker = ScheduledItem | { type: 'marker'; time: Date; label: string };


const SchedulerDisplay: React.FC<SchedulerDisplayProps> = React.memo(({ schedule, T_current, onRemoveTask, onRetireTask, activeItemId, selectedDayString, onAddTaskClick }) => {
  const startOfTemplate = useMemo(() => startOfDay(T_current), [T_current]);
  const endOfTemplate = useMemo(() => addHours(startOfTemplate, 24), [startOfTemplate]);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLDivElement>(null);

  // State for confirmation dialogs
  const [showRemoveConfirmation, setShowRemoveConfirmation] = useState(false);
  const [taskToRemove, setTaskToRemove] = useState<string | null>(null);
  const [showRetireConfirmation, setShowRetireConfirmation] = useState(false);
  const [taskToRetire, setTaskToRetire] = useState<DBScheduledTask | null>(null);

  const handleRemoveClick = (taskId: string) => {
    setTaskToRemove(taskId);
    setShowRemoveConfirmation(true);
  };

  const handleRetireClick = (task: DBScheduledTask) => {
    setTaskToRetire(task);
    setShowRetireConfirmation(true);
  };

  const confirmRemove = async () => {
    if (taskToRemove) {
      await onRemoveTask(taskToRemove);
      setTaskToRemove(null);
      setShowRemoveConfirmation(false);
    }
  };

  const confirmRetire = async () => {
    if (taskToRetire) {
      await onRetireTask(taskToRetire);
      setTaskToRetire(null);
      setShowRetireConfirmation(false);
    }
  };

  const { finalDisplayItems, firstItemStartTime, lastItemEndTime } = useMemo(() => {
    const scheduledTasks = schedule ? schedule.items : [];
    const allEvents: DisplayEvent[] = []; 

    scheduledTasks.forEach(item => {
      if (item.type === 'task' || item.type === 'break' || item.type === 'time-off' || item.type === 'free-slot') {
        allEvents.push({
          id: item.id,
          type: item.type,
          name: item.name,
          start: item.startTime, // Use startTime as unified 'start'
          end: item.endTime,     // Use endTime as unified 'end'
          duration: item.duration,
          originalItem: item,
        });
      }
    });

    // Sort all events by start time
    allEvents.sort((a, b) => a.start.getTime() - b.start.getTime());

    const processedItems: DisplayItemWithMarker[] = [];
    let currentCursor = startOfTemplate;

    allEvents.forEach(event => {
      // Add free time if there's a gap
      if (event.start.getTime() > currentCursor.getTime()) {
        const freeDurationMs = event.start.getTime() - currentCursor.getTime();
        const freeDurationMinutes = Math.floor(freeDurationMs / (1000 * 60));
        if (freeDurationMinutes > 0) {
          processedItems.push({
            id: `free-${currentCursor.toISOString()}-${event.start.toISOString()}`,
            type: 'free-slot',
            name: 'Free Time',
            startTime: currentCursor,
            endTime: event.start,
            duration: freeDurationMinutes,
            emoji: '🧘'
          } as FreeSlotItem);
        }
      }

      // Add the actual scheduled item
      processedItems.push(event.originalItem);
      
      currentCursor = event.end;
    });

    // Add any remaining free time until the end of the template
    if (currentCursor.getTime() < endOfTemplate.getTime()) {
      const freeDurationMs = endOfTemplate.getTime() - currentCursor.getTime();
      const freeDurationMinutes = Math.floor(freeDurationMs / (1000 * 60));
      if (freeDurationMinutes > 0) {
        processedItems.push({
          id: `free-${currentCursor.toISOString()}-${endOfTemplate.toISOString()}`,
          type: 'free-slot',
          name: 'Free Time',
          startTime: currentCursor,
          endTime: endOfTemplate,
          duration: freeDurationMinutes,
          emoji: '🧘'
        } as FreeSlotItem);
      }
    }

    // Add time markers every 3 hours
    const markers: { type: 'marker'; time: Date; label: string }[] = [];
    for (let i = 0; i <= 24; i += 3) {
      const markerTime = addHours(startOfTemplate, i);
      // Only add marker if it doesn't fall exactly on a scheduled item's start/end
      const isCovered = processedItems.some(item => {
        if (item.type === 'marker') return false; // Markers don't cover other items
        return (isSameDay(item.startTime, markerTime) && item.startTime.getHours() === markerTime.getHours() && item.startTime.getMinutes() === markerTime.getMinutes()) ||
               (isSameDay(item.endTime, markerTime) && item.endTime.getHours() === markerTime.getHours() && item.endTime.getMinutes() === markerTime.getMinutes());
      });
      if (!isCovered) {
        markers.push({ type: 'marker', time: markerTime, label: formatTime(markerTime) });
      }
    }

    const finalItemsWithMarkers = [...processedItems, ...markers].sort((a, b) => {
      const timeA = 'time' in a ? a.time : a.startTime;
      const timeB = 'time' in b ? b.time : b.startTime;
      return timeA.getTime() - timeB.getTime();
    });

    const firstItem = finalItemsWithMarkers[0];
    const lastItem = finalItemsWithMarkers[finalItemsWithMarkers.length - 1];

    const actualStartTime = firstItem
      ? (firstItem.type === 'marker' ? firstItem.time : firstItem.startTime)
      : startOfTemplate;
    const actualEndTime = lastItem
      ? (lastItem.type === 'marker' ? lastItem.time : lastItem.endTime)
      : endOfTemplate;

    return {
      finalDisplayItems: finalItemsWithMarkers,
      firstItemStartTime: actualStartTime,
      lastItemEndTime: actualEndTime,
    };
  }, [schedule, startOfTemplate, endOfTemplate, T_current]);

  const activeItemInDisplay = useMemo(() => {
    for (const item of finalDisplayItems) {
      if (item.type !== 'marker' && T_current >= item.startTime && T_current < item.endTime) {
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
    if (!containerRef.current || !firstItemStartTime || !lastItemEndTime) return 0;

    const totalScheduleDurationMs = lastItemEndTime.getTime() - firstItemStartTime.getTime();
    if (totalScheduleDurationMs <= 0) return 0;

    const timeIntoScheduleMs = T_current.getTime() - firstItemStartTime.getTime();
    return (timeIntoScheduleMs / totalScheduleDurationMs) * 100;
  }, [T_current, firstItemStartTime, lastItemEndTime]);

  useEffect(() => {
    if (activeItemRef.current && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const activeItemRect = activeItemRef.current.getBoundingClientRect();

      if (activeItemRect.top < containerRect.top || activeItemRect.bottom > containerRect.bottom) {
        activeItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeItemInDisplay]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [selectedDayString]);

  const renderDisplayItem = (item: DisplayItemWithMarker) => {
    const isCurrentlyActive = activeItemInDisplay?.id === ('id' in item ? item.id : undefined);
    const isPastItem = ('endTime' in item) && item.endTime <= T_current;

    if (item.type === 'marker') {
      return (
        <React.Fragment key={item.time.toISOString()}>
          <div className="flex items-center justify-end pr-2">
            <span className="text-sm font-bold text-foreground">
              {item.label}
            </span>
          </div>
          <div className="relative flex items-center">
            <div className="h-px w-full bg-border" />
            <div className="absolute right-0 h-2.5 w-2.5 rounded-full bg-border -mr-1.5" />
          </div>
        </React.Fragment>
      );
    } else if (item.type === 'free-slot') {
      const freeTimeItem = item as FreeSlotItem;
      const isActive = T_current >= freeTimeItem.startTime && T_current < freeTimeItem.endTime;
      const isHighlightedByNowCard = activeItemId === freeTimeItem.id;

      return (
        <React.Fragment key={freeTimeItem.id}>
          <div></div>
          <div 
            ref={isCurrentlyActive ? activeItemRef : null}
            className={cn(
              "relative flex items-center justify-center text-muted-foreground italic text-sm h-[20px] rounded-lg shadow-sm transition-all duration-200 ease-in-out",
              isHighlightedByNowCard ? "opacity-50 border-border" :
              isActive ? "bg-live-progress/10 border border-live-progress animate-pulse-active-row" : "bg-secondary/50 hover:bg-secondary/70",
              isPastItem && "opacity-50 border-muted-foreground/30"
            )}
          >
            {freeTimeItem.name} ({freeTimeItem.duration} min)
            {isActive && (
              <>
                <div 
                  className="absolute left-0 right-0 h-[4px] bg-live-progress z-20 border-b-4 border-live-progress"
                  style={{ top: `${progressLineTopPercentage}%` }}
                ></div>
                <div className="absolute left-0 -translate-x-full mr-2 z-50" style={{ top: `${progressLineTopPercentage}%` }}>
                  <span className="px-2 py-1 rounded-md bg-live-progress text-black text-xs font-semibold whitespace-nowrap">
                    {formatTime(T_current)}
                  </span>
                </div>
              </>
            )}
          </div>
        </React.Fragment>
      );
    } else {
      const scheduledItem = item as ScheduledItem; // Keep as ScheduledItem for now, use type guards below
      const isActive = T_current >= scheduledItem.startTime && T_current < scheduledItem.endTime;
      const isHighlightedByNowCard = activeItemId === scheduledItem.id;

      if (scheduledItem.endTime < startOfTemplate) return null;

      const hue = getEmojiHue(scheduledItem.name);
      const saturation = 50;
      const lightness = 35;
      const ambientBackgroundColor = `hsl(${hue} ${saturation}% ${lightness}%)`;

      const isTimeOff = scheduledItem.type === 'time-off';

      return (
        <React.Fragment key={scheduledItem.id}>
          <div className="flex items-center justify-end pr-2">
            <span className={cn(
              "px-2 py-1 rounded-md text-xs font-mono transition-colors duration-200",
              isHighlightedByNowCard ? "bg-primary text-primary-foreground" :
              isActive ? "bg-primary/20 text-primary" :
              isPastItem ? "bg-muted text-muted-foreground" : "bg-secondary text-secondary-foreground",
              "hover:scale-105"
            )}>
              {formatTime(scheduledItem.startTime)}
            </span>
          </div>

          <div
            ref={isCurrentlyActive ? activeItemRef : null}
            className={cn(
              "relative flex flex-col justify-center gap-1 p-3 rounded-lg shadow-md transition-all duration-200 ease-in-out animate-pop-in overflow-hidden",
              "border-2 border-foreground/20",
              isHighlightedByNowCard ? "opacity-50" :
              isActive ? "border-live-progress animate-pulse-active-row" :
              isPastItem ? "opacity-50 border-muted-foreground/30" : "border-border",
              "hover:scale-[1.03] hover:shadow-xl hover:shadow-primary/30 hover:border-primary",
              isTimeOff && "border-dashed border-logo-green/50 bg-logo-green/10"
            )}
            style={{ ...getBubbleHeightStyle(scheduledItem.duration), backgroundColor: isTimeOff ? undefined : ambientBackgroundColor }}
          >
            <div className="absolute inset-0 flex items-center justify-end pointer-events-none">
              <span className="text-[10rem] opacity-10 select-none">
                {scheduledItem.emoji}
              </span>
            </div>

            <div className="relative z-10 flex items-center justify-between w-full">
              <span className={cn(
                "text-sm flex-grow",
                isTimeOff ? "text-logo-green" : "text-[hsl(var(--always-light-text))]"
              )}>
                <span className="font-bold">{scheduledItem.name}</span> <span className="font-semibold opacity-80">({scheduledItem.duration} min)</span>
              </span>
              <div className="flex items-center gap-1 ml-auto shrink-0">
                {scheduledItem.type === 'task' && scheduledItem.isCritical && ( // Added type guard
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="relative flex items-center justify-center h-4 w-4 rounded-full bg-logo-yellow text-white shrink-0">
                        <AlertCircle className="h-3 w-3" strokeWidth={2.5} />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Critical Task: Must be completed today!</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                {scheduledItem.type === 'task' && ( // Added type guard
                  <span 
                    className={cn(
                      "px-2 py-0.5 text-xs font-semibold rounded-full border",
                      scheduledItem.isFlexible ? "bg-blue-500/20 text-blue-300 border-blue-500" : "bg-purple-500/20 text-purple-300 border-purple-500"
                    )}
                  >
                    {scheduledItem.isFlexible ? 'Flexible' : 'Fixed'}
                  </span>
                )}
                <span className={cn(
                  "text-xs font-semibold font-mono",
                  isTimeOff ? "text-logo-green/80" : "text-[hsl(var(--always-light-text))] opacity-80"
                )}>
                  {formatTime(scheduledItem.startTime)} - {formatTime(scheduledItem.endTime)}
                </span>
                <div className="flex items-center gap-1 ml-2">
                  {scheduledItem.type === 'task' && ( // Only show retire button for actual tasks
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleRetireClick(scheduledItem.originalTask)}
                          className={cn(
                            "h-6 w-6 p-0 shrink-0",
                            isTimeOff ? "text-logo-green hover:bg-logo-green/20" : "text-[hsl(var(--always-light-text))] hover:bg-white/10"
                          )}
                        >
                          <Archive className="h-4 w-4" />
                          <span className="sr-only">Retire task</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Move to Aether Sink</p>
                    </TooltipContent>
                    </Tooltip>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleRemoveClick(scheduledItem.id)}
                        className={cn(
                          "h-6 w-6 p-0 shrink-0",
                          isTimeOff ? "text-logo-green hover:bg-logo-green/20" : "text-[hsl(var(--always-light-text))] hover:bg-white/10"
                        )}
                      >
                        <Trash className="h-4 w-4" />
                        <span className="sr-only">Remove task</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Remove from schedule</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
            {scheduledItem.type === 'break' && (scheduledItem as ScheduledBreakItem).description && (
              <p className={cn("relative z-10 text-sm mt-1 text-[hsl(var(--always-light-text))] opacity-80")}>{(scheduledItem as ScheduledBreakItem).description}</p>
            )}
            {isTimeOff && (
              <p className={cn("relative z-10 text-sm mt-1 text-logo-green/80")}>This block is reserved for personal time.</p>
            )}

            {isActive && (
              <>
                <div 
                  className="absolute left-0 right-0 h-[4px] bg-live-progress z-20 border-b-4 border-live-progress"
                  style={{ top: `${progressLineTopPercentage}%` }}
                ></div>
                <div className="absolute left-0 -translate-x-full mr-2 z-50" style={{ top: `${progressLineTopPercentage}%` }}>
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

  const isTodaySelected = isSameDay(parseISO(selectedDayString), T_current);

  if (!schedule || schedule.items.length === 0) {
    return (
      <Card className="p-6 text-center text-muted-foreground animate-fade-in">
        <p className="text-lg mb-4">No tasks scheduled for {format(parseISO(selectedDayString), 'EEEE, MMMM d')}.</p>
        <Button onClick={onAddTaskClick} className="flex items-center gap-2">
          <PlusCircle className="h-5 w-5" /> Add Your First Task
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4 animate-slide-in-up">
      <Card className="animate-pop-in">
        <CardContent className="p-0">
          <div ref={containerRef} className="relative p-4 overflow-y-auto border-l border-dashed border-border/50">
            {isTodaySelected && firstItemStartTime && lastItemEndTime && (
              <div 
                className="absolute left-0 right-0 h-[3px] bg-live-progress z-10 border-b-2 border-live-progress"
                style={{ top: `${globalProgressLineTopPercentage}%` }}
              >
                <div className="absolute left-0 -translate-x-full mr-2 z-50" style={{ top: '-10px' }}> 
                  <span className="px-2 py-1 rounded-md bg-live-progress text-black text-xs font-semibold whitespace-nowrap"> 
                    {formatTime(T_current)}
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              {!activeItemInDisplay && T_current < firstItemStartTime && isTodaySelected && (
                <div className={cn(
                  "col-span-2 text-center text-muted-foreground text-sm py-2 border-y border-dashed border-primary/50 animate-pulse-glow",
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
                <div className={cn(
                  "col-span-2 text-center text-muted-foreground text-sm py-2 border-y border-dashed border-primary/50 animate-pulse-glow",
                  "bottom-0"
                )}>
                  <p className="font-semibold">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</p>
                  <p className="font-semibold text-primary flex items-center justify-center gap-2">
                    ✅ All tasks completed!
                  </p>
                  <p className="font-semibold">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</p>
                </div>
              )}

              {finalDisplayItems.map((item) => (
                <React.Fragment key={'id' in item ? item.id : item.time.toISOString()}>
                  {renderDisplayItem(item)}
                </React.Fragment>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {schedule?.summary && schedule.summary.totalScheduledDuration > 0 && (
        <Card className="animate-pop-in animate-hover-lift">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-5 w-5 text-logo-yellow" /> Smart Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {schedule.summary.extendsPastMidnight && ( // Accessing new property
              <p className="text-orange-500 font-semibold">⚠️ {schedule.summary.midnightRolloverMessage}</p> // Accessing new property
            )}
            {schedule.summary.criticalTasksRemaining > 0 && ( // Accessing new property
              <p className="text-red-500 font-semibold">
                ⚠️ Critical task{schedule.summary.criticalTasksRemaining > 1 ? 's' : ''} remain. Rezone now!
              </p>
            )}
            {schedule.summary.totalScheduledDuration < 6 * 60 && (
              <p>💡 Light day! Consider adding buffer time for flexibility.</p>
            )}
            {schedule.summary.totalScheduledDuration > 12 * 60 && (
              <p className="text-red-500">⚠️ Intense schedule. Remember to include meals and rest.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Remove Confirmation Dialog */}
      <AlertDialog open={showRemoveConfirmation} onOpenChange={setShowRemoveConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently delete "{taskToRemove ? schedule?.items.find(i => i.id === taskToRemove)?.name : 'this task'}" from your schedule. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} className="bg-destructive hover:bg-destructive/90">
              Delete Task
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Retire Confirmation Dialog */}
      <AlertDialog open={showRetireConfirmation} onOpenChange={setShowRetireConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Retirement</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to send "{taskToRetire?.name || 'this task'}" to the Aether Sink? It will be removed from your schedule but can be re-zoned later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRetire}>
              Send to Sink
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});

export default SchedulerDisplay;