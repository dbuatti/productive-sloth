"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ListTodo, Zap, Coffee, Flag, ChevronsUp, RefreshCcw, Loader2, Trash2, ChevronUp, ChevronDown, RotateCcw, Clock, Hourglass, AlertTriangle } from 'lucide-react'; // Icons for the stat cards, added Hourglass and AlertTriangle
import { ScheduleSummary } from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/scheduler-utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSession } from '@/hooks/use-session'; // NEW: Import useSession

interface SchedulerDashboardPanelProps {
  scheduleSummary: ScheduleSummary | null;
  onAetherDump: () => void;
  isProcessingCommand: boolean;
  hasFlexibleTasks: boolean;
  onRefreshSchedule: () => void; // NEW: Handler for refresh
}

const SchedulerDashboardPanel: React.FC<SchedulerDashboardPanelProps> = React.memo(({ scheduleSummary, onAetherDump, isProcessingCommand, hasFlexibleTasks, onRefreshSchedule }) => {
  const { profile, updateProfile } = useSession(); // NEW: Get profile and updateProfile
  const isCollapsed = profile?.is_dashboard_collapsed ?? false; // NEW: Read from profile

  const handleToggleCollapse = async () => {
    if (profile) {
      await updateProfile({ is_dashboard_collapsed: !isCollapsed }); // NEW: Persist to profile
    }
  };

  if (!scheduleSummary || scheduleSummary.totalTasks === 0) {
    return null;
  }

  const totalScheduledMinutes = scheduleSummary.activeTime.hours * 60 + scheduleSummary.activeTime.minutes + scheduleSummary.breakTime;
  const activeTimeMinutes = scheduleSummary.activeTime.hours * 60 + scheduleSummary.activeTime.minutes;

  const activeTimePercentage = totalScheduledMinutes > 0 ? (activeTimeMinutes / totalScheduledMinutes) * 100 : 0;
  const breakTimePercentage = totalScheduledMinutes > 0 ? (scheduleSummary.breakTime / totalScheduledMinutes) * 100 : 0;

  return (
    <div className="w-full space-y-4"> {/* Removed Card, added space-y-4 */}
      {/* ALERT FOR UNSCHEDULED TASKS */}
      {scheduleSummary.unscheduledCount > 0 && (
        <div className="p-3 flex items-center justify-between rounded-xl border border-destructive/50 bg-destructive/5 animate-pulse"> {/* Replaced Card with div */}
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
            >
                Recalibrate Timeline
            </Button>
        </div>
      )}

      <div className="p-4 bg-card rounded-xl shadow-sm animate-pop-in animate-hover-lift"> {/* Replaced Card with div, adjusted padding/styling */}
        <div className="flex flex-row items-center justify-between space-y-0 pb-2"> {/* Replaced CardHeader with div */}
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2"> {/* Replaced CardTitle with h2 */}
            <ListTodo className="h-6 w-6 text-primary" /> Session Dashboard
          </h2>
          <div className="flex items-center gap-2">
            {/* Collapse Metrics Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleToggleCollapse} // NEW: Use new handler
                  className="h-8 w-8 text-muted-foreground hover:bg-secondary/50"
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
        </div>

        {!isCollapsed && ( // Conditionally render content
          <div className="py-4 space-y-4"> {/* Replaced CardContent with div, adjusted padding */}
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
              <div className="flex flex-col items-center justify-center p-4 bg-card/50 border border-primary/20 rounded-xl shadow-sm hover:shadow-lg transition-all duration-200 animate-pop-in animate-hover-lift"> {/* Replaced Card with div */}
                <div className="pb-2 text-center"> {/* Replaced CardHeader with div */}
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-1"> {/* Replaced CardTitle with p */}
                    <ListTodo className="h-4 w-4 text-primary" /> Tasks
                  </p>
                </div>
                <div className="p-0"> {/* Replaced CardContent with div */}
                  <p className="text-2xl font-extrabold font-mono text-foreground">{scheduleSummary.totalTasks}</p>
                </div>
              </div>

              {/* Active Time */}
              <div className="flex flex-col items-center justify-center p-4 bg-card/50 border border-primary/20 rounded-xl shadow-sm hover:shadow-lg transition-all duration-200 animate-pop-in animate-hover-lift" style={{ animationDelay: '0.1s' }}> {/* Replaced Card with div */}
                <div className="pb-2 text-center"> {/* Replaced CardHeader with div */}
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-1"> {/* Replaced CardTitle with p */}
                    <Zap className="h-4 w-4 text-primary" /> Active Time
                  </p>
                </div>
                <div className="p-0"> {/* Replaced CardContent with div */}
                  <p className="text-2xl font-extrabold font-mono text-primary">
                    {scheduleSummary.activeTime.hours}h {scheduleSummary.activeTime.minutes}m
                  </p>
                </div>
              </div>

              {/* Break Time */}
              <div className="flex flex-col items-center justify-center p-4 bg-card/50 border border-primary/20 rounded-xl shadow-sm hover:shadow-lg transition-all duration-200 animate-pop-in animate-hover-lift" style={{ animationDelay: '0.2s' }}> {/* Replaced Card with div */}
                <div className="pb-2 text-center"> {/* Replaced CardHeader with div */}
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-1"> {/* Replaced CardTitle with p */}
                    <Coffee className="h-4 w-4 text-logo-orange" /> Break Time
                  </p>
                </div>
                <div className="p-0"> {/* Replaced CardContent with div */}
                  <p className="text-2xl font-extrabold font-mono text-logo-orange">{scheduleSummary.breakTime} min</p>
                </div>
              </div>

              {/* Session End */}
              <div className="flex flex-col items-center justify-center p-4 bg-card/50 border border-primary/20 rounded-xl shadow-sm hover:shadow-lg transition-all duration-200 animate-pop-in animate-hover-lift" style={{ animationDelay: '0.3s' }}> {/* Replaced Card with div */}
                <div className="pb-2 text-center"> {/* Replaced CardHeader with div */}
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-1"> {/* Replaced CardTitle with p */}
                    <Flag className="h-4 w-4 text-foreground" /> Session End
                  </p>
                </div>
                <div className="p-0"> {/* Replaced CardContent with div */}
                  <p className="text-2xl font-extrabold font-mono text-foreground">{formatTime(scheduleSummary.sessionEnd)}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default SchedulerDashboardPanel;