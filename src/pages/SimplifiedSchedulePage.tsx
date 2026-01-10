import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, CalendarDays } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/hooks/use-session';
import { useWeeklySchedulerTasks } from '@/hooks/use-weekly-scheduler-tasks';
import WeeklyScheduleGrid from '@/components/WeeklyScheduleGrid';
import { format, startOfDay, parseISO, addDays, subDays, isBefore } from 'date-fns';
import { DBScheduledTask } from '@/types/scheduler';

const FETCH_WINDOW_DAYS = 42;
const MIN_COLUMN_WIDTH = 100;

const SimplifiedSchedulePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, updateProfile } = useSession();

  // Local timer for high-frequency UI updates (schedule line)
  const [T_current, setT_current] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setT_current(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Derive settings directly from profile
  const numDaysVisible = profile?.num_days_visible ?? 7;
  const currentVerticalZoomIndex = profile?.vertical_zoom_index ?? 3;

  // State for the "Lens" (what date is centered in the view)
  const [currentPeriodStartString, setCurrentPeriodStartString] = useState<string>(() => {
    return format(startOfDay(new Date()), 'yyyy-MM-dd');
  });

  // State to force scroll re-calculation on "Today" button click
  const [scrollVersion, setScrollVersion] = useState(0);
  
  // State for grid container width
  const [gridContainerWidth, setGridContainerWidth] = useState(0);
  const gridRef = React.useRef<HTMLDivElement>(null);

  // --- DATA FETCHING ---
  // Calculate fetch window based on currentPeriodStartString
  const centerDate = useMemo(() => parseISO(currentPeriodStartString), [currentPeriodStartString]);
  const fetchWindowStart = useMemo(() => subDays(centerDate, Math.floor(FETCH_WINDOW_DAYS / 2)), [centerDate]);
  const fetchWindowEnd = useMemo(() => addDays(fetchWindowStart, FETCH_WINDOW_DAYS - 1), [fetchWindowStart]);

  const fullFetchWindowDays = useMemo(() => {
    const days: string[] = [];
    let current = fetchWindowStart;
    while (isBefore(current, addDays(fetchWindowEnd, 1))) {
      days.push(format(current, 'yyyy-MM-dd'));
      current = addDays(current, 1);
    }
    return days;
  }, [fetchWindowStart, fetchWindowEnd]);

  // Use the custom hook to fetch weekly tasks
  const { weeklyTasks, isLoading: isWeeklyTasksLoading, profileSettings } =
    useWeeklySchedulerTasks(currentPeriodStartString);

  // --- LOADING STATE FIX ---
  // CRITICAL FIX: Only use the hook's loading state. 
  // Ignore session loading to prevent reloads on tab refocus.
  const isLoading = isWeeklyTasksLoading;

  // --- COLUMN WIDTH CALCULATION ---
  const columnWidth = useMemo(() => {
    const timeAxisWidth = window.innerWidth < 640 ? 40 : 56;
    const availableWidth = gridContainerWidth - timeAxisWidth;
    // Ensure we don't divide by zero or get a tiny width
    if (numDaysVisible <= 0 || availableWidth <= 0) return MIN_COLUMN_WIDTH;
    const calculatedWidth = Math.max(MIN_COLUMN_WIDTH, availableWidth / numDaysVisible);
    return calculatedWidth;
  }, [gridContainerWidth, numDaysVisible]);

  // --- RESIZE OBSERVER ---
  useEffect(() => {
    const resizeObserver = new ResizeObserver(entries => {
      if (entries[0]) {
        const newWidth = entries[0].contentRect.width;
        setGridContainerWidth(newWidth);
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

  // --- SCROLL RECOVERY LOGIC ---
  // This effect handles the "Tab Refocus" scenario where the grid might have lost its place
  // or the user wants to jump to "Today".
  const handlePeriodShift = useCallback((shiftDays: number) => {
    setCurrentPeriodStartString((prev) => {
      const prevDate = parseISO(prev);
      let newDateString;
      if (shiftDays === 0) {
        // Jumping to today: Increment scrollVersion to trigger re-scroll in grid
        setScrollVersion(prevVersion => prevVersion + 1);
        newDateString = format(startOfDay(new Date()), 'yyyy-MM-dd');
      } else {
        newDateString = format(addDays(prevDate, shiftDays), 'yyyy-MM-dd');
      }
      return newDateString;
    });
  }, []);

  // --- PROFILE UPDATE HANDLERS ---
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

  // --- TASK COMPLETION HANDLER ---
  const handleCompleteTask = useCallback(async (task: DBScheduledTask) => {
    // Placeholder: Implement task completion logic here if needed
    // For now, we rely on the main SchedulerPage logic or can add a mutation here
    console.log("Completing task from simplified view:", task.name);
  }, []);

  // Derive workday times
  const workdayStartTime = profile?.default_auto_schedule_start_time || '09:00';
  const workdayEndTime = profile?.default_auto_schedule_end_time || '17:00';

  // If user is not logged in, show a simple message
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <p className="text-lg font-semibold mb-4">Please log in to view your schedule.</p>
        <Button onClick={() => navigate('/login')}>Go to Login</Button>
      </div>
    );
  }

  return (
    <div ref={gridRef} className="flex flex-col h-full w-full">
      {/* Header / Back Button */}
      <div className="flex items-center justify-between p-4 border-b border-border/50 bg-background/90 backdrop-blur-sm sticky top-0 z-30">
        <Button variant="outline" onClick={() => navigate('/scheduler')} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Scheduler
        </Button>
        <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
          <CalendarDays className="h-4 w-4" />
          {format(centerDate, 'MMM yyyy')}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {/* 
          KEY FIX: Add a `key` prop based on user ID. 
          This ensures the component fully remounts if the user changes or logs out/in,
          preventing stale state issues. 
        */}
        <WeeklyScheduleGrid
          key={`weekly-grid-${user.id}-${scrollVersion}`} 
          weeklyTasks={weeklyTasks}
          currentPeriodStartString={currentPeriodStartString}
          numDaysVisible={numDaysVisible}
          onSetNumDaysVisible={handleSetNumDaysVisible}
          workdayStartTime={workdayStartTime}
          workdayEndTime={workdayEndTime}
          isLoading={isLoading}
          weekStartsOn={profile?.week_starts_on ?? 0}
          onPeriodShift={handlePeriodShift}
          fetchWindowStart={fetchWindowStart}
          fetchWindowEnd={fetchWindowEnd}
          currentVerticalZoomIndex={currentVerticalZoomIndex}
          onSetCurrentVerticalZoomIndex={handleSetCurrentVerticalZoomIndex}
          profileSettings={profileSettings}
          scrollVersion={scrollVersion}
          allDaysInFetchWindow={fullFetchWindowDays}
          columnWidth={columnWidth}
          onCompleteTask={handleCompleteTask}
          T_current={T_current}
        />
      </div>
    </div>
  );
};

export default SimplifiedSchedulePage;