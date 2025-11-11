import React, { useMemo, useRef, useEffect } from 'react';
import { ScheduledItem, FormattedSchedule, DisplayItem, TimeMarker, FreeTimeItem, CurrentTimeMarker, DBScheduledTask } from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { formatTime, getEmojiHue } from '@/lib/scheduler-utils';
import { Button } from '@/components/ui/button';
import { Trash, Archive, AlertCircle } from 'lucide-react'; // Import Archive icon, AlertCircle
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, BarChart, ListTodo, PlusCircle } from 'lucide-react';
import { startOfDay, addHours, addMinutes, isSameDay, parseISO, isBefore, isAfter } from 'date-fns';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'; // Import Tooltip components

interface SchedulerDisplayProps {
  schedule: FormattedSchedule | null;
  T_current: Date;
  onRemoveTask: (taskId: string) => void;
  onRetireTask: (task: DBScheduledTask) => void; // NEW: Handler for retiring a task
  activeItemId: string | null;
  selectedDayString: string; // New prop to pass selectedDay from parent
}

const getBubbleHeightStyle = (duration: number) => {
  const baseHeight = 40;
  const multiplier = 1.5;
  const minCalculatedHeight = 40;

  let calculatedHeight = baseHeight + (duration * multiplier);
  return { minHeight: `${Math.max(calculatedHeight, minCalculatedHeight)}px` };
};

