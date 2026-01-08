import React, { useMemo } from 'react';
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
  onCompleteTask: (task: DBScheduledTask) => Promise<void>; // NEW: onCompleteTask prop
}

const BASE_MINUTE_HEIGHT = 1.5; // Adjusted base height for 1 minute (more compact)
const MIN_TASK_HEIGHT_MINUTES = 10; // Minimum duration for a task to be rendered
const MIN_TASK_HEIGHT_PX = MIN_TASK_HEIGHT_MINUTES * BASE_MINUTE_HEIGHT; // Minimum height in pixels

const DailyScheduleColumn: React.FC<DailyScheduleColumnProps> = ({
  dayDate,
  tasks,
  workdayStartTime,
  workdayEndTime,
  isDetailedView,
  T_current,
  zoomLevel, // Vertical zoom level
  columnWidth,
  onCompleteTask, // Destructure new prop
}) => {
  const isCurrentDay = isToday(dayDate);

  // Calculate workday start and end as local Date objects for the current dayDate
  const localWorkdayStart = setTimeOnDate(dayDate, workdayStartTime);
  let localWorkdayEnd = setTimeOnDate(dayDate, workdayEndTime);
  if (isBefore(localWorkdayEnd, localWorkdayStart)) {
    localWorkdayEnd = addDays(localWorkdayEnd, 1);
  }

  // Calculate total minutes for the *display window*, which is now the workday window
  const totalDisplayMinutes = differenceInMinutes(localWorkdayEnd, localWorkdayStart);
  const dynamicMinuteHeight = BASE_MINUTE_HEIGHT * zoomLevel;

  // Generate time labels only for the workday window, every hour
  const timeLabels = useMemo(() => {
    const labels: string[] = [];
    let currentTime = localWorkdayStart;
    while (isBefore(currentTime, localWorkdayEnd)) {
      labels.push(format(currentTime, 'h a'));
      currentTime = addHours(currentTime, 1);
    }
    return labels;
  }, [localWorkdayStart, localWorkdayEnd]);

  const getTaskPositionAndHeight = (task: DBScheduledTask) => {
    if (!task.start_time || !task.end_time) {
      // This task is invalid for the grid, return zero dimensions
      return { top: 0, height: 0, durationMinutes: 0 };
    }
    
    const taskStartUTC = parseISO(task.start_time);
    const taskEndUTC = parseISO(task.end_time);

    // Convert UTC task times to local times relative to the current dayDate
    let localTaskStart = setTimeOnDate(dayDate, format(taskStartUTC, 'HH:mm'));
    let localTaskEnd = setTimeOnDate(dayDate, format(taskEndUTC, 'HH:mm'));
    
    // Handle tasks that span across midnight
    if (isBefore(localTaskEnd, localTaskStart)) {
      localTaskEnd = addDays(localTaskEnd, 1);
    }

    // Calculate offset and duration relative to the *localWorkdayStart*
    const offsetMinutes = differenceInMinutes(localTaskStart, localWorkdayStart);
    const durationMinutes = differenceInMinutes(localTaskEnd, localTaskStart);

    const top = offsetMinutes * dynamicMinuteHeight;
    const height = Math.max(durationMinutes * dynamicMinuteHeight, MIN_TASK_HEIGHT_PX * zoomLevel); // Ensure minimum height

    return { top, height, durationMinutes };
  };

  return (
    <div 
      className="relative flex-shrink-0 border-r border-border/50 last:border-r-0 daily-schedule-column scroll-snap-align-start" // Added scroll-snap-align-start
      style={{ width: `${columnWidth}px`, minWidth: `${columnWidth}px` }} // Explicit width and minWidth
      data-date={format(dayDate, 'yyyy-MM-dd')} // Added data-date for scrolling
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

      {/* Time Grid Lines and Tasks within Workday Window */}
      <div className="relative px-1" style={{ height: `${totalDisplayMinutes * dynamicMinuteHeight}px` }}>
        {/* Time Grid Lines */}
        <div className="absolute inset-0">
          {timeLabels.map((_, i) => (
            <div
              key={i}
              className="absolute left-0 right-0 border-t border-dashed border-border/20"
              style={{ top: `${(i * 60) * dynamicMinuteHeight}px` }}
            />
          ))}
        </div>

        {/* Current Time Indicator (only for today, within workday) */}
        {isCurrentDay && isAfter(T_current, localWorkdayStart) && isBefore(T_current, localWorkdayEnd) && (
          <div
            className="absolute left-0 right-0 h-0.5 bg-live-progress z-20 animate-pulse"
            style={{
              top: `${differenceInMinutes(T_current, localWorkdayStart) * dynamicMinuteHeight}px`,
            }}
          >
            <div className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full bg-live-progress shadow-[0_0_10px_hsl(var(--live-progress))]" />
          </div>
        )}

        {/* Tasks */}
        {tasks.map((task) => {
          const { top, height, durationMinutes } = getTaskPositionAndHeight(task);
          
          // Skip rendering if task is invalid or has zero duration/height
          if (!task.start_time || !task.end_time || durationMinutes <= 0) {
            console.warn(`[DailyScheduleColumn] Skipping invalid task: ${task.name} (ID: ${task.id}) due to missing times or zero duration.`);
            return null;
          }
          
          const isPastTask = isPast(parseISO(task.end_time!)) && !isCurrentDay;
          const isCurrentlyActive = isCurrentDay && T_current >= parseISO(task.start_time!) && T_current < parseISO(task.end_time!);

          // Only render tasks that fall within the workday window
          const taskStartLocal = setTimeOnDate(dayDate, format(parseISO(task.start_time!), 'HH:mm'));
          let taskEndLocal = setTimeOnDate(dayDate, format(parseISO(task.end_time!), 'HH:mm'));
          if (isBefore(taskEndLocal, taskStartLocal)) taskEndLocal = addDays(taskEndLocal, 1);

          // Check if the task actually overlaps with the defined workday window
          const overlapsWorkday = isBefore(taskStartLocal, localWorkdayEnd) && isAfter(taskEndLocal, localWorkdayStart);

          if (!overlapsWorkday) return null;

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
              <SimplifiedScheduledTaskItem 
                task={task} 
                isDetailedView={isDetailedView} 
                isCurrentlyActive={isCurrentlyActive} 
                onCompleteTask={onCompleteTask} // NEW: Pass the handler
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DailyScheduleColumn;