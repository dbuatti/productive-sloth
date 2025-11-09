import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, ListTodo, Sparkles, Loader2 } from 'lucide-react';
import SchedulerInput from '@/components/SchedulerInput';
import SchedulerDisplay from '@/components/SchedulerDisplay';
import { FormattedSchedule, DBScheduledTask } from '@/types/scheduler';
import {
  calculateSchedule,
  parseTaskInput,
  parseInjectionCommand,
  parseCommand,
  formatDateTime,
} from '@/lib/scheduler-utils';
import { showSuccess, showError } from '@/utils/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import { useSession } from '@/hooks/use-session';
import { parse, startOfDay, setHours, setMinutes } from 'date-fns'; // Import startOfDay, setHours, setMinutes

const SchedulerPage: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const { 
    dbScheduledTasks,
    isLoading: isSchedulerTasksLoading, 
    addScheduledTask, 
    removeScheduledTask, 
    clearScheduledTasks 
  } = useSchedulerTasks();

  const [currentSchedule, setCurrentSchedule] = useState<FormattedSchedule | null>(null);
  const [T_current, setT_current] = useState(new Date());
  const [T_Anchor, setT_Anchor] = useState<Date | null>(null); // T_Anchor is now dynamic, set once
  const [isProcessingCommand, setIsProcessingCommand] = useState(false);
  const [injectionPrompt, setInjectionPrompt] = useState<{ taskName: string; isOpen: boolean; isTimed?: boolean; startTime?: string; endTime?: string } | null>(null);
  const [injectionDuration, setInjectionDuration] = useState('');
  const [injectionBreak, setInjectionBreak] = useState('');
  const [injectionStartTime, setInjectionStartTime] = useState('');
  const [injectionEndTime, setInjectionEndTime] = useState('');

  // Update T_current every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setT_current(new Date());
    }, 60 * 1000); // Every minute
    return () => clearInterval(interval);
  }, []);

  const generateSchedule = useCallback(() => {
    if (dbScheduledTasks.length === 0) {
      setCurrentSchedule(null);
      setT_Anchor(null); // Reset T_Anchor if no tasks
      return;
    }
    
    // Capture T_Anchor dynamically only if it hasn't been set yet
    const effectiveTAnchor = T_Anchor || new Date();
    if (!T_Anchor) {
      setT_Anchor(effectiveTAnchor);
    }

    const schedule = calculateSchedule(dbScheduledTasks, effectiveTAnchor); // Pass T_Anchor to calculation
    setCurrentSchedule(schedule);
  }, [dbScheduledTasks, T_Anchor]); // T_Anchor is now a dependency

  useEffect(() => {
    generateSchedule();
  }, [dbScheduledTasks, generateSchedule]);

  const handleCommand = async (input: string) => {
    if (!user) {
      showError("Please log in to use the scheduler.");
      return;
    }
    setIsProcessingCommand(true);
    
    const parsedInput = parseTaskInput(input);
    const injectCommand = parseInjectionCommand(input);
    const command = parseCommand(input);

    if (parsedInput) {
      // Check if it's a duration-based task or a timed event
      if ('duration' in parsedInput) {
        // Duration-based task
        await addScheduledTask({ name: parsedInput.name, duration: parsedInput.duration, break_duration: parsedInput.breakDuration });
      } else {
        // Timed event
        await addScheduledTask({ name: parsedInput.name, start_time: parsedInput.startTime.toISOString(), end_time: parsedInput.endTime.toISOString() });
      }
    } else if (injectCommand) {
      if (injectCommand.duration) {
        await addScheduledTask({ name: injectCommand.taskName, duration: injectCommand.duration, break_duration: injectCommand.breakDuration });
      } else if (injectCommand.startTime && injectCommand.endTime) {
        const now = new Date();
        const startTime = parse(injectCommand.startTime, 'h:mm a', now);
        const endTime = parse(injectCommand.endTime, 'h:mm a', now);
        await addScheduledTask({ name: injectCommand.taskName, start_time: startTime.toISOString(), end_time: endTime.toISOString() });
      }
      else {
        // Prompt for duration/break or start/end time
        setInjectionPrompt({ 
          taskName: injectCommand.taskName, 
          isOpen: true, 
          isTimed: !!(injectCommand.startTime || injectCommand.endTime), // Indicate if it's a timed injection
          startTime: injectCommand.startTime,
          endTime: injectCommand.endTime
        });
      }
    } else if (command) {
      switch (command.type) {
        case 'clear':
          await clearScheduledTasks();
          setT_Anchor(null); // Reset T_Anchor when clearing all tasks
          break;
        case 'remove':
          if (command.index !== undefined) {
            if (command.index >= 0 && command.index < dbScheduledTasks.length) {
              const taskToRemove = dbScheduledTasks[command.index];
              await removeScheduledTask(taskToRemove.id);
            } else {
              showError(`Invalid index. Please provide a number between 1 and ${dbScheduledTasks.length}.`);
            }
          } else if (command.target) {
            const tasksToRemove = dbScheduledTasks.filter(task => task.name.toLowerCase().includes(command.target!.toLowerCase()));
            if (tasksToRemove.length > 0) {
              for (const task of tasksToRemove) {
                await removeScheduledTask(task.id);
              }
              showSuccess(`Removed tasks matching "${command.target}".`);
            } else {
              showError(`No tasks found matching "${command.target}".`);
            }
          } else {
            showError("Please specify a task name or index to remove (e.g., 'remove Task Name' or 'remove index 1').");
          }
          break;
        case 'show':
          showSuccess("Displaying current queue.");
          break;
        case 'reorder':
          showError("Reordering is not yet implemented.");
          break;
        default:
          showError("Unknown command.");
      }
    } else {
      showError("Invalid input. Please use 'Task Name Duration [Break]', 'Task Name HH:MM AM/PM - HH:MM AM/PM', or a command.");
    }
    setIsProcessingCommand(false);
  };

  const handleInjectionSubmit = async () => {
    if (!user || !injectionPrompt) {
      showError("You must be logged in to use the scheduler.");
      return;
    }

    if (injectionPrompt.isTimed) {
      if (!injectionStartTime || !injectionEndTime) {
        showError("Start time and end time are required for timed injection.");
        return;
      }
      const now = new Date();
      const startTime = parse(injectionStartTime, 'h:mm a', now);
      const endTime = parse(injectionEndTime, 'h:mm a', now);
      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        showError("Invalid time format for start/end times.");
        return;
      }
      await addScheduledTask({ name: injectionPrompt.taskName, start_time: startTime.toISOString(), end_time: endTime.toISOString() });
    } else {
      if (!injectionDuration) {
        showError("Duration is required for duration-based injection.");
        return;
      }
      const duration = parseInt(injectionDuration, 10);
      const breakDuration = injectionBreak ? parseInt(injectionBreak, 10) : undefined;

      if (isNaN(duration) || duration <= 0) {
        showError("Duration must be a positive number.");
        return;
      }
      await addScheduledTask({ name: injectionPrompt.taskName, duration, break_duration: breakDuration });
    }
    
    setInjectionPrompt(null);
    setInjectionDuration('');
    setInjectionBreak('');
    setInjectionStartTime('');
    setInjectionEndTime('');
  };

  const overallLoading = isSessionLoading || isSchedulerTasksLoading || isProcessingCommand;

  if (isSessionLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto p-4 max-w-3xl space-y-6 text-center text-muted-foreground">
        <h1 className="text-3xl font-bold text-foreground flex items-center justify-center gap-2 animate-slide-in-up">
          <Clock className="h-7 w-7 text-primary" /> Vibe Scheduler
        </h1>
        <p className="text-lg">Please log in to use the Vibe Scheduler.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold text-foreground flex items-center gap-2 animate-slide-in-up">
        <Clock className="h-7 w-7 text-primary" /> Vibe Scheduler
      </h1>

      <Card className="animate-pop-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <ListTodo className="h-5 w-5 text-primary" /> Schedule Your Day
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Current Time: <span className="font-semibold">{formatDateTime(T_current)}</span>
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <SchedulerInput onCommand={handleCommand} isLoading={overallLoading} />
          <p className="text-xs text-muted-foreground">
            Examples: "Piano Practice 30", "Meeting 60 10", "Mindfulness 11am - 12pm", "Inject Gym", "Inject Meeting from 2pm to 3pm", "Clear queue"
          </p>
        </CardContent>
      </Card>

      <Card className="animate-pop-in" style={{ animationDelay: '0.1s' }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-logo-yellow" /> Your Vibe Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isSchedulerTasksLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <SchedulerDisplay schedule={currentSchedule} T_current={T_current} onRemoveTask={removeScheduledTask} />
          )}
        </CardContent>
      </Card>

      {/* Injection Prompt Dialog */}
      <Dialog open={injectionPrompt?.isOpen || false} onOpenChange={(open) => !open && setInjectionPrompt(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>✨ Injection received: "{injectionPrompt?.taskName}"</DialogTitle>
            <DialogDescription>
              Please provide the details for this task.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {injectionPrompt?.isTimed ? (
              <>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="startTime" className="text-right">
                    Start Time
                  </Label>
                  <Input
                    id="startTime"
                    type="text"
                    placeholder="e.g., 11am"
                    value={injectionStartTime}
                    onChange={(e) => setInjectionStartTime(e.target.value)}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="endTime" className="text-right">
                    End Time
                  </Label>
                  <Input
                    id="endTime"
                    type="text"
                    placeholder="e.g., 12pm"
                    value={injectionEndTime}
                    onChange={(e) => setInjectionEndTime(e.target.value)}
                    className="col-span-3"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="duration" className="text-right">
                    Duration (min)
                  </Label>
                  <Input
                    id="duration"
                    type="number"
                    value={injectionDuration}
                    onChange={(e) => setInjectionDuration(e.target.value)}
                    className="col-span-3"
                    min="1"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="break" className="text-right">
                    Break (min, optional)
                  </Label>
                  <Input
                    id="break"
                    type="number"
                    value={injectionBreak}
                    onChange={(e) => setInjectionBreak(e.target.value)}
                    className="col-span-3"
                    min="0"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button type="button" onClick={handleInjectionSubmit}>
              Add Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SchedulerPage;