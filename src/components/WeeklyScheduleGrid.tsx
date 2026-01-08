import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { DBScheduledTask } from '@/types/scheduler';
import {
  format,
  addDays,
  isToday,
  differenceInMinutes,
  addHours,
  parseISO,
  startOfDay,
} from 'date-fns';
import { cn } from '@/lib/utils';
import DailyScheduleColumn from './DailyScheduleColumn';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  ZoomIn,
  ListTodo,
  Loader2,
  Save,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { setTimeOnDate } from '@/lib/scheduler-utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useSession } from '@/hooks/use-session';
import { showSuccess, showError } from '@/utils/toast';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';

interface WeeklyScheduleGridProps {
  weeklyTasks: { [key: string]: DBScheduledTask[] };
  currentPeriodStartString: string;
  numDaysVisible: number;
  setNumDaysVisible: (days: number) => void;
  workdayStartTime: string;
  workdayEndTime: string;
  isLoading: boolean;
  weekStartsOn: number;
  onPeriodShift: (shiftDays: number) => void;
  fetchWindowStart: Date;
  fetchWindowEnd: Date;
  currentVerticalZoomIndex: number;
  setCurrentVerticalZoomIndex: React.Dispatch<React.SetStateAction<number>>;
}

// Constants for clarity and future adjustments
const BASE_MINUTE_HEIGHT_PX = 1.5;
const VERTICAL_ZOOM_LEVELS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5];
const VISIBLE_DAYS_OPTIONS = [1, 3, 5, 7, 14, 21];
const MIN_COLUMN_WIDTH = 120;
const FULL_DAY_MINUTES = 1440; // Base height on full 24-hour day for consistent alignment

