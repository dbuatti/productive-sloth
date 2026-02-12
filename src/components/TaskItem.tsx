import React, { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Pencil, Trash, Sparkles, Zap, CalendarDays, AlignLeft, AlertCircle, Briefcase, Coffee, Copy, ArrowRight, Clock } from "lucide-react"; 
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Task } from "@/types";
import { useTasks } from "@/hooks/use-tasks";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn, getLucideIconComponent } from "@/lib/utils";
import TaskDetailSheetForTasks from "./TaskDetailSheetForTasks";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Card } from '@/components/ui/card';
import { CheckedState } from "@radix-ui/react-checkbox";
import { useEnvironments } from "@/hooks/use-environments";

interface TaskItemProps {
  task: Task;
}

const PRIORITY_STYLES = {
  HIGH: {
    badge: 'bg-destructive/10 text-destructive border-destructive/20',
    border: 'border-l-destructive',
  },
  MEDIUM: {
    badge: 'bg-logo-orange/10 text-logo-orange border-logo-orange/20',
    border: 'border-l-logo-orange',
  },
  LOW: {
    badge: 'bg-logo-green/10 text-logo-green border-logo-green/20',
    border: 'border-l-logo-green',
  },
};

const TaskItem: React.FC<TaskItemProps> = ({ task }) => {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const { deleteTask, updateTask, duplicateTask } = useTasks();
  const { environments } = useEnvironments();
  const navigate = useNavigate();

  const handleToggleComplete = async (checked: CheckedState) => {
    await updateTask({ id: task.id, is_completed: !!checked });
  };

  const handleEditClick = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsSheetOpen(true);
  };

  const handleDeleteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${task.title}"?`)) {
      await deleteTask(task.id);
    }
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    duplicateTask(task);
  };

  const handleMoveToTomorrow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await updateTask({ id: task.id, due_date: tomorrow.toISOString() });
    toast.success("Task moved to tomorrow!");
  };

  const handleScheduleNow = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate('/scheduler', { 
      state: { 
        taskToSchedule: { 
          name: task.title, 
          isCritical: task.is_critical,
          duration: 30,
          isWork: task.is_work, 
          isBreak: task.is_break, 
        } 
      } 
    });
  };

  const styles = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.MEDIUM;
  const formattedDueDate = task.due_date ? format(new Date(task.due_date), "MMM d") : 'N/A';
  
  const env = environments.find(e => e.value === task.task_environment);
  const EnvIcon = env ? getLucideIconComponent(env.icon) : null;

  return (
    <>
      <Card 
        className={cn(
          "group relative flex items-center justify-between p-4 transition-all duration-300 rounded-xl shadow-sm cursor-pointer",
          "bg-card/40 backdrop-blur-sm hover:bg-secondary/40 animate-pop-in border-l-4",
          styles.border,
          task.is_completed && "opacity-50 grayscale"
        )}
        onClick={handleEditClick}
      >
        <div className="flex items-center space-x-4 flex-grow min-w-0">
          <Checkbox 
            checked={task.is_completed} 
            onCheckedChange={handleToggleComplete} 
            id={`task-${task.id}`}
            className="h-5 w-5 rounded-md"
            onClick={(e) => e.stopPropagation()}
          />
          
          <div className="flex flex-col min-w-0 flex-grow">
            <div className="flex items-center gap-2 mb-1">
              {task.is_critical && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertCircle className="h-4 w-4 text-logo-yellow fill-current" />
                  </TooltipTrigger>
                  <TooltipContent>Critical Objective</TooltipContent>
                </Tooltip>
              )}
              <span className={cn(
                "font-bold text-sm sm:text-base truncate",
                task.is_completed && "line-through text-muted-foreground"
              )}>
                {task.title}
              </span>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn("text-[10px] font-black uppercase tracking-widest px-1.5 h-5", styles.badge)}>
                {task.priority}
              </Badge>
              
              {env && (
                <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-black uppercase border-primary/10 text-muted-foreground/60 flex items-center gap-1" style={{ color: env.color }}>
                  {EnvIcon && <EnvIcon className="h-2.5 w-2.5" />}
                  {env.label}
                </Badge>
              )}

              {task.is_work && !env && <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-black uppercase border-primary/20 text-primary/60">Work</Badge>}
              {task.is_break && <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-black uppercase border-logo-orange/20 text-logo-orange/60">Break</Badge>}
              
              <div className="flex items-center gap-3 ml-auto text-[10px] font-mono text-muted-foreground/60">
                <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {formattedDueDate}</span>
                {task.energy_cost > 0 && <span className="flex items-center gap-0.5 text-logo-yellow">{task.energy_cost}<Zap className="h-3 w-3" /></span>}
                {task.metadata_xp > 0 && <span className="flex items-center gap-0.5 text-primary">+{task.metadata_xp}<Sparkles className="h-3 w-3" /></span>}
              </div>
            </div>
          </div>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="glass-card">
            <DropdownMenuItem onClick={handleScheduleNow} className="gap-2"><Clock className="h-4 w-4" /> Schedule Now</DropdownMenuItem>
            <DropdownMenuItem onClick={handleDuplicate} className="gap-2"><Copy className="h-4 w-4" /> Duplicate</DropdownMenuItem>
            <DropdownMenuItem onClick={handleMoveToTomorrow} className="gap-2"><ArrowRight className="h-4 w-4" /> Punt Tomorrow</DropdownMenuItem>
            <DropdownMenuItem onClick={handleEditClick} className="gap-2"><Pencil className="h-4 w-4" /> Edit Details</DropdownMenuItem>
            <DropdownMenuItem onClick={handleDeleteClick} className="gap-2 text-destructive"><Trash className="h-4 w-4" /> Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Card>
      
      <TaskDetailSheetForTasks 
        task={task} 
        open={isSheetOpen} 
        onOpenChange={setIsSheetOpen} 
      />
    </>
  );
};

export default TaskItem;