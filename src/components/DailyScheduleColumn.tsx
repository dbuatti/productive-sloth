import React from 'react';
import { DBScheduledTask } from '@/types/scheduler';
import { format, isToday, isPast, isBefore, parseISO, setHours, setMinutes, addDays, differenceInMinutes, isAfter, addHours } from 'date-fns';
import { cn } from '@/lib/utils';
import SimplifiedScheduledTaskItem from './SimplifiedScheduledTaskItem';
import { Clock } from 'lucide-react';
import { setTimeOnDate } from '@/lib/scheduler-utils';

interface DailyScheduleColumnProps {
  dayDate: Date; // The date for this column (local Date object for 00:00:00)
  tasks: DBScheduledTask[];
  workdayStartTime: string; // HH:MM string from profile
  workdayEndTime: string;   // HH:MM string from profile
  isDetailedView: boolean;
  T_current: Date; // Current time from SessionProvider
  zoomLevel: number; // Vertical zoom level prop
  columnWidth: number; // Horizontal zoom (column width) prop
}

const BASE_MINUTE_HEIGHT = 2.5; // Base height for 1 minute at 100% zoom

const DailyScheduleColumn: React.FC<DailyScheduleColumnProps> = ({
  dayDate,
  tasks,
  workdayStartTime,
  workdayEndTime,
  isDetailedView,
  T_current,
  zoomLevel, // Vertical zoom level
  columnWidth, // Destructure columnWidth
}) => {
  const isCurrentDay = isToday(dayDate);

  // Always use a full 24-hour period for the grid's internal timeline
  const gridStart = setHours(setMinutes(dayDate, 0), 0); // 00:00 local time
  const gridEnd = addDays(gridStart, 1); // 24:00 local time (next day's 00:00)
  const totalGridMinutes = differenceInMinutes(gridEnd, gridStart);
  const dynamicMinuteHeight = BASE_MINUTE_HEIGHT * zoomLevel;

  // Calculate workday start and end as local Date objects for the current dayDate
  const localWorkdayStart = setTimeOnDate(dayDate, workdayStartTime);
  let localWorkdayEnd = setTimeOnDate(dayDate, workdayEndTime);
  if (isBefore(localWorkdayEnd, localWorkdayStart)) {
    localWorkdayEnd = addDays(localWorkdayEnd, 1);
  }

  // Generate time slots for every hour across the 24-hour grid
  const timeSlots = Array.from({ length: 24 }).map((_, i) => {
    const hour = addHours(gridStart, i);
    return format(hour, 'h a');
  });

  const getTaskPositionAndHeight = (task: DBScheduledTask) => {
    const taskStartUTC = parseISO(task.start_time!);
    const taskEndUTC = parseISO(task.end_time!);

    // Convert UTC task times to local times relative to the current dayDate
    let localTaskStart = setTimeOnDate(dayDate, format(taskStartUTC, 'HH:mm'));
    let localTaskEnd = setTimeOnDate(dayDate, format(taskEndUTC, 'HH:mm'));
    
    // Handle tasks that span across midnight
    if (isBefore(localTaskEnd, localTaskStart)) {
      localTaskEnd = addDays(localTaskEnd, 1);
    }

    const offsetMinutes = differenceInMinutes(localTaskStart, gridStart);
    const durationMinutes = differenceInMinutes(localTaskEnd, localTaskStart);

    const top = offsetMinutes * dynamicMinuteHeight;
    const height = durationMinutes * dynamicMinuteHeight;

    return { top, height, durationMinutes };
  };

  return (
    <div 
      className="relative flex-shrink-0 border-r border-border/50 last:border-r-0"
      style={{ width: `${columnWidth}px` }}
    >
      {/* Day Header */}
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-sm p-2 border-b border-border/50 text-center">
        <p className={cn(
          "text-[9px] sm:text-[10px] font-black uppercase tracking-widest",
          isCurrentDay ? "text-primary" : "text-muted-foreground/60"
        )}>
          {format(dayDate, 'EEE')}
        </p>
        <p className={cn(
          "text-base sm:text-lg font-black tracking-tighter leading-none",
          isCurrentDay ? "text-foreground" : "text-muted-foreground/80"
        )}>
          {format(dayDate, 'd')}
        </p>
      </div>

      {/* Time Grid Lines */}
      <div className="absolute inset-0">
        {timeSlots.map((_, i) => (
          <div
            key={i}
            className="absolute left-0 right-0 border-t border-dashed border-border/20"
            style={{ top: `${(i * 60) * dynamicMinuteHeight}px` }}
          />
        ))}
      </div>

      {/* Workday Window Highlight */}
      {totalGridMinutes > 0 && (
        <div
          className="absolute left-0 right-0 bg-primary/5 z-0"
          style={{
            top: `${differenceInMinutes(localWorkdayStart, gridStart) * dynamicMinuteHeight}px`,
            height: `${differenceInMinutes(localWorkdayEnd, localWorkdayStart) * dynamicMinuteHeight}px`,
          }}
        />
      )}

      {/* Current Time Indicator (only for today) */}
      {isCurrentDay && (
        <div
          className="absolute left-0 right-0 h-0.5 bg-live-progress z-20 animate-pulse"
          style={{
            top: `${differenceInMinutes(T_current, gridStart) * dynamicMinuteHeight}px`,
            display: isBefore(T_current, gridEnd) && isAfter(T_current, gridStart) ? 'block' : 'none'
          }}
        >
          <div className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full bg-live-progress shadow-[0_0_10px_hsl(var(--live-progress))]" />
        </div>
      )}

      {/* Tasks */}
      <div className="relative px-1" style={{ height: `${totalGridMinutes * dynamicMinuteHeight}px` }}>
        {tasks.map((task) => {
          const { top, height, durationMinutes } = getTaskPositionAndHeight(task);
          const isPastTask = isPast(parseISO(task.end_time!)) && !isCurrentDay;
          const isCurrentlyActive = isCurrentDay && T_current >= parseISO(task.start_time!) && T_current < parseISO(task.end_time!);

          return (
            <div
              key={task.id}
              className={cn(
                "absolute left-1 right-1 rounded-md p-0.5 transition-all duration-300",
                "bg-card/60 border border-white/5",
                isPastTask && "opacity-40 grayscale pointer-events-none"
              )}
              style={{ top: `${top}px`, height: `${height}px` }}
            >
              <SimplifiedScheduledTaskItem task={task} isDetailedView={isDetailedView} isCurrentlyActive={isCurrentlyActive} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DailyScheduleColumn;