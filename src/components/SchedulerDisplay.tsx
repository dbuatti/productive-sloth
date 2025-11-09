import React, { useMemo } from 'react';
import { ScheduledItem, FormattedSchedule, DisplayItem, TimeMarker } from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { formatTime, generateFixedTimeMarkers } from '@/lib/scheduler-utils'; // Import formatTime and generateFixedTimeMarkers
import { Button } from '@/components/ui/button'; // Import Button
import { Trash } from 'lucide-react'; // Import Trash icon
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'; // Import Card components
import { Sparkles, BarChart, ListTodo } from 'lucide-react'; // Import Sparkles, BarChart, and ListTodo icons
import { startOfDay, addHours } from 'date-fns';

interface SchedulerDisplayProps {
  schedule: FormattedSchedule | null;
  T_current: Date;
  onRemoveTask: (taskId: string) => void; // New prop for removing tasks
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
    const fixedMarkers = generateFixedTimeMarkers(T_current);
    const allItems: DisplayItem[] = [...fixedMarkers];

    if (schedule) {
      // Add scheduled tasks, ensuring they don't duplicate fixed markers if they start at the exact same time
      schedule.items.forEach(task => {
        // Check if a fixed marker exists at the exact start time of the task
        const isDuplicateMarker = fixedMarkers.some(marker => 
          marker.time.getTime() === task.startTime.getTime()
        );
        if (!isDuplicateMarker) {
          allItems.push(task);
        } else {
          // If there's a marker, we'll render the task, but the marker might still be useful as a boundary.
          // For now, we'll just add the task and let sorting handle it.
          allItems.push(task);
        }
      });
    }

    // Sort all items by their time
    allItems.sort((a, b) => {
      const timeA = 'time' in a ? a.time : a.startTime;
      const timeB = 'time' in b ? b.time : b.startTime;
      return timeA.getTime() - timeB.getTime();
    });

    // Filter out redundant markers if a task starts very close to it
    const filteredItems: DisplayItem[] = [];
    let lastItemTime: Date | null = null;

    allItems.forEach(item => {
      const currentTime = 'time' in item ? item.time : item.startTime;
      
      // If it's a marker and the previous item was a task that started at the same time, skip this marker
      if (item.type === 'marker' && lastItemTime && currentTime.getTime() === lastItemTime.getTime()) {
        return;
      }
      filteredItems.push(item);
      lastItemTime = currentTime;
    });

