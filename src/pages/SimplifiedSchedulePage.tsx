import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, CalendarDays } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/hooks/use-session';
import { useWeeklySchedulerTasks } from '@/hooks/use-weekly-scheduler-tasks';
import WeeklyScheduleGrid from '@/components/WeeklyScheduleGrid';
import { format, startOfDay, parseISO, addDays } from 'date-fns';

const SimplifiedSchedulePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, isLoading: isSessionLoading, T_current } = useSession();

  const [numDaysVisible, setNumDaysVisible] = useState<number>(profile?.num_days_visible ?? 7);
  const [currentVerticalZoomIndex, setCurrentVerticalZoomIndex] = useState<number>(profile?.vertical_zoom_index ?? 3);

  const [currentPeriodStartString, setCurrentPeriodStartString] = useState<string>(() =>
    format(startOfDay(new Date()), 'yyyy-MM-dd')
  );

  const { weeklyTasks, isLoading: isWeeklyTasksLoading, fetchWindowStart, fetchWindowEnd } =
    useWeeklySchedulerTasks(currentPeriodStartString);

  const isLoading = isSessionLoading || isWeeklyTasksLoading;

  // Sync profile changes
  useEffect(() => {
    if (profile) {
      if (profile.num_days_visible !== numDaysVisible) setNumDaysVisible(profile.num_days_visible ?? 7);
      if (profile.vertical_zoom_index !== currentVerticalZoomIndex)
        setCurrentVerticalZoomIndex(profile.vertical_zoom_index ?? 3);
    }
  }, [profile]);

  const handlePeriodShift = useCallback((shiftDays: number) => {
    setCurrentPeriodStartString((prev) => {
      const prevDate = parseISO(prev);
      if (shiftDays === 0) return format(startOfDay(new Date()), 'yyyy-MM-dd');
      return format(addDays(prevDate, shiftDays), 'yyyy-MM-dd');
    });
  }, []);

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
    <div className="flex flex-col h-full w-full">
      <div className="flex-1 overflow-hidden">
        <WeeklyScheduleGrid
          weeklyTasks={weeklyTasks}
          currentPeriodStartString={currentPeriodStartString}
          numDaysVisible={numDaysVisible}
          setNumDaysVisible={setNumDaysVisible}
          workdayStartTime={workdayStartTime}
          workdayEndTime={workdayEndTime}
          isLoading={isWeeklyTasksLoading}
          weekStartsOn={weekStartsOn}
          onPeriodShift={handlePeriodShift}
          fetchWindowStart={fetchWindowStart}
          fetchWindowEnd={fetchWindowEnd}
          currentVerticalZoomIndex={currentVerticalZoomIndex}
          setCurrentVerticalZoomIndex={setCurrentVerticalZoomIndex}
        />
      </div>
    </div>
  );
};

export default SimplifiedSchedulePage;