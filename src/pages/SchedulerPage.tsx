import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, ListTodo, Sparkles, Loader2 } from 'lucide-react';
import SchedulerInput from '@/components/SchedulerInput';
import SchedulerDisplay from '@/components/SchedulerDisplay';
import { FormattedSchedule, DBScheduledTask, ScheduledItem, NewDBScheduledTask } from '@/types/scheduler';
import {
  calculateSchedule,
  parseTaskInput,
  parseInjectionCommand,
  parseCommand,
  formatDateTime,
  parseFlexibleTime,
  formatTime, // Import formatTime for success message
} from '@/lib/scheduler-utils';
import { showSuccess, showError } from '@/utils/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import { useSession } from '@/hooks/use-session';
import { parse, startOfDay, setHours, setMinutes, format, isSameDay, addDays, addMinutes, parseISO, isPast } from 'date-fns';
import SchedulerDashboardPanel from '@/components/SchedulerDashboardPanel';
import NowFocusCard from '@/components/NowFocusCard';
import CalendarStrip from '@/components/CalendarStrip';
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
} from "@/components/ui/alert-dialog"; // Import AlertDialog components

const SchedulerPage: React.FC = () => {
  const { user, profile, isLoading: isSessionLoading } = useSession();
  const [selectedDay, setSelectedDay] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const { 
    dbScheduledTasks,
    isLoading: isSchedulerTasksLoading, 
    addScheduledTask, 
    removeScheduledTask, 
    clearScheduledTasks,
    datesWithTasks,
  } = useSchedulerTasks(selectedDay);

  const [currentSchedule, setCurrentSchedule] = useState<FormattedSchedule | null>(null);
  const [T_current, setT_current] = useState(new Date());
  
  // Removed tAnchorForSelectedDay from useState

  const [isProcessingCommand, setIsProcessingCommand] = useState(false);
  const [injectionPrompt, setInjectionPrompt] = useState<{ taskName: string; isOpen: boolean; isTimed?: boolean; startTime?: string; endTime?: string } | null>(null);
  const [injectionDuration, setInjectionDuration] = useState('');
  const [injectionBreak, setInjectionBreak] = useState('');
  const [injectionStartTime, setInjectionStartTime] = useState('');
  const [injectionEndTime, setInjectionEndTime] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [showClearConfirmation, setShowClearConfirmation] = useState(false); // New state for clear confirmation

  const formattedSelectedDay = selectedDay;

  // Update T_current every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setT_current(new Date());
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Memoized effective start time for scheduling new duration-based tasks
  const effectiveAutoScheduleStartTime = useMemo(() => {
    const selectedDayDate = parseISO(formattedSelectedDay);
    const defaultTimeParts = profile?.default_auto_schedule_start_time?.split(':').map(Number) || [9, 0]; // Default to 9:00 if not set
    
    let baseTime = setHours(setMinutes(startOfDay(selectedDayDate), defaultTimeParts[1]), defaultTimeParts[0]);

    // If the selected day is today, and the base time is in the past, use current time
    // Also, if the selected day is in the past, the anchor should be the start of that day
    if (isSameDay(selectedDayDate, T_current)) {
      return isPast(baseTime) ? T_current : baseTime;
    } else if (isPast(selectedDayDate)) {
      return startOfDay(selectedDayDate);
    }
    return baseTime;
  }, [formattedSelectedDay, T_current, profile?.default_auto_schedule_start_time]);

  // Removed the useEffect block that managed tAnchorForSelectedDay and localStorage

  // Calculate the schedule based on tasks, selected day, and effective anchor
  const calculatedSchedule = useMemo(() => {
    console.log("SchedulerPage: calculatedSchedule useMemo triggered.");
    console.log("SchedulerPage: dbScheduledTasks received:", dbScheduledTasks.map(t => ({ id: t.id, name: t.name, scheduled_date: t.scheduled_date, start_time: t.start_time, end_time: t.end_time })));
    console.log("SchedulerPage: Effective Auto-Schedule Start Time for calculation:", effectiveAutoScheduleStartTime?.toISOString());
    // Pass effectiveAutoScheduleStartTime to calculateSchedule for internal logic
    return calculateSchedule(dbScheduledTasks, effectiveAutoScheduleStartTime, T_current, selectedDay);
  }, [dbScheduledTasks, selectedDay, effectiveAutoScheduleStartTime, T_current]); // Added T_current to dependencies

  // Set currentSchedule state from the memoized calculation
  useEffect(() => {
    setCurrentSchedule(calculatedSchedule);
  }, [calculatedSchedule]);

  const handleClearSchedule = async () => {
    if (!user) {
      showError("You must be logged in to clear your schedule.");
      return;
    }
    setIsProcessingCommand(true);
    await clearScheduledTasks();
    // No need to reset tAnchorForSelectedDay or localStorage here as it's now memoized
    setIsProcessingCommand(false);
    setShowClearConfirmation(false); // Close dialog
    setInputValue(''); // Clear input after successful command
  };

  const handleCommand = async (input: string) => {
    if (!user) {
      showError("Please log in to use the scheduler.");
      setIsProcessingCommand(false);
      return;
    }
    setIsProcessingCommand(true);
    
    console.log("SchedulerPage: handleCommand - Raw input:", input);
    const parsedInput = parseTaskInput(input);
    console.log("SchedulerPage: handleCommand - parseTaskInput result:", parsedInput);
    const injectCommand = parseInjectionCommand(input);
    console.log("SchedulerPage: handleCommand - parseInjectionCommand result:", injectCommand);
    const command = parseCommand(input);
    console.log("SchedulerPage: handleCommand - parseCommand result:", command);

    let success = false;

    if (parsedInput) {
      console.log("SchedulerPage: handleCommand - Processing as parsedInput.");
      const isAdHocTask = 'duration' in parsedInput; // This will now be true for duration-only inputs

      const taskScheduledDate = formattedSelectedDay;
      const selectedDayDate = parseISO(selectedDay);

      if (isAdHocTask) {
        // For duration-only tasks, automatically calculate start and end times
        let proposedStartTime: Date;
        // If there's an existing schedule, start after the last item, otherwise use effectiveAutoScheduleStartTime
        if (currentSchedule && currentSchedule.items.length > 0) {
          proposedStartTime = currentSchedule.summary.sessionEnd;
        } else {
          proposedStartTime = effectiveAutoScheduleStartTime;
        }
        
        // Ensure proposedStartTime is not in the past if it's today
        if (isSameDay(selectedDayDate, T_current) && proposedStartTime.getTime() < T_current.getTime()) {
          proposedStartTime = T_current;
        }

        const proposedEndTime = addMinutes(proposedStartTime, parsedInput.duration!);

        console.log(`SchedulerPage: handleCommand - Adding duration-based task as fixed appointment.`);
        await addScheduledTask({ 
          name: parsedInput.name, 
          start_time: proposedStartTime.toISOString(), 
          end_time: proposedEndTime.toISOString(), 
          scheduled_date: taskScheduledDate 
        });
        showSuccess(`Scheduled "${parsedInput.name}" from ${formatTime(proposedStartTime)} to ${formatTime(proposedEndTime)}.`);
        success = true;
      } else {
        // This is a timed event (e.g., "Meeting 11am - 12pm")
        let startTime = setHours(setMinutes(startOfDay(selectedDayDate), parsedInput.startTime!.getMinutes()), parsedInput.startTime!.getHours());
        let endTime = setHours(setMinutes(startOfDay(selectedDayDate), parsedInput.endTime!.getMinutes()), parsedInput.endTime!.getHours());
        
        if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
          showError("Invalid time format for start/end times.");
          setIsProcessingCommand(false);
          return;
        }

        // If the selected day is today, and the proposed start time is in the past,
        // shift the task to the next day.
        if (isSameDay(selectedDayDate, T_current) && startTime.getTime() < T_current.getTime()) {
          startTime = addDays(startTime, 1);
          endTime = addDays(endTime, 1);
          showSuccess(`Scheduled "${parsedInput.name}" for tomorrow at ${formatTime(startTime)} as today's time has passed.`);
        } else if (endTime.getTime() < startTime.getTime()) {
          // Handle rollover within the same day (e.g., 11 PM - 1 AM)
          endTime = addDays(endTime, 1);
        }

        console.log(`SchedulerPage: handleCommand - Storing timed task. Input Start: ${format(parsedInput.startTime!, 'hh:mm a')}, Input End: ${format(parsedInput.endTime!, 'hh:mm a')}`);
        console.log(`SchedulerPage: handleCommand - Parsed Start (local): ${startTime.toLocaleString()}, Parsed End (local): ${endTime.toLocaleString()}`);
        console.log(`SchedulerPage: handleCommand - Storing Start (ISO): ${startTime.toISOString()}, Storing End (ISO): ${endTime.toISOString()}`);

        await addScheduledTask({ name: parsedInput.name, start_time: startTime.toISOString(), end_time: endTime.toISOString(), scheduled_date: taskScheduledDate });
        success = true;
      }
    } else if (injectCommand) {
      console.log("SchedulerPage: handleCommand - Processing as injectCommand.");
      const isAdHocInjection = !injectCommand.startTime && !injectCommand.endTime;

      const taskScheduledDate = formattedSelectedDay;
      const selectedDayDate = parseISO(selectedDay);

      if (isAdHocInjection) {
        // For duration-only injections, automatically calculate start and end times
        let proposedStartTime: Date;
        if (currentSchedule && currentSchedule.items.length > 0) {
          proposedStartTime = currentSchedule.summary.sessionEnd;
        } else {
          proposedStartTime = effectiveAutoScheduleStartTime;
        }

        if (isSameDay(selectedDayDate, T_current) && proposedStartTime.getTime() < T_current.getTime()) {
          proposedStartTime = T_current;
        }

        const duration = injectCommand.duration || 30; // Default duration for inject if not specified
        const proposedEndTime = addMinutes(proposedStartTime, duration);

        await addScheduledTask({ 
          name: injectCommand.taskName, 
          start_time: proposedStartTime.toISOString(), 
          end_time: proposedEndTime.toISOString(), 
          break_duration: injectCommand.breakDuration, 
          scheduled_date: taskScheduledDate 
        });
        showSuccess(`Injected "${injectCommand.taskName}" from ${formatTime(proposedStartTime)} to ${formatTime(proposedEndTime)}.`);
        success = true;
      } else if (injectCommand.startTime && injectCommand.endTime) {
        console.log("SchedulerPage: handleCommand - Opening injection dialog for timed event.");
        setInjectionPrompt({ 
          taskName: injectCommand.taskName, 
          isOpen: true, 
          isTimed: true,
          startTime: injectCommand.startTime,
          endTime: injectCommand.endTime
        });
        setInjectionStartTime(injectCommand.startTime);
        setInjectionEndTime(injectCommand.endTime);
        success = true;
      }
      else {
        console.log("SchedulerPage: handleCommand - Opening injection dialog for duration-based task.");
        setInjectionPrompt({ 
          taskName: injectCommand.taskName, 
          isOpen: true, 
          isTimed: false,
          startTime: undefined,
          endTime: undefined
        });
        success = true;
      }
    } else if (command) {
      console.log("SchedulerPage: handleCommand - Processing as command.");
      switch (command.type) {
        case 'clear':
          setShowClearConfirmation(true); // Open confirmation dialog
          success = true; // Mark as success to clear input, but actual clear happens after confirmation
          break;
        case 'remove':
          if (command.index !== undefined) {
            if (command.index >= 0 && command.index < dbScheduledTasks.length) {
              const taskToRemove = dbScheduledTasks[command.index];
              await removeScheduledTask(taskToRemove.id);
              success = true;
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
              success = true;
            } else {
              showError(`No tasks found matching "${command.target}".`);
            }
          } else {
            showError("Please specify a task name or index to remove (e.g., 'remove Task Name' or 'remove index 1').");
          }
          break;
        case 'show':
          showSuccess("Displaying current queue.");
          success = true;
          break;
        case 'reorder':
          showError("Reordering is not yet implemented.");
          break;
        default:
          showError("Unknown command.");
      }
    } else {
      console.log("SchedulerPage: handleCommand - No valid parse result found.");
      showError("Invalid input. Please use 'Task Name Duration [Break]', 'Task Name HH:MM AM/PM - HH:MM AM/PM', or a command.");
    }
    
    setIsProcessingCommand(false);
    if (success) {
      setInputValue('');
    }
  };

  const handleInjectionSubmit = async () => {
    if (!user || !injectionPrompt) {
      showError("You must be logged in to use the scheduler.");
      return;
    }

    let success = false;
    const isAdHocInjection = !injectionPrompt.isTimed;

    const taskScheduledDate = formattedSelectedDay;
    const selectedDayDate = parseISO(selectedDay);

    if (injectionPrompt.isTimed) {
      if (!injectionStartTime || !injectionEndTime) {
        showError("Start time and end time are required for timed injection.");
        setIsProcessingCommand(false);
        return;
      }
      const tempStartTime = parseFlexibleTime(injectionStartTime, selectedDayDate);
      const tempEndTime = parseFlexibleTime(injectionEndTime, selectedDayDate);

      let startTime = setHours(setMinutes(startOfDay(selectedDayDate), tempStartTime.getMinutes()), tempStartTime.getHours());
      let endTime = setHours(setMinutes(startOfDay(selectedDayDate), tempEndTime.getMinutes()), tempEndTime.getHours());

      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        showError("Invalid time format for start/end times.");
        setIsProcessingCommand(false);
        return;
      }

      // If the selected day is today, and the proposed start time is in the past,
      // shift the task to the next day.
      if (isSameDay(selectedDayDate, T_current) && startTime.getTime() < T_current.getTime()) {
        startTime = addDays(startTime, 1);
        endTime = addDays(endTime, 1);
        showSuccess(`Scheduled "${injectionPrompt.taskName}" for tomorrow at ${formatTime(startTime)} as today's time has passed.`);
      } else if (endTime.getTime() < startTime.getTime()) {
        endTime.setDate(endTime.getDate() + 1);
      }
      console.log(`SchedulerPage: handleInjectionSubmit - Storing timed injection. Local Start Date: ${startTime.toLocaleString()}, Local End Date: ${endTime.toLocaleString()}`);
      console.log(`SchedulerPage: handleInjectionSubmit - Storing Start (ISO): ${startTime.toISOString()}, Storing End (ISO): ${endTime.toISOString()}`);
      await addScheduledTask({ name: injectionPrompt.taskName, start_time: startTime.toISOString(), end_time: endTime.toISOString(), scheduled_date: taskScheduledDate });
      success = true;
    } else {
      if (!injectionDuration) {
        showError("Duration is required for duration-based injection.");
        setIsProcessingCommand(false);
        return;
      }
      const duration = parseInt(injectionDuration, 10);
      const breakDuration = injectionBreak ? parseInt(injectionBreak, 10) : undefined;

      if (isNaN(duration) || duration <= 0) {
        showError("Duration must be a positive number.");
        setIsProcessingCommand(false);
        return;
      }
      
      // For duration-only injections, automatically calculate start and end times
      let proposedStartTime: Date;
      if (currentSchedule && currentSchedule.items.length > 0) {
        proposedStartTime = currentSchedule.summary.sessionEnd;
      } else {
        proposedStartTime = effectiveAutoScheduleStartTime;
      }

      if (isSameDay(selectedDayDate, T_current) && proposedStartTime.getTime() < T_current.getTime()) {
        proposedStartTime = T_current;
      }

      const proposedEndTime = addMinutes(proposedStartTime, duration);

      await addScheduledTask({ 
        name: injectionPrompt.taskName, 
        start_time: proposedStartTime.toISOString(), 
        end_time: proposedEndTime.toISOString(), 
        break_duration: breakDuration, 
        scheduled_date: taskScheduledDate 
      });
      showSuccess(`Injected "${injectionPrompt.taskName}" from ${formatTime(proposedStartTime)} to ${formatTime(proposedEndTime)}.`);
      success = true;
    }
    
    if (success) {
      setInjectionPrompt(null);
      setInjectionDuration('');
      setInjectionBreak('');
      setInjectionStartTime('');
      setInjectionEndTime('');
      setInputValue('');
    }
    setIsProcessingCommand(false);
  };

  const activeItem: ScheduledItem | null = useMemo(() => {
    if (!calculatedSchedule || !isSameDay(parseISO(selectedDay), T_current)) return null;
    for (const item of calculatedSchedule.items) {
      if ((item.type === 'task' || item.type === 'break') && T_current >= item.startTime && T_current < item.endTime) {
        return item;
      }
    }
    return null;
  }, [calculatedSchedule, T_current, selectedDay]);

  const nextItem: ScheduledItem | null = useMemo(() => {
    if (!calculatedSchedule || !activeItem || !isSameDay(parseISO(selectedDay), T_current)) return null;
    const activeItemIndex = calculatedSchedule.items.findIndex(item => item.id === activeItem.id);
    if (activeItemIndex !== -1 && activeItemIndex < calculatedSchedule.items.length - 1) {
      for (let i = activeItemIndex + 1; i < calculatedSchedule.items.length; i++) {
        const item = calculatedSchedule.items[i];
        if (item.type === 'task' || item.type === 'break') {
          return item;
        }
      }
    }
    return null;
  }, [calculatedSchedule, activeItem, T_current, selectedDay]);


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

      <SchedulerDashboardPanel scheduleSummary={calculatedSchedule?.summary || null} />

      <CalendarStrip 
        selectedDay={selectedDay} 
        setSelectedDay={setSelectedDay} 
        datesWithTasks={datesWithTasks} 
      />

      <Card className="animate-pop-in animate-hover-lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <ListTodo className="h-5 w-5 text-primary" /> Schedule Your Day
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Current Time: <span className="font-semibold">{formatDateTime(T_current)}</span>
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <SchedulerInput 
            onCommand={handleCommand} 
            isLoading={overallLoading} 
            inputValue={inputValue}
            setInputValue={setInputValue}
          />
          <p className="text-xs text-muted-foreground">
            Examples: "Piano Practice 30", "Meeting 60 10", "Mindfulness 11am - 12pm", "Inject Gym", "Inject Meeting from 2pm to 3pm", "Clear queue"
          </p>
        </CardContent>
      </Card>

      {isSameDay(parseISO(selectedDay), T_current) && (
        <NowFocusCard activeItem={activeItem} nextItem={nextItem} T_current={T_current} />
      )}

      <Card className="animate-pop-in animate-hover-lift" style={{ animationDelay: '0.1s' }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-logo-yellow" /> Your Vibe Schedule for {format(parseISO(selectedDay), 'EEEE, MMMM d')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isSchedulerTasksLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <SchedulerDisplay schedule={calculatedSchedule} T_current={T_current} onRemoveTask={removeScheduledTask} activeItemId={activeItem?.id || null} selectedDayString={selectedDay} />
          )}
        </CardContent>
      </Card>

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

      {/* Clear Schedule Confirmation Dialog */}
      <AlertDialog open={showClearConfirmation} onOpenChange={setShowClearConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently delete all scheduled tasks for {format(parseISO(selectedDay), 'EEEE, MMMM d')}. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearSchedule} className="bg-destructive hover:bg-destructive/90">
              Clear Schedule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SchedulerPage;