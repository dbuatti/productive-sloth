import React from 'react';
import { DBScheduledTask, SortBy } from '@/types/scheduler';
import { Button } from '@/components/ui/button';
import { 
  Zap, 
  Shuffle, 
  ArrowDownWideNarrow, 
  ArrowUpWideNarrow, 
  RotateCcw, 
  RefreshCw,
  Star,
  Globe,
  Coffee
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DURATION_BUCKETS } from '@/lib/constants';

export interface SchedulerUtilityBarProps {
  isProcessingCommand: boolean;
  hasFlexibleTasksOnCurrentDay: boolean;
  dbScheduledTasks: DBScheduledTask[];
  onRechargeEnergy: () => void;
  onRandomizeBreaks: () => void;
  onSortFlexibleTasks: (newSortBy: SortBy) => void;
  onOpenWorkdayWindowDialog: () => void;
  sortBy: SortBy;
  onCompactSchedule: () => void;
  onQuickScheduleBlock: (duration: number, sortPreference: 'longestFirst' | 'shortestFirst') => void;
  retiredTasksCount: number;
  onZoneFocus: () => void;
  onAetherDump: () => void;
  onRefreshSchedule: () => void;
  onAetherDumpMega: () => void;
}

const SchedulerUtilityBar: React.FC<SchedulerUtilityBarProps> = ({
  isProcessingCommand,
  hasFlexibleTasksOnCurrentDay,
  dbScheduledTasks,
  onRechargeEnergy,
  onRandomizeBreaks,
  onSortFlexibleTasks,
  onOpenWorkdayWindowDialog,
  sortBy,
  onCompactSchedule,
  onQuickScheduleBlock,
  retiredTasksCount,
  onZoneFocus,
  onAetherDump,
  onRefreshSchedule,
  onAetherDumpMega,
}) => {
  const flexibleTasks = dbScheduledTasks.filter(task => task.is_flexible && !task.is_locked);
  
  return (
    <div className="bg-card border rounded-lg p-4 space-y-4 animate-pop-in">
      <div className="flex flex-wrap items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefreshSchedule}
              disabled={isProcessingCommand}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Refresh Schedule</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={onRechargeEnergy}
              disabled={isProcessingCommand}
            >
              <Coffee className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Recharge Energy</p>
          </TooltipContent>
        </Tooltip>

        <div className="h-5 w-px bg-border mx-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={onCompactSchedule}
              disabled={isProcessingCommand || !hasFlexibleTasksOnCurrentDay}
            >
              <Shuffle className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Compact Schedule</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={onRandomizeBreaks}
              disabled={isProcessingCommand || !hasFlexibleTasksOnCurrentDay}
            >
              <Shuffle className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Randomize Breaks</p>
          </TooltipContent>
        </Tooltip>

        <div className="h-5 w-px bg-border mx-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSortFlexibleTasks('PRIORITY_HIGH_TO_LOW')}
              disabled={isProcessingCommand || !hasFlexibleTasksOnCurrentDay}
            >
              <ArrowUpWideNarrow className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Sort by Priority (High to Low)</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSortFlexibleTasks('TIME_EARLIEST_TO_LATEST')}
              disabled={isProcessingCommand || !hasFlexibleTasksOnCurrentDay}
            >
              <ArrowDownWideNarrow className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Sort by Time (Earliest First)</p>
          </TooltipContent>
        </Tooltip>

        <div className="h-5 w-px bg-border mx-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={onZoneFocus}
              disabled={isProcessingCommand}
            >
              <Star className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Zone Focus</p>
          </TooltipContent>
        </Tooltip>

        <div className="h-5 w-px bg-border mx-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={onAetherDump}
              disabled={isProcessingCommand}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Aether Dump</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={onAetherDumpMega}
              disabled={isProcessingCommand}
            >
              <Zap className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Aether Dump Mega</p>
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Quick Schedule:</span>
        {DURATION_BUCKETS.map((duration) => (
          <Button
            key={duration}
            variant="outline"
            size="sm"
            onClick={() => onQuickScheduleBlock(duration, 'shortestFirst')}
            disabled={isProcessingCommand}
            className="text-xs"
          >
            {duration}m
          </Button>
        ))}
      </div>
    </div>
  );
};

export default SchedulerUtilityBar;