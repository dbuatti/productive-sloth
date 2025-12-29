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
  zoomLevel: number; // Vertical zoom level prop
  columnWidth: number; // NEW: Horizontal zoom (column width) prop
}

const BASE_MINUTE_HEIGHT = 2.5; // Base height for 1 minute at 100% zoom
const MAX_TASK_HEIGHT_MINUTES = 120; // Max visual height for a task in minutes (2 hours)

const DailyScheduleColumn: React.FC<DailyScheduleColumnProps> = ({
  dayDate,
  tasks,
  workdayStartTime,
  workdayEndTime,
  isDetailedView,
  T_current,
  zoomLevel, // Vertical zoom level
  columnWidth, // NEW: Destructure columnWidth
}) => {
  const isCurrentDay = isToday(dayDate);

  const dayStart = setTimeOnDate(dayDate, workdayStartTime);
  let dayEnd = setTimeOnDate(dayDate, workdayEndTime);
  if (isBefore(dayEnd, dayStart)) {
    dayEnd = addDays(dayEnd, 1);
  }

  const totalDayMinutes = differenceInMinutes(dayEnd, dayStart);
  const dynamicMinuteHeight = BASE_MINUTE_HEIGHT * zoomLevel; // Calculate dynamic height

  const timeSlots = Array.from({ length: totalDayMinutes / 60 }).map((_, i) => {
    const hour = addDays(setHours(setMinutes(dayStart, 0), dayStart.getHours() + i), 0);
    return format(hour, 'h a');
  });

  console.log(`[DailyScheduleColumn - ${format(dayDate, 'yyyy-MM-dd')}] ---`);
  console.log(`[DailyScheduleColumn - ${format(dayDate, 'yyyy-MM-dd')}] workdayStartTime: ${workdayStartTime}, workdayEndTime: ${workdayEndTime}`);
  console.log(`[DailyScheduleColumn - ${format(dayDate, 'yyyy-MM-dd')}] dayStart: ${dayStart.toISOString()}, dayEnd: ${dayEnd.toISOString()}`);
  console.log(`[DailyScheduleColumn - ${format(dayDate, 'yyyy-MM-dd')}] totalDayMinutes: ${totalDayMinutes}`);
  console.log(`[DailyScheduleColumn - ${format(dayDate, 'yyyy-MM-dd')}] zoomLevel: ${zoomLevel}, dynamicMinuteHeight: ${dynamicMinuteHeight}`);
  console.log(`[DailyScheduleColumn - ${format(dayDate, 'yyyy-MM-dd')}] columnWidth: ${columnWidth}`);
  console.log(`[DailyScheduleColumn - ${format(dayDate, 'yyyy-MM-dd')}] Tasks for day (${tasks.length}):`, tasks.map(t => t.name));


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

    const top = offsetMinutes * dynamicMinuteHeight;
    const visualDurationMinutes = Math.min(durationMinutes, MAX_TASK_HEIGHT_MINUTES);
    const height = visualDurationMinutes * dynamicMinuteHeight;

    console.log(`[DailyScheduleColumn - ${format(dayDate, 'yyyy-MM-dd')}] Task "${task.name}" - start_time: ${task.start_time}, end_time: ${task.end_time}`);
    console.log(`[DailyScheduleColumn - ${format(dayDate, 'yyyy-MM-dd')}]   localTaskStart: ${localTaskStart.toISOString()}, localTaskEnd: ${localTaskEnd.toISOString()}`);
    console.log(`[DailyScheduleColumn - ${format(dayDate, 'yyyy-MM-dd')}]   offsetMinutes: ${offsetMinutes}, durationMinutes: ${durationMinutes}`);
    console.log(`[DailyScheduleColumn - ${format(dayDate, 'yyyy-MM-dd')}]   Calculated: top=${top}, height=${height}`);

    return { top, height, durationMinutes };
  };

  return (
    <div 
      className="relative flex-shrink-0 border-r border-border/50 last:border-r-0"
      style={{ width: `${columnWidth}px` }} // NEW: Apply dynamic width
    >
      {/* Day Header */}
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-sm p-2 border-b border-border/50 text-center">
        <p className={cn(
          "text-[9px] sm:text-[10px] font-black uppercase tracking-widest", // Adjusted text size for mobile
          isCurrentDay ? "text-primary" : "text-muted-foreground/60"
        )}>
          {format(dayDate, 'EEE')}
        </p>
        <p className={cn(
          "text-base sm:text-lg font-black tracking-tighter leading-none", // Adjusted text size for mobile
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
            style={{ top: `${(i * 60) * dynamicMinuteHeight}px` }} // Use dynamic height
          />
        ))}
      </div>

      {/* Current Time Indicator (only for today) */}
      {isCurrentDay && (
        <div
          className="absolute left-0 right-0 h-0.5 bg-live-progress z-20 animate-pulse"
          style={{
            top: `${differenceInMinutes(T_current, dayStart) * dynamicMinuteHeight}px`, // Use dynamic height
            display: isBefore(T_current, dayEnd) && isAfter(T_current, dayStart) ? 'block' : 'none'
          }}
        >
          <div className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full bg-live-progress shadow-[0_0_10px_hsl(var(--live-progress))]" />
        </div>
      )}

      {/* Tasks */}
      <div className="relative px-1" style={{ height: `${totalDayMinutes * dynamicMinuteHeight}px` }}> {/* Adjusted horizontal padding */}
        {tasks.map((task) => {
          const { top, height, durationMinutes } = getTaskPositionAndHeight(task);
          const isPastTask = isPast(parseISO(task.end_time!)) && !isCurrentDay; // Only mark as past if not today
          const isCurrentlyActive = isCurrentDay && T_current >= parseISO(task.start_time!) && T_current < parseISO(task.end_time!);

          return (
            <div
              key={task.id}
              className={cn(
                "absolute left-1 right-1 rounded-md p-0.5 transition-all duration-300", // Adjusted padding
                "bg-card/60 border border-white/5",
                isPastTask && "opacity-40 grayscale pointer-events-none" // Apply pointer-events-none for past tasks
              )}
              style={{ top: `${top}px`, height: `${height}px` }}
            >
              <SimplifiedScheduledTaskItem task={task} isDetailedView={isDetailedView} isCurrentlyActive={isCurrentlyActive} />
              {durationMinutes > MAX_TASK_HEIGHT_MINUTES && (
                <div className="absolute bottom-0 left-0 right-0 text-center text-[8px] text-muted-foreground/50 bg-background/50 rounded-b-md py-0.5">
                  ({durationMinutes - MAX_TASK_HEIGHT_MINUTES}m hidden)
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DailyScheduleColumn;