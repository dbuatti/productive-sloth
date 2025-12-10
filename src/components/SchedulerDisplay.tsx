import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, AlertCircle, Lock, Unlock, Zap, MoreHorizontal, Trash2, RotateCcw } from 'lucide-react';
import { FormattedSchedule, ScheduledItem } from '@/types/scheduler';
import { formatTime, getEmojiHue, getBreakDescription, isMeal } from '@/lib/scheduler-utils';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { useIsMobile } from '@/hooks/use-mobile';
import ScheduledTaskDetailDialog from '@/components/ScheduledTaskDetailDialog';
import { parseISO, isBefore, isAfter, isSameDay } from 'date-fns';

interface SchedulerDisplayProps {
  schedule: FormattedSchedule | null;
  T_current: Date;
  onRemoveTask: (taskId: string, taskName: string, index: number) => void;
  onRetireTask: (task: any) => void;
  onCompleteTask: (task: any, index: number) => void;
  activeItemId: string | null;
  selectedDayString: string;
  onAddTaskClick: () => void;
  onScrollToItem: (itemId: string) => void;
  isProcessingCommand: boolean;
}

const SchedulerDisplay: React.FC<SchedulerDisplayProps> = ({
  schedule,
  T_current,
  onRemoveTask,
  onRetireTask,
  onCompleteTask,
  activeItemId,
  selectedDayString,
  onAddTaskClick,
  onScrollToItem,
  isProcessingCommand
}) => {
  const [taskToDelete, setTaskToDelete] = useState<{ id: string; name: string; index: number } | null>(null);
  const [taskToRetire, setTaskToRetire] = useState<any | null>(null);
  const [taskToComplete, setTaskToComplete] = useState<{ task: any; index: number } | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRetireDialog, setShowRetireDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [showTaskDetailDialog, setShowTaskDetailDialog] = useState(false);
  const isMobile = useIsMobile();

  const handleDeleteTask = (id: string, name: string, index: number) => {
    setTaskToDelete({ id, name, index });
    setShowDeleteDialog(true);
  };

  const confirmDeleteTask = () => {
    if (taskToDelete) {
      onRemoveTask(taskToDelete.id, taskToDelete.name, taskToDelete.index);
      setShowDeleteDialog(false);
      setTaskToDelete(null);
    }
  };

  const handleRetireTask = (task: any) => {
    setTaskToRetire(task);
    setShowRetireDialog(true);
  };

  const confirmRetireTask = () => {
    if (taskToRetire) {
      onRetireTask(taskToRetire);
      setShowRetireDialog(false);
      setTaskToRetire(null);
    }
  };

  const handleCompleteTask = (task: any, index: number) => {
    setTaskToComplete({ task, index });
    setShowCompleteDialog(true);
  };

  const confirmCompleteTask = () => {
    if (taskToComplete) {
      onCompleteTask(taskToComplete.task, taskToComplete.index);
      setShowCompleteDialog(false);
      setTaskToComplete(null);
    }
  };

  const handleTaskClick = (task: any) => {
    setSelectedTask(task);
    setShowTaskDetailDialog(true);
  };

  const isTaskInPast = (task: ScheduledItem) => {
    const selectedDay = new Date(selectedDayString);
    return isBefore(selectedDay, new Date()) || 
           (isSameDay(selectedDay, new Date()) && isBefore(task.endTime, T_current));
  };

  if (!schedule) {
    return (
      <div className="text-center py-12">
        <div className="text-lg text-muted-foreground mb-4">
          No schedule yet. Add some tasks to get started!
        </div>
        <Button onClick={onAddTaskClick} disabled={isProcessingCommand}>
          Add Your First Task
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Schedule Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-primary">{schedule.summary.totalTasks}</div>
          <div className="text-sm text-muted-foreground">Total Tasks</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-logo-green">{schedule.summary.completedCount}</div>
          <div className="text-sm text-muted-foreground">Completed</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-destructive">{schedule.summary.criticalCount}</div>
          <div className="text-sm text-muted-foreground">Critical</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-logo-yellow">{schedule.summary.totalDuration}m</div>
          <div className="text-sm text-muted-foreground">Total Time</div>
        </Card>
      </div>

      {/* Schedule Items */}
      <div className="space-y-3">
        {schedule.items.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-lg text-muted-foreground mb-4">
              No tasks scheduled for this day.
            </div>
            <Button onClick={onAddTaskClick} disabled={isProcessingCommand}>
              Add Your First Task
            </Button>
          </div>
        ) : (
          schedule.items.map((item, index) => {
            const isActive = activeItemId === item.id;
            const isPast = isTaskInPast(item);
            const isLocked = item.isLocked;
            const isCritical = item.isCritical;
            const isMealTask = isMeal(item.name);
            
            return (
              <div 
                key={item.id}
                id={`scheduled-item-${item.id}`}
                className={cn(
                  "relative border rounded-lg p-4 transition-all duration-200",
                  isActive && "ring-2 ring-primary ring-offset-2",
                  isPast && "opacity-70",
                  isLocked && "border-dashed"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center mt-1">
                    <div className="text-sm font-medium text-muted-foreground">
                      {formatTime(item.startTime)}
                    </div>
                    <div className="text-xs text-muted-foreground">to</div>
                    <div className="text-sm font-medium text-muted-foreground">
                      {formatTime(item.endTime)}
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 
                            className={cn(
                              "font-medium truncate cursor-pointer hover:underline",
                              isPast && "line-through"
                            )}
                            onClick={() => handleTaskClick(item)}
                          >
                            {item.name}
                          </h3>
                          {isCritical && (
                            <Zap className="h-4 w-4 text-destructive flex-shrink-0" />
                          )}
                          {isLocked && (
                            <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <Badge 
                            variant="secondary" 
                            className={cn(
                              "text-xs",
                              isMealTask && "bg-green-100 text-green-800"
                            )}
                          >
                            {item.duration} min
                          </Badge>
                          {item.breakDuration > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {getBreakDescription(item.breakDuration)}
                            </Badge>
                          )}
                          {isLocked && (
                            <Badge variant="outline" className="text-xs">
                              Locked
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-8 w-8"
                            disabled={isProcessingCommand}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => handleCompleteTask(item, index)}
                            disabled={isProcessingCommand || isPast}
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Complete
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleRetireTask(item)}
                            disabled={isProcessingCommand || isLocked || isPast}
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Move to Sink
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleTaskClick(item)}
                            disabled={isProcessingCommand}
                          >
                            <MoreHorizontal className="mr-2 h-4 w-4" />
                            Details
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteTask(item.id, item.name, index)}
                            disabled={isProcessingCommand || isLocked}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && taskToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <h3 className="text-lg font-semibold">Delete Task</h3>
            </div>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to permanently delete "{taskToDelete.name}"? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
                disabled={isProcessingCommand}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDeleteTask}
                disabled={isProcessingCommand}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Retire Confirmation Dialog */}
      {showRetireDialog && taskToRetire && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center gap-2 mb-4">
              <RotateCcw className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Move to Aether Sink</h3>
            </div>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to move "{taskToRetire.name}" to the Aether Sink? You can reschedule it later.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowRetireDialog(false)}
                disabled={isProcessingCommand}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmRetireTask}
                disabled={isProcessingCommand}
              >
                Move to Sink
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Confirmation Dialog */}
      {showCompleteDialog && taskToComplete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center gap-2 mb-4">
              <RotateCcw className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Complete Task</h3>
            </div>
            <p className="text-muted-foreground mb-6">
              Mark "{taskToComplete.task.name}" as completed?
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowCompleteDialog(false)}
                disabled={isProcessingCommand}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmCompleteTask}
                disabled={isProcessingCommand}
              >
                Complete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Task Detail Dialog */}
      {selectedTask && (
        <ScheduledTaskDetailDialog
          task={selectedTask}
          open={showTaskDetailDialog}
          onOpenChange={setShowTaskDetailDialog}
          onRetire={handleRetireTask}
          onComplete={() => handleCompleteTask(selectedTask, 0)}
          onDelete={() => handleDeleteTask(selectedTask.id, selectedTask.name, 0)}
          isProcessingCommand={isProcessingCommand}
        />
      )}
    </div>
  );
};

export default SchedulerDisplay;