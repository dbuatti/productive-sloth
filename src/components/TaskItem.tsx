import { Task } from '@/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Calendar, Pencil } from 'lucide-react';
import { useTasks } from '@/hooks/use-tasks';
import { cn } from '@/lib/utils';
import { format, parseISO, isSameYear } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import TaskEditDialog from './TaskEditDialog';
import { useState } from 'react';

interface TaskItemProps {
  task: Task;
}

const TaskItem: React.FC<TaskItemProps> = ({ task }) => {
  const { updateTask, deleteTask } = useTasks();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const handleToggleCompletion = (checked: boolean | 'indeterminate') => {
    if (typeof checked === 'boolean') {
      updateTask({ id: task.id, is_completed: checked });
    }
  };

  const handleDelete = () => {
    deleteTask(task.id);
  };

  const priorityClasses = {
    HIGH: 'border-red-500',
    MEDIUM: 'border-yellow-500',
    LOW: 'border-green-500',
  };
  
  const dueDate = parseISO(task.due_date);
  const now = new Date();
  
  const dateFormat = isSameYear(dueDate, now) ? 'MMM dd' : 'MMM dd, yyyy';
  const formattedDueDate = format(dueDate, dateFormat);

  return (
    <div className={cn(
      "flex items-center justify-between p-3 border-b last:border-b-0 transition-colors",
      task.is_completed ? "bg-gray-50 dark:bg-gray-800/50 opacity-70" : "hover:bg-accent/50",
      // New: Prominent left border for priority
      `border-l-4 ${priorityClasses[task.priority]}`
    )}>
      
      {/* Completion Toggle and Title */}
      <div className="flex items-center space-x-4 flex-grow min-w-0">
        <Checkbox
          id={`task-${task.id}`}
          checked={task.is_completed}
          onCheckedChange={handleToggleCompletion}
          className={cn(
            "h-5 w-5 rounded-full border-2",
            // Checkbox border is now standard, relying on the left bar for priority signal
            task.is_completed ? "border-primary" : "border-input"
          )}
        />
        <label
          htmlFor={`task-${task.id}`}
          className={cn(
            "text-base font-medium leading-none truncate",
            task.is_completed ? "line-through text-muted-foreground" : "text-foreground"
          )}
        >
          {task.title}
        </label>
      </div>

      {/* Metadata Tag and Quick Actions */}
      <div className="flex items-center space-x-2 shrink-0">
        {/* Due Date Badge - Now visible on mobile (no 'hidden sm:flex') */}
        <Badge variant="secondary" className="text-xs font-mono flex items-center space-x-1">
          <Calendar className="h-3 w-3" />
          <span>{formattedDueDate}</span>
        </Badge>
        
        {/* XP Badge - Hidden on mobile */}
        <Badge variant="secondary" className="text-xs font-mono hidden sm:inline-flex">
          +{task.metadata_xp} XP
        </Badge>
        
        {/* Edit Button */}
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsEditDialogOpen(true)}>
          <Pencil className="h-4 w-4 text-muted-foreground hover:text-primary/80" />
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the task: "{task.title}".
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                Delete Task
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      
      <TaskEditDialog 
        task={task} 
        open={isEditDialogOpen} 
        onOpenChange={setIsEditDialogOpen} 
      />
    </div>
  );
};

export default TaskItem;