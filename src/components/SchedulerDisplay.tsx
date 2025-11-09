import React, { useMemo } from 'react';
import { ScheduledItem, FormattedSchedule, DisplayItem, TimeMarker, FreeTimeItem, CurrentTimeMarker } from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/scheduler-utils';
import { Button } from '@/components/ui/button';
import { Trash } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, BarChart, ListTodo } from 'lucide-react';
import { startOfDay, addHours, addMinutes } from 'date-fns';

interface SchedulerDisplayProps {
  schedule: FormattedSchedule | null;
  T_current: Date;
  onRemoveTask: (taskId: string) => void;
}

// Helper to determine dynamic bubble height based on duration
const getBubbleHeightStyle = (duration: number) => {
  const baseHeight = 40; // px for a very short task
  const multiplier = 1.5; // px per minute
  const minCalculatedHeight = 40; // Minimum height for any item to ensure visibility

  let calculatedHeight = baseHeight + (duration * multiplier);
  return { minHeight: `${Math.max(calculatedHeight, minCalculatedHeight)}px` };
};

const SchedulerDisplay: React.FC<SchedulerDisplayProps> = ({ schedule, T_current, onRemoveTask }) => {
  // Declare startOfTemplate and endOfTemplate here so they are accessible throughout the component
  const startOfTemplate = useMemo(() => startOfDay(T_current), [T_current]); // 12:00 AM
  const endOfTemplate = useMemo(() => addHours(startOfTemplate, 24), [startOfTemplate]); // 12:00 AM next day (24 hours)

  const { finalDisplayItems, firstItemStartTime, lastItemEndTime } = useMemo(() => {
    const scheduledTasks = schedule ? schedule.items : [];
    const allEvents: (ScheduledItem | TimeMarker)[] = []; // Removed CurrentTimeMarker from here

    // Add all scheduled tasks/breaks
    scheduledTasks.forEach(task => allEvents.push(task));

    // Add 12 AM and 12 AM (next day) markers as fixed boundaries
    allEvents.push({ id: 'marker-0', type: 'marker', time: startOfTemplate, label: formatTime(startOfTemplate) });
    allEvents.push({ id: 'marker-24hr', type: 'marker', time: endOfTemplate, label: formatTime(endOfTemplate) }); // Changed to 24hr marker

    // Sort all events by their time
    allEvents.sort((a, b) => {
        const timeA = 'time' in a ? a.time : a.startTime;
        const timeB = 'time' in b ? b.time : b.startTime;
        return timeA.getTime() - timeB.getTime();
    });

    const processedItems: DisplayItem[] = [];
    let currentCursor = startOfTemplate; // Tracks the end time of the last processed item

    allEvents.forEach(event => {
        const eventStartTime = 'time' in event ? event.time : event.startTime;
        const eventEndTime = 'time' in event ? event.time : event.endTime;

        // If there's a gap between currentCursor and this event's start time, add free time
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

        // Add the current event, but only if it's not a redundant marker
        const isRedundantMarker = event.type === 'marker' && processedItems.some(pItem => 
            ('startTime' in pItem && pItem.startTime.getTime() === event.time.getTime()) ||
            ('endTime' in pItem && pItem.endTime.getTime() === event.time.getTime())
        );

        if (!isRedundantMarker) {
            processedItems.push(event);
        }
        
        // Update currentCursor to the end time of the event, or the start time if it's a marker
        currentCursor = event.type === 'marker' ? event.time : eventEndTime;
    });

    // Filter out markers that are completely covered by free time or tasks
    const filteredItems: DisplayItem[] = [];
    processedItems.forEach(item => {
        if (item.type === 'marker') {
            const isCovered = processedItems.some(pItem => 
                (pItem.type === 'free-time' && item.time >= pItem.startTime && item.time < pItem.endTime) ||
                ((pItem.type === 'task' || pItem.type === 'break') && item.time >= pItem.startTime && item.time < pItem.endTime)
            );
            if (!isCovered) {
                filteredItems.push(item);
            }
        } else {
            filteredItems.push(item);
        }
    });

    // Ensure 12 AM and 12 AM (next day) markers are always present if no other item starts/ends there
    const hasStartMarker = filteredItems.some(item => ('startTime' in item ? item.startTime : item.time).getTime() === startOfTemplate.getTime());
    if (!hasStartMarker) {
        filteredItems.unshift({ id: 'marker-0-final', type: 'marker', time: startOfTemplate, label: formatTime(startOfTemplate) });
    }
    const hasEndMarker = filteredItems.some(item => ('endTime' in item ? item.endTime : item.time).getTime() === endOfTemplate.getTime());
    if (!hasEndMarker) {
        filteredItems.push({ id: 'marker-24hr-final', type: 'marker', time: endOfTemplate, label: formatTime(endOfTemplate) });
    }

    // Final sort
    filteredItems.sort((a, b) => {
        const timeA = 'time' in a ? a.time : a.startTime;
        const timeB = 'time' in b ? b.time : b.startTime;
        return timeA.getTime() - timeB.getTime();
    });

    // Determine the actual start and end times of the *rendered* content
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


  // Find the currently active item for the progress line overlay
  const activeItem = useMemo(() => {
    for (const item of finalDisplayItems) {
      if (item.type === 'task' || item.type === 'break' || item.type === 'free-time') {
        if (T_current >= item.startTime && T_current < item.endTime) {
          return item;
        }
      }
    }
    return null;
  }, [finalDisplayItems, T_current]);

  // Calculate the top position for the progress line within the active item
  const progressLineTopPercentage = useMemo(() => {
    if (!activeItem) return 0;

    const itemStartTime = activeItem.startTime.getTime();
    const itemEndTime = activeItem.endTime.getTime();
    const itemDurationMs = itemEndTime - itemStartTime;

    if (itemDurationMs === 0) return 0; // Avoid division by zero for instantaneous items

    const timeIntoItemMs = T_current.getTime() - itemStartTime;
    return (timeIntoItemMs / itemDurationMs) * 100;
  }, [activeItem, T_current]);


  const showGlobalProgressLine = T_current >= firstItemStartTime && T_current < lastItemEndTime;

  // Define totalScheduledMinutes here, before it's used in JSX
  const totalScheduledMinutes = schedule ? (schedule.summary.activeTime.hours * 60 + schedule.summary.activeTime.minutes + schedule.summary.breakTime) : 0;

  const renderDisplayItem = (item: DisplayItem) => {
    if (item.type === 'marker') {
      return (
        <React.Fragment key={item.id}>
          <div className="flex items-center justify-end pr-2">
            <span className="text-xs font-mono text-muted-foreground">
              {item.label}
            </span>
          </div>
          <div></div>
        </React.Fragment>
      );
    } else if (item.type === 'free-time') {
      const freeTimeItem = item as FreeTimeItem;
      const isCurrent = activeItem?.id === freeTimeItem.id;

      return (
        <React.Fragment key={freeTimeItem.id}>
          <div></div>
          <div 
            className={cn(
              "relative flex items-center justify-center text-muted-foreground italic text-sm h-[20px] rounded-lg shadow-sm transition-all duration-200 ease-in-out",
              isCurrent ? "bg-live-progress/10 border border-live-progress" : "bg-secondary/50 hover:bg-secondary/70"
            )}
          >
            {freeTimeItem.message}
            {isCurrent && (
              <>
                <div 
                  className="absolute left-0 right-0 h-[2px] bg-live-progress z-20 animate-pulse-glow" 
                  style={{ top: `${progressLineTopPercentage}%` }}
                ></div>
                <div className="absolute right-full mr-2 z-30" style={{ top: `${progressLineTopPercentage}%` }}>
                  <span className="px-2 py-1 rounded-md bg-live-progress text-white text-xs font-semibold whitespace-nowrap animate-pulse-glow">
                    ➡️ LIVE PROGRESS - Time is {formatTime(T_current)}
                  </span>
                </div>
              </>
            )}
          </div>
        </React.Fragment>
      );
    } else { // It's a ScheduledItem (task or break)
      const scheduledItem = item as ScheduledItem;
      const isActive = scheduledItem.startTime <= T_current && scheduledItem.endTime > T_current;
      const isPast = scheduledItem.endTime <= T_current;
      const isCurrent = activeItem?.id === scheduledItem.id;
      const pillEmoji = isActive ? '🟢' : '⚪';

      // Only render scheduled items if they are within or after the start of the 24-hour template
      if (scheduledItem.endTime < startOfTemplate) return null;

      return (
        <React.Fragment key={scheduledItem.id}>
          <div className="flex items-center justify-end pr-2">
            <span className={cn(
              "px-2 py-1 rounded-md text-xs font-mono transition-colors duration-200",
              isCurrent ? "bg-live-progress text-white" :
              isActive ? "bg-primary text-primary-foreground hover:bg-primary/70" : isPast ? "bg-muted text-muted-foreground" : "bg-secondary text-secondary-foreground",
              "hover:scale-105"
            )}>
              {formatTime(scheduledItem.startTime)} {/* Only start time in the left column */}
            </span>
          </div>

          <div
            className={cn(
              "relative flex flex-col justify-center gap-1 p-3 rounded-lg shadow-sm transition-all duration-200 ease-in-out animate-pop-in", // Changed to flex-col
              scheduledItem.isTimedEvent ? "bg-blue-600 text-white" :
              isCurrent ? "bg-primary/10 border border-live-progress" : // Subtle background for current task
              isActive ? "bg-primary text-primary-foreground" : isPast ? "bg-muted text-muted-foreground" : "bg-secondary text-secondary-foreground",
              "hover:scale-[1.03] hover:shadow-lg hover:shadow-primary/20 hover:border-primary"
            )}
            style={getBubbleHeightStyle(scheduledItem.duration)}
          >
            <div className="flex items-center justify-between w-full"> {/* Wrapper for main content and button */}
              <span className={cn(
                "text-sm flex-grow",
                scheduledItem.isTimedEvent ? "text-white" :
                isCurrent ? "text-foreground" : // Ensure text is readable on subtle background
                isActive ? "text-primary-foreground" : isPast ? "text-muted-foreground italic" : "text-foreground"
              )}>
                {scheduledItem.emoji} <span className="font-bold">{scheduledItem.name}</span> ({scheduledItem.duration} min)
                {scheduledItem.type === 'break' && scheduledItem.description && (
                  <span className="text-muted-foreground ml-1"> - {scheduledItem.description}</span>
                )}
              </span>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => onRemoveTask(scheduledItem.id)} 
                className={cn(
                  "h-6 w-6 p-0 shrink-0",
                  scheduledItem.isTimedEvent ? "text-white hover:bg-blue-700" :
                  isCurrent ? "text-live-progress hover:bg-live-progress/20" : // Button color for current task
                  isActive ? "text-primary-foreground hover:bg-primary/80" : "text-muted-foreground hover:bg-secondary/80"
                )}
              >
                <Trash className="h-4 w-4" />
                <span className="sr-only">Remove task</span>
              </Button>
            </div>
            {/* New: Time range inside the pill */}
            <span className={cn(
              "text-xs font-mono",
              scheduledItem.isTimedEvent ? "text-blue-200" :
              isCurrent ? "text-live-progress" :
              isActive ? "text-primary-foreground/80" : isPast ? "text-muted-foreground/80" : "text-secondary-foreground/80"
            )}>
              {formatTime(scheduledItem.startTime)} - {formatTime(scheduledItem.endTime)}
            </span>

            {isCurrent && (
              <>
                <div 
                  className="absolute left-0 right-0 h-[2px] bg-live-progress z-20 animate-pulse-glow" 
                  style={{ top: `${progressLineTopPercentage}%` }}
                ></div>
                <div className="absolute right-full mr-2 z-30" style={{ top: `${progressLineTopPercentage}%` }}>
                  <span className="px-2 py-1 rounded-md bg-live-progress text-white text-xs font-semibold whitespace-nowrap animate-pulse-glow">
                    ➡️ LIVE PROGRESS - Time is {formatTime(T_current)}
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
    <div className="space-y-4 animate-slide-in-up">
      <Card className="animate-pop-in">
        <CardContent className="p-0">
          {/* Main Schedule Body - This is the scrollable area with items and the global progress line */}
          <div className="relative p-4 overflow-y-auto">
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              {/* Render top/bottom messages when outside the active schedule */}
              {!activeItem && T_current < firstItemStartTime && (
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
              {!activeItem && T_current >= endOfTemplate && (
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

              {/* Scheduled Items */}
              {finalDisplayItems.map((item) => (
                <React.Fragment key={item.id}>
                  {renderDisplayItem(item)}
                </React.Fragment>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Smart Suggestions */}
      {totalScheduledMinutes > 0 && schedule?.summary.totalTasks > 0 && (
        <Card className="animate-pop-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-5 w-5 text-logo-yellow" /> Smart Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {schedule?.summary.extendsPastMidnight && (
              <p className="text-orange-500 font-semibold">⚠️ {schedule.summary.midnightRolloverMessage}</p>
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
};

export default SchedulerDisplay;