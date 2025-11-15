import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ListTodo, Zap, Coffee, Flag, ChevronsUp, RefreshCcw, Loader2 } from 'lucide-react'; // Icons for the stat cards, added ChevronsUp, RefreshCcw, Loader2
import { ScheduleSummary } from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/scheduler-utils'; // Assuming formatTime is available
import { Button } from '@/components/ui/button'; // Import Button
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'; // Import Tooltip

interface SchedulerDashboardPanelProps {
  scheduleSummary: ScheduleSummary | null;
  onCompactSchedule: () => void; // New prop for compacting
  onAetherDump: () => void; // New prop for aether dump
  isProcessingCommand: boolean; // New prop for loading state
  hasFlexibleTasks: boolean; // New prop to determine if compact/dump should be enabled
}

const SchedulerDashboardPanel: React.FC<SchedulerDashboardPanelProps> = React.memo(({ scheduleSummary, onCompactSchedule, onAetherDump, isProcessingCommand, hasFlexibleTasks }) => {
  if (!scheduleSummary || scheduleSummary.totalTasks === 0) {
    return null; // Don't render if no schedule or no tasks
  }

  const totalScheduledMinutes = scheduleSummary.activeTime.hours * 60 + scheduleSummary.activeTime.minutes + scheduleSummary.breakTime;
  const activeTimeMinutes = scheduleSummary.activeTime.hours * 60 + scheduleSummary.activeTime.minutes;

  const activeTimePercentage = totalScheduledMinutes > 0 ? (activeTimeMinutes / totalScheduledMinutes) * 100 : 0;
  const breakTimePercentage = totalScheduledMinutes > 0 ? (scheduleSummary.breakTime / totalScheduledMinutes) * 100 : 0;

  return (
    <div className="space-y-4 animate-slide-in-up">
      <Card className="animate-pop-in animate-hover-lift">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ListTodo className="h-6 w-6 text-primary" /> Session Dashboard
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Compact Schedule Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={onCompactSchedule} 
                  disabled={isProcessingCommand || !hasFlexibleTasks}
                  className="h-8 w-8 text-primary hover:bg-primary/10 transition-all duration-200"
                >
                  {isProcessingCommand ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronsUp className="h-4 w-4" />}
                  <span className="sr-only">Compact Schedule</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Compact flexible tasks</p>
              </TooltipContent>
            </Tooltip>

            {/* Aether Dump Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={onAetherDump} 
                  disabled={isProcessingCommand || !hasFlexibleTasks}
                  className="h-8 w-8 text-logo-orange hover:bg-logo-orange/10 transition-all duration-200"
                >
                  {isProcessingCommand ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                  <span className="sr-only">Aether Dump</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Move all flexible, unlocked tasks from CURRENT day to Aether Sink</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>

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
            <Card className="flex flex-col items-center justify-center p-4 bg-card/50 border-primary/20 shadow-md hover:shadow-lg transition-all duration-200 animate-pop-in animate-hover-lift"> {/* Added animate-hover-lift */}
              <CardHeader className="p-0 pb-2 text-center">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <ListTodo className="h-4 w-4 text-primary" /> Total Tasks
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <p className="text-3xl font-extrabold font-mono text-foreground">{scheduleSummary.totalTasks}</p>
              </CardContent>
            </Card>

            {/* Active Time */}
            <Card className="flex flex-col items-center justify-center p-4 bg-card/50 border-primary/20 shadow-md hover:shadow-lg transition-all duration-200 animate-pop-in animate-hover-lift" style={{ animationDelay: '0.1s' }}> {/* Added animate-hover-lift */}
              <CardHeader className="p-0 pb-2 text-center">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Zap className="h-4 w-4 text-primary" /> Active Time
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <p className="text-3xl font-extrabold font-mono text-primary">
                  {scheduleSummary.activeTime.hours}h {scheduleSummary.activeTime.minutes}m
                </p>
              </CardContent>
            </Card>

            {/* Break Time */}
            <Card className="flex flex-col items-center justify-center p-4 bg-card/50 border-primary/20 shadow-md hover:shadow-lg transition-all duration-200 animate-pop-in animate-hover-lift" style={{ animationDelay: '0.2s' }}> {/* Added animate-hover-lift */}
              <CardHeader className="p-0 pb-2 text-center">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Coffee className="h-4 w-4 text-logo-orange" /> Break Time
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <p className="text-3xl font-extrabold font-mono text-logo-orange">{scheduleSummary.breakTime} min</p>
              </CardContent>
            </Card>

            {/* Session End */}
            <Card className="flex flex-col items-center justify-center p-4 bg-card/50 border-primary/20 shadow-md hover:shadow-lg transition-all duration-200 animate-pop-in animate-hover-lift" style={{ animationDelay: '0.3s' }}> {/* Added animate-hover-lift */}
              <CardHeader className="p-0 pb-2 text-center">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Flag className="h-4 w-4 text-foreground" /> Session End
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <p className="text-3xl font-extrabold font-mono text-foreground">{formatTime(scheduleSummary.sessionEnd)}</p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

export default SchedulerDashboardPanel;