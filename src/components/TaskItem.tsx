import React, { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Pencil, Trash } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Task } from "@/types";
import TaskEditDialog from "./TaskEditDialog";
import { useTasks } from "@/hooks/use-tasks";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import XPGainAnimation from "./XPGainAnimation"; // Import the animation component

interface TaskItemProps {
  task: Task;
}

const TaskItem: React.FC<TaskItemProps> = ({ task }) => {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { updateTask, deleteTask, xpGainAnimation, clearXpGainAnimation } = useTasks();

  // Check if this specific task should show the XP animation
  const showXpAnimation = xpGainAnimation?.taskId === task.id;

  const handleToggleComplete = async () => {
    // If the task is already completed, we don't need to check energy or show XP animation on uncheck.
    // The useTasks hook handles the complex logic for completion/uncompletion.
    try {
      await updateTask({ id: task.id, is_completed: !task.is_completed });
      // Toast success is handled inside useTasks now, but we can keep a simple one here if needed, 
      // though useTasks provides a more context-aware toast.
    } catch (error) {
      // Error toast is handled inside useTasks
      console.error("Failed to update task status:", error);
    }
  };

  const handleEditClick = () => {
    setIsEditDialogOpen(true);
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

  const handleEditDialogSubmitSuccess = () => {
    toast.success("Task updated successfully!");
  };

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'HIGH':
        return 'text-destructive font-bold';
      case 'MEDIUM':
        return 'text-logo-orange font-semibold';
      case 'LOW':
        return 'text-logo-green';
      default:
        return 'text-muted-foreground';
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
    <div 
      className={cn(
        "relative flex items-center justify-between p-4 border-l-4 transition-all duration-300 rounded-md shadow-sm",
        "bg-card hover:bg-secondary/50",
        getPriorityBorderColor(task.priority), // Dynamic left border color
        task.is_completed ? "opacity-70 border-l-muted" : "opacity-100",
        // Add a subtle glow effect on hover for the "electrifying" feel
        "hover:shadow-lg hover:shadow-primary/10"
      )}
    >
      <div className="flex items-center space-x-3 flex-grow min-w-0">
        <Checkbox
          checked={task.is_completed}
          onCheckedChange={handleToggleComplete}
          id={`task-${task.id}`}
          className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground shrink-0"
        />
        <label
          htmlFor={`task-${task.id}`}
          className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex flex-col items-start min-w-0 flex-grow`}
        >
          <span className={cn(
            "truncate w-full",
            task.is_completed ? "line-through text-muted-foreground italic" : "text-foreground"
          )}>
            {task.title}
          </span>
          <div className="flex items-center space-x-2 text-xs mt-1">
            {task.due_date && (
              <span className="text-muted-foreground">
                Due: {format(new Date(task.due_date), "MMM d")}
              </span>
            )}
            <span className={cn("font-mono", getPriorityColor(task.priority))}>
              {task.metadata_xp} XP / {task.energy_cost} Energy
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
          <DropdownMenuItem onClick={handleEditClick}>
            <Pencil className="mr-2 h-4 w-4" /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDeleteClick} className="text-destructive">
            <Trash className="mr-2 h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <TaskEditDialog
        task={task}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSubmitSuccess={handleEditDialogSubmitSuccess}
      />
    </div>
  );
};

export default TaskItem;