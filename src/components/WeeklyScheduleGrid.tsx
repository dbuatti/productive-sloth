import React, { useState, useMemo } from 'react';
import { DBScheduledTask } from '@/types/scheduler';
import { format, startOfWeek, addDays, isToday, isBefore, setHours, setMinutes, addHours, differenceInMinutes } from 'date-fns';
import { cn } from '@/lib/utils';
import DailyScheduleColumn from './DailyScheduleColumn';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, CalendarDays, ZoomIn, ZoomOut, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { setTimeOnDate } from '@/lib/scheduler-utils';

interface WeeklyScheduleGridProps {
  weeklyTasks: { [key: string]: DBScheduledTask[] };
  currentWeekStart: Date;
  setCurrentWeekStart: (date: Date) => void;
  workdayStartTime: string; // HH:MM string from profile
  workdayEndTime: string;   // HH:MM string from profile
  isLoading: boolean;
  T_current: Date; // Current time from SessionProvider
}

const MINUTE_HEIGHT = 2.5; // 1 minute = 2.5px height allotment

const WeeklyScheduleGrid: React.FC<WeeklyScheduleGridProps> = ({
  weeklyTasks,
  currentWeekStart,
  setCurrentWeekStart,
  workdayStartTime,
  workdayEndTime,
  isLoading,
  T_current,
}) => {
  const [isDetailedView, setIsDetailedView] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0); // For horizontal scroll in portrait

  const days = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  const handlePrevWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, -7));
  };

  const handleNextWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, 7));
  };

  const handleGoToToday = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }));
  };

  const dayStart = setTimeOnDate(currentWeekStart, workdayStartTime);
  let dayEnd = setTimeOnDate(currentWeekStart, workdayEndTime);
  if (isBefore(dayEnd, dayStart)) {
    dayEnd = addDays(dayEnd, 1);
  }
  const totalDayMinutes = differenceInMinutes(dayEnd, dayStart);

  const timeLabels = useMemo(() => {
    const labels: string[] = [];
    let currentTime = dayStart;
    while (isBefore(currentTime, dayEnd)) {
      labels.push(format(currentTime, 'h a'));
      currentTime = addHours(currentTime, 1);
    }
    return labels;
  }, [dayStart, dayEnd]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollPosition(e.currentTarget.scrollLeft);
  };

  return (
    <div className="flex flex-col w-full h-full">
      {/* Top Controls */}
      <div className="flex items-center justify-between p-2 border-b border-border/50 bg-background/90 backdrop-blur-sm sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={handlePrevWeek}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Previous Week</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={handleGoToToday} className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                <span className="hidden sm:inline">{format(currentWeekStart, 'MMM d')} - {format(addDays(currentWeekStart, 6), 'MMM d')}</span>
                <span className="inline sm:hidden">This Week</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Go to Current Week</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={handleNextWeek}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Next Week</TooltipContent>
          </Tooltip>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsDetailedView(!isDetailedView)}
              className="ml-auto"
            >
              {isDetailedView ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isDetailedView ? "Compact View" : "Detailed View"}</TooltipContent>
        </Tooltip>
      </div>

      {/* Schedule Grid Container */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        {isLoading ? (
          <div className="flex items-center justify-center h-full min-h-[300px]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading weekly schedule...</span>
          </div>
        ) : (
          <div className="flex h-full">
            {/* Time Axis (Fixed on left for landscape, hidden in portrait) */}
            <div className="hidden sm:block w-14 flex-shrink-0 border-r border-border/50 bg-background/90 backdrop-blur-sm sticky left-0 z-10">
              <div className="h-[60px] border-b border-border/50" /> {/* Spacer for header */}
              <div className="relative">
                {timeLabels.map((label, i) => (
                  <div
                    key={label + i}
                    className="absolute right-2 text-[10px] font-mono text-muted-foreground/60"
                    style={{ top: `${(i * 60) * MINUTE_HEIGHT}px`, transform: 'translateY(-50%)' }}
                  >
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* Daily Columns (Scrollable horizontally in portrait) */}
            <div className="flex flex-1 overflow-x-auto custom-scrollbar">
              {days.map((day) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const tasksForDay = weeklyTasks[dateKey] || [];
                return (
                  <DailyScheduleColumn
                    key={dateKey}
                    dayDate={day}
                    tasks={tasksForDay}
                    workdayStartTime={workdayStartTime}
                    workdayEndTime={workdayEndTime}
                    isDetailedView={isDetailedView}
                    T_current={T_current}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WeeklyScheduleGrid;