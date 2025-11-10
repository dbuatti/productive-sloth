import React, { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Pencil, Trash, Sparkles, Zap, CalendarDays, Clock } from "lucide-react"; // Added Sparkles, Zap, CalendarDays, Clock
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Task } from "@/types";
import { useTasks } from "@/hooks/use-tasks";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import XPGainAnimation from "./XPGainAnimation"; // Import the animation component
import TaskDetailSheet from "./TaskDetailSheet"; // Import the new sheet component
import { Badge } from "@/components/ui/badge"; // Import Badge component
import { useNavigate } from 'react-router-dom'; // Import useNavigate

interface TaskItemProps {
  task: Task;
}

const TaskItem: React.FC<TaskItemProps> = ({ task }) => {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const { updateTask, deleteTask, xpGainAnimation, clearXpGainAnimation } = useTasks();
  const navigate = useNavigate(); // Initialize navigate

  // Check if this specific task should show the XP animation
  const showXpAnimation = xpGainAnimation?.taskId === task.id;

  const handleToggleComplete = async () => {
    try {
      await updateTask({ id: task.id, is_completed: !task.is_completed });
    } catch (error) {
      console.error("Failed to update task status:", error);
    }
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
    // Navigate to scheduler page, pre-filling with task data for injection
    navigate('/scheduler', { 
      state: { 
        taskToSchedule: {
          name: task.title,
          duration: task.energy_cost, // Use energy_cost as duration proxy
        }
      } 
    });
  };

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'HIGH':
        return 'text-destructive';
      case 'MEDIUM':
        return 'text-logo-orange';
      case 'LOW':
        return 'text-logo-green';
      default:
        return 'text-muted-foreground';
    }
  };

  const getPriorityBadgeVariant = (priority: Task['priority']) => {
    switch (priority) {
      case 'HIGH':
        return 'destructive';
      case 'MEDIUM':
        return 'outline'; // Using outline for medium, can be customized
      case 'LOW':
        return 'secondary'; // Using secondary for low, can be customized
      default:
        return 'outline';
    }
  };

  const getPriorityBorderColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'HIGH':
        return 'border-destructive/50 hover:border-destructive';
      case 'MEDIUM':
        return 'border-logo-orange/50 hover:border-logo-orange';
      case 'LOW':
        return 'border-logo-green/50 hover:border-logo-green';
      default:
        return 'border-border';
    }
  };

  return (
    <>
      <div 
        className={cn(
          "relative flex items-center justify-between p-4 border-l-4 transition-all duration-300 rounded-md shadow-sm",
          "bg-card hover:bg-secondary/50",
          getPriorityBorderColor(task.priority), // Dynamic left border color
          task.is_completed ? "opacity-70 border-l-muted" : "opacity-100",
          "hover:shadow-lg hover:shadow-primary/10",
          "border-b border-dashed border-border/50 last:border-b-0" // Divider line
        )}
      >
        <div className="flex items-center space-x-3 flex-grow min-w-0">
          <Checkbox
            checked={task.is_completed}
            onCheckedChange={handleToggleComplete}
            id={`task-${task.id}`}
            className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground shrink-0 h-5 w-5" // Larger checkbox
          />
          <label
            htmlFor={`task-${task.id}`}
            className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex flex-col items-start min-w-0 flex-grow`}
          >
            <div className="flex items-center gap-2 w-full">
              <Badge 
                variant={getPriorityBadgeVariant(task.priority)} 
                className={cn("capitalize px-2 py-0.5 text-xs font-semibold", getPriorityColor(task.priority))}
              >
                {task.priority.toLowerCase()}
              </Badge>
              <span className={cn(
                "truncate flex-grow",
                task.is_completed ? "line-through text-muted-foreground italic" : "text-foreground"
              )}>
                {task.title}
              </span>
            </div>
            <div className="flex items-center space-x-3 text-sm mt-1 text-muted-foreground"> {/* Changed text-xs to text-sm */}
              {task.due_date && (
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  <span>{format(new Date(task.due_date), "MMM d")}</span>
                </span>
              )}
              <span className="flex items-center gap-1 font-mono">
                <Sparkles className="h-3 w-3 text-logo-yellow" />
                <span>{task.metadata_xp} XP</span>
              </span>
              <span className="flex items-center gap-1 font-mono">
                <Zap className="h-3 w-3 text-primary" />
                <span>{task.energy_cost} Energy</span>
              </span>
            </div>
          </label>
        </div>
        
        {/* XP Gain Animation */}
        {showXpAnimation && xpGainAnimation && (
          <XPGainAnimation 
            xpAmount={xpGainAnimation.xpAmount} 
            onAnimationEnd={clearXpGainAnimation} 
          />
        )}

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

      {/* Task Detail Sheet */}
      <TaskDetailSheet
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