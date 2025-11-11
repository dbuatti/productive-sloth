import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, ListTodo, Sparkles, Loader2, AlertTriangle, Trash2, ChevronsUp, Star } from 'lucide-react'; // Added ChevronsUp icon, Star
import SchedulerInput from '@/components/SchedulerInput';
import SchedulerDisplay from '@/components/SchedulerDisplay';
import { FormattedSchedule, DBScheduledTask, ScheduledItem, NewDBScheduledTask, RetiredTask } from '@/types/scheduler';
import {
  calculateSchedule,
  parseTaskInput,
  parseInjectionCommand,
  parseCommand,
  formatDateTime,
  parseFlexibleTime,
  formatTime,
  setTimeOnDate,
  compactScheduleLogic, // Import new compaction logic
  mergeOverlappingTimeBlocks, // NEW: Import mergeOverlappingTimeBlocks
  isSlotFree, // NEW: Import isSlotFree
} from '@/lib/scheduler-utils';
import { showSuccess, showError } from '@/utils/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import { useSession } from '@/hooks/use-session';
import { parse, startOfDay, setHours, setMinutes, format, isSameDay, addDays, addMinutes, parseISO, isBefore, isAfter, addHours, subDays } from 'date-fns';
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
import { useLocation, useNavigate } from 'react-router-dom';
import AetherSink from '@/components/AetherSink'; // Import AetherSink component
import { supabase } from '@/integrations/supabase/client'; // Import supabase
import { useQueryClient } from '@tanstack/react-query'; // Import useQueryClient
import WeatherWidget from '@/components/WeatherWidget'; // Import WeatherWidget

// Helper for deep comparison (simple for JSON-serializable objects)
const deepCompare = (a: any, b: any) => {
  if (a === b) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  // Handle Date objects specifically
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  if (a instanceof Date || b instanceof Date) return false; // One is Date, other is not

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key) || !deepCompare(a[key], b[key])) {
      return false;
    }
  }
  return true;
};

interface TimeBlock {
  start: Date;
  end: Date;
  duration: number; // in minutes
}

