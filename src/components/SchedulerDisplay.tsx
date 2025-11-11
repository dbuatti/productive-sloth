import React, { useMemo, useState } from 'react';
import { FormattedSchedule, ScheduledItem, DBScheduledTask } from '@/types/scheduler';
import { format, isSameDay, parseISO, isBefore, isAfter, addMinutes, startOfDay } from 'date-fns'; // Added startOfDay
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle, XCircle, AlertTriangle, PlusCircle, Trash2, Archive } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface SchedulerDisplayProps {
  schedule: FormattedSchedule | null;
  T_current: Date;
  onRemoveTask: (taskId: string) => Promise<void>;
  onRetireTask: (task: DBScheduledTask) => Promise<void>; // Changed to accept DBScheduledTask
  activeItemId: string | null;
  selectedDayString: string;
  onAddTaskClick: () => void; // New prop for adding a task
}

const SchedulerDisplay: React.FC<SchedulerDisplayProps> = ({
  schedule,
  T_current,
  onRemoveTask,
  onRetireTask,
  activeItemId,
  selectedDayString,
  onAddTaskClick,
}) => {
  const selectedDay = useMemo(() => parseISO(selectedDayString), [selectedDayString]);
  const isToday = useMemo(() => isSameDay(selectedDay, T_current), [selectedDay, T_current]);

  // State for confirmation dialogs
  const [showRemoveConfirmation, setShowRemoveConfirmation] = useState(false);
  const [taskToRemove, setTaskToRemove] = useState<string | null>(null);
  const [showRetireConfirmation, setShowRetireConfirmation] = useState(false);
  const [taskToRetire, setTaskToRetire] = useState<DBScheduledTask | null>(null);

  const handleRemoveClick = (taskId: string) => {
    setTaskToRemove(taskId);
    setShowRemoveConfirmation(true);
  };

  const handleRetireClick = (task: DBScheduledTask) => {
    setTaskToRetire(task);
    setShowRetireConfirmation(true);
  };

  const confirmRemove = async () => {
    if (taskToRemove) {
      await onRemoveTask(taskToRemove);
      setTaskToRemove(null);
      setShowRemoveConfirmation(false);
    }
  };

  const confirmRetire = async () => {
    if (taskToRetire) {
      await onRetireTask(taskToRetire);
      setTaskToRetire(null);
      setShowRetireConfirmation(false);
    }
  };

  if (!schedule || schedule.items.length === 0) {
    return (
      <Card className="p-6 text-center text-muted-foreground animate-fade-in">
        <p className="text-lg mb-4">No tasks scheduled for {format(selectedDay, 'EEEE, MMMM d')}.</p>
        <Button onClick={onAddTaskClick} className="flex items-center gap-2">
          <PlusCircle className="h-5 w-5" /> Add Your First Task
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {schedule.items.map((item, index) => {
        const isCurrent = isToday && T_current >= item.startTime && T_current < item.endTime;
        const isPast = isToday && T_current >= item.endTime;
        const isFuture = isToday && T_current < item.startTime;
        const isSelectedDayPast = !isToday && isBefore(selectedDay, startOfDay(T_current));

        let statusIcon = null;
        let statusText = '';
        let progress = 0;

        if (isCurrent) {
          statusIcon = <Clock className="h-4 w-4 text-blue-500" />;
          statusText = 'Current';
          const totalDuration = item.endTime.getTime() - item.startTime.getTime();
          const elapsed = T_current.getTime() - item.startTime.getTime();
          progress = (elapsed / totalDuration) * 100;
        } else if (isPast || isSelectedDayPast) {
          statusIcon = <CheckCircle className="h-4 w-4 text-green-500" />;
          statusText = 'Completed';
          progress = 100;
        } else if (isFuture) {
          statusIcon = <AlertTriangle className="h-4 w-4 text-yellow-500" />;
          statusText = 'Upcoming';
        } else {
          // For future days, or tasks on past days that weren't 'current'
          statusIcon = <Clock className="h-4 w-4 text-muted-foreground" />;
          statusText = 'Scheduled';
        }

        const itemClass = `
          flex items-center justify-between p-4 rounded-lg shadow-sm transition-all duration-200 ease-in-out
          ${isCurrent ? 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-700 ring-2 ring-blue-400 animate-pulse-once' : ''}
          ${isPast || isSelectedDayPast ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-700 opacity-70' : ''}
          ${isFuture && !isCurrent ? 'bg-card border-border hover:shadow-md' : ''}
          ${item.id === activeItemId ? 'border-primary ring-2 ring-primary' : ''}
        `;

        return (
          <Card key={item.id} className={itemClass}>
            <CardContent className="flex-grow p-0">
              <div className="flex items-center gap-3">
                {statusIcon}
                <div className="flex-grow">
                  <p className="font-semibold text-lg">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(item.startTime, 'HH:mm')} - {format(item.endTime, 'HH:mm')} ({item.duration} min)
                  </p>
                </div>
              </div>
              {(isCurrent || isPast) && (
                <div className="mt-2">
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">{statusText}</p>
                </div>
              )}
            </CardContent>
            <div className="flex-shrink-0 flex items-center gap-2 ml-4">
              {item.type === 'task' && !isPast && !isSelectedDayPast && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={() => handleRetireClick(item.originalTask)} // Now item.originalTask is correctly typed
                        className="text-orange-500 hover:bg-orange-100 dark:hover:bg-orange-900"
                      >
                        <Archive className="h-4 w-4" />
                        <span className="sr-only">Retire Task</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Send to Aether Sink (Retire)</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="destructive" 
                        size="icon" 
                        onClick={() => handleRemoveClick(item.id)} 
                        className="hover:bg-destructive/90"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Remove Task</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Permanently remove task</p>
                    </TooltipContent>
                  </Tooltip>
                </>
              )}
            </div>
          </Card>
        );
      })}

      {/* Remove Confirmation Dialog */}
      <AlertDialog open={showRemoveConfirmation} onOpenChange={setShowRemoveConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently delete "{taskToRemove ? schedule?.items.find(i => i.id === taskToRemove)?.name : 'this task'}" from your schedule. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} className="bg-destructive hover:bg-destructive/90">
              Delete Task
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Retire Confirmation Dialog */}
      <AlertDialog open={showRetireConfirmation} onOpenChange={setShowRetireConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Retirement</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to send "{taskToRetire?.name || 'this task'}" to the Aether Sink? It will be removed from your schedule but can be re-zoned later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRetire}>
              Send to Sink
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SchedulerDisplay;