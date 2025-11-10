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
  formatTime,
  setTimeOnDate,
} from '@/lib/scheduler-utils';
import { showSuccess, showError } from '@/utils/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import { useSession } from '@/hooks/use-session';
import { parse, startOfDay, setHours, setMinutes, format, isSameDay, addDays, addMinutes, parseISO, isBefore, isAfter, addHours } from 'date-fns';
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
} from "@/components/ui/alert-dialog";

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
  
  const [tAnchorForSelectedDay, setTAnchorForSelectedDay] = useState<Date | null>(null);

  const [isProcessingCommand, setIsProcessingCommand] = useState(false);
  const [injectionPrompt, setInjectionPrompt] = useState<{ taskName: string; isOpen: boolean; isTimed?: boolean; startTime?: string; endTime?: string } | null>(null);
  const [injectionDuration, setInjectionDuration] = useState('');
  const [injectionBreak, setInjectionBreak] = useState('');
  const [injectionStartTime, setInjectionStartTime] = useState('');
  const [injectionEndTime, setInjectionEndTime] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);

  const formattedSelectedDay = selectedDay;

  // Update T_current every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setT_current(new Date());
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Manage tAnchorForSelectedDay based on selectedDay and current time
  useEffect(() => {
    const selectedDayAsDate = parseISO(formattedSelectedDay);
    const isSelectedDayToday = isSameDay(selectedDayAsDate, T_current);
    const localStorageKey = `scheduler_T_Anchor_${formattedSelectedDay}`;

    let calculatedAnchorDateFromStorage: Date | null = null;
    const savedAnchorString = localStorage.getItem(localStorageKey);

    if (savedAnchorString) {
      const parsedDate = new Date(savedAnchorString);
      if (!isNaN(parsedDate.getTime())) {
        calculatedAnchorDateFromStorage = parsedDate;
      }
    }

    let newAnchorCandidate: Date;
    if (isSelectedDayToday) {
      newAnchorCandidate = T_current;
    } else {
      newAnchorCandidate = startOfDay(selectedDayAsDate);
    }

    let finalAnchorToSet: Date | null = null;

    if (calculatedAnchorDateFromStorage && isSameDay(calculatedAnchorDateFromStorage, selectedDayAsDate)) {
        // If there's a saved anchor for the current selected day
        if (isSelectedDayToday && isBefore(calculatedAnchorDateFromStorage, T_current)) {
            // If it's today and saved anchor is in the past, update to current time
            finalAnchorToSet = T_current;
        } else {
            // Otherwise, stick with the saved anchor
            finalAnchorToSet = calculatedAnchorDateFromStorage;
        }
    } else {
        // No saved anchor for this day, or saved anchor is for a different day
        finalAnchorToSet = newAnchorCandidate;
    }

    // Compare by timestamp to avoid re-rendering if only object reference changes
    const currentAnchorTime = tAnchorForSelectedDay?.getTime() || null;
    const finalAnchorToSetTime = finalAnchorToSet?.getTime() || null;

    if (currentAnchorTime !== finalAnchorToSetTime) {
      setTAnchorForSelectedDay(finalAnchorToSet);
      if (finalAnchorToSet) {
         localStorage.setItem(localStorageKey, finalAnchorToSet.toISOString());
      }
    }
  }, [formattedSelectedDay, T_current]); // tAnchorForSelectedDay is NOT in dependencies.

  // Calculate the schedule based on tasks, selected day, and explicit anchor
  const calculatedSchedule = useMemo(() => {
    return calculateSchedule(dbScheduledTasks, tAnchorForSelectedDay, T_current, selectedDay);
  }, [dbScheduledTasks, selectedDay, tAnchorForSelectedDay, T_current]);

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
    setTAnchorForSelectedDay(null);
    localStorage.removeItem(`scheduler_T_Anchor_${formattedSelectedDay}`);
    setIsProcessingCommand(false);
    setShowClearConfirmation(false);
    setInputValue('');
  };

  const handleCommand = async (input: string) => {
    if (!user || !profile) {
      showError("Please log in and ensure your profile is loaded to use the scheduler.");
      setIsProcessingCommand(false);
      return;
    }
    setIsProcessingCommand(true);
    
    const parsedInput = parseTaskInput(input);
    const injectCommand = parseInjectionCommand(input);
    const command = parseCommand(input);

    let success = false;
    const taskScheduledDate = formattedSelectedDay;

    // Get workday boundaries from profile
    const selectedDayAsDate = parseISO(selectedDay);
    const workdayStartTime = profile.default_auto_schedule_start_time 
      ? setTimeOnDate(selectedDayAsDate, profile.default_auto_schedule_start_time) 
      : startOfDay(selectedDayAsDate);
    let workdayEndTime = profile.default_auto_schedule_end_time 
      ? setTimeOnDate(selectedDayAsDate, profile.default_auto_schedule_end_time) 
      : addHours(startOfDay(selectedDayAsDate), 17); // Default to 5 PM

    // Ensure workdayEndTime is after workdayStartTime, potentially rolling over to next day
    if (isBefore(workdayEndTime, workdayStartTime)) {
      workdayEndTime = addDays(workdayEndTime, 1);
    }

    // Determine the effective start for placing new tasks (cannot be in the past for today)
    let effectiveWorkdayStart = workdayStartTime;
    if (isSameDay(selectedDayAsDate, T_current) && isBefore(workdayStartTime, T_current)) {
      effectiveWorkdayStart = T_current;
    }

    // Get existing scheduled tasks for the day, sorted by start time
    const existingAppointments = dbScheduledTasks
      .filter(task => isSameDay(parseISO(task.scheduled_date), selectedDayAsDate))
      .map(task => ({
        start: setTimeOnDate(selectedDayAsDate, format(parseISO(task.start_time!), 'HH:mm')),
        end: setTimeOnDate(selectedDayAsDate, format(parseISO(task.end_time!), 'HH:mm')),
      }))
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    if (parsedInput) {
      const isAdHocTask = 'duration' in parsedInput;

      if (isAdHocTask) {
        const newTaskDuration = parsedInput.duration!;
        let proposedStartTime: Date | null = null;

        // Find the first available slot
        let currentSearchTime = effectiveWorkdayStart;

        for (const appt of existingAppointments) {
          // If there's a gap before this appointment
          if (isBefore(currentSearchTime, appt.start)) {
            const potentialEndTime = addMinutes(currentSearchTime, newTaskDuration);
            if (isBefore(potentialEndTime, appt.start) || isSameDay(potentialEndTime, appt.start)) {
              // Task fits in this gap
              proposedStartTime = currentSearchTime;
              break;
            }
          }
          // Move past the current appointment
          currentSearchTime = isAfter(appt.end, currentSearchTime) ? appt.end : currentSearchTime;
        }

        // Check if it fits after the last appointment or if there are no appointments
        if (!proposedStartTime && (isBefore(currentSearchTime, workdayEndTime) || isSameDay(currentSearchTime, workdayEndTime))) {
          const potentialEndTime = addMinutes(currentSearchTime, newTaskDuration);
          if (isBefore(potentialEndTime, workdayEndTime) || isSameDay(potentialEndTime, workdayEndTime)) {
            proposedStartTime = currentSearchTime;
          }
        }

        if (proposedStartTime) {
          const proposedEndTime = addMinutes(proposedStartTime, newTaskDuration);
          await addScheduledTask({ 
            name: parsedInput.name, 
            start_time: proposedStartTime.toISOString(), 
            end_time: proposedEndTime.toISOString(), 
            scheduled_date: taskScheduledDate,
            break_duration: parsedInput.breakDuration,
          });
          showSuccess(`Scheduled "${parsedInput.name}" from ${formatTime(proposedStartTime)} to ${formatTime(proposedEndTime)}.`);
          success = true;
        } else {
          showError(`No available slot found within your workday (${formatTime(workdayStartTime)} - ${formatTime(workdayEndTime)}) for "${parsedInput.name}" (${newTaskDuration} min).`);
        }

      } else { // This is a timed event (e.g., "Meeting 11am - 12pm")
        let startTime = setHours(setMinutes(startOfDay(selectedDayAsDate), parsedInput.startTime!.getMinutes()), parsedInput.startTime!.getHours());
        let endTime = setHours(setMinutes(startOfDay(selectedDayAsDate), parsedInput.endTime!.getMinutes()), parsedInput.endTime!.getHours());
        
        if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
          showError("Invalid time format for start/end times.");
          setIsProcessingCommand(false);
          return;
        }

        if (isSameDay(selectedDayAsDate, T_current) && isBefore(startTime, T_current)) {
          startTime = addDays(startTime, 1);
          endTime = addDays(endTime, 1);
          showSuccess(`Scheduled "${parsedInput.name}" for tomorrow at ${formatTime(startTime)} as today's time has passed.`);
        } else if (isBefore(endTime, startTime)) {
          endTime = addDays(endTime, 1);
        }

        await addScheduledTask({ name: parsedInput.name, start_time: startTime.toISOString(), end_time: endTime.toISOString(), scheduled_date: taskScheduledDate });
        showSuccess(`Scheduled "${parsedInput.name}" from ${formatTime(startTime)} to ${formatTime(endTime)}.`);
        success = true;
      }
    } else if (injectCommand) {
      const isAdHocInjection = !injectCommand.startTime && !injectCommand.endTime;

      if (isAdHocInjection) {
        const injectedTaskDuration = injectCommand.duration || 30; // Default duration for inject if not specified
        let proposedStartTime: Date | null = null;

        let currentSearchTime = effectiveWorkdayStart;

        for (const appt of existingAppointments) {
          if (isBefore(currentSearchTime, appt.start)) {
            const potentialEndTime = addMinutes(currentSearchTime, injectedTaskDuration);
            if (isBefore(potentialEndTime, appt.start) || isSameDay(potentialEndTime, appt.start)) {
              proposedStartTime = currentSearchTime;
              break;
            }
          }
          currentSearchTime = isAfter(appt.end, currentSearchTime) ? appt.end : currentSearchTime;
        }

        if (!proposedStartTime && (isBefore(currentSearchTime, workdayEndTime) || isSameDay(currentSearchTime, workdayEndTime))) {
          const potentialEndTime = addMinutes(currentSearchTime, injectedTaskDuration);
          if (isBefore(potentialEndTime, workdayEndTime) || isSameDay(potentialEndTime, workdayEndTime)) {
            proposedStartTime = currentSearchTime;
          }
        }

        if (proposedStartTime) {
          const proposedEndTime = addMinutes(proposedStartTime, injectedTaskDuration);
          await addScheduledTask({ 
            name: injectCommand.taskName, 
            start_time: proposedStartTime.toISOString(), 
            end_time: proposedEndTime.toISOString(), 
            break_duration: injectCommand.breakDuration, 
            scheduled_date: taskScheduledDate 
          });
          showSuccess(`Injected "${injectCommand.taskName}" from ${formatTime(proposedStartTime)} to ${formatTime(proposedEndTime)}.`);
          success = true;
        } else {
          showError(`No available slot found within your workday (${formatTime(workdayStartTime)} - ${formatTime(workdayEndTime)}) for "${injectCommand.taskName}" (${injectedTaskDuration} min).`);
        }

      } else if (injectCommand.startTime && injectCommand.endTime) {
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
      } else {
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
      switch (command.type) {
        case 'clear':
          setShowClearConfirmation(true);
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
      setInputValue('');
    }
  };

  const handleInjectionSubmit = async () => {
    if (!user || !profile || !injectionPrompt) {
      showError("You must be logged in and your profile loaded to use the scheduler.");
      return;
    }

    let success = false;
    const taskScheduledDate = formattedSelectedDay;
    const selectedDayAsDate = parseISO(selectedDay);

    // Get workday boundaries from profile
    const workdayStartTime = profile.default_auto_schedule_start_time 
      ? setTimeOnDate(selectedDayAsDate, profile.default_auto_schedule_start_time) 
      : startOfDay(selectedDayAsDate);
    let workdayEndTime = profile.default_auto_schedule_end_time 
      ? setTimeOnDate(selectedDayAsDate, profile.default_auto_schedule_end_time) 
      : addHours(startOfDay(selectedDayAsDate), 17); // Default to 5 PM

    // Ensure workdayEndTime is after workdayStartTime, potentially rolling over to next day
    if (isBefore(workdayEndTime, workdayStartTime)) {
      workdayEndTime = addDays(workdayEndTime, 1);
    }

    // Determine the effective start for placing new tasks (cannot be in the past for today)
    let effectiveWorkdayStart = workdayStartTime;
    if (isSameDay(selectedDayAsDate, T_current) && isBefore(workdayStartTime, T_current)) {
      effectiveWorkdayStart = T_current;
    }

    // Get existing scheduled tasks for the day, sorted by start time
    const existingAppointments = dbScheduledTasks
      .filter(task => isSameDay(parseISO(task.scheduled_date), selectedDayAsDate))
      .map(task => ({
        start: setTimeOnDate(selectedDayAsDate, format(parseISO(task.start_time!), 'HH:mm')),
        end: setTimeOnDate(selectedDayAsDate, format(parseISO(task.end_time!), 'HH:mm')),
      }))
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    if (injectionPrompt.isTimed) {
      if (!injectionStartTime || !injectionEndTime) {
        showError("Start time and end time are required for timed injection.");
        setIsProcessingCommand(false);
        return;
      }
      const tempStartTime = parseFlexibleTime(injectionStartTime, selectedDayAsDate);
      const tempEndTime = parseFlexibleTime(injectionEndTime, selectedDayAsDate);

      let startTime = setHours(setMinutes(startOfDay(selectedDayAsDate), tempStartTime.getMinutes()), tempStartTime.getHours());
      let endTime = setHours(setMinutes(startOfDay(selectedDayAsDate), tempEndTime.getMinutes()), tempEndTime.getHours());

      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        showError("Invalid time format for start/end times.");
        setIsProcessingCommand(false);
        return;
      }

      if (isSameDay(selectedDayAsDate, T_current) && isBefore(startTime, T_current)) {
        startTime = addDays(startTime, 1);
        endTime = addDays(endTime, 1);
        showSuccess(`Scheduled "${injectionPrompt.taskName}" for tomorrow at ${formatTime(startTime)} as today's time has passed.`);
      } else if (isBefore(endTime, startTime)) {
        endTime = addDays(endTime, 1);
      }

      await addScheduledTask({ name: injectionPrompt.taskName, start_time: startTime.toISOString(), end_time: endTime.toISOString(), scheduled_date: taskScheduledDate });
      showSuccess(`Injected "${injectionPrompt.taskName}" from ${formatTime(startTime)} to ${formatTime(endTime)}.`);
      success = true;
    } else { // Duration-based injection
      if (!injectionDuration) {
        showError("Duration is required for duration-based injection.");
        setIsProcessingCommand(false);
        return;
      }
      const injectedTaskDuration = parseInt(injectionDuration, 10);
      const breakDuration = injectionBreak ? parseInt(injectionBreak, 10) : undefined;

      if (isNaN(injectedTaskDuration) || injectedTaskDuration <= 0) {
        showError("Duration must be a positive number.");
        setIsProcessingCommand(false);
        return;
      }
      
      let proposedStartTime: Date | null = null;
      let currentSearchTime = effectiveWorkdayStart;

      for (const appt of existingAppointments) {
        if (isBefore(currentSearchTime, appt.start)) {
          const potentialEndTime = addMinutes(currentSearchTime, injectedTaskDuration);
          if (isBefore(potentialEndTime, appt.start) || isSameDay(potentialEndTime, appt.start)) {
            proposedStartTime = currentSearchTime;
            break;
          }
        }
        currentSearchTime = isAfter(appt.end, currentSearchTime) ? appt.end : currentSearchTime;
      }

      if (!proposedStartTime && (isBefore(currentSearchTime, workdayEndTime) || isSameDay(currentSearchTime, workdayEndTime))) {
        const potentialEndTime = addMinutes(currentSearchTime, injectedTaskDuration);
        if (isBefore(potentialEndTime, workdayEndTime) || isSameDay(potentialEndTime, workdayEndTime)) {
          proposedStartTime = currentSearchTime;
        }
      }

      if (proposedStartTime) {
        const proposedEndTime = addMinutes(proposedStartTime, injectedTaskDuration);
        await addScheduledTask({ 
          name: injectionPrompt.taskName, 
          start_time: proposedStartTime.toISOString(), 
          end_time: proposedEndTime.toISOString(), 
          break_duration: breakDuration, 
          scheduled_date: taskScheduledDate 
        });
        showSuccess(`Injected "${injectionPrompt.taskName}" from ${formatTime(proposedStartTime)} to ${formatTime(proposedEndTime)}.`);
        success = true;
      } else {
        showError(`No available slot found within your workday (${formatTime(workdayStartTime)} - ${formatTime(workdayEndTime)}) for "${injectionPrompt.taskName}" (${injectedTaskDuration} min).`);
      }
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
          </DialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SchedulerPage;