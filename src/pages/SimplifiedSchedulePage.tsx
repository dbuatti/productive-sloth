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

  const [currentPeriodStartString, setCurrentPeriodStartString] = useState<string>(() =>
    format(startOfDay(new Date()), 'yyyy-MM-dd')
  );
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
    return days;
  }, [fetchWindowStart, fetchWindowEnd]);

  // NEW: This is the "Lens" logic to get exactly the days to render
  const daysToRender = useMemo(() => {
    if (!fullFetchWindowDays || fullFetchWindowDays.length === 0) return [];

    // 1. Find the index of the date we want to start viewing from
    const startIndex = fullFetchWindowDays.indexOf(currentPeriodStartString);
    
    // 2. Fallback: If for some reason today isn't in the window, start at the beginning
    const safeStart = startIndex === -1 ? 0 : startIndex;

    // 3. Slice the array to exactly the number of days the user wants to see
    return fullFetchWindowDays.slice(safeStart, safeStart + numDaysVisible);
  }, [fullFetchWindowDays, currentPeriodStartString, numDaysVisible]);


  const { weeklyTasks, isLoading: isWeeklyTasksLoading, profileSettings } =
    useWeeklySchedulerTasks(currentPeriodStartString); // Pass centerDateString

  const isLoading = isSessionLoading || isWeeklyTasksLoading;

  // Calculate column width based on container size and number of visible days
  const columnWidth = useMemo(() => {
    const timeAxisWidth = window.innerWidth < 640 ? 40 : 56; // Time axis width
    const availableWidth = gridContainerWidth - timeAxisWidth;
    const calculatedWidth = Math.max(100, availableWidth / numDaysVisible); // Minimum column width 100px
    return calculatedWidth;
  }, [gridContainerWidth, numDaysVisible]);

  // Observe container width for responsive column sizing
  useEffect(() => {
    const resizeObserver = new ResizeObserver(entries => {
      if (entries[0]) {
        setGridContainerWidth(entries[0].contentRect.width);
      }
    });

    if (gridRef.current) {
      resizeObserver.observe(gridRef.current);
    }

    return () => {
      if (gridRef.current) {
        resizeObserver.unobserve(gridRef.current);
      }
    };
  }, []);

  const handlePeriodShift = useCallback((shiftDays: number) => {
    setCurrentPeriodStartString((prev) => {
      const prevDate = parseISO(prev);
      if (shiftDays === 0) {
        // If shifting to today, also increment scrollVersion to force refocus
        setScrollVersion(prevVersion => prevVersion + 1);
        return format(startOfDay(new Date()), 'yyyy-MM-dd');
      }
      return format(addDays(prevDate, shiftDays), 'yyyy-MM-dd');
    });
  }, []);

  // Callbacks to update profile settings
  const handleSetNumDaysVisible = useCallback(async (days: number) => {
    if (profile && days !== profile.num_days_visible) {
      await updateProfile({ num_days_visible: days });
    }
  }, [profile, updateProfile]);

  const handleSetCurrentVerticalZoomIndex = useCallback(async (index: number) => {
    if (profile && index !== profile.vertical_zoom_index) {
      await updateProfile({ vertical_zoom_index: index });
    }
  }, [profile, updateProfile]);

  // Callback for DailyScheduleColumn to complete tasks
  const handleCompleteTask = useCallback(async (task: DBScheduledTask) => {
    // This function will be passed down to DailyScheduleColumn
    // and needs to be implemented here or in a shared hook if it modifies global state.
    // For now, it's a placeholder.
    console.log("Complete task from SimplifiedSchedulePage:", task.name);
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
          allDaysInFetchWindow={daysToRender} // NEW: Pass only the visible subset
          columnWidth={columnWidth} // New prop
          onCompleteTask={handleCompleteTask} // New prop
          T_current={T_current} // New prop
        />
      </div>
    </div>
  );
};

export default SimplifiedSchedulePage;