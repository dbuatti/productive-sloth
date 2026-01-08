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
  
  const weekStartsOn = (profile?.week_starts_on ?? 0) as Day;

  // currentPeriodStart now represents the *first day* of the currently displayed block of numDaysVisible days.
  const [currentPeriodStart, setCurrentPeriodStart] = useState<Date>(() => 
    startOfWeek(new Date(), { weekStartsOn }) 
  );
  // Initialize numDaysVisible from profile, default to 7
  const [numDaysVisible, setNumDaysVisible] = useState<number>(profile?.num_days_visible ?? 7); 

  // Initialize currentVerticalZoomIndex from profile, default to 3 (for 1.00 zoom)
  const [currentVerticalZoomIndex, setCurrentVerticalZoomIndex] = useState<number>(profile?.vertical_zoom_index ?? 3);

  // Pass currentPeriodStart as the centerDate to the hook, so it fetches a buffer around it
  const { weeklyTasks, isLoading: isWeeklyTasksLoading, fetchWindowStart, fetchWindowEnd } = useWeeklySchedulerTasks(currentPeriodStart);

  const isLoading = isSessionLoading || isWeeklyTasksLoading;

  // Adjust currentPeriodStart when numDaysVisible changes to keep "today" in view
  useEffect(() => {
    if (!profile) return; // Wait for profile to load

    const today = new Date();
    let newStart: Date;
    if (numDaysVisible === 1) {
      newStart = startOfDay(today);
    } else if (numDaysVisible === 3) {
      newStart = subDays(startOfDay(today), 1); // Today + 1 day before + 1 day after
    } else if (numDaysVisible === 5) {
      newStart = subDays(startOfDay(today), 2); // Today + 2 days before + 2 days after
    } else { // 7, 14, 21 days - start of week
      newStart = startOfWeek(today, { weekStartsOn: profile.week_starts_on as Day });
    }
    setCurrentPeriodStart(newStart);
  }, [numDaysVisible, profile?.week_starts_on, profile]); // Depend on profile.week_starts_on and profile

  // Update numDaysVisible and currentVerticalZoomIndex when profile loads/changes
  useEffect(() => {
    if (profile) {
      setNumDaysVisible(profile.num_days_visible ?? 7);
      setCurrentVerticalZoomIndex(profile.vertical_zoom_index ?? 3);
    }
  }, [profile]);

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
          weekStartsOn={weekStartsOn}
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