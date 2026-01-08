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

  const allDaysInFetchWindow = useMemo(() => {
    const days: string[] = [];
    let current = fetchWindowStart;
    while (isBefore(current, addDays(fetchWindowEnd, 1))) {
      days.push(format(current, 'yyyy-MM-dd'));
      current = addDays(current, 1);
    }
    return days;
  }, [fetchWindowStart, fetchWindowEnd]);

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

  // NEW: Filter the days to render based on currentPeriodStartString and numDaysVisible
  const visibleDaysToRender = useMemo(() => {
    const startIndex = allDaysInFetchWindow.indexOf(currentPeriodStartString);
    if (startIndex === -1) {
      // Fallback if currentPeriodStartString is not found (shouldn't happen with correct logic)
      return allDaysInFetchWindow.slice(0, numDaysVisible);
    }
    return allDaysInFetchWindow.slice(startIndex, startIndex + numDaysVisible);
  }, [allDaysInFetchWindow, currentPeriodStartString, numDaysVisible]);


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading schedule...</span>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <CalendarDays className="h-12 w-12 mb-4 opacity-40" />
        <p className="text-lg font-semibold">Please log in to view your schedule.</p>
        <Button onClick={() => navigate('/login')} className="mt-4">
          Go to Login
        </Button>
      </div>
    );
  }

  const workdayStartTime = profile.default_auto_schedule_start_time || '09:00';
  const workdayEndTime = profile.default_auto_schedule_end_time || '17:00';
  const weekStartsOn = (profile.week_starts_on ?? 0) as number;

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
          weekStartsOn={weekStartsOn}
          onPeriodShift={handlePeriodShift}
          fetchWindowStart={fetchWindowStart}
          fetchWindowEnd={fetchWindowEnd}
          currentVerticalZoomIndex={currentVerticalZoomIndex}
          onSetCurrentVerticalZoomIndex={handleSetCurrentVerticalZoomIndex}
          profileSettings={profileSettings}
          scrollVersion={scrollVersion}
          allDaysInFetchWindow={visibleDaysToRender} // NEW: Pass only the visible subset
          columnWidth={columnWidth} // New prop
          onCompleteTask={handleCompleteTask} // New prop
          T_current={T_current} // New prop
        />
      </div>
    </div>
  );
};

export default SimplifiedSchedulePage;