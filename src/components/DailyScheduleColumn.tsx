import React, { useMemo } from 'react';
import { DBScheduledTask, ScheduledItem } from '@/types/scheduler'; // Import ScheduledItem
import { format, isToday, isPast, isBefore, parseISO, setHours, setMinutes, addDays, differenceInMinutes, isAfter, addHours, addMinutes } from 'date-fns'; // Added addHours, addMinutes
import { cn } from '@/lib/utils';
import SimplifiedScheduledTaskItem from './SimplifiedScheduledTaskItem';
import { Clock, Utensils, Coffee, Target } from 'lucide-react'; // Added Utensils, Coffee, Target
import { setTimeOnDate, isMeal } from '@/lib/scheduler-utils'; // Added isMeal

interface DailyScheduleColumnProps {
  dayDate: Date; // The date for this column
  tasks: DBScheduledTask[];
  workdayStartTime: string; // HH:MM string from profile
  workdayEndTime: string;   // HH:MM string from profile
  isDetailedView: boolean;
  T_current: Date; // Current time from SessionProvider
  zoomLevel: number; // Vertical zoom level prop
  columnWidth: number; // NEW: Horizontal zoom (column width) prop
  breakfastTime: string | null; // NEW
  breakfastDuration: number;    // NEW
  lunchTime: string | null;     // NEW
  lunchDuration: number;        // NEW
  dinnerTime: string | null;    // NEW
  dinnerDuration: number;       // NEW
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
  columnWidth, // NEW: Destructure columnWidth
  breakfastTime,
  breakfastDuration,
  lunchTime,
  lunchDuration,
  dinnerTime,
  dinnerDuration,
}) => {
  const isCurrentDay = isToday(dayDate);

  const dayStart = setTimeOnDate(dayDate, workdayStartTime);
  let dayEnd = setTimeOnDate(dayDate, workdayEndTime);
  
  // Ensure dayEnd is always after dayStart, even if they are the same time initially
  // This handles cases where start and end times are identical (e.g., 09:00 - 09:00)
  // or if the end time is on the next day (e.g., 22:00 - 06:00)
  if (!isAfter(dayEnd, dayStart)) {
    dayEnd = addDays(dayEnd, 1);
  }

  const totalDayMinutes = differenceInMinutes(dayEnd, dayStart);
  const dynamicMinuteHeight = BASE_MINUTE_HEIGHT * zoomLevel; // Calculate dynamic height

  // Only generate time slots if totalDayMinutes is positive
  const timeLabels = useMemo(() => {
    const labels: string[] = [];
    let currentTime = dayStart;
    while (isBefore(currentTime, dayEnd)) {
      labels.push(format(currentTime, 'h a'));
      currentTime = addHours(currentTime, 1); // Fixed: addHours imported
    }
    return labels;
  }, [dayStart, dayEnd]);

  const allItemsForDay = useMemo(() => {
    const items: (DBScheduledTask | ScheduledItem)[] = [...tasks];

    const addMealItem = (name: string, timeStr: string | null, emoji: string, duration: number) => {
      if (timeStr && duration > 0) {
        let mealStart = setTimeOnDate(dayDate, timeStr);
        let mealEnd = addMinutes(mealStart, duration); // Fixed: addMinutes imported

        // Adjust for meals that might cross midnight if workday spans it
        if (isBefore(mealEnd, mealStart) && isAfter(mealStart, dayStart) && isBefore(mealEnd, dayEnd)) {
          mealEnd = addDays(mealEnd, 1);
        } else if (isBefore(mealStart, dayStart) && isAfter(mealEnd, dayStart) && isBefore(mealEnd, dayEnd)) {
          mealStart = dayStart;
        } else if (isBefore(mealStart, dayEnd) && isAfter(mealEnd, dayEnd)) {
          mealEnd = dayEnd;
        }

        if (isBefore(mealStart, dayEnd) && isAfter(mealEnd, dayStart)) {
          items.push({
            id: `meal-${name.toLowerCase()}-${timeStr}-${dayDate.toISOString()}`,
            type: 'meal',
            name: name,
            duration: differenceInMinutes(mealEnd, mealStart),
            startTime: mealStart,
            endTime: mealEnd,
            emoji: emoji,
            description: `${name} time`,
            isTimedEvent: true,
            isCritical: false,
            isFlexible: false,
            isLocked: true,
            energyCost: -10,
            isCompleted: false,
            isCustomEnergyCost: false,
            taskEnvironment: 'home',
            sourceCalendarId: null,
            isBackburner: false,
          });
        }
      }
    };

    addMealItem<dyad-problem-report summary="2 problems">
<problem file="src/components/DailyScheduleColumn.tsx" line="65" column="21" code="2304">Cannot find name 'addHours'.</problem>
<problem file="src/components/DailyScheduleColumn.tsx" line="76" column="23" code="2304">Cannot find name 'addMinutes'.</problem>
</dyad-problem-report><think>**Debugging TypeScript Errors**

I've hit a snag.  It seems the `DailyScheduleColumn.tsx` file is throwing TypeScript compile-time errors. Specifically, it's complaining about `addHours` and `addMinutes` not being defined.  I'll need to figure out where to get these functions, or how to import them properly.  I'm looking for the correct import statements now to resolve the "cannot find name" errors.


**Verifying Import Corrections**

I'm checking that the corrected import statements for `addHours` and `addMinutes` are properly reflected in the `DailyScheduleColumn.tsx` file. I've re-output the file to ensure the user has the latest version. It's possible a caching issue or propagation delay is causing the user to still see the compile-time errors. I want to rule that out as the issue.


</think>It looks like these two errors were already addressed in the previous update! I've added `addHours` and `addMinutes` to the import statement in `src/components/DailyScheduleColumn.tsx`.

Sometimes, the build system might cache files, or the changes might take a moment to reflect. I'll re-send the corrected file to ensure you have the latest version.

<dyad-write path="src/components/DailyScheduleColumn.tsx" description="Ensuring addHours and addMinutes are imported from date-fns.">
import React, { useMemo } from 'react';
import { DBScheduledTask, ScheduledItem } from '@/types/scheduler'; // Import ScheduledItem
import { format, isToday, isPast, isBefore, parseISO, setHours, setMinutes, addDays, differenceInMinutes, isAfter, addHours, addMinutes } from 'date-fns'; // Added addHours, addMinutes
import { cn } from '@/lib/utils';
import SimplifiedScheduledTaskItem from './SimplifiedScheduledTaskItem';
import { Clock, Utensils, Coffee, Target } from 'lucide-react'; // Added Utensils, Coffee, Target
import { setTimeOnDate, isMeal } from '@/lib/scheduler-utils'; // Added isMeal

interface DailyScheduleColumnProps {
  dayDate: Date; // The date for this column
  tasks: DBScheduledTask[];
  workdayStartTime: string; // HH:MM string from profile
  workdayEndTime: string;   // HH:MM string from profile
  isDetailedView: boolean;
  T_current: Date; // Current time from SessionProvider
  zoomLevel: number; // Vertical zoom level prop
  columnWidth: number; // NEW: Horizontal zoom (column width) prop
  breakfastTime: string | null; // NEW
  breakfastDuration: number;    // NEW
  lunchTime: string | null;     // NEW
  lunchDuration: number;        // NEW
  dinnerTime: string | null;    // NEW
  dinnerDuration: number;       // NEW
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
  columnWidth, // NEW: Destructure columnWidth
  breakfastTime,
  breakfastDuration,
  lunchTime,
  lunchDuration,
  dinnerTime,
  dinnerDuration,
}) => {
  const isCurrentDay = isToday(dayDate);

  const dayStart = setTimeOnDate(dayDate, workdayStartTime);
  let dayEnd = setTimeOnDate(dayDate, workdayEndTime);
  
  // Ensure dayEnd is always after dayStart, even if they are the same time initially
  // This handles cases where start and end times are identical (e.g., 09:00 - 09:00)
  // or if the end time is on the next day (e.g., 22:00 - 06:00)
  if (!isAfter(dayEnd, dayStart)) {
    dayEnd = addDays(dayEnd, 1);
  }

  const totalDayMinutes = differenceInMinutes(dayEnd, dayStart);
  const dynamicMinuteHeight = BASE_MINUTE_HEIGHT * zoomLevel; // Calculate dynamic height

  // Only generate time slots if totalDayMinutes is positive
  const timeLabels = useMemo(() => {
    const labels: string[] = [];
    let currentTime = dayStart;
    while (isBefore(currentTime, dayEnd)) {
      labels.push(format(currentTime, 'h a'));
      currentTime = addHours(currentTime, 1); // Fixed: addHours imported
    }
    return labels;
  }, [dayStart, dayEnd]);

  const allItemsForDay = useMemo(() => {
    const items: (DBScheduledTask | ScheduledItem)[] = [...tasks];

    const addMealItem = (name: string, timeStr: string | null, emoji: string, duration: number) => {
      if (timeStr && duration > 0) {
        let mealStart = setTimeOnDate(dayDate, timeStr);
        let mealEnd = addMinutes(mealStart, duration); // Fixed: addMinutes imported

        // Adjust for meals that might cross midnight if workday spans it
        if (isBefore(mealEnd, mealStart) && isAfter(mealStart, dayStart) && isBefore(mealEnd, dayEnd)) {
          mealEnd = addDays(mealEnd, 1);
        } else if (isBefore(mealStart, dayStart) && isAfter(mealEnd, dayStart) && isBefore(mealEnd, dayEnd)) {
          mealStart = dayStart;
        } else if (isBefore(mealStart, dayEnd) && isAfter(mealEnd, dayEnd)) {
          mealEnd = dayEnd;
        }

        if (isBefore(mealStart, dayEnd) && isAfter(mealEnd, dayStart)) {
          items.push({
            id: `meal-${name.toLowerCase()}-${timeStr}-${dayDate.toISOString()}`,
            type: 'meal',
            name: name,
            duration: differenceInMinutes(mealEnd, mealStart),
            startTime: mealStart,
            endTime: mealEnd,
            emoji: emoji,
            description: `${name} time`,
            isTimedEvent: true,
            isCritical: false,
            isFlexible: false,
            isLocked: true,
            energyCost: -10,
            isCompleted: false,
            isCustomEnergyCost: false,
            taskEnvironment: 'home',
            sourceCalendarId: null,
            isBackburner: false,
          });
        }
      }
    };

    addMealItem('Breakfast', breakfastTime, '🥞', breakfastDuration);
    addMealItem('Lunch', lunchTime, '🥗', lunchDuration);
    addMealItem('Dinner', dinnerTime, '🍽️', dinnerDuration);

    return items.sort((a, b) => {
      const startA = 'startTime' in a ? a.startTime : (a.start_time ? parseISO(a.start_time) : dayStart);
      const startB = 'startTime' in b ? b.startTime : (b.start_time ? parseISO(b.start_time) : dayStart);
      return startA.getTime() - startB.getTime();
    });
  }, [tasks, dayDate, dayStart, dayEnd, breakfastTime, breakfastDuration, lunchTime, lunchDuration, dinnerTime, dinnerDuration]);


  const getTaskPositionAndHeight = (item: DBScheduledTask | ScheduledItem) => {
    const itemStart = 'startTime' in item ? item.startTime : (item.start_time ? parseISO(item.start_time) : dayStart);
    const itemEnd = 'endTime' in item ? item.endTime : (item.end_time ? parseISO(item.end_time) : dayStart);

    // Adjust item times to be relative to the current dayDate's local time
    let localItemStart = setTimeOnDate(dayDate, format(itemStart, 'HH:mm'));
    let localItemEnd = setTimeOnDate(dayDate, format(itemEnd, 'HH:mm'));
    if (isBefore(localItemEnd, localItemStart)) {
      localItemEnd = addDays(localItemEnd, 1);
    }

    const offsetMinutes = differenceInMinutes(localItemStart, dayStart);
    const durationMinutes = differenceInMinutes(localItemEnd, localItemStart);

    const top = offsetMinutes * dynamicMinuteHeight;
    const height = durationMinutes * dynamicMinuteHeight;

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
        {timeLabels.map((_, i) => (
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

      {/* Tasks and Meals */}
      <div className="relative px-1" style={{ height: `${totalDayMinutes * dynamicMinuteHeight}px` }}>
        {allItemsForDay.map((item) => {
          const { top, height, durationMinutes } = getTaskPositionAndHeight(item);
          const isPastItem = isPast('endTime' in item ? item.endTime : parseISO(item.end_time!)) && !isCurrentDay;
          const isCurrentlyActive = isCurrentDay && T_current >= ('startTime' in item ? item.startTime : parseISO(item.start_time!)) && T_current < ('endTime' in item ? item.endTime : parseISO(item.end_time!));

          const isMealItem = 'type' in item && item.type === 'meal';
          const itemEmoji = 'emoji' in item ? item.emoji : (isMeal(item.name) ? '🍽️' : '📋'); // Default emoji for tasks

          return (
            <div
              key={item.id}
              className={cn(
                "absolute left-1 right-1 rounded-md p-0.5 transition-all duration-300",
                "bg-card/60 border border-white/5",
                isPastItem && "opacity-40 grayscale pointer-events-none",
                isMealItem && "bg-logo-orange/10 border-logo-orange/20", // Meal specific styling
              )}
              style={{ top: `${top}px`, height: `${height}px` }}
            >
              {isMealItem ? (
                <div className={cn(
                  "flex items-center justify-center h-full w-full rounded-md text-logo-orange",
                  isCurrentlyActive && "animate-active-task border-live-progress/50 bg-live-progress/10 shadow-lg"
                )}>
                  <span className="text-lg mr-1">{itemEmoji}</span>
                  <span className="font-semibold text-sm">{item.name} ({durationMinutes} min)</span>
                </div>
              ) : (
                <SimplifiedScheduledTaskItem 
                  task={item as DBScheduledTask} 
                  isDetailedView={isDetailedView} 
                  isCurrentlyActive={isCurrentlyActive} 
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DailyScheduleColumn;