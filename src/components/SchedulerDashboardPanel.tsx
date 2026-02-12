"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ListTodo, Zap, Coffee, Flag, ChevronUp, ChevronDown, AlertTriangle, Layers } from 'lucide-react';
import { ScheduleSummary, ScheduledItem } from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/scheduler-utils';
import { Button } from '@/components/ui/button';
import { useSession } from '@/hooks/use-session';
import { Skeleton } from '@/components/ui/skeleton';
import { useEnvironments } from '@/hooks/use-environments';

interface SchedulerDashboardPanelProps {
  scheduleSummary: ScheduleSummary | null;
  onAetherDump: () => void;
  isProcessingCommand: boolean;
  hasFlexibleTasks: boolean;
  onRefreshSchedule: () => void;
  isLoading: boolean;
  items?: ScheduledItem[]; 
}

const SchedulerDashboardPanel: React.FC<SchedulerDashboardPanelProps> = React.memo(({
  scheduleSummary,
  onRefreshSchedule,
  isLoading,
  items = []
}) => {
  const { profile, updateProfile } = useSession();
  const { environments } = useEnvironments();
  const isCollapsed = profile?.is_dashboard_collapsed ?? false;

  const handleToggleCollapse = async () => {
    if (profile) {
      await updateProfile({ is_dashboard_collapsed: !isCollapsed });
    }
  };

  const balanceStats = useMemo(() => {
    if (items.length === 0) return [];
    const taskItems = items.filter(i => i.type === 'task' && !i.isBreak);
    const totalTaskMinutes = taskItems.reduce((s, i) => s + i.duration, 0);
    if (totalTaskMinutes === 0) return [];
    const usageByEnv = new Map<string, number>();
    taskItems.forEach(i => {
      const env = i.taskEnvironment || 'laptop';
      usageByEnv.set(env, (usageByEnv.get(env) || 0) + i.duration);
    });
    return Array.from(usageByEnv.entries()).map(([envKey, minutes]) => {
      const env = environments.find(e => e.value === envKey);
      return {
        label: env?.label || envKey,
        color: env?.color || 'hsl(var(--primary))',
        percentage: (minutes / totalTaskMinutes) * 100,
        target: env?.target_weight || 0
      };
    }).sort((a, b) => b.percentage - a.percentage);
  }, [items, environments]);

  if (isLoading || !scheduleSummary || scheduleSummary.totalTasks === 0) {
    return (
      <Card className="w-full p-4 rounded-xl shadow-sm animate-pop-in">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-6 w-6 rounded-full" />
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="w-full space-y-4">
      {scheduleSummary.unscheduledCount > 0 && (
        <Card className="p-3 flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5">
            <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <p className="text-sm font-medium text-destructive">{scheduleSummary.unscheduledCount} tasks could not be scheduled.</p>
            </div>
            <Button variant="outline" size="sm" className="h-7 text-[10px] font-bold uppercase border-destructive/20" onClick={onRefreshSchedule}>Refresh</Button>
        </Card>
      )}

      <Card className="p-4 rounded-xl shadow-sm border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-0">
          <CardTitle className="text-base font-bold text-foreground/80 flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-primary" /> Daily Overview
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={handleToggleCollapse} className="h-7 w-7 text-muted-foreground">
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </CardHeader>

        {!isCollapsed && (
          <CardContent className="py-4 space-y-6 p-0">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { icon: ListTodo, label: "Tasks", val: scheduleSummary.totalTasks, color: "text-primary" },
                { icon: Zap, label: "Active", val: `${scheduleSummary.activeTime.hours}h ${scheduleSummary.activeTime.minutes}m`, color: "text-primary" },
                { icon: Coffee, label: "Rest", val: `${scheduleSummary.breakTime}m`, color: "text-logo-orange" },
                { icon: Flag, label: "End Time", val: formatTime(scheduleSummary.sessionEnd), color: "text-foreground" }
              ].map((stat, i) => (
                <div key={i} className="flex flex-col items-center justify-center p-3 bg-muted/30 rounded-lg border border-border/50">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1 flex items-center gap-1">
                    <stat.icon className={cn("h-3 w-3", stat.color)} /> {stat.label}
                  </span>
                  <p className="text-lg font-bold font-mono">{stat.val}</p>
                </div>
              ))}
            </div>

            {balanceStats.length > 0 && (
              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 flex items-center gap-2">
                    <Layers className="h-3 w-3 text-primary" /> Workspace Balance
                  </span>
                </div>
                <div className="relative h-1.5 w-full rounded-full bg-muted overflow-hidden flex">
                  {balanceStats.map((s, i) => (
                    <div key={i} className="h-full transition-all duration-500" style={{ width: `${s.percentage}%`, backgroundColor: s.color }} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {balanceStats.map((s, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="text-[10px] font-medium text-foreground/70">{s.label}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">{Math.round(s.percentage)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
});

SchedulerDashboardPanel.displayName = 'SchedulerDashboardPanel';
export default SchedulerDashboardPanel;