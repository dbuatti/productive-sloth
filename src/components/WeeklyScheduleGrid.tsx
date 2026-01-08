"use client";

import React, { useLayoutEffect, useEffect, useRef, useMemo, useCallback, useState } from 'react';
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
  isLoading: boolean; // Combined loading state from SimplifiedSchedulePage
  weekStartsOn: number; 
  onPeriodShift: (shiftDays: number) => void; 
  fetchWindowStart: Date; 
  fetchWindowEnd: Date;   
  currentVerticalZoomIndex: number; 
  onSetCurrentVerticalZoomIndex: (index: number) => void;
  profileSettings: any; // Contains blockedDays
  scrollVersion?: number;
  allDaysInFetchWindow: string[]; // Derived in SimplifiedSchedulePage
  columnWidth: number; // Derived in SimplifiedSchedulePage
  onCompleteTask: (task: DBScheduledTask) => Promise<void>; // Passed down to DailyScheduleColumn
  T_current: Date; // Passed down to DailyScheduleColumn
}

const BASE_MINUTE_HEIGHT = 1.5;
const VERTICAL_ZOOM_LEVELS = [0.25, 0.50, 0.75, 1.00, 1.25, 1.50];
const VISIBLE_DAYS_OPTIONS = [1, 3, 5, 7, 14, 21]; 
const MIN_COLUMN_WIDTH = 100;

