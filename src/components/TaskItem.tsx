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
import { Task } from "@/types"; // Updated import to use consolidated Task type
import TaskEditDialog from "./TaskEditDialog";
import { useTasks } from "@/hooks/use-tasks";
import { toast } from "sonner";
import { format } from "date-fns";

interface TaskItemProps {
  task: Task;
}

const TaskItem: React.FC<TaskItemProps> = ({ task }) => {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { updateTask, deleteTask } = useTasks();

  const handleToggleComplete = async () => {
    try {
      await updateTask({ id: task.id, is_completed: !task.is_completed });
      toast.success(`Task "${task.title}" marked as ${task.is_completed ? "incomplete" : "complete"}.`);
    } catch (error) {
      toast.error("Failed to update task status.");
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
    // Optionally, you might want to refetch tasks here if useTasks doesn't automatically update
    // queryClient.invalidateQueries(['tasks']);
  };

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'HIGH':
        return 'text-destructive font-bold'; /* Bolder red */
      case 'MEDIUM':
        return 'text-logo-orange font-semibold'; /* Orange for medium */
      case 'LOW':
        return 'text-logo-green'; /* Green for low */
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <div className="flex items-center justify-between p-4 border-b last:border-b-0 bg-card hover:bg-secondary/50 transition-all duration-200 rounded-md hover:shadow-md"> {/* Added hover effects and rounded corners */}
      <div className="flex items-center space-x-3">
        <Checkbox
          checked={task.is_completed}
          onCheckedChange={handleToggleComplete}
          id={`task-${task.id}`}
          className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground" /* Primary color for checked state */
        />
        <label
          htmlFor={`task-${task.id}`}
          className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${
            task.is_completed ? "line-through text-muted-foreground italic" : "" /* Italic for completed */
          }`}
        >
          {task.title}
          {task.due_date && (
            <span className="ml-2 text-xs text-muted-foreground">
              (Due: {format(new Date(task.due_date), "MMM d")})
            </span>
          )}
          <span className={`ml-2 text-xs ${getPriorityColor(task.priority)}`}>
            ({task.priority.charAt(0).toUpperCase() + task.priority.slice(1)})
          </span>
        </label>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-secondary transition-colors duration-200"> {/* Added hover effect */}
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleEditClick}>
            <Pencil className="mr-2 h-4 w-4" /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDeleteClick} className="text-destructive"> {/* Destructive color for delete */}
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