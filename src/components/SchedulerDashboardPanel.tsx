"use client";

import React, { useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ListTodo, Zap, Coffee, Flag, ChevronUp, ChevronDown, AlertTriangle } from 'lucide-react';
import { ScheduleSummary } from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/scheduler-utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSession } from '@/hooks/use-session';
import { Skeleton } from '@/components/ui/skeleton';

interface SchedulerDashboardPanelProps {
  scheduleSummary: ScheduleSummary | null;
  onAetherDump: () => void;
  isProcessingCommand: boolean;
  hasFlexibleTasks: boolean;
  onRefreshSchedule: () => void;
  isLoading: boolean;
}

// Aggressive memoization for the component itself
const SchedulerDashboardPanel: React.FC<SchedulerDashboardPanelProps> = React.memo(({
  scheduleSummary,
  onAetherDump,
  isProcessingCommand,
  hasFlexibleTasks,
  onRefreshSchedule,
  isLoading
}) => {
  const { profile, updateProfile } = useSession();
  const isCollapsed = profile?.is_dashboard_collapsed ?? false;

  // Stability logging: Only log if there's an actual state change we care about
  const prevIsLoading = useRef(isLoading);
  useEffect(() => {
    if (prevIsLoading.current !== isLoading) {
      console.log(`[SchedulerDashboardPanel] Loading state changed: ${isLoading}`);
      prevIsLoading.current = isLoading;
    }
  });

  const handleToggleCollapse = async () => {
    if (profile) {
      await updateProfile({ is_dashboard_collapsed: !isCollapsed });
    }
  };

  const stats = useMemo(() => {
    if (!scheduleSummary || scheduleSummary.totalTasks === 0) return null;
    
    const activeMinutes = scheduleSummary.activeTime.hours * 60 + scheduleSummary.activeTime.minutes;
    const totalScheduled = activeMinutes + scheduleSummary.breakTime;

    return {
      activeTimePercentage: totalScheduled > 0 ? (activeMinutes / totalScheduled) * 100 : 0,
      breakTimePercentage: totalScheduled > 0 ? (scheduleSummary.breakTime / totalScheduled) * 100 : 0,
    };
  }, [
    scheduleSummary?.totalTasks, 
    scheduleSummary?.activeTime.hours, 
    scheduleSummary?.activeTime.minutes, 
    scheduleSummary?.breakTime
  ]);

  if (isLoading || !scheduleSummary || scheduleSummary.totalTasks === 0) {
    return (
      <Card className="w-full p-4 rounded-xl shadow-sm animate-pop-in">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </CardHeader>
        {!isCollapsed && (
          <CardContent className="py-4 space-y-4">
            <Skeleton className="h-2 w-full" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 bg-secondary/20 rounded-xl animate-pulse" />
              ))}
            </div>
          </CardContent>
        )}
      </Card>
    );
  }

  return (
    <div className="w-full space-y-4">
      {scheduleSummary.unscheduledCount > 0 && (
        <Card className="p-3 flex items-center justify-between rounded-xl border border-destructive/50 bg-destructive/5 animate-pulse">
            <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <p className="text-sm font-bold text-destructive">
                    Timeline Drift: {scheduleSummary.unscheduledCount} objectives lack slots.
                </p>
            </div>
            <Button 
                variant="outline" 
                size="sm" 
                className="h-7 text-[10px] font-black uppercase tracking-widest border-destructive/20"
                onClick={onRefreshSchedule}
            >
                Recalibrate
            </Button>
        </Card>
      )}

      <Card className="p-4 rounded-xl shadow-sm border-white/5 bg-card/60 backdrop-blur-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-black uppercase tracking-tighter text-foreground/70 flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-primary" /> Session HUD
          </CardTitle>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleToggleCollapse} 
            className="h-8 w-8 text-muted-foreground"
          >
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </CardHeader>

        {!isCollapsed && stats && (
          <CardContent className="py-4 space-y-4">
            <div className="relative h-1.5 w-full rounded-full bg-secondary overflow-hidden">
              <div className="absolute left-0 top-0 h-full bg-primary transition-all duration-700" style={{ width: `${stats.activeTimePercentage}%` }} />
              <div className="absolute top-0 h-full bg-logo-orange transition-all duration-700" style={{ left: `${stats.activeTimePercentage}%`, width: `${stats.breakTimePercentage}%` }} />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { icon: ListTodo, label: "Tasks", val: scheduleSummary.totalTasks, color: "text-primary" },
                { icon: Zap, label: "Active", val: `${scheduleSummary.activeTime.hours}h ${scheduleSummary.activeTime.minutes}m`, color: "text-primary" },
                { icon: Coffee, label: "Rest", val: `${scheduleSummary.breakTime}m`, color: "text-logo-orange" },
                { icon: Flag, label: "Sync End", val: formatTime(scheduleSummary.sessionEnd), color: "text-foreground" }
              ].map((stat, i) => (
                <div key={i} className="flex flex-col items-center justify-center p-3 bg-secondary/20 rounded-xl border border-white/5">
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1 flex items-center gap-1">
                    <stat.icon className={cn("h-2.5 w-2.5", stat.color)} /> {stat.label}
                  </span>
                  <p className="text-lg font-black font-mono tracking-tighter">{stat.val}</p>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
});

SchedulerDashboardPanel.displayName = 'SchedulerDashboardPanel';

export default SchedulerDashboardPanel;