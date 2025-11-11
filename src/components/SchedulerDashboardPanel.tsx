import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ListTodo, Zap, Coffee, Flag } from 'lucide-react'; // Icons for the stat cards
import { ScheduleSummary } from '@/types/scheduler'; // Corrected import for ScheduleSummary
import { cn } from '@/lib/utils';

interface SchedulerDashboardPanelProps {
  scheduleSummary: ScheduleSummary | null;
}

const SchedulerDashboardPanel: React.FC<SchedulerDashboardPanelProps> = ({ scheduleSummary }) => {
  if (!scheduleSummary) {
    return (
      <Card className="animate-pop-in animate-hover-lift">
        <CardHeader>
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-primary" /> Daily Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground">
          Loading schedule summary...
        </CardContent>
      </Card>
    );
  }

  const {
    totalScheduledDuration,
    totalBreakDuration,
    totalFreeTime,
    unscheduledCount,
    workdayStart,
    workdayEnd,
  } = scheduleSummary;

  const totalWorkdayDuration = (workdayEnd.getTime() - workdayStart.getTime()) / (1000 * 60);
  const totalAllocatedTime = totalScheduledDuration + totalBreakDuration;
  const percentageAllocated = totalWorkdayDuration > 0 ? (totalAllocatedTime / totalWorkdayDuration) * 100 : 0;

  return (
    <Card className="animate-pop-in animate-hover-lift">
      <CardHeader>
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <ListTodo className="h-5 w-5 text-primary" /> Daily Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="flex flex-col items-center justify-center p-3 bg-secondary/50 rounded-lg">
          <span className="text-2xl font-bold text-primary">{totalScheduledDuration} min</span>
          <span className="text-sm text-muted-foreground">Scheduled Tasks</span>
        </div>
        <div className="flex flex-col items-center justify-center p-3 bg-secondary/50 rounded-lg">
          <span className="text-2xl font-bold text-green-500">{totalFreeTime} min</span>
          <span className="text-sm text-muted-foreground">Free Time</span>
        </div>
        <div className="flex flex-col items-center justify-center p-3 bg-secondary/50 rounded-lg">
          <span className="text-2xl font-bold text-orange-500">{totalBreakDuration} min</span>
          <span className="text-sm text-muted-foreground">Breaks</span>
        </div>
        <div className="flex flex-col items-center justify-center p-3 bg-secondary/50 rounded-lg">
          <span className={cn("text-2xl font-bold", unscheduledCount > 0 ? "text-destructive" : "text-green-500")}>
            {unscheduledCount}
          </span>
          <span className="text-sm text-muted-foreground">Unscheduled</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default SchedulerDashboardPanel;