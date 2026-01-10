import React, { useMemo, useCallback, useEffect } from 'react';
import { DBScheduledTask } from '@/types/scheduler';
import { format, isToday, isPast, isBefore, parseISO, setHours, setMinutes, addDays, differenceInMinutes, isAfter, addHours } from 'date-fns';
import { cn } from '@/lib/utils';
import SimplifiedScheduledTaskItem from './SimplifiedScheduledTaskItem';
import { Clock } from 'lucide-react';
import { setTimeOnDate } from '@/lib/scheduler-utils';

interface DailyScheduleColumnProps {
  dateString: string; // Changed from dayDate: Date to dateString: string
  tasks: DBScheduledTask[];
  workdayStartTime: string; // HH:MM string from profile
  workdayEndTime: string;   // HH:MM string from profile
  isDetailedView: boolean;
  T_current: Date; // Current time from SessionProvider
  zoomLevel: number; // Vertical zoom level prop
  columnWidth: number; // Horizontal zoom (column width) prop
  onCompleteTask: (task: DBScheduledTask) => Promise<void>;
  isDayBlocked: boolean;
}

const BASE_MINUTE_HEIGHT = 1.5; // Adjusted base height for 1 minute (more compact)
const MIN_TASK_HEIGHT_MINUTES = 10; // Minimum duration for a task to be rendered
const MIN_TASK_HEIGHT_PX = MIN_TASK_HEIGHT_MINUTES * BASE_MINUTE_HEIGHT; // Minimum height in pixels

const DailyScheduleColumn: React.FC<DailyScheduleColumnProps> = React.memo(({
  dateString, // Destructure dateString
  tasks,
  workdayStartTime,
  workdayEndTime,
  isDetailedView,
  T_current,
  zoomLevel, // Vertical zoom level
  columnWidth,
  onCompleteTask,
  isDayBlocked,
}) => {
  // Parse dateString to a Date object for internal calculations
  const dayDate = useMemo(() => parseISO(dateString), [dateString]);
  const isCurrentDay = isToday(dayDate);

  useEffect(() => {
    console.log(`[DailyScheduleColumn] Rendered for day: ${dateString}. Tasks: ${tasks.length}, Blocked: ${isDayBlocked}`);
  });

  // Calculate workday start and end as local Date objects for the current dayDate
  const localWorkdayStart = useMemo(() => setTimeOnDate(dayDate, workdayStartTime), [dayDate, workdayStartTime]);
  let localWorkdayEnd = useMemo(() => setTimeOnDate(dayDate, workdayEndTime), [dayDate, workdayEndTime]);
  if (isBefore(localWorkdayEnd, localWorkdayStart)) {
    localWorkdayEnd = addDays(localWorkdayEnd, 1);
  }

  // Calculate total minutes for the *display window*, which is now the workday window
  const totalDisplayMinutes = useMemo(() => differenceInMinutes(localWorkdayEnd, localWorkdayStart), [localWorkdayEnd, localWorkdayStart]);
  const dynamicMinuteHeight = BASE_MINUTE_HEIGHT * zoomLevel;

  // Generate time labels only for the workday window, every hour
  const timeLabels = useMemo(() => {
    const labels: { time: string; top: number }[] = [];
    let currentTime = localWorkdayStart;
    while (isBefore(currentTime, localWorkdayEnd)) {
      const offsetMinutes = differenceInMinutes(currentTime, localWorkdayStart);
      const top = offsetMinutes * dynamicMinuteHeight;
      labels.push({ time: format(currentTime, 'h a'), top });
      currentTime = addHours(currentTime, 1);
    }
    return labels;
  }, [localWorkdayStart, localWorkdayEnd, dynamicMinuteHeight]);

  const getTaskPositionAndHeight = useCallback((task: DBScheduledTask) => {
    if (!task.start_time || !task.end_time) {
      // This task is invalid for the grid, return zero dimensions
      console.warn(`[DailyScheduleColumn] Task ${task.name} has invalid start/end times.`);
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
  }, [dayDate, localWorkdayStart, dynamicMinuteHeight, zoomLevel]);

  return (
    <div 
      className={cn(
        "relative flex-shrink-0 border-r border-border/50 last:border-r-0 daily-schedule-column",
        isDayBlocked && "bg-destructive/5 opacity-70 pointer-events-none"
      )}
      style={{ width: `${columnWidth}px`, minWidth: `${columnWidth}px` }}
      data-date={format(dayDate, 'yyyy-MM-dd')}
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
      <div className="absolute inset-0 pointer-events-none">
        {timeLabels.map((label, i) => (
          <div
            key={`grid-line-${label.time}-${i}`}
            className="absolute left-0 right-0 h-px bg-border/50"
            style={{ top: `${label.top + 30}px` }} // Adjust for header height
          />
        ))}
      </div>

      {/* Tasks */}
      <div 
        className="relative pt-[30px]" // Padding top to account for header
        style={{ height: `${totalDisplayMinutes * dynamicMinuteHeight}px` }}
      >
        {tasks.map(task => {
          const { top, height, durationMinutes } = getTaskPositionAndHeight(task);
          
          // Only render if task has valid position and height
          if (height <= 0 || top < 0 || top > totalDisplayMinutes * dynamicMinuteHeight) {
            console.warn(`[DailyScheduleColumn] Skipping render for task "${task.name}" due to invalid position/height. Top: ${top}, Height: ${height}`);
            return null;
          }

          const isPastTask = isPast(task.end_time ? parseISO(task.end_time) : new Date());
          const isCurrentlyActive = isCurrentDay && T_current >= (task.start_time ? parseISO(task.start_time) : new Date()) && T_current < (task.end_time ? parseISO(task.end_time) : new Date());

          return (
            <div
              key={task.id}
              className={cn(
                "absolute left-1 right-1", // Adjusted left/right for padding
                "transition-all duration-300 ease-in-out",
                isPastTask && "opacity-50",
                isCurrentlyActive && "z-10"
              )}
              style={{ top: `${top}px`, height: `${height}px` }}
            >
              <SimplifiedScheduledTaskItem 
                task={task} 
                isDetailedView={isDetailedView} 
                isCurrentlyActive={isCurrentlyActive}
                onCompleteTask={onCompleteTask}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default DailyScheduleColumn;