const SchedulerDisplay: React.FC<SchedulerDisplayProps> = React.memo(({ schedule, T_current, onRemoveTask, onRetireTask, activeItemId, selectedDayString }) => {
  const startOfTemplate = useMemo(() => startOfDay(T_current), [T_current]);
  const endOfTemplate = useMemo(() => addHours(startOfTemplate, 24), [startOfTemplate]);
  const containerRef = useRef<HTMLDivElement>(null); // Ref for the scrollable container

  const activeItemRef = useRef<HTMLDivElement>(null); // Ref for the active item

  const { finalDisplayItems, firstItemStartTime, lastItemEndTime } = useMemo(() => {
    const scheduledTasks = schedule ? schedule.items : [];
    const allEvents: (ScheduledItem | TimeMarker)[] = []; 

    scheduledTasks.forEach(task => allEvents.push(task));

    allEvents.push({ id: 'marker-0', type: 'marker', time: startOfTemplate, label: formatTime(startOfTemplate) });
    allEvents.push({ id: 'marker-24hr', type: 'marker', time: endOfTemplate, label: formatTime(endOfTemplate) }); 

    allEvents.sort((a, b) => {
        const timeA = 'time' in a ? a.time : a.startTime;
        const timeB = 'time' in b ? b.time : b.startTime;
        return timeA.getTime() - timeB.getTime();
    });

    const processedItems: DisplayItem[] = [];
    let currentCursor = startOfTemplate;

    allEvents.forEach(event => {
        const eventStartTime = 'time' in event ? event.time : event.startTime;
        const eventEndTime = 'time' in event ? event.time : event.endTime;

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
        
        currentCursor = event.type === 'marker' ? event.time : eventEndTime;
    });

    const filteredItems: DisplayItem[] = [];
    processedItems.forEach(item => {
        if (item.type === 'marker') {
            const isCovered = processedItems.some(pItem => {
                if (pItem.type === 'free-time' || pItem.type === 'task' || pItem.type === 'break') {
                    return item.time >= pItem.startTime && item.time < pItem.endTime;
                }
                return false;
            });
            if (!isCovered) {
                filteredItems.push(item);
            }
        } else {
            filteredItems.push(item);
        }
    });

    const hasStartMarker = filteredItems.some(item => ('startTime' in item ? item.startTime : item.time).getTime() === startOfTemplate.getTime());
    if (!hasStartMarker) {
        filteredItems.unshift({ id: 'marker-0-final', type: 'marker', time: startOfTemplate, label: formatTime(startOfTemplate) });
    }
    const hasEndMarker = filteredItems.some(item => ('endTime' in item ? item.endTime : item.time).getTime() === endOfTemplate.getTime());
    if (!hasEndMarker) {
        filteredItems.push({ id: 'marker-24hr-final', type: 'marker', time: endOfTemplate, label: formatTime(endOfTemplate) });
    }

    filteredItems.sort((a, b) => {
        const timeA = 'time' in a ? a.time : a.startTime;
        const timeB = 'time' in b ? b.time : b.startTime;
        return timeA.getTime() - timeB.getTime();
    });

    const firstRenderedItem = filteredItems[0];
    const lastRenderedItem = filteredItems[filteredItems.length - 1];

    const actualStartTime = firstRenderedItem ? ('time' in firstRenderedItem ? firstRenderedItem.time : firstRenderedItem.startTime) : startOfTemplate;
    const actualEndTime = lastRenderedItem ? ('time' in lastRenderedItem ? lastRenderedItem.time : lastRenderedItem.endTime) : endOfTemplate;

    return {
        finalDisplayItems: filteredItems,
        firstItemStartTime: actualStartTime,
        lastItemEndTime: actualEndTime,
    };
  }, [schedule, T_current, startOfTemplate, endOfTemplate]);

  const activeItemInDisplay = useMemo(() => {
    for (const item of finalDisplayItems) {
      if ((item.type === 'task' || item.type === 'break' || item.type === 'free-time') && T_current >= item.startTime && T_current < item.endTime) {
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

  // Calculate global progress line position
  const globalProgressLineTopPercentage = useMemo(() => {
    if (!containerRef.current || !firstItemStartTime || !lastItemEndTime) return 0;

    const totalScheduleDurationMs = lastItemEndTime.getTime() - firstItemStartTime.getTime();
    if (totalScheduleDurationMs <= 0) return 0;

    const timeIntoScheduleMs = T_current.getTime() - firstItemStartTime.getTime();
    return (timeIntoScheduleMs / totalScheduleDurationMs) * 100;
  }, [T_current, firstItemStartTime, lastItemEndTime]);


  // Auto-scroll to active item (existing logic)
  useEffect(() => {
    if (activeItemRef.current && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const activeItemRect = activeItemRef.current.getBoundingClientRect();

      if (activeItemRect.top < containerRect.top || activeItemRect.bottom > containerRect.bottom) {
        activeItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeItemInDisplay]);

  // NEW: Auto-scroll to top when selected day changes
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [selectedDayString]);


  const totalScheduledMinutes = schedule ? (schedule.summary.activeTime.hours * 60 + schedule.summary.activeTime.minutes + schedule.summary.breakTime) : 0;

  const renderDisplayItem = (item: DisplayItem) => {
    const isCurrentlyActive = activeItemInDisplay?.id === item.id;
    // Safely check for isPastItem only on types that have an 'endTime'
    const isPastItem = (item.type === 'task' || item.type === 'break' || item.type === 'free-time') && item.endTime <= T_current;

    if (item.type === 'marker') {
      return (
        <React.Fragment key={item.id}>
          <div className="flex items-center justify-end pr-2">
            <span className="text-sm font-bold text-foreground">
              {item.label}
            </span>
          </div>
          <div className="relative flex items-center">
            <div className="h-px w-full bg-border" />
            <div className="absolute right-0 h-2.5 w-2.5 rounded-full bg-border -mr-1.5" /> {/* Larger dot */}
          </div>
        </React.Fragment>
      );
    } else if (item.type === 'free-time') {
      const freeTimeItem = item as FreeTimeItem;
      const isActive = T_current >= freeTimeItem.startTime && T_current < freeTimeItem.endTime;
      const isHighlightedByNowCard = activeItemId === freeTimeItem.id;

      return (
        <React.Fragment key={freeTimeItem.id}>
          <div></div>
          <div 
            ref={isCurrentlyActive ? activeItemRef : null} // Assign ref if active
            className={cn(
              "relative flex items-center justify-center text-muted-foreground italic text-sm h-[20px] rounded-lg shadow-sm transition-all duration-200 ease-in-out",
              isHighlightedByNowCard ? "opacity-50 border-border" :
              isActive ? "bg-live-progress/10 border border-live-progress animate-pulse-active-row" : "bg-secondary/50 hover:bg-secondary/70",
              isPastItem && "opacity-50 border-muted-foreground/30" // Faded for past items
            )}
          >
            {freeTimeItem.message}
            {isActive && (
              <>
                <div 
                  className="absolute left-0 right-0 h-[4px] bg-live-progress z-20 border-b-4 border-live-progress" // Increased height, removed pulse-glow
                  style={{ top: `${progressLineTopPercentage}%` }}
                ></div>
                <div className="absolute left-0 -translate-x-full mr-2 z-50" style={{ top: `${progressLineTopPercentage}%` }}>
                  <span className="px-2 py-1 rounded-md bg-live-progress text-black text-xs font-semibold whitespace-nowrap"> {/* Removed pulse-glow and border */}
                    {formatTime(T_current)}
                  </span>
                </div>
              </>
            )}
          </div>
        </React.Fragment>
      );
    } else {
      const scheduledItem = item as ScheduledItem;
      const isActive = T_current >= scheduledItem.startTime && T_current < scheduledItem.endTime;
      const isHighlightedByNowCard = activeItemId === scheduledItem.id;

      if (scheduledItem.endTime < startOfTemplate) return null;

      const hue = getEmojiHue(scheduledItem.name);
      const saturation = 50; // Increased saturation
      const lightness = 35; // Increased lightness
      const ambientBackgroundColor = `hsl(${hue} ${saturation}% ${lightness}%)`;

      // Find the corresponding DBScheduledTask to pass to onRetireTask
      // Use schedule.dbTasks which is the raw array from Supabase
      const dbTask = schedule?.dbTasks.find(t => t.id === scheduledItem.id);

      return (
        <React.Fragment key={scheduledItem.id}>
          <div className="flex items-center justify-end pr-2">
            <span className={cn(
              "px-2 py-1 rounded-md text-xs font-mono transition-colors duration-200",
              isHighlightedByNowCard ? "bg-primary text-primary-foreground" :
              isActive ? "bg-primary/20 text-primary" :
              isPastItem ? "bg-muted text-muted-foreground" : "bg-secondary text-secondary-foreground", // Use isPastItem here
              "hover:scale-105"
            )}>
              {formatTime(scheduledItem.startTime)}
            </span>
          </div>

          <div
            ref={isCurrentlyActive ? activeItemRef : null} // Assign ref if active
            className={cn(
              "relative flex flex-col justify-center gap-1 p-3 rounded-lg shadow-md transition-all duration-200 ease-in-out animate-pop-in overflow-hidden", // Changed shadow-sm to shadow-md
              "border-2 border-foreground/20", // Changed border-white to border-foreground/20
              isHighlightedByNowCard ? "opacity-50" :
              isActive ? "border-live-progress animate-pulse-active-row" : // Use live-progress for active border
              isPastItem ? "opacity-50 border-muted-foreground/30" : "border-border", // Faded for past items
              "hover:scale-[1.03] hover:shadow-xl hover:shadow-primary/30 hover:border-primary" // Stronger hover shadow and border
            )}
            style={{ ...getBubbleHeightStyle(scheduledItem.duration), backgroundColor: ambientBackgroundColor }}
          >
            <div className="absolute inset-0 flex items-center justify-end pointer-events-none">
              <span className="text-[10rem] opacity-10 select-none">
                {scheduledItem.emoji}
              </span>
            </div>

            <div className="relative z-10 flex items-center justify-between w-full">
              <span className={cn(
                "text-sm flex-grow text-[hsl(var(--always-light-text))]" // Using always-light-text
              )}>
                <span className="font-bold">{scheduledItem.name}</span> <span className="font-semibold opacity-80">({scheduledItem.duration} min)</span> {/* Made duration font-semibold */}
              </span>
              <div className="flex items-center gap-1 ml-auto shrink-0">
                {scheduledItem.isCritical && (
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
                <span className={cn(
                  "text-xs font-semibold font-mono text-[hsl(var(--always-light-text))] opacity-80" // Made time range font-semibold
                )}>
                  {formatTime(scheduledItem.startTime)} - {formatTime(scheduledItem.endTime)}
                </span>
                <div className="flex items-center gap-1 ml-2"> {/* Group buttons */}
                  {dbTask && ( // Only show retire button if it's a real DB task
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => onRetireTask(dbTask)} 
                          className={cn(
                            "h-6 w-6 p-0 shrink-0 text-[hsl(var(--always-light-text))]",
                            "hover:bg-white/10"
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
                        onClick={() => onRemoveTask(scheduledItem.id)} 
                        className={cn(
                          "h-6 w-6 p-0 shrink-0 text-[hsl(var(--always-light-text))]", // Using always-light-text
                          "hover:bg-white/10"
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
            {scheduledItem.type === 'break' && scheduledItem.description && (
              <p className={cn("relative z-10 text-sm mt-1 text-[hsl(var(--always-light-text))] opacity-80")}>{scheduledItem.description}</p> // Using always-light-text with opacity
            )}

            {isActive && (
              <>
                <div 
                  className="absolute left-0 right-0 h-[4px] bg-live-progress z-20 border-b-4 border-live-progress" // Increased height, removed pulse-glow
                  style={{ top: `${progressLineTopPercentage}%` }}
                ></div>
                <div className="absolute left-0 -translate-x-full mr-2 z-50" style={{ top: `${progressLineTopPercentage}%` }}>
                  <span className="px-2 py-1 rounded-md bg-live-progress text-black text-xs font-semibold whitespace-nowrap"> {/* Removed pulse-glow and border */}
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

  const isTodaySelected = isSameDay(parseISO(selectedDayString), T_current); // Corrected to use selectedDayString

  return (
    <div className="space-y-4 animate-slide-in-up">
      <Card className="animate-pop-in">
        <CardContent className="p-0">
          <div ref={containerRef} className="relative p-4 overflow-y-auto border-l border-dashed border-border/50">
            {/* Global "Now" Indicator */}
            {isTodaySelected && firstItemStartTime && lastItemEndTime && ( // Always show if today is selected
              <div 
                className="absolute left-0 right-0 h-[3px] bg-live-progress z-10 border-b-2 border-live-progress" // Slightly thicker line
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
              {schedule?.items.length === 0 ? (
                <div className="col-span-2 text-center text-muted-foreground flex flex-col items-center justify-center space-y-4 py-12">
                  <ListTodo className="h-12 w-12 text-muted-foreground" />
                  <p className="text-lg font-semibold">Your schedule is clear for today!</p>
                  <p className="text-sm">Ready to plan? Add a task using the input above.</p>
                  <p className="text-xs text-muted-foreground">Try: "Gym 60", "Meeting 2pm-3pm", "Mindfulness 11am - 12pm", "Inject Gym", "Inject Meeting from 2pm to 3pm", "Clean the sink 30 sink", "Clear queue"</p>
                </div>
              ) : (
                <>
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
                    <React.Fragment key={item.id}>
                      {renderDisplayItem(item)}
                    </React.Fragment>
                  ))}
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {totalScheduledMinutes > 0 && schedule?.summary.totalTasks > 0 && (
        <Card className="animate-pop-in animate-hover-lift"> {/* Added animate-hover-lift */}
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-5 w-5 text-logo-yellow" /> Smart Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
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
  );
});

export default SchedulerDisplay;