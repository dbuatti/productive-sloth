"use client";

import React, { useMemo, useRef, useState } from 'react';
import { ScheduledItem, FormattedSchedule, DisplayItem, FreeTimeItem, DBScheduledTask } from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { formatTime, getEmojiHue } from '@/lib/scheduler-utils';
import { Button } from '@/components/ui/button';
import { Trash2, Archive, Lock, Unlock, Clock, Zap, CheckCircle2, Plus } from 'lucide-react';
import { format, differenceInMinutes, min, addMinutes } from 'date-fns';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import ScheduledTaskDetailDialog from './ScheduledTaskDetailDialog';
import { useIsMobile } from '@/hooks/use-mobile';

interface SchedulerDisplayProps {
  schedule: FormattedSchedule | null;
  T_current: Date;
  onRemoveTask: (taskId: string) => void;
  onRetireTask: (task: DBScheduledTask) => void;
  onCompleteTask: (task: DBScheduledTask, index?: number) => void;
  activeItemId: string | null;
  selectedDayString: string;
  onScrollToItem: (itemId: string) => void;
  isProcessingCommand: boolean;
  onFreeTimeClick: (startTime: Date, endTime: Date) => void;
  isDayLockedDown: boolean;
  onToggleDayLock: () => Promise<void>;
}

const MINUTE_HEIGHT = 1.5; 
const MIN_TASK_HEIGHT_PX = 40;

const SchedulerDisplay: React.FC<SchedulerDisplayProps> = React.memo(({
  schedule, T_current, onRemoveTask, onRetireTask, onCompleteTask, activeItemId, selectedDayString, onFreeTimeClick, isDayLockedDown, onToggleDayLock, isProcessingCommand,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedTask, setSelectedTask] = useState<DBScheduledTask | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const isMobile = useIsMobile();

  const finalDisplayItems = useMemo(() => {
    if (!schedule || schedule.items.length === 0) return [];
    const items = [...schedule.items];
    const actualStart = min(items.map(i => i.startTime));
    const processed: DisplayItem[] = [];
    let cursor = actualStart;
    items.forEach(item => {
      if (differenceInMinutes(item.startTime, cursor) > 0) {
        processed.push({ 
          id: `gap-${cursor.getTime()}`, 
          type: 'free-time', 
          startTime: cursor, 
          endTime: item.startTime, 
          duration: differenceInMinutes(item.startTime, cursor), 
          message: 'Gap' 
        } as FreeTimeItem);
      }
      processed.push(item);
      cursor = item.endTime;
    });
    return processed;
  }, [schedule]);

  if (!schedule || schedule.items.length === 0) return (
    <div className="py-20 text-center">
      <p className="text-muted-foreground text-sm">No tasks scheduled.</p>
    </div>
  );

  return (
    <div className="relative space-y-4">
      <div ref={containerRef} className="relative pl-8 pr-2 space-y-0">
        <div className="absolute left-[2.25rem] top-0 bottom-0 w-px bg-border" />
        
        {finalDisplayItems.map((item) => {
          if (item.type === 'free-time') {
            const gap = item as FreeTimeItem;
            return (
              <div 
                key={gap.id} 
                className="relative flex items-center group cursor-pointer" 
                style={{ height: `${gap.duration * MINUTE_HEIGHT}px`, minHeight: '24px' }} 
                onClick={() => onFreeTimeClick(gap.startTime, gap.endTime)}
              >
                <div className="absolute left-[-2px] w-1 h-1 rounded-full bg-border group-hover:bg-primary transition-colors" />
                <span className="ml-4 text-[10px] font-medium text-muted-foreground/40 group-hover:text-primary transition-colors">
                  {gap.duration}m free
                </span>
              </div>
            );
          }

          const taskItem = item as ScheduledItem;
          const dbTask = schedule.dbTasks.find(t => t.id === taskItem.id);
          const isActive = taskItem.id === activeItemId;
          const duration = differenceInMinutes(taskItem.endTime, taskItem.startTime);
          
          return (
            <div 
              key={taskItem.id} 
              className={cn(
                "relative flex items-start group transition-all",
                isActive ? "z-10" : "opacity-60 hover:opacity-100",
                taskItem.isCompleted && "opacity-30 grayscale"
              )}
              style={{ height: `${Math.max(duration * MINUTE_HEIGHT, MIN_TASK_HEIGHT_PX)}px` }}
              onClick={() => dbTask && (setSelectedTask(dbTask), setIsDialogOpen(true))}
            >
              <div className={cn(
                "absolute left-[-4px] w-2 h-2 rounded-full transition-all",
                isActive ? "bg-primary scale-150 shadow-[0_0_10px_rgba(0,0,0,0.1)]" : "bg-border"
              )} />
              
              <div className="ml-6 flex-1 flex items-center justify-between gap-4 cursor-pointer">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-2xl shrink-0">{taskItem.emoji}</span>
                  <div className="min-w-0">
                    <p className={cn("font-bold truncate", isActive ? "text-lg" : "text-sm")}>
                      {taskItem.name}
                    </p>
                    <p className="text-[10px] font-medium text-muted-foreground">
                      {format(taskItem.startTime, 'HH:mm')} — {duration}m
                    </p>
                  </div>
                </div>

                {dbTask && !isMobile && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={(e) => { e.stopPropagation(); onCompleteTask(dbTask); }}><CheckCircle2 className="h-4 w-4 text-logo-green" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={(e) => { e.stopPropagation(); onRetireTask(dbTask); }}><Archive className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={(e) => { e.stopPropagation(); onRemoveTask(dbTask.id); }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <ScheduledTaskDetailDialog task={selectedTask} open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if (!o) setSelectedTask(null); }} selectedDayString={selectedDayString} />
    </div>
  );
});

SchedulerDisplay.displayName = 'SchedulerDisplay';
export default SchedulerDisplay;