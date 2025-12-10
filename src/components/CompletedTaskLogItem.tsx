import React from 'react';
import { cn } from '@/lib/utils';
import { DBScheduledTask } from '@/types/scheduler';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { Zap, Clock, CheckCircle } from 'lucide-react';
import { isMeal, getBreakDescription } from '@/lib/scheduler-utils';
import { Badge } from '@/components/ui/badge';

interface CompletedTaskLogItemProps {
  task: DBScheduledTask;
}

const CompletedTaskLogItem: React.FC<CompletedTaskLogItemProps> = ({ task }) => {
  const isMealTask = isMeal(task.name);
  const duration = task.end_time && task.start_time 
    ? differenceInMinutes(parseISO(task.end_time), parseISO(task.start_time))
    : 0;

  return (
    <div className={cn(
      "flex items-center justify-between p-3 rounded-lg border",
      task.is_critical && "border-destructive/30 bg-destructive/5"
    )}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex-shrink-0">
          <CheckCircle className="h-5 w-5 text-green-500" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium truncate">{task.name}</h4>
            {task.is_critical && (
              <Zap className="h-3 w-3 text-destructive flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>
                {task.start_time ? format(parseISO(task.start_time), 'h:mm a') : ''} - 
                {task.end_time ? format(parseISO(task.end_time), 'h:mm a') : ''}
              </span>
            </div>
            <Badge 
              variant="secondary" 
              className={cn(
                "text-xs",
                isMealTask && "bg-green-100 text-green-800"
              )}
            >
              {duration} min
            </Badge>
            {task.break_duration && task.break_duration > 0 && (
              <Badge variant="outline" className="text-xs">
                {getBreakDescription(task.break_duration)}
              </Badge>
            )}
          </div>
        </div>
      </div>
      <div className="flex-shrink-0">
        <Badge variant="outline" className="text-xs">
          +{task.energy_cost * 2} XP
        </Badge>
      </div>
    </div>
  );
};

export default CompletedTaskLogItem;