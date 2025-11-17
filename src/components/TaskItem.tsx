import React, { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Pencil, Trash, Sparkles, Zap, CalendarDays, Clock, AlignLeft, AlertCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Task } from "@/types";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import XPGainAnimation from "./XPGainAnimation";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface TaskItemProps {
  task: Task;
}

const TaskItem: React.FC<TaskItemProps> = ({ task }) => {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const navigate = useNavigate();

  const handleScheduleNow = () => {
    navigate('/scheduler', { 
      state: { 
        taskToSchedule: {
          name: task.name,
          isCritical: task.is_critical,
          duration: task.duration || 30,
        }
      } 
    });
  };

  const handleEditClick = () => {
    setSelectedTask(task);
    setIsSheetOpen(true);
  };

  const handleDeleteClick = () => {
    toast.success(`Task "${task.name}" deleted.`);
  };

  const getPriorityBadgeClasses = (isCritical: boolean) => {
    return isCritical ? 'bg-destructive text-destructive-foreground border-destructive' : 'bg-muted text-muted-foreground border-border';
  };

  const getPriorityBorderColor = (isCritical: boolean) => {
    return isCritical ? 'border-destructive/50 hover:border-destructive' : 'border-border';
  };

  return (
    <>
      <div 
        className={cn(
          "relative flex items-center justify-between p-4 border-l-4 transition-all duration-300 rounded-md shadow-sm",
          "bg-card hover:bg-secondary/50 animate-hover-lift",
          getPriorityBorderColor(task.is_critical),
          task.is_completed ? "opacity-70 border-l-muted" : "opacity-100",
          "hover:shadow-lg hover:shadow-primary/10",
          "border-b border-dashed border-border/50 last:border-b-0"
        )}
      >
        <div className="flex items-center space-x-3 flex-grow min-w-0">
          <Checkbox
            checked={task.is_completed}
            id={`task-${task.id}`}
            className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground shrink-0 h-5 w-5"
          />
          <label
            htmlFor={`task-${task.id}`}
            className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex flex-col items-start min-w-0 flex-grow`}
          >
            <div className="flex items-center gap-2 w-full">
              {task.is_critical && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative flex items-center justify-center h-4 w-4 rounded-full bg-logo-yellow text-white shrink-0">
                      <AlertCircle className="h-3 w-3" strokeWidth={2.5} />
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
                  "capitalize px-2 py-0.5 text-xs font-semibold", 
                  getPriorityBadgeClasses(task.is_critical)
                )}
              >
                {task.is_critical ? 'critical' : 'general'}
              </Badge>
              <span className={cn(
                "truncate flex-grow",
                task.is_completed ? "line-through text-muted-foreground italic" : "text-foreground"
              )}>
                {task.name}
              </span>
            </div>
            <div className="flex items-center space-x-3 text-sm mt-1 text-muted-foreground">
              {task.original_scheduled_date && (
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  <span>{format(new Date(task.original_scheduled_date), "MMM d")}</span>
                </span>
              )}
              {task.duration && task.duration > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex items-center gap-1 text-xs font-semibold font-mono">
                      {task.duration} min <Clock className="h-3 w-3" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Estimated Duration</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {task.energy_cost !== undefined && task.energy_cost > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex items-center gap-1 text-xs font-semibold font-mono">
                      {task.energy_cost} <Zap className="h-3 w-3" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Energy Cost</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </label>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-secondary transition-colors duration-200 shrink-0 ml-2">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleScheduleNow} className="cursor-pointer">
              <Clock className="mr-2 h-4 w-4" /> Schedule Now
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleEditClick} className="cursor-pointer">
              <Pencil className="mr-2 h-4 w-4" /> Edit Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDeleteClick} className="text-destructive cursor-pointer">
              <Trash className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
};

export default TaskItem;