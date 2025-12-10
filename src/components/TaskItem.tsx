import React, { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Pencil, Trash, Sparkles, Zap, CalendarDays, Clock, AlignLeft, AlertCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Task } from "@/types";
import { useTasks } from "@/hooks/use-tasks";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import XPGainAnimation from "./XPGainAnimation";
import TaskDetailSheetForTasks from "./TaskDetailSheetForTasks";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Card } from '@/components/ui/card';

interface TaskItemProps {
  task: Task;
  onCompleteTask: (task: Task) => Promise<void>;
}

const TaskItem: React.FC<TaskItemProps> = ({ task, onCompleteTask }) => {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const { deleteTask } = useTasks();
  const navigate = useNavigate();

  const handleToggleComplete = async () => {
    await onCompleteTask(task);
  };

  const handleEditClick = () => {
    setSelectedTask(task);
    setIsSheetOpen(true);
  };

  const handleDeleteClick = async () => {
    if (window.confirm(`Are you sure you want to delete "${task.title}"?`)) {
      try {
        await deleteTask(task.id);
        toast.success(`Task "${task.title}" deleted.`);
      } catch (error) {
        toast.error("Failed to delete task.");
        console.error("Failed to delete task:", error);
      }
    }
  };

  const handleScheduleNow = () => {
    navigate('/scheduler', { 
      state: { 
        taskToSchedule: { 
          name: task.title, 
          isCritical: task.is_critical,
          duration: 30,
        } 
      } 
    });
  };

  const getPriorityBadgeClasses = (priority: Task['priority']) => {
    switch (priority) {
      case 'HIGH':
        return 'bg-destructive text-destructive-foreground border-destructive';
      case 'MEDIUM':
        return 'bg-logo-orange/20 text-logo-orange border-logo-orange';
      case 'LOW':
        return 'bg-logo-green/20 text-logo-green border-logo-green';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getPriorityLeftBorderClass = (priority: Task['priority']) => {
    switch (priority) {
      case 'HIGH':
        return 'border-l-destructive hover:border-destructive';
      case 'MEDIUM':
        return 'border-l-logo-orange hover:border-logo-orange';
      case 'LOW':
        return 'border-l-logo-green hover:border-logo-green';
      default:
        return 'border-l-border hover:border-border';
    }
  };

  return (
    <>
      <Card className={cn(
        "relative flex items-center justify-between p-4 transition-all duration-300 rounded-lg shadow-sm",
        "bg-card hover:bg-secondary/50 animate-hover-lift border-l-4",
        getPriorityLeftBorderClass(task.priority),
        task.is_completed ? "opacity-70 border-l-muted" : "opacity-100",
        "hover:shadow-lg hover:shadow-primary/10",
        "border-b border-dashed border-border/50 last:border-b-0"
      )}>
        <div className="flex items-center space-x-4 flex-grow min-w-0">
          <Checkbox 
            checked={task.is_completed} 
            onCheckedChange={handleToggleComplete} 
            id={`task-${task.id}`}
            className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground shrink-0 h-6 w-6"
          />
          
          <label 
            htmlFor={`task-${task.id}`} 
            className={`text-base font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex flex-col items-start min-w-0 flex-grow`}
          >
            <div className="flex items-center gap-3 w-full">
              {task.is_critical && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative flex items-center justify-center h-5 w-5 rounded-full bg-logo-yellow text-white shrink-0">
                      <AlertCircle className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Critical Task: Must be completed today!</p>
                  </TooltipContent>
                </Tooltip>
              )}
              
              <Badge 
                variant="outline" 
                className={cn(
                  "capitalize px-2.5 py-1 text-xs font-semibold",
                  getPriorityBadgeClasses(task.priority)
                )}
              >
                {task.priority.toLowerCase()}
              </Badge>
              
              <span className={cn(
                "truncate flex-grow text-base",
                task.is_completed ? "line-through text-muted-foreground italic" : "text-foreground"
              )}>
                {task.title}
              </span>
              
              {!task.is_completed && task.energy_cost !== undefined && task.energy_cost > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge 
                      variant="outline" 
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold font-mono text-logo-yellow border-logo-yellow/50 bg-logo-yellow/10 shrink-0"
                    >
                      {task.energy_cost}
                      <Zap className="h-3.5 w-3.5" />
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Energy Cost</p>
                  </TooltipContent>
                </Tooltip>
              )}
              
              {!task.is_completed && task.metadata_xp !== undefined && task.metadata_xp > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge 
                      variant="outline" 
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold font-mono text-primary border-primary/50 bg-primary/10 shrink-0"
                    >
                      +{task.metadata_xp}
                      <Sparkles className="h-3.5 w-3.5" />
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>XP Gain</p>
                  </TooltipContent>
                </Tooltip>
              )}
              
              {task.description && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlignLeft className="h-4 w-4 text-muted-foreground shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Has description</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            
            <div className="flex items-center space-x-4 text-xs mt-2 text-muted-foreground">
              {task.due_date && (
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span>{format(new Date(task.due_date), "MMM d")}</span>
                </span>
              )}
            </div>
          </label>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 w-9 p-0 hover:bg-secondary transition-colors duration-200 shrink-0 ml-2">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4.5 w-4.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleScheduleNow} className="cursor-pointer">
              <Clock className="mr-2 h-4.5 w-4.5" />
              Schedule Now
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleEditClick} className="cursor-pointer">
              <Pencil className="mr-2 h-4.5 w-4.5" />
              Edit Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDeleteClick} className="text-destructive cursor-pointer">
              <Trash className="mr-2 h-4.5 w-4.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Card>
      
      <TaskDetailSheetForTasks 
        task={selectedTask} 
        open={isSheetOpen && selectedTask?.id === task.id} 
        onOpenChange={(open) => {
          setIsSheetOpen(open);
          if (!open) setSelectedTask(null);
        }} 
      />
    </>
  );
};

export default TaskItem;