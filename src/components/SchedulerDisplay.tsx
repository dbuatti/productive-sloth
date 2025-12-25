import React, { useMemo, useRef, useState } from 'react';
import { ScheduledItem, FormattedSchedule, DisplayItem, TimeMarker, FreeTimeItem, DBScheduledTask, TaskEnvironment } from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { formatTime, getEmojiHue } from '@/lib/scheduler-utils'; 
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge'; // Added missing import
import { 
  Trash, Archive, Lock, Unlock, Clock, Zap, CheckCircle, 
  Star, Home, Laptop, Globe, Music, Utensils, CalendarDays, 
  Plus, PlusCircle, ListTodo 
} from 'lucide-react';
import { startOfDay, addHours, parseISO, isSameDay, format, min, max } from 'date-fns';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import ScheduledTaskDetailDialog from './ScheduledTaskDetailDialog';

interface SchedulerDisplayProps {
  schedule: FormattedSchedule | null;
  T_current: Date;
  onRemoveTask: (taskId: string, taskName: string, index: number) => void;
  onRetireTask: (task: DBScheduledTask) => void;
  onCompleteTask: (task: DBScheduledTask, index: number) => void;
  activeItemId: string | null;
  selectedDayString: string;
  onAddTaskClick: () => void;
  onScrollToItem: (itemId: string) => void;
  isProcessingCommand: boolean;
  onFreeTimeClick: (startTime: Date, endTime: Date) => void;
}

const getBubbleHeightStyle = (duration: number, isFreeTime: boolean = false) => {
  const baseHeight = 44;
  const taskMultiplier = 1.2;
  const freeTimeMultiplier = 0.5;
  const minHeight = isFreeTime ? 48 : 64;
  
  const calculated = baseHeight + (duration * (isFreeTime ? freeTimeMultiplier : taskMultiplier));
  return { minHeight: `${Math.max(calculated, minHeight)}px` };
};

const getEnvironmentIcon = (environment: TaskEnvironment) => {
  const className = "h-3.5 w-3.5 opacity-80";
  switch (environment) {
    case 'home': return <Home className={className} />;
    case 'laptop': return <Laptop className={className} />;
    case 'away': return <Globe className={className} />;
    case 'piano': return <Music className={className} />;
    case 'laptop_piano':
      return (
        <div className="relative">
          <Laptop className={className} />
          <Music className="h-2 w-2 absolute -bottom-0.5 -right-0.5" />
        </div>
      );
    default: return null;
  }
};

