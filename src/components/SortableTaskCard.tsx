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
  Trash2, RotateCcw, Info, CheckCircle, Briefcase, Coffee
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { motion } from 'framer-motion';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import { showError } from '@/utils/toast';

interface SortableCardProps {
  task: RetiredTask;
  // NEW: Prop to open the detail dialog
  onOpenDetailDialog: (task: RetiredTask) => void;
}

const SortableTaskCard: React.FC<SortableCardProps> = ({ task, onOpenDetailDialog }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });
  
  const { 
    rezoneTask, 
    removeRetiredTask, 
    toggleRetiredTaskLock, 
    completeRetiredTask, 
    updateRetiredTaskStatus 
  } = useSchedulerTasks('');

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
  
  // NEW: Handle click to open details, but only if not dragging
  const handleCardClick = (e: React.MouseEvent) => {
    // Check if the drag operation is active or just finished (using isDragging as a proxy)
    if (isDragging) return; 
    
    // Prevent opening if a button inside the card was clicked
    if ((e.target as HTMLElement).closest('button')) return;

    onOpenDetailDialog(task);
  };

  const handleToggleComplete = async () => {
    if (task.is_locked) return showError(`Unlock "${task.name}" first.`);
    task.is_completed 
      ? await updateRetiredTaskStatus({ taskId: task.id, isCompleted: false })
      : await completeRetiredTask(task);
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
        "group relative p-3 rounded-xl border-none bg-card/40 backdrop-blur-sm hover:bg-card/60 transition-all cursor-grab active:cursor-grabbing", // Removed border
        "hover:border-primary/40 hover:shadow-lg",
        task.is_locked ? "bg-primary/[0.03]" : "border-transparent", // Removed border-primary/30
        task.is_completed && "opacity-50 grayscale",
        "mb-2",
        isDragging && "z-50 scale-[1.05] rotate-2 shadow-2xl shadow-primary/30 ring-2 ring-primary/50"
      )}
      style={{ 
        borderColor: `transparent`, 
        borderLeft: `4px solid ${accentColor}`, 
        ...style 
      }}
      {...attributes}
      {...listeners} // Listeners handle the drag
      onClick={handleCardClick} // Handle click for details
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
              <Button variant="ghost" size="icon" className="h-6 w-6 p-0" onClick={(e) => handleAction(e, handleToggleComplete)}>
                <CheckCircle className={cn("h-3.5 w-3.5", task.is_completed ? "text-logo-green fill-current" : "text-muted-foreground")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle Completion</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 p-0" onClick={(e) => handleAction(e, () => rezoneTask(task))}>
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
        {task.is_work && <Briefcase className="h-3 w-3 text-primary" />} {/* NEW: Work Task Indicator */}
        {task.is_break && <Coffee className="h-3 w-3 text-logo-orange" />} {/* NEW: Break Task Indicator */}
        <span className="flex items-center gap-1">
          {task.energy_cost > 0 ? `${task.energy_cost}⚡` : '0⚡'}
        </span>
        {task.duration && <span>{task.duration}m</span>}
      </div>
    </motion.div>
  );
};

export default SortableTaskCard;