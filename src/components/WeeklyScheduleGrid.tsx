"use client";

import React, { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import { DBScheduledTask } from '@/types/scheduler';
import { format, addDays, isToday, isBefore, setHours, setMinutes, addHours, differenceInMinutes, isAfter, startOfDay, subDays, Day, isSameDay, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, CalendarDays, ZoomIn, ListTodo, Loader2, Save } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { setTimeOnDate } from '@/lib/scheduler-utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import DailyScheduleColumn from './DailyScheduleColumn';
import { useSession } from '@/hooks/use-session';
import { showSuccess, showError } from '@/utils/toast';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import { Skeleton } from '@/components/ui/skeleton';

interface WeeklyScheduleGridProps {
  weeklyTasks: { [key: string]: DBScheduledTask[] };
  currentPeriodStartString: string;
  numDaysVisible: number; 
  onSetNumDaysVisible: (days: number) => void;
  workdayStartTime: string; 
  workdayEndTime: string;   
  isLoading: boolean;
  weekStartsOn: number; 
  onPeriodShift: (shiftDays: number) => void; 
  fetchWindowStart: Date; 
  fetchWindowEnd: Date;   
  currentVerticalZoomIndex: number; 
  onSetCurrentVerticalZoomIndex: (index: number) => void;
  profileSettings: any;
  scrollVersion?: number; // NEW: Added scrollVersion prop
}

const BASE_MINUTE_HEIGHT = 1.5;
const VERTICAL_ZOOM_LEVELS = [0.25, 0.50, 0.75, 1.00, 1.25, 1.50];
const VISIBLE_DAYS_OPTIONS = [1, 3, 5, 7, 14, 21]; 
const MIN_COLUMN_WIDTH = 100;

const WeeklyScheduleGrid: React.FC<WeeklyScheduleGridProps> = ({
  weeklyTasks,
  currentPeriodStartString,
  isLoading,
  workdayStartTime,
  workdayEndTime,
  numDaysVisible,
  onSetNumDaysVisible,
  weekStartsOn,
  onPeriodShift,
  fetchWindowStart,
  fetchWindowEnd,   
  currentVerticalZoomIndex,
  onSetCurrentVerticalZoomIndex,
  profileSettings,
  scrollVersion = 0, // NEW: Default scrollVersion
}) => {
  const { updateProfile, isLoading: isSessionLoading, rechargeEnergy, T_current } = useSession();
  const { completeScheduledTask } = useSchedulerTasks('');
  const [isDetailedView, setIsDetailedView] = useState(false);
  
  const currentVerticalZoomFactor = useMemo(() => VERTICAL_ZOOM_LEVELS[currentVerticalZoomIndex], [currentVerticalZoomIndex]);

  const gridScrollContainerRef = useRef<HTMLDivElement>(null);
  const [gridContainerWidth, setGridContainerWidth] = useState(0);

  const isInitialMount = useRef(true);
  const lastTargetDate = useRef<string | null>(null);
  const lastScrollVersion = useRef<number>(0); // NEW: Track last scroll version

  const currentPeriodStart = useMemo(() => parseISO(currentPeriodStartString), [currentPeriodStartString]);

  useEffect(() => {
    const resizeObserver = new ResizeObserver(entries => {
      if (entries[0]) {
        setGridContainerWidth(entries[0].contentRect.width);
      }
    });

    if (gridScrollContainerRef.current) {
      resizeObserver.observe(gridScrollContainerRef.current);
    }

    return () => {
      if (gridScrollContainerRef.current) {
        resizeObserver.unobserve(gridScrollContainerRef.current);
      }
    };
  }, []);

  const columnWidth = useMemo(() => {
    const timeAxisWidth = window.innerWidth < 640 ? 40 : 56;
    const availableWidth = gridContainerWidth - timeAxisWidth;
    
    const calculatedWidth = Math.max(MIN_COLUMN_WIDTH, availableWidth / numDaysVisible);
    return calculatedWidth;
  }, [gridContainerWidth, numDaysVisible]);

  const allDaysInFetchWindow = useMemo(() => {
    const days: Date[] = [];
    let current = fetchWindowStart;
    while (isBefore(current, addDays(fetchWindowEnd, 1))) {
      days.push(current);
      current = addDays(current, 1);
    }
    return days;
  }, [fetchWindowStart, fetchWindowEnd]);

  // The Execution Function
  const scrollToDate = useCallback((date: string, behavior: ScrollBehavior = 'smooth') => {
    const container = gridScrollContainerRef.current;
    if (!container) return;

    const targetIndex = allDaysInFetchWindow.findIndex(day => format(day, 'yyyy-MM-dd') === date);
    if (targetIndex !== -1) {
      const scrollPosition = targetIndex * columnWidth;
      
      container.scrollTo({
        left: scrollPosition,
        behavior: behavior
      });
      
      lastTargetDate.current = date;
    }
  }, [allDaysInFetchWindow, columnWidth]);

  // Effect: Handle Initial Load & External Date Changes
  useEffect(() => {
    if (!gridScrollContainerRef.current) return;

    // 1. Handle Initial Load: Instant Jump
    if (isInitialMount.current) {
      const timer = setTimeout(() => {
        scrollToDate(currentPeriodStartString, 'auto'); // 'auto' = instant jump
        isInitialMount.current = false;
        lastScrollVersion.current = scrollVersion; // Initialize lastScrollVersion
      }, 100); // 100ms guard for DOM calc
      return () => clearTimeout(timer);
    }

    // 2. Handle "Today" Click or Forced Refocus
    // If the scrollVersion has increased, the user explicitly asked for a refocus
    const forceRefocus = scrollVersion > lastScrollVersion.current;
    
    if (forceRefocus || lastTargetDate.current !== currentPeriodStartString) {
      scrollToDate(currentPeriodStartString, 'smooth');
      lastScrollVersion.current = scrollVersion; // Update lastScrollVersion
    }

  }, [currentPeriodStartString, scrollVersion, scrollToDate]); // Added scrollVersion to dependencies

  const handlePrevPeriod = () => {
    onPeriodShift(-numDaysVisible);
  };

  const handleNextPeriod = () => {
    onPeriodShift(numDaysVisible);
  };

  const handleGoToToday = () => {
    onPeriodShift(0); 
  };

  const handleSelectVerticalZoom = (zoom: number) => {
    const newIndex = VERTICAL_ZOOM_LEVELS.indexOf(zoom);
    if (newIndex !== -1) {
      onSetCurrentVerticalZoomIndex(newIndex);
    }
  };

  const handleSelectNumDaysVisible = (daysOption: number) => {
    onSetNumDaysVisible(daysOption);
  };

  const handleSaveViewPreferences = async () => {
    try {
      await updateProfile({
        num_days_visible: numDaysVisible,
        vertical_zoom_index: currentVerticalZoomIndex,
      });
      showSuccess("View preferences saved!");
    } catch (error) {
      showError("Failed to save view preferences.");
      console.error("Failed to save view preferences:", error);
    }
  };

  const handleCompleteScheduledTask = useCallback(async (task: DBScheduledTask) => {
    if (task.is_completed) return;
    try {
      await completeScheduledTask(task);
      await rechargeEnergy(-(task.energy_cost));
      showSuccess(`Task "${task.name}" completed! +${task.energy_cost * 2} XP`);
    } catch (error) {
      showError(`Failed to complete task: ${task.name}`);
      console.error("Error completing task from weekly grid:", error);
    }
  }, [completeScheduledTask, rechargeEnergy]);


  const timeAxisStart = useMemo(() => setTimeOnDate(currentPeriodStart, workdayStartTime), [currentPeriodStart, workdayStartTime]);
  let timeAxisEnd = useMemo(() => setTimeOnDate(currentPeriodStart, workdayEndTime), [currentPeriodStart, workdayEndTime]);
  if (isBefore(timeAxisEnd, timeAxisStart)) {
    timeAxisEnd = addDays(timeAxisEnd, 1);
  }
  const totalDayMinutesForTimeAxis = differenceInMinutes(timeAxisEnd, timeAxisStart);

  const timeLabels = useMemo(() => {
    const labels: string[] = [];
    let currentTime = timeAxisStart;
    while (isBefore(currentTime, timeAxisEnd)) {
      labels.push(format(currentTime, 'h a'));
      currentTime = addHours(currentTime, 1);
    }
    return labels;
  }, [timeAxisStart, timeAxisEnd]);

  return (
    <div className="flex flex-col w-full h-full">
      {/* Top Controls */}
      <div className="flex items-center justify-between py-1 px-2 border-b border-border/50 bg-background/90 backdrop-blur-sm sticky top-0 z-20">
        <div className="flex items-center gap-1 sm:gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={handlePrevPeriod} className="h-8 w-8 sm:h-10 sm:w-10">
                <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Previous {numDaysVisible} Days</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={handleGoToToday} className="flex items-center gap-1 h-8 px-2 sm:h-10 sm:px-3">
                <CalendarDays className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline text-xs">Today</span>
                <span className="inline sm:hidden text-xs">Today</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Go to Today</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={handleNextPeriod} className="h-8 w-8 sm:h-10 sm:w-10">
                <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Next {numDaysVisible} Days</TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsDetailedView(!isDetailedView)}
                className="h-8 w-8 sm:h-10 sm:w-10"
              >
                <ListTodo className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isDetailedView ? "Compact Task Details" : "Detailed Task Info"}</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto flex items-center gap-1 h-8 px-2 sm:h-10 sm:px-3"
                  >
                    <span className="text-xs font-bold font-mono">{numDaysVisible} Day{numDaysVisible !== 1 ? 's' : ''}</span>
                    <CalendarDays className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <DropdownMenuContent align="end" className="glass-card min-w-32 border-white/10 bg-background/95 backdrop-blur-xl">
                <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest opacity-50 px-3 py-2">Days Visible</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/5" />
                {VISIBLE_DAYS_OPTIONS.map((daysOption) => (
                  <DropdownMenuItem 
                    key={daysOption} 
                    onClick={() => handleSelectNumDaysVisible(daysOption)}
                    className={cn(
                      "gap-3 font-bold text-[10px] uppercase py-2.5 px-3 focus:bg-primary/20 cursor-pointer",
                      numDaysVisible === daysOption && "bg-primary/10 text-primary"
                    )}
                  >
                    {daysOption} Day{daysOption !== 1 ? 's' : ''}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </Tooltip>
          </DropdownMenu>

          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto flex items-center gap-1 h-8 px-2 sm:h-10 sm:px-3"
                  >
                    <span className="text-xs font-bold font-mono">{Math.round(currentVerticalZoomFactor * 100)}%</span>
                    <ZoomIn className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <DropdownMenuContent align="end" className="glass-card min-w-32 border-white/10 bg-background/95 backdrop-blur-xl">
                <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest opacity-50 px-3 py-2">Time Zoom</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/5" />
                {VERTICAL_ZOOM_LEVELS.map((zoom) => (
                  <DropdownMenuItem 
                    key={zoom} 
                    onClick={() => handleSelectVerticalZoom(zoom)}
                    className={cn(
                      "gap-3 font-bold text-[10px] uppercase py-2.5 px-3 focus:bg-primary/20 cursor-pointer",
                      currentVerticalZoomFactor === zoom && "bg-primary/10 text-primary"
                    )}
                  >
                    {Math.round(zoom * 100)}%
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </Tooltip>
          </DropdownMenu>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSaveViewPreferences}
                disabled={isSessionLoading}
                className="h-8 w-8 sm:h-10 sm:w-10 text-primary hover:bg-primary/10"
              >
                <Save className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Save View Preferences</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Schedule Grid Container */}
      <div 
        ref={gridScrollContainerRef} 
        id="weekly-schedule-grid-scroll-container" 
        className="flex-1 overflow-auto custom-scrollbar"
        style={{ scrollSnapType: 'none' }} // Ensure CSS isn't forcing snapping
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[300px] py-16 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary opacity-40" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/50">Synchronizing Timeline...</p>
            <div className="flex w-full px-4 gap-2">
              {Array.from({ length: numDaysVisible }).map((_, colIdx) => (
                <div key={colIdx} className="flex-1 min-w-[100px] space-y-2">
                  <Skeleton className="h-16 w-full rounded-xl" />
                  <Skeleton className="h-12 w-full rounded-xl" />
                  <Skeleton className="h-20 w-full rounded-xl" />
                  <Skeleton className="h-16 w-full rounded-xl" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex h-full">
            {/* Time Axis (Fixed on left for landscape, now always visible) */}
            <div className="w-10 sm:w-14 flex-shrink-0 border-r border-border/50 bg-background/90 backdrop-blur-sm sticky left-0 z-10">
              <div className="h-[60px] border-b border-border/50" /> {/* Spacer for header */}
              <div className="relative" style={{ height: `${totalDayMinutesForTimeAxis * currentVerticalZoomFactor}px` }}>
                {timeLabels.map((label, i) => (
                  <div
                    key={label + i}
                    className="absolute right-1 sm:right-2 text-[8px] sm:text-[10px] font-mono text-muted-foreground/60"
                    style={{ top: `${(i * 60) * currentVerticalZoomFactor}px`, transform: 'translateY(-50%)' }}
                  >
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* Daily Columns (This is the horizontally scrollable content) */}
            <div className="flex">
              {allDaysInFetchWindow.map((day) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const tasksForDay = weeklyTasks[dateKey] || [];
                const isDayBlocked = profileSettings?.blockedDays?.includes(dateKey) ?? false;
                return (
                  <DailyScheduleColumn
                    key={dateKey}
                    dateString={dateKey} // Pass date as string
                    tasks={tasksForDay}
                    workdayStartTime={workdayStartTime}
                    workdayEndTime={workdayEndTime}
                    isDetailedView={isDetailedView}
                    T_current={T_current}
                    zoomLevel={currentVerticalZoomFactor}
                    columnWidth={columnWidth}
                    onCompleteTask={handleCompleteScheduledTask}
                    isDayBlocked={isDayBlocked}
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

export default React.memo(WeeklyScheduleGrid);