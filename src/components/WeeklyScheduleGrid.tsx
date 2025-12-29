import React, { useState, useMemo, useEffect } from 'react';
import { DBScheduledTask } from '@/types/scheduler';
import { format, startOfWeek, addDays, isToday, isBefore, setHours, setMinutes, addHours, differenceInMinutes } from 'date-fns';
import { cn } from '@/lib/utils';
import DailyScheduleColumn from './DailyScheduleColumn';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, CalendarDays, ZoomIn, ListTodo, Loader2 } from 'lucide-react'; // Changed ZoomOut to ListTodo
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
const COLUMN_WIDTH_LEVELS = [140, 180, 220]; // Available column widths in pixels for horizontal zoom

const WeeklyScheduleGrid: React.FC<WeeklyScheduleGridProps> = ({
  weeklyTasks,
  currentWeekStart,
  setCurrentWeekStart,
  workdayStartTime,
  workdayEndTime,
  isLoading,
  T_current,
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

  // Horizontal Zoom (Days/Columns) - Persistence
  const [currentColumnWidthIndex, setCurrentColumnWidthIndex] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const savedIndex = localStorage.getItem('weeklyScheduleColumnWidthIndex');
      return savedIndex ? parseInt(savedIndex, 10) : COLUMN_WIDTH_LEVELS.indexOf(180); // Default to 180px
    }
    return COLUMN_WIDTH_LEVELS.indexOf(180);
  });
  const currentColumnWidth = COLUMN_WIDTH_LEVELS[currentColumnWidthIndex];

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('weeklyScheduleColumnWidthIndex', currentColumnWidthIndex.toString());
    }
  }, [currentColumnWidthIndex]);


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

  const handleSelectVerticalZoom = (zoom: number) => {
    const newIndex = VERTICAL_ZOOM_LEVELS.indexOf(zoom);
    if (newIndex !== -1) {
      setCurrentVerticalZoomIndex(newIndex);
    }
  };

  const handleSelectColumnWidth = (width: number) => {
    const newIndex = COLUMN_WIDTH_LEVELS.indexOf(width);
    if (newIndex !== -1) {
      setCurrentColumnWidthIndex(newIndex);
    }
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
  }, [dayStart, dayEnd, dynamicMinuteHeight]);

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

        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsDetailedView(!isDetailedView)}
              >
                <ListTodo className="h-4 w-4" /> {/* Changed icon to ListTodo */}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isDetailedView ? "Compact Task Details" : "Detailed Task Info"}</TooltipContent>
          </Tooltip>

          {/* NEW: Day Width Dropdown Menu (Horizontal Zoom) */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto flex items-center gap-1"
                  >
                    <span className="text-xs font-bold font-mono">{currentColumnWidth}px</span>
                    <CalendarDays className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <DropdownMenuContent align="end" className="glass-card min-w-32 border-white/10 bg-background/95 backdrop-blur-xl">
                <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest opacity-50 px-3 py-2">Day Width</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/5" />
                {COLUMN_WIDTH_LEVELS.map((width) => (
                  <DropdownMenuItem 
                    key={width} 
                    onClick={() => handleSelectColumnWidth(width)}
                    className={cn(
                      "gap-3 font-bold text-[10px] uppercase py-2.5 px-3 focus:bg-primary/20 cursor-pointer",
                      currentColumnWidth === width && "bg-primary/10 text-primary"
                    )}
                  >
                    {width}px
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
                    className="ml-auto flex items-center gap-1"
                  >
                    <span className="text-xs font-bold font-mono">{Math.round(currentVerticalZoomFactor * 100)}%</span>
                    <ZoomIn className="h-4 w-4" />
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
              <div className="relative" style={{ height: `${totalDayMinutes * dynamicMinuteHeight}px` }}>
                {timeLabels.map((label, i) => (
                  <div
                    key={label + i}
                    className="absolute right-2 text-[10px] font-mono text-muted-foreground/60"
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