const WeeklyScheduleGrid: React.FC<WeeklyScheduleGridProps> = ({
  weeklyTasks,
  currentPeriodStartString,
  isLoading, // Use the combined isLoading
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
  scrollVersion = 0,
  allDaysInFetchWindow, // New prop
  columnWidth, // New prop
  onCompleteTask, // New prop
  T_current, // New prop
}) => {
  const { updateProfile, isLoading: isSessionLoading, rechargeEnergy } = useSession();
  const { completeScheduledTask } = useSchedulerTasks('');
  const [isDetailedView, setIsDetailedView] = useState(false);
  
  const currentVerticalZoomFactor = useMemo(() => VERTICAL_ZOOM_LEVELS[currentVerticalZoomIndex], [currentVerticalZoomIndex]);

  const gridScrollContainerRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);
  const lastScrollVersion = useRef<number>(0); // Renamed from lastKnownDataLength to lastScrollVersion

  const performScroll = useCallback((date: string, behavior: ScrollBehavior = 'smooth') => {
    const container = gridScrollContainerRef.current;
    if (!container || allDaysInFetchWindow.length === 0) {
      console.log(`[WeeklyScheduleGrid] performScroll: SKIPPED. Container: ${!!container}, allDaysInFetchWindow.length: ${allDaysInFetchWindow.length}`);
      return;
    }

    const targetIndex = allDaysInFetchWindow.indexOf(date);
    if (targetIndex !== -1) {
      const scrollPosition = targetIndex * columnWidth;
      console.log(`[WeeklyScheduleGrid] performScroll: Scrolling to date '${date}' (index ${targetIndex}) with behavior '${behavior}'. Scroll position: ${scrollPosition}px`);
      container.scrollTo({ 
        left: scrollPosition, 
        behavior 
      });
    } else {
      console.log(`[WeeklyScheduleGrid] performScroll: Target date '${date}' not found in allDaysInFetchWindow.`);
    }
  }, [allDaysInFetchWindow, columnWidth]);

  // FIX: The Layout-First Guard
  useLayoutEffect(() => {
    console.log(`[WeeklyScheduleGrid] useLayoutEffect: isLoading: ${isLoading}, allDaysInFetchWindow.length: ${allDaysInFetchWindow.length}, isInitialMount.current: ${isInitialMount.current}`);
    // Only scroll if we have data AND we haven't successfully 
    // focused the initial mount yet.
    if (isLoading || allDaysInFetchWindow.length === 0) {
      console.log("[WeeklyScheduleGrid] useLayoutEffect: SKIPPED due to loading or empty data.");
      return;
    }

    // This ensures we only "Initial Jump" once the data array is actually populated
    if (isInitialMount.current && allDaysInFetchWindow.length > 0) {
      console.log("[WeeklyScheduleGrid] useLayoutEffect: Performing initial scroll.");
      // Use requestAnimationFrame to ensure the browser has painted 
      // the new flex-basis of the columns
      requestAnimationFrame(() => {
        performScroll(currentPeriodStartString, 'auto');
        isInitialMount.current = false;
        lastScrollVersion.current = scrollVersion; // Update lastScrollVersion here
        console.log(`[WeeklyScheduleGrid] useLayoutEffect: Initial scroll completed. isInitialMount set to false. lastScrollVersion set to ${scrollVersion}.`);
      });
    }
  }, [isLoading, allDaysInFetchWindow, currentPeriodStartString, performScroll, scrollVersion]); // Added scrollVersion to dependencies

  // 3. TODAY BUTTON: Handles explicit refocusing
  useEffect(() => {
    console.log(`[WeeklyScheduleGrid] useEffect (scrollVersion): isLoading: ${isLoading}, isInitialMount.current: ${isInitialMount.current}, scrollVersion: ${scrollVersion}, lastScrollVersion.current: ${lastScrollVersion.current}`);
    if (isLoading || isInitialMount.current) {
      console.log("[WeeklyScheduleGrid] useEffect (scrollVersion): SKIPPED due to loading or initial mount.");
      return;
    }

    if (scrollVersion > lastScrollVersion.current) {
      console.log(`[WeeklyScheduleGrid] useEffect (scrollVersion): scrollVersion (${scrollVersion}) > lastScrollVersion (${lastScrollVersion.current}). Performing scroll.`);
      performScroll(currentPeriodStartString, 'smooth');
      lastScrollVersion.current = scrollVersion;
      console.log(`[WeeklyScheduleGrid] useEffect (scrollVersion): Scroll completed. lastScrollVersion updated to ${scrollVersion}.`);
    }
  }, [scrollVersion, currentPeriodStartString, isLoading, performScroll]);

  const handlePrevPeriod = useCallback(() => {
    console.log("[WeeklyScheduleGrid] handlePrevPeriod called.");
    onPeriodShift(-numDaysVisible);
  }, [onPeriodShift, numDaysVisible]);

  const handleNextPeriod = useCallback(() => {
    console.log("[WeeklyScheduleGrid] handleNextPeriod called.");
    onPeriodShift(numDaysVisible);
  }, [onPeriodShift, numDaysVisible]);

  const handleGoToToday = useCallback(() => {
    console.log("[WeeklyScheduleGrid] handleGoToToday called.");
    onPeriodShift(0); 
  }, [onPeriodShift]);

  const handleSelectVerticalZoom = useCallback((zoom: number) => {
    console.log(`[WeeklyScheduleGrid] handleSelectVerticalZoom called with zoom: ${zoom}.`);
    const newIndex = VERTICAL_ZOOM_LEVELS.indexOf(zoom);
    if (newIndex !== -1) {
      onSetCurrentVerticalZoomIndex(newIndex);
    }
  }, [onSetCurrentVerticalZoomIndex]);

  const handleSaveViewPreferences = useCallback(async () => {
    console.log("[WeeklyScheduleGrid] handleSaveViewPreferences called.");
    try {
      await updateProfile({
        num_days_visible: numDaysVisible,
        vertical_zoom_index: currentVerticalZoomIndex,
      });
      showSuccess("View preferences saved!");
      console.log("[WeeklyScheduleGrid] View preferences saved successfully.");
    } catch (error) {
      showError("Failed to save view preferences.");
      console.error("[WeeklyScheduleGrid] Failed to save view preferences:", error);
    }
  }, [updateProfile, numDaysVisible, currentVerticalZoomIndex]);

  const handleCompleteScheduledTask = useCallback(async (task: DBScheduledTask) => {
    console.log(`[WeeklyScheduleGrid] handleCompleteScheduledTask called for task: ${task.name}.`);
    if (task.is_completed) return;
    try {
      await completeScheduledTask(task);
      await rechargeEnergy(-(task.energy_cost));
      showSuccess(`Task "${task.name}" completed! +${task.energy_cost * 2} XP`);
      console.log(`[WeeklyScheduleGrid] Task "${task.name}" completed successfully.`);
    } catch (error) {
      showError(`Failed to complete task: ${task.name}`);
      console.error("[WeeklyScheduleGrid] Error completing task from weekly grid:", error);
    }
  }, [completeScheduledTask, rechargeEnergy]);


  const timeAxisStart = useMemo(() => setTimeOnDate(parseISO(currentPeriodStartString), workdayStartTime), [currentPeriodStartString, workdayStartTime]);
  let timeAxisEnd = useMemo(() => setTimeOnDate(parseISO(currentPeriodStartString), workdayEndTime), [currentPeriodStartString, workdayEndTime]);
  if (isBefore(timeAxisEnd, timeAxisStart)) {
    timeAxisEnd = addDays(timeAxisEnd, 1);
  }
  const totalDayMinutesForTimeAxis = useMemo(() => differenceInMinutes(timeAxisEnd, timeAxisStart), [timeAxisEnd, timeAxisStart]);

  const timeLabels = useMemo(() => {
    const labels: string[] = [];
    let currentTime = timeAxisStart;
    while (isBefore(currentTime, timeAxisEnd)) {
      labels.push(format(currentTime, 'h a'));
      currentTime = addHours(currentTime, 1);
    }
    return labels;
  }, [timeAxisStart, timeAxisEnd]);

  // RENDER: Memoize to stop the "Double Render" flicker
  const dayElements = useMemo(() => {
    console.log(`[WeeklyScheduleGrid] dayElements useMemo: isLoading: ${isLoading}, allDaysInFetchWindow.length: ${allDaysInFetchWindow.length}`);
    if (isLoading) return null; // Don't render empty columns while loading
    return allDaysInFetchWindow.map((dateString) => {
      const tasksForDay = weeklyTasks[dateString] || [];
      const isDayBlocked = profileSettings?.blockedDays?.includes(dateString) ?? false;
      return (
        <div 
          key={dateString} 
          style={{ 
            width: `${columnWidth}px`, 
            flex: `0 0 ${columnWidth}px` // THIS IS THE KEY FIX
          }} 
          className="border-r border-white/5 h-full overflow-y-auto"
        >
          <DailyScheduleColumn 
            dateString={dateString} 
            tasks={tasksForDay}
            workdayStartTime={workdayStartTime}
            workdayEndTime={workdayEndTime}
            isDetailedView={isDetailedView}
            T_current={T_current}
            zoomLevel={currentVerticalZoomFactor}
            columnWidth={columnWidth}
            onCompleteTask={onCompleteTask}
            isDayBlocked={isDayBlocked}
          />
        </div>
      );
    });
  }, [allDaysInFetchWindow, columnWidth, weeklyTasks, workdayStartTime, workdayEndTime, isDetailedView, T_current, currentVerticalZoomFactor, onCompleteTask, profileSettings?.blockedDays, isLoading]);


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
                    onClick={() => onSetNumDaysVisible(daysOption)}
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
        style={{ 
          scrollSnapType: 'none', // Critical: Removes the swipe-pause
          WebkitOverflowScrolling: 'touch', // Critical: Smooth iOS momentum
          touchAction: 'pan-x', // Ensures vertical scrolling doesn't break horizontal
          willChange: 'transform' // Performance boost for long lists
        }}
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
              {dayElements}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(WeeklyScheduleGrid);