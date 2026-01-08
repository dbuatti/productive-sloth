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
  const { user, profile, isLoading: isSessionLoading, T_current, updateProfile } = useSession();

  // Derive numDaysVisible and currentVerticalZoomIndex directly from profile
  const numDaysVisible = profile?.num_days_visible ?? 7;
  const currentVerticalZoomIndex = profile?.vertical_zoom_index ?? 3;

  const [currentPeriodStartString, setCurrentPeriodStartString] = useState<string>(() =>
    format(startOfDay(new Date()), 'yyyy-MM-dd')
  );

  const { weeklyTasks, isLoading: isWeeklyTasksLoading, fetchWindowStart, fetchWindowEnd } =
    useWeeklySchedulerTasks(currentPeriodStartString);

  const isLoading = isSessionLoading || isWeeklyTasksLoading;

  const handlePeriodShift = useCallback((shiftDays: number) => {
    setCurrentPeriodStartString((prev) => {
      const prevDate = parseISO(prev);
      if (shiftDays === 0) return format(startOfDay(new Date()), 'yyyy-MM-dd');
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
          onSetNumDaysVisible={handleSetNumDaysVisible}
          workdayStartTime={workdayStartTime}
          workdayEndTime={workdayEndTime}
          isLoading={isWeeklyTasksLoading}
          weekStartsOn={weekStartsOn}
          onPeriodShift={handlePeriodShift}
          fetchWindowStart={fetchWindowStart}
          fetchWindowEnd={fetchWindowEnd}
          currentVerticalZoomIndex={currentVerticalZoomIndex}
          onSetCurrentVerticalZoomIndex={handleSetCurrentVerticalZoomIndex}
        />
      </div>
    </div>
  );
};

export default SimplifiedSchedulePage;