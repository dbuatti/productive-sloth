import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, CalendarDays } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/hooks/use-session';
import { useWeeklySchedulerTasks } from '@/hooks/use-weekly-scheduler-tasks';
import WeeklyScheduleGrid from '@/components/WeeklyScheduleGrid';
import { format, startOfWeek } from 'date-fns';
import { cn } from '@/lib/utils';

const SimplifiedSchedulePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, isLoading: isSessionLoading, T_current } = useSession();
  
  // State for the start of the currently displayed week (always a Sunday)
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => 
    startOfWeek(new Date(), { weekStartsOn: 0 }) // Default to current week, starting Sunday
  );

  const { weeklyTasks, isLoading: isWeeklyTasksLoading } = useWeeklySchedulerTasks(currentWeekStart);

  const isLoading = isSessionLoading || isWeeklyTasksLoading;

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
      {/* Header with Back Button */}
      <div className="flex items-center justify-between p-4 border-b border-border/50 bg-background/90 backdrop-blur-sm sticky top-0 z-30">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate(-1)} // Go back to previous page
          className="h-10 w-10 text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">Back</span>
        </Button>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-primary" /> Weekly Vibe
        </h1>
        <div className="w-10" /> {/* Spacer for alignment */}
      </div>

      {/* Weekly Schedule Grid */}
      <div className="flex-1 overflow-auto"> {/* Changed from overflow-hidden to overflow-auto */}
        <WeeklyScheduleGrid
          weeklyTasks={weeklyTasks}
          currentWeekStart={currentWeekStart}
          setCurrentWeekStart={setCurrentWeekStart}
          workdayStartTime={workdayStartTime}
          workdayEndTime={workdayEndTime}
          isLoading={isWeeklyTasksLoading}
          T_current={T_current}
        />
      </div>
    </div>
  );
};

export default SimplifiedSchedulePage;