    return filteredItems;
  }, [schedule, T_current]);

  // Calculate global progress line position and message
  const startOfTemplate = startOfDay(T_current); // 12:00 AM
  const endOfTemplate = addHours(startOfTemplate, 12); // 12:00 PM (Noon)

  const totalTemplateDurationMs = endOfTemplate.getTime() - startOfTemplate.getTime();
  const elapsedFromTemplateStartMs = T_current.getTime() - startOfTemplate.getTime();
  let globalProgressLineTop = (elapsedFromTemplateStartMs / totalTemplateDurationMs) * 100;
  
  // Clamp to 0-100%
  globalProgressLineTop = Math.max(0, Math.min(100, globalProgressLineTop));

  const showGlobalProgressLine = T_current >= startOfTemplate && T_current < endOfTemplate;
  const globalProgressMessage = `➡️ CURRENT PROGRESS - Time is ${formatTime(T_current)}`;

  const renderDisplayItem = (item: DisplayItem, index: number) => {
    if (item.type === 'marker') {
      // Check if there's an actual task that starts at or very close to this marker's time
      const hasOverlappingTask = schedule?.items.some(task => 
        task.startTime.getTime() === item.time.getTime()
      );

      if (hasOverlappingTask) {
        // If a task starts at this marker, we'll let the task render its own time.
        // We can still render the marker as a subtle boundary if needed, or skip it.
        // For now, let's just render the marker's time as a boundary.
        return (
          <React.Fragment key={item.id}>
            <div className="flex items-center">
              <span className="px-2 py-1 rounded-md text-xs font-mono bg-secondary text-secondary-foreground">
                {item.label}
              </span>
            </div>
            <div className="text-sm text-muted-foreground italic py-2">
              {/* This space will be filled by the actual task item */}
            </div>
          </React.Fragment>
        );
      } else if (item.time < T_current && item.time < endOfTemplate) {
        // If marker is in the past but before T_current and within template, show empty
        return (
          <React.Fragment key={item.id}>
            <div className="flex items-center">
              <span className="px-2 py-1 rounded-md text-xs font-mono bg-muted text-muted-foreground">
                {item.label}
              </span>
            </div>
            <div className="text-sm text-muted-foreground italic py-2">
              (Empty template space)
            </div>
          </React.Fragment>
        );
      } else if (item.time >= T_current && item.time <= endOfTemplate) {
        // If marker is in the future but within template, show empty
        return (
          <React.Fragment key={item.id}>
            <div className="flex items-center">
              <span className="px-2 py-1 rounded-md text-xs font-mono bg-secondary text-secondary-foreground">
                {item.label}
              </span>
            </div>
            <div className="text-sm text-muted-foreground italic py-2">
              (Empty template space)
            </div>
          </React.Fragment>
        );
      }
      return null; // Don't render markers outside the 12 AM - 12 PM range or if they are past 12 PM
    } else { // It's a ScheduledItem (task or break)
      const scheduledItem = item as ScheduledItem;
      const isActive = scheduledItem.startTime <= T_current && scheduledItem.endTime > T_current;
      const isPast = scheduledItem.endTime <= T_current;
      const pillEmoji = isActive ? '🟢' : '⚪';

      // Only render scheduled items if they are within or after the 12 AM - 12 PM template
      // Or if they are the first item and start before 12 PM
      if (scheduledItem.endTime < startOfTemplate) return null; // Don't show tasks that ended before 12 AM

      return (
        <React.Fragment key={scheduledItem.id}>
          {/* Time Track Item (Pill Design) */}
          <div className="flex items-center">
            <span className={cn(
              "px-2 py-1 rounded-md text-xs font-mono transition-colors duration-200",
              isActive ? "bg-primary text-primary-foreground hover:bg-primary/70" : isPast ? "bg-muted text-muted-foreground" : "bg-secondary text-secondary-foreground",
              "hover:scale-105" // Added hover scale
            )}>
              {pillEmoji} {formatTime(scheduledItem.startTime)}
            </span>
          </div>

          {/* Task Bubble (Dynamic Height) */}
          <div
            className={cn(
              "flex items-center justify-between gap-2 p-3 rounded-lg shadow-sm transition-all duration-200 ease-in-out animate-pop-in",
              isActive ? "bg-primary text-primary-foreground" : isPast ? "bg-muted text-muted-foreground" : "bg-secondary text-secondary-foreground", // Removed border/shadow/animation for active state
              "relative hover:scale-[1.03] hover:shadow-lg hover:shadow-primary/20 hover:border-primary" // More pronounced hover effects
            )}
            style={getBubbleHeightStyle(scheduledItem.duration)}
          >
            <span className={cn(
              "text-sm flex-grow", // flex-grow to push button to right
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
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-xl">
            <ListTodo className="h-5 w-5 text-primary" /> Your Vibe Schedule {/* Added ListTodo icon */}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Column Headers - Fixed at the top of CardContent */}
          <div className="grid grid-cols-[auto_1fr] gap-x-4 pb-2 mb-2 border-b border-dashed border-border bg-secondary/10 rounded-t-lg px-4 pt-4">
            <div className="text-lg font-bold text-primary">TIME TRACK</div>
            <div className="text-lg font-bold text-primary">TASK BUBBLES</div>
          </div>

          {/* Main Schedule Body - This is the scrollable area with items and the global progress line */}
          <div className="relative p-4 overflow-y-auto"> {/* Removed maxHeight */}
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2"> {/* Inner grid for items */}
              {/* Global Progress Line */}
              {showGlobalProgressLine && (
                <div
                  className="absolute left-0 right-0 h-[4px] bg-primary/20 z-20 animate-pulse-glow flex items-center justify-center"
                  style={{ top: `${globalProgressLineTop}%`, transition: 'top 60s linear' }}
                >
                  <span className="absolute -top-6 px-2 py-1 rounded-md bg-primary text-primary-foreground text-xs font-semibold whitespace-nowrap">
                    {globalProgressMessage}
                  </span>
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
              {displayItems.map((item, index) => (
                <React.Fragment key={item.id}>
                  {renderDisplayItem(item, index)}
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