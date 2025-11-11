import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, ListTodo, Sparkles, Loader2, AlertTriangle, Trash2, ChevronsUp, Star, ArrowDownWideNarrow, ArrowUpWideNarrow, Shuffle, CalendarOff } from 'lucide-react';
import SchedulerInput from '@/components/SchedulerInput';
import SchedulerDisplay from '@/components/SchedulerDisplay';
import { FormattedSchedule, DBScheduledTask, ScheduledItem, NewDBScheduledTask, RetiredTask, NewRetiredTask, SortBy, TaskPriority } from '@/types/scheduler';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const deepCompare = (a: any, b: any) => {
  if (a === b) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  if (a instanceof Date || b instanceof Date) return false;

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
  occupiedBlocks: TimeBlock[],
  workdayStart: Date,
  workdayEnd: Date
): TimeBlock[] => {
  const freeBlocks: TimeBlock[] = [];
  let currentFreeTimeStart = workdayStart;

  for (const appt of occupiedBlocks) {
    if (isBefore(appt.end, currentFreeTimeStart)) {
        continue;
    }

    if (isBefore(currentFreeTimeStart, appt.start)) {
      const duration = Math.floor((appt.start.getTime() - currentFreeTimeStart.getTime()) / (1000 * 60));
      if (duration > 0) {
        freeBlocks.push({ start: currentFreeTimeStart, end: appt.start, duration });
      }
    }
    currentFreeTimeStart = isAfter(appt.end, currentFreeTimeStart) ? appt.end : currentFreeTimeStart;
  }

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
    addRetiredTask,
    removeScheduledTask, 
    clearScheduledTasks,
    datesWithTasks,
    isLoadingDatesWithTasks,
    retiredTasks,
    isLoadingRetiredTasks,
    retireTask,
    rezoneTask,
    compactScheduledTasks,
    randomizeBreaks,
    sortBy,
    setSortBy,
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

  const selectedDayAsDate = useMemo(() => parseISO(selectedDay), [selectedDay]);

  const occupiedBlocks = useDeepCompareMemoize(useMemo(() => {
    if (!dbScheduledTasks) return [];
    const mappedTimes = dbScheduledTasks
      .filter(task => task.start_time && task.end_time)
      .map(task => {
        const utcStart = parseISO(task.start_time!);
        const utcEnd = parseISO(task.end_time!);

        let localStart = setHours(setMinutes(selectedDayAsDate, utcStart.getMinutes()), utcStart.getHours());
        let localEnd = setHours(setMinutes(selectedDayAsDate, utcEnd.getMinutes()), utcEnd.getHours());

        if (isBefore(localEnd, localStart)) {
          localEnd = addDays(localEnd, 1);
        }
        const block = {
          start: localStart,
          end: localEnd,
          duration: Math.floor((localEnd.getTime() - localStart.getTime()) / (1000 * 60)),
        };
        return block;
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    const merged = mergeOverlappingTimeBlocks(mappedTimes);
    return merged;
  }, [dbScheduledTasks, selectedDayAsDate]));


  const formattedSelectedDay = selectedDay;
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const interval = setInterval(() => {
      setT_current(new Date());
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const taskToSchedule = (location.state as any)?.taskToSchedule;
    if (taskToSchedule) {
      const { name, duration, isCritical } = taskToSchedule;
      const command = `inject "${name}" ${duration}${isCritical ? ' !' : ''}`;
      handleCommand(command);
      navigate(location.pathname, { replace: true, state: {} }); 
    }
  }, [location.state, navigate]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
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


  const workdayStartTime = useMemo(() => profile?.default_auto_schedule_start_time 
    ? setTimeOnDate(selectedDayAsDate, profile.default_auto_schedule_start_time) 
    : startOfDay(selectedDayAsDate), [profile?.default_auto_schedule_start_time, selectedDayAsDate]);
  
  let workdayEndTime = useMemo(() => profile?.default_auto_schedule_end_time 
    ? setTimeOnDate(selectedDayAsDate, profile.default_auto_schedule_end_time) 
    : addHours(startOfDay(selectedDayAsDate), 17), [profile?.default_auto_schedule_end_time, selectedDayAsDate]);

  workdayEndTime = useMemo(() => {
    if (isBefore(workdayEndTime, workdayStartTime)) {
      return addDays(workdayEndTime, 1);
    }
    return workdayEndTime;
  }, [workdayEndTime, workdayStartTime]);

  const effectiveWorkdayStart = useMemo(() => {
    if (isSameDay(selectedDayAsDate, T_current) && isBefore(workdayStartTime, T_current)) {
      return T_current;
    }
    return workdayStartTime;
  }, [selectedDayAsDate, T_current, workdayStartTime]);

  const previousCalculatedScheduleRef = useRef<FormattedSchedule | null>(null);

  const calculatedSchedule = useMemo(() => {
    if (!profile) return null;
    const newSchedule = calculateSchedule(dbScheduledTasks, selectedDay, workdayStartTime, workdayEndTime);
    
    if (deepCompare(newSchedule, previousCalculatedScheduleRef.current)) {
      return previousCalculatedScheduleRef.current;
    }
    previousCalculatedScheduleRef.current = newSchedule;
    return newSchedule;
  }, [dbScheduledTasks, selectedDay, workdayStartTime, workdayEndTime, profile]);

  const [currentSchedule, setCurrentSchedule] = useState<FormattedSchedule | null>(null);
  useEffect(() => {
    setCurrentSchedule(calculatedSchedule);
  }, [calculatedSchedule]);

  useEffect(() => {
    if (!user || !dbScheduledTasks || isSchedulerTasksLoading || !profile) {
      return;
    }

    const currentDay = parseISO(selectedDay);
    const now = new Date();
    const isViewingToday = isSameDay(currentDay, now);

    if (isViewingToday && !hasMorningFixRunToday) {
      const tasksToRetire = dbScheduledTasks.filter(task => {
        if (!task.start_time || !task.end_time) return false;

        const taskEndTime = setTimeOnDate(currentDay, format(parseISO(task.end_time), 'HH:mm'));
        
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
      setHasMorningFixRunToday(false);
    }
  }, [user, dbScheduledTasks, isSchedulerTasksLoading, selectedDay, profile, hasMorningFixRunToday, retireTask]);

  const findFreeSlotForTask = useCallback(async (
    taskName: string,
    taskDuration: number,
    isCritical: boolean,
    isFlexible: boolean,
    existingOccupiedBlocks: TimeBlock[],
    effectiveWorkdayStart: Date,
    workdayEndTime: Date
  ): Promise<{ proposedStartTime: Date | null, proposedEndTime: Date | null, message: string }> => {
    let proposedStartTime: Date | null = null;
    const freeBlocks = getFreeTimeBlocks(existingOccupiedBlocks, effectiveWorkdayStart, workdayEndTime);

    if (isCritical) {
      for (const block of freeBlocks) {
        if (taskDuration <= block.duration) {
          proposedStartTime = block.start;
          break;
        }
      }
    } else {
      for (const block of freeBlocks) {
        if (taskDuration <= block.duration) {
          proposedStartTime = block.start;
          break; 
        }
      }
    }

    if (proposedStartTime) {
      const proposedEndTime = addMinutes(proposedStartTime, taskDuration);
      return { proposedStartTime, proposedEndTime, message: "" };
    } else {
      const message = `No available slot found within your workday (${formatTime(workdayStartTime)} - ${formatTime(workdayEndTime)}) for "${taskName}" (${taskDuration} min).`;
      return { proposedStartTime: null, proposedEndTime: null, message: message };
    }
  }, [workdayStartTime, workdayEndTime]);


  const handleClearSchedule = async () => {
    if (!user) {
      showError("You must be logged in to clear your schedule.");
      return;
    }
    setIsProcessingCommand(true);
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
    
    const parsedInput = parseTaskInput(input, selectedDayAsDate);
    const injectCommand = parseInjectionCommand(input);
    const command = parseCommand(input);

    let success = false;
    const taskScheduledDate = formattedSelectedDay;

    let currentOccupiedBlocksForScheduling = [...occupiedBlocks];


    if (parsedInput) {
      if (parsedInput.shouldSink) {
        const newRetiredTask: NewRetiredTask = {
          user_id: user.id,
          name: parsedInput.name,
          duration: parsedInput.duration || null,
          break_duration: parsedInput.breakDuration || null,
          original_scheduled_date: taskScheduledDate,
          is_critical: parsedInput.isCritical,
        };
        await addRetiredTask(newRetiredTask);
        success = true;
      } else {
        const isAdHocTask = 'duration' in parsedInput;

        if (isAdHocTask) {
          const newTaskDuration = parsedInput.duration!;
          const { proposedStartTime, proposedEndTime, message } = await findFreeSlotForTask(
            parsedInput.name,
            newTaskDuration,
            parsedInput.isCritical,
            parsedInput.isFlexible,
            currentOccupiedBlocksForScheduling,
            effectiveWorkdayStart,
            workdayEndTime
          );
          
          if (proposedStartTime && proposedEndTime) {
            await addScheduledTask({ 
              name: parsedInput.name, 
              start_time: proposedStartTime.toISOString(), 
              end_time: proposedEndTime.toISOString(), 
              break_duration: parsedInput.breakDuration,
              scheduled_date: taskScheduledDate, // Added missing scheduled_date
              is_critical: parsedInput.isCritical,
              is_flexible: parsedInput.isFlexible,
            });
            currentOccupiedBlocksForScheduling.push({ start: proposedStartTime, end: proposedEndTime, duration: newTaskDuration });
            currentOccupiedBlocksForScheduling = mergeOverlappingTimeBlocks(currentOccupiedBlocksForScheduling);
            
            showSuccess(`Scheduled "${parsedInput.name}" from ${formatTime(proposedStartTime)} to ${formatTime(proposedEndTime)}.`);
            success = true;
          } else {
            showError(message);
          }

        } else {
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

          if (!isSlotFree(startTime, endTime, currentOccupiedBlocksForScheduling)) {
            showError(`The time slot from ${formatTime(startTime)} to ${formatTime(endTime)} is already occupied.`);
            setIsProcessingCommand(false);
            return;
          }

          const duration = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
          await addScheduledTask({ name: parsedInput.name, start_time: startTime.toISOString(), end_time: endTime.toISOString(), scheduled_date: taskScheduledDate, is_critical: parsedInput.isCritical, is_flexible: parsedInput.isFlexible });
          currentOccupiedBlocksForScheduling.push({ start: startTime, end: endTime, duration: duration });
          currentOccupiedBlocksForScheduling = mergeOverlappingTimeBlocks(currentOccupiedBlocksForScheduling);

          showSuccess(`Scheduled "${parsedInput.name}" from ${formatTime(startTime)} to ${formatTime(endTime)}.`);
          success = true;
        }
      }
    } else if (injectCommand) {
      const isAdHocInjection = !injectCommand.startTime && !injectCommand.endTime;

      if (isAdHocInjection) {
        const injectedTaskDuration = injectCommand.duration || 30;
        const { proposedStartTime, proposedEndTime, message } = await findFreeSlotForTask(
          injectCommand.taskName,
          injectedTaskDuration,
          injectCommand.isCritical,
          injectCommand.isFlexible,
          currentOccupiedBlocksForScheduling,
          effectiveWorkdayStart,
          workdayEndTime
        );

        if (proposedStartTime && proposedEndTime) {
          await addScheduledTask({ 
            name: injectCommand.taskName, 
            start_time: proposedStartTime.toISOString(), 
            end_time: proposedEndTime.toISOString(), 
            break_duration: injectCommand.breakDuration, 
            scheduled_date: taskScheduledDate, // This one has it
            is_critical: injectCommand.isCritical,
            is_flexible: injectCommand.isFlexible,
          });
          currentOccupiedBlocksForScheduling.push({ start: proposedStartTime, end: proposedEndTime, duration: injectedTaskDuration });
          currentOccupiedBlocksForScheduling = mergeOverlappingTimeBlocks(currentOccupiedBlocksForScheduling);

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
          isCritical: injectCommand.isCritical,
          isFlexible: injectCommand.isFlexible,
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
          isCritical: injectCommand.isCritical,
          isFlexible: injectCommand.isFlexible,
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
              currentOccupiedBlocksForScheduling = currentOccupiedBlocksForScheduling.filter(block => 
                !(block.start.getTime() === parseISO(taskToRemove.start_time!).getTime() && 
                  block.end.getTime() === parseISO(taskToRemove.end_time!).getTime())
              );
              success = true;
            } else {
              showError(`Invalid index. Please provide a number between 1 and ${dbScheduledTasks.length}.`);
            }
          } else if (command.target) {
            const tasksToRemove = dbScheduledTasks.filter(task => task.name.toLowerCase().includes(command.target!.toLowerCase()));
            if (tasksToRemove.length > 0) {
              for (const task of tasksToRemove) {
                await removeScheduledTask(task.id);
                currentOccupiedBlocksForScheduling = currentOccupiedBlocksForScheduling.filter(block => 
                  !(block.start.getTime() === parseISO(task.start_time!).getTime() && 
                    block.end.getTime() === parseISO(task.end_time!).getTime())
                );
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
        case 'compact':
          const compactedTasks = compactScheduleLogic(
            dbScheduledTasks,
            selectedDayAsDate,
            workdayStartTime,
            workdayEndTime,
            T_current
          );
          if (compactedTasks.length > 0) {
            await compactScheduledTasks(compactedTasks);
            currentOccupiedBlocksForScheduling = mergeOverlappingTimeBlocks(compactedTasks.map(task => ({
              start: parseISO(task.start_time!),
              end: parseISO(task.end_time!),
              duration: Math.floor((parseISO(task.end_time!).getTime() - parseISO(task.start_time!).getTime()) / (1000 * 60))
            })));
            showSuccess("Schedule compacted!");
          } else {
            showError("No flexible tasks to compact or no space available.");
          }
          success = true;
          break;
        case 'timeoff':
          setInjectionPrompt({ 
            taskName: 'Time Off', 
            isOpen: true, 
            isTimed: true,
            startTime: format(T_current, 'h:mm a'),
            endTime: format(addHours(T_current, 1), 'h:mm a'),
            isCritical: false,
            isFlexible: false, // Enforce Time Off as fixed
          });
          setInjectionStartTime(format(T_current, 'h:mm a'));
          setInjectionEndTime(format(addHours(T_current, 1), 'h:mm a'));
          success = true;
          break;
        default:
          showError("Unknown command.");
      }
    } else {
      showError("Invalid input. Please use 'Task Name Duration [Break]', 'Task Name HH:MM AM/PM - HH:MM AM/PM', 'Time Off HH:MM AM/PM - HH:MM AM/PM', or a command.");
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
    setIsProcessingCommand(true);

    let success = false;
    const taskScheduledDate = formattedSelectedDay;
    const selectedDayAsDate = parseISO(selectedDay);

    let currentOccupiedBlocksForScheduling = [...occupiedBlocks];


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

      if (!isSlotFree(startTime, endTime, currentOccupiedBlocksForScheduling)) {
        showError(`The time slot from ${formatTime(startTime)} to ${formatTime(endTime)} is already occupied.`);
        setIsProcessingCommand(false);
        return;
      }

      const duration = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
      await addScheduledTask({ name: injectionPrompt.taskName, start_time: startTime.toISOString(), end_time: endTime.toISOString(), scheduled_date: taskScheduledDate, is_critical: injectionPrompt.isCritical, is_flexible: injectionPrompt.isFlexible });
      currentOccupiedBlocksForScheduling.push({ start: startTime, end: endTime, duration: duration });
      currentOccupiedBlocksForScheduling = mergeOverlappingTimeBlocks(currentOccupiedBlocksForScheduling);

      showSuccess(`Injected "${injectionPrompt.taskName}" from ${formatTime(startTime)} to ${formatTime(endTime)}.`);
      success = true;
    } else {
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
        injectionPrompt.isFlexible,
        currentOccupiedBlocksForScheduling,
        effectiveWorkdayStart,
        workdayEndTime
      );

      if (proposedStartTime && proposedEndTime) {
        await addScheduledTask({ 
          name: injectionPrompt.taskName, 
          start_time: proposedStartTime.toISOString(), 
          end_time: proposedEndTime.toISOString(), 
          break_duration: breakDuration, 
          scheduled_date: taskScheduledDate, // Added missing scheduled_date
          is_critical: injectionPrompt.isCritical,
          is_flexible: injectionPrompt.isFlexible,
        });
        currentOccupiedBlocksForScheduling.push({ start: proposedStartTime, end: proposedEndTime, duration: injectedTaskDuration });
        currentOccupiedBlocksForScheduling = mergeOverlappingTimeBlocks(currentOccupiedBlocksForScheduling);

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

  const handleRezoneFromSink = async (retiredTask: RetiredTask) => {
    if (!user || !profile) {
      showError("Please log in and ensure your profile is loaded to rezone tasks.");
      return;
    }
    setIsProcessingCommand(true);

    try {
      const taskDuration = retiredTask.duration || 30;
      const selectedDayAsDate = parseISO(selectedDay);

      let currentOccupiedBlocksForScheduling = [...occupiedBlocks];


      const { proposedStartTime, proposedEndTime, message } = await findFreeSlotForTask(
        retiredTask.name,
        taskDuration,
        retiredTask.is_critical,
        true,
        currentOccupiedBlocksForScheduling,
        effectiveWorkdayStart,
        workdayEndTime
      );

      if (proposedStartTime && proposedEndTime) {
        await rezoneTask(retiredTask.id);

        await addScheduledTask({
          name: retiredTask.name,
          start_time: proposedStartTime.toISOString(),
          end_time: proposedEndTime.toISOString(),
          break_duration: retiredTask.break_duration,
          scheduled_date: formattedSelectedDay, // This one has it
          is_critical: retiredTask.is_critical,
          is_flexible: true,
        });
        currentOccupiedBlocksForScheduling.push({ start: proposedStartTime, end: proposedEndTime, duration: taskDuration });
        currentOccupiedBlocksForScheduling = mergeOverlappingTimeBlocks(currentOccupiedBlocksForScheduling);

        showSuccess(`Re-zoned "${retiredTask.name}" from ${formatTime(proposedStartTime)} to ${formatTime(proposedEndTime)}.`);
      } else {
        showError(message);
      }
    } catch (error: any) {
      showError(`Failed to rezone task: ${error.message}`);
      console.error("Rezone error:", error);
    } finally {
      setIsProcessingCommand(false);
    }
  };

  const handleManualRetire = async (taskToRetire: DBScheduledTask) => {
    if (!user) {
      showError("You must be logged in to retire tasks.");
      return;
    }
    setIsProcessingCommand(true);
    await retireTask(taskToRetire);
    setIsProcessingCommand(false);
  };

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
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', user.id] });
    } catch (error: any) {
      showError(`Failed to remove retired task: ${error.message}`);
      console.error("Remove retired task error:", error);
    } finally {
      setIsProcessingCommand(false);
    }
  };

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

    let currentOccupiedBlocksForScheduling = [...occupiedBlocks];


    const sortedRetiredTasks = [...retiredTasks].sort((a, b) => {
      if (a.is_critical && !b.is_critical) return -1;
      if (!a.is_critical && b.is_critical) return 1;
      return 0;
    });

    for (const task of sortedRetiredTasks) {
      try {
        const taskDuration = task.duration || 30;
        const selectedDayAsDate = parseISO(selectedDay);

        const { proposedStartTime, proposedEndTime, message } = await findFreeSlotForTask(
          task.name,
          taskDuration,
          task.is_critical,
          true,
          currentOccupiedBlocksForScheduling,
          effectiveWorkdayStart,
          workdayEndTime
        );

        if (proposedStartTime && proposedEndTime) {
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

          successfulRezones++;
        } else {
          showError(message);
          failedRezones++;
        }
      } catch (error) {
        console.error(`Failed to auto-schedule task "${task.name}":`, error);
        failedRezones++;
      }
    }

    if (successfulRezones > 0) {
      showSuccess(`Successfully re-zoned ${successfulRezones} task{s} from Aether Sink.`);
    }
    if (failedRezones > 0) {
      showError(`Failed to re-zone ${failedRezones} task{s} from Aether Sink due to no available slots.`);
    }
    setIsProcessingCommand(false);
  };

  const handleSortFlexibleTasks = async (newSortBy: SortBy) => {
    if (!user || !profile || !dbScheduledTasks) return;
    setIsProcessingCommand(true);

    const flexibleTasks = dbScheduledTasks.filter(task => task.is_flexible);
    if (flexibleTasks.length === 0) {
      showSuccess("No flexible tasks to sort.");
      setIsProcessingCommand(false);
      return;
    }

    let sortedFlexibleTasks = [...flexibleTasks];

    if (newSortBy === 'TIME_EARLIEST_TO_LATEST') {
      sortedFlexibleTasks.sort((a, b) => {
        const durationA = Math.floor((parseISO(a.end_time!).getTime() - parseISO(a.start_time!).getTime()) / (1000 * 60));
        const durationB = Math.floor((parseISO(b.end_time!).getTime() - parseISO(b.start_time!).getTime()) / (1000 * 60));
        return durationA - durationB;
      });
    } else if (newSortBy === 'TIME_LATEST_TO_EARLIEST') {
      sortedFlexibleTasks.sort((a, b) => {
        const durationA = Math.floor((parseISO(a.end_time!).getTime() - parseISO(a.start_time!).getTime()) / (1000 * 60));
        const durationB = Math.floor((parseISO(b.end_time!).getTime() - parseISO(b.start_time!).getTime()) / (1000 * 60));
        return durationB - durationA;
      });
    } else if (newSortBy === 'PRIORITY_HIGH_TO_LOW') {
      const priorityOrder: Record<TaskPriority, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      sortedFlexibleTasks.sort((a, b) => {
        const priorityDiff = priorityOrder[a.is_critical ? 'HIGH' : 'MEDIUM'] - priorityOrder[b.is_critical ? 'HIGH' : 'MEDIUM'];
        if (priorityDiff !== 0) return -priorityDiff;
        const durationA = Math.floor((parseISO(a.end_time!).getTime() - parseISO(a.start_time!).getTime()) / (1000 * 60));
        const durationB = Math.floor((parseISO(b.end_time!).getTime() - parseISO(b.start_time!).getTime()) / (1000 * 60));
        return durationA - durationB;
      });
    } else if (newSortBy === 'PRIORITY_LOW_TO_HIGH') {
      const priorityOrder: Record<TaskPriority, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      sortedFlexibleTasks.sort((a, b) => {
        const priorityDiff = priorityOrder[a.is_critical ? 'HIGH' : 'MEDIUM'] - priorityOrder[b.is_critical ? 'HIGH' : 'MEDIUM'];
        if (priorityDiff !== 0) return priorityDiff;
        const durationA = Math.floor((parseISO(a.end_time!).getTime() - parseISO(a.start_time!).getTime()) / (1000 * 60));
        const durationB = Math.floor((parseISO(b.end_time!).getTime() - parseISO(b.start_time!).getTime()) / (1000 * 60));
        return durationA - durationB;
      });
    }

    const reorganizedTasks = compactScheduleLogic(
      dbScheduledTasks,
      selectedDayAsDate,
      workdayStartTime,
      workdayEndTime,
      T_current,
      sortedFlexibleTasks
    );

    if (reorganizedTasks.length > 0) {
      await compactScheduledTasks(reorganizedTasks);
      showSuccess("Flexible tasks sorted!");
      setSortBy(newSortBy);
    } else {
      showError("Could not sort flexible tasks or no space available.");
    }
    setIsProcessingCommand(false);
  };

  const handleRandomizeBreaks = async () => {
    if (!user || !profile || !dbScheduledTasks) return;
    setIsProcessingCommand(true);

    const breaksToRandomize = dbScheduledTasks.filter(task => task.name.toLowerCase() === 'break');
    if (breaksToRandomize.length === 0) {
      showSuccess("No break tasks to randomize.");
      setIsProcessingCommand(false);
      return;
    }

    await randomizeBreaks({
      selectedDate: formattedSelectedDay,
      workdayStartTime: effectiveWorkdayStart,
      workdayEndTime: workdayEndTime,
      currentDbTasks: dbScheduledTasks,
    });

    setIsProcessingCommand(false);
  };

  const handleAddTaskClick = () => {
    setInjectionPrompt({ 
      taskName: '',
      isOpen: true, 
      isTimed: false,
      startTime: undefined,
      endTime: undefined,
      isCritical: false,
      isFlexible: true,
    });
    setInjectionDuration('');
    setInjectionBreak('');
    setInjectionStartTime('');
    setInjectionEndTime('');
    setInputValue('');
  };

  const handleAddTimeOffClick = () => {
    setInjectionPrompt({ 
      taskName: 'Time Off', 
      isOpen: true, 
      isTimed: true,
      startTime: format(T_current, 'h:mm a'),
      endTime: format(addHours(T_current, 1), 'h:mm a'),
      isCritical: false,
      isFlexible: false, // Enforce Time Off as fixed
    });
    setInjectionStartTime(format(T_current, 'h:mm a'));
    setInjectionEndTime(format(addHours(T_current, 1), 'h:mm a'));
    setInjectionDuration('');
    setInjectionBreak('');
    setInputValue('');
  };


  const activeItem: ScheduledItem | null = useMemo(() => {
    if (!currentSchedule || !isSameDay(parseISO(selectedDay), T_current)) return null;
    for (const item of currentSchedule.items) {
      if ((item.type === 'task' || item.type === 'break' || item.type === 'time-off') && T_current >= item.startTime && T_current < item.endTime) {
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
        if (item.type === 'task' || item.type === 'break' || item.type === 'time-off') {
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={overallLoading || !dbScheduledTasks.some(item => item.is_flexible)}
                  className="flex items-center gap-1 h-8 px-3 text-sm font-semibold text-primary hover:bg-primary/10 transition-all duration-200"
                >
                  {isProcessingCommand ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownWideNarrow className="h-4 w-4" />}
                  <span>Sort Flexible Tasks</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleSortFlexibleTasks('PRIORITY_HIGH_TO_LOW')}>
                  <Star className="mr-2 h-4 w-4 text-logo-yellow" /> Priority (High to Low)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSortFlexibleTasks('PRIORITY_LOW_TO_HIGH')}>
                  <Star className="mr-2 h-4 w-4 text-logo-yellow" /> Priority (Low to High)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleSortFlexibleTasks('TIME_EARLIEST_TO_LATEST')}>
                  <Clock className="mr-2 h-4 w-4" /> Time (Earliest to Latest)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSortFlexibleTasks('TIME_LATEST_TO_EARLIEST')}>
                  <Clock className="mr-2 h-4 w-4" /> Time (Latest to Earliest)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={handleRandomizeBreaks}
                  disabled={overallLoading || !dbScheduledTasks.some(task => task.name.toLowerCase() === 'break')}
                  className="h-8 w-8 text-primary hover:bg-primary/10 transition-all duration-200"
                >
                  {isProcessingCommand ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shuffle className="h-4 w-4" />}
                  <span className="sr-only">Randomize Breaks</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Randomly re-allocate breaks</p>
              </TooltipContent>
            </Tooltip>

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

            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={handleAddTimeOffClick} 
                  disabled={overallLoading}
                  className="h-8 w-8 text-logo-green hover:bg-logo-green/10 transition-all duration-200"
                >
                  <CalendarOff className="h-4 w-4" />
                  <span className="sr-only">Add Time Off</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Block out a period as "Time Off"</p>
              </TooltipContent>
            </Tooltip>

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
            placeholder={`Add task or command (e.g., 'Gym 60', 'Meeting 11am-12pm', 'Time Off 2pm-3pm', 'inject "Project X" 30', 'remove "Gym"', 'clear', 'compact')`}
          />
          <p className="text-xs text-muted-foreground">
            Examples: "Gym 60", "Meeting 11am-12pm", 'inject "Project X" 30', 'remove "Gym"', 'clear', 'compact', "Clean the sink 30 sink", "Time Off 2pm-3pm"
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
              onAddTaskClick={handleAddTaskClick}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={injectionPrompt?.isOpen || false} onOpenChange={(open) => !open && setInjectionPrompt(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>✨ Injection received: "{injectionPrompt?.taskName || 'New Task'}"</DialogTitle>
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