import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, CalendarDays } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/hooks/use-session';
import { useWeeklySchedulerTasks } from '@/hooks/use-weekly-scheduler-tasks';
import WeeklyScheduleGrid from '@/components/WeeklyScheduleGrid';
import { format, startOfWeek, isSameDay, parseISO, subDays, addDays, startOfDay, Day } from 'date-fns';
import { cn } from '@/lib/utils';

const SimplifiedSchedulePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, isLoading: isSessionLoading, T_current } = useSession();
  
  // Initialize numDaysVisible and currentVerticalZoomIndex from profile, default to 7 and 3
  const initialNumDaysVisible = profile?.num_days_visible ?? 7;
  const initialVerticalZoomIndex = profile?.vertical_zoom_index ?? 3;
  const initialWeekStartsOn = (profile?.week_starts_on ?? 0) as Day;

  const [numDaysVisible, setNumDaysVisible] = useState<number>(initialNumDaysVisible); 
  const [currentVerticalZoomIndex, setCurrentVerticalZoomIndex] = useState<number>(initialVerticalZoomIndex);

  // currentPeriodStart now represents the *first day* of the currently displayed block of numDaysVisible days.
  // This state will only be updated by explicit user actions (nav buttons, Go to Today).
  const [currentPeriodStart, setCurrentPeriodStart] = useState<Date>(() => {
    const today = new Date();
    // Always start the initial period on today's date
    return startOfDay(today);
  });

  // Pass currentPeriodStart as the centerDate to the hook, so it fetches a buffer around it
  const { weeklyTasks, isLoading: isWeeklyTasksLoading, fetchWindowStart, fetchWindowEnd } = useWeeklySchedulerTasks(currentPeriodStart);

  const isLoading = isSessionLoading || isWeeklyTasksLoading;

  // Update numDaysVisible and currentVerticalZoomIndex when profile loads/changes
  useEffect(() => {
    if (profile) {
      const newNumDaysVisible = profile.num_days_visible ?? 7;
      const newVerticalZoomIndex = profile.vertical_zoom_index ?? 3;
      const newWeekStartsOn = (profile.week_starts_on ?? 0) as Day;

      console.log("[SimplifiedSchedulePage] Profile loaded/changed. newNumDaysVisible:", newNumDaysVisible, "newWeekStartsOn:", newWeekStartsOn);

      // Only update if values are actually different to prevent unnecessary re-renders
      if (newNumDaysVisible !== numDaysVisible) {
        setNumDaysVisible(newNumDaysVisible);
        console.log("[SimplifiedSchedulePage] Updating numDaysVisible to:", newNumDaysVisible);
      }
      if (newVerticalZoomIndex !== currentVerticalZoomIndex) {
        setCurrentVerticalZoomIndex(newVerticalZoomIndex);
        console.log("[SimplifiedSchedulePage] Updating currentVerticalZoomIndex to:", newVerticalZoomIndex);
      }

      // Recalculate currentPeriodStart based on new profile settings and go to today
      // This ensures the view is correctly positioned when settings change or on initial profile load.
      const today = new Date();
      // Always set newStart to today's date
      const newStart = startOfDay(today);
      console.log("[SimplifiedSchedulePage] Calculated newStart:", format(newStart, 'yyyy-MM-dd'), "based on today:", format(today, 'yyyy-MM-dd'));

      // Only update currentPeriodStart if it's actually different to avoid unnecessary scrolls
      if (!isSameDay(currentPeriodStart, newStart)) {
        setCurrentPeriodStart(newStart);
        console.log("[SimplifiedSchedulePage] Setting currentPeriodStart to:", format(newStart, 'yyyy-MM-dd'));
      } else {
        console.log("[SimplifiedSchedulePage] currentPeriodStart is already correct, no update needed.");
      }
    }
  }, [profile, numDaysVisible, currentVerticalZoomIndex, currentPeriodStart]); // Depend on profile to react to its loading/changes

  // Callback for WeeklyScheduleGrid to request a period shift
  const handlePeriodShift = useCallback((shiftDays: number) => {
    setCurrentPeriodStart(prev => addDays(prev, shiftDays));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-100px)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading schedule...</span>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-100px)] text-muted-foreground">
        <CalendarDays className="h-12 w-12 mb-4 opacity-40" />
        <p className="text-lg font-semibold">Please log in to view your schedule.</p>
        <Button onClick={() => navigate('/login')} className="mt-4">Go to Login</Button>
      </div>
    );
  }

  const workdayStartTime = profile.default_auto_schedule_start_time || '09:00';
  const workdayEndTime = profile.default_auto_schedule_end_time || '17:00';

  return (
    <div className="flex flex-col h-full w-full">
      {/* Removed the page-specific header to save vertical space */}
      <div className="flex-1 overflow-auto">
        <WeeklyScheduleGrid
          weeklyTasks={weeklyTasks}
          currentPeriodStart={currentPeriodStart} 
          setCurrentPeriodStart={setCurrentPeriodStart} 
          numDaysVisible={numDaysVisible} 
          setNumDaysVisible={setNumDaysVisible} 
          workdayStartTime={workdayStartTime}
          workdayEndTime={workdayEndTime}
          isLoading={isWeeklyTasksLoading}
          T_current={T_current}
          weekStartsOn={initialWeekStartsOn} // Use initialWeekStartsOn from profile
          onPeriodShift={handlePeriodShift} 
          fetchWindowStart={fetchWindowStart} 
          fetchWindowEnd={fetchWindowEnd}     
          currentVerticalZoomIndex={currentVerticalZoomIndex} // NEW: Pass vertical zoom index
          setCurrentVerticalZoomIndex={setCurrentVerticalZoomIndex} // NEW: Pass vertical zoom index setter
        />
      </div>
    </div>
  );
};

export default SimplifiedSchedulePage;