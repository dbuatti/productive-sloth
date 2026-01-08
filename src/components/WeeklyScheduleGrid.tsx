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
import { Skeleton } from '@/components/ui/skeleton';

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

const MINUTE_HEIGHT_PX = 1.5; // Base pixels per minute
const VERTICAL_ZOOM_LEVELS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5];
const VISIBLE_DAYS_OPTIONS = [1, 3, 5, 7, 14, 21];
const MIN_COLUMN_WIDTH = 120; // Slightly increased for clarity
const FULL_DAY_MINUTES = 1440; // Always base height on full 24h for consistency

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

  // Resize observer for responsive column width
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

  // All days in fetch window (for rendering columns)
  const visibleDays = useMemo(() => {
    const days: Date[] = [];
    let cur = startOfDay(fetchWindowStart);
    while (cur <= fetchWindowEnd) {
      days.push(cur);
      cur = addDays(cur, 1);
    }
    return days;
  }, [fetchWindowStart, fetchWindowEnd]);

  // Find index of current visible period start in rendered days
  const targetDayIndex = useMemo(() => {
    return visibleDays.findIndex((d) => format(d, 'yyyy-MM-dd') === currentPeriodStartString);
  }, [visibleDays, currentPeriodStartString]);

  // Auto-scroll to visible period (smooth, reliable)
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

  const savePreferences = async () => {
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

  // Time axis configuration
  const workdayStartDate = setTimeOnDate(currentPeriodStart, workdayStartTime);
  const workdayEndDate = setTimeOnDate(currentPeriodStart, workdayEndTime);
  const effectiveEnd = workdayEndDate < workdayStartDate ? addDays(workdayEndDate, 1) : workdayEndDate;

  const hourlyLabels = useMemo(() => {
    const labels: { label: string; offsetMinutes: number }[] = [];
    let cur = workdayStartDate;
    while (cur < effectiveEnd) {
      labels.push({
        label: format(cur, 'h a'),
        offsetMinutes: differenceInMinutes(cur, startOfDay(currentPeriodStart)),
      });
      cur = addHours(cur, 1);
    }
    return labels;
  }, [workdayStartDate, effectiveEnd, currentPeriodStart]);

  const gridHeight = FULL_DAY_MINUTES * MINUTE_HEIGHT_PX * zoomFactor;

  return (
    <div className="flex flex-col h-full w-full">
      {/* Controls - unchanged but cleaned */}
      <div className="flex items-center justify-between py-2 px-3 border-b border-border/40 bg-background/95 backdrop-blur sticky top-0 z-20">
        {/* ... (controls remain similar, omitted for brevity - keep your existing UI) ... */}
        {/* Save button, zoom, days dropdowns, prev/next, today, detailed toggle */}
      </div>

      <div
        ref={gridRef}
        className="flex-1 overflow-auto custom-scrollbar"
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full py-20">
            <Loader2 className="h-10 w-10 animate-spin text-primary/50" />
            <p className="ml-3 text-sm text-muted-foreground">Loading schedule...</p>
          </div>
        ) : (
          <div className="flex relative">
            {/* Time Axis - improved with grid lines */}
            <div
              className="w-10 sm:w-14 flex-shrink-0 border-r border-border/30 bg-background/90 backdrop-blur sticky left-0 z-10"
              style={{ height: `${gridHeight + 60}px` }}
            >
              <div className="h-16 border-b border-border/30" /> {/* Header spacer */}
              <div className="relative" style={{ height: `${gridHeight}px` }}>
                {/* Hourly labels */}
                {hourlyLabels.map(({ label, offsetMinutes }) => (
                  <div
                    key={label + offsetMinutes}
                    className="absolute right-1 sm:right-2 text-[9px] font-mono text-muted-foreground/70"
                    style={{ top: `${offsetMinutes * MINUTE_HEIGHT_PX * zoomFactor}px`, transform: 'translateY(-50%)' }}
                  >
                    {label}
                  </div>
                ))}

                {/* Subtle grid lines every 30 min */}
                {Array.from({ length: 48 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'absolute w-full border-t border-border/10',
                      i % 2 === 0 && 'border-border/20' // bolder every hour
                    )}
                    style={{ top: `${(i * 30) * MINUTE_HEIGHT_PX * zoomFactor}px` }}
                  />
                ))}
              </div>
            </div>

            {/* Columns */}
            <div className="flex">
              {visibleDays.map((day) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const isTodayCol = isToday(day);
                return (
                  <div
                    key={dateKey}
                    data-date={dateKey}
                    className={cn(isTodayCol && 'bg-primary/5')}
                    style={{ minWidth: columnWidth }}
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
                      baseMinuteHeight={MINUTE_HEIGHT_PX}
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