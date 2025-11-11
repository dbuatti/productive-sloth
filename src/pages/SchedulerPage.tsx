import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, ListTodo, Sparkles, Loader2, AlertTriangle, Trash2, ChevronsUp, Star } from 'lucide-react';
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
  compactScheduleLogic,
  mergeOverlappingTimeBlocks,
  isSlotFree,
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
import AetherSink from '@/components/AetherSink';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import WeatherWidget from '@/components/WeatherWidget';
import { TimeBlock } from '@/types/scheduler';

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

// Custom hook for deep equality memoization
function useDeepCompareMemoize<T>(value: T): T {
  const ref = useRef<T>(value);
  const signalRef = useRef<number>(0);

  if (!deepCompare(value, ref.current)) {
    ref.current = value;
    signalRef.current++;
  }

  return useMemo(() => ref.current, [signalRef.current]);
}

const getFreeTimeBlocks = (
  occupiedBlocks: TimeBlock[], // This is already merged and sorted
  workdayStart: Date, // This is effectiveWorkdayStart
  workdayEnd: Date
): TimeBlock[] => {
  const freeBlocks: TimeBlock[] = [];
  let currentFreeTimeStart = workdayStart;

  console.log("getFreeTimeBlocks: Calculating free blocks for workdayStart:", formatTime(workdayStart), "workdayEnd:", formatTime(workdayEnd));
  console.log("getFreeTimeBlocks: Initial occupiedBlocks:", occupiedBlocks.map(b => `${formatTime(b.start)}-${formatTime(b.end)}`));

  for (const appt of occupiedBlocks) { // Iterate over merged appointments
    console.log("getFreeTimeBlocks: Processing occupied block:", `${formatTime(appt.start)}-${formatTime(appt.end)}`);
    console.log("getFreeTimeBlocks: currentFreeTimeStart before check:", formatTime(currentFreeTimeStart));

    // If the appointment is entirely before our current search point, skip it.
    if (isBefore(appt.end, currentFreeTimeStart)) {
        console.log("getFreeTimeBlocks: Appt ends before currentFreeTimeStart, skipping.");
        continue;
    }

    // If there's a gap between currentFreeTimeStart and the start of this appointment
    // (and the appointment starts within or after the workdayStart)
    if (isBefore(currentFreeTimeStart, appt.start)) {
      const duration = Math.floor((appt.start.getTime() - currentFreeTimeStart.getTime()) / (1000 * 60));
      if (duration > 0) {
        freeBlocks.push({ start: currentFreeTimeStart, end: appt.start, duration });
        console.log("getFreeTimeBlocks: Found free block:", `${formatTime(currentFreeTimeStart)}-${formatTime(appt.start)} (${duration} min)`);
      }
    }
    // Move currentFreeTimeStart past this appointment's end
    currentFreeTimeStart = isAfter(appt.end, currentFreeTimeStart) ? appt.end : currentFreeTimeStart; // Ensure it moves forward
    console.log("getFreeTimeBlocks: currentFreeTimeStart after processing appt:", formatTime(currentFreeTimeStart));
  }

  // Add any remaining free time after the last appointment until workdayEnd
  if (isBefore(currentFreeTimeStart, workdayEnd)) {
    const duration = Math.floor((workdayEnd.getTime() - currentFreeTimeStart.getTime()) / (1000 * 60));
    if (duration > 0) {
      freeBlocks.push({ start: currentFreeTimeStart, end: workdayEnd, duration });
      console.log("getFreeTimeBlocks: Found final free block:", `${formatTime(currentFreeTimeStart)}-${formatTime(workdayEnd)} (${duration} min)`);
    }
  }
  console.log("getFreeTimeBlocks: Final free blocks:", freeBlocks.map(b => `${formatTime(b.start)}-${formatTime(b.end)}`));
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
    isLoadingDatesWithTasks,
    retiredTasks,
    isLoadingRetiredTasks,
    retireTask,
    rezoneTask,
    compactScheduledTasks,
  } = useSchedulerTasks(selectedDay);

  const queryClient = useQueryClient();

  const [T_current, setT_current] = useState(new Date());
  
  const [isProcessingCommand, setIsProcessingCommand] = useState(false);
  const [injectionPrompt, setInjectionPrompt] = useState<{ taskName: string; isOpen: boolean; isTimed?: boolean; startTime?: string; endTime?: string; isCritical?: boolean; isFlexible?: boolean } | null>(null);
  const [injectionDuration, setInjectionDuration] = useState('');
  const [injectionBreak, setInjectionBreak] = useState('');
  const [injectionStartTime, setInjectionStartTime] = useState('');
  const [injectionEndTime, setInjectionEndTime] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [hasMorningFixRunToday, setHasMorningFixRunToday] = useState(false);

  // Calculate selectedDayAsDate early
  const selectedDayAsDate = useMemo(() => parseISO(selectedDay), [selectedDay]);

  // Memoized occupied blocks, deeply compared for stability
  const occupiedBlocks = useDeepCompareMemoize(useMemo(() => {
    if (!dbScheduledTasks) return [];
    const mappedTimes = dbScheduledTasks
      .filter(task => task.start_time && task.end_time)
      .map(task => {
        const utcStart = parseISO(task.start_time!);
        const utcEnd = parseISO(task.end_time!);

        // Align the UTC times to the selectedDayAsDate, preserving their time-of-day
        let localStart = setHours(setMinutes(selectedDayAsDate, utcStart.getUTCMinutes()), utcStart.getUTCHours());
        let localEnd = setHours(setMinutes(selectedDayAsDate, utcEnd.getUTCMinutes()), utcEnd.getUTCHours());

        // Handle rollover to next day if end time is before start time
        if (isBefore(localEnd, localStart)) {
          localEnd = addDays(localEnd, 1);
        }
        const block = {
          start: localStart,
          end: localEnd,
          duration: Math.floor((localEnd.getTime() - localStart.getTime()) / (1000 * 60)),
        };
        console.log(`SchedulerPage: Mapped task "${task.name}" (DB: ${task.start_time}-${task.end_time}) to block: ${formatTime(block.start)}-${formatTime(block.end)}`); // ADDED LOG
        return block;
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    console.log("SchedulerPage: Mapped and sorted times before merging:", mappedTimes.map(b => `${formatTime(b.start)}-${formatTime(b.end)}`)); // ADDED LOG

    const merged = mergeOverlappingTimeBlocks(mappedTimes);
    console.log("SchedulerPage: Calculated occupiedBlocks (merged):", merged.map(b => `${formatTime(b.start)}-${formatTime(b.end)}`));
    return merged;
  }, [dbScheduledTasks, selectedDayAsDate]));


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
      const { name, duration, isCritical } = taskToSchedule;
      const command = `inject "${name}" ${duration}${isCritical ? ' !' : ''}`;
      handleCommand(command);
      navigate(location.pathname, { replace: true, state: {} }); 
    }
  }, [location.state, navigate]);

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
          event.preventDefault();
          newDate = subDays(currentSelectedDate, 1);
          setSelectedDay(format(newDate, 'yyyy-MM-dd'));
          break;
        case 'ArrowRight':
          event.preventDefault();
          newDate = addDays(currentSelectedDate, 1);
          setSelectedDay(format(newDate, 'yyyy-MM-dd'));
          break;
        case ' ':
          event.preventDefault();
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
  }, [selectedDay]);


  // Calculate workday boundaries from profile
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
      console.log("SchedulerPage: Effective workday start is T_current:", formatTime(T_current));
      return T_current;
    }
    console.log("SchedulerPage: Effective workday start is workdayStartTime:", formatTime(workdayStartTime));
    return workdayStartTime;
  }, [selectedDayAsDate, T_current, workdayStartTime]);

  // Ref to store the previous calculated schedule for deep comparison
  const previousCalculatedScheduleRef = useRef<FormattedSchedule | null>(null);

  // Calculate the schedule based on tasks, selected day, and explicit anchor
  const calculatedSchedule = useMemo(() => {
    if (!profile) return null;
    const newSchedule = calculateSchedule(dbScheduledTasks, selectedDay, workdayStartTime, workdayEndTime);
    
    // Deep compare with previous schedule to prevent unnecessary state updates
    if (deepCompare(newSchedule, previousCalculatedScheduleRef.current)) {
      return previousCalculatedScheduleRef.current;
    }
    previousCalculatedScheduleRef.current = newSchedule;
    return newSchedule;
  }, [dbScheduledTasks, selectedDay, workdayStartTime, workdayEndTime, profile]);

  // Set currentSchedule state from the memoized calculation
  const [currentSchedule, setCurrentSchedule] = useState<FormattedSchedule | null>(null);
  useEffect(() => {
    setCurrentSchedule(calculatedSchedule);
  }, [calculatedSchedule]);

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
        console.log(`SchedulerPage: Automatically retiring ${tasksToRetire.length} past-due tasks from before workday start.`);
        tasksToRetire.forEach(task => {
          retireTask(task);
        });
        setHasMorningFixRunToday(true);
      } else {
        setHasMorningFixRunToday(true);
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
    existingOccupiedBlocks: TimeBlock[],
    effectiveWorkdayStart: Date,
    workdayEndTime: Date
  ): Promise<{ proposedStartTime: Date | null, proposedEndTime: Date | null, message: string }> => {
    console.log(`findFreeSlotForTask: Attempting to find slot for "${taskName}" (${taskDuration} min), Critical: ${isCritical}`);
    console.log("findFreeSlotForTask: Existing occupied blocks:", existingOccupiedBlocks.map(b => `${formatTime(b.start)}-${formatTime(b.end)}`));
    console.log("findFreeSlotForTask: Effective workday start:", formatTime(effectiveWorkdayStart), "Workday end:", formatTime(workdayEndTime));

    let proposedStartTime: Date | null = null;
    const freeBlocks = getFreeTimeBlocks(existingOccupiedBlocks, effectiveWorkdayStart, workdayEndTime);
    console.log("findFreeSlotForTask: Available free blocks:", freeBlocks.map(b => `${formatTime(b.start)}-${formatTime(b.end)} (${b.duration} min)`));

    // Prioritize critical tasks for earlier slots
    if (isCritical) {
      console.log("findFreeSlotForTask: Task is critical, prioritizing earlier slots.");
      for (const block of freeBlocks) {
        if (taskDuration <= block.duration) {
          proposedStartTime = block.start;
          console.log(`findFreeSlotForTask: Found critical slot at ${formatTime(proposedStartTime)} in block ${formatTime(block.start)}-${formatTime(block.end)}`);
          break;
        }
      }
    } else {
      console.log("findFreeSlotForTask: Task is not critical, finding first available slot.");
      for (const block of freeBlocks) {
        if (taskDuration <= block.duration) {
          proposedStartTime = block.start;
          console.log(`findFreeSlotForTask: Found slot at ${formatTime(proposedStartTime)} in block ${formatTime(block.start)}-${formatTime(block.end)}`);
          break; 
        }
      }
    }

    if (proposedStartTime) {
      const proposedEndTime = addMinutes(proposedStartTime, taskDuration);
      console.log(`findFreeSlotForTask: Proposed slot: ${formatTime(proposedStartTime)} - ${formatTime(proposedEndTime)}`);
      return { proposedStartTime, proposedEndTime, message: "" };
    } else {
      const message = `No available slot found within your workday (${formatTime(workdayStartTime)} - ${formatTime(workdayEndTime)}) for "${taskName}" (${taskDuration} min).`;
      console.log(`findFreeSlotForTask: ${message}`);
      return { proposedStartTime: null, proposedEndTime: null, message: message };
    }
  }, [workdayStartTime, workdayEndTime]);


  const handleClearSchedule = async () => {
    if (!user) {
      showError("You must be logged in to clear your schedule.");
      return;
    }
    setIsProcessingCommand(true);
    console.log(`SchedulerPage: Clearing all scheduled tasks for ${formattedSelectedDay}`);
    await clearScheduledTasks();
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
    console.log(`SchedulerPage: Processing command input: "${input}"`);
    
    const parsedInput = parseTaskInput(input, selectedDayAsDate);
    const injectCommand = parseInjectionCommand(input);
    const command = parseCommand(input);

    let success = false;
    const taskScheduledDate = formattedSelectedDay;

    // Create a mutable copy of occupiedBlocks for optimistic updates within this command execution
    let currentOccupiedBlocksForScheduling = [...occupiedBlocks];
    console.log("SchedulerPage: currentOccupiedBlocksForScheduling (initial):", currentOccupiedBlocksForScheduling.map(b => `${formatTime(b.start)}-${formatTime(b.end)}`));


    if (parsedInput) {
      console.log("SchedulerPage: Input parsed as a task:", parsedInput);
      const isAdHocTask = 'duration' in parsedInput;

      if (isAdHocTask) {
        const newTaskDuration = parsedInput.duration!;
        console.log(`SchedulerPage: Ad-hoc task "${parsedInput.name}" with duration ${newTaskDuration} min.`);
        const { proposedStartTime, proposedEndTime, message } = await findFreeSlotForTask(
          parsedInput.name,
          newTaskDuration,
          parsedInput.isCritical,
          currentOccupiedBlocksForScheduling,
          effectiveWorkdayStart,
          workdayEndTime
        );
        
        if (proposedStartTime && proposedEndTime) {
          console.log(`SchedulerPage: Proposed slot for "${parsedInput.name}": ${formatTime(proposedStartTime)} - ${formatTime(proposedEndTime)}`);
          await addScheduledTask({ 
            name: parsedInput.name, 
            start_time: proposedStartTime.toISOString(), 
            end_time: proposedEndTime.toISOString(), 
            scheduled_date: taskScheduledDate,
            break_duration: parsedInput.breakDuration,
            is_critical: parsedInput.isCritical,
            is_flexible: true,
          });
          currentOccupiedBlocksForScheduling.push({ start: proposedStartTime, end: proposedEndTime, duration: newTaskDuration });
          currentOccupiedBlocksForScheduling = mergeOverlappingTimeBlocks(currentOccupiedBlocksForScheduling);
          console.log("SchedulerPage: currentOccupiedBlocksForScheduling (after ad-hoc add):", currentOccupiedBlocksForScheduling.map(b => `${formatTime(b.start)}-${formatTime(b.end)}`));
          
          showSuccess(`Scheduled "${parsedInput.name}" from ${formatTime(proposedStartTime)} to ${formatTime(proposedEndTime)}.`);
          success = true;
        } else {
          showError(message);
        }

      } else {
        console.log(`SchedulerPage: Timed task "${parsedInput.name}" from ${formatTime(parsedInput.startTime!)} to ${formatTime(parsedInput.endTime!)}.`);
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
          console.log(`SchedulerPage: Adjusted timed task to tomorrow: ${formatTime(startTime)} - ${formatTime(endTime)}`);
        } else if (isBefore(endTime, startTime)) {
          endTime = addDays(endTime, 1);
          console.log(`SchedulerPage: Adjusted timed task to roll over to next day: ${formatTime(startTime)} - ${formatTime(endTime)}`);
        }

        console.log(`SchedulerPage: Checking if slot ${formatTime(startTime)} - ${formatTime(endTime)} is free.`);
        if (!isSlotFree(startTime, endTime, currentOccupiedBlocksForScheduling)) {
          showError(`The time slot from ${formatTime(startTime)} to ${formatTime(endTime)} is already occupied.`);
          console.log("SchedulerPage: Slot is NOT free, showing error.");
          setIsProcessingCommand(false);
          return;
        }
        console.log("SchedulerPage: Slot IS free.");

        const duration = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
        await addScheduledTask({ name: parsedInput.name, start_time: startTime.toISOString(), end_time: endTime.toISOString(), scheduled_date: taskScheduledDate, is_critical: parsedInput.isCritical, is_flexible: false });
        currentOccupiedBlocksForScheduling.push({ start: startTime, end: endTime, duration: duration });
        currentOccupiedBlocksForScheduling = mergeOverlappingTimeBlocks(currentOccupiedBlocksForScheduling);
        console.log("SchedulerPage: currentOccupiedBlocksForScheduling (after timed add):", currentOccupiedBlocksForScheduling.map(b => `${formatTime(b.start)}-${formatTime(b.end)}`));

        showSuccess(`Scheduled "${parsedInput.name}" from ${formatTime(startTime)} to ${formatTime(endTime)}.`);
        success = true;
      }
    } else if (injectCommand) {
      console.log("SchedulerPage: Input parsed as an inject command:", injectCommand);
      const isAdHocInjection = !injectCommand.startTime && !injectCommand.endTime;

      if (isAdHocInjection) {
        const injectedTaskDuration = injectCommand.duration || 30;
        console.log(`SchedulerPage: Ad-hoc inject "${injectCommand.taskName}" with duration ${injectedTaskDuration} min.`);
        const { proposedStartTime, proposedEndTime, message } = await findFreeSlotForTask(
          injectCommand.taskName,
          injectedTaskDuration,
          injectCommand.isCritical,
          currentOccupiedBlocksForScheduling,
          effectiveWorkdayStart,
          workdayEndTime
        );

        if (proposedStartTime && proposedEndTime) {
          console.log(`SchedulerPage: Proposed slot for injected task: ${formatTime(proposedStartTime)} - ${formatTime(proposedEndTime)}`);
          await addScheduledTask({ 
            name: injectCommand.taskName, 
            start_time: proposedStartTime.toISOString(), 
            end_time: proposedEndTime.toISOString(), 
            break_duration: injectCommand.breakDuration, 
            scheduled_date: taskScheduledDate,
            is_critical: injectCommand.isCritical,
            is_flexible: injectCommand.isFlexible,
          });
          currentOccupiedBlocksForScheduling.push({ start: proposedStartTime, end: proposedEndTime, duration: injectedTaskDuration });
          currentOccupiedBlocksForScheduling = mergeOverlappingTimeBlocks(currentOccupiedBlocksForScheduling);
          console.log("SchedulerPage: currentOccupiedBlocksForScheduling (after ad-hoc inject):", currentOccupiedBlocksForScheduling.map(b => `${formatTime(b.start)}-${formatTime(b.end)}`));

          showSuccess(`Injected "${injectCommand.taskName}" from ${formatTime(proposedStartTime)} to ${formatTime(proposedEndTime)}.`);
          success = true;
        } else {
          showError(message);
        }

      } else if (injectCommand.startTime && injectCommand.endTime) {
        console.log(`SchedulerPage: Timed inject "${injectCommand.taskName}" from ${injectCommand.startTime} to ${injectCommand.endTime}. Opening dialog.`);
        setInjectionPrompt({ 
          taskName: injectCommand.taskName, 
          isOpen: true, 
          isTimed: true,
          startTime: injectCommand.startTime,
          endTime: injectCommand.endTime,
          isCritical: injectCommand.isCritical,
          isFlexible: injectCommand.isFlexible,
        });
        setInjectionStartTime(injectCommand.startTime);
        setInjectionEndTime(injectCommand.endTime);
        success = true;
      } else {
        console.log(`SchedulerPage: Duration-based inject "${injectCommand.taskName}". Opening dialog.`);
        setInjectionPrompt({ 
          taskName: injectCommand.taskName, 
          isOpen: true, 
          isTimed: false,
          startTime: undefined,
          endTime: undefined,
          isCritical: injectCommand.isCritical,
          isFlexible: injectCommand.isFlexible,
        });
        success = true;
      }
    } else if (command) {
      console.log("SchedulerPage: Input parsed as a command:", command);
      switch (command.type) {
        case 'clear':
          console.log("SchedulerPage: Command 'clear' detected. Showing confirmation.");
          setShowClearConfirmation(true);
          success = true;
          break;
        case 'remove':
          if (command.index !== undefined) {
            console.log(`SchedulerPage: Command 'remove' by index ${command.index + 1}.`);
            if (command.index >= 0 && command.index < dbScheduledTasks.length) {
              const taskToRemove = dbScheduledTasks[command.index];
              console.log(`SchedulerPage: Removing task: "${taskToRemove.name}" (ID: ${taskToRemove.id})`);
              await removeScheduledTask(taskToRemove.id);
              currentOccupiedBlocksForScheduling = currentOccupiedBlocksForScheduling.filter(block => 
                !(block.start.getTime() === parseISO(taskToRemove.start_time!).getTime() && 
                  block.end.getTime() === parseISO(taskToRemove.end_time!).getTime())
              );
              console.log("SchedulerPage: currentOccupiedBlocksForScheduling (after remove by index):", currentOccupiedBlocksForScheduling.map(b => `${formatTime(b.start)}-${formatTime(b.end)}`));
              success = true;
            } else {
              showError(`Invalid index. Please provide a number between 1 and ${dbScheduledTasks.length}.`);
              console.log("SchedulerPage: Invalid index for remove command.");
            }
          } else if (command.target) {
            console.log(`SchedulerPage: Command 'remove' by target "${command.target}".`);
            const tasksToRemove = dbScheduledTasks.filter(task => task.name.toLowerCase().includes(command.target!.toLowerCase()));
            if (tasksToRemove.length > 0) {
              for (const task of tasksToRemove) {
                console.log(`SchedulerPage: Removing task: "${task.name}" (ID: ${task.id})`);
                await removeScheduledTask(task.id);
                currentOccupiedBlocksForScheduling = currentOccupiedBlocksForScheduling.filter(block => 
                  !(block.start.getTime() === parseISO(task.start_time!).getTime() && 
                    block.end.getTime() === parseISO(task.end_time!).getTime())
                );
              }
              console.log("SchedulerPage: currentOccupiedBlocksForScheduling (after remove by target):", currentOccupiedBlocksForScheduling.map(b => `${formatTime(b.start)}-${formatTime(b.end)}`));
              showSuccess(`Removed tasks matching "${command.target}".`);
              success = true;
            } else {
              showError(`No tasks found matching "${command.target}".`);
              console.log("SchedulerPage: No tasks found for remove target.");
            }
          } else {
            showError("Please specify a task name or index to remove (e.g., 'remove Task Name' or 'remove index 1').");
            console.log("SchedulerPage: Remove command missing target or index.");
          }
          break;
        case 'show':
          console.log("SchedulerPage: Command 'show' detected.");
          showSuccess("Displaying current queue.");
          success = true;
          break;
        case 'reorder':
          console.log("SchedulerPage: Command 'reorder' detected (not implemented).");
          showError("Reordering is not yet implemented.");
          break;
        case 'compact':
          console.log("SchedulerPage: Command 'compact' detected. Calling compactScheduleLogic.");
          const compactedTasks = compactScheduleLogic(
            dbScheduledTasks,
            selectedDayAsDate,
            workdayStartTime,
            workdayEndTime,
            T_current
          );
          if (compactedTasks.length > 0) {
            console.log("SchedulerPage: Compacted tasks result:", compactedTasks.map(t => `${t.name} ${formatTime(parseISO(t.start_time!))}-${formatTime(parseISO(t.end_time!))}`));
            await compactScheduledTasks(compactedTasks);
            currentOccupiedBlocksForScheduling = mergeOverlappingTimeBlocks(compactedTasks.map(task => ({
              start: parseISO(task.start_time!),
              end: parseISO(task.end_time!),
              duration: Math.floor((parseISO(task.end_time!).getTime() - parseISO(task.start_time!).getTime()) / (1000 * 60))
            })));
            console.log("SchedulerPage: currentOccupiedBlocksForScheduling (after compact):", currentOccupiedBlocksForScheduling.map(b => `${formatTime(b.start)}-${formatTime(b.end)}`));
            showSuccess("Schedule compacted!");
          } else {
            showError("No flexible tasks to compact or no space available.");
            console.log("SchedulerPage: No flexible tasks to compact or no space available.");
          }
          success = true;
          break;
        default:
          showError("Unknown command.");
          console.log("SchedulerPage: Unknown command detected.");
      }
    } else {
      showError("Invalid input. Please use 'Task Name Duration [Break]', 'Task Name HH:MM AM/PM - HH:MM AM/PM', or a command.");
      console.log("SchedulerPage: Input did not match any known task or command format.");
    }
    
    setIsProcessingCommand(false);
    if (success) {
      setInputValue('');
    }
    console.log("SchedulerPage: Command processing finished.");
  };

  const handleInjectionSubmit = async () => {
    if (!user || !profile || !injectionPrompt) {
      showError("You must be logged in and your profile loaded to use the scheduler.");
      return;
    }
    setIsProcessingCommand(true);
    console.log("SchedulerPage: Handling injection dialog submission:", injectionPrompt);

    let success = false;
    const taskScheduledDate = formattedSelectedDay;
    const selectedDayAsDate = parseISO(selectedDay);

    // Create a mutable copy of occupiedBlocks for optimistic updates
    let currentOccupiedBlocksForScheduling = [...occupiedBlocks];
    console.log("SchedulerPage: currentOccupiedBlocksForScheduling (initial for injection dialog):", currentOccupiedBlocksForScheduling.map(b => `${formatTime(b.start)}-${formatTime(b.end)}`));


    if (injectionPrompt.isTimed) {
      console.log("SchedulerPage: Timed injection from dialog.");
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
        console.log(`SchedulerPage: Adjusted timed injection to tomorrow: ${formatTime(startTime)} - ${formatTime(endTime)}`);
      } else if (isBefore(endTime, startTime)) {
        endTime = addDays(endTime, 1);
        console.log(`SchedulerPage: Adjusted timed injection to roll over to next day: ${formatTime(startTime)} - ${formatTime(endTime)}`);
      }

      console.log(`SchedulerPage: Checking if slot ${formatTime(startTime)} - ${formatTime(endTime)} is free for timed injection.`);
      if (!isSlotFree(startTime, endTime, currentOccupiedBlocksForScheduling)) {
        showError(`The time slot from ${formatTime(startTime)} to ${formatTime(endTime)} is already occupied.`);
        console.log("SchedulerPage: Slot is NOT free for timed injection, showing error.");
        setIsProcessingCommand(false);
        return;
      }
      console.log("SchedulerPage: Slot IS free for timed injection.");

      const duration = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
      await addScheduledTask({ name: injectionPrompt.taskName, start_time: startTime.toISOString(), end_time: endTime.toISOString(), scheduled_date: taskScheduledDate, is_critical: injectionPrompt.isCritical, is_flexible: injectionPrompt.isFlexible });
      currentOccupiedBlocksForScheduling.push({ start: startTime, end: endTime, duration: duration });
      currentOccupiedBlocksForScheduling = mergeOverlappingTimeBlocks(currentOccupiedBlocksForScheduling);
      console.log("SchedulerPage: currentOccupiedBlocksForScheduling (after timed injection add):", currentOccupiedBlocksForScheduling.map(b => `${formatTime(b.start)}-${formatTime(b.end)}`));

      showSuccess(`Injected "${injectionPrompt.taskName}" from ${formatTime(startTime)} to ${formatTime(endTime)}.`);
      success = true;
    } else {
      console.log("SchedulerPage: Duration-based injection from dialog.");
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
        currentOccupiedBlocksForScheduling,
        effectiveWorkdayStart,
        workdayEndTime
      );

      if (proposedStartTime && proposedEndTime) {
        console.log(`SchedulerPage: Proposed slot for duration-based injected task: ${formatTime(proposedStartTime)} - ${formatTime(proposedEndTime)}`);
        await addScheduledTask({ 
          name: injectionPrompt.taskName, 
          start_time: proposedStartTime.toISOString(), 
          end_time: proposedEndTime.toISOString(), 
          break_duration: breakDuration, 
          scheduled_date: taskScheduledDate,
          is_critical: injectionPrompt.isCritical,
          is_flexible: injectionPrompt.isFlexible,
        });
        currentOccupiedBlocksForScheduling.push({ start: proposedStartTime, end: proposedEndTime, duration: injectedTaskDuration });
        currentOccupiedBlocksForScheduling = mergeOverlappingTimeBlocks(currentOccupiedBlocksForScheduling);
        console.log("SchedulerPage: currentOccupiedBlocksForScheduling (after duration-based injection add):", currentOccupiedBlocksForScheduling.map(b => `${formatTime(b.start)}-${formatTime(b.end)}`));

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
    console.log("SchedulerPage: Injection dialog submission finished.");
  };

  // NEW: Handle rezone from Aether Sink
  const handleRezoneFromSink = async (retiredTask: RetiredTask) => {
    if (!user || !profile) {
      showError("Please log in and ensure your profile is loaded to rezone tasks.");
      return;
    }
    setIsProcessingCommand(true);
    console.log(`SchedulerPage: Re-zoning task "${retiredTask.name}" (ID: ${retiredTask.id}) from Aether Sink.`);

    try {
      const taskDuration = retiredTask.duration || 30;
      const selectedDayAsDate = parseISO(selectedDay);

      // Create a mutable copy of occupiedBlocks for optimistic updates
      let currentOccupiedBlocksForScheduling = [...occupiedBlocks];
      console.log("SchedulerPage: currentOccupiedBlocksForScheduling (initial for rezone):", currentOccupiedBlocksForScheduling.map(b => `${formatTime(b.start)}-${formatTime(b.end)}`));


      const { proposedStartTime, proposedEndTime, message } = await findFreeSlotForTask(
        retiredTask.name,
        taskDuration,
        retiredTask.is_critical,
        currentOccupiedBlocksForScheduling,
        effectiveWorkdayStart,
        workdayEndTime
      );

      if (proposedStartTime && proposedEndTime) {
        console.log(`SchedulerPage: Proposed slot for re-zoned task: ${formatTime(proposedStartTime)} - ${formatTime(proposedEndTime)}`);
        // 1. Delete from retired_tasks (now that we know it can be scheduled)
        await rezoneTask(retiredTask.id);

        // 2. Add to scheduled_tasks
        await addScheduledTask({
          name: retiredTask.name,
          start_time: proposedStartTime.toISOString(),
          end_time: proposedEndTime.toISOString(),
          break_duration: retiredTask.break_duration,
          scheduled_date: formattedSelectedDay,
          is_critical: retiredTask.is_critical,
          is_flexible: true,
        });
        currentOccupiedBlocksForScheduling.push({ start: proposedStartTime, end: proposedEndTime, duration: taskDuration });
        currentOccupiedBlocksForScheduling = mergeOverlappingTimeBlocks(currentOccupiedBlocksForScheduling);
        console.log("SchedulerPage: currentOccupiedBlocksForScheduling (after rezone add):", currentOccupiedBlocksForScheduling.map(b => `${formatTime(b.start)}-${formatTime(b.end)}`));

        showSuccess(`Re-zoned "${retiredTask.name}" from ${formatTime(proposedStartTime)} to ${formatTime(proposedEndTime)}.`);
      } else {
        showError(message);
      }
    } catch (error: any) {
      showError(`Failed to rezone task: ${error.message}`);
      console.error("SchedulerPage: Rezone error:", error);
    } finally {
      setIsProcessingCommand(false);
      console.log("SchedulerPage: Rezone finished.");
    }
  };

  // NEW: Handle manual retirement from SchedulerDisplay
  const handleManualRetire = async (taskToRetire: DBScheduledTask) => {
    if (!user) {
      showError("You must be logged in to retire tasks.");
      return;
    }
    setIsProcessingCommand(true);
    console.log(`SchedulerPage: Manually retiring task "${taskToRetire.name}" (ID: ${taskToRetire.id}).`);
    await retireTask(taskToRetire);
    setIsProcessingCommand(false);
    console.log("SchedulerPage: Manual retirement finished.");
  };

  // NEW: Handle permanent removal from Aether Sink
  const handleRemoveRetiredTask = async (retiredTaskId: string) => {
    if (!user) {
      showError("You must be logged in to remove retired tasks.");
      return;
    }
    setIsProcessingCommand(true);
    console.log(`SchedulerPage: Permanently removing retired task ID: ${retiredTaskId}.`);
    try {
      const { error } = await supabase.from('retired_tasks').delete().eq('id', retiredTaskId).eq('user_id', user.id);
      if (error) throw new Error(error.message);
      showSuccess('Task permanently removed from Aether Sink.');
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', user.id] });
    } catch (error: any) {
      showError(`Failed to remove retired task: ${error.message}`);
      console.error("SchedulerPage: Remove retired task error:", error);
    } finally {
      setIsProcessingCommand(false);
      console.log("SchedulerPage: Permanent removal finished.");
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
    console.log(`SchedulerPage: Auto-scheduling all ${retiredTasks.length} tasks from Aether Sink.`);
    let successfulRezones = 0;
    let failedRezones = 0;

    // Create a mutable copy of occupiedBlocks for optimistic updates
    let currentOccupiedBlocksForScheduling = [...occupiedBlocks];
    console.log("SchedulerPage: currentOccupiedBlocksForScheduling (initial for auto-schedule sink):", currentOccupiedBlocksForScheduling.map(b => `${formatTime(b.start)}-${formatTime(b.end)}`));


    // Sort retired tasks to prioritize critical ones first
    const sortedRetiredTasks = [...retiredTasks].sort((a, b) => {
      if (a.is_critical && !b.is_critical) return -1;
      if (!a.is_critical && b.is_critical) return 1;
      return 0;
    });

    for (const task of sortedRetiredTasks) {
      console.log(`SchedulerPage: Attempting to auto-schedule retired task "${task.name}" (ID: ${task.id}).`);
      try {
        const taskDuration = task.duration || 30;
        const selectedDayAsDate = parseISO(selectedDay);

        const { proposedStartTime, proposedEndTime, message } = await findFreeSlotForTask(
          task.name,
          taskDuration,
          task.is_critical,
          currentOccupiedBlocksForScheduling,
          effectiveWorkdayStart,
          workdayEndTime
        );

        if (proposedStartTime && proposedEndTime) {
          console.log(`SchedulerPage: Proposed slot for auto-scheduled retired task: ${formatTime(proposedStartTime)} - ${formatTime(proposedEndTime)}`);
          await rezoneTask(task.id);

          const newScheduledTask: NewDBScheduledTask = {
            name: task.name,
            start_time: proposedStartTime.toISOString(),
            end_time: proposedEndTime.toISOString(),
            break_duration: task.break_duration,
            scheduled_date: formattedSelectedDay,
            is_critical: task.is_critical,
            is_flexible: true,
          };
          await addScheduledTask(newScheduledTask);

          currentOccupiedBlocksForScheduling.push({ start: proposedStartTime, end: proposedEndTime, duration: taskDuration });
          currentOccupiedBlocksForScheduling = mergeOverlappingTimeBlocks(currentOccupiedBlocksForScheduling);
          console.log("SchedulerPage: currentOccupiedBlocksForScheduling (after auto-schedule sink add):", currentOccupiedBlocksForScheduling.map(b => `${formatTime(b.start)}-${formatTime(b.end)}`));

          successfulRezones++;
        } else {
          showError(message);
          failedRezones++;
        }
      } catch (error) {
        console.error(`SchedulerPage: Failed to auto-schedule task "${task.name}":`, error);
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
    console.log("SchedulerPage: Auto-schedule sink finished.");
  };

  // NEW: Handle sorting flexible tasks by duration
  const handleSortByDuration = async () => {
    if (!user || !profile || !dbScheduledTasks) return;
    setIsProcessingCommand(true);
    console.log("SchedulerPage: Sorting flexible tasks by duration.");

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
    console.log("SchedulerPage: Flexible tasks sorted by duration:", sortedFlexibleTasks.map(t => `${t.name} (${Math.floor((parseISO(t.end_time!).getTime() - parseISO(t.start_time!).getTime()) / (1000 * 60))} min)`));


    const reorganizedTasks = compactScheduleLogic(
      dbScheduledTasks,
      selectedDayAsDate,
      workdayStartTime,
      workdayEndTime,
      T_current,
      sortedFlexibleTasks
    );

    if (reorganizedTasks.length > 0) {
      console.log("SchedulerPage: Reorganized tasks after duration sort:", reorganizedTasks.map(t => `${t.name} ${formatTime(parseISO(t.start_time!))}-${formatTime(parseISO(t.end_time!))}`));
      await compactScheduledTasks(reorganizedTasks);
      showSuccess("Flexible tasks sorted by duration!");
    } else {
      showError("Could not sort flexible tasks by duration or no space available.");
      console.log("SchedulerPage: Could not sort flexible tasks by duration or no space available.");
    }
    setIsProcessingCommand(false);
    console.log("SchedulerPage: Sort by duration finished.");
  };

  // NEW: Handle sorting flexible tasks by priority (is_critical)
  const handleSortByPriority = async () => {
    if (!user || !profile || !dbScheduledTasks) return;
    setIsProcessingCommand(true);
    console.log("SchedulerPage: Sorting flexible tasks by priority.");

    const flexibleTasks = dbScheduledTasks.filter(task => task.is_flexible);
    if (flexibleTasks.length === 0) {
      showSuccess("No flexible tasks to sort by priority.");
      setIsProcessingCommand(false);
      return;
    }

    // Sort flexible tasks by is_critical (critical first), then by duration (shortest first)
    const sortedFlexibleTasks = [...flexibleTasks].sort((a, b) => {
      if (a.is_critical && !b.is_critical) return -1;
      if (!a.is_critical && b.is_critical) return 1;
      const durationA = Math.floor((parseISO(a.end_time!).getTime() - parseISO(a.start_time!).getTime()) / (1000 * 60));
      const durationB = Math.floor((parseISO(b.end_time!).getTime() - parseISO(b.start_time!).getTime()) / (1000 * 60));
      return durationA - durationB;
    });
    console.log("SchedulerPage: Flexible tasks sorted by priority:", sortedFlexibleTasks.map(t => `${t.name} (Critical: ${t.is_critical}, Duration: ${Math.floor((parseISO(t.end_time!).getTime() - parseISO(t.start_time!).getTime()) / (1000 * 60))} min)`));


    const reorganizedTasks = compactScheduleLogic(
      dbScheduledTasks,
      selectedDayAsDate,
      workdayStartTime,
      workdayEndTime,
      T_current,
      sortedFlexibleTasks
    );

    if (reorganizedTasks.length > 0) {
      console.log("SchedulerPage: Reorganized tasks after priority sort:", reorganizedTasks.map(t => `${t.name} ${formatTime(parseISO(t.start_time!))}-${formatTime(parseISO(t.end_time!))}`));
      await compactScheduledTasks(reorganizedTasks);
      showSuccess("Flexible tasks sorted by priority!");
    } else {
      showError("Could not sort flexible tasks by priority or no space available.");
      console.log("SchedulerPage: Could not sort flexible tasks by priority or no space available.");
    }
    setIsProcessingCommand(false);
    console.log("SchedulerPage: Sort by priority finished.");
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
        isLoadingDatesWithTasks={isLoadingDatesWithTasks}
      />

      <Card className="animate-pop-in animate-hover-lift">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-primary" /> Schedule Your Day
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleSortByDuration()} 
              disabled={overallLoading || !dbScheduledTasks.some(item => item.is_flexible)}
              className="flex items-center gap-1 h-8 px-3 text-sm font-semibold text-primary hover:bg-primary/10 transition-all duration-200"
            >
              <Clock className="h-4 w-4" /> Sort by Time
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleSortByPriority()} 
              disabled={overallLoading || !dbScheduledTasks.some(item => item.is_flexible)}
              className="flex items-center gap-1 h-8 px-3 text-sm font-semibold text-logo-yellow hover:bg-logo-yellow/10 transition-all duration-200"
            >
              <Star className="h-4 w-4" /> Sort by Priority
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => handleCommand('compact')} 
              disabled={overallLoading || !dbScheduledTasks.some(item => item.is_flexible)}
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
          <WeatherWidget />
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

      <AetherSink 
        retiredTasks={retiredTasks} 
        onRezoneTask={handleRezoneFromSink} 
        onRemoveRetiredTask={handleRemoveRetiredTask}
        onAutoScheduleSink={handleAutoScheduleSink}
        isLoading={isLoadingRetiredTasks}
        isProcessingCommand={isProcessingCommand}
      />

      {currentSchedule?.summary.unscheduledCount > 0 && (
        <Card className="animate-pop-in animate-hover-lift">
          <CardContent className="p-4 text-center text-orange-500 font-semibold flex items-center justify-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            <span>⚠️ {currentSchedule.summary.unscheduledCount} task{currentSchedule.summary.unscheduledCount > 1 ? 's' : ''} fall outside your workday window.</span>
          </CardContent>
        </Card>
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
            <SchedulerDisplay 
              schedule={currentSchedule} 
              T_current={T_current} 
              onRemoveTask={removeScheduledTask} 
              onRetireTask={handleManualRetire}
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
          <React.Fragment>
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
          </React.Fragment>
          <DialogFooter>
            <Button type="button" onClick={handleInjectionSubmit}>
              Add Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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