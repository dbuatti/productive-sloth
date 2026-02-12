"use client";

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ListTodo, Zap, Coffee, Clock } from 'lucide-react';
import { ScheduleSummary } from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/scheduler-utils';
import { Skeleton } from '@/components/ui/skeleton';

interface SchedulerDashboardPanelProps {
  scheduleSummary: ScheduleSummary | null;
  isLoading: boolean;
}

const SchedulerDashboardPanel: React.FC<SchedulerDashboardPanelProps> = React.memo(({
  scheduleSummary,
  isLoading,
}) => {
  if (isLoading || !scheduleSummary || scheduleSummary.totalTasks === 0) {
    return (
      <div className="flex gap-4 py-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-20" />
      </div>
    );
  }

  const Stat = ({ icon: Icon, label, value, color }: any) => (
    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/50 border border-transparent transition-colors hover:border-border">
      <Icon className={cn("h-3.5 w-3.5", color)} />
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <span className="text-[11px] font-bold">{value}</span>
    </div>
  );

  return (
    <div className="flex flex-wrap gap-2 animate-pop-in">
      <Stat icon={ListTodo} label="Tasks" value={scheduleSummary.totalTasks} color="text-primary" />
      <Stat icon={Zap} label="Work" value={`${scheduleSummary.activeTime.hours}h ${scheduleSummary.activeTime.minutes}m`} color="text-primary" />
      <Stat icon={Coffee} label="Rest" value={`${scheduleSummary.breakTime}m`} color="text-logo-orange" />
      <Stat icon={Clock} label="Ends" value={formatTime(scheduleSummary.sessionEnd)} color="text-muted-foreground" />
    </div>
  );
});

SchedulerDashboardPanel.displayName = 'SchedulerDashboardPanel';
export default SchedulerDashboardPanel;