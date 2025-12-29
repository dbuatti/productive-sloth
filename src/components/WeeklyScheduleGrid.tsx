import React, { useState, useMemo, useEffect, useRef } from 'react';
import { DBScheduledTask } from '@/types/scheduler';
import { format, startOfWeek, addDays, isToday, isBefore, setHours, setMinutes, addHours, differenceInMinutes, isAfter } from 'date-fns';
import { cn } from '@/lib/utils';
import SimplifiedScheduledTaskItem from './SimplifiedScheduledTaskItem';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, CalendarDays, ZoomIn, ListTodo, Loader2 } from 'lucide-react';
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
import DailyScheduleColumn from './DailyScheduleColumn'; // Import DailyScheduleColumn

interface WeeklyScheduleGridProps {
  weeklyTasks: { [key: string]: DBScheduledTask[] };
  currentWeekStart: Date;
  setCurrentWeekStart: (date: Date) => void;
  workdayStartTime: string; // HH:MM string from profile
  workdayEndTime: string;   // HH:MM string from profile
  isLoading: boolean;
  T_current: Date; // Current time from SessionProvider
}

const BASE_MINUTE_HEIGHT = 2.5; // Base height for 1 minute at 100% vertical zoom
const VERTICAL_ZOOM_LEVELS = [0.25, 0.50, 0.75, 1.00]; // Available vertical zoom factors
const VISIBLE_DAYS_OPTIONS = [3, 5, 7, 14, 21]; // Options for number of days visible (UPDATED)

