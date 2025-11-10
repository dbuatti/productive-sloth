import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, ListTodo, Sparkles, Loader2 } from 'lucide-react';
import SchedulerInput from '@/components/SchedulerInput';
import SchedulerDisplay from '@/components/SchedulerDisplay';
import { FormattedSchedule, DBScheduledTask, ScheduledItem, NewDBScheduledTask } from '@/types/scheduler'; // Import NewDBScheduledTask
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
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks'; // Updated import
import { useSession } from '@/hooks/use-session';
import { parse, startOfDay, setHours, setMinutes, format, isSameDay } from 'date-fns'; // Import format and isSameDay
import SchedulerDashboardPanel from '@/components/SchedulerDashboardPanel';
import NowFocusCard from '@/components/NowFocusCard';
import CalendarStrip from '@/components/CalendarStrip'; // Import CalendarStrip

const SchedulerPage: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [selectedDay, setSelectedDay] = useState<Date>(new Date()); // New state for selected day
  const { 
    dbScheduledTasks,
    isLoading: isSchedulerTasksLoading, 
    addScheduledTask, 
    removeScheduledTask, 
    clearScheduledTasks,
    datesWithTasks, // New: Dates that have scheduled tasks
  } = useSchedulerTasks(selectedDay); // Pass selectedDay to the hook

  const [currentSchedule, setCurrentSchedule] = useState<FormattedSchedule | null>(null);
  const [T_current, setT_current] = useState(new Date());
  
  // Use useRef to hold the T_Anchor value, and useState to trigger re-renders when it's first established
  // T_Anchor is now stored per day
  const T_AnchorRef = useRef<Map<string, Date>>(new Map()); // Map<formattedDate, Date>
  const [, setT_AnchorEstablished] = useState<boolean>(false); // Dummy state to force re-render when T_Anchor is first set

  const [isProcessingCommand, setIsProcessingCommand] = useState(false);
  const [injectionPrompt, setInjectionPrompt] = useState<{ taskName: string; isOpen: boolean; isTimed?: boolean; startTime?: string; endTime?: string } | null>(null);
  const [injectionDuration, setInjectionDuration] = useState('');
  const [injectionBreak, setInjectionBreak] = useState('');
  const [injectionStartTime, setInjectionStartTime] = useState('');
  const [injectionEndTime, setInjectionEndTime] = useState('');
  const [inputValue, setInputValue] = useState(''); // State for the input field

  // Format selectedDay for localStorage key and task insertion
  const formattedSelectedDay = format(selectedDay, 'yyyy-MM-dd');

  // Update T_current every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setT_current(new Date());
    }, 60 * 1000); // Every minute
    return () => clearInterval(interval);
  }, []);

  // Load T_Anchor for the selected day from localStorage on initial mount and when selectedDay changes
  useEffect(() => {
    const savedAnchor = localStorage.getItem(`scheduler_T_Anchor_${formattedSelectedDay}`);
    if (savedAnchor) {
      T_AnchorRef.current.set(formattedSelectedDay, new Date(savedAnchor));
      setT_AnchorEstablished(true); // Trigger re-render
      console.log(`SchedulerPage: Loaded T_AnchorRef for ${formattedSelectedDay} from localStorage:`, T_AnchorRef.current.get(formattedSelectedDay)?.toISOString());
    } else {
      T_AnchorRef.current.delete(formattedSelectedDay); // Ensure no old anchor if none saved
      setT_AnchorEstablished(false); // Reset dummy state
      console.log(`SchedulerPage: No T_AnchorRef found for ${formattedSelectedDay} in localStorage on mount/day change.`);
    }
  }, [formattedSelectedDay]); // Dependency on formattedSelectedDay

  // Refactored schedule generation logic directly into useEffect
  useEffect(() => {
    const currentDayAnchor = T_AnchorRef.current.get(formattedSelectedDay) || null;
    console.log("SchedulerPage: useEffect triggered. T_AnchorRef.current for selected day:", currentDayAnchor?.toISOString());
    console.log("SchedulerPage: useEffect: dbScheduledTasks received:", dbScheduledTasks.map(t => ({ id: t.id, name: t.name, scheduled_date: t.scheduled_date, start_time: t.start_time, end_time: t.end_time })));

    // Always provide a T_Anchor if there are any tasks for the day, defaulting to start of day
    const effectiveTAnchor = currentDayAnchor || (dbScheduledTasks.length > 0 ? startOfDay(selectedDay) : null);

    console.log("SchedulerPage: Calling calculateSchedule with T_Anchor for selected day:", effectiveTAnchor?.toISOString());
    const schedule = calculateSchedule(dbScheduledTasks, effectiveTAnchor);
    setCurrentSchedule(schedule);
  }, [dbScheduledTasks, formattedSelectedDay, selectedDay]); // Dependencies are now direct

  const handleCommand = async (input: string) => {
    if (!user) {
      showError("Please log in to use the scheduler.");
      setIsProcessingCommand(false);
      return;
    }
    setIsProcessingCommand(true);
    
    const parsedInput = parseTaskInput(input);
    const injectCommand = parseInjectionCommand(input);
    const command = parseCommand(input);

    let success = false;

    if (parsedInput) {
      const isAdHocTask = 'duration' in parsedInput;

      // If T_Anchor is not set for the selected day and this is the first ad-hoc task, set it NOW
      if (!T_AnchorRef.current.has(formattedSelectedDay) && isAdHocTask && isSameDay(selectedDay, new Date())) {
        const newAnchor = new Date();
        T_AnchorRef.current.set(formattedSelectedDay, newAnchor); // Capture current time for selected day
        localStorage.setItem(`scheduler_T_Anchor_${formattedSelectedDay}`, newAnchor.toISOString()); // Save to localStorage
        setT_AnchorEstablished(true); // Trigger re-render
        console.log(`SchedulerPage: T_AnchorRef set for ${formattedSelectedDay} for the first time in handleCommand to:`, newAnchor.toISOString());
      }

      const taskScheduledDate = formattedSelectedDay;

      // Check if it's a duration-based task or a timed event
      if (isAdHocTask) {
        // Duration-based task
        await addScheduledTask({ name: parsedInput.name, duration: parsedInput.duration, break_duration: parsedInput.breakDuration, scheduled_date: taskScheduledDate });
        success = true;
      } else {
        // Timed event (Fixed Appointment)
        // Ensure parsed times are set for the selected day, not just 'now'
        const startTime = parse(format(parsedInput.startTime, 'hh:mm a'), 'hh:mm a', selectedDay);
        const endTime = parse(format(parsedInput.endTime, 'hh:mm a'), 'hh:mm a', selectedDay);
        
        // Handle potential rollover to next day if end time is before start time on the same day
        if (endTime.getTime() < startTime.getTime()) {
          endTime.setDate(endTime.getDate() + 1);
        }

        await addScheduledTask({ name: parsedInput.name, start_time: startTime.toISOString(), end_time: endTime.toISOString(), scheduled_date: taskScheduledDate });
        success = true;
      }
    } else if (injectCommand) {
      const isAdHocInjection = !injectCommand.startTime && !injectCommand.endTime;

      // If T_Anchor is not set for the selected day and this is the first ad-hoc injection, set it NOW
      if (!T_AnchorRef.current.has(formattedSelectedDay) && isAdHocInjection && isSameDay(selectedDay, new Date())) {
        const newAnchor = new Date();
        T_AnchorRef.current.set(formattedSelectedDay, newAnchor); // Capture current time for selected day
        localStorage.setItem(`scheduler_T_Anchor_${formattedSelectedDay}`, newAnchor.toISOString()); // Save to localStorage
        setT_AnchorEstablished(true); // Trigger re-render
        console.log(`SchedulerPage: T_AnchorRef set for ${formattedSelectedDay} for the first time in handleCommand (injection) to:`, newAnchor.toISOString());
      }

      const taskScheduledDate = formattedSelectedDay;

      if (injectCommand.duration) {
        await addScheduledTask({ name: injectCommand.taskName, duration: injectCommand.duration, break_duration: injectCommand.breakDuration, scheduled_date: taskScheduledDate });
        success = true;
      } else if (injectCommand.startTime && injectCommand.endTime) {
        // Ensure parsed times are set for the selected day, not just 'now'
        const startTime = parse(injectCommand.startTime, 'h:mm a', selectedDay);
        const endTime = parse(injectCommand.endTime, 'h:mm a', selectedDay);

        // Handle potential rollover to next day if end time is before start time on the same day
        if (endTime.getTime() < startTime.getTime()) {
          endTime.setDate(endTime.getDate() + 1);
        }

        await addScheduledTask({ name: injectCommand.taskName, start_time: startTime.toISOString(), end_time: endTime.toISOString(), scheduled_date: taskScheduledDate });
        success = true;
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
        success = true; // Dialog opening is considered a success for clearing input
      }
    } else if (command) {
      switch (command.type) {
        case 'clear':
          await clearScheduledTasks(); // This now clears for the selected day
          T_AnchorRef.current.delete(formattedSelectedDay); // Reset T_AnchorRef for selected day
          localStorage.removeItem(`scheduler_T_Anchor_${formattedSelectedDay}`); // Clear from localStorage
          setT_AnchorEstablished(false); // Reset dummy state
          console.log(`SchedulerPage: T_AnchorRef reset to null for ${formattedSelectedDay} via clear command.`);
          success = true;
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
      showError("Invalid input. Please use 'Task Name Duration [Break]', 'Task Name HH:MM AM/PM - HH:MM AM/PM', or a command.");
    }
    
    setIsProcessingCommand(false);
    if (success) {
      setInputValue(''); // Clear input only on success
    }
  };

  const handleInjectionSubmit = async () => {
    if (!user || !injectionPrompt) {
      showError("You must be logged in to use the scheduler.");
      return;
    }

    let success = false;
    const isAdHocInjection = !injectionPrompt.isTimed;

    // If T_Anchor is not set for the selected day and this is the first ad-hoc injection, set it NOW
    if (!T_AnchorRef.current.has(formattedSelectedDay) && isAdHocInjection && isSameDay(selectedDay, new Date())) {
      const newAnchor = new Date();
      T_AnchorRef.current.set(formattedSelectedDay, newAnchor); // Capture current time for selected day
      localStorage.setItem(`scheduler_T_Anchor_${formattedSelectedDay}`, newAnchor.toISOString()); // Save to localStorage
      setT_AnchorEstablished(true); // Trigger re-render
      console.log(`SchedulerPage: T_AnchorRef set for ${formattedSelectedDay} for the first time in handleInjectionSubmit to:`, newAnchor.toISOString());
    }

    const taskScheduledDate = formattedSelectedDay;

    if (injectionPrompt.isTimed) {
      if (!injectionStartTime || !injectionEndTime) {
        showError("Start time and end time are required for timed injection.");
        setIsProcessingCommand(false);
        return;
      }
      // Ensure parsed times are set for the selected day, not just 'now'
      const startTime = parse(injectionStartTime, 'h:mm a', selectedDay);
      const endTime = parse(injectionEndTime, 'h:mm a', selectedDay);
      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        showError("Invalid time format for start/end times.");
        setIsProcessingCommand(false);
        return;
      }
      // Handle potential rollover to next day if end time is before start time on the same day
      if (endTime.getTime() < startTime.getTime()) {
        endTime.setDate(endTime.getDate() + 1);
      }
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
      await addScheduledTask({ name: injectionPrompt.taskName, duration, break_duration: breakDuration, scheduled_date: taskScheduledDate });
      success = true;
    }
    
    if (success) {
      setInjectionPrompt(null);
      setInjectionDuration('');
      setInjectionBreak('');
      setInjectionStartTime('');
      setInjectionEndTime('');
      setInputValue(''); // Clear main input on successful injection
    }
    setIsProcessingCommand(false);
  };

  // Determine the currently active task and the next task
  const activeItem: ScheduledItem | null = useMemo(() => {
    if (!currentSchedule || !isSameDay(selectedDay, new Date())) return null; // Only show active item for today
    for (const item of currentSchedule.items) {
      if ((item.type === 'task' || item.type === 'break') && T_current >= item.startTime && T_current < item.endTime) {
        return item;
      }
    }
    return null;
  }, [currentSchedule, T_current, selectedDay]);

  const nextItem: ScheduledItem | null = useMemo(() => {
    if (!currentSchedule || !activeItem || !isSameDay(selectedDay, new Date())) return null; // Only show next item for today
    const activeItemIndex = currentSchedule.items.findIndex(item => item.id === activeItem.id);
    if (activeItemIndex !== -1 && activeItemIndex < currentSchedule.items.length - 1) {
      // Find the next actual task or break, skipping free-time or markers
      for (let i = activeItemIndex + 1; i < currentSchedule.items.length; i++) {
        const item = currentSchedule.items[i];
        if (item.type === 'task' || item.type === 'break') {
          return item;
        }
      }
    }
    return null;
  }, [currentSchedule, activeItem, selectedDay]);


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

      {/* New: Scheduler Dashboard Panel */}
      <SchedulerDashboardPanel scheduleSummary={currentSchedule?.summary || null} />

      {/* New: Calendar Strip */}
      <CalendarStrip 
        selectedDay={selectedDay} 
        setSelectedDay={setSelectedDay} 
        datesWithTasks={datesWithTasks} 
      />

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

      {/* NOW FOCUS Card (only for today's schedule) */}
      {isSameDay(selectedDay, new Date()) && (
        <NowFocusCard activeItem={activeItem} nextItem={nextItem} T_current={T_current} />
      )}

      <Card className="animate-pop-in" style={{ animationDelay: '0.1s' }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-logo-yellow" /> Your Vibe Schedule for {format(selectedDay, 'EEEE, MMMM d')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isSchedulerTasksLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <SchedulerDisplay schedule={currentSchedule} T_current={T_current} onRemoveTask={removeScheduledTask} activeItemId={activeItem?.id || null} />
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