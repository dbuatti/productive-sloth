import React from 'react';
import { DBScheduledTask } from '@/types/scheduler';
import { format, isToday, isPast, isBefore, parseISO, setHours, setMinutes, addDays, differenceInMinutes, isAfter } from 'date-fns';
import { cn } from '@/lib/utils';
import SimplifiedScheduledTaskItem from './SimplifiedScheduledTaskItem';
import { Clock } from 'lucide-react';
import { setTimeOnDate } from '@/lib/scheduler-utils';

interface DailyScheduleColumnProps {
  dayDate: Date; // The date for this column
  tasks: DBScheduledTask[];
  workdayStartTime: string; // HH:MM string from profile
  workdayEndTime: string;   // HH:MM string from profile
  isDetailedView: boolean;
  T_current: Date; // Current time from SessionProvider
}

const MINUTE_HEIGHT = 2.5; // 1 minute = 2.5px height

const DailyScheduleColumn: React.FC<DailyScheduleColumnProps> = ({
  dayDate,
  tasks,
  workdayStartTime,
  workdayEndTime,
  isDetailedView,
  T_current,
}) => {
  const isCurrentDay = isToday(dayDate);

  const dayStart = setTimeOnDate(dayDate, workdayStartTime);
  let dayEnd = setTimeOnDate(dayDate, workdayEndTime);
  if (isBefore(dayEnd, dayStart)) {
    dayEnd = addDays(dayEnd, 1);
  }

  const totalDayMinutes = differenceInMinutes(dayEnd, dayStart);
  const timeSlots = Array.from({ length: totalDayMinutes / 60 }).map((_, i) => {
    const hour = addDays(setHours(setMinutes(dayStart, 0), dayStart.getHours() + i), 0);
    return format(hour, 'h a');
  });

  const getTaskPositionAndHeight = (task: DBScheduledTask) => {
    const taskStart = task.start_time ? parseISO(task.start_time) : dayStart;
    const taskEnd = task.end_time ? parseISO(task.end_time) : dayStart;

    // Adjust task times to be relative to the current dayDate's local time
    let localTaskStart = setTimeOnDate(dayDate, format(taskStart, 'HH:mm'));
    let localTaskEnd = setTimeOnDate(dayDate, format(taskEnd, 'HH:mm'));
    if (isBefore(localTaskEnd, localTaskStart)) {
      localTaskEnd = addDays(localTaskEnd, 1);
    }

    const offsetMinutes = differenceInMinutes(localTaskStart, dayStart);
    const durationMinutes = differenceInMinutes(localTaskEnd, localTaskStart);

    const top = offsetMinutes * MINUTE_HEIGHT;
    const height = durationMinutes * MINUTE_HEIGHT;

    return { top, height };
  };

  return (
    <div className="relative flex-shrink-0 w-full sm:w-[180px] border-r border-border/50 last:border-r-0">
      {/* Day Header */}
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-sm p-2 border-b border-border/50 text-center">
        <p className={cn(
          "text-[10px] font-black uppercase tracking-widest",
          isCurrentDay ? "text-primary" : "text-muted-foreground/60"
        )}>
          {format(dayDate, 'EEE')}
        </p>
        <p className={cn(
          "text-lg font-black tracking-tighter leading-none",
          isCurrentDay ? "text-foreground" : "text-muted-foreground/80"
        )}>
          {format(dayDate, 'd')}
        </p>
      </div>

      {/* Time Grid Lines (Optional, for visual alignment) */}
      <div className="absolute inset-0">
        {timeSlots.map((_, i) => (
          <div
            key={i}
            className="absolute left-0 right-0 border-t border-dashed border-border/20"
            style={{ top: `${(i * 60) * MINUTE_HEIGHT}px` }}
          />
        ))}
      </div>

      {/* Current Time Indicator (only for today) */}
      {isCurrentDay && (
        <div
          className="absolute left-0 right-0 h-0.5 bg-live-progress z-20 animate-pulse"
          style={{
            top: `${differenceInMinutes(T_current, dayStart) * MINUTE_HEIGHT}px`,
            display: isBefore(T_current, dayEnd) && isAfter(T_current, dayStart) ? 'block' : 'none'
          }}
        >
          <div className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full bg-live-progress shadow-[0_0_10px_hsl(var(--live-progress))]" />
        </div>
      )}

      {/* Tasks */}
      <div className="relative p-2" style={{ height: `${totalDayMinutes * MINUTE_HEIGHT}px` }}>
        {tasks.map((task) => {
          const { top, height } = getTaskPositionAndHeight(task);
          const isPastTask = isPast(parseISO(task.end_time!)) && !isCurrentDay; // Only mark as past if not today
          const isCurrentlyActive = isCurrentDay && T_current >= parseISO(task.start_time!) && T_current < parseISO(task.end_time!);

          return (
            <div
              key={task.id}
              className={cn(
                "absolute left-1 right-1 rounded-md p-1 transition-all duration-300",
                "bg-card/60 border border-white/5",
                isPastTask && "opacity-40 grayscale",
                isCurrentlyActive && "animate-active-task border-primary/50 bg-primary/10 shadow-lg"
              )}
              style={{ top: `${top}px`, height: `${height}px` }}
            >
              <SimplifiedScheduledTaskItem task={task} isDetailedView={isDetailedView} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DailyScheduleColumn;