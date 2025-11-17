import React from 'react';
import { CheckCircle, Zap, Sparkles, Clock } from 'lucide-react'; // Added Clock icon
import { cn } from '@/lib/utils';
import { DBScheduledTask } from '@/types/scheduler';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { getEmojiHue, assignEmoji } from '@/lib/scheduler-utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface CompletedTaskLogItemProps {
  task: DBScheduledTask;
}

const CompletedTaskLogItem: React.FC<CompletedTaskLogItemProps> = ({ task }) => {
  const hue = getEmojiHue(task.name);
  const ambientBackgroundColor = `hsl(${hue} 50% 35% / 0.3)`;
  const accentBorderColor = `hsl(${hue} 70% 50%)`;

  const timeUsedMinutes = task.start_time && task.end_time
    ? differenceInMinutes(parseISO(task.end_time), parseISO(task.start_time))
    : task.break_duration || 0; // Fallback for breaks or if times are missing

  const xpEarned = task.energy_cost * 2;
  const completedTime = task.updated_at ? format(parseISO(task.updated_at), 'h:mm a') : 'N/A';

  return (
    <div
      className={cn(
        "flex items-center justify-between p-2 rounded-md border border-border/50 text-sm transition-all duration-200 ease-in-out",
        "bg-card hover:bg-secondary/50 animate-hover-lift"
      )}
      style={{ backgroundColor: ambientBackgroundColor, borderLeft: `4px solid ${accentBorderColor}` }}
    >
      <div className="flex items-center space-x-2 flex-grow min-w-0">
        <CheckCircle className="h-4 w-4 text-logo-green shrink-0" />
        <span className="text-base">{assignEmoji(task.name)}</span>
        <span className="font-semibold truncate text-foreground">{task.name}</span>
        <span className="text-xs text-muted-foreground">({completedTime})</span>
      </div>
      <div className="flex items-center gap-3 ml-auto shrink-0">
        {timeUsedMinutes > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1 text-xs font-semibold font-mono text-foreground/80">
                <Clock className="h-3 w-3" /> {timeUsedMinutes} min
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Time Used</p>
            </TooltipContent>
          </Tooltip>
        )}
        {task.energy_cost > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1 text-xs font-semibold font-mono text-logo-yellow">
                {task.energy_cost} <Zap className="h-3 w-3" />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Energy Cost</p>
            </TooltipContent>
          </Tooltip>
        )}
        {xpEarned > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1 text-xs font-semibold font-mono text-primary">
                +{xpEarned} <Sparkles className="h-3 w-3" />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>XP Earned</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
};

export default CompletedTaskLogItem;