const WeeklyScheduleGrid: React.FC<WeeklyScheduleGridProps> = ({
  weeklyTasks,
  currentPeriodStartString,
  isLoading,
  workdayStartTime,
  workdayEndTime,
  numDaysVisible,
  setNumDaysVisible,
  onPeriodShift,
  fetchWindowStart,
  fetchWindowEnd,
  currentVerticalZoomIndex,
  setCurrentVerticalZoomIndex,
}) => {
  const { updateProfile, isLoading: isSessionLoading, rechargeEnergy, T_current } = useSession();
  const { completeScheduledTask } = useSchedulerTasks('');
  const [isDetailedView, setIsDetailedView] = useState(false);

  const zoomFactor = VERTICAL_ZOOM_LEVELS[currentVerticalZoomIndex];
  const gridRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const currentPeriodStart = useMemo(() => parseISO(currentPeriodStartString), [currentPeriodStartString]);

  // Responsive container width
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) setContainerWidth(entries[0].contentRect.width);
    });
    if (gridRef.current) observer.observe(gridRef.current);
    return () => observer.disconnect();
  }, []);

  const timeAxisWidth = window.innerWidth < 640 ? 40 : 56;
  const columnWidth = useMemo(() => {
    const available = containerWidth - timeAxisWidth;
    return Math.max(MIN_COLUMN_WIDTH, available / numDaysVisible);
  }, [containerWidth, numDaysVisible]);

  // Days to render (from fetch window)
  const renderedDays = useMemo(() => {
    const days: Date[] = [];
    let current = startOfDay(fetchWindowStart);
    while (current <= fetchWindowEnd) {
      days.push(current);
      current = addDays(current, 1);
    }
    return days;
  }, [fetchWindowStart, fetchWindowEnd]);

  // Index of the target visible start day
  const targetDayIndex = useMemo(() => {
    return renderedDays.findIndex((d) => format(d, 'yyyy-MM-dd') === currentPeriodStartString);
  }, [renderedDays, currentPeriodStartString]);

  // Reliable auto-scroll to visible period start
  useEffect(() => {
    const container = gridRef.current;
    if (!container || targetDayIndex < 0) return;

    const targetColumn = container.querySelector(`[data-date="${currentPeriodStartString}"]`) as HTMLElement;
    if (targetColumn) {
      const scrollLeft = targetColumn.offsetLeft - timeAxisWidth;
      container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
    }
  }, [currentPeriodStartString, targetDayIndex, timeAxisWidth]);

  const handleCompleteTask = useCallback(async (task: DBScheduledTask) => {
    if (task.is_completed) return;
    try {
      await completeScheduledTask(task);
      await rechargeEnergy(-task.energy_cost);
      showSuccess(`Task "${task.name}" completed! +${task.energy_cost * 2} XP`);
    } catch (err) {
      showError(`Failed to complete task: ${task.name}`);
    }
  }, [completeScheduledTask, rechargeEnergy]);

  const handleSavePreferences = async () => {
    try {
      await updateProfile({
        num_days_visible: numDaysVisible,
        vertical_zoom_index: currentVerticalZoomIndex,
      });
      showSuccess('View preferences saved!');
    } catch (err) {
      showError('Failed to save preferences');
    }
  };

  // Time axis: hourly labels within workday
  const workdayStartDate = setTimeOnDate(currentPeriodStart, workdayStartTime);
  const workdayEndDate = setTimeOnDate(currentPeriodStart, workdayEndTime);
  const effectiveEnd = workdayEndDate < workdayStartDate ? addDays(workdayEndDate, 1) : workdayEndDate;

  const hourlyLabels = useMemo(() => {
    const labels: { label: string; minutesFromMidnight: number }[] = [];
    let time = workdayStartDate;
    while (time < effectiveEnd) {
      labels.push({
        label: format(time, 'h a'),
        minutesFromMidnight: differenceInMinutes(time, startOfDay(currentPeriodStart)),
      });
      time = addHours(time, 1);
    }
    return labels;
  }, [workdayStartDate, effectiveEnd, currentPeriodStart]);

  const gridHeightPx = FULL_DAY_MINUTES * BASE_MINUTE_HEIGHT_PX * zoomFactor;

  return (
    <div className="flex flex-col h-full w-full">
      {/* Top Controls */}
      <div className="flex items-center justify-between py-2 px-3 border-b border-border/40 bg-background/95 backdrop-blur sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={() => onPeriodShift(-numDaysVisible)}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Previous {numDaysVisible} days</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={() => onPeriodShift(0)}>
                <CalendarDays className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Today</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Jump to today</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={() => onPeriodShift(numDaysVisible)}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Next {numDaysVisible} days</TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsDetailedView(!isDetailedView)}
          >
            <ListTodo className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <span className="font-mono text-xs font-bold">{numDaysVisible} Day{numDaysVisible > 1 ? 's' : ''}</span>
                <CalendarDays className="h-4 w-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Days Visible</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {VISIBLE_DAYS_OPTIONS.map((days) => (
                <DropdownMenuItem
                  key={days}
                  onClick={() => setNumDaysVisible(days)}
                  className={cn(numDaysVisible === days && "bg-primary/10 text-primary")}
                >
                  {days} Day{days > 1 ? 's' : ''}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <span className="font-mono text-xs font-bold">{Math.round(zoomFactor * 100)}%</span>
                <ZoomIn className="h-4 w-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Time Zoom</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {VERTICAL_ZOOM_LEVELS.map((z) => (
                <DropdownMenuItem
                  key={z}
                  onClick={() => setCurrentVerticalZoomIndex(VERTICAL_ZOOM_LEVELS.indexOf(z))}
                  className={cn(zoomFactor === z && "bg-primary/10 text-primary")}
                >
                  {Math.round(z * 100)}%
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSavePreferences}
                disabled={isSessionLoading}
              >
                <Save className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Save preferences</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Grid */}
      <div ref={gridRef} className="flex-1 overflow-auto custom-scrollbar">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full py-20 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary/50" />
            <p className="text-sm text-muted-foreground">Loading your schedule...</p>
          </div>
        ) : (
          <div className="flex relative">
            {/* Time Axis */}
            <div
              className="w-10 sm:w-14 flex-shrink-0 border-r border-border/30 bg-background/90 backdrop-blur sticky left-0 z-10"
              style={{ minHeight: `${gridHeightPx + 64}px` }}
            >
              <div className="h-16 border-b border-border/30" />
              <div className="relative" style={{ height: `${gridHeightPx}px` }}>
                {/* Hourly labels */}
                {hourlyLabels.map(({ label, minutesFromMidnight }) => (
                  <div
                    key={label + minutesFromMidnight}
                    className="absolute right-2 text-[9px] font-mono text-muted-foreground/70"
                    style={{
                      top: `${minutesFromMidnight * BASE_MINUTE_HEIGHT_PX * zoomFactor}px`,
                      transform: 'translateY(-50%)',
                    }}
                  >
                    {label}
                  </div>
                ))}

                {/* 30-minute grid lines */}
                {Array.from({ length: 48 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'absolute left-0 right-0 border-t',
                      i % 2 === 0 ? 'border-border/20' : 'border-border/10'
                    )}
                    style={{ top: `${i * 30 * BASE_MINUTE_HEIGHT_PX * zoomFactor}px` }}
                  />
                ))}
              </div>
            </div>

            {/* Daily Columns */}
            <div className="flex">
              {renderedDays.map((day) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const isTodayCol = isToday(day);

                return (
                  <div
                    key={dateKey}
                    data-date={dateKey}
                    className={cn('flex-shrink-0', isTodayCol && 'bg-primary/5')}
                    style={{ width: columnWidth }}
                  >
                    <DailyScheduleColumn
                      dayDate={day}
                      tasks={weeklyTasks[dateKey] || []}
                      workdayStartTime={workdayStartTime}
                      workdayEndTime={workdayEndTime}
                      isDetailedView={isDetailedView}
                      T_current={T_current}
                      zoomLevel={zoomFactor}
                      columnWidth={columnWidth}
                      onCompleteTask={handleCompleteTask}
                      baseMinuteHeight={BASE_MINUTE_HEIGHT_PX}
                    />
                  </div>
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