import React from 'react';
import { ListTodo, Zap, Coffee, Flag, ChevronsUp, RefreshCcw, Loader2, Trash2, ChevronUp, ChevronDown, RotateCcw, Clock, Hourglass } from 'lucide-react'; // Icons for the stat cards, added Hourglass
import { ScheduleSummary } from '@/types/scheduler'; // Imported ScheduleSummary
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface SchedulerDashboardPanelProps {
  summary: ScheduleSummary | null;
  isLoading: boolean;
  onCompactSchedule: () => Promise<void>;
  onRandomizeBreaks: () => Promise<void>;
  onAetherDump: () => Promise<void>;
  onAetherDumpMega: () => Promise<void>;
  onRefreshSchedule: () => void;
  isProcessingCommand: boolean;
}

const SchedulerDashboardPanel: React.FC<SchedulerDashboardPanelProps> = ({
  summary,
  isLoading,
  onCompactSchedule,
  onRandomizeBreaks,
  onAetherDump,
  onAetherDumpMega,
  onRefreshSchedule,
  isProcessingCommand,
}) => {
  if (isLoading) {
    return (
      <Card className="animate-pop-in animate-hover-lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <ListTodo className="h-5 w-5 text-muted-foreground" /> Schedule Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground">Loading schedule summary...</CardContent>
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card className="animate-pop-in animate-hover-lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <ListTodo className="h-5 w-5 text-muted-foreground" /> Schedule Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground">No schedule data available.</CardContent>
      </Card>
    );
  }

  return (
    <Card className="animate-pop-in animate-hover-lift">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-xl">
          <ListTodo className="h-5 w-5 text-primary" /> Schedule Overview
        </CardTitle>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onRefreshSchedule} disabled={isProcessingCommand}>
                <RefreshCcw className="h-4 w-4" />
                <span className="sr-only">Refresh Schedule</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh Schedule Data</TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <span>Active Time: {summary.activeTime.hours}h {summary.activeTime.minutes}m</span>
          </div>
          <div className="flex items-center gap-2">
            <Coffee className="h-4 w-4 text-logo-green" />
            <span>Break Time: {summary.breakTime} min</span>
          </div>
          <div className="flex items-center gap-2">
            <Hourglass className="h-4 w-4 text-muted-foreground" />
            <span>Free Time: {summary.freeTime.hours}h {summary.freeTime.minutes}m</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-logo-yellow" />
            <span>Energy Cost: {summary.totalEnergyCost}</span>
          </div>
          <div className="flex items-center gap-2 col-span-2">
            <Flag className="h-4 w-4 text-red-500" />
            <span>Critical Tasks Remaining: {summary.criticalTasksRemaining}</span>
          </div>
        </div>

        {summary.extendsPastMidnight && (
          <p className="text-orange-500 font-semibold text-sm">⚠️ {summary.midnightRolloverMessage}</p>
        )}

        <div className="flex flex-wrap gap-2 mt-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onCompactSchedule}
                disabled={isProcessingCommand}
                className="flex items-center gap-1"
              >
                <ChevronsUp className="h-4 w-4" /> Compact
              </Button>
            </TooltipTrigger>
            <TooltipContent>Compact flexible tasks to fill gaps.</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onRandomizeBreaks}
                disabled={isProcessingCommand}
                className="flex items-center gap-1"
              >
                <RotateCcw className="h-4 w-4" /> Randomize Breaks
              </Button>
            </TooltipTrigger>
            <TooltipContent>Randomize placement of flexible breaks.</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onAetherDump}
                disabled={isProcessingCommand}
                className="flex items-center gap-1"
              >
                <Trash2 className="h-4 w-4" /> Aether Dump
              </Button>
            </TooltipTrigger>
            <TooltipContent>Move all flexible tasks to Aether Sink.</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onAetherDumpMega}
                disabled={isProcessingCommand}
                className="flex items-center gap-1"
              >
                <Trash2 className="h-4 w-4" /> Mega Dump
              </Button>
            </TooltipTrigger>
            <TooltipContent>Move ALL tasks (flexible & fixed) to Aether Sink.</TooltipContent>
          </Tooltip>
        </div>
      </CardContent>
    </Card>
  );
};

export default SchedulerDashboardPanel;