const SchedulerDisplay: React.FC<SchedulerDisplayProps> = React.memo(({ 
  schedule, T_current, onCompleteTask, activeItemId, 
  selectedDayString, onAddTaskClick, onFreeTimeClick 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedScheduledTask, setSelectedScheduledTask] = useState<DBScheduledTask | null>(null);

  // Timeline Processing Logic
  const { finalDisplayItems } = useMemo(() => {
    const items = schedule?.items || [];
    if (items.length === 0) return { finalDisplayItems: [] };

    const actualStart = min(items.map(i => i.startTime));
    const actualEnd = max(items.map(i => i.endTime));
    
    const processed: DisplayItem[] = [];
    let cursor = actualStart;

    const sortedEvents = [...items].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    sortedEvents.forEach(event => {
      // Gap detection for Buffer/Free Time
      if (event.startTime.getTime() > cursor.getTime()) {
        const diff = Math.floor((event.startTime.getTime() - cursor.getTime()) / 60000);
        if (diff > 0) {
          processed.push({
            id: `free-${cursor.toISOString()}`,
            type: 'free-time',
            startTime: cursor,
            endTime: event.startTime,
            duration: diff,
            message: `${Math.floor(diff / 60)}h ${diff % 60}m Buffer`
          } as FreeTimeItem);
        }
      }
      processed.push(event);
      cursor = new Date(Math.max(cursor.getTime(), event.endTime.getTime()));
    });

    return { finalDisplayItems: processed };
  }, [schedule]);

  const isTodaySelected = isSameDay(parseISO(selectedDayString), T_current);

  const renderDisplayItem = (item: DisplayItem, index: number) => {
    const isFree = item.type === 'free-time';
    
    if (isFree) {
      const freeItem = item as FreeTimeItem;
      return (
        <React.Fragment key={freeItem.id}>
          <div className="flex items-center justify-end pr-4 opacity-30">
            <span className="text-[9px] font-black font-mono">{formatTime(freeItem.startTime)}</span>
          </div>
          <div 
            onClick={() => onFreeTimeClick(freeItem.startTime, freeItem.endTime)}
            className="group relative flex items-center justify-center rounded-xl border-2 border-dashed border-border/40 bg-secondary/5 hover:bg-primary/5 hover:border-primary/40 transition-all cursor-crosshair mb-2"
            style={getBubbleHeightStyle(freeItem.duration, true)}
          >
            <div className="flex items-center gap-2 text-muted-foreground/40 group-hover:text-primary/60 font-bold uppercase tracking-widest text-[10px]">
              <Plus className="h-3 w-3" /> {freeItem.message}
            </div>
          </div>
        </React.Fragment>
      );
    }

    const sItem = item as ScheduledItem;
    const isActive = T_current >= sItem.startTime && T_current < sItem.endTime && isTodaySelected;
    const isPastItem = T_current >= sItem.endTime && isTodaySelected;
    const hue = getEmojiHue(sItem.name);
    
    // Calculate Progress Line Percentage
    const progress = isActive 
      ? ((T_current.getTime() - sItem.startTime.getTime()) / (sItem.endTime.getTime() - sItem.startTime.getTime())) * 100 
      : 0;

    const dbTask = schedule?.dbTasks.find(t => t.id === sItem.id);

    return (
      <React.Fragment key={sItem.id}>
        {/* Time Pillar */}
        <div className="flex flex-col items-end pr-4 pt-1 gap-1">
          <span className={cn(
            "text-[10px] font-black font-mono transition-colors",
            isActive ? "text-primary scale-110" : "text-muted-foreground/50"
          )}>
            {formatTime(sItem.startTime)}
          </span>
          {isActive && (
             <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 border-primary text-primary animate-pulse">LIVE</Badge>
          )}
        </div>

        {/* Task Card */}
        <div 
          onClick={() => dbTask && (setSelectedScheduledTask(dbTask), setIsDialogOpen(true))}
          className={cn(
            "group relative flex flex-col p-4 rounded-2xl border transition-all duration-500 mb-2",
            isActive 
              ? "glass-card border-primary/50 shadow-[0_0_20px_rgba(var(--primary),0.15)] ring-1 ring-primary/20" 
              : "bg-card border-border/50 shadow-sm",
            isPastItem && "opacity-60 grayscale-[0.5] hover:grayscale-0 transition-all",
            "hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/30"
          )}
          style={{ 
            ...getBubbleHeightStyle(sItem.duration),
            borderLeftWidth: '6px',
            borderLeftColor: `hsl(${hue} 70% 50%)`
          }}
        >
          {/* Active Progress Indicator */}
          {isActive && (
            <div 
              className="absolute left-0 right-0 h-0.5 bg-primary/30 z-0 top-0 overflow-hidden rounded-t-2xl"
            >
              <div 
                className="h-full bg-primary shadow-[0_0_10px_hsl(var(--primary))] transition-all duration-1000"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          <div className="flex items-start justify-between gap-4 z-10">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-secondary/50 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                {sItem.emoji}
              </div>
              <div className="flex flex-col min-w-0">
                <h3 className={cn(
                  "font-black text-sm sm:text-base tracking-tight uppercase truncate leading-tight",
                  isActive ? "text-primary" : "text-foreground"
                )}>
                  {sItem.name}
                </h3>
                <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground/70 tracking-widest uppercase">
                  <Clock className="h-3 w-3" />
                  {formatTime(sItem.startTime)} — {formatTime(sItem.endTime)}
                  <span className="opacity-30">|</span>
                  <span>{sItem.duration}m</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
               <div className="flex gap-1">
                  {sItem.energyCost !== 0 && (
                    <div className={cn(
                      "px-1.5 py-0.5 rounded-md text-[10px] font-black font-mono flex items-center gap-1",
                      sItem.energyCost < 0 ? "bg-logo-green/10 text-logo-green" : "bg-logo-yellow/10 text-logo-yellow"
                    )}>
                      {sItem.energyCost > 0 ? `-${sItem.energyCost}` : `+${Math.abs(sItem.energyCost)}`}
                      <Zap className="h-2.5 w-2.5" />
                    </div>
                  )}
                  <div className="p-1.5 rounded-md bg-secondary/50 text-muted-foreground">
                    {getEnvironmentIcon(sItem.taskEnvironment)}
                  </div>
               </div>
               {sItem.isCritical && (
                 <Star className="h-3 w-3 fill-logo-yellow text-logo-yellow" />
               )}
            </div>
          </div>

          {/* Action Footer (Visible on Hover) */}
          <div className="mt-auto pt-3 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {dbTask && !sItem.isCompleted && (
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-7 px-2 text-[10px] font-bold text-logo-green hover:bg-logo-green/10"
                onClick={(e) => { e.stopPropagation(); onCompleteTask(dbTask, index); }}
              >
                <CheckCircle className="h-3 w-3 mr-1" /> FINISH
              </Button>
            )}
          </div>
        </div>
      </React.Fragment>
    );
  };

  return (
    <div className="relative">
      <div className="absolute left-[64px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-transparent via-border/40 to-transparent z-0" />
      
      <div ref={containerRef} className="grid grid-cols-[64px_1fr] gap-x-2 sm:gap-x-4 min-h-[400px]">
        {schedule?.items.length === 0 ? (
          <div className="col-span-2 flex flex-col items-center justify-center py-20 gap-6">
            <div className="h-24 w-24 rounded-full bg-secondary/20 flex items-center justify-center border-2 border-dashed border-border animate-pulse">
              <ListTodo className="h-10 w-10 text-muted-foreground/30" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-black text-foreground uppercase tracking-tighter">Timeline Vacuum</h3>
              <p className="text-sm text-muted-foreground max-w-[240px]">No objectives detected for this temporal window.</p>
            </div>
            <Button 
              onClick={onAddTaskClick} 
              className="rounded-full px-8 h-12 text-base font-bold shadow-xl animate-hover-lift"
            >
              <PlusCircle className="h-5 w-5 mr-2" /> Sync Objective
            </Button>
          </div>
        ) : (
          finalDisplayItems.map((item, idx) => renderDisplayItem(item, idx))
        )}
      </div>

      <ScheduledTaskDetailDialog
        task={selectedScheduledTask}
        open={isDialogOpen}
        onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setSelectedScheduledTask(null); }}
        selectedDayString={selectedDayString}
      />
    </div>
  );
});

SchedulerDisplay.displayName = 'SchedulerDisplay';

export default SchedulerDisplay;