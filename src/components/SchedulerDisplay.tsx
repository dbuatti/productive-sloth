"use client";

import React from 'react';
import { DBScheduledTask, FormattedSchedule, ScheduledItem } from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { format, differenceInMinutes, isSameDay, parseISO } from 'date-fns';
import { Clock, Trash2, CheckCircle2, Zap, Plus } from 'lucide-react';
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

const MINUTE_HEIGHT = 2.5; // Scale factor: 1 min = 2.5px

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
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed rounded-3xl border-white/5 bg-secondary/5">
        <Clock className="h-12 w-12 mb-4 opacity-20" />
        <p className="font-black uppercase tracking-widest text-xs">Temporal Void Detected</p>
        <p className="text-[10px] mt-2 opacity-50 font-mono">SYNC TIMELINE TO MANIFEST OBJECTIVES</p>
      </div>
    );
  }

  return (
    <div className="relative pl-12 pr-2 py-4 select-none">
      {/* Central Time Axis Line */}
      <div className="absolute left-[3.25rem] top-0 bottom-0 w-px bg-gradient-to-b from-primary/50 via-primary/10 to-transparent" />

      {schedule.items.map((item: ScheduledItem, index: number) => {
        const duration = differenceInMinutes(item.endTime, item.startTime);
        const blockHeight = Math.max(duration * MINUTE_HEIGHT, 50); // Minimum height for visibility
        const isActive = item.id === activeItemId;
        const isPast = item.endTime < T_current;
        const dbTask = schedule.dbTasks.find(t => t.id === item.id);

        return (
          <div key={`${item.id}-${index}`} className="relative group mb-4 last:mb-0 flex gap-6">
            
            {/* 1. Time Label */}
            <div className="w-10 text-right shrink-0 pt-1">
              <span className="text-[10px] font-black font-mono text-muted-foreground/60">
                {format(item.startTime, 'HH:mm')}
              </span>
            </div>

            {/* 2. Timeline Node */}
            <div className="relative z-10 mt-2 shrink-0">
              <div className={cn(
                "h-3 w-3 rounded-full border-2 border-background transition-all duration-700",
                isActive ? "bg-primary scale-150 shadow-[0_0_15px_rgba(var(--primary-rgb),0.6)]" : 
                isPast ? "bg-muted-foreground/20" : "bg-secondary border-primary/20"
              )} />
            </div>

            {/* 3. The Task Block (Sized by Duration) */}
            <div 
              className={cn(
                "flex-1 rounded-2xl border transition-all duration-300 relative overflow-hidden flex flex-col justify-between p-4",
                isActive ? "bg-primary/10 border-primary/40 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] ring-1 ring-primary/20" : 
                isPast ? "bg-muted/10 border-white/5 grayscale opacity-50" : "bg-card/30 border-white/10 hover:border-primary/30"
              )}
              style={{ minHeight: `${blockHeight}px` }}
            >
              {/* Pulse effect for active task */}
              {isActive && (
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent animate-pulse" />
              )}

              <div className="flex justify-between items-start relative z-10">
                <div className="flex flex-col">
                  <span className={cn(
                    "text-sm font-black uppercase tracking-tight mb-1",
                    isActive ? "text-primary" : "text-foreground"
                  )}>
                    {item.name}
                  </span>
                  <div className="flex items-center gap-3 text-[10px] font-mono font-bold opacity-50">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {duration}m
                    </span>
                    {dbTask?.is_critical && (
                      <span className="text-logo-yellow flex items-center gap-1">
                        <Zap className="h-3 w-3 fill-current" /> CRITICAL
                      </span>
                    )}
                  </div>
                </div>

                {/* Quick Actions (Hover Only) */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                  {!isPast && dbTask && (
                    <>
                      <Button 
                        variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-logo-green/20 hover:text-logo-green"
                        onClick={() => onCompleteTask(dbTask, index)}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-destructive/20 hover:text-destructive"
                        onClick={() => onRetireTask(dbTask)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Status/End Indicator */}
              <div className="mt-4 flex justify-between items-end relative z-10">
                <div className="text-[9px] font-bold text-muted-foreground/30 uppercase font-mono">
                  {format(item.startTime, 'p')} — {format(item.endTime, 'p')}
                </div>
                {isActive && (
                  <span className="text-[9px] font-black text-primary bg-primary/20 px-2 py-0.5 rounded-full animate-bounce">
                    ACTIVE
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Current Time Marker */}
      {isSameDay(parseISO(selectedDayString), T_current) && (
        <div className="absolute left-0 right-0 z-50 flex items-center pointer-events-none opacity-50">
           {/* Marker logic can be injected here for real-time scrolling */}
        </div>
      )}
    </div>
  );
});

SchedulerDisplay.displayName = 'SchedulerDisplay';
export default SchedulerDisplay;