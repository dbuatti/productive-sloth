import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, CalendarDays } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/hooks/use-session';
import { useWeeklySchedulerTasks } from '@/hooks/use-weekly-scheduler-tasks';
import WeeklyScheduleGrid from '@/components/WeeklyScheduleGrid';
import { format, startOfDay, parseISO, addDays, subDays, differenceInMinutes, isBefore } from 'date-fns';
import { DBScheduledTask } from '@/types/scheduler';

const FETCH_WINDOW_DAYS = 42; // Needs to be consistent with useWeeklySchedulerTasks

const SimplifiedSchedulePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, isLoading: isSessionLoading, T_current, updateProfile } = useSession();

  // Derive numDaysVisible and currentVerticalZoomIndex directly from profile
  const numDaysVisible = profile?.num_days_visible ?? 7;
  const currentVerticalZoomIndex = profile?.vertical_zoom_index ?? 3;

  const [currentPeriodStartString, setCurrentPeriodStartString] = useState<string>(() => {
    const initialDate = format(startOfDay(new Date()), 'yyyy-MM-dd');
    console.log(`[SimplifiedSchedulePage] Initial currentPeriodStartString: ${initialDate}`);
    return initialDate;
  });
  const [scrollVersion, setScrollVersion] = useState(0); // NEW: State for scroll version
  const [gridContainerWidth, setGridContainerWidth] = useState(0); // State for grid container width
  const gridRef = React.useRef<HTMLDivElement>(null);

  // Calculate fetch window based on currentPeriodStartString
  const centerDate = useMemo(() => parseISO(currentPeriodStartString), [currentPeriodStartString]);
  const fetchWindowStart = useMemo(() => subDays(centerDate, Math.floor(FETCH_WINDOW_DAYS / 2)), [centerDate]);
  const fetchWindowEnd = useMemo(() => addDays(fetchWindowStart, FETCH_WINDOW_DAYS - 1), [fetchWindowStart]);

  // Renamed from allDaysInFetchWindow to fullFetchWindowDays to avoid confusion with the sliced array
  const fullFetchWindowDays = useMemo(() => {
    const days: string[] = [];
    let current = fetchWindowStart;
    while (isBefore(current, addDays(fetchWindowEnd, 1))) {
      days.push(format(current, 'yyyy-MM-dd'));
      current = addDays(current, 1);
    }
    console.log(`[SimplifiedSchedulePage] fullFetchWindowDays calculated. Length: ${days.length}, First: ${days[0]}, Last: ${days[days.length - 1]}`);
    return days;
  }, [fetchWindowStart, fetchWindowEnd]);

  // NEW: This is the "Lens" logic to get exactly the days to render
  // We now pass the full window to the grid, and let the grid handle scrolling to the correct position.
  const daysToRender = useMemo(() => {
    return fullFetchWindowDays; // Pass the full 42 days
  }, [fullFetchWindowDays]);


  const { weeklyTasks, isLoading: isWeeklyTasksLoading, profileSettings } =
    useWeeklySchedulerTasks(currentPeriodStartString); // Pass centerDateString

  const isLoading = isSessionLoading || isWeeklyTasksLoading;
  console.log(`[SimplifiedSchedulePage] Overall isLoading: ${isLoading} (Session: ${isSessionLoading}, WeeklyTasks: ${isWeeklyTasksLoading})`);

  // Calculate column width based on container size and number of visible days
  const columnWidth = useMemo(() => {
    const timeAxisWidth = window.innerWidth < 640 ? 40 : 56; // Time axis width
    const availableWidth = gridContainerWidth - timeAxisWidth;
    const calculatedWidth = Math.max(100, availableWidth / numDaysVisible); // Minimum column width 100px
    console.log(`[SimplifiedSchedulePage] Column Width calculated: ${calculatedWidth}px (Container: ${gridContainerWidth}, Visible: ${numDaysVisible})`);
    return calculatedWidth;
  }, [gridContainerWidth, numDaysVisible]);

  // Observe container width for responsive column sizing
  useEffect(() => {
    console.log("[SimplifiedSchedulePage] useEffect: Setting up ResizeObserver for gridRef.");
    const resizeObserver = new ResizeObserver(entries => {
      if (entries[0]) {
        const newWidth = entries[0].contentRect.width;
        console.log(`[SimplifiedSchedulePage] ResizeObserver: Grid container width changed to ${newWidth}px.`);
        setGridContainerWidth(newWidth);
      }
    });

    if (gridRef.current) {
      resizeObserver.observe(gridRef.current);
    }

    return () => {
      console.log("[SimplifiedSchedulePage] useEffect Cleanup: Disconnecting ResizeObserver.");
      if (gridRef.current) {
        resizeObserver.unobserve(gridRef.current);
      }
    };
  }, []);

  const handlePeriodShift = useCallback((shiftDays: number) => {
    setCurrentPeriodStartString((prev) => {
      const prevDate = parseISO(prev);
      let newDateString;
      if (shiftDays === 0) {
        // If shifting to today, also increment scrollVersion to force refocus
        setScrollVersion(prevVersion => {
          console.log(`[SimplifiedSchedulePage] handlePeriodShift: Setting scrollVersion to ${prevVersion + 1} for 'Today' jump.`);
          return prevVersion + 1;
        });
        newDateString = format(startOfDay(new Date()), 'yyyy-MM-dd');
      } else {
        newDateString = format(addDays(prevDate, shiftDays), 'yyyy-MM-dd');
      }
      console.log(`[SimplifiedSchedulePage] handlePeriodShift: Shifting by ${shiftDays} days. New currentPeriodStartString: ${newDateString}`);
      return newDateString;
    });
  }, []);

  // Callbacks to update profile settings
  const handleSetNumDaysVisible = useCallback(async (days: number) => {
    console.log(`[SimplifiedSchedulePage] handleSetNumDaysVisible: Attempting to set num_days_visible to ${days}.`);
    if (profile && days !== profile.num_days_visible) {
      await updateProfile({ num_days_visible: days });
      console.log(`[SimplifiedSchedulePage] handleSetNumDaysVisible: Profile updated for num_days_visible: ${days}.`);
    }
  }, [profile, updateProfile]);

  const handleSetCurrentVerticalZoomIndex = useCallback(async (index: number) => {
    console.log(`[SimplifiedSchedulePage] handleSetCurrentVerticalZoomIndex: Attempting to set vertical_zoom_index to ${index}.`);
    if (profile && index !== profile.vertical_zoom_index) {
      await updateProfile({ vertical_zoom_index: index });
      console.log(`[SimplifiedSchedulePage] handleSetCurrentVerticalZoomIndex: Profile updated for vertical_zoom_index: ${index}.`);
    }
  }, [profile, updateProfile]);

  // Callback for DailyScheduleColumn to complete tasks
  const handleCompleteTask = useCallback(async (task: DBScheduledTask) => {
    // This function will be passed down to DailyScheduleColumn
    // and needs to be implemented here or in a shared hook if it modifies global state.
    // For now, it's a placeholder.
    console.log("[SimplifiedSchedulePage] Complete task from SimplifiedSchedulePage:", task.name);
    // Example: Trigger a mutation to mark task as complete
    // await completeScheduledTaskMutation(task);
  }, []);

  // Derive workday start and end times from profile
  const workdayStartTime = profile?.default_auto_schedule_start_time || '09:00';
  const workdayEndTime = profile?.default_auto_schedule_end_time || '17:00';

  return (
    <div ref={gridRef} className="flex flex-col h-full w-full">
      <div className="flex-1 overflow-hidden">
        <WeeklyScheduleGrid
          weeklyTasks={weeklyTasks}
          currentPeriodStartString={currentPeriodStartString}
          numDaysVisible={numDaysVisible}
          onSetNumDaysVisible={handleSetNumDaysVisible}
          workdayStartTime={workdayStartTime}
          workdayEndTime={workdayEndTime}
          isLoading={isLoading} // Pass the combined isLoading
          weekStartsOn={profile?.week_starts_on ?? 0} // Use profile directly for weekStartsOn
          onPeriodShift={handlePeriodShift}
          fetchWindowStart={fetchWindowStart}
          fetchWindowEnd={fetchWindowEnd}
          currentVerticalZoomIndex={currentVerticalZoomIndex}
          onSetCurrentVerticalZoomIndex={handleSetCurrentVerticalZoomIndex}
          profileSettings={profileSettings}
          scrollVersion={scrollVersion}
          allDaysInFetchWindow={daysToRender} // NEW: Pass the full window
          columnWidth={columnWidth} // New prop
          onCompleteTask={handleCompleteTask} // New prop
          T_current={T_current} // New prop
        />
      </div>
    </div>
  );
};

export default SimplifiedSchedulePage;