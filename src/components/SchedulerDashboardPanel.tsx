import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ListTodo, Zap, Coffee, Flag, ChevronsUp, RefreshCcw, Loader2, Trash2, ChevronUp, ChevronDown, RotateCcw } from 'lucide-react'; // Icons for the stat cards, added ChevronsUp, RefreshCcw, Loader2, Trash2, ChevronUp, ChevronDown, RotateCcw
import { ScheduleSummary } from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/scheduler-utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface SchedulerDashboardPanelProps {
  scheduleSummary: ScheduleSummary | null;
  onAetherDump: () => void;
  isProcessingCommand: boolean;
  hasFlexibleTasks: boolean;
  onRefreshSchedule: () => void; // NEW: Handler for refresh
}

const SchedulerDashboardPanel: React.FC<SchedulerDashboardPanelProps> = React.memo(({ scheduleSummary, onAetherDump, isProcessingCommand, hasFlexibleTasks, onRefreshSchedule }) => {
  const [isCollapsed, setIsCollapsed] = useState(false); // NEW: State for collapse/expand

  if (!scheduleSummary || scheduleSummary.totalTasks === 0) {
    return null;
  }

  const totalScheduledMinutes = scheduleSummary.activeTime.hours * 60 + scheduleSummary.activeTime.minutes + scheduleSummary.breakTime;
  const activeTimeMinutes = scheduleSummary.activeTime.hours * 60 + scheduleSummary.activeTime.minutes;

  const activeTimePercentage = totalScheduledMinutes > 0 ? (activeTimeMinutes / totalScheduledMinutes) * 100 : 0;
  const breakTimePercentage = totalScheduledMinutes > 0 ? (scheduleSummary.breakTime / totalScheduledMinutes) * 100 : 0;

  return (
    <div className="space-y-4 animate-slide-in-up">
      <Card className="animate-pop-in animate-hover-lift">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl font-bold text-foreground flex items-center gap-2"> {/* Changed text-2xl to text-xl */}
            <ListTodo className="h-6 w-6 text-primary" /> Session Dashboard
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Collapse Metrics Button (Keep this one) */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setIsCollapsed(!isCollapsed)}
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
        </CardHeader>

        {!isCollapsed && ( // Conditionally render content
          <CardContent className="space-y-4">
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

            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Tasks */}
              <Card className="flex flex-col items-center justify-center p-4 bg-card/50 border-primary/20 shadow-md hover:shadow-lg transition-all duration-200 animate-pop-in animate-hover-lift">
                <CardHeader className="p-0 pb-2 text-center">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <ListTodo className="h-4 w-4 text-primary" /> Total Tasks
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <p className="text-2xl font-extrabold font-mono text-foreground">{scheduleSummary.totalTasks}</p> {/* Changed text-3xl to text-2xl */}
                </CardContent>
              </Card>

              {/* Active Time */}
              <Card className="flex flex-col items-center justify-center p-4 bg-card/50 border-primary/20 shadow-md hover:shadow-lg transition-all duration-200 animate-pop-in animate-hover-lift" style={{ animationDelay: '0.1s' }}>
                <CardHeader className="p-0 pb-2 text-center">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Zap className="h-4 w-4 text-primary" /> Active Time
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <p className="text-2xl font-extrabold font-mono text-primary"> {/* Changed text-3xl to text-2xl */}
                    {scheduleSummary.activeTime.hours}h {scheduleSummary.activeTime.minutes}m
                  </p>
                </CardContent>
              </Card>

              {/* Break Time */}
              <Card className="flex flex-col items-center justify-center p-4 bg-card/50 border-primary/20 shadow-md hover:shadow-lg transition-all duration-200 animate-pop-in animate-hover-lift" style={{ animationDelay: '0.2s' }}>
                <CardHeader className="p-0 pb-2 text-center">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Coffee className="h-4 w-4 text-logo-orange" /> Break Time
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <p className="text-2xl font-extrabold font-mono text-logo-orange">{scheduleSummary.breakTime} min</p> {/* Changed text-3xl to text-2xl */}
                </CardContent>
              </Card>

              {/* Session End */}
              <Card className="flex flex-col items-center justify-center p-4 bg-card/50 border-primary/20 shadow-md hover:shadow-lg transition-all duration-200 animate-pop-in animate-hover-lift" style={{ animationDelay: '0.3s' }}>
                <CardHeader className="p-0 pb-2 text-center">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Flag className="h-4 w-4 text-foreground" /> Session End
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <p className="text-2xl font-extrabold font-mono text-foreground">{formatTime(scheduleSummary.sessionEnd)}</p> {/* Changed text-3xl to text-2xl */}
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