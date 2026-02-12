"use client";

import React, { useMemo, useRef, useState } from 'react';
import { ScheduledItem, FormattedSchedule, DisplayItem, FreeTimeItem, DBScheduledTask } from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { formatTime, getEmojiHue } from '@/lib/scheduler-utils';
import { Button } from '@/components/ui/button';
import { Trash2, Archive, Lock, Unlock, Clock, Zap, CheckCircle2, Star, Plus } from 'lucide-react';
import { format, differenceInMinutes, min, addMinutes } from 'date-fns';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import ScheduledTaskDetailDialog from './ScheduledTaskDetailDialog';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';
import { useEnvironments } from '@/hooks/use-environments';

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

const MINUTE_HEIGHT = 2.0; 
const FREE_TIME_MINUTE_HEIGHT = 0.6;
const MIN_TASK_HEIGHT_PX = 40;

const SchedulerDisplay: React.FC<SchedulerDisplayProps> = React.memo(({
  schedule, T_current, onRemoveTask, onRetireTask, onCompleteTask, activeItemId, selectedDayString, onFreeTimeClick, isDayLockedDown, onToggleDayLock, isProcessingCommand,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { environments } = useEnvironments();
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
          message: 'Free Time' 
        } as FreeTimeItem);
      }
      processed.push(item);
      cursor = item.endTime;
    });
    return processed;
  }, [schedule]);

  if (!schedule || schedule.items.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border border-dashed rounded-xl bg-muted/30 animate-pop-in">
      <Clock className="h-10 w-10 mb-4 opacity-20" />
      <p className="font-medium text-sm">No tasks scheduled for today</p>
      <Button variant="outline" onClick={() => onFreeTimeClick(new Date(), addMinutes(new Date(), 30))} className="mt-4 h-9 px-6">Add Task</Button>
    </div>
  );

  return (
    <div className="relative space-y-6">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xl font-bold">Timeline</h2>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onToggleDayLock} disabled={isProcessingCommand} className="h-8 w-8 text-muted-foreground hover:text-foreground">
              {isDayLockedDown ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isDayLockedDown ? "Unlock All" : "Lock All"}</TooltipContent>
        </Tooltip>
      </div>

      <div ref={containerRef} className="relative pl-4 pr-1 py-2 space-y-1">
        <div className="absolute left-[1.15rem] top-0 bottom-0 w-px bg-border" />
        
        {finalDisplayItems.map((item) => {
          if (item.type === 'free-time') {
            const gap = item as FreeTimeItem;
            return (
              <div key={gap.id} className="group relative flex gap-4 cursor-pointer" style={{ height: `${gap.duration * FREE_TIME_MINUTE_HEIGHT}px`, minHeight: '32px' }} onClick={() => onFreeTimeClick(gap.startTime, gap.endTime)}>
                <div className="w-10 text-right opacity-40 font-mono text-[10px] pt-1">{format(gap.startTime, 'HH:mm')}</div>
                <div className="flex-1 flex items-center justify-center border border-dashed border-border rounded-lg hover:bg-accent/50 transition-colors">
                  <span className="text-[10px] font-medium text-muted-foreground/60">+{gap.duration}m Free Time</span>
                </div>
              </div>
            );
          }

          const taskItem = item as ScheduledItem;
          const dbTask = schedule.dbTasks.find(t => t.id === taskItem.id);
          const isActive = taskItem.id === activeItemId;
          const duration = differenceInMinutes(taskItem.endTime, taskItem.startTime);
          const hue = getEmojiHue(taskItem.name);
          const env = environments.find(e => e.value === taskItem.taskEnvironment);
          
          return (
            <div key={taskItem.id} className="relative group flex gap-4 animate-pop-in">
              <div className="w-10 text-right shrink-0 pt-1">
                <span className={cn("text-[10px] font-bold font-mono transition-colors", isActive ? "text-primary" : "text-muted-foreground/40")}>
                  {format(taskItem.startTime, 'HH:mm')}
                </span>
              </div>
              
              <div 
                className={cn(
                  "flex-1 rounded-lg transition-all relative overflow-hidden flex flex-col px-4 py-2 border", 
                  isActive ? "bg-primary/5 border-primary/30 shadow-sm" : "bg-card hover:bg-accent/50 border-border", 
                  taskItem.isCompleted && "opacity-50 grayscale"
                )} 
                style={{ 
                  height: `${Math.max(duration * MINUTE_HEIGHT, MIN_TASK_HEIGHT_PX)}px`, 
                  borderLeft: `4px solid ${isActive ? 'hsl(var(--primary))' : `hsl(${hue} 70% 50%)`}` 
                }} 
                onClick={() => dbTask && (setSelectedTask(dbTask), setIsDialogOpen(true))}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg leading-none">{taskItem.emoji}</span>
                      <span className={cn("font-semibold truncate text-sm", isActive ? "text-primary" : "text-foreground")}>{taskItem.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-medium text-muted-foreground/60 flex items-center gap-1"><Clock className="h-3 w-3" /> {duration}m</span>
                      {taskItem.isCritical && <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-bold bg-destructive/10 text-destructive border-none">CRITICAL</Badge>}
                      {env && <Badge variant="outline" className="h-4 px-1.5 text-[9px] font-medium border-border text-muted-foreground" style={{ color: env.color }}>{env.label}</Badge>}
                    </div>
                  </div>

                  {dbTask && !isMobile && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-logo-green hover:bg-logo-green/10" onClick={(e) => { e.stopPropagation(); onCompleteTask(dbTask); }}><CheckCircle2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Complete</TooltipContent></Tooltip>
                      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:bg-accent" onClick={(e) => { e.stopPropagation(); onRetireTask(dbTask); }}><Archive className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Archive</TooltipContent></Tooltip>
                      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive" onClick={(e) => { e.stopPropagation(); onRemoveTask(dbTask.id); }}><Trash2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Delete</TooltipContent></Tooltip>
                    </div>
                  )}
                </div>
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