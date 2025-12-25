"use client";

import React from 'react';
import { DBScheduledTask, FormattedSchedule, ScheduledItem } from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { format, differenceInMinutes, isSameDay } from 'date-fns';
import { Clock, Lock, Unlock, Trash2, CheckCircle2, ChevronRight, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface SchedulerDisplayProps {
  schedule: FormattedSchedule | null;
  T_current: Date;
  onRemoveTask: (taskId: string, name: string, index: number) => void;
  onRetireTask: (task: DBScheduledTask) => void;
  onCompleteTask: (task: DBScheduledTask, index?: number) => void;
  activeItemId: string | null;
  selectedDayString: string;
  onAddTaskClick: () => void;
  onScrollToItem: (id: string) => void;
  isProcessingCommand: boolean;
  onFreeTimeClick: (start: Date, end: Date) => void;
}

const MINUTE_HEIGHT = 2.5; // Controls how "BIG" the blocks are (2.5px per minute)

const SchedulerDisplay: React.FC<SchedulerDisplayProps> = React.memo(({
  schedule,
  T_current,
  onRemoveTask,
  onRetireTask,
  onCompleteTask,
  activeItemId,
  selectedDayString,
  onFreeTimeClick
}) => {
  if (!schedule || schedule.items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed rounded-3xl border-white/5">
        <Clock className="h-12 w-12 mb-4 opacity-20" />
        <p className="font-bold uppercase tracking-widest text-xs">Timeline Empty</p>
        <p className="text-[10px] mt-2 opacity-50">Inject a task or sync your Aether Sink</p>
      </div>
    );
  }

  return (
    <div className="relative pl-12 pr-2 py-4 select-none">
      {/* Central Time Axis Line */}
      <div className="absolute left-[3.25rem] top-0 bottom-0 w-px bg-gradient-to-b from-primary/50 via-primary/5 to-transparent" />

      {schedule.items.map((item: ScheduledItem, index: number) => {
        const duration = differenceInMinutes(item.endTime, item.startTime);
        const height = Math.max(duration * MINUTE_HEIGHT, 40); // Ensure minimum visibility
        const isActive = item.id === activeItemId;
        const isPast = item.endTime < T_current;
        const dbTask = schedule.dbTasks.find(t => t.id === item.id);

        return (
          <div key={`${item.id}-${index}`} className="relative group mb-2 last:mb-0 flex gap-4">
            
            {/* Timestamp Label */}
            <div className="w-10 text-right shrink-0 pt-1">
              <span className="text-[10px] font-black font-mono text-muted-foreground/60 leading-none">
                {format(item.startTime, 'HH:mm')}
              </span>
            </div>

            {/* Timeline Node Point */}
            <div className="relative z-10 mt-2 shrink-0">
              <div className={cn(
                "h-3 w-3 rounded-full border-2 border-background transition-all duration-500",
                isActive ? "bg-primary scale-125 shadow-[0_0_10px_rgba(var(--primary),0.5)]" : 
                isPast ? "bg-muted-foreground/30" : "bg-secondary"
              )} />
            </div>

            {/* Task Block */}
            <div 
              className={cn(
                "flex-1 rounded-2xl border transition-all duration-300 relative overflow-hidden flex flex-col justify-between p-3",
                isActive ? "bg-primary/10 border-primary/30 shadow-lg ring-1 ring-primary/20" : 
                isPast ? "bg-muted/20 border-white/5 grayscale opacity-60" : "bg-card/40 border-white/5 hover:border-primary/20"
              )}
              style={{ minHeight: `${height}px` }}
            >
              {/* Vibe Progress Overlay */}
              {isActive && (
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent animate-pulse" />
              )}

              <div className="flex justify-between items-start relative z-10">
                <div className="flex flex-col">
                  <span className={cn(
                    "text-xs font-black uppercase tracking-wider mb-1",
                    isActive ? "text-primary" : "text-foreground"
                  )}>
                    {item.name}
                  </span>
                  <div className="flex items-center gap-2 text-[10px] font-mono opacity-60">
                    <span>{duration} MINS</span>
                    {dbTask?.is_critical && (
                      <span className="text-logo-yellow flex items-center gap-0.5 font-bold">
                        <Zap className="h-2 w-2 fill-current" /> CRITICAL
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!isPast && dbTask && (
                    <>
                      <Button 
                        variant="ghost" size="icon" className="h-6 w-6 hover:bg-logo-green/20 hover:text-logo-green"
                        onClick={() => onCompleteTask(dbTask, index)}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" size="icon" className="h-6 w-6 hover:bg-destructive/20 hover:text-destructive"
                        onClick={() => onRetireTask(dbTask)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* End Time Indicator */}
              <div className="mt-2 text-[9px] font-bold text-muted-foreground/40 self-end relative z-10 uppercase tracking-tighter">
                Ends {format(item.endTime, 'HH:mm')}
              </div>
            </div>
          </div>
        );
      })}

      {/* "Now" Indicator Line */}
      {isSameDay(parseISO(selectedDayString), T_current) && (
        <div 
          className="absolute left-0 right-0 z-50 flex items-center pointer-events-none"
          style={{ 
            top: 'calc(var(--current-time-offset) * 1px)', // This would require dynamic offset calculation based on your scale
            display: 'none' // Hidden until offset math is implemented for this specific scale
          }}
        >
          <div className="h-[2px] flex-1 bg-primary shadow-[0_0_10px_rgba(var(--primary),1)]" />
          <div className="bg-primary text-background text-[8px] font-black px-1 rounded uppercase ml-2">Now</div>
        </div>
      )}
    </div>
  );
});

SchedulerDisplay.displayName = 'SchedulerDisplay';
export default SchedulerDisplay;