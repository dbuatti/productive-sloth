import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, ListTodo, Sparkles, Loader2 } from 'lucide-react'; // Import Loader2
import SchedulerInput from '@/components/SchedulerInput';
import SchedulerDisplay from '@/components/SchedulerDisplay';
import { RawTaskInput, FormattedSchedule } from '@/types/scheduler';
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
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks'; // Import the new hook
import { useSession } from '@/hooks/use-session'; // Import useSession to check user

const SchedulerPage: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const { 
    dbScheduledTasks, // Supabase data with IDs
    rawTasks, // Converted for scheduler logic
    isLoading: isSchedulerTasksLoading, 
    addScheduledTask, 
    removeScheduledTask, 
    clearScheduledTasks 
  } = useSchedulerTasks();

  const [currentSchedule, setCurrentSchedule] = useState<FormattedSchedule | null>(null);
  const [T_current, setT_current] = useState(new Date());
  const [isProcessingCommand, setIsProcessingCommand] = useState(false); // Separate loading for commands
  const [injectionPrompt, setInjectionPrompt] = useState<{ taskName: string; isOpen: boolean } | null>(null);
  const [injectionDuration, setInjectionDuration] = useState('');
  const [injectionBreak, setInjectionBreak] = useState('');

  // Update T_current every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setT_current(new Date());
    }, 60 * 1000); // Every minute
    return () => clearInterval(interval);
  }, []);

  const generateSchedule = useCallback(() => {
    if (rawTasks.length === 0) {
      setCurrentSchedule(null);
      return;
    }
    // No need for local loading state here, use isSchedulerTasksLoading
    const schedule = calculateSchedule(rawTasks, new Date()); // Always use fresh T_current for calculation
    setCurrentSchedule(schedule);
  }, [rawTasks]);

  useEffect(() => {
    generateSchedule();
  }, [rawTasks, generateSchedule]);

  const handleCommand = async (input: string) => {
    if (!user) {
      showError("Please log in to use the scheduler.");
      return;
    }
    setIsProcessingCommand(true);
    
    const taskInput = parseTaskInput(input);
    const injectCommand = parseInjectionCommand(input);
    const command = parseCommand(input);

    if (taskInput) {
      await addScheduledTask({ name: taskInput.name, duration: taskInput.duration, break_duration: taskInput.breakDuration });
    } else if (injectCommand) {
      if (injectCommand.duration) {
        await addScheduledTask({ name: injectCommand.taskName, duration: injectCommand.duration, break_duration: injectCommand.breakDuration });
      } else {
        setInjectionPrompt({ taskName: injectCommand.taskName, isOpen: true });
      }
    } else if (command) {
      switch (command.type) {
        case 'clear':
          await clearScheduledTasks();
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
              // Remove tasks one by one, or implement a batch delete if available
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
      showError("Invalid input. Please use 'Task Name Duration [Break]' or a command.");
    }
    setIsProcessingCommand(false);
  };

  const handleInjectionSubmit = async () => {
    if (!user) {
      showError("Please log in to use the scheduler.");
      return;
    }
    if (injectionPrompt && injectionDuration) {
      const duration = parseInt(injectionDuration, 10);
      const breakDuration = injectionBreak ? parseInt(injectionBreak, 10) : undefined;

      if (isNaN(duration) || duration <= 0) {
        showError("Duration must be a positive number.");
        return;
      }

      await addScheduledTask({ name: injectionPrompt.taskName, duration, break_duration: breakDuration });
      setInjectionPrompt(null);
      setInjectionDuration('');
      setInjectionBreak('');
    }
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
            Examples: "Piano Practice 30", "Meeting 60 10", "Inject Gym", "Clear queue"
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
            <SchedulerDisplay schedule={currentSchedule} T_current={T_current} />
          )}
        </CardContent>
      </Card>

      {/* Injection Prompt Dialog */}
      <Dialog open={injectionPrompt?.isOpen || false} onOpenChange={(open) => !open && setInjectionPrompt(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>✨ Injection received: "{injectionPrompt?.taskName}"</DialogTitle>
            <DialogDescription>
              Please provide the duration and an optional break for this task.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
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