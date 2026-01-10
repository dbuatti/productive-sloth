"use client";

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { RetiredTask } from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { 
  getEmojiHue, 
  assignEmoji, 
} from '@/lib/scheduler-utils';
import { 
  Zap, Star, Lock, Unlock, 
  Trash2, RotateCcw, Info, CheckCircle, Briefcase, Coffee, Home, Laptop, Globe, Music
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { motion } from 'framer-motion';
import { showError } from '@/utils/toast';
import { useRetiredTasks } from '@/hooks/use-retired-tasks'; // NEW: Import useRetiredTasks
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks'; // NEW: Import useSchedulerTasks
import { addMinutes, parseISO, format } from 'date-fns';

interface SortableCardProps {
  task: RetiredTask;
  onOpenDetailDialog: (task: RetiredTask) => void;
  isOverTarget?: boolean;
}

const getEnvironmentIcon = (environment: string) => {
  const iconClass = "h-3 w-3 opacity-70";
  switch (environment) {
    case 'home': return <Home className={iconClass} />;
    case 'laptop': return <Laptop className={iconClass} />;
    case 'away': return <Globe className={iconClass} />;
    case 'piano': return <Music className={iconClass} />;
    case 'laptop_piano':
      return (
        <div className="relative">
          <Laptop className={iconClass} />
          <Music className="h-2 w-2 absolute -bottom-0.5 -right-0.5" />
        </div>
      );
    default: return null;
  }
};

const SortableTaskCard: React.FC<SortableCardProps> = ({ task, onOpenDetailDialog, isOverTarget }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });
  
  const { 
    rezoneTask: rezoneRetiredTaskMutation, // Renamed to avoid conflict
    removeRetiredTask, 
    toggleRetiredTaskLock, 
    completeRetiredTask, 
    updateRetiredTaskStatus 
  } = useRetiredTasks(); // Use the new hook for retired tasks

  const { addScheduledTask } = useSchedulerTasks(task.original_scheduled_date); // Use for scheduling

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const hue = getEmojiHue(task.name);
  const emoji = assignEmoji(task.name);
  const accentColor = `hsl(${hue} 70% 50%)`;

  const handleAction = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  };
  
  const handleCardClick = (e: React.MouseEvent) => {
    if (isDragging) return; 
    if ((e.target as HTMLElement).closest('button')) return;
    onOpenDetailDialog(task);
  };

  const handleToggleComplete = async () => {
    if (task.is_locked) return showError(`Unlock "${task.name}" first.`);
    task.is_completed 
      ? await updateRetiredTaskStatus({ taskId: task.id, isCompleted: false })
      : await completeRetiredTask(task);
  };

  const handleRezone = async () => {
    try {
      const rezonedTaskData = await rezoneRetiredTaskMutation(task);
      if (rezonedTaskData) {
        // Calculate start and end times for the new scheduled task
        const duration = rezonedTaskData.duration || 30;
        const now = new Date();
        const startTime = now; // Default to now
        const endTime = addMinutes(startTime, duration);
        
        await addScheduledTask({
          name: rezonedTaskData.name,
          start_time: startTime.toISOString(), // Convert duration to start_time
          end_time: endTime.toISOString(),     // Convert duration to end_time
          break_duration: rezonedTaskData.break_duration,
          scheduled_date: format(startTime, 'yyyy-MM-dd'), // Rezone to today by default
          is_critical: rezonedTaskData.is_critical,
          is_flexible: true, // Re-zoned tasks are flexible by default
          is_locked: false,
          energy_cost: rezonedTaskData.energy_cost,
          is_completed: false,
          is_custom_energy_cost: rezonedTaskData.is_custom_energy_cost,
          task_environment: rezonedTaskData.task_environment,
          is_backburner: rezonedTaskData.is_backburner,
          is_work: rezonedTaskData.is_work,
          is_break: rezonedTaskData.is_break,
        });
      }
    } catch (e: any) {
      showError(`Failed to re-zone task: ${e.message}`);
    }
  };

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="opacity-0 h-0 p-0 m-0"
      />
    );
  }

  return (
    <motion.div
      ref={setNodeRef}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "group relative p-3 rounded-xl border-none bg-card/40 backdrop-blur-sm hover:bg-card/60 transition-all cursor-grab active:cursor-grabbing",
        "hover:border-primary/40 hover:shadow-lg",
        task.is_locked ? "bg-primary/[0.03]" : "border-transparent",
        task.is_completed && "opacity-50 grayscale",
        "mb-2",
        isDragging && "z-50 scale-[1.05] rotate-2 shadow-2xl shadow-primary/30 ring-2 ring-primary/50",
        isOverTarget && "border-2 border-dashed border-primary/50 bg-primary/5"
      )}
      style={{ 
        borderColor: `transparent`, 
        borderLeft: `4px solid ${accentColor}`, 
        ...style 
      }}
      {...attributes}
      {...listeners}
      onClick={handleCardClick}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl shrink-0">{emoji}</span>
          <span className={cn("font-bold text-sm truncate", task.is_completed && "line-through")}>
            {task.name}
          </span>
        </div>
        {/* Action buttons: Always visible on small screens, hover on larger */}
        <div className={cn(
          "flex items-center gap-1 shrink-0",
          "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
        )}>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 p-0" onClick={(e) => handleAction(e, () => handleToggleComplete())}>
                <CheckCircle className={cn("h-3.5 w-3.5", task.is_completed ? "text-logo-green fill-current" : "text-muted-foreground")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle Completion</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 p-0" onClick={(e) => handleAction(e, () => handleRezone())}>
                <RotateCcw className="h-3.5 w-3.5 text-primary" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Re-zone to Schedule</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 p-0" onClick={(e) => handleAction(e, () => toggleRetiredTaskLock({ taskId: task.id, isLocked: !task.is_locked }))}>
                {task.is_locked ? <Lock className="h-3.5 w-3.5 text-primary" /> : <Unlock className="h-3.5 w-3.5 text-muted-foreground/30" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{task.is_locked ? "Unlock" : "Lock"}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 p-0 hover:text-destructive" onClick={(e) => handleAction(e, () => removeRetiredTask(task.id))}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Purge</TooltipContent>
          </Tooltip>
        </div>
      </div>
      
      <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground/70">
        {task.is_critical && <Star className="h-3 w-3 text-logo-yellow fill-current" />}
        {task.is_backburner && <Badge variant="outline" className="px-1 h-4 text-[9px] font-black uppercase">Orbit</Badge>}
        {task.is_work && <Briefcase className="h-3 w-3 text-primary" />}
        {task.is_break && <Coffee className="h-3 w-3 text-logo-orange" />}
        <span className="flex items-center gap-1">
          {task.energy_cost > 0 ? `${task.energy_cost}⚡` : '0⚡'}
        </span>
        {task.duration && <span>{task.duration}m</span>}
        {task.task_environment && getEnvironmentIcon(task.task_environment)}
      </div>
    </motion.div>
  );
};

export default SortableTaskCard;