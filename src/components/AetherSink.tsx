import React, { useState } from 'react';
import { RetiredTask, SortBy } from '@/types/scheduler';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RotateCcw, Zap, Lock, Unlock, MoreHorizontal, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatTime, getEmojiHue, getBreakDescription, isMeal } from '@/lib/scheduler-utils';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import RetiredTaskDetailDialog from '@/components/RetiredTaskDetailDialog';

interface AetherSinkProps {
  retiredTasks: RetiredTask[];
  onRezoneTask: (task: RetiredTask) => void;
  onRemoveRetiredTask: (taskId: string, taskName: string) => void;
  onAutoScheduleSink: () => void;
  isLoading: boolean;
  isProcessingCommand: boolean;
  hideTitle?: boolean;
  profileEnergy: number;
  retiredSortBy: SortBy;
  setRetiredSortBy: (sortBy: SortBy) => void;
}

const AetherSink: React.FC<AetherSinkProps> = ({
  retiredTasks,
  onRezoneTask,
  onRemoveRetiredTask,
  onAutoScheduleSink,
  isLoading,
  isProcessingCommand,
  hideTitle = false,
  profileEnergy,
  retiredSortBy,
  setRetiredSortBy,
}) => {
  const [taskToDelete, setTaskToDelete] = useState<{ id: string; name: string } | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedTask, setSelectedTask] = useState<RetiredTask | null>(null);
  const [showTaskDetailDialog, setShowTaskDetailDialog] = useState(false);

  const handleDeleteTask = (id: string, name: string) => {
    setTaskToDelete({ id, name });
    setShowDeleteDialog(true);
  };

  const confirmDeleteTask = () => {
    if (taskToDelete) {
      onRemoveRetiredTask(taskToDelete.id, taskToDelete.name);
      setShowDeleteDialog(false);
      setTaskToDelete(null);
    }
  };

  const handleTaskClick = (task: RetiredTask) => {
    setSelectedTask(task);
    setShowTaskDetailDialog(true);
  };

  if (isLoading) {
    return (
      <Card className="p-6 animate-pop-in bg-primary-wash rounded-lg animate-hover-lift shadow-lg">
        <div className="text-center py-8">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="mt-2 text-muted-foreground">Loading Aether Sink...</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {!hideTitle && (
        <Card className="p-6 animate-pop-in bg-primary-wash rounded-lg animate-hover-lift shadow-lg">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Zap className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-bold text-foreground">Aether Sink</h2>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                onClick={onAutoScheduleSink} 
                disabled={isProcessingCommand || retiredTasks.length === 0}
                className="bg-primary hover:bg-primary/90"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Auto-Schedule Sink
              </Button>
            </div>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {retiredTasks.length} task{retiredTasks.length !== 1 ? 's' : ''} waiting to be rescheduled
          </p>
        </Card>
      )}

      <Card className="animate-pop-in animate-hover-lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Zap className="h-5 w-5 text-primary" />
            Retired Tasks
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {retiredTasks.length === 0 ? (
            <div className="text-center py-12">
              <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Aether Sink is Empty</h3>
              <p className="text-muted-foreground">
                Completed tasks will appear here when moved from your schedule.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {retiredTasks.map((task) => {
                const isMealTask = isMeal(task.name);
                const hue = getEmojiHue(task.name);
                
                return (
                  <div 
                    key={task.id}
                    className={cn(
                      "relative border rounded-lg p-4 transition-all duration-200 hover:shadow-md",
                      task.is_locked && "border-dashed opacity-75"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 
                            className="font-medium truncate cursor-pointer hover:underline"
                            onClick={() => handleTaskClick(task)}
                          >
                            {task.name}
                          </h3>
                          {task.is_critical && (
                            <Zap className="h-4 w-4 text-destructive flex-shrink-0" />
                          )}
                          {task.is_locked && (
                            <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {task.duration && (
                            <Badge 
                              variant="secondary" 
                              className={cn(
                                "text-xs",
                                isMealTask && "bg-green-100 text-green-800"
                              )}
                            >
                              {task.duration} min
                            </Badge>
                          )}
                          {task.break_duration && task.break_duration > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {getBreakDescription(task.break_duration)}
                            </Badge>
                          )}
                          {task.is_locked && (
                            <Badge variant="outline" className="text-xs">
                              Locked
                            </Badge>
                          )}
                          {task.is_completed && (
                            <Badge variant="outline" className="text-xs">
                              Completed
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
                            onClick={() => onRezoneTask(task)}
                            disabled={isProcessingCommand || task.is_locked}
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Re-zone
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleTaskClick(task)}
                            disabled={isProcessingCommand}
                          >
                            <MoreHorizontal className="mr-2 h-4 w-4" />
                            Details
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteTask(task.id, task.name)}
                            disabled={isProcessingCommand || task.is_locked}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && taskToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center gap-2 mb-4">
              <Trash2 className="h-5 w-5 text-destructive" />
              <h3 className="text-lg font-semibold">Delete Retired Task</h3>
            </div>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to permanently delete "{taskToDelete.name}" from the Aether Sink? This action cannot be undone.
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

      {/* Task Detail Dialog */}
      {selectedTask && (
        <RetiredTaskDetailDialog
          task={selectedTask}
          open={showTaskDetailDialog}
          onOpenChange={setShowTaskDetailDialog}
          onRezone={onRezoneTask}
          onDelete={handleDeleteTask}
          isProcessingCommand={isProcessingCommand}
        />
      )}
    </div>
  );
};

export default AetherSink;