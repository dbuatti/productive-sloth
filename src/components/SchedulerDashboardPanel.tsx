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
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="w-full space-y-4">
      {scheduleSummary.unscheduledCount > 0 && (
        <Card className="p-3 flex items-center justify-between rounded-xl border border-destructive/50 bg-destructive/5 animate-pulse">
            <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <p className="text-sm font-bold text-destructive">Timeline Drift: {scheduleSummary.unscheduledCount} objectives lack slots.</p>
            </div>
            <Button variant="outline" size="sm" className="h-7 text-[10px] font-black uppercase tracking-widest border-destructive/20" onClick={onRefreshSchedule}>Recalibrate</Button>
        </Card>
      )}

      <Card className="p-4 rounded-xl shadow-sm border-white/5 bg-card/60 backdrop-blur-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-0">
          <CardTitle className="text-lg font-black uppercase tracking-tighter text-foreground/70 flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-primary" /> Session HUD
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={handleToggleCollapse} className="h-8 w-8 text-muted-foreground">
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

            {balanceStats.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 flex items-center gap-2">
                    <Layers className="h-3 w-3 text-primary" /> Spatial Distribution
                  </span>
                </div>
                <div className="relative h-2 w-full rounded-full bg-secondary overflow-hidden flex shadow-inner">
                  {balanceStats.map((s, i) => (
                    <div key={i} className="h-full transition-all duration-1000" style={{ width: `${s.percentage}%`, backgroundColor: s.color }} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {balanceStats.map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="text-[9px] font-bold uppercase tracking-tight text-foreground/70">{s.label}</span>
                      <span className="text-[9px] font-mono text-muted-foreground">{Math.round(s.percentage)}% <span className="opacity-30">/ {s.target}%</span></span>
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