"use client";

import React, { useMemo, useRef, useEffect, useState } from 'react';
import { ScheduledItem, FormattedSchedule, DisplayItem, FreeTimeItem, DBScheduledTask, TaskEnvironment } from '@/types/scheduler';
import { cn, getLucideIconComponent } from '@/lib/utils';
import { formatTime, getEmojiHue, formatDurationToHoursMinutes, assignEmoji, isMeal } from '@/lib/scheduler-utils';
import { Button } from '@/components/ui/button';
import { Trash2, Archive, Lock, Unlock, Clock, Zap, CheckCircle2, Star, Home, Laptop, Globe, Music, Target, Briefcase, Coffee, Layers } from 'lucide-react';
import { format, differenceInMinutes, parseISO, min, max, isPast, addMinutes } from 'date-fns';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import ScheduledTaskDetailDialog from './ScheduledTaskDetailDialog';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
const FREE_TIME_MINUTE_HEIGHT = 0.5;
const MIN_TASK_HEIGHT_MINUTES = 15;
const MIN_TASK_HEIGHT_PX = MIN_TASK_HEIGHT_MINUTES * MINUTE_HEIGHT;

const SchedulerDisplay: React.FC<SchedulerDisplayProps> = React.memo(({
  schedule, T_current, onRemoveTask, onRetireTask, onCompleteTask, activeItemId, selectedDayString, onFreeTimeClick, onScrollToItem, isDayLockedDown, onToggleDayLock, isProcessingCommand,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { toggleScheduledTaskLock } = useSchedulerTasks(selectedDayString);
  const { environments } = useEnvironments();
  const [selectedTask, setSelectedTask] = useState<DBScheduledTask | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showSyncButton, setShowSyncButton] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    const handleScroll = () => { if (containerRef.current) setShowSyncButton(containerRef.current.scrollTop > 300); };
    const el = containerRef.current;
    el?.addEventListener('scroll', handleScroll);
    return () => el?.removeEventListener('scroll', handleScroll);
  }, []);

  const finalDisplayItems = useMemo(() => {
    if (!schedule || schedule.items.length === 0) return [];
    const items = [...schedule.items];
    const actualStart = min(items.map(i => i.startTime));
    const processed: DisplayItem[] = [];
    let cursor = actualStart;
    items.forEach(item => {
      if (differenceInMinutes(item.startTime, cursor) > 0) processed.push({ id: `gap-${cursor.getTime()}`, type: 'free-time', startTime: cursor, endTime: item.startTime, duration: differenceInMinutes(item.startTime, cursor), message: 'Temporal Gap' } as FreeTimeItem);
      processed.push(item);
      cursor = item.endTime;
    });
    return processed;
  }, [schedule]);

  // UI HUD: Zone Detection Logic
  const itemsWithZones = useMemo(() => {
      return finalDisplayItems.map((item, index) => {
          if (item.type !== 'task') return { ...item, isZoneStart: false };
          const task = item as ScheduledItem;
          
          // A zone starts if it's the first task OR if the previous task had a different environment
          let prevTask = null;
          for (let i = index - 1; i >= 0; i--) {
              if (finalDisplayItems[i].type === 'task') {
                  prevTask = finalDisplayItems[i] as ScheduledItem;
                  break;
              }
              // If we hit a gap or marker, we consider the zone broken for visual clarity
              if (finalDisplayItems[i].type === 'free-time') break;
          }
          
          const isZoneStart = !prevTask || prevTask.taskEnvironment !== task.taskEnvironment;
          return { ...item, isZoneStart };
      });
  }, [finalDisplayItems]);

  if (!schedule || schedule.items.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed rounded-2xl border-white/5 bg-secondary/5">
      <Clock className="h-10 w-10 mb-3 opacity-20" />
      <p className="font-bold uppercase tracking-widest text-xs text-primary/60">Timeline Flatlined</p>
      <Button variant="link" onClick={() => onFreeTimeClick(new Date(), addMinutes(new Date(), 30))} className="text-[10px] mt-2 opacity-50 uppercase tracking-tighter">Initialize Sequence</Button>
    </div>
  );

  return (
    <div className="relative">
      {showSyncButton && activeItemId && (
        <Button onClick={() => onScrollToItem(activeItemId)} className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[100] rounded-full bg-primary/90 shadow-lg" size="sm">
          <Target className="h-4 w-4 mr-2" /> Sync to Now
        </Button>
      )}

      <Card className="p-0 bg-transparent rounded-none shadow-none">
        <CardHeader className="p-0 pb-4 flex flex-row items-center justify-between">
          <CardTitle className="text-xl font-bold">Your Vibe Schedule</CardTitle>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onToggleDayLock} disabled={isProcessingCommand} className="h-9 w-9 text-muted-foreground hover:text-primary">
                {isDayLockedDown ? <Lock className="h-5 w-5" /> : <Unlock className="h-5 w-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isDayLockedDown ? "Unlock All" : "Lock All"}</TooltipContent>
          </Tooltip>
        </CardHeader>
        <CardContent className="p-0">
          <div ref={containerRef} className="relative pl-2 pr-2 py-4 custom-scrollbar">
            <div className="absolute left-[0.5rem] top-0 bottom-0 w-px bg-gradient-to-b from-primary/50 via-primary/10 to-transparent" />
            
            {itemsWithZones.map((item, index) => {
              if (item.type === 'free-time') {
                const gap = item as FreeTimeItem;
                return (
                  <div key={gap.id} className="group relative flex gap-2 mb-3 cursor-pointer" style={{ height: `${gap.duration * FREE_TIME_MINUTE_HEIGHT}px` }} onClick={() => onFreeTimeClick(gap.startTime, gap.endTime)}>
                    <div className="w-8 text-right opacity-20 font-mono text-[8px] pt-1">{format(gap.startTime, 'HH:mm')}</div>
                    <div className="flex-1 flex items-center justify-center border-dashed border-transparent rounded-lg hover:bg-secondary/20 transition-colors">
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/40">+{formatDurationToHoursMinutes(gap.duration)}</span>
                    </div>
                  </div>
                );
              }

              const taskItem = item as ScheduledItem & { isZoneStart: boolean };
              const dbTask = schedule.dbTasks.find(t => t.id === taskItem.id);
              const isActive = taskItem.id === activeItemId;
              const duration = differenceInMinutes(taskItem.endTime, taskItem.startTime);
              const hue = getEmojiHue(taskItem.name);
              
              // Environment Aura Color
              const env = environments.find(e => e.value === taskItem.taskEnvironment);
              const envColor = env?.color || 'hsl(var(--primary))';
              const IconComponent = getLucideIconComponent(env?.icon || 'Layers');

              return (
                <div key={taskItem.id} className="flex flex-col gap-1 mb-3">
                  {/* ZONE HEADER */}
                  {taskItem.isZoneStart && !taskItem.isBreak && !isMeal(taskItem.name) && (
                    <div className="flex items-center gap-2 ml-10 mb-1 animate-pop-in">
                       <IconComponent className="h-2.5 w-2.5 opacity-50" style={{ color: envColor }} />
                       <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40" style={{ color: envColor }}>
                         {env?.label || taskItem.taskEnvironment} Zone
                       </span>
                       <div className="h-px flex-1 bg-gradient-to-r from-border/50 to-transparent" />
                    </div>
                  )}

                  <div className="relative group flex gap-2">
                    <div className="w-8 text-right shrink-0 pt-0.5"><span className={cn("text-[9px] font-bold font-mono transition-colors", isActive ? "text-primary" : "text-muted-foreground/40")}>{format(taskItem.startTime, 'HH:mm')}</span></div>
                    
                    <div 
                      className={cn(
                        "flex-1 rounded-xl transition-all duration-300 relative overflow-hidden flex flex-col px-2 py-1", 
                        isActive ? "bg-primary/10" : "bg-card/40 hover:bg-primary/5", 
                        taskItem.isCompleted && "opacity-40 grayscale"
                      )} 
                      style={{ 
                        height: `${Math.max(duration * MINUTE_HEIGHT, MIN_TASK_HEIGHT_PX)}px`, 
                        borderLeft: `3px solid ${isActive ? 'hsl(var(--primary))' : `hsl(${hue} 70% 50%)`}` 
                      }} 
                      onClick={() => dbTask && (setSelectedTask(dbTask), setIsDialogOpen(true))}
                    >
                      {/* ZONE AURA - Subtle side highlight for group membership */}
                      {!taskItem.isBreak && (
                        <div 
                          className="absolute right-0 top-0 bottom-0 w-1 opacity-20 transition-opacity group-hover:opacity-60" 
                          style={{ backgroundColor: envColor }} 
                        />
                      )}

                      <div className="flex items-start justify-between gap-3 pr-32 py-0.5">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5"><span className="text-lg leading-none">{taskItem.emoji}</span><span className={cn("text-sm font-bold truncate", isActive ? "text-primary" : "text-foreground")}>{taskItem.name}</span></div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-mono font-semibold text-muted-foreground/70 flex items-center gap-1"><Clock className="h-3 w-3" /> {duration}m</span>
                            {taskItem.isCritical && <Badge variant="secondary" className="h-4 px-1.5 text-[8px] font-black bg-logo-yellow/20 text-logo-yellow border-logo-yellow/30">CRIT</Badge>}
                            {taskItem.isWork && <Badge variant="outline" className="h-4 px-1.5 text-[8px] font-black uppercase border-primary/20 text-primary/60">Work</Badge>}
                            {taskItem.isBreak && <Badge variant="outline" className="h-4 px-1.5 text-[8px] font-black uppercase border-logo-orange/20 text-logo-orange/60">Break</Badge>}
                          </div>
                        </div>
                      </div>
                      {dbTask && (
                        <div className={cn("absolute bottom-1 right-1 flex flex-row gap-1", isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100 transition-opacity")}>
                          <Button variant="ghost" size="icon" className={cn("h-5 w-5", dbTask.is_locked ? "bg-primary/20 text-primary" : "text-muted-foreground")} onClick={(e) => (e.stopPropagation(), toggleScheduledTaskLock({ taskId: dbTask.id, isLocked: !dbTask.is_locked }))}>{dbTask.is_locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3 opacity-50" />}</Button>
                          <Button variant="ghost" size="icon" className="h-5 w-5 text-logo-green" onClick={(e) => (e.stopPropagation(), onCompleteTask(dbTask))}><CheckCircle2 className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-5 w-5 text-logo-orange" onClick={(e) => (e.stopPropagation(), onRetireTask(dbTask))}><Archive className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive/60" onClick={(e) => (e.stopPropagation(), onRemoveTask(dbTask.id))}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      <ScheduledTaskDetailDialog task={selectedTask} open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if (!o) setSelectedTask(null); }} selectedDayString={selectedDayString} />
    </div>
  );
});

export default SchedulerDisplay;