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

const MINUTE_HEIGHT = 2.5; 
const FREE_TIME_MINUTE_HEIGHT = 0.8;
const MIN_TASK_HEIGHT_PX = 48;

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
          message: 'Temporal Gap' 
        } as FreeTimeItem);
      }
      processed.push(item);
      cursor = item.endTime;
    });
    return processed;
  }, [schedule]);

  if (!schedule || schedule.items.length === 0) return (
    <div className="flex flex-col items-center justify-center py-32 text-muted-foreground border-2 border-dashed rounded-[2rem] border-white/5 bg-secondary/5 animate-pop-in">
      <Clock className="h-16 w-16 mb-6 opacity-10" />
      <p className="font-black uppercase tracking-[0.3em] text-sm text-primary/40">Timeline Inactive</p>
      <Button variant="outline" onClick={() => onFreeTimeClick(new Date(), addMinutes(new Date(), 30))} className="mt-6 rounded-full text-[11px] font-black uppercase tracking-widest border-primary/20 hover:bg-primary/5 h-11 px-8">Initialize Sequence</Button>
    </div>
  );

  return (
    <div className="relative space-y-8">
      <div className="flex items-center justify-between px-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-black uppercase tracking-tighter">Timeline</h2>
          <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">Temporal Stream v2.5</p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onToggleDayLock} disabled={isProcessingCommand} className="h-12 w-12 rounded-2xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all">
              {isDayLockedDown ? <Lock className="h-6 w-6" /> : <Unlock className="h-6 w-6" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isDayLockedDown ? "Unlock All" : "Lock All"}</TooltipContent>
        </Tooltip>
      </div>

      <div ref={containerRef} className="relative pl-6 pr-2 py-4 space-y-2">
        <div className="absolute left-[1.75rem] top-0 bottom-0 w-px bg-gradient-to-b from-primary/60 via-primary/10 to-transparent" />
        
        {finalDisplayItems.map((item) => {
          if (item.type === 'free-time') {
            const gap = item as FreeTimeItem;
            return (
              <div key={gap.id} className="group relative flex gap-6 cursor-pointer" style={{ height: `${gap.duration * FREE_TIME_MINUTE_HEIGHT}px`, minHeight: '40px' }} onClick={() => onFreeTimeClick(gap.startTime, gap.endTime)}>
                <div className="w-12 text-right opacity-20 font-mono text-[10px] pt-1 font-bold">{format(gap.startTime, 'HH:mm')}</div>
                <div className="flex-1 flex items-center justify-center border border-dashed border-white/5 rounded-2xl hover:bg-primary/5 hover:border-primary/20 transition-all group">
                  <Plus className="h-4 w-4 text-primary/0 group-hover:text-primary/40 transition-all mr-2" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/20 group-hover:text-primary/40 transition-all">+{gap.duration}m Gap</span>
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
            <div key={taskItem.id} className="relative group flex gap-6 animate-pop-in">
              <div className="w-12 text-right shrink-0 pt-1">
                <span className={cn("text-[11px] font-black font-mono transition-all duration-500", isActive ? "text-primary scale-110" : "text-muted-foreground/30")}>
                  {format(taskItem.startTime, 'HH:mm')}
                </span>
              </div>
              
              <div 
                className={cn(
                  "flex-1 rounded-2xl transition-all duration-500 relative overflow-hidden flex flex-col px-5 py-3 shadow-sm", 
                  isActive ? "bg-primary/10 ring-1 ring-primary/40 shadow-2xl shadow-primary/10" : "bg-card/40 hover:bg-secondary/40 border border-white/5", 
                  taskItem.isCompleted && "opacity-40 grayscale"
                )} 
                style={{ 
                  height: `${Math.max(duration * MINUTE_HEIGHT, MIN_TASK_HEIGHT_PX)}px`, 
                  borderLeft: `5px solid ${isActive ? 'hsl(var(--primary))' : `hsl(${hue} 70% 50%)`}` 
                }} 
                onClick={() => dbTask && (setSelectedTask(dbTask), setIsDialogOpen(true))}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl leading-none group-hover:scale-125 transition-transform duration-500">{taskItem.emoji}</span>
                      <span className={cn("font-black uppercase tracking-tighter truncate text-base sm:text-lg", isActive ? "text-primary" : "text-foreground")}>{taskItem.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[11px] font-mono font-bold text-muted-foreground/60 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {duration}m</span>
                      {taskItem.isCritical && <Badge variant="secondary" className="h-5 px-2 text-[9px] font-black bg-logo-yellow/20 text-logo-yellow border-logo-yellow/30">CRITICAL</Badge>}
                      {env && <Badge variant="outline" className="h-5 px-2 text-[9px] font-black uppercase border-primary/10 text-muted-foreground/60" style={{ color: env.color }}>{env.label}</Badge>}
                    </div>
                  </div>

                  {dbTask && !isMobile && (
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-logo-green hover:bg-logo-green/10" onClick={(e) => { e.stopPropagation(); onCompleteTask(dbTask); }}><CheckCircle2 className="h-5 w-5" /></Button></TooltipTrigger><TooltipContent>Complete</TooltipContent></Tooltip>
                      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-logo-orange hover:bg-logo-orange/10" onClick={(e) => { e.stopPropagation(); onRetireTask(dbTask); }}><Archive className="h-5 w-5" /></Button></TooltipTrigger><TooltipContent>Retire</TooltipContent></Tooltip>
                      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-destructive/40 hover:text-destructive" onClick={(e) => { e.stopPropagation(); onRemoveTask(dbTask.id); }}><Trash2 className="h-5 w-5" /></Button></TooltipTrigger><TooltipContent>Delete</TooltipContent></Tooltip>
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