const WeeklyScheduleGrid: React.FC<WeeklyScheduleGridProps> = ({
  weeklyTasks,
  currentWeekStart,
  setCurrentWeekStart,
  isLoading,
  T_current,
  workdayStartTime,
  workdayEndTime,
}) => {
  const [isDetailedView, setIsDetailedView] = useState(false); // For task item content detail

  // Vertical Zoom (Times) - Persistence
  const [currentVerticalZoomIndex, setCurrentVerticalZoomIndex] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const savedIndex = localStorage.getItem('weeklyScheduleVerticalZoomIndex');
      return savedIndex ? parseInt(savedIndex, 10) : VERTICAL_ZOOM_LEVELS.indexOf(1.00); // Default to 1.00
    }
    return VERTICAL_ZOOM_LEVELS.indexOf(1.00);
  });
  const currentVerticalZoomFactor = VERTICAL_ZOOM_LEVELS[currentVerticalZoomIndex];
  const dynamicMinuteHeight = BASE_MINUTE_HEIGHT * currentVerticalZoomFactor;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('weeklyScheduleVerticalZoomIndex', currentVerticalZoomIndex.toString());
    }
  }, [currentVerticalZoomIndex]);

  // Days Visible (Horizontal Zoom) - Persistence
  const [numDaysVisible, setNumDaysVisible] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const savedNumDays = localStorage.getItem('weeklyScheduleNumDaysVisible');
      return savedNumDays ? parseInt(savedNumDays, 10) : 7; // Default to 7 days
    }
    return 7;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('weeklyScheduleNumDaysVisible', numDaysVisible.toString());
    }
  }, [numDaysVisible]);

  // Ref to get the width of the scrollable grid container
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [gridContainerWidth, setGridContainerWidth] = useState(0);

  useEffect(() => {
    const resizeObserver = new ResizeObserver(entries => {
      if (entries[0]) {
        setGridContainerWidth(entries[0].contentRect.width);
      }
    });

    if (gridContainerRef.current) {
      resizeObserver.observe(gridContainerRef.current);
    }

    return () => {
      if (gridContainerRef.current) {
        resizeObserver.unobserve(gridContainerRef.current);
      }
    };
  }, []);

  // Calculate dynamic column width based on container width and number of days visible
  const currentColumnWidth = useMemo(() => {
    // The time axis is now always visible, with width w-10 (40px) on small screens and w-14 (56px) on sm+
    const timeAxisWidth = window.innerWidth < 640 ? 40 : 56; // 40px for w-10, 56px for w-14
    const effectiveContainerWidth = gridContainerWidth - timeAxisWidth;
    return effectiveContainerWidth > 0 ? effectiveContainerWidth / numDaysVisible : 0;
  }, [gridContainerWidth, numDaysVisible]);


  const days = useMemo(() => {
    const generatedDays = Array.from({ length: numDaysVisible }).map((_, i) => addDays(currentWeekStart, i));
    return generatedDays;
  }, [currentWeekStart, numDaysVisible]);


  const handlePrevWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, -7));
  };

  const handleNextWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, 7));
  };

  const handleGoToToday = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }));
  };

  const handleSelectVerticalZoom = (zoom: number) => {
    const newIndex = VERTICAL_ZOOM_LEVELS.indexOf(zoom);
    if (newIndex !== -1) {
      setCurrentVerticalZoomIndex(newIndex);
    }
  };

  const handleSelectNumDaysVisible = (days: number) => {
    setNumDaysVisible(days);
  };

  // Time axis now spans a full 24 hours
  const timeAxisStart = setHours(setMinutes(currentWeekStart, 0), 0); // 00:00 local time
  const timeAxisEnd = addDays(timeAxisStart, 1); // 24:00 local time (next day's 00:00)
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
      <div className="flex items-center justify-between p-2 border-b border-border/50 bg-background/90 backdrop-blur-sm sticky top-0 z-20">
        <div className="flex items-center gap-1 sm:gap-2"> {/* Adjusted gap for mobile */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={handlePrevWeek} className="h-8 w-8 sm:h-10 sm:w-10"> {/* Smaller buttons for mobile */}
                <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Previous Week</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={handleGoToToday} className="flex items-center gap-1 h-8 px-2 sm:h-10 sm:px-3"> {/* Smaller button for mobile */}
                <CalendarDays className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline text-xs">{format(currentWeekStart, 'MMM d')} - {format(addDays(currentWeekStart, numDaysVisible - 1), 'MMM d')}</span>
                <span className="inline sm:hidden text-xs">This Week</span> {/* Always show "This Week" on mobile */}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Go to Current Week</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={handleNextWeek} className="h-8 w-8 sm:h-10 sm:w-10"> {/* Smaller buttons for mobile */}
                <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Next Week</TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-center gap-1 sm:gap-2"> {/* Adjusted gap for mobile */}
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

          {/* NEW: Days Visible Dropdown Menu (Horizontal Zoom) */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto flex items-center gap-1 h-8 px-2 sm:h-10 sm:px-3"
                  >
                    <span className="text-xs font-bold font-mono">{numDaysVisible} Days</span>
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
                    {daysOption} Days
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </Tooltip>
          </DropdownMenu>

          {/* Vertical Zoom Dropdown Menu (Times) */}
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
        </div>
      </div>

      {/* Schedule Grid Container */}
      <div ref={gridContainerRef} className="flex-1 overflow-auto custom-scrollbar">
        {isLoading ? (
          <div className="flex items-center justify-center h-full min-h-[300px]">
            <Loader2 className="h-8 w-8 animate-spin text-primary opacity-40" />
            <span className="ml-2 text-muted-foreground">Loading weekly schedule...</span>
          </div>
        ) : (
          <div className="flex h-full">
            {/* Time Axis (Fixed on left for landscape, now always visible) */}
            <div className="w-10 sm:w-14 flex-shrink-0 border-r border-border/50 bg-background/90 backdrop-blur-sm sticky left-0 z-10">
              <div className="h-[60px] border-b border-border/50" /> {/* Spacer for header */}
              <div className="relative" style={{ height: `${totalDayMinutesForTimeAxis * dynamicMinuteHeight}px` }}>
                {timeLabels.map((label, i) => (
                  <div
                    key={label + i}
                    className="absolute right-1 sm:right-2 text-[8px] sm:text-[10px] font-mono text-muted-foreground/60"
                    style={{ top: `${(i * 60) * dynamicMinuteHeight}px`, transform: 'translateY(-50%)' }}
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
                    zoomLevel={currentVerticalZoomFactor} // Pass vertical zoom level
                    columnWidth={currentColumnWidth} // Pass horizontal zoom (column width)
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