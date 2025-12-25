import React from 'react';
import { CheckCircle, Zap, Sparkles, Clock, Utensils } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CompletedTaskLogEntry } from '@/types/scheduler'; // FIX: Import CompletedTaskLogEntry
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { getEmojiHue, assignEmoji, isMeal } from '@/lib/scheduler-utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface CompletedTaskLogItemProps {
  // FIX: The task prop should be of type CompletedTaskLogEntry
  task: CompletedTaskLogEntry;
}

const CompletedTaskLogItem: React.FC<CompletedTaskLogItemProps> = ({ task }) => {
  const hue = getEmojiHue(task.name);
  const ambientBackgroundColor = `hsl(${hue} 50% 35% / 0.3)`;
  const accentBorderColor = `hsl(${hue} 70% 50%)`;

  // Use effective_duration_minutes which is guaranteed to be present in CompletedTaskLogEntry
  const timeUsedMinutes = task.effective_duration_minutes; 

  const xpEarned = task.energy_cost * 2;
  const completedTime = task.updated_at ? format(parseISO(task.updated_at), 'h:mm a') : 'N/A';
  const isEnergyGain = task.energy_cost < 0 || isMeal(task.name);

  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 rounded-md border border-border/50 text-base transition-all duration-200 ease-in-out", // Increased padding and font size
        "bg-card hover:bg-secondary/50 animate-hover-lift"
      )}
      style={{ backgroundColor: ambientBackgroundColor, borderLeft: `4px solid ${accentBorderColor}` }}
    >
      <div className="flex items-center space-x-3 flex-grow min-w-0">
        <CheckCircle className="h-5 w-5 text-logo-green shrink-0" /> {/* Increased icon size */}
        <span className="text-xl">{assignEmoji(task.name)}</span> {/* Increased emoji size */}
        <span className="font-semibold truncate text-foreground">{task.name}</span>
        <span className="text-sm text-muted-foreground">({completedTime})</span> {/* Increased font size */}
      </div>
      <div className="flex items-center gap-3 ml-auto shrink-0">
        {timeUsedMinutes > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1 text-sm font-semibold font-mono text-foreground/80"> {/* Increased font size */}
                <Clock className="h-4 w-4" /> {timeUsedMinutes} min {/* Increased icon size */}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Time Used</p>
            </TooltipContent>
          </Tooltip>
        )}
        {task.energy_cost !== undefined && task.energy_cost !== 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={cn(
                "flex items-center gap-1 text-sm font-semibold font-mono", 
                isEnergyGain ? "text-logo-green" : "text-logo-yellow"
              )}>
                {isEnergyGain ? `+${Math.abs(task.energy_cost)}` : task.energy_cost} 
                {isEnergyGain ? <Utensils className="h-4 w-4" /> : <Zap className="h-4 w-4" />} {/* Increased icon size */}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isEnergyGain ? "Energy Gain (Meal/Break)" : "Energy Cost"}</p>
            </TooltipContent>
          </Tooltip>
        )}
        {xpEarned > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1 text-sm font-semibold font-mono text-primary"> {/* Increased font size */}
                +{xpEarned} <Sparkles className="h-4 w-4" /> {/* Increased icon size */}
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