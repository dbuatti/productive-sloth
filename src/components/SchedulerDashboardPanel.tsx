"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ListTodo, Zap, Coffee, Flag, ChevronsUp, RefreshCcw, Loader2, Trash2, ChevronUp, ChevronDown, RotateCcw, Clock, Hourglass, AlertTriangle } from 'lucide-react'; // Icons for the stat cards, added Hourglass and AlertTriangle
import { ScheduleSummary } from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/scheduler-utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSession } from '@/hooks/use-session';
import { Skeleton } from '@/components/ui/skeleton'; // NEW: Import Skeleton

interface SchedulerDashboardPanelProps {
  scheduleSummary: ScheduleSummary | null;
  onAetherDump: () => void;
  isProcessingCommand: boolean;
  hasFlexibleTasks: boolean;
  onRefreshSchedule: () => void;
  isLoading: boolean; // NEW: Add isLoading prop
}

const SchedulerDashboardPanel: React.FC<SchedulerDashboardPanelProps> = React.memo(({ scheduleSummary, onAetherDump, isProcessingCommand, hasFlexibleTasks, onRefreshSchedule, isLoading }) => {
  const { profile, updateProfile } = useSession();
  const isCollapsed = profile?.is_dashboard_collapsed ?? false;

  const handleToggleCollapse = async () => {
    if (profile) {
      await updateProfile({ is_dashboard_collapsed: !isCollapsed });
    }
  };

  if (isLoading || !scheduleSummary || scheduleSummary.totalTasks === 0) {
    return (
      <Card className="w-full p-4 space-y-4 rounded-xl shadow-sm animate-pop-in">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </CardHeader>
        {!isCollapsed && (
          <CardContent className="py-4 space-y-4">
            <Skeleton className="h-2 w-full" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center justify-center p-4 bg-card/50 border border-primary/20 rounded-xl shadow-sm space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>
    );
  }

  const totalScheduledMinutes = scheduleSummary.activeTime.hours * 60 + scheduleSummary.activeTime.minutes + scheduleSummary.breakTime;
  const activeTimeMinutes = scheduleSummary.activeTime.hours * 60 + scheduleSummary.activeTime.minutes;

  const activeTimePercentage = totalScheduledMinutes > 0 ? (activeTimeMinutes / totalScheduledMinutes) * 100 : 0;
  const breakTimePercentage = totalScheduledMinutes > 0 ? (scheduleSummary.breakTime / totalScheduledMinutes) * 100 : 0;

  return (
    <div className="w-full space-y-4">
      {/* ALERT FOR UNSCHEDULED TASKS */}
      {scheduleSummary.unscheduledCount > 0 && (
        <Card className="p-3 flex items-center justify-between rounded-xl border border-destructive/50 bg-destructive/5 animate-pulse">
            <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <p className="text-sm font-bold text-destructive">
                    Temporal Drift Detected: {scheduleSummary.unscheduledCount} tasks have no assigned time slots.
                </p>
            </div>
            <Button 
                variant="outline" 
                size="sm" 
                className="h-7 text-[10px] font-black uppercase tracking-widest border-destructive/20 hover:bg-destructive/10"
                onClick={onRefreshSchedule}
                aria-label="Recalibrate Timeline"
            >
                Recalibrate Timeline
            </Button>
        </Card>
      )}

      <Card className="p-4 rounded-xl shadow-sm animate-pop-in animate-hover-lift">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl font-bold text-foreground flex items-center gap-2">
            <ListTodo className="h-6 w-6 text-primary" /> Session Dashboard
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Collapse Metrics Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleToggleCollapse}
                  className="h-8 w-8 text-muted-foreground hover:bg-secondary/50"
                  aria-label={isCollapsed ? "Expand Dashboard Metrics" : "Collapse Dashboard Metrics"}
                >
                  {isCollapsed ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
                  <span className="sr-only">{isCollapsed ? "Expand Metrics" : "Collapse Metrics"}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isCollapsed ? "Expand Metrics" : "Collapse Metrics"}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>

        {!isCollapsed && (
          <CardContent className="py-4 space-y-4">
            {/* Session Pacing Bar */}
            {totalScheduledMinutes > 0 && (
              <div className="relative h-2 w-full rounded-full bg-secondary overflow-hidden shadow-inner">
                <div 
                  className="absolute left-0 top-0 h-full bg-primary transition-all duration-500 ease-out" 
                  style={{ width: `${activeTimePercentage}%` }}
                ></div>
                <div 
                  className="absolute top-0 h-full bg-logo-orange transition-all duration-500 ease-out" 
                  style={{ left: `${activeTimePercentage}%`, width: `${breakTimePercentage}%` }}
                ></div>
              </div>
            )}

            {/* Stat Cards - Refactored to 4 columns */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Tasks */}
              <Card className="flex flex-col items-center justify-center p-4 bg-card/50 border border-primary/20 rounded-xl shadow-sm hover:shadow-lg transition-all duration-200 animate-pop-in animate-hover-lift">
                <CardHeader className="pb-2 text-center p-0">
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <ListTodo className="h-4 w-4 text-primary" /> Tasks
                  </p>
                </CardHeader>
                <CardContent className="p-0">
                  <p className="text-2xl font-extrabold font-mono text-foreground">{scheduleSummary.totalTasks}</p>
                </CardContent>
              </Card>

              {/* Active Time */}
              <Card className="flex flex-col items-center justify-center p-4 bg-card/50 border border-primary/20 rounded-xl shadow-sm hover:shadow-lg transition-all duration-200 animate-pop-in animate-hover-lift" style={{ animationDelay: '0.1s' }}>
                <CardHeader className="pb-2 text-center p-0">
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Zap className="h-4 w-4 text-primary" /> Active Time
                  </p>
                </CardHeader>
                <CardContent className="p-0">
                  <p className="text-2xl font-extrabold font-mono text-primary">
                    {scheduleSummary.activeTime.hours}h {scheduleSummary.activeTime.minutes}m
                  </p>
                </CardContent>
              </Card>

              {/* Break Time */}
              <Card className="flex flex-col items-center justify-center p-4 bg-card/50 border border-primary/20 rounded-xl shadow-sm hover:shadow-lg transition-all duration-200 animate-pop-in animate-hover-lift" style={{ animationDelay: '0.2s' }}>
                <CardHeader className="pb-2 text-center p-0">
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Coffee className="h-4 w-4 text-logo-orange" /> Break Time
                  </p>
                </CardHeader>
                <CardContent className="p-0">
                  <p className="text-2xl font-extrabold font-mono text-logo-orange">{scheduleSummary.breakTime} min</p>
                </CardContent>
              </Card>

              {/* Session End */}
              <Card className="flex flex-col items-center justify-center p-4 bg-card/50 border border-primary/20 rounded-xl shadow-sm hover:shadow-lg transition-all duration-200 animate-pop-in animate-hover-lift" style={{ animationDelay: '0.3s' }}>
                <CardHeader className="pb-2 text-center p-0">
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Flag className="h-4 w-4 text-foreground" /> Session End
                  </p>
                </CardHeader>
                <CardContent className="p-0">
                  <p className="text-2xl font-extrabold font-mono text-foreground">{formatTime(scheduleSummary.sessionEnd)}</p>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
});

export default SchedulerDashboardPanel;