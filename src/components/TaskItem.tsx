import { Task } from '@/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Calendar, Pencil, Zap } from 'lucide-react';
import { useTasks } from '@/hooks/use-tasks';
import { cn } from '@/lib/utils';
import { format, parseISO, isSameYear, isPast } from 'date-fns';
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
import XPGainAnimation from './XPGainAnimation';
import ConfettiEffect from './ConfettiEffect';

interface TaskItemProps {
  task: Task;
}

const TaskItem: React.FC<TaskItemProps> = ({ task }) => {
  const { updateTask, deleteTask } = useTasks();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [showXPGain, setShowXPGain] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const handleToggleCompletion = (checked: boolean | 'indeterminate') => {
    if (typeof checked === 'boolean') {
      updateTask({ id: task.id, is_completed: checked });
      if (checked && !task.is_completed) {
        setShowXPGain(true);
        setShowConfetti(true);
      }
    }
  };

  const handleXPGainAnimationEnd = () => {
    setShowXPGain(false);
  };

  const handleConfettiComplete = () => {
    setShowConfetti(false);
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
  
  const isOverdue = !task.is_completed && isPast(dueDate);

  const completedClasses = task.is_completed ? "opacity-50 text-muted-foreground" : "";

  return (
    <div className={cn(
      "group relative flex items-center justify-between p-4 rounded-lg shadow-sm mb-3 transition-all duration-200 ease-in-out", // Card-like styling
      task.is_completed ? "bg-secondary/30" : "bg-card hover:bg-accent/50 group-hover:shadow-md group-hover:scale-[1.005]", // Hover effect
      isOverdue && "bg-destructive/5 dark:bg-destructive/10 hover:bg-destructive/10 dark:hover:bg-destructive/15",
      `border-l-4 ${priorityClasses[task.priority]}`
    )}>
      
      <div className="flex items-center space-x-4 flex-grow min-w-0">
        <Checkbox
          id={`task-${task.id}`}
          checked={task.is_completed}
          onCheckedChange={handleToggleCompletion}
          className={cn(
            "h-5 w-5 rounded-full border-2",
            task.is_completed ? "border-primary" : "border-input"
          )}
        />
        <label
          htmlFor={`task-${task.id}`}
          className={cn(
            "text-base font-medium leading-none truncate",
            task.is_completed ? "line-through text-muted-foreground" : "text-foreground",
            isOverdue && !task.is_completed && "text-destructive dark:text-red-400"
          )}
        >
          {task.title}
        </label>
      </div>

      <div className="flex items-center space-x-2 shrink-0">
        <Badge 
          variant="secondary"
          className={cn(
            "text-xs font-mono flex items-center space-x-1",
            isOverdue && "bg-destructive/10 text-destructive border-destructive/50",
            completedClasses
          )}
        >
          <Calendar className="h-3 w-3" />
          <span>{formattedDueDate}</span>
        </Badge>
        
        <Badge 
          variant="secondary" 
          className={cn(
            "text-xs font-mono hidden sm:inline-flex",
            completedClasses
          )}
        >
          +{task.metadata_xp} XP
        </Badge>

        <Badge 
          variant="secondary" 
          className={cn(
            "text-xs font-mono flex items-center space-x-1",
            completedClasses
          )}
        >
          <Zap className="h-3 w-3 text-yellow-500" />
          <span>-{task.energy_cost} Energy</span>
        </Badge>
        
        <div className={cn(
          "flex items-center space-x-2 transition-opacity",
          "sm:opacity-0 sm:group-hover:opacity-100"
        )}>
          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-accent/80" onClick={() => setIsEditDialogOpen(true)}>
            <Pencil className="h-4 w-4 text-muted-foreground hover:text-primary/80" />
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-accent/80">
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
      </div>
      
      <TaskEditDialog 
        task={task} 
        open={isEditDialogOpen} 
        onOpenChange={setIsEditDialogOpen} 
      />

      {showXPGain && (
        <XPGainAnimation xpAmount={task.metadata_xp} onAnimationEnd={handleXPGainAnimationEnd} />
      )}
      {showConfetti && <ConfettiEffect show={showConfetti} onComplete={handleConfettiComplete} />}
    </div>
  );
};

export default TaskItem;