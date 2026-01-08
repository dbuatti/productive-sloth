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
  const [numDaysVisible, setNumDaysVisible] = useState<number>(profile?.num_days_visible ?? 7); 
  const [currentVerticalZoomIndex, setCurrentVerticalZoomIndex] = useState<number>(profile?.vertical_zoom_index ?? 3);

  // currentPeriodStart should be initialized to today and then only changed by user navigation.
  // Storing as a string to prevent unnecessary re-renders due to Date object reference changes.
  const [currentPeriodStartString, setCurrentPeriodStartString] = useState<string>(() => format(startOfDay(new Date()), 'yyyy-MM-dd'));
  const [scrollTrigger, setScrollTrigger] = useState(1); // NEW: Initialize to 1 for initial scroll to today

  // Pass currentPeriodStartString as the centerDate to the hook, so it fetches a buffer around it
  const { weeklyTasks, isLoading: isWeeklyTasksLoading, fetchWindowStart, fetchWindowEnd } = useWeeklySchedulerTasks(currentPeriodStartString);

  const isLoading = isSessionLoading || isWeeklyTasksLoading;

  // Effect to update numDaysVisible and currentVerticalZoomIndex when profile loads/changes
  useEffect(() => {
    if (profile) {
      const newNumDaysVisible = profile.num_days_visible ?? 7;
      const newVerticalZoomIndex = profile.vertical_zoom_index ?? 3;

      // Only update if values are actually different to prevent unnecessary re-renders
      if (newNumDaysVisible !== numDaysVisible) {
        setNumDaysVisible(newNumDaysVisible);
      }
      if (newVerticalZoomIndex !== currentVerticalZoomIndex) {
        setCurrentVerticalZoomIndex(newVerticalZoomIndex);
      }
    }
  }, [profile, numDaysVisible, currentVerticalZoomIndex]); // Depend on profile to react to its loading/changes

  // Callback for WeeklyScheduleGrid to request a period shift
  const handlePeriodShift = useCallback((shiftDays: number) => {
    setCurrentPeriodStartString(prevString => {
      const prevDate = parseISO(prevString);
      const newDate = addDays(prevDate, shiftDays);
      return format(newDate, 'yyyy-MM-dd');
    });
    setScrollTrigger(prev => prev + 1); // Trigger scroll
  }, []);

  const handleGoToToday = () => {
    const today = new Date();
    setCurrentPeriodStartString(format(startOfDay(today), 'yyyy-MM-dd'));
    setScrollTrigger(prev => prev + 1); // Trigger scroll
  };

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
  const initialWeekStartsOn = (profile.week_starts_on ?? 0) as Day; // Ensure this is always read from profile

  return (
    <div className="flex flex-col h-full w-full">
      {/* Removed the page-specific header to save vertical space */}
      <div className="flex-1 overflow-auto">
        <WeeklyScheduleGrid
          weeklyTasks={weeklyTasks}
          currentPeriodStartString={currentPeriodStartString} // Pass string
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
          currentVerticalZoomIndex={currentVerticalZoomIndex} // Pass vertical zoom index
          setCurrentVerticalZoomIndex={setCurrentVerticalZoomIndex} // Pass vertical zoom index setter
          scrollTrigger={scrollTrigger} // Pass scrollTrigger
        />
      </div>
    </div>
  );
};

export default SimplifiedSchedulePage;