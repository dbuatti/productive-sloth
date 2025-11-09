import React, { useMemo } from 'react';
import { ScheduledItem, FormattedSchedule, DisplayItem, TimeMarker, FreeTimeItem } from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/scheduler-utils'; // Removed generateFixedTimeMarkers as it's no longer directly used for displayItems
import { Button } from '@/components/ui/button';
import { Trash } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, BarChart, ListTodo } from 'lucide-react';
import { startOfDay, addHours } from 'date-fns';

interface SchedulerDisplayProps {
  schedule: FormattedSchedule | null;
  T_current: Date;
  onRemoveTask: (taskId: string) => void;
}

// Helper to determine dynamic bubble height based on duration
const getBubbleHeightStyle = (duration: number) => {
  const baseHeight = 40; // px for a very short task
  const multiplier = 1.5; // px per minute
  const maxHeight = 150; // px to prevent overly tall bubbles

  let calculatedHeight = baseHeight + (duration * multiplier);
  return { minHeight: `${Math.min(calculatedHeight, maxHeight)}px` };
};

const SchedulerDisplay: React.FC<SchedulerDisplayProps> = ({ schedule, T_current, onRemoveTask }) => {
  const displayItems: DisplayItem[] = useMemo(() => {
    const startOfToday = startOfDay(T_current); // 12:00 AM
    const templateNoon = addHours(startOfToday, 12); // 12:00 PM (Noon)

    const scheduledTasks = schedule ? schedule.items : [];

    // Collect all unique time points relevant to the display (start/end of template, task start/end)
    const timePoints = new Set<number>();
    timePoints.add(startOfToday.getTime());
    timePoints.add(templateNoon.getTime());
    scheduledTasks.forEach(task => {
      timePoints.add(task.startTime.getTime());
      timePoints.add(task.endTime.getTime());
    });

    // Sort unique time points chronologically
    const sortedTimePoints = Array.from(timePoints).sort((a, b) => a - b);

    const finalDisplayItems: DisplayItem[] = [];
    let currentCursor = startOfToday; // Tracks the end time of the last processed item

    for (let i = 0; i < sortedTimePoints.length; i++) {
      const pointTime = new Date(sortedTimePoints[i]);

      // If this point is beyond the template noon, stop processing
      if (pointTime.getTime() > templateNoon.getTime()) {
        break;
      }

      // 1. Add Free Time if there's a gap between currentCursor and pointTime
      if (pointTime.getTime() > currentCursor.getTime()) {
        const freeDurationMs = pointTime.getTime() - currentCursor.getTime();
        const freeDurationMinutes = Math.floor(freeDurationMs / (1000 * 60));
        if (freeDurationMinutes > 0) {
          finalDisplayItems.push({
            id: `free-${currentCursor.toISOString()}-${pointTime.toISOString()}`,
            type: 'free-time',
            startTime: currentCursor,
            endTime: pointTime,
            duration: freeDurationMinutes,
            message: `${Math.floor(freeDurationMinutes / 60)}h ${freeDurationMinutes % 60}min Free Time`,
          });
        }
      }

      // 2. Add Scheduled Tasks that start exactly at this pointTime
      const tasksStartingAtPoint = scheduledTasks.filter(task => task.startTime.getTime() === pointTime.getTime());
      tasksStartingAtPoint.sort((a, b) => a.endTime.getTime() - b.endTime.getTime()); // Ensure stable order for tasks starting at same time

      tasksStartingAtPoint.forEach(task => {
        finalDisplayItems.push(task);
      });

      // 3. Add 12 AM or 12 PM markers if no task starts at that exact time
      if ((pointTime.getTime() === startOfToday.getTime() || pointTime.getTime() === templateNoon.getTime()) && !tasksStartingAtPoint.length) {
        finalDisplayItems.push({
          id: `marker-${pointTime.toISOString()}`,
          type: 'marker',
          time: pointTime,
          label: formatTime(pointTime),
        });
      }
      
      // Update currentCursor to the latest end time of any event that started at or before pointTime
      let maxEndTimeAtOrBeforePoint = pointTime; // Default to the current point in time

      // Consider tasks that started at pointTime
      tasksStartingAtPoint.forEach(task => {
        if (task.endTime.getTime() > maxEndTimeAtOrBeforePoint.getTime()) {
          maxEndTimeAtOrBeforePoint = task.endTime;
        }
      });
      
      // Also consider the currentCursor itself, in case a previous task ended after pointTime
      if (currentCursor.getTime() > maxEndTimeAtOrBeforePoint.getTime()) {
          maxEndTimeAtOrBeforePoint = currentCursor;
      }

      currentCursor = maxEndTimeAtOrBeforePoint;
    }

    // Final pass to ensure items are within the 12 AM - 12 PM template and remove any duplicates
    const uniqueAndBoundedItems: DisplayItem[] = [];
    const seenIds = new Set<string>();

    finalDisplayItems.forEach(item => {
      const itemStartTime = 'time' in item ? item.time : item.startTime;
      const itemEndTime = 'time' in item ? item.time : item.endTime;

      // Only include items that start before or at templateNoon and end after or at startOfToday
      if (itemStartTime.getTime() < templateNoon.getTime() && itemEndTime.getTime() > startOfToday.getTime()) {
        if (!seenIds.has(item.id)) {
          uniqueAndBoundedItems.push(item);
          seenIds.add(item.id);
        }
      }
    });

    // Sort one last time to ensure correct order after filtering
    uniqueAndBoundedItems.sort((a, b) => {
      const timeA = 'time' in a ? a.time : a.startTime;
      const timeB = 'time' in b ? b.time : b.startTime;
      return timeA.getTime() - timeB.getTime();
    });

    return uniqueAndBoundedItems;
  }, [schedule, T_current]);

  // Calculate global progress line position
  const startOfTemplate = startOfDay(T_current); // 12:00 AM
  const endOfTemplate = addHours(startOfTemplate, 12); // 12:00 PM (Noon)

  const totalTemplateDurationMs = endOfTemplate.getTime() - startOfTemplate.getTime();
  const elapsedFromTemplateStartMs = T_current.getTime() - startOfTemplate.getTime();
  let globalProgressLineTop = (elapsedFromTemplateStartMs / totalTemplateDurationMs) * 100;
  
  // Clamp to 0-100%
  globalProgressLineTop = Math.max(0, Math.min(100, globalProgressLineTop));

  const showGlobalProgressLine = T_current >= startOfTemplate && T_current < endOfTemplate;

  const renderDisplayItem = (item: DisplayItem) => {
    if (item.type === 'marker') {
      // Markers are rendered as time labels in the left column, with an empty right column
      return (
        <React.Fragment key={item.id}>
          <div className="flex items-center">
            <span className="px-2 py-1 rounded-md text-xs font-mono bg-secondary text-secondary-foreground">
              {item.label}
            </span>
          </div>
          <div></div> {/* Empty right column for markers */}
        </React.Fragment>
      );
    } else if (item.type === 'free-time') {
      const freeTimeItem = item as FreeTimeItem;
      // Free time items only render in the right column, with an empty left column
      return (
        <React.Fragment key={freeTimeItem.id}>
          <div></div> {/* Empty left column for free time */}
          <div className="flex items-center justify-center p-3 rounded-lg shadow-sm bg-muted/30 text-muted-foreground italic text-sm">
            {freeTimeItem.message}
          </div>
        </React.Fragment>
      );
    } else { // It's a ScheduledItem (task or break)
      const scheduledItem = item as ScheduledItem;
      const isActive = scheduledItem.startTime <= T_current && scheduledItem.endTime > T_current;
      const isPast = scheduledItem.endTime <= T_current;
      const pillEmoji = isActive ? '🟢' : '⚪';

      // Only render scheduled items if they are within or after the 12 AM - 12 PM template
      if (scheduledItem.endTime < startOfTemplate) return null;

      return (
        <React.Fragment key={scheduledItem.id}>
          {/* Time Track Item (Pill Design) */}
          <div className="flex items-center">
            <span className={cn(
              "px-2 py-1 rounded-md text-xs font-mono transition-colors duration-200",
              isActive ? "bg-primary text-primary-foreground hover:bg-primary/70" : isPast ? "bg-muted text-muted-foreground" : "bg-secondary text-secondary-foreground",
              "hover:scale-105"
            )}>
              {pillEmoji} {formatTime(scheduledItem.startTime)}
            </span>
          </div>

          {/* Task Bubble (Dynamic Height) */}
          <div
            className={cn(
              "flex items-center justify-between gap-2 p-3 rounded-lg shadow-sm transition-all duration-200 ease-in-out animate-pop-in",
              isActive ? "bg-primary text-primary-foreground" : isPast ? "bg-muted text-muted-foreground" : "bg-secondary text-secondary-foreground",
              "relative hover:scale-[1.03] hover:shadow-lg hover:shadow-primary/20 hover:border-primary"
            )}
            style={getBubbleHeightStyle(scheduledItem.duration)}
          >
            <span className={cn(
              "text-sm flex-grow",
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
                isActive ? "text-primary-foreground hover:bg-primary/80" : "text-muted-foreground hover:bg-secondary/80"
              )}
            >
              <Trash className="h-4 w-4" />
              <span className="sr-only">Remove task</span>
            </Button>
          </div>
        </React.Fragment>
      );
    }
  };

  const totalScheduledMinutes = schedule ? (schedule.summary.activeTime.hours * 60 + schedule.summary.activeTime.minutes + schedule.summary.breakTime) : 0;

  return (
    <div className="space-y-4 animate-slide-in-up">
      <Card className="animate-pop-in">
        {/* Removed CardHeader with "Your Vibe Schedule" */}
        <CardContent className="p-0">
          {/* Removed Column Headers */}

          {/* Main Schedule Body - This is the scrollable area with items and the global progress line */}
          <div className="relative p-4 overflow-y-auto">
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              {/* Global Progress Line */}
              {showGlobalProgressLine && (
                <div
                  className="absolute left-0 right-0 h-[4px] bg-primary/20 z-20 flex items-center justify-center"
                  style={{ top: `${globalProgressLineTop}%`, transition: 'top 60s linear' }}
                >
                  {/* Removed the span for the message */}
                </div>
              )}
              {/* Render top/bottom messages when outside the active schedule */}
              {!showGlobalProgressLine && T_current < startOfTemplate && (
                <div className={cn(
                  "absolute left-0 right-0 text-center text-muted-foreground text-sm py-2 border-y border-dashed border-primary/50 animate-pulse-glow",
                  "top-0"
                )}>
                  <p className="font-semibold">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</p>
                  <p className="font-semibold text-primary flex items-center justify-center gap-2">
                    ⏳ Schedule starts later today
                  </p>
                  <p className="font-semibold">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</p>
                </div>
              )}
              {!showGlobalProgressLine && T_current >= endOfTemplate && (
                <div className={cn(
                  "absolute left-0 right-0 text-center text-muted-foreground text-sm py-2 border-y border-dashed border-primary/50 animate-pulse-glow",
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
              {displayItems.map((item) => (
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
            {schedule.summary.extendsPastMidnight && (
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

      {/* Session Summary Footer */}
      {totalScheduledMinutes > 0 && schedule?.summary.totalTasks > 0 && (
        <div className="p-4 border rounded-lg bg-secondary/20 shadow-sm text-sm border-t border-dashed border-border">
          <h3 className="font-bold text-foreground mb-2 flex items-center gap-2">
            <BarChart className="h-5 w-5 text-primary" /> 📊 SESSION SUMMARY
          </h3>
          <div className="border-b border-dashed border-border mb-2" />
          <p>Total Tasks: <span className="font-semibold">{schedule.summary.totalTasks}</span></p>
          <p>Active Time: <span className="font-semibold">{schedule.summary.activeTime.hours} hours {schedule.summary.activeTime.minutes} min</span></p>
          <p>Break Time: <span className="font-semibold">{schedule.summary.breakTime} min</span></p>
          <p>Session End: <span className="font-semibold">{formatTime(schedule.summary.sessionEnd)}</span></p>
        </div>
      )}
    </div>
  );
};

export default SchedulerDisplay;