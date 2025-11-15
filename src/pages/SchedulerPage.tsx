import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, ListTodo, Sparkles, Loader2, AlertTriangle, Trash2, ChevronsUp, Star, ArrowDownWideNarrow, ArrowUpWideNarrow, Shuffle, CalendarOff, RefreshCcw, Globe, Zap, Settings2, Brain } from 'lucide-react'; // Added Brain icon for Vibe Flow
import SchedulerInput from '@/components/SchedulerInput';
import SchedulerDisplay from '@/components/SchedulerDisplay';
import { FormattedSchedule, DBScheduledTask, ScheduledItem, NewDBScheduledTask, RetiredTask, NewRetiredTask, SortBy, TaskPriority, AutoBalancePayload, UnifiedTask } from '@/types/scheduler';
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
  getFreeTimeBlocks, // Ensure getFreeTimeBlocks is imported
  calculateEnergyCost, // NEW: Import calculateEnergyCost
  sortTasksByVibeFlow, // NEW: Import sortTasksByVibeFlow
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SchedulerUtilityBar from '@/components/SchedulerUtilityBar'; // NEW: Import SchedulerUtilityBar
import WorkdayWindowDialog from '@/components/WorkdayWindowDialog'; // Corrected: Removed 'ui/' from the path

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

  return useMemo(() => ref.current, [signalRef.current],);
}

const DURATION_BUCKETS = [5, 10, 15, 20, 25, 30, 45, 60, 75, 90];
const LONG_TASK_THRESHOLD = 90;

const INTERLEAVING_PATTERN = [
  // Duration (min), Criticality (C/NC)
  { duration: 15, critical: true }, { duration: 15, critical: false },
  { duration: 60, critical: true }, { duration: 60, critical: false },
  { duration: 5, critical: true }, { duration: 5, critical: false },
  { duration: 45, critical: true }, { duration: 45, critical: false },
  { duration: 10, critical: true }, { duration: 10, critical: false },
  { duration: 90, critical: true }, { duration: 90, critical: false },
  { duration: 20, critical: true }, { duration: 20, critical: false },
  { duration: 30, critical: true }, { duration: 30, critical: false },
  { duration: 75, critical: true }, { duration: 75, critical: false },
  { duration: 25, critical: true }, { duration: 25, critical: false },
  { duration: LONG_TASK_THRESHOLD + 1, critical: true }, // Represents 90+
  { duration: LONG_TASK_THRESHOLD + 1, critical: false }, // Represents 90+
];


const SchedulerPage: React.FC = () => {
  const { user, profile, isLoading: isSessionLoading, rechargeEnergy } = useSession(); // NEW: Added rechargeEnergy
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
    toggleScheduledTaskLock,
    aetherDump,
    aetherDumpMega,
    sortBy,
    setSortBy,
    autoBalanceSchedule, // Now client-side
    completeScheduledTask,
  } = useSchedulerTasks(selectedDay);

  const queryClient = useQueryClient();

  const [T_current, setT_current] = useState(new Date());
  
  const [isProcessingCommand, setIsProcessingCommand] = useState(false);
  const [injectionPrompt, setInjectionPrompt] = useState<{ taskName: string; isOpen: boolean; isTimed?: boolean; duration?: number; startTime?: string; endTime?: string; isCritical?: boolean; isFlexible?: boolean; energyCost?: number } | null>(null);
  const [injectionDuration, setInjectionDuration] = useState('');
  const [injectionBreak, setInjectionBreak] = useState('');
  const [injectionStartTime, setInjectionStartTime] = useState('');
  const [injectionEndTime, setInjectionEndTime] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [hasMorningFixRunToday, setHasMorningFixRunToday] = useState(false);
  // Removed isSinkOpen state
  const [activeTab, setActiveTab] = useState('vibe-schedule');
  const [showWorkdayWindowDialog, setShowWorkdayWindowDialog] = useState(false); // NEW: State for WorkdayWindowDialog
  const [isVibeFlowEnabled, setIsVibeFlowEnabled] = useState(true); // NEW: State for Vibe Flow toggle

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
      
      setInjectionPrompt({
        taskName: name,
        isOpen: true,
        isTimed: false,
        duration: duration, 
        isCritical: isCritical,
        isFlexible: true,
        energyCost: calculateEnergyCost(duration, isCritical),
      });
      setInjectionDuration(String(duration));
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
        // CRITICAL BUG FIX: Only retire if UNLOCKED AND FLEXIBLE
        if (task.is_locked) return false; 
        if (!task.is_flexible) return false; 

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
    energyCost: number,
    existingOccupiedBlocks: TimeBlock[],
    effectiveWorkdayStart: Date,
    workdayEndTime: Date
  ): Promise<{ proposedStartTime: Date | null, proposedEndTime: Date | null, message: string }> => {
    let proposedStartTime: Date | null = null;
    
    // Filter out locked tasks from available slots
    const lockedTaskBlocks = dbScheduledTasks
      .filter(task => task.is_locked && task.start_time && task.end_time)
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
      });

    const allOccupiedBlocks = mergeOverlappingTimeBlocks([...existingOccupiedBlocks, ...lockedTaskBlocks]);
    const freeBlocks = getFreeTimeBlocks(allOccupiedBlocks, effectiveWorkdayStart, workdayEndTime);

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
  }, [workdayStartTime, workdayEndTime, dbScheduledTasks, selectedDayAsDate, effectiveWorkdayStart]);


  const handleClearSchedule = async () => {
    if (!user) {
      showError("You must be logged in to clear your schedule.");
      return;
    }
    setIsProcessingCommand(true);
    
    // Only clear unlocked tasks
    const unlockedTasks = dbScheduledTasks.filter(task => !task.is_locked);
    if (unlockedTasks.length === 0) {
      showSuccess("No unlocked tasks to clear.");
      setIsProcessingCommand(false);
      setShowClearConfirmation(false);
      setInputValue('');
      return;
    }

    const { error } = await supabase.from('scheduled_tasks')
      .delete()
      .in('id', unlockedTasks.map(task => task.id))
      .eq('user_id', user.id)
      .eq('scheduled_date', formattedSelectedDay);

    if (error) {
      showError(`Failed to clear schedule: ${error.message}`);
      console.error("Clear schedule error:", error);
    } else {
      showSuccess('Unlocked tasks cleared for today!');
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', user.id, formattedSelectedDay, sortBy] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', user.id] });
    }

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
          energy_cost: parsedInput.energyCost,
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
            parsedInput.energyCost,
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
              is_critical: parsedInput.isCritical,
              is_flexible: parsedInput.isFlexible,
              scheduled_date: taskScheduledDate,
              energy_cost: parsedInput.energyCost,
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
          await addScheduledTask({ 
            name: parsedInput.name, 
            start_time: startTime.toISOString(), 
            end_time: endTime.toISOString(), 
            scheduled_date: taskScheduledDate, 
            is_critical: parsedInput.isCritical, 
            is_flexible: parsedInput.isFlexible, 
            energy_cost: parsedInput.energyCost
          }); 
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
          injectCommand.energyCost,
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
            scheduled_date: taskScheduledDate,
            is_critical: injectCommand.isCritical,
            is_flexible: injectCommand.isFlexible,
            energy_cost: injectCommand.energyCost,
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
          energyCost: injectCommand.energyCost,
        });
        setInjectionStartTime(injectCommand.startTime);
        setInjectionEndTime(injectCommand.endTime);
        success = true;
      } else {
        setInjectionPrompt({ 
          taskName: injectCommand.taskName, 
          isOpen: true, 
          isTimed: false,
          duration: injectCommand.duration,
          startTime: undefined,
          endTime: undefined,
          isCritical: injectCommand.isCritical,
          isFlexible: injectCommand.isFlexible,
          energyCost: injectCommand.energyCost,
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
              if (taskToRemove.is_locked) {
                showError(`Cannot remove locked task "${taskToRemove.name}". Unlock it first.`);
                setIsProcessingCommand(false);
                return;
              }
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
              const lockedTasksFound = tasksToRemove.filter(task => task.is_locked);
              if (lockedTasksFound.length > 0) {
                showError(`Cannot remove locked task(s) matching "${command.target}". Unlock them first.`);
                setIsProcessingCommand(false);
                return;
              }
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
        // Removed 'compact' case from here, it will be handled by the new button in UtilityBar
        case 'timeoff':
          setInjectionPrompt({ 
            taskName: 'Time Off', 
            isOpen: true, 
            isTimed: true,
            startTime: format(T_current, 'h:mm a'),
            endTime: format(addHours(T_current, 1), 'h:mm a'),
            isCritical: false,
            isFlexible: false,
            energyCost: 0,
          });
          setInjectionStartTime(format(T_current, 'h:mm a'));
          setInjectionEndTime(format(addHours(T_current, 1), 'h:mm a'));
          setInjectionDuration('');
          setInjectionBreak('');
          success = true;
          break;
        case 'aether dump':
        case 'reset schedule': // 'reset schedule' now maps to 'aether dump'
          await aetherDump();
          success = true;
          break;
        case 'aether dump mega':
          await aetherDumpMega();
          success = true;
          break;
        default:
          showError("Unknown command.");
      }
    } else {
      showError("Invalid input. Please use 'Task Name Duration', 'Task Name HH:MM AM/PM - HH:MM AM/PM', 'Time Off HH:MM AM/PM - HH:MM AM/PM', or a command.");
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
    
    let calculatedEnergyCost = 0;

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
      calculatedEnergyCost = calculateEnergyCost(duration, injectionPrompt.isCritical ?? false);

      await addScheduledTask({ 
        name: injectionPrompt.taskName, 
        start_time: startTime.toISOString(), 
        end_time: endTime.toISOString(), 
        scheduled_date: taskScheduledDate, 
        is_critical: injectionPrompt.isCritical, 
        is_flexible: injectionPrompt.isFlexible, 
        energy_cost: calculatedEnergyCost
      }); 
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
      
      calculatedEnergyCost = calculateEnergyCost(injectedTaskDuration, injectionPrompt.isCritical ?? false);

      const { proposedStartTime, proposedEndTime, message } = await findFreeSlotForTask(
        injectionPrompt.taskName,
        injectedTaskDuration,
        injectionPrompt.isCritical,
        injectionPrompt.isFlexible,
        calculatedEnergyCost,
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
          scheduled_date: taskScheduledDate,
          is_critical: injectionPrompt.isCritical,
          is_flexible: injectionPrompt.isFlexible,
          energy_cost: calculatedEnergyCost,
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
    if (!user) {
      showError("You must be logged in to rezone tasks.");
      return;
    }
    if (retiredTask.is_locked) {
      showError(`Cannot re-zone locked task "${retiredTask.name}". Unlock it first.`);
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
        retiredTask.energy_cost,
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
          scheduled_date: formattedSelectedDay,
          is_critical: retiredTask.is_critical,
          is_flexible: true,
          energy_cost: retiredTask.energy_cost,
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
    if (taskToRetire.is_locked) {
      showError(`Cannot retire locked task "${taskToRetire.name}". Unlock it first.`);
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
    const task = retiredTasks.find(t => t.id === retiredTaskId);
    if (task?.is_locked) {
      showError(`Cannot delete locked retired task "${task.name}". Unlock it first.`);
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
    setIsProcessingCommand(true);

    try {
        // --- 1. Unification and Normalization ---
        const flexibleScheduledTasks = dbScheduledTasks.filter(task => task.is_flexible && !task.is_locked);
        const unlockedRetiredTasks = retiredTasks.filter(task => !task.is_locked);

        if (flexibleScheduledTasks.length === 0 && unlockedRetiredTasks.length === 0) {
            showSuccess("No unlocked flexible tasks in schedule or Aether Sink to balance.");
            setIsProcessingCommand(false);
            return;
        }

        const unifiedPool: UnifiedTask[] = [];
        const scheduledTaskIdsToDelete: string[] = [];
        const retiredTaskIdsToDelete: string[] = [];

        // Add flexible scheduled tasks
        flexibleScheduledTasks.forEach(task => {
            const duration = Math.floor((parseISO(task.end_time!).getTime() - parseISO(task.start_time!).getTime()) / (1000 * 60));
            unifiedPool.push({
                id: task.id,
                name: task.name,
                duration: duration,
                break_duration: task.break_duration,
                is_critical: task.is_critical,
                is_flexible: true,
                energy_cost: task.energy_cost,
                source: 'scheduled',
                originalId: task.id,
            });
            scheduledTaskIdsToDelete.push(task.id);
        });

        // Add unlocked retired tasks
        unlockedRetiredTasks.forEach(task => {
            unifiedPool.push({
                id: task.id,
                name: task.name,
                duration: task.duration || 30,
                break_duration: task.break_duration,
                is_critical: task.is_critical,
                is_flexible: true,
                energy_cost: task.energy_cost,
                source: 'retired',
                originalId: task.id,
            });
            retiredTaskIdsToDelete.push(task.id);
        });

        // --- 2. Categorization and Interleaving (Vibe Flow) ---
        let balancedQueue: UnifiedTask[] = [];
        if (isVibeFlowEnabled) {
          balancedQueue = sortTasksByVibeFlow(unifiedPool);
        } else {
          // Default sorting if Vibe Flow is not enabled (e.g., by creation time or existing order)
          balancedQueue = [...unifiedPool].sort((a, b) => a.name.localeCompare(b.name)); // Example default sort
        }
        
        // --- 3. Re-Timing and Placement ---
        const tasksToInsert: NewDBScheduledTask[] = [];
        const tasksToKeepInSink: NewRetiredTask[] = [];
        
        const fixedTasks = dbScheduledTasks.filter(task => task.is_locked || !task.is_flexible);
        
        fixedTasks.forEach(task => {
            tasksToInsert.push({
                name: task.name,
                start_time: task.start_time,
                end_time: task.end_time,
                break_duration: task.break_duration,
                scheduled_date: task.scheduled_date,
                is_critical: task.is_critical,
                is_flexible: task.is_flexible,
                is_locked: task.is_locked,
                energy_cost: task.energy_cost,
            });
        });

        const fixedOccupiedBlocks = mergeOverlappingTimeBlocks(fixedTasks
            .filter(task => task.start_time && task.end_time)
            .map(task => {
                const start = setTimeOnDate(selectedDayAsDate, format(parseISO(task.start_time!), 'HH:mm'));
                let end = setTimeOnDate(selectedDayAsDate, format(parseISO(task.end_time!), 'HH:mm'));
                if (isBefore(end, start)) end = addDays(end, 1);
                return { start, end, duration: Math.floor((end.getTime() - start.getTime()) / (1000 * 60)) };
            })
        );

        let currentOccupiedBlocks = [...fixedOccupiedBlocks];
        let currentPlacementTime = effectiveWorkdayStart;

        for (const task of balancedQueue) {
            let placed = false;
            let searchTime = currentPlacementTime;

            // ADVANCED LOGIC: Critical Task Protection (Focus Mode) - Placement Constraint
            if (task.is_critical && profile.energy < 80) {
              tasksToKeepInSink.push({
                user_id: user.id,
                name: task.name,
                duration: task.duration,
                break_duration: task.break_duration,
                original_scheduled_date: task.source === 'retired' ? retiredTasks.find(t => t.id === task.originalId)?.original_scheduled_date || formattedSelectedDay : formattedSelectedDay,
                is_critical: task.is_critical,
                is_locked: false, // Not locked in sink
                energy_cost: task.energy_cost,
              });
              continue; // Skip placement for this critical task
            }

            while (isBefore(searchTime, workdayEndTime)) {
                const freeBlocks = getFreeTimeBlocks(currentOccupiedBlocks, searchTime, workdayEndTime);
                
                if (freeBlocks.length === 0) {
                    break;
                }

                const taskDuration = task.duration;
                const breakDuration = task.break_duration || 0;
                const totalDuration = taskDuration + breakDuration;

                const suitableBlock = freeBlocks.find(block => block.duration >= totalDuration);

                if (suitableBlock) {
                    const proposedStartTime = suitableBlock.start;
                    const proposedEndTime = addMinutes(proposedStartTime, totalDuration);

                    if (isSlotFree(proposedStartTime, proposedEndTime, currentOccupiedBlocks)) {
                        tasksToInsert.push({
                            name: task.name,
                            start_time: proposedStartTime.toISOString(),
                            end_time: proposedEndTime.toISOString(),
                            break_duration: task.break_duration,
                            scheduled_date: formattedSelectedDay,
                            is_critical: task.is_critical,
                            is_flexible: true,
                            is_locked: false, // Changed from `task.is_critical ? true : false` to `false`
                            energy_cost: task.energy_cost,
                        });

                        currentOccupiedBlocks.push({ start: proposedStartTime, end: proposedEndTime, duration: totalDuration });
                        currentOccupiedBlocks = mergeOverlappingTimeBlocks(currentOccupiedBlocks);
                        currentPlacementTime = proposedEndTime;
                        placed = true;
                        break;
                    }
                }
                
                break; 
            }

            if (!placed) {
                tasksToKeepInSink.push({
                    user_id: user.id,
                    name: task.name,
                    duration: task.duration,
                    break_duration: task.break_duration,
                    original_scheduled_date: task.source === 'retired' ? retiredTasks.find(t => t.id === task.originalId)?.original_scheduled_date || formattedSelectedDay : formattedSelectedDay,
                    is_critical: task.is_critical,
                    is_locked: false,
                    energy_cost: task.energy_cost,
                });
            }
        }

        // --- 4. Execute Atomic Database Synchronization ---
        const payload: AutoBalancePayload = {
            scheduledTaskIdsToDelete: scheduledTaskIdsToDelete,
            retiredTaskIdsToDelete: retiredTaskIdsToDelete,
            tasksToInsert: tasksToInsert,
            tasksToKeepInSink: tasksToKeepInSink,
            selectedDate: formattedSelectedDay,
        };

        await autoBalanceSchedule(payload);

    } catch (error: any) {
        showError(`Failed to auto-balance schedule: ${error.message}`);
        console.error("Auto-balance error:", error);
    } finally {
        setIsProcessingCommand(false);
    }
  };

  const handleAutoScheduleSinkWrapper = () => {
    handleAutoScheduleSink();
  };

  // NEW: handleVibeSort function
  const handleVibeSort = async () => {
    if (!user || !profile) {
      showError("Please log in and ensure your profile is loaded to use Vibe Sort.");
      return;
    }
    setIsProcessingCommand(true);

    try {
      // 1. Perform an Aether Dump (Current Day) for flexible, unlocked tasks
      const flexibleScheduledTasksToDump = dbScheduledTasks.filter(task => task.is_flexible && !task.is_locked);
      if (flexibleScheduledTasksToDump.length > 0) {
        const newRetiredTasks: NewRetiredTask[] = flexibleScheduledTasksToDump.map(task => ({
          user_id: user.id,
          name: task.name,
          duration: (task.start_time && task.end_time) 
                    ? Math.floor((parseISO(task.end_time).getTime() - parseISO(task.start_time).getTime()) / (1000 * 60)) 
                    : null,
          break_duration: task.break_duration,
          original_scheduled_date: task.scheduled_date,
          is_critical: task.is_critical,
          is_locked: task.is_locked,
          energy_cost: task.energy_cost ?? 0,
        }));

        const { error: insertError } = await supabase.from('retired_tasks').insert(newRetiredTasks);
        if (insertError) throw new Error(`Failed to move tasks to Aether Sink for Vibe Sort: ${insertError.message}`);

        const { error: deleteError } = await supabase
          .from('scheduled_tasks')
          .delete()
          .in('id', flexibleScheduledTasksToDump.map(task => task.id))
          .eq('user_id', user.id);
        if (deleteError) throw new Error(`Failed to remove tasks from schedule for Vibe Sort: ${deleteError.message}`);
      }

      // 2. Immediately trigger the Auto Schedule process (which now includes Vibe Flow sorting)
      // We need to ensure the retiredTasks state is updated before calling handleAutoScheduleSink
      // Invalidate queries to ensure fresh data for the next step
      await queryClient.invalidateQueries({ queryKey: ['scheduledTasks', user.id, formattedSelectedDay, sortBy] });
      await queryClient.invalidateQueries({ queryKey: ['retiredTasks', user.id] });
      await queryClient.invalidateQueries({ queryKey: ['datesWithTasks', user.id] });

      // Wait for the query client to refetch before proceeding
      await queryClient.refetchQueries({ queryKey: ['retiredTasks', user.id] });
      await queryClient.refetchQueries({ queryKey: ['scheduledTasks', user.id, formattedSelectedDay, sortBy] });

      // Now call the auto-schedule logic
      await handleAutoScheduleSink(); // This will now operate on the newly dumped tasks + any existing sink tasks

      showSuccess("Vibe Sort completed!");

    } catch (error: any) {
      showError(`Failed to perform Vibe Sort: ${error.message}`);
      console.error("Vibe Sort error:", error);
    } finally {
      setIsProcessingCommand(false);
    }
  };

  // NEW: handleCompactSchedule function
  const handleCompactSchedule = async () => {
    if (!user || !profile || !dbScheduledTasks) return;
    setIsProcessingCommand(true);

    const compactedTasks = compactScheduleLogic(
      dbScheduledTasks,
      selectedDayAsDate,
      workdayStartTime,
      workdayEndTime,
      T_current,
      undefined, // preSortedFlexibleTasks
      isVibeFlowEnabled // Pass the Vibe Flow toggle state
    );

    if (compactedTasks.length > 0) {
      await compactScheduledTasks({ tasksToUpdate: compactedTasks, isVibeFlowEnabled });
      showSuccess("Schedule compacted!");
    } else {
      showError("No flexible tasks to compact or no space available.");
    }
    setIsProcessingCommand(false);
  };


  const handleSortFlexibleTasks = async (newSortBy: SortBy) => {
    if (!user || !profile || !dbScheduledTasks) return;
    setIsProcessingCommand(true);

    const flexibleTasks = dbScheduledTasks.filter(task => task.is_flexible && !task.is_locked);
    if (flexibleTasks.length === 0) {
      showSuccess("No unlocked flexible tasks to sort.");
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
      sortedFlexibleTasks,
      isVibeFlowEnabled // Pass the Vibe Flow toggle state
    );

    if (reorganizedTasks.length > 0) {
      await compactScheduledTasks({ tasksToUpdate: reorganizedTasks, isVibeFlowEnabled });
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

    const breaksToRandomize = dbScheduledTasks.filter(task => task.name.toLowerCase() === 'break' && !task.is_locked);
    if (breaksToRandomize.length === 0) {
      showSuccess("No flexible break tasks to randomize.");
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
      duration: 30,
      startTime: undefined,
      endTime: undefined,
      isCritical: false,
      isFlexible: true,
      energyCost: calculateEnergyCost(30, false),
    });
    setInjectionDuration('30');
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
      isFlexible: false,
      energyCost: 0,
    });
    setInjectionStartTime(format(T_current, 'h:mm a'));
    setInjectionEndTime(format(addHours(T_current, 1), 'h:mm a'));
    setInjectionDuration('');
    setInjectionBreak('');
    setInputValue('');
  };

  const handleCompleteScheduledTask = async (taskToComplete: DBScheduledTask) => {
    if (!user) {
      showError("You must be logged in to complete tasks.");
      return;
    }
    if (taskToComplete.is_locked) {
      showError(`Cannot complete locked task "${taskToComplete.name}". Unlock it first.`);
      return;
    }
    setIsProcessingCommand(true);
    try {
      await completeScheduledTask(taskToComplete);
      showSuccess(`Task "${taskToComplete.name}" completed!`);
    } catch (error: any) {
      showError(`Failed to complete task: ${error.message}`);
      console.error("Complete scheduled task error:", error);
    } finally {
      setIsProcessingCommand(false);
    }
  };

  const handleRefreshSchedule = () => {
    queryClient.invalidateQueries({ queryKey: ['scheduledTasks', user?.id, formattedSelectedDay, sortBy] });
    queryClient.invalidateQueries({ queryKey: ['datesWithTasks', user?.id] });
    queryClient.invalidateQueries({ queryKey: ['retiredTasks', user?.id] });
    showSuccess("Schedule refreshed!");
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
  const hasFlexibleTasksOnCurrentDay = dbScheduledTasks.some(item => item.is_flexible && !item.is_locked);

  return (
    <div className="container mx-auto p-4 max-w-3xl space-y-6">
      {/* 1. Vibe Scheduler Title */}
      <h1 className="text-3xl font-bold text-foreground flex items-center gap-2 animate-slide-in-up">
        <Clock className="h-7 w-7 text-primary" /> Vibe Scheduler
      </h1>

      {/* 2. Session Dashboard (Metrics + Zone 1: Global Management) */}
      <SchedulerDashboardPanel 
        scheduleSummary={currentSchedule?.summary || null} 
        onVibeSort={handleVibeSort} // Updated to new handleVibeSort
        onAetherDump={() => aetherDump()}
        isProcessingCommand={isProcessingCommand}
        hasFlexibleTasks={hasFlexibleTasksOnCurrentDay}
        onRefreshSchedule={handleRefreshSchedule} // NEW: Pass refresh handler
      />

      {/* 3. Calendar Strip */}
      <CalendarStrip 
        selectedDay={selectedDay} 
        setSelectedDay={setSelectedDay} 
        datesWithTasks={datesWithTasks} 
        isLoadingDatesWithTasks={isLoadingDatesWithTasks}
      />

      {/* 4. "Schedule Your Day" Input Bar (+ Zone 2: Input Footer) */}
      <Card className="animate-pop-in animate-hover-lift">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-primary" /> Schedule Your Day
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Current Time: <span className="font-semibold">{formatDateTime(T_current)}</span>
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <WeatherWidget />
          <SchedulerInput 
            onCommand={handleCommand} 
            isLoading={overallLoading} 
            inputValue={inputValue}
            setInputValue={setInputValue}
            placeholder={`Add task (e.g., 'Gym 60', 'Meeting 11am-12pm' [fixed by time]) or command (e.g., 'inject "Project X" 30', 'remove "Gym"', 'clear', 'compact', 'aether dump', 'aether dump mega')`}
            onDetailedInject={handleAddTaskClick} // NEW: Pass handler for detailed injector button
          />
          <p className="text-xs text-muted-foreground">
            Examples: "Gym 60", "Meeting 11am-12pm", 'inject "Project X" 30', 'remove "Gym"', 'clear', 'compact', "Clean the sink 30 sink", "Time Off 2pm-3pm", "Aether Dump", "Aether Dump Mega"
          </p>
        </CardContent>
      </Card>

      {/* 5. Zone 3: Real-Time Utility Bar */}
      <SchedulerUtilityBar 
        isProcessingCommand={isProcessingCommand}
        hasFlexibleTasksOnCurrentDay={hasFlexibleTasksOnCurrentDay}
        dbScheduledTasks={dbScheduledTasks}
        onRechargeEnergy={() => rechargeEnergy()}
        onRandomizeBreaks={handleRandomizeBreaks}
        onSortFlexibleTasks={handleSortFlexibleTasks}
        onOpenWorkdayWindowDialog={() => setShowWorkdayWindowDialog(true)}
        sortBy={sortBy}
        isVibeFlowEnabled={isVibeFlowEnabled}
        onToggleVibeFlow={() => setIsVibeFlowEnabled(prev => !prev)}
        onCompactSchedule={handleCompactSchedule} // Pass the new handler here
      />

      {/* 6. NOW FOCUS Card - STICKY */}
      {isSameDay(parseISO(selectedDay), T_current) && (
        <div className="sticky top-16 z-40 bg-background pb-4 animate-slide-in-up"> {/* Added sticky, top-16, z-40 */}
          <NowFocusCard activeItem={activeItem} nextItem={nextItem} T_current={T_current} />
        </div>
      )}
      
      {/* 7. "Tasks Outside Workday" Alert */}
      {currentSchedule?.summary.unscheduledCount > 0 && (
        <Card className="animate-pop-in animate-hover-lift">
          <CardContent className="p-4 text-center text-orange-500 font-semibold flex items-center justify-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            <span>⚠️ {currentSchedule.summary.unscheduledCount} task{currentSchedule.summary.unscheduledCount > 1 ? 's' : ''} fall outside your workday window.</span>
          </CardContent>
        </Card>
      )}

      {/* 8. Tabbed Schedule Container */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
        <TabsList className="grid w-full grid-cols-2 h-10 p-1 bg-muted rounded-md sticky top-[32px] z-20">
          <TabsTrigger 
            value="vibe-schedule" 
            className="h-9 px-4 py-2 text-sm font-medium rounded-md text-muted-foreground hover:bg-muted/50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md animate-hover-lift"
          >
            <Sparkles className="h-4 w-4 mr-2 text-logo-yellow" /> Your Vibe Schedule
          </TabsTrigger>
          <TabsTrigger 
            value="aether-sink" 
            className="h-9 px-4 py-2 text-sm font-medium rounded-md text-muted-foreground hover:bg-muted/50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md animate-hover-lift"
          >
            <Trash2 className="h-4 w-4 mr-2 text-muted-foreground" /> The Aether Sink ({retiredTasks.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="vibe-schedule" className="space-y-4">
          <Card className="animate-pop-in animate-hover-lift">
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
                  onCompleteTask={handleCompleteScheduledTask}
                  activeItemId={activeItem?.id || null} 
                  selectedDayString={selectedDay} 
                  onAddTaskClick={handleAddTaskClick}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="aether-sink" className="space-y-4">
          <AetherSink 
            retiredTasks={retiredTasks} 
            onRezoneTask={handleRezoneFromSink} 
            onRemoveRetiredTask={handleRemoveRetiredTask}
            onAutoScheduleSink={handleAutoScheduleSinkWrapper}
            isLoading={isLoadingRetiredTasks}
            isProcessingCommand={isProcessingCommand}
            profileEnergy={profile?.energy || 0} // NEW: Pass profile energy for critical task status
          />
        </TabsContent>
      </Tabs>

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

      <WorkdayWindowDialog 
        open={showWorkdayWindowDialog} 
        onOpenChange={setShowWorkdayWindowDialog} 
      />
    </div>
  );
};

export default SchedulerPage;