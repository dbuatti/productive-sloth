import React from 'react';
import { ScheduledItem, FormattedSchedule } from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/scheduler-utils'; // Import formatTime
import { Button } from '@/components/ui/button'; // Import Button
import { Trash } from 'lucide-react'; // Import Trash icon

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
  if (!schedule || schedule.items.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center space-y-4 animate-slide-in-up">
        <p className="text-lg font-semibold">No schedule generated yet.</p>
        <p>Enter tasks to see your time-blocked day!</p>
      </div>
    );
  }

  const renderScheduleItem = (item: ScheduledItem, index: number) => {
    const isActive = item.startTime <= T_current && item.endTime > T_current;
    const isPast = item.endTime <= T_current;
    const pillEmoji = isActive ? '🟢' : '⚪';

    let redLineStyle = {};
    if (isActive) {
      const totalDurationMs = item.endTime.getTime() - item.startTime.getTime();
      const elapsedDurationMs = T_current.getTime() - item.startTime.getTime();
      const progressPercentage = (elapsedDurationMs / totalDurationMs) * 100;
      redLineStyle = { top: `${progressPercentage}%` };
    }

    return (
      <React.Fragment key={item.id}>
        {/* Time Track Item (Pill Design) */}
        <div className="flex items-center">
          <span className={cn(
            "px-2 py-1 rounded-md text-xs font-mono transition-colors duration-200",
            isActive ? "bg-primary text-primary-foreground hover:bg-primary/70" : isPast ? "bg-muted text-muted-foreground" : "bg-secondary text-secondary-foreground"
          )}>
            {pillEmoji} {formatTime(item.startTime)}
          </span>
        </div>

        {/* Task Bubble (Dynamic Height) */}
        <div
          className={cn(
            "flex items-center justify-between gap-2 p-3 rounded-lg shadow-sm transition-all duration-200 ease-in-out animate-pop-in",
            isActive ? "bg-primary text-primary-foreground shadow-md relative" : isPast ? "bg-muted text-muted-foreground" : "bg-secondary text-secondary-foreground",
            "relative hover:scale-[1.01] hover:shadow-lg hover:border-primary" // Added hover:border-primary
          )}
          style={getBubbleHeightStyle(item.duration)}
        >
          <span className={cn(
            "text-sm flex-grow", // flex-grow to push button to right
            isActive ? "text-primary-foreground" : isPast ? "text-muted-foreground italic" : "text-foreground"
          )}>
            {item.emoji} <span className="font-bold">{item.name}</span> ({item.duration} min)
            {item.type === 'break' && item.description && (
              <span className="text-muted-foreground ml-1"> - {item.description}</span>
            )}
          </span>
          {isActive && (
            <div
              className="absolute left-0 right-0 h-[3px] bg-red-500 z-10 transition-all duration-1000 ease-linear" // Thicker red line
              style={redLineStyle}
            />
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => onRemoveTask(item.id)} 
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
  };

  const totalScheduledMinutes = schedule.summary.activeTime.hours * 60 + schedule.summary.activeTime.minutes + schedule.summary.breakTime;

  return (
    <div className="space-y-4 animate-slide-in-up">
      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 p-4 border rounded-lg bg-card shadow-sm">
        {/* Column Headers */}
        <div className="col-span-2 grid grid-cols-[auto_1fr] gap-x-4 pb-2 mb-2 border-b border-dashed border-border">
          <div className="text-lg font-bold text-primary">TIME TRACK</div>
          <div className="text-lg font-bold text-primary">TASK BUBBLES</div>
        </div>

        {schedule.progressLineIndex === -1 && (
          <div className="col-span-2 text-center text-muted-foreground text-sm py-2 border-y border-dashed border-primary/50 animate-pulse-glow">
            <p className="font-semibold">{schedule.progressLineMessage}</p>
          </div>
        )}

        {schedule.items.map((item, index) => (
          <React.Fragment key={item.id}>
            {renderScheduleItem(item, index)}
            {index === schedule.progressLineIndex && (
              <div className="col-span-2 text-center text-muted-foreground text-sm py-2 border-y border-dashed border-primary/50 animate-pulse-glow">
                <p className="font-semibold">{schedule.progressLineMessage}</p>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Smart Suggestions */}
      {totalScheduledMinutes > 0 && schedule.summary.totalTasks > 0 && (
        <div className="space-y-2 text-sm text-muted-foreground">
          {schedule.summary.extendsPastMidnight && (
            <p className="text-orange-500 font-semibold">{schedule.summary.midnightRolloverMessage}</p>
          )}
          {totalScheduledMinutes < 6 * 60 && (
            <p>💡 Light day! Consider adding buffer time for flexibility.</p>
          )}
          {totalScheduledMinutes > 12 * 60 && (
            <p className="text-red-500">⚠️ Intense schedule. Remember to include meals and rest.</p>
          )}
        </div>
      )}

      {/* Session Summary Footer */}
      {totalScheduledMinutes > 0 && schedule.summary.totalTasks > 0 && (
        <div className="p-4 border rounded-lg bg-secondary/20 shadow-sm text-sm">
          <h3 className="font-bold text-foreground mb-2">📊 SESSION SUMMARY</h3>
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