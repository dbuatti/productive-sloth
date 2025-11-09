import React from 'react';
import { ScheduledItem, FormattedSchedule } from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/scheduler-utils'; // Import formatTime

interface SchedulerDisplayProps {
  schedule: FormattedSchedule | null;
  T_current: Date;
}

// Helper to determine dynamic bubble height based on duration
const getBubbleHeightStyle = (duration: number) => {
  const baseHeight = 40; // px for a very short task
  const multiplier = 1.5; // px per minute
  const maxHeight = 150; // px to prevent overly tall bubbles

  let calculatedHeight = baseHeight + (duration * multiplier);
  return { minHeight: `${Math.min(calculatedHeight, maxHeight)}px` };
};

const SchedulerDisplay: React.FC<SchedulerDisplayProps> = ({ schedule, T_current }) => {
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

    return (
      <React.Fragment key={item.id}>
        {/* Time Track Item (Pill Design) */}
        <div className="flex items-center">
          <span className={cn(
            "px-2 py-1 rounded-md text-xs font-mono", // Pill styling for time
            isActive ? "bg-primary text-primary-foreground" : isPast ? "bg-muted text-muted-foreground" : "bg-secondary text-secondary-foreground"
          )}>
            {pillEmoji} {formatTime(item.startTime)}
          </span>
        </div>

        {/* Task Bubble (Dynamic Height) */}
        <div
          className={cn(
            "flex items-center gap-2 p-3 rounded-lg shadow-sm transition-all duration-200",
            isActive ? "bg-primary text-primary-foreground shadow-md" : isPast ? "bg-muted text-muted-foreground" : "bg-secondary text-secondary-foreground",
            "relative" // For potential future absolute positioning of XP/Energy
          )}
          style={getBubbleHeightStyle(item.duration)} // Dynamic height
        >
          <span className="text-sm">
            {item.emoji} <span className="font-bold">{item.name}</span> ({item.duration} min)
            {item.type === 'break' && item.description && (
              <span className="text-muted-foreground ml-1"> - {item.description}</span>
            )}
          </span>
        </div>
      </React.Fragment>
    );
  };

  const totalScheduledMinutes = schedule.summary.activeTime.hours * 60 + schedule.summary.activeTime.minutes + schedule.summary.breakTime;

  return (
    <div className="space-y-4 animate-slide-in-up">
      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 p-4 border rounded-lg bg-card shadow-sm">
        <div className="col-span-2 text-lg font-bold text-foreground mb-2">
          <span className="text-primary">TIME TRACK</span>
          <span className="ml-8 text-primary">TASK BUBBLES</span>
        </div>
        <div className="col-span-2 border-b border-dashed border-border mb-2" />

        {schedule.progressLineIndex === -1 && (
          <div className="col-span-2 text-center text-muted-foreground text-sm py-2">
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            <p className="font-semibold">{schedule.progressLineMessage}</p>
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          </div>
        )}

        {schedule.items.map((item, index) => (
          <React.Fragment key={item.id}>
            {renderScheduleItem(item, index)}
            {index === schedule.progressLineIndex && (
              <div className="col-span-2 text-center text-muted-foreground text-sm py-2">
                ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                <p className="font-semibold">{schedule.progressLineMessage}</p>
                ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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
        <div className="p-4 border rounded-lg bg-card shadow-sm text-sm">
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