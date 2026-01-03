import React from 'react';
import { DBScheduledTask } from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { getEmojiHue, assignEmoji } from '@/lib/scheduler-utils';
import { Clock, Zap, Star, CheckCircle } from 'lucide-react'; // Removed Home, Laptop, Globe, Music icons
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { getLucideIcon } from '@/lib/icons'; // NEW: Import getLucideIcon
import { useEnvironmentContext } from '@/hooks/use-environment-context'; // NEW: Import useEnvironmentContext

interface SimplifiedScheduledTaskItemProps {
  task: DBScheduledTask;
  isDetailedView: boolean;
  isCurrentlyActive: boolean;
  onCompleteTask: (task: DBScheduledTask) => Promise<void>;
}

const SimplifiedScheduledTaskItem: React.FC<SimplifiedScheduledTaskItemProps> = ({ task, isDetailedView, isCurrentlyActive, onCompleteTask }) => {
  const { environmentOptions } = useEnvironmentContext(); // NEW: Get dynamic environments

  const getEnvironmentIcon = (environmentId: string) => {
    const envOption = environmentOptions.find(opt => opt.originalEnvId === environmentId);
    if (envOption) {
      const Icon = getLucideIcon(envOption.icon.displayName || 'Laptop'); // Get icon dynamically
      const iconClass = "h-3.5 w-3.5 opacity-70";
      return Icon ? <Icon className={iconClass} /> : null;
    }
    return null;
  };

  const hue = getEmojiHue(task.name);
  const accentColor = `hsl(${hue} 70% 50%)`;
  const emoji = assignEmoji(task.name);

  const startTime = task.start_time ? parseISO(task.start_time) : null;
  const endTime = task.end_time ? parseISO(task.end_time) : null;
  const duration = startTime && endTime ? differenceInMinutes(endTime, startTime) : 0;

  const handleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await onCompleteTask(task);
  };

  return (
    <div
      className={cn(
        "relative flex items-center gap-2 p-1 rounded-md border-none transition-all duration-200 h-full group",
        "bg-card/30 hover:bg-card/50",
        task.is_locked && "bg-primary/[0.03]",
        task.is_completed && "opacity-50 grayscale",
        isCurrentlyActive && "animate-active-task bg-live-progress/10 shadow-lg",
        "text-sm"
      )}
      style={{ borderLeft: task.is_locked ? '3px solid hsl(var(--primary))' : `3px solid ${accentColor}` }}
    >
      <span className="text-lg shrink-0">{emoji}</span>
      
      <div className="flex flex-col min-w-0 flex-grow">
        <span className={cn("font-semibold truncate", task.is_completed && "line-through")}>
          {task.name}
        </span>
        
        {isDetailedView && (
          <div className="flex items-center gap-2 text-muted-foreground/70 mt-0.5 text-xs">
            {startTime && endTime && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> {format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')} ({duration}m)
              </span>
            )}
            {task.is_critical && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Star className="h-3.5 w-3.5 fill-logo-yellow text-logo-yellow" />
                </TooltipTrigger>
                <TooltipContent>Critical Task</TooltipContent>
              </Tooltip>
            )}
            {task.energy_cost > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1 text-logo-yellow">
                    {task.energy_cost}<Zap className="h-3.5 w-3.5" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Energy Cost</TooltipContent>
              </Tooltip>
            )}
            {task.task_environment && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1">
                    {getEnvironmentIcon(task.task_environment)}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{environmentOptions.find(opt => opt.originalEnvId === task.task_environment)?.label || task.task_environment}</TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
      </div>

      {/* NEW: Complete Task Button - Always visible on small screens, hover on larger */}
      {!task.is_completed && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleComplete}
              className={cn(
                "h-8 w-8 shrink-0 text-logo-green hover:bg-logo-green/10",
                "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
              )}
            >
              <CheckCircle className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Mark as Complete</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
};

export default SimplifiedScheduledTaskItem;