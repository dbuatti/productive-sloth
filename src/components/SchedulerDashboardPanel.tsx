import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ListTodo, Zap, Coffee, Flag, Clock, CalendarCheck } from 'lucide-react'; // Icons for the stat cards
import { ScheduleSummary } from '@/types/scheduler'; // Corrected import for ScheduleSummary
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/scheduler-utils'; // Import formatTime

interface SchedulerDashboardPanelProps {
  scheduleSummary: ScheduleSummary | null;
}

const SchedulerDashboardPanel: React.FC<SchedulerDashboardPanelProps> = React.memo(({ scheduleSummary }) => {
  if (!scheduleSummary || scheduleSummary.totalTasks === 0) {
    return null; // Don't render if no schedule or no tasks
  }

  const totalScheduledMinutes = scheduleSummary.activeTime.hours * 60 + scheduleSummary.activeTime.minutes + scheduleSummary.breakTime;
  const activeTimeMinutes = scheduleSummary.activeTime.hours * 60 + scheduleSummary.activeTime.minutes;
  
  const totalWorkdayDuration = (scheduleSummary.workdayEnd.getTime() - scheduleSummary.workdayStart.getTime()) / (1000 * 60);
  const activeTimePercentage = totalScheduledMinutes > 0 ? (activeTimeMinutes / totalScheduledMinutes) * 100 : 0;
  const breakTimePercentage = totalScheduledMinutes > 0 ? (scheduleSummary.breakTime / totalScheduledMinutes) * 100 : 0;

  return (
    <Card className="animate-pop-in animate-hover-lift">
      <CardHeader>
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <ListTodo className="h-5 w-5 text-primary" /> Daily Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="flex flex-col items-center justify-center p-3 bg-secondary/50 rounded-lg">
          <CardContent className="p-0">
            <p className="text-3xl font-extrabold font-mono text-foreground">{scheduleSummary.totalTasks}</p>
          </CardContent>
          <span className="text-sm text-muted-foreground">Total Tasks</span>
        </div>
        <div className="flex flex-col items-center justify-center p-3 bg-secondary/50 rounded-lg">
          <CardContent className="p-0">
            <p className="text-3xl font-extrabold font-mono text-primary">
              {scheduleSummary.activeTime.hours}h {scheduleSummary.activeTime.minutes}m
            </p>
          </CardContent>
          <span className="text-sm text-muted-foreground">Active Time</span>
        </div>
        <div className="flex flex-col items-center justify-center p-3 bg-secondary/50 rounded-lg">
          <CardContent className="p-0">
            <p className="text-3xl font-extrabold font-mono text-logo-orange">{scheduleSummary.breakTime} min</p>
          </CardContent>
          <span className="text-sm text-muted-foreground">Break Time</span>
        </div>
        <div className="flex flex-col items-center justify-center p-3 bg-secondary/50 rounded-lg">
          <CardContent className="p-0">
            <p className="text-3xl font-extrabold font-mono text-foreground">{formatTime(scheduleSummary.sessionEnd)}</p>
          </CardContent>
          <span className="text-sm text-muted-foreground">Session End</span>
        </div>
      </CardContent>
    </Card>
  );
});

export default SchedulerDashboardPanel;