const getFreeTimeBlocks = (
  appointments: { start: Date; end: Date }[],
  workdayStart: Date,
  workdayEnd: Date
): TimeBlock[] => {
  // 1. Convert to TimeBlock format and merge overlapping appointments first
  const mergedAppointments = mergeOverlappingTimeBlocks(appointments.map(a => ({
    start: a.start,
    end: a.end,
    duration: Math.floor((a.end.getTime() - a.start.getTime()) / (1000 * 60))
  })));

  const freeBlocks: TimeBlock[] = [];
  let currentFreeTimeStart = workdayStart;

  for (const appt of mergedAppointments) { // Iterate over merged appointments
    // If there's a gap before this appointment
    if (isBefore(currentFreeTimeStart, appt.start)) {
      const duration = Math.floor((appt.start.getTime() - currentFreeTimeStart.getTime()) / (1000 * 60));
      if (duration > 0) {
        freeBlocks.push({ start: currentFreeTimeStart, end: appt.start, duration });
      }
    }
    // Move currentFreeTimeStart past this appointment's end
    currentFreeTimeStart = isAfter(appt.end, currentFreeTimeStart) ? appt.end : currentFreeTimeStart;
  }

  // Add any remaining free time after the last appointment until workdayEnd
  if (isBefore(currentFreeTimeStart, workdayEnd)) {
    const duration = Math.floor((workdayEnd.getTime() - currentFreeTimeStart.getTime()) / (1000 * 60));
    if (duration > 0) {
      freeBlocks.push({ start: currentFreeTimeStart, end: workdayEnd, duration });
    }
  }

  return freeBlocks;
};


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
    isLoadingDatesWithTasks, // Use this loading state
    retiredTasks, // NEW: Get retired tasks
    isLoadingRetiredTasks, // NEW: Get loading state for retired tasks
    retireTask, // NEW: Retire task mutation
    rezoneTask, // NEW: Rezone task mutation
    compactScheduledTasks, // NEW: Compact schedule mutation
  } = useSchedulerTasks(selectedDay);

  const queryClient = useQueryClient(); // Initialize useQueryClient

  const [T_current, setT_current] = useState(new Date());
  
  const [isProcessingCommand, setIsProcessingCommand] = useState(false);
  const [injectionPrompt, setInjectionPrompt] = useState<{ taskName: string; isOpen: boolean; isTimed?: boolean; startTime?: string; endTime?: string; isCritical?: boolean; isFlexible?: boolean } | null>(null); // Added isCritical, isFlexible
  const [injectionDuration, setInjectionDuration] = useState('');
  const [injectionBreak, setInjectionBreak] = useState('');
  const [injectionStartTime, setInjectionStartTime] = useState('');
  const [injectionEndTime, setInjectionEndTime] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [hasMorningFixRunToday, setHasMorningFixRunToday] = useState(false); // New state for morning fix

  // NEW: Memoized scheduled times derived directly from dbScheduledTasks
  const memoizedScheduledTimes = useMemo(() => {
    if (!dbScheduledTasks) {
      return [];
    }

    return dbScheduledTasks
      .filter(task => task.start_time && task.end_time)
      .map(task => {
        const utcStart = parseISO(task.start_time!);
        const utcEnd = parseISO(task.end_time!);
        
        // Convert UTC Date objects to local Date objects for consistent scheduling logic
        const localStart = new Date(utcStart.getUTCFullYear(), utcStart.getUTCMonth(), utcStart.getUTCDate(), utcStart.getUTCHours(), utcStart.getUTCMinutes(), utcStart.getUTCSeconds());
        const localEnd = new Date(utcEnd.getUTCFullYear(), utcEnd.getUTCMonth(), utcEnd.getUTCDate(), utcEnd.getUTCHours(), utcEnd.getUTCMinutes(), utcEnd.getUTCSeconds());

        return {
          start: localStart,
          end: localEnd,
          duration: Math.floor((localEnd.getTime() - localStart.getTime()) / (1000 * 60)),
        };
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [dbScheduledTasks, selectedDay]); // Depend on dbScheduledTasks and selectedDay

  // Memoized occupied blocks derived from memoizedScheduledTimes
  const occupiedBlocks = useMemo(() => mergeOverlappingTimeBlocks(memoizedScheduledTimes), [memoizedScheduledTimes]);


  const formattedSelectedDay = selectedDay;
  const location = useLocation();
  const navigate = useNavigate();

  // Update T_current every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setT_current(new Date());
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Handle pre-filling input from navigation state
  useEffect(() => {
    const taskToSchedule = (location.state as any)?.taskToSchedule;
    if (taskToSchedule) {
      const { name, duration, isCritical } = taskToSchedule; // Get isCritical
      const command = `inject "${name}" ${duration}${isCritical ? ' !' : ''}`; // Append ' !' if critical
      // Immediately execute the command
      handleCommand(command);
      // Clear the state so it's not re-triggered on subsequent visits
      navigate(location.pathname, { replace: true, state: {} }); 
    }
  }, [location.state, navigate]); // Removed handleCommand from dependencies to prevent re-render loop

  // Keyboard navigation for days
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Prevent navigation if an input or textarea is focused
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      const currentSelectedDate = parseISO(selectedDay);
      let newDate: Date;

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault(); // Prevent browser scroll
          newDate = subDays(currentSelectedDate, 1);
          setSelectedDay(format(newDate, 'yyyy-MM-dd'));
          break;
        case 'ArrowRight':
          event.preventDefault(); // Prevent browser scroll
          newDate = addDays(currentSelectedDate, 1);
          setSelectedDay(format(newDate, 'yyyy-MM-dd'));
          break;
        case ' ': // Space bar
          event.preventDefault(); // Prevent browser scroll
          setSelectedDay(format(new Date(), 'yyyy-MM-dd'));
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedDay]); // Re-run effect if selectedDay changes to get the latest date


  // Calculate workday boundaries from profile
  const selectedDayAsDate = useMemo(() => parseISO(selectedDay), [selectedDay]);
  const workdayStartTime = useMemo(() => profile?.default_auto_schedule_start_time 
    ? setTimeOnDate(selectedDayAsDate, profile.default_auto_schedule_start_time) 
    : startOfDay(selectedDayAsDate), [profile?.default_auto_schedule_start_time, selectedDayAsDate]);
  
  let workdayEndTime = useMemo(() => profile?.default_auto_schedule_end_time 
    ? setTimeOnDate(selectedDayAsDate, profile.default_auto_schedule_end_time) 
    : addHours(startOfDay(selectedDayAsDate), 17), [profile?.default_auto_schedule_end_time, selectedDayAsDate]);

  // Ensure workdayEndTime is after workdayStartTime, potentially rolling over to next day
  workdayEndTime = useMemo(() => {
    if (isBefore(workdayEndTime, workdayStartTime)) {
      return addDays(workdayEndTime, 1);
    }
    return workdayEndTime;
  }, [workdayEndTime, workdayStartTime]);

  // Determine the effective start for placing new tasks (cannot be in the past for today)
  const effectiveWorkdayStart = useMemo(() => {
    if (isSameDay(selectedDayAsDate, T_current) && isBefore(workdayStartTime, T_current)) {
      return T_current;
    }
    return workdayStartTime;
  }, [selectedDayAsDate, T_current, workdayStartTime]);

  // Ref to store the previous calculated schedule for deep comparison
  const previousCalculatedScheduleRef = useRef<FormattedSchedule | null>(null);

  // Calculate the schedule based on tasks, selected day, and explicit anchor
  const calculatedSchedule = useMemo(() => {
    if (!profile) return null; // Ensure profile is loaded before calculating schedule
    const newSchedule = calculateSchedule(dbScheduledTasks, selectedDay, workdayStartTime, workdayEndTime);
    
    // Deep compare with previous schedule to prevent unnecessary state updates
    if (deepCompare(newSchedule, previousCalculatedScheduleRef.current)) {
      return previousCalculatedScheduleRef.current; // Return previous reference if content is same
    }
    previousCalculatedScheduleRef.current = newSchedule; // Update ref
    return newSchedule;
  }, [dbScheduledTasks, selectedDay, workdayStartTime, workdayEndTime, profile]);

  // Set currentSchedule state from the memoized calculation
  const [currentSchedule, setCurrentSchedule] = useState<FormattedSchedule | null>(null);
  useEffect(() => {
    setCurrentSchedule(calculatedSchedule);
  }, [calculatedSchedule]); // This useEffect will now only run if calculatedSchedule's reference changes (i.e., content changed)

  // NEW: Automatic Retirement Logic (Morning Fix)
  useEffect(() => {
    if (!user || !dbScheduledTasks || isSchedulerTasksLoading || !profile) {
      return;
    }

    const currentDay = parseISO(selectedDay);
    const now = new Date();
    const isViewingToday = isSameDay(currentDay, now);

    // Only run the morning fix if viewing today and it hasn't run yet for today
    if (isViewingToday && !hasMorningFixRunToday) {
      const tasksToRetire = dbScheduledTasks.filter(task => {
        if (!task.start_time || !task.end_time) return false;

        const taskEndTime = setTimeOnDate(currentDay, format(parseISO(task.end_time), 'HH:mm'));
        
        // Retire tasks that ended before the user's defined workday start time,
        // AND the current time is past that workday start time.
        // This ensures tasks that were *missed before the day even properly began* are retired.
        const workdayStart = profile.default_auto_schedule_start_time
          ? setTimeOnDate(currentDay, profile.default_auto_schedule_start_time)
          : startOfDay(currentDay);

        return isBefore(taskEndTime, workdayStart) && isAfter(now, workdayStart);
      });

      if (tasksToRetire.length > 0) {
        console.log(`Automatically retiring ${tasksToRetire.length} past-due tasks from before workday start.`);
        tasksToRetire.forEach(task => {
          retireTask(task);
        });
        setHasMorningFixRunToday(true); // Mark as run for today
      } else {
        setHasMorningFixRunToday(true); // If no tasks to retire, still mark as run to prevent re-check
      }
    } else if (!isViewingToday) {
      // Reset the flag if the selected day is no longer today
      setHasMorningFixRunToday(false);
    }
  }, [user, dbScheduledTasks, isSchedulerTasksLoading, selectedDay, profile, hasMorningFixRunToday, retireTask]);

  // Helper function to find a free slot and propose start/end times
  const findFreeSlotForTask = useCallback(async (
    taskName: string,
    taskDuration: number,
    isCritical: boolean,
    existingOccupiedBlocks: TimeBlock[], // Changed name to be explicit
    effectiveWorkdayStart: Date,
    workdayEndTime: Date
  ): Promise<{ proposedStartTime: Date | null, proposedEndTime: Date | null, message: string }> => {
    let proposedStartTime: Date | null = null;
    const freeBlocks = getFreeTimeBlocks(existingOccupiedBlocks, effectiveWorkdayStart, workdayEndTime);

    // Prioritize critical tasks for earlier slots
    if (isCritical) {
      for (const block of freeBlocks) {
        if (taskDuration <= block.duration) { // Check if task fits in this free block
          proposedStartTime = block.start;
          break;
        }
      }
    } else {
      for (const block of freeBlocks) {
        if (taskDuration <= block.duration) { // Check if task fits in this free block
          proposedStartTime = block.start;
          break; 
        }
      }
    }

    if (proposedStartTime) {
      const proposedEndTime = addMinutes(proposedStartTime, taskDuration);
      return { proposedStartTime, proposedEndTime, message: "" };
    } else {
      return { proposedStartTime: null, proposedEndTime: null, message: `No available slot found within your workday (${formatTime(workdayStartTime)} - ${formatTime(workdayEndTime)}) for "${taskName}" (${taskDuration} min).` };
    }
  }, [workdayStartTime, workdayEndTime]); // Dependencies for useCallback


  const handleClearSchedule = async () => {
    if (!user) {
      showError("You must be logged in to clear your schedule.");
      return;
    }
    setIsProcessingCommand(true);
    await clearScheduledTasks();
    // No need to manually update optimisticScheduledTimes here, as query invalidation will handle it.
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

    // Create a mutable copy of occupiedBlocks for optimistic updates within this command execution
    let optimisticOccupiedBlocks = [...occupiedBlocks];

    if (parsedInput) {
      const isAdHocTask = 'duration' in parsedInput;

      if (isAdHocTask) {
        const newTaskDuration = parsedInput.duration!;
        const { proposedStartTime, proposedEndTime, message } = await findFreeSlotForTask(
          parsedInput.name,
          newTaskDuration,
          parsedInput.isCritical,
          optimisticOccupiedBlocks, // Pass the optimistic blocks
          effectiveWorkdayStart,
          workdayEndTime
        );
        
        if (proposedStartTime && proposedEndTime) {
          await addScheduledTask({ 
            name: parsedInput.name, 
            start_time: proposedStartTime.toISOString(), 
            end_time: proposedEndTime.toISOString(), 
            scheduled_date: taskScheduledDate,
            break_duration: parsedInput.breakDuration,
            is_critical: parsedInput.isCritical, // Pass critical flag
            is_flexible: true, // Duration-based tasks are flexible
          });
          // Optimistically update local occupied blocks
          optimisticOccupiedBlocks.push({ start: proposedStartTime, end: proposedEndTime, duration: newTaskDuration });
          optimisticOccupiedBlocks = mergeOverlappingTimeBlocks(optimisticOccupiedBlocks);
          
          showSuccess(`Scheduled "${parsedInput.name}" from ${formatTime(proposedStartTime)} to ${formatTime(proposedEndTime)}.`);
          success = true;
        } else {
          showError(message);
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

        // NEW: Check for overlaps before adding timed event
        if (!isSlotFree(startTime, endTime, optimisticOccupiedBlocks)) { // Pass optimistic blocks
          showError(`The time slot from ${formatTime(startTime)} to ${formatTime(endTime)} is already occupied.`);
          setIsProcessingCommand(false);
          return;
        }

        const duration = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
        await addScheduledTask({ name: parsedInput.name, start_time: startTime.toISOString(), end_time: endTime.toISOString(), scheduled_date: taskScheduledDate, is_critical: parsedInput.isCritical, is_flexible: false }); // Timed tasks are fixed
        // Optimistically update local occupied blocks
        optimisticOccupiedBlocks.push({ start: startTime, end: endTime, duration: duration });
        optimisticOccupiedBlocks = mergeOverlappingTimeBlocks(optimisticOccupiedBlocks);

        showSuccess(`Scheduled "${parsedInput.name}" from ${formatTime(startTime)} to ${formatTime(endTime)}.`);
        success = true;
      }
    } else if (injectCommand) {
      const isAdHocInjection = !injectCommand.startTime && !injectCommand.endTime;

      if (isAdHocInjection) {
        const injectedTaskDuration = injectCommand.duration || 30; // Default duration for inject if not specified
        const { proposedStartTime, proposedEndTime, message } = await findFreeSlotForTask(
          injectCommand.taskName,
          injectedTaskDuration,
          injectCommand.isCritical,
          optimisticOccupiedBlocks, // Pass the optimistic blocks
          effectiveWorkdayStart,
          workdayEndTime
        );

        if (proposedStartTime && proposedEndTime) {
          await addScheduledTask({ 
            name: injectCommand.taskName, 
            start_time: proposedStartTime.toISOString(), 
            end_time: proposedEndTime.toISOString(), 
            break_duration: injectCommand.breakDuration, 
            scheduled_date: taskScheduledDate,
            is_critical: injectCommand.isCritical, // Pass critical flag
            is_flexible: injectCommand.isFlexible, // Pass flexible flag
          });
          // Optimistically update local occupied blocks
          optimisticOccupiedBlocks.push({ start: proposedStartTime, end: proposedEndTime, duration: injectedTaskDuration });
          optimisticOccupiedBlocks = mergeOverlappingTimeBlocks(optimisticOccupiedBlocks);

          showSuccess(`Injected "${injectCommand.taskName}" from ${formatTime(proposedStartTime)} to ${formatTime(proposedEndTime)}.`);
          success = true;
        } else {
          showError(message);
        }

      } else if (injectCommand.startTime && injectCommand.endTime) {
        setInjectionPrompt({ 
          taskName: injectCommand.taskName, 
          isOpen: true, 
          isTimed: true,
          startTime: injectCommand.startTime,
          endTime: injectCommand.endTime,
          isCritical: injectCommand.isCritical, // Pass critical flag
          isFlexible: injectCommand.isFlexible, // Pass flexible flag
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
          endTime: undefined,
          isCritical: injectCommand.isCritical, // Pass critical flag
          isFlexible: injectCommand.isFlexible, // Pass flexible flag
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
              // No need to manually update optimisticOccupiedBlocks here for removal,
              // as the query invalidation will handle it.
              success = true;
            } else {
              showError(`Invalid index. Please provide a number between 1 and ${dbScheduledTasks.length}.`);
            }
          } else if (command.target) {
            const tasksToRemove = dbScheduledTasks.filter(task => task.name.toLowerCase().includes(command.target!.toLowerCase()));
            if (tasksToRemove.length > 0) {
              for (const task of tasksToRemove) {
                await removeScheduledTask(task.id);
                // No need to manually update optimisticOccupiedBlocks here for removal.
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
        case 'compact': // Handle new compact command
          const compactedTasks = compactScheduleLogic(
            dbScheduledTasks,
            selectedDayAsDate,
            workdayStartTime,
            workdayEndTime,
            T_current
          );
          if (compactedTasks.length > 0) {
            await compactScheduledTasks(compactedTasks);
            // No need for optimistic update here, as compactScheduledTasks handles the full update.
            showSuccess("Schedule compacted!");
          } else {
            showSuccess("No flexible tasks to compact or no space available.");
          }
          success = true;
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

    // Create a mutable copy of occupiedBlocks for optimistic updates
    let optimisticOccupiedBlocks = [...occupiedBlocks];

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

      // NEW: Check for overlaps before adding timed injection
      if (!isSlotFree(startTime, endTime, optimisticOccupiedBlocks)) { // Pass optimistic blocks
        showError(`The time slot from ${formatTime(startTime)} to ${formatTime(endTime)} is already occupied.`);
        setIsProcessingCommand(false);
        return;
      }

      const duration = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
      await addScheduledTask({ name: injectionPrompt.taskName, start_time: startTime.toISOString(), end_time: endTime.toISOString(), scheduled_date: taskScheduledDate, is_critical: injectionPrompt.isCritical, is_flexible: injectionPrompt.isFlexible }); // Timed tasks are fixed
      // Optimistically update local occupied blocks
      optimisticOccupiedBlocks.push({ start: startTime, end: endTime, duration: duration });
      optimisticOccupiedBlocks = mergeOverlappingTimeBlocks(optimisticOccupiedBlocks);

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
      
      const { proposedStartTime, proposedEndTime, message } = await findFreeSlotForTask(
        injectionPrompt.taskName,
        injectedTaskDuration,
        injectionPrompt.isCritical,
        optimisticOccupiedBlocks, // Pass the optimistic blocks
        effectiveWorkdayStart,
        workdayEndTime
      );

      if (proposedStartTime && proposedEndTime) {
        await addScheduledTask({ 
          name: injectionPrompt.taskName, 
          start_time: proposedStartTime.toISOString(), 
          end_time: proposedEndTime.toISOString(), 
          break_duration: breakDuration, 
          scheduled_date: taskScheduledDate,
          is_critical: injectionPrompt.isCritical, // Pass critical flag
          is_flexible: injectionPrompt.isFlexible, // Pass flexible flag
        });
        // Optimistically update local occupied blocks
        optimisticOccupiedBlocks.push({ start: proposedStartTime, end: proposedEndTime, duration: injectedTaskDuration });
        optimisticOccupiedBlocks = mergeOverlappingTimeBlocks(optimisticOccupiedBlocks);

        showSuccess(`Injected "${injectionPrompt.taskName}" from ${formatTime(proposedStartTime)} to ${formatTime(proposedEndTime)}.`);
        success = true;
      } else {
        showError(message);
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

  // NEW: Handle rezone from Aether Sink
  const handleRezoneFromSink = async (retiredTask: RetiredTask) => {
    if (!user || !profile) {
      showError("Please log in and ensure your profile is loaded to rezone tasks.");
      return;
    }
    setIsProcessingCommand(true);

    try {
      const taskDuration = retiredTask.duration || 30; // Default duration if not specified
      const selectedDayAsDate = parseISO(selectedDay);

      // Create a mutable copy of occupiedBlocks for optimistic updates
      let optimisticOccupiedBlocks = [...occupiedBlocks];

      const { proposedStartTime, proposedEndTime, message } = await findFreeSlotForTask(
        retiredTask.name,
        taskDuration,
        retiredTask.is_critical,
        optimisticOccupiedBlocks, // Pass the optimistic blocks
        effectiveWorkdayStart,
        workdayEndTime
      );

      if (proposedStartTime && proposedEndTime) {
        // 1. Delete from retired_tasks (now that we know it can be scheduled)
        await rezoneTask(retiredTask.id); // Call the mutation to delete from sink

        // 2. Add to scheduled_tasks
        await addScheduledTask({
          name: retiredTask.name,
          start_time: proposedStartTime.toISOString(),
          end_time: proposedEndTime.toISOString(),
          break_duration: retiredTask.break_duration, // Pass break_duration from retired task
          scheduled_date: formattedSelectedDay,
          is_critical: retiredTask.is_critical, // Pass critical flag
          is_flexible: true, // Default to flexible when re-zoning from sink
        });
        // Optimistically update local occupied blocks
        optimisticOccupiedBlocks.push({ start: proposedStartTime, end: proposedEndTime, duration: taskDuration });
        optimisticOccupiedBlocks = mergeOverlappingTimeBlocks(optimisticOccupiedBlocks);

        showSuccess(`Re-zoned "${retiredTask.name}" from ${formatTime(proposedStartTime)} to ${formatTime(proposedEndTime)}.`);
      } else {
        showError(message); // Error from findFreeSlotForTask
      }
    } catch (error: any) {
      showError(`Failed to rezone task: ${error.message}`);
      console.error("Rezone error:", error);
    } finally {
      setIsProcessingCommand(false);
    }
  };

  // NEW: Handle manual retirement from SchedulerDisplay
  const handleManualRetire = async (taskToRetire: DBScheduledTask) => {
    if (!user) {
      showError("You must be logged in to retire tasks.");
      return;
    }
    setIsProcessingCommand(true);
    await retireTask(taskToRetire);
    // No need to manually update optimisticOccupiedBlocks here for removal.
    setIsProcessingCommand(false);
  };

  // NEW: Handle permanent removal from Aether Sink
  const handleRemoveRetiredTask = async (retiredTaskId: string) => {
    if (!user) {
      showError("You must be logged in to remove retired tasks.");
      return;
    }
    setIsProcessingCommand(true);
    try {
      const { error } = await supabase.from('retired_tasks').delete().eq('id', retiredTaskId).eq('user_id', user.id);
      if (error) throw new Error(error.message);
      showSuccess('Task permanently removed from Aether Sink.');
      // Invalidate the retiredTasks query to trigger a refetch and update the UI
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', user.id] });
    } catch (error: any) {
      showError(`Failed to remove retired task: ${error.message}`);
      console.error("Remove retired task error:", error);
    } finally {
      setIsProcessingCommand(false);
    }
  };

  // NEW: Handle auto-scheduling all tasks from the Aether Sink
  const handleAutoScheduleSink = async () => {
    if (!user || !profile) {
      showError("Please log in and ensure your profile is loaded to auto-schedule tasks.");
      return;
    }
    if (retiredTasks.length === 0) {
      showSuccess("Aether Sink is already empty!");
      return;
    }

    setIsProcessingCommand(true);
    let successfulRezones = 0;
    let failedRezones = 0;

    // Create a mutable copy of memoizedScheduledTimes for the loop
    let currentOptimisticTimesForBatch = [...memoizedScheduledTimes]; // Use a distinct name

    // Sort retired tasks to prioritize critical ones first
    const sortedRetiredTasks = [...retiredTasks].sort((a, b) => {
      if (a.is_critical && !b.is_critical) return -1;
      if (!a.is_critical && b.is_critical) return 1;
      return 0;
    });

    for (const task of sortedRetiredTasks) {
      try {
        const taskDuration = task.duration || 30; // Default duration if not specified
        const selectedDayAsDate = parseISO(selectedDay);

        const { proposedStartTime, proposedEndTime, message } = await findFreeSlotForTask(
          task.name,
          taskDuration,
          task.is_critical,
          currentOptimisticTimesForBatch, // Pass the mutable local copy
          effectiveWorkdayStart,
          workdayEndTime
        );

        if (proposedStartTime && proposedEndTime) {
          await rezoneTask(task.id); // Delete from retired_tasks

          const newScheduledTask: NewDBScheduledTask = { // Define new task for insertion
            name: task.name,
            start_time: proposedStartTime.toISOString(),
            end_time: proposedEndTime.toISOString(),
            break_duration: task.break_duration,
            scheduled_date: formattedSelectedDay,
            is_critical: task.is_critical,
            is_flexible: true, // Default to flexible when re-zoning from sink
          };
          await addScheduledTask(newScheduledTask); // Add to scheduled_tasks

          // Update the local list for subsequent tasks in this batch
          currentOptimisticTimesForBatch.push({ start: proposedStartTime, end: proposedEndTime, duration: taskDuration });
          currentOptimisticTimesForBatch = mergeOverlappingTimeBlocks(currentOptimisticTimesForBatch);

          successfulRezones++;
        } else {
          showError(message); // Error from findFreeSlotForTask
          failedRezones++;
        }
      } catch (error) {
        console.error(`Failed to auto-schedule task "${task.name}":`, error);
        failedRezones++;
      }
    }

    if (successfulRezones > 0) {
      showSuccess(`Successfully re-zoned ${successfulRezones} task(s) from Aether Sink.`);
    }
    if (failedRezones > 0) {
      showError(`Failed to re-zone ${failedRezones} task(s) from Aether Sink due to no available slots.`);
    }
    setIsProcessingCommand(false);
  };

  // NEW: Handle sorting flexible tasks by duration
  const handleSortByDuration = async () => {
    if (!user || !profile || !dbScheduledTasks) return;
    setIsProcessingCommand(true);

    const flexibleTasks = dbScheduledTasks.filter(task => task.is_flexible);
    if (flexibleTasks.length === 0) {
      showSuccess("No flexible tasks to sort by duration.");
      setIsProcessingCommand(false);
      return;
    }

    // Sort flexible tasks by duration (shortest first)
    const sortedFlexibleTasks = [...flexibleTasks].sort((a, b) => {
      const durationA = Math.floor((parseISO(a.end_time!).getTime() - parseISO(a.start_time!).getTime()) / (1000 * 60));
      const durationB = Math.floor((parseISO(b.end_time!).getTime() - parseISO(b.start_time!).getTime()) / (1000 * 60));
      return durationA - durationB;
    });

    const reorganizedTasks = compactScheduleLogic(
      dbScheduledTasks, // Pass all tasks
      selectedDayAsDate,
      workdayStartTime,
      workdayEndTime,
      T_current,
      sortedFlexibleTasks // Pass the pre-sorted flexible tasks
    );

    if (reorganizedTasks.length > 0) {
      await compactScheduledTasks(reorganizedTasks);
      showSuccess("Flexible tasks sorted by duration!");
    } else {
      showError("Could not sort flexible tasks by duration or no space available.");
    }
    setIsProcessingCommand(false);
  };

  // NEW: Handle sorting flexible tasks by priority (is_critical)
  const handleSortByPriority = async () => {
    if (!user || !profile || !dbScheduledTasks) return;
    setIsProcessingCommand(true);

    const flexibleTasks = dbScheduledTasks.filter(task => task.is_flexible);
    if (flexibleTasks.length === 0) {
      showSuccess("No flexible tasks to sort by priority.");
      setIsProcessingCommand(false);
      return;
    }

    // Sort flexible tasks by is_critical (critical first), then by duration (shortest first)
    const sortedFlexibleTasks = [...flexibleTasks].sort((a, b) => {
      if (a.is_critical && !b.is_critical) return -1; // Critical first
      if (!a.is_critical && b.is_critical) return 1;
      // If both are critical or both are not, sort by duration
      const durationA = Math.floor((parseISO(a.end_time!).getTime() - parseISO(a.start_time!).getTime()) / (1000 * 60));
      const durationB = Math.floor((parseISO(b.end_time!).getTime() - parseISO(b.start_time!).getTime()) / (1000 * 60));
      return durationA - durationB;
    });

    const reorganizedTasks = compactScheduleLogic(
      dbScheduledTasks, // Pass all tasks
      selectedDayAsDate,
      workdayStartTime,
      workdayEndTime,
      T_current,
      sortedFlexibleTasks // Pass the pre-sorted flexible tasks
    );

    if (reorganizedTasks.length > 0) {
      await compactScheduledTasks(reorganizedTasks);
      showSuccess("Flexible tasks sorted by priority!");
    } else {
      showError("Could not sort flexible tasks by priority or no space available.");
    }
    setIsProcessingCommand(false);
  };


  const activeItem: ScheduledItem | null = useMemo(() => {
    if (!currentSchedule || !isSameDay(parseISO(selectedDay), T_current)) return null;
    for (const item of currentSchedule.items) {
      if ((item.type === 'task' || item.type === 'break') && T_current >= item.startTime && T_current < item.endTime) {
        return item;
      }
    }
    return null;
  }, [currentSchedule, T_current, selectedDay]);

  const nextItem: ScheduledItem | null = useMemo(() => {
    if (!currentSchedule || !activeItem || !isSameDay(parseISO(selectedDay), T_current)) return null;
    const activeItemIndex = currentSchedule.items.findIndex(item => item.id === activeItem.id);
    if (activeItemIndex !== -1 && activeItemIndex < currentSchedule.items.length - 1) {
      for (let i = activeItemIndex + 1; i < currentSchedule.items.length; i++) {
        const item = currentSchedule.items[i];
        if (item.type === 'task' || item.type === 'break') {
          return item;
        }
      }
    }
    return null;
  }, [currentSchedule, activeItem, T_current, selectedDay]);


  const overallLoading = isSessionLoading || isSchedulerTasksLoading || isProcessingCommand || isLoadingRetiredTasks;

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

      <SchedulerDashboardPanel scheduleSummary={currentSchedule?.summary || null} />

      <CalendarStrip 
        selectedDay={selectedDay} 
        setSelectedDay={setSelectedDay} 
        datesWithTasks={datesWithTasks} 
        isLoadingDatesWithTasks={isLoadingDatesWithTasks} // Pass loading state
      />

      <Card className="animate-pop-in animate-hover-lift"> {/* Added animate-hover-lift */}
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-primary" /> Schedule Your Day
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleSortByDuration()} 
              disabled={overallLoading || !dbScheduledTasks.some(item => item.is_flexible)} // Disable if no flexible tasks
              className="flex items-center gap-1 h-8 px-3 text-sm font-semibold text-primary hover:bg-primary/10 transition-all duration-200"
            >
              <Clock className="h-4 w-4" /> Sort by Time
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleSortByPriority()} 
              disabled={overallLoading || !dbScheduledTasks.some(item => item.is_flexible)} // Disable if no flexible tasks
              className="flex items-center gap-1 h-8 px-3 text-sm font-semibold text-logo-yellow hover:bg-logo-yellow/10 transition-all duration-200"
            >
              <Star className="h-4 w-4" /> Sort by Priority
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => handleCommand('compact')} 
              disabled={overallLoading || !dbScheduledTasks.some(item => item.is_flexible)} // Disable if no flexible tasks
              className="h-8 w-8 text-primary hover:bg-primary/10 transition-all duration-200"
            >
              <ChevronsUp className="h-4 w-4" />
              <span className="sr-only">Compact Schedule</span>
            </Button>
            <p className="text-sm text-muted-foreground">
              Current Time: <span className="font-semibold">{formatDateTime(T_current)}</span>
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <WeatherWidget /> {/* <--- Placed here */}
          <SchedulerInput 
            onCommand={handleCommand} 
            isLoading={overallLoading} 
            inputValue={inputValue}
            setInputValue={setInputValue}
          />
          <p className="text-xs text-muted-foreground">
            Examples: "Gym 60", "Meeting 11am-12pm", 'inject "Project X" 30', 'remove "Gym"', 'clear', 'compact'
          </p>
        </CardContent>
      </Card>

      {isSameDay(parseISO(selectedDay), T_current) && (
        <NowFocusCard activeItem={activeItem} nextItem={nextItem} T_current={T_current} />
      )}

      {/* NEW: Aether Sink */}
      <AetherSink 
        retiredTasks={retiredTasks} 
        onRezoneTask={handleRezoneFromSink} 
        onRemoveRetiredTask={handleRemoveRetiredTask}
        onAutoScheduleSink={handleAutoScheduleSink} // Pass the new handler
        isLoading={isLoadingRetiredTasks}
        isProcessingCommand={isProcessingCommand} // Pass processing state
      />

      {currentSchedule?.summary.unscheduledCount > 0 && (
        <Card className="animate-pop-in animate-hover-lift"> {/* Added animate-hover-lift */}
          <CardContent className="p-4 text-center text-orange-500 font-semibold flex items-center justify-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            <span>⚠️ {currentSchedule.summary.unscheduledCount} task{currentSchedule.summary.unscheduledCount > 1 ? 's' : ''} fall outside your workday window.</span>
          </CardContent>
        </Card>
      )}

      <Card className="animate-pop-in animate-hover-lift" style={{ animationDelay: '0.1s' }}> {/* Added animate-hover-lift */}
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
            <SchedulerDisplay 
              schedule={currentSchedule} 
              T_current={T_current} 
              onRemoveTask={removeScheduledTask} 
              onRetireTask={handleManualRetire} // NEW: Pass retire handler
              activeItemId={activeItem?.id || null} 
              selectedDayString={selectedDay} 
            />
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