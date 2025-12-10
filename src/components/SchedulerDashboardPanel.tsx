import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Zap, Clock, RotateCcw, RefreshCw } from 'lucide-react';
import { ScheduleSummary } from '@/types/scheduler';
import { formatTime } from '@/lib/scheduler-utils';
import { cn } from '@/lib/utils';

interface SchedulerDashboardPanelProps {
  scheduleSummary: ScheduleSummary | null;
  onAetherDump: () => void;
  isProcessingCommand: boolean;
  hasFlexibleTasks: boolean;
  onRefreshSchedule: () => void;
}

const SchedulerDashboardPanel: React.FC<SchedulerDashboardPanelProps> = ({
  scheduleSummary,
  onAetherDump,
  isProcessingCommand,
  hasFlexibleTasks,
  onRefreshSchedule,
}) => {
  if (!scheduleSummary) {
    return (
      <Card className="p-6 animate-pop-in bg-primary-wash rounded-lg animate-hover-lift shadow-lg">
        <div className="text-center text-muted-foreground">
          Loading schedule summary...
        </div>
      </Card>
    );
  }

  const totalScheduledMinutes = scheduleSummary.activeTime.hours * 60 + scheduleSummary.activeTime.minutes + scheduleSummary.breakTime;
  const activeTimeMinutes = scheduleSummary.activeTime.hours * 60 + scheduleSummary.activeTime.minutes;
  const totalActiveTimeHours = Math.floor(activeTimeMinutes / 60);
  const totalActiveTimeMins = activeTimeMinutes % 60;

  return (
    <Card className="p-6 animate-pop-in bg-primary-wash rounded-lg animate-hover-lift shadow-lg">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Active Time</h3>
          <p className="text-2xl font-extrabold font-mono text-primary">
            {scheduleSummary.activeTime.hours}h {scheduleSummary.activeTime.minutes}m
          </p>
          <p className="text-xs text-muted-foreground">
            {totalScheduledMinutes > 0 
              ? `${Math.round((activeTimeMinutes / totalScheduledMinutes) * 100)}% of total scheduled time`
              : 'No time scheduled yet'}
          </p>
        </div>
        
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Session End</h3>
          <CardContent className="p-0">
            <p className="text-2xl font-extrabold font-mono text-foreground">{formatTime(new Date(scheduleSummary.sessionEnd))}</p>
          </CardContent>
          <p className="text-xs text-muted-foreground">
            {scheduleSummary.endTime 
              ? `Last task ends at ${formatTime(new Date(scheduleSummary.endTime))}`
              : 'No tasks scheduled'}
          </p>
        </div>
        
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Actions</h3>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onAetherDump}
              disabled={isProcessingCommand}
              className="flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              <span className="hidden sm:inline">Aether Dump</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefreshSchedule}
              disabled={isProcessingCommand}
              className="flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default SchedulerDashboardPanel;