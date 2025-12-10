import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  RotateCcw, 
  Trash2, 
  Lock, 
  Unlock, 
  Zap, 
  Clock, 
  Coffee,
  Calendar,
  MapPin
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatTime, getBreakDescription, isMeal } from '@/lib/scheduler-utils';
import { DBScheduledTask, TaskEnvironment } from "@/types/scheduler";
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';

interface ScheduledTaskDetailDialogProps {
  task: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRetire: (task: any) => void;
  onComplete: () => void;
  onDelete: () => void;
  isProcessingCommand: boolean;
}

const ScheduledTaskDetailDialog: React.FC<ScheduledTaskDetailDialogProps> = ({
  task,
  open,
  onOpenChange,
  onRetire,
  onComplete,
  onDelete,
  isProcessingCommand,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTask, setEditedTask] = useState({
    name: task?.name || '',
    isCritical: task?.isCritical || false,
    isLocked: task?.isLocked || false,
    environment: task?.taskEnvironment || 'laptop',
  });

  const handleSave = () => {
    // Save logic would go here
    setIsEditing(false);
  };

  if (!task) return null;

  const isMealTask = isMeal(task.name);
  const energyCost = task.energyCost || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {task.name}
            {task.isCritical && <Zap className="h-4 w-4 text-destructive" />}
            {task.isLocked && <Lock className="h-4 w-4 text-muted-foreground" />}
          </DialogTitle>
          <DialogDescription>
            Task details and actions
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">{formatTime(task.startTime)}</div>
                <div className="text-xs text-muted-foreground">Start</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">{formatTime(task.endTime)}</div>
                <div className="text-xs text-muted-foreground">End</div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Coffee className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">{energyCost} energy</div>
                <div className="text-xs text-muted-foreground">Cost</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">{task.duration} min</div>
                <div className="text-xs text-muted-foreground">Duration</div>
              </div>
            </div>
          </div>
          
          {task.breakDuration > 0 && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Coffee className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">{getBreakDescription(task.breakDuration)}</div>
                <div className="text-xs text-muted-foreground">Break</div>
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium capitalize">{task.taskEnvironment}</div>
              <div className="text-xs text-muted-foreground">Environment</div>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <Label htmlFor="critical" className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-destructive" />
              Critical Task
            </Label>
            <Switch
              id="critical"
              checked={task.isCritical}
              disabled
            />
          </div>
          
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <Label htmlFor="locked" className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              Locked
            </Label>
            <Switch
              id="locked"
              checked={task.isLocked}
              disabled
            />
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={onComplete}
            disabled={isProcessingCommand}
            className="flex-1"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Complete
          </Button>
          
          <Button 
            variant="outline" 
            onClick={() => onRetire(task)}
            disabled={isProcessingCommand || task.isLocked}
            className="flex-1"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Move to Sink
          </Button>
          
          <Button 
            variant="destructive" 
            onClick={onDelete}
            disabled={isProcessingCommand || task.isLocked}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ScheduledTaskDetailDialog;