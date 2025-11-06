import { Task } from '@/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2 } from 'lucide-react';
import { useTasks } from '@/hooks/use-tasks';
import { cn } from '@/lib/utils';

interface TaskItemProps {
  task: Task;
}

const TaskItem: React.FC<TaskItemProps> = ({ task }) => {
  const { updateTask, deleteTask } = useTasks();

  const handleToggleCompletion = (checked: boolean | 'indeterminate') => {
    if (typeof checked === 'boolean') {
      updateTask({ id: task.id, is_completed: checked });
    }
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete "${task.title}"?`)) {
      deleteTask(task.id);
    }
  };

  const priorityClasses = {
    HIGH: 'border-red-500',
    MEDIUM: 'border-yellow-500',
    LOW: 'border-green-500',
  };

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
            // Checkbox border is now standard, priority is shown by the left bar
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
      <div className="flex items-center space-x-3 shrink-0">
        <Badge variant="secondary" className="text-xs font-mono hidden sm:inline-flex">
          +{task.metadata_xp} XP
        </Badge>
        
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDelete}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
};

export default TaskItem;