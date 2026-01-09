import React, { useState } from 'react'; // Added useState
import { DBScheduledTask } from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { getEmojiHue, assignEmoji } from '@/lib/scheduler-utils';
import { Clock, Zap, Star, Home, Laptop, Globe, Music, CheckCircle, Info, Briefcase, Coffee } from 'lucide-react'; // Added Briefcase and Coffee icons
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import ScheduledTaskDetailDialog from './ScheduledTaskDetailDialog'; // Import the dialog

interface SimplifiedScheduledTaskItemProps {
  task: DBScheduledTask;
  isDetailedView: boolean;
  isCurrentlyActive: boolean;
  onCompleteTask: (task: DBScheduledTask) => Promise<void>;
}

const getEnvironmentIcon = (environment: DBScheduledTask['task_environment']) => {
  const iconClass = "h-3 w-3 opacity-70"; // Smaller icons
  switch (environment) {
    case 'home': return <Home className={iconClass} />;
    case 'laptop': return <Laptop className={iconClass} />;
    case 'away': return <Globe className={iconClass} />;
    case 'piano': return <Music className={iconClass} />;
    case 'laptop_piano':
      return (
        <div className="relative">
          <Laptop className={iconClass} />
          <Music className="h-2 w-2 absolute -bottom-0.5 -right-0.5" />
        </div>
      );
    default: return null;
  }
};

const SimplifiedScheduledTaskItem: React.FC<SimplifiedScheduledTaskItemProps> = ({ task, isDetailedView, isCurrentlyActive, onCompleteTask }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false); // State for the dialog
  const [selectedTask, setSelectedTask] = useState<DBScheduledTask | null>(null); // State for the selected task

  const hue = getEmojiHue(task.name);
  const accentColor = `hsl(${hue} 70% 50%)`;
  const emoji = assignEmoji(task.name);

  const startTime = task.start_time ? parseISO(task.start_time) : null;
  const endTime = task.end_time ? parseISO(task.end_time) : null;
  const duration = startTime && endTime ? differenceInMinutes(endTime, startTime) : 0;

  const handleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent parent click from firing
    await onCompleteTask(task);
  };

  const handleTaskClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent parent click from firing
    setSelectedTask(task);
    setIsDialogOpen(true);
  };

  return (
    <>
      <div
        className={cn(
          "relative flex items-center gap-1.5 p-1 rounded-md border-none transition-all duration-200 h-full group cursor-pointer",
          "bg-card/30 hover:bg-card/50",
          task.is_locked && "bg-primary/[0.03]",
          task.is_completed && "opacity-50 grayscale",
          isCurrentlyActive && "animate-active-task bg-live-progress/10 shadow-lg",
          "text-xs" // Smaller base font size
        )}
        style={{ borderLeft: task.is_locked ? '3px solid hsl(var(--primary))' : `3px solid ${accentColor}` }}
        onClick={handleTaskClick} // Make the entire div clickable
      >
        <span className="text-base shrink-0">{emoji}</span> {/* Smaller emoji */}
        
        <div className="flex flex-col min-w-0 flex-grow">
          <span className={cn("font-semibold truncate", task.is_completed && "line-through")}>
            {task.name}
          </span>
          
          {isDetailedView && (
            <div className="flex items-center gap-1 text-muted-foreground/70 mt-0.5 text-[10px]"> {/* Even smaller font size for details */}
              {startTime && endTime && (
                <span className="flex items-center gap-0.5">
                  <Clock className="h-2.5 w-2.5" /> {format(startTime, 'h:mm a')} ({duration}m)
                </span>
              )}
              {task.is_critical && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Star className="h-2.5 w-2.5 fill-logo-yellow text-logo-yellow" />
                  </TooltipTrigger>
                  <TooltipContent>Critical Task</TooltipContent>
                </Tooltip>
              )}
              {task.energy_cost > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex items-center gap-0.5 text-logo-yellow">
                      {task.energy_cost}<Zap className="h-2.5 w-2.5" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Energy Cost</TooltipContent>
                </Tooltip>
              )}
              {task.task_environment && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex items-center gap-0.5">
                      {getEnvironmentIcon(task.task_environment)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{task.task_environment}</TooltipContent>
                </Tooltip>
              )}
              {task.is_backburner && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-2.5 w-2.5 text-muted-foreground/50" />
                  </TooltipTrigger>
                  <TooltipContent>Backburner Task</TooltipContent>
                </Tooltip>
              )}
              {task.is_work && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Briefcase className="h-2.5 w-2.5 text-primary" />
                  </TooltipTrigger>
                  <TooltipContent>Work Task</TooltipContent>
                </Tooltip>
              )}
              {task.is_break && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Coffee className="h-2.5 w-2.5 text-logo-orange" />
                  </TooltipTrigger>
                  <TooltipContent>Break Task</TooltipContent>
                </Tooltip>
              )}
            </div>
          )}
        </div>

        {!task.is_completed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleComplete}
                className={cn(
                  "h-6 w-6 shrink-0 text-logo-green hover:bg-logo-green/10", // Smaller button
                  "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                )}
                aria-label={`Mark task "${task.name}" as complete`} // Added aria-label
              >
                <CheckCircle className="h-3.5 w-3.5" /> {/* Smaller icon */}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Mark as Complete</TooltipContent>
          </Tooltip>
        )}
      </div>
      <ScheduledTaskDetailDialog
        task={selectedTask}
        open={isDialogOpen && selectedTask?.id === task.id}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setSelectedTask(null);
        }}
        selectedDayString={task.scheduled_date} // Pass the scheduled date
      />
    </>
  );
};

export default SimplifiedScheduledTaskItem;