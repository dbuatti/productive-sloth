import React, { useState, useMemo, useEffect, useCallback } from 'react'; // Added useCallback
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

  // currentPeriodStart now represents the *center* of the fetched window for useWeeklySchedulerTasks
  // and the *start* of the displayed window for WeeklyScheduleGrid.
  const [currentPeriodStart, setCurrentPeriodStart] = useState<Date>(() => 
    startOfWeek(new Date(), { weekStartsOn }) 
  );
  const [numDaysVisible, setNumDaysVisible] = useState<number>(7);

  // Pass currentPeriodStart as the centerDate to the hook
  const { weeklyTasks, isLoading: isWeeklyTasksLoading, fetchWindowStart, fetchWindowEnd } = useWeeklySchedulerTasks(currentPeriodStart);

  const isLoading = isSessionLoading || isWeeklyTasksLoading;

  // Adjust currentPeriodStart when numDaysVisible changes to keep "today" in view
  useEffect(() => {
    const today = new Date();
    let newStart: Date;
    if (numDaysVisible === 1) {
      newStart = startOfDay(today);
    } else if (numDaysVisible === 3) {
      newStart = startOfDay(today); 
    } else if (numDaysVisible === 5) {
      newStart = subDays(startOfDay(today), 2); 
    } else { // 7, 14, 21 days
      newStart = startOfWeek(today, { weekStartsOn });
    }
    setCurrentPeriodStart(newStart);
  }, [numDaysVisible, weekStartsOn]);

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
      <div className="flex items-center justify-between p-4 border-b border-border/50 bg-background/90 backdrop-blur-sm sticky top-0 z-30">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate(-1)} 
          className="h-10 w-10 text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">Back</span>
        </Button>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-primary" /> Weekly Vibe
        </h1>
        <div className="w-10" /> 
      </div>

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
          onPeriodShift={handlePeriodShift} // NEW: Pass the shift handler
          fetchWindowStart={fetchWindowStart} // NEW: Pass fetch window bounds
          fetchWindowEnd={fetchWindowEnd}     // NEW: Pass fetch window bounds
        />
      </div>
    </div>
  );
};

export default SimplifiedSchedulePage;