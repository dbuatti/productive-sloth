import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, ListTodo, Sparkles, Loader2, AlertTriangle, Trash2, ChevronsUp, Star, ArrowDownWideNarrow, ArrowUpWideNarrow, Shuffle, CalendarOff, RefreshCcw, Globe, Zap, Settings2 } from 'lucide-react';
import SchedulerInput from '@/components/SchedulerInput';
import SchedulerDisplay from '@/components/SchedulerDisplay';
import { FormattedSchedule, DBScheduledTask, ScheduledItem, NewDBScheduledTask, RetiredTask, NewRetiredTask, SortBy, TaskPriority, AutoBalancePayload, UnifiedTask, TimeBlock, TaskEnvironment } from '@/types/scheduler';
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
  getFreeTimeBlocks,
  calculateEnergyCost,
  getEmojiHue,
  getBreakDescription,
} from '@/lib/scheduler-utils';
import { showSuccess, showError } from '@/utils/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import { useSession } from '@/hooks/use-session';
import { parse, startOfDay, setHours, setMinutes, format, isSameDay, addDays, addMinutes, parseISO, isBefore, isAfter, addHours, subDays, differenceInMinutes } from 'date-fns';
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
} from "@/components/ui/alert-dialog";
import { useLocation, useNavigate } from 'react-router-dom';
import AetherSink from '@/components/AetherSink';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import WeatherWidget from '@/components/WeatherWidget';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SchedulerUtilityBar from '@/components/SchedulerUtilityBar';
import WorkdayWindowDialog from '@/components/WorkdayWindowDialog';
import ScheduledTaskDetailDialog from '@/components/ScheduledTaskDetailDialog';
import ImmersiveFocusMode from '@/components/ImmersiveFocusMode';
import EarlyCompletionModal from '@/components/EarlyCompletionModal';
import DailyVibeRecapCard from '@/components/DailyVibeRecapCard';
import { LOW_ENERGY_THRESHOLD, MAX_ENERGY } from '@/lib/constants';
import EnvironmentMultiSelect from '@/components/EnvironmentMultiSelect'; // UPDATED: Import Multi-Select
import { useEnvironmentContext } from '@/hooks/use-environment-context'; // UPDATED: Import useEnvironmentContext

// Removed useDeepCompareMemoize to ensure immediate updates for task details
// function useDeepCompareMemoize<T>(value: T): T {
//   const ref = useRef<T>(value);
//   const signalRef = useRef<number>(0);

//   if (!deepCompare(value, ref.current)) {
//     ref.current = value;
//     signalRef.current++;
//   }

//   return useMemo(() => ref.current, [signalRef.current],);
// }

const DURATION_BUCKETS = [5, 10, 15, 20, 25, 30, 45, 60, 75, 90];
const LONG_TASK_THRESHOLD = 90;

const INTERLEAVING_PATTERN = [
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
  { duration: LONG_TASK_THRESHOLD + 1, critical: true },
  { duration: LONG_TASK_THRESHOLD + 1, critical: false },
];

interface InjectionPromptState {
  taskName: string;
  isOpen: boolean;
  isTimed?: boolean;
  duration?: number;
  breakDuration?: number;
  startTime?: string;
  endTime?: string;
  isCritical?: boolean;
  isFlexible?: boolean;
  energyCost?: number;
  isCustomEnergyCost?: boolean;
  taskEnvironment?: TaskEnvironment; // NEW: Add taskEnvironment
}

const SchedulerPage: React.FC = () => {
  const { user, profile, isLoading: isSessionLoading, rechargeEnergy, T_current, activeItemToday, nextItemToday } = useSession();
  const { selectedEnvironments } = useEnvironmentContext(); // UPDATED: Use environment context
  const environmentForPlacement = selectedEnvironments[0] || 'laptop'; // Determine environment for placement
  const [selectedDay, setSelectedDay] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const scheduleContainerRef = useRef<HTMLDivElement>(null); // Ref for the scrollable container

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
    completedTasksForSelectedDayList, // NEW: Import completedTasksForSelectedDayList
    isLoadingCompletedTasksForSelectedDay, // NEW: Import loading state for completedTasksForSelectedDayList
    retireTask,
    rezoneTask,
    compactScheduledTasks,
    randomizeBreaks,
    toggleScheduledTaskLock,
    aetherDump,
    aetherDumpMega,
    sortBy,
    setSortBy,
    retiredSortBy,
    setRetiredSortBy,
    autoBalanceSchedule,
    completeScheduledTask: completeScheduledTaskMutation,
    updateScheduledTaskDetails,
    updateScheduledTaskStatus,
    removeRetiredTask, // ADDED: Import removeRetiredTask
  } = useSchedulerTasks(selectedDay, scheduleContainerRef); // Pass the ref here

  const queryClient = useQueryClient();
  
  const [isProcessingCommand, setIsProcessingCommand] = useState(false);
  const [injectionPrompt, setInjectionPrompt] = useState<InjectionPromptState | null>(null);
  const [injectionDuration, setInjectionDuration] = useState('');
  const [injectionBreak, setInjectionBreak] = useState('');
  const [injectionStartTime, setInjectionStartTime] = useState('');
  const [injectionEndTime, setInjectionEndTime] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [hasMorningFixRunToday, setHasMorningFixRunToday] = useState(false);
  const [activeTab, setActiveTab] = useState('vibe-schedule');
  const [showWorkdayWindowDialog, setShowWorkdayWindowDialog] = useState(false);
  const [isFocusModeActive, setIsFocusModeActive] = useState(false);

  const [showEarlyCompletionModal, setShowEarlyCompletionModal] = useState(false);
  const [earlyCompletionTaskName, setEarlyCompletionTaskName] = useState('');
  const [earlyCompletionRemainingMinutes, setEarlyCompletionRemainingMinutes] = useState(0);
  const [earlyCompletionDbTask, setEarlyCompletionDbTask] = useState<DBScheduledTask | null>(null);


  const selectedDayAsDate = useMemo(() => parseISO(selectedDay), [selectedDay]);

  const occupiedBlocks = useMemo(() => {
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
  }, [dbScheduledTasks, selectedDayAsDate]);


  const formattedSelectedDay = selectedDay;
  const location = useLocation();
  const navigate = useNavigate();

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
        breakDuration: undefined,
        isCustomEnergyCost: false,
        taskEnvironment: environmentForPlacement, // NEW: Default to environmentForPlacement
      });
      setInjectionDuration(String(duration));
      navigate(location.pathname, { replace: true, state: {} }); 
    }
  }, [location.state, navigate, environmentForPlacement]);

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
    ? setTimeOnDate(startOfDay(selectedDayAsDate), profile.default_auto_schedule_end_time) 
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
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime());

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

  const handleRefreshSchedule = () => {
    if (user?.id) {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', user.id, formattedSelectedDay, sortBy] });
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', user.id] });
      queryClient.invalidateQueries({ queryKey: ['completedTasksForSelectedDayList', user.id, formattedSelectedDay] }); // NEW: Invalidate completed tasks list for selected day
      showSuccess("Schedule data refreshed.");
    }
  };

  const handleQuickScheduleBlock = async (duration: number, sortPreference: 'longestFirst' | 'shortestFirst') => {
    if (!user || !profile) {
      showError("Please log in and ensure your profile is loaded to quick schedule.");
      return;
    }
    setIsProcessingCommand(true);

    const taskName = `Focus Block (${duration} min)`;
    const energyCost = calculateEnergyCost(duration, false);

    try {
      const { proposedStartTime, proposedEndTime, message } = await findFreeSlotForTask(
        taskName,
        duration,
        false,
        true,
        energyCost,
        occupiedBlocks,
        effectiveWorkdayStart,
        workdayEndTime
      );

      if (proposedStartTime && proposedEndTime) {
        await addScheduledTask({
          name: taskName,
          start_time: proposedStartTime.toISOString(),
          end_time: proposedEndTime.toISOString(),
          break_duration: null,
          scheduled_date: formattedSelectedDay,
          is_critical: false,
          is_flexible: true,
          is_locked: false,
          energy_cost: energyCost,
          is_custom_energy_cost: false,
          task_environment: environmentForPlacement, // UPDATED: Use environmentForPlacement
        });
        showSuccess(`Quick Scheduled ${duration} min focus block.`);
        queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
      } else {
        showError(message);
      }
    } catch (error: any) {
      showError(`Failed to quick schedule: ${error.message}`);
    } finally {
      setIsProcessingCommand(false);
    }
  };

  // FIX 6: Define handleCompactSchedule
  const handleCompactSchedule = useCallback(async () => {
    if (!user || !profile) {
        showError("Please log in and ensure your profile is loaded to compact the schedule.");
        return;
    }
    if (!dbScheduledTasks.some(task => task.is_flexible && !task.is_locked)) {
        showSuccess("No flexible tasks to compact.");
        return;
    }

    setIsProcessingCommand(true);
    try {
        const compactedTasks = compactScheduleLogic(
            dbScheduledTasks,
            selectedDayAsDate,
            workdayStartTime,
            workdayEndTime,
            T_current
        );

        // Filter out tasks that were not placed (i.e., still have null times or are outside the window)
        const tasksToUpdate = compactedTasks.filter(task => task.start_time && task.end_time);

        if (tasksToUpdate.length > 0) {
            await compactScheduledTasks({ tasksToUpdate });
            showSuccess("Schedule compacted successfully!");
            queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
        } else {
            showError("Compaction failed: No tasks could be placed within the workday window.");
        }
    } catch (error: any) {
        showError(`Failed to compact schedule: ${error.message}`);
        console.error("Compact schedule error:", error);
    } finally {
        setIsProcessingCommand(false);
    }
  }, [user, profile, dbScheduledTasks, selectedDayAsDate, workdayStartTime, workdayEndTime, T_current, compactScheduledTasks, queryClient]);

  // FIX 5: Define handleSortFlexibleTasks
  const handleSortFlexibleTasks = useCallback(async (newSortBy: SortBy) => {
    if (!user || !profile) {
        showError("Please log in and ensure your profile is loaded to sort tasks.");
        return;
    }
    
    // This function only sets the sort state, which triggers a re-fetch of scheduled tasks.
    // The actual re-placement/re-balancing logic is handled by handleZoneFocus/AutoBalance.
    // For simple sorting of the current schedule view, we just update the state.
    setSortBy(newSortBy);
    showSuccess(`Schedule sorted by ${newSortBy.replace(/_/g, ' ').toLowerCase()}.`);
  }, [user, profile, setSortBy]);


  // FIX 2: Define handleAetherDumpButton
  const handleAetherDumpButton = async () => {
    if (!user) {
      showError("You must be logged in to perform Aether Dump.");
      return;
    }
    setIsProcessingCommand(true);

    try {
      await aetherDump();
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
    } catch (error) {
      console.error("Aether Dump error:", error);
    } finally {
      setIsProcessingCommand(false);
    }
  };

  // FIX 1: Corrected function name and implementation
  const handleAutoScheduleSinkWrapper = async () => {
    if (!user || !profile) {
      showError("Please log in and ensure your profile is loaded to auto-schedule.");
      return;
    }
    setIsProcessingCommand(true);
    try {
      // This logic is now handled by handleZoneFocus with no environment filter
      await handleZoneFocus();
    } catch (error) {
      console.error("Auto Schedule Sink error:", error);
    } finally {
      setIsProcessingCommand(false);
    }
  };


  const handleClearSchedule = async () => {
    if (!user) {
      showError("You must be logged in to clear your schedule.");
      return;
    }
    setIsProcessingCommand(true);
    
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
      // Success toast and query invalidation are now handled in useSchedulerTasks' onSettled
    }

    setIsProcessingCommand(false);
    setShowClearConfirmation(false);
    setInputValue('');
  };

  const handleSinkFill = useCallback(async (
    gapStart: Date,
    gapEnd: Date,
    maxDuration: number,
    tasksToExclude: string[] = []
  ): Promise<boolean> => {
    if (!user || !profile) return false;

    const eligibleSinkTasks = retiredTasks
        .filter(task => !task.is_locked && !task.is_completed && !tasksToExclude.includes(task.id))
        .map(task => ({
            ...task,
            duration: task.duration || 30,
            totalDuration: (task.duration || 30) + (task.break_duration || 0),
        }))
        .filter(task => task.totalDuration <= maxDuration);

    if (eligibleSinkTasks.length === 0) {
        console.log("SinkFill: No eligible tasks found in Aether Sink for the gap.");
        return false;
    }

    eligibleSinkTasks.sort((a, b) => {
        if (a.is_critical !== b.is_critical) return a.is_critical ? -1 : 1;
        return b.totalDuration - a.totalDuration;
    });

    const taskToPlace = eligibleSinkTasks[0];
    const taskDuration = taskToPlace.duration;
    const breakDuration = taskToPlace.break_duration || 0;
    const totalDuration = taskDuration + breakDuration;

    const gapDuration = differenceInMinutes(gapEnd, gapStart);
    const remainingGap = gapDuration - totalDuration;
    
    let proposedStartTime: Date;
    if (remainingGap > 0) {
        proposedStartTime = addMinutes(gapStart, Math.floor(remainingGap / 2));
    } else {
        proposedStartTime = gapStart;
    }
    const proposedEndTime = addMinutes(proposedStartTime, totalDuration);

    try {
        await rezoneTask(taskToPlace.id);

        await addScheduledTask({
          name: taskToPlace.name,
          start_time: proposedStartTime.toISOString(),
          end_time: proposedEndTime.toISOString(),
          break_duration: taskToPlace.break_duration,
          scheduled_date: formattedSelectedDay,
          is_critical: taskToPlace.is_critical,
          is_flexible: true,
          is_locked: false,
          energy_cost: taskToPlace.energy_cost,
          is_custom_energy_cost: taskToPlace.is_custom_energy_cost,
          task_environment: taskToPlace.task_environment, // NEW: Add environment
        });

        return true;
    } catch (error: any) {
        showError(`Failed to fill gap with sink task: ${error.message}`);
        console.error("Sink Fill Error:", error);
        return false;
    }
  }, [user, profile, retiredTasks, rezoneTask, addScheduledTask, formattedSelectedDay]);

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
          is_custom_energy_cost: false,
          task_environment: environmentForPlacement, // UPDATED: Use environmentForPlacement
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
              is_custom_energy_cost: false,
              task_environment: environmentForPlacement, // UPDATED: Use environmentForPlacement
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
            break_duration: parsedInput.breakDuration, 
            scheduled_date: taskScheduledDate, 
            is_critical: parsedInput.isCritical, 
            is_flexible: parsedInput.isFlexible, 
            energy_cost: parsedInput.energyCost,
            is_custom_energy_cost: false,
            task_environment: environmentForPlacement, // UPDATED: Use environmentForPlacement
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
            is_custom_energy_cost: false,
            task_environment: environmentForPlacement, // UPDATED: Use environmentForPlacement
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
          breakDuration: injectCommand.breakDuration,
          isCustomEnergyCost: false,
          taskEnvironment: environmentForPlacement, // UPDATED: Use environmentForPlacement
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
          breakDuration: injectCommand.breakDuration,
          isCustomEnergyCost: false,
          taskEnvironment: environmentForPlacement, // UPDATED: Use environmentForPlacement
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
              queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
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
              queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
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
            breakDuration: undefined,
            isCustomEnergyCost: false,
            taskEnvironment: 'away', // Time Off defaults to 'away'
          });
          setInjectionStartTime(format(T_current, 'h:mm a'));
          setInjectionEndTime(format(addHours(T_current, 1), 'h:mm a'));
          setInjectionDuration('');
          setInjectionBreak('');
          success = true;
          break;
        case 'aether dump':
        case 'reset schedule':
          await aetherDump();
          queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
          success = true;
          break;
        case 'aether dump mega':
          await aetherDumpMega();
          queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
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
        break_duration: injectionPrompt.breakDuration, 
        scheduled_date: taskScheduledDate, 
        is_critical: injectionPrompt.isCritical, 
        is_flexible: injectionPrompt.isFlexible, 
        energy_cost: calculatedEnergyCost,
        is_custom_energy_cost: false,
        task_environment: environmentForPlacement, // UPDATED: Use environmentForPlacement
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
          is_custom_energy_cost: false,
          task_environment: environmentForPlacement, // UPDATED: Use environmentForPlacement
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
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
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
          is_locked: false,
          energy_cost: retiredTask.energy_cost,
          is_custom_energy_cost: retiredTask.is_custom_energy_cost,
          task_environment: retiredTask.task_environment, // NEW: Add environment
        });
        currentOccupiedBlocksForScheduling.push({ start: proposedStartTime, end: proposedEndTime, duration: taskDuration });
        currentOccupiedBlocksForScheduling = mergeOverlappingTimeBlocks(currentOccupiedBlocksForScheduling);

        showSuccess(`Re-zoned "${retiredTask.name}" from ${formatTime(proposedStartTime)} to ${formatTime(proposedEndTime)}.`);
        queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
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

  // FIX 2: Define handleManualRetire
  const handleManualRetire = useCallback(async (task: DBScheduledTask) => {
    if (!user) {
      showError("You must be logged in to retire tasks.");
      return;
    }
    if (task.is_locked) {
      showError(`Cannot retire locked task "${task.name}". Unlock it first.`);
      return;
    }
    setIsProcessingCommand(true);
    try {
      await retireTask(task);
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
      showSuccess(`Task "${task.name}" moved to Aether Sink.`);
    } catch (error: any) {
      showError(`Failed to retire task: ${error.message}`);
      console.error("Manual retire error:", error);
    } finally {
      setIsProcessingCommand(false);
    }
  }, [user, retireTask, queryClient]);

  // FIX 4: Define handleRemoveRetiredTask
  const handleRemoveRetiredTask = useCallback(async (taskId: string) => {
    if (!user) {
      showError("You must be logged in to remove retired tasks.");
      return;
    }
    setIsProcessingCommand(true);
    try {
      await removeRetiredTask(taskId);
      showSuccess("Retired task permanently deleted.");
    } catch (error: any) {
      showError(`Failed to remove retired task: ${error.message}`);
      console.error("Remove retired task error:", error);
    } finally {
      setIsProcessingCommand(false);
    }
  }, [user, removeRetiredTask]);
  
  const handleZoneFocus = async () => {
    if (!user || !profile) {
        showError("Please log in and ensure your profile is loaded to use Zone Focus.");
        return;
    }

    const today = startOfDay(new Date());
    if (isBefore(selectedDayAsDate, today)) {
      showError("Cannot use Zone Focus for a past day. Please select today or a future day.");
      return;
    }

    setIsProcessingCommand(true);
    console.log(`handleZoneFocus: Starting Zone Focus for environments: ${selectedEnvironments.join(', ')}`);

    try {
        const existingFixedTasks = dbScheduledTasks.filter(task => !task.is_flexible || task.is_locked);
        const flexibleScheduledTasks = dbScheduledTasks.filter(task => task.is_flexible && !task.is_locked);
        const unlockedRetiredTasks = retiredTasks.filter(task => !task.is_locked);

        const unifiedPool: UnifiedTask[] = [];
        
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
                is_custom_energy_cost: task.is_custom_energy_cost,
                created_at: task.created_at,
                task_environment: task.task_environment,
            });
        });

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
                is_custom_energy_cost: task.is_custom_energy_cost,
                created_at: task.retired_at,
                task_environment: task.task_environment,
            });
        });

        // --- ZONE FOCUS FILTERING ---
        const tasksToPlace = unifiedPool.filter(task => {
            if (selectedEnvironments.length === 0) {
                // If no environment is selected, Zone Focus acts like Auto-Balance (places all flexible tasks)
                return true;
            }
            // If environments are selected, only place tasks matching one of them
            return selectedEnvironments.includes(task.task_environment);
        });
        
        // Tasks that are currently in the schedule but DON'T match the environment must be retired.
        const tasksToRetireFromSchedule = flexibleScheduledTasks.filter(task => {
            if (selectedEnvironments.length === 0) {
                // If no environment is selected, we don't retire anything based on environment mismatch.
                return false;
            }
            return !selectedEnvironments.includes(task.task_environment);
        });
        
        const scheduledTaskIdsToDelete: string[] = [];
        const retiredTaskIdsToDelete: string[] = []; 
        const tasksToInsert: NewDBScheduledTask[] = [];
        const tasksToMoveToSinkFromSchedule: NewRetiredTask[] = []; 
        
        // 1. Add existing fixed tasks to tasksToInsert
        existingFixedTasks.forEach(task => {
            tasksToInsert.push({
                id: task.id, 
                name: task.name,
                start_time: task.start_time,
                end_time: task.end_time,
                break_duration: task.break_duration,
                scheduled_date: task.scheduled_date,
                is_critical: task.is_critical,
                is_flexible: task.is_flexible,
                is_locked: task.is_locked,
                energy_cost: task.energy_cost,
                is_completed: task.is_completed,
                is_custom_energy_cost: task.is_custom_energy_cost,
                task_environment: task.task_environment,
            });
        });

        // 2. Prepare the queue for placement (only tasks matching the environment)
        let balancedQueue: UnifiedTask[] = [...tasksToPlace].sort((a, b) => {
          // P1: CRITICALITY FIRST
          if (a.is_critical !== b.is_critical) {
            return a.is_critical ? -1 : 1;
          }
          // P2: TASK AGE (Oldest First)
          const createdA = new Date(a.created_at).getTime();
          const createdB = new Date(b.created_at).getTime();
          if (createdA !== createdB) {
            return createdA - createdB;
          }
          // P3: DURATION (Smallest First)
          const durationA = (a.duration || 30) + (a.break_duration || 0);
          const durationB = (b.duration || 30) + (b.break_duration || 0);
          if (durationA !== durationB) {
            return durationA - durationB;
          }
          return a.name.localeCompare(b.name);
        });

        const fixedOccupiedBlocks = mergeOverlappingTimeBlocks(existingFixedTasks
            .filter(task => task.start_time && task.end_time)
            .map(task => {
                const start = setTimeOnDate(selectedDayAsDate, format(parseISO(task.start_time!), 'HH:mm'));
                let end = setTimeOnDate(selectedDayAsDate, format(parseISO(task.end_time!), 'HH:mm'));
                if (isBefore(end, start)) end = addDays(end, 1);
                return { start, end, duration: differenceInMinutes(end, start) };
            })
        );

        let currentOccupiedBlocks = [...fixedOccupiedBlocks];
        let currentPlacementTime = effectiveWorkdayStart;

        for (const task of balancedQueue) {
            let placed = false;
            let searchTime = currentPlacementTime;

            if (task.is_critical && profile.energy < 80) {
              // Critical task skipped due to low energy, remains in sink (if from sink) or moves to sink (if from schedule)
              if (task.source === 'scheduled') {
                  tasksToMoveToSinkFromSchedule.push({
                      user_id: user.id,
                      name: task.name,
                      duration: task.duration,
                      break_duration: task.break_duration,
                      original_scheduled_date: formattedSelectedDay,
                      is_critical: task.is_critical,
                      is_locked: false,
                      energy_cost: task.energy_cost,
                      is_completed: false,
                      is_custom_energy_cost: task.is_custom_energy_cost,
                      task_environment: task.task_environment,
                  });
                  scheduledTaskIdsToDelete.push(task.originalId); 
              }
              continue; 
            }

            while (isBefore(searchTime, workdayEndTime)) {
                const freeBlocks = getFreeTimeBlocks(currentOccupiedBlocks, searchTime, workdayEndTime);
                
                if (freeBlocks.length === 0) break;

                const taskDuration = task.duration;
                const breakDuration = task.break_duration || 0;
                const totalDuration = taskDuration + breakDuration;

                const suitableBlock = freeBlocks.find(block => block.duration >= totalDuration);

                if (suitableBlock) {
                    const proposedStartTime = suitableBlock.start;
                    const proposedEndTime = addMinutes(proposedStartTime, totalDuration);

                    if (isSlotFree(proposedStartTime, proposedEndTime, currentOccupiedBlocks)) {
                        tasksToInsert.push({
                            id: task.originalId, 
                            name: task.name,
                            start_time: proposedStartTime.toISOString(),
                            end_time: proposedEndTime.toISOString(),
                            break_duration: task.break_duration,
                            scheduled_date: formattedSelectedDay,
                            is_critical: task.is_critical,
                            is_flexible: true, 
                            is_locked: false, 
                            energy_cost: task.energy_cost,
                            is_completed: false,
                            is_custom_energy_cost: task.is_custom_energy_cost,
                            task_environment: task.task_environment,
                        });

                        currentOccupiedBlocks.push({ start: proposedStartTime, end: proposedEndTime, duration: totalDuration });
                        currentOccupiedBlocks = mergeOverlappingTimeBlocks(currentOccupiedBlocks);
                        currentPlacementTime = proposedEndTime;
                        placed = true;

                        if (task.source === 'scheduled') {
                            scheduledTaskIdsToDelete.push(task.originalId); 
                        } else if (task.source === 'retired') {
                            retiredTaskIdsToDelete.push(task.originalId); 
                        }
                        break;
                    }
                }
                break; 
            }

            if (!placed) {
                // Task could not be placed.
                if (task.source === 'scheduled') {
                    // If it was a flexible scheduled task, move it to the sink
                    tasksToMoveToSinkFromSchedule.push({
                        user_id: user.id,
                        name: task.name,
                        duration: task.duration,
                        break_duration: task.break_duration,
                        original_scheduled_date: formattedSelectedDay,
                        is_critical: task.is_critical,
                        is_locked: false,
                        energy_cost: task.energy_cost,
                        is_completed: false,
                        is_custom_energy_cost: task.is_custom_energy_cost,
                        task_environment: task.task_environment,
                    });
                    scheduledTaskIdsToDelete.push(task.originalId); 
                }
            }
        }
        
        // 3. Handle non-matching flexible tasks currently in the schedule (Tasks to Retire)
        tasksToRetireFromSchedule.forEach(task => {
            if (!scheduledTaskIdsToDelete.includes(task.id)) {
                scheduledTaskIdsToDelete.push(task.id);
                tasksToMoveToSinkFromSchedule.push({
                    user_id: user.id,
                    name: task.name,
                    duration: Math.floor((parseISO(task.end_time!).getTime() - parseISO(task.start_time!).getTime()) / (1000 * 60)),
                    break_duration: task.break_duration,
                    original_scheduled_date: formattedSelectedDay,
                    is_critical: task.is_critical,
                    is_locked: false,
                    energy_cost: task.energy_cost,
                    is_completed: false,
                    is_custom_energy_cost: task.is_custom_energy_cost,
                    task_environment: task.task_environment,
                });
            }
        });

        // 4. Ensure all original flexible scheduled tasks that were placed are marked for deletion from schedule
        flexibleScheduledTasks.forEach(task => {
            if (tasksToPlace.some(t => t.originalId === task.id && t.source === 'scheduled') && tasksToInsert.some(t => t.id === task.id)) {
                // If a scheduled task was placed, ensure its old entry is deleted
                if (!scheduledTaskIdsToDelete.includes(task.id)) {
                    scheduledTaskIdsToDelete.push(task.id);
                }
            }
        });


        const payload: AutoBalancePayload = {
            scheduledTaskIdsToDelete: scheduledTaskIdsToDelete,
            retiredTaskIdsToDelete: retiredTaskIdsToDelete, 
            tasksToInsert: tasksToInsert,
            tasksToKeepInSink: tasksToMoveToSinkFromSchedule, 
            selectedDate: formattedSelectedDay,
        };

        console.log("handleSortFlexibleTasks: Final payload for autoBalanceSchedule mutation:", {
          scheduledTaskIdsToDelete: payload.scheduledTaskIdsToDelete,
          retiredTaskIdsToDelete: payload.retiredTaskIdsToDelete,
          tasksToInsert: payload.tasksToInsert.map(t => ({ id: t.id, name: t.name, is_flexible: t.is_flexible, is_locked: t.is_locked })),
          tasksToKeepInSink: payload.tasksToKeepInSink.map(t => ({ name: t.name })),
          selectedDate: payload.selectedDate,
        });

        await autoBalanceSchedule(payload);
        showSuccess("Flexible tasks sorted and schedule re-balanced!");
        setSortBy('TIME_EARLIEST_TO_LATEST'); // FIX 2: Set sort to default time sort after re-balancing
        queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
        setIsProcessingCommand(false);
    } catch (error: any) {
        showError(`Failed to run Zone Focus: ${error.message}`);
        console.error("Zone Focus error:", error);
    } finally {
        setIsProcessingCommand(false);
        console.log("handleZoneFocus: Zone Focus process finished.");
    }
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

    queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
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
      breakDuration: undefined,
      isCustomEnergyCost: false,
      taskEnvironment: environmentForPlacement, // UPDATED: Use environmentForPlacement
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
      breakDuration: undefined,
      isCustomEnergyCost: false,
      taskEnvironment: 'away', // Time Off defaults to 'away'
    });
    setInjectionStartTime(format(T_current, 'h:mm a'));
    setInjectionEndTime(format(addHours(T_current, 1), 'h:mm a'));
    setInjectionDuration('');
    setInjectionBreak('');
    setInputValue('');
  };

  const handleSchedulerAction = useCallback(async (
    action: 'complete' | 'skip' | 'takeBreak' | 'startNext' | 'justFinish' | 'exitFocus', // NEW: Added 'justFinish'
    task: DBScheduledTask,
    isEarlyCompletion: boolean = false,
    remainingDurationMinutes: number = 0,
  ) => {
    if (!user) {
      showError("You must be logged in to perform this action.");
      return;
    }
    if (task.is_locked && action !== 'exitFocus') {
      showError(`Cannot perform action on locked task "${task.name}". Unlock it first.`);
      return;
    }
    
    setIsProcessingCommand(true);
    let modalOpened = false;

    try {
      if (action === 'complete') {
        const activeItem = currentSchedule?.items.find(item => item.id === task.id);
        
        const isCurrentlyActive = activeItem && isSameDay(activeItem.startTime, T_current) && T_current >= activeItem.startTime && T_current < activeItem.endTime;
        
        let shouldOpenEarlyCompletionModal = false;
        let remainingMins = 0;

        if (isCurrentlyActive) {
            remainingMins = activeItem ? differenceInMinutes(activeItem.endTime, T_current) : 0;
            if (remainingMins > 0) { // Only show modal if there's actual time remaining
                shouldOpenEarlyCompletionModal = true;
            }
        }
        
        if (shouldOpenEarlyCompletionModal) {
            setEarlyCompletionTaskName(task.name);
            setEarlyCompletionRemainingMinutes(remainingMins);
            setEarlyCompletionDbTask(task);
            setShowEarlyCompletionModal(true);
            modalOpened = true;
            setIsProcessingCommand(false); 
            return;
        } else {
            // If it's a future task, or active task completed exactly on time/past its end time
            await completeScheduledTaskMutation(task); 
            if (task.is_flexible) {
              await removeScheduledTask(task.id);
            } else {
              await updateScheduledTaskStatus({ taskId: task.id, isCompleted: true });
            }
            showSuccess(`Task "${task.name}" completed!`);
            if (isCurrentlyActive) {
                if (!nextItemToday || isAfter(nextItemToday.startTime, addMinutes(T_current, 5))) {
                  setIsFocusModeActive(false);
                }
            }
        }
        
      } else if (action === 'skip') {
        await handleManualRetire(task);
        showSuccess(`Task "${task.name}" skipped and moved to Aether Sink.`);
        setIsFocusModeActive(false);
      } else if (action === 'takeBreak') {
        const breakDuration = remainingDurationMinutes;
        const breakStartTime = T_current;
        const breakEndTime = addMinutes(breakStartTime, breakDuration);

        await addScheduledTask({
          name: 'Flow Break',
          start_time: breakStartTime.toISOString(),
          end_time: breakEndTime.toISOString(),
          break_duration: breakDuration,
          scheduled_date: formattedSelectedDay,
          is_critical: false,
          is_flexible: false,
          is_locked: true,
          energy_cost: 0,
          is_custom_energy_cost: false,
          task_environment: environmentForPlacement, // UPDATED: Use environmentForPlacement
        });

        if (task.is_flexible) {
          await removeScheduledTask(task.id);
        } else {
          await updateScheduledTaskStatus({ taskId: task.id, isCompleted: true });
        }
        showSuccess(`Took a ${breakDuration}-minute Flow Break!`);
        setShowEarlyCompletionModal(false);
        setEarlyCompletionDbTask(null);
      } else if (action === 'startNext') {
        if (!nextItemToday) {
          showError("No next task available to start early.");
          return;
        }
        
        const originalNextTask = dbScheduledTasks.find(t => t.id === nextItemToday.id);
        if (!originalNextTask) {
            showError("Error: Could not find original task details for next item.");
            return;
        }

        const originalNextTaskStartTime = originalNextTask.start_time ? parseISO(originalNextTask.start_time) : nextItemToday.startTime;
        const isNextTaskImmovable = !originalNextTask.is_flexible || originalNextTask.is_locked;
        const remainingMins = differenceInMinutes(originalNextTaskStartTime, T_current);
        
        if (task.is_flexible) {
          await removeScheduledTask(task.id);
        } else {
          await updateScheduledTaskStatus({ taskId: task.id, isCompleted: true });
        }

        if (isNextTaskImmovable) {
          if (remainingMins > 0) {
            const gapStart = T_current;
            const gapEnd = originalNextTaskStartTime;
            
            const filled = await handleSinkFill(gapStart, gapEnd, remainingMins);

            if (filled) {
              showSuccess(`Task completed! Fixed appointment protected. Filled ${remainingMins} min gap from Aether Sink.`);
            } else {
              showSuccess(`Task completed! Fixed appointment protected. ${remainingMins} min free time created before next fixed task.`);
            }
          } else {
            showSuccess(`Task completed! Next task starts immediately.`);
          }
          
          setIsFocusModeActive(false);

        } else {
          
          const newNextTaskStartTime = T_current;
          const nextTaskDuration = differenceInMinutes(nextItemToday.endTime, nextItemToday.startTime);
          const newNextTaskEndTime = addMinutes(newNextTaskStartTime, nextTaskDuration);

          await updateScheduledTaskDetails({
            id: nextItemToday.id,
            start_time: newNextTaskStartTime.toISOString(),
            end_time: newNextTaskEndTime.toISOString(),
            is_flexible: originalNextTask.is_flexible, 
            is_locked: originalNextTask.is_locked,     
            task_environment: originalNextTask.task_environment, // NEW: Preserve environment
          });

          await handleCompactSchedule(); // FIX 3: Call the defined handleCompactSchedule

          showSuccess(`Started "${nextItemToday.name}" early! Schedule compacted.`);
        }

        setShowEarlyCompletionModal(false);
        setEarlyCompletionDbTask(null);
      } else if (action === 'justFinish') { // NEW: Handle 'justFinish' action
        await completeScheduledTaskMutation(task);
        if (task.is_flexible) {
          await removeScheduledTask(task.id);
        } else {
          await updateScheduledTaskStatus({ taskId: task.id, isCompleted: true });
        }
        showSuccess(`Task "${task.name}" completed! Remaining time is now free.`);
        setShowEarlyCompletionModal(false);
        setIsFocusModeActive(false); // Ensure focus mode is exited
      } else if (action === 'exitFocus') {
        setIsFocusModeActive(false);
        showSuccess("Exited focus mode.");
      }

      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
    } catch (error: any) {
      if (modalOpened) {
        setShowEarlyCompletionModal(false);
        setEarlyCompletionDbTask(null);
      }
      if (error.message !== "Insufficient energy.") {
        showError(`Failed to perform action: ${error.message}`);
        console.error("Scheduler action error:", error);
      }
    } finally {
      if (!modalOpened) {
        setIsProcessingCommand(false);
      }
    }
  }, [user, T_current, formattedSelectedDay, nextItemToday, completeScheduledTaskMutation, removeScheduledTask, updateScheduledTaskStatus, addScheduledTask, handleManualRetire, updateScheduledTaskDetails, handleCompactSchedule, queryClient, currentSchedule, dbScheduledTasks, handleSinkFill, setIsFocusModeActive, selectedDayAsDate, workdayStartTime, workdayEndTime, effectiveWorkdayStart, environmentForPlacement]); // FIX 4: Added handleCompactSchedule to dependencies

  // NEW: Calculate tasks completed today and XP earned today for the recap card
  const tasksCompletedForSelectedDay = useMemo(() => {
    if (!completedTasksForSelectedDayList) return 0;
    return completedTasksForSelectedDayList.length;
  }, [completedTasksForSelectedDayList]);

  const xpEarnedForSelectedDay = useMemo(() => {
    if (!completedTasksForSelectedDayList) return 0;
    return completedTasksForSelectedDayList.reduce((sum, task) => sum + (task.energy_cost * 2), 0);
  }, [completedTasksForSelectedDayList]);

  const criticalTasksCompletedForSelectedDay = useMemo(() => {
    if (!completedTasksForSelectedDayList) return 0;
    return completedTasksForSelectedDayList.filter(task => 
      task.is_critical && task.is_completed
    ).length;
  }, [completedTasksForSelectedDayList]);

  // NEW: Filter completed scheduled tasks for the selected day
  const completedScheduledTasksForRecap = useMemo(() => {
    return completedTasksForSelectedDayList; // Use the new combined list
  }, [completedTasksForSelectedDayList]);


  const overallLoading = isSessionLoading || isSchedulerTasksLoading || isProcessingCommand || isLoadingRetiredTasks || isLoadingCompletedTasksForSelectedDay;

  const hasFlexibleTasksOnCurrentDay = dbScheduledTasks.some(item => item.is_flexible && !item.is_locked);

  return (
    <div className="container mx-auto p-4 max-w-4xl space-y-6">
      <h1 className="text-3xl font-bold text-foreground flex items-center gap-2 animate-slide-in-up">
        <Clock className="h-7 w-7 text-primary" /> Vibe Scheduler
      </h1>

      {isFocusModeActive && activeItemToday && activeItemToday.id && currentSchedule?.dbTasks.find(t => t.id === activeItemToday.id) ? (
        <ImmersiveFocusMode
          activeItem={activeItemToday}
          T_current={T_current}
          onExit={() => handleSchedulerAction('exitFocus', currentSchedule?.dbTasks.find(t => t.id === activeItemToday.id)!)}
          onAction={handleSchedulerAction}
          dbTask={currentSchedule?.dbTasks.find(t => t.id === activeItemToday.id) || null}
          nextItem={nextItemToday} 
          isProcessingCommand={isProcessingCommand} 
        />
      ) : (
        <>
          <SchedulerDashboardPanel 
            scheduleSummary={currentSchedule?.summary || null} 
            onAetherDump={handleAetherDumpButton}
            isProcessingCommand={isProcessingCommand}
            hasFlexibleTasks={hasFlexibleTasksOnCurrentDay}
            onRefreshSchedule={handleRefreshSchedule}
          />

          <CalendarStrip 
            selectedDay={selectedDay} 
            setSelectedDay={setSelectedDay} 
            datesWithTasks={datesWithTasks} 
            isLoadingDatesWithTasks={isLoadingDatesWithTasks}
          />

          <Card className="animate-pop-in animate-hover-lift">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="flex items-center gap-2 text-xl">
                <ListTodo className="h-5 w-5 text-primary" /> Schedule Your Day
              </CardTitle>
              <div className="flex items-center gap-3">
                {/* EnvironmentToggle REMOVED */}
                <p className="text-sm text-muted-foreground hidden sm:block">
                  Current Time: <span className="font-semibold">{formatDateTime(T_current)}</span>
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* NEW: Environment Multi-Select Placement */}
              <EnvironmentMultiSelect /> 
              <WeatherWidget />
              <SchedulerInput 
                onCommand={handleCommand} 
                isLoading={overallLoading} 
                inputValue={inputValue}
                setInputValue={setInputValue}
                placeholder={`Add task (e.g., 'Gym 60', 'Meeting 11am-12pm' [fixed by time]) or command (e.g., 'inject "Project X" 30', 'remove "Gym"', 'clear', 'compact', 'aether dump', 'aether dump mega')`}
                onDetailedInject={handleAddTaskClick}
              />
              <p className="text-xs text-muted-foreground">
                Examples: "Gym 60", "Meeting 11am-12pm", 'inject "Project X" 30', 'remove "Gym"', 'clear', 'compact', "Clean the sink 30 sink", "Time Off 2pm-3pm", "Aether Dump", "Aether Dump Mega"
              </p>
            </CardContent>
          </Card>

          <SchedulerUtilityBar 
            isProcessingCommand={isProcessingCommand}
            hasFlexibleTasksOnCurrentDay={hasFlexibleTasksOnCurrentDay}
            dbScheduledTasks={dbScheduledTasks}
            onRechargeEnergy={() => rechargeEnergy()}
            onRandomizeBreaks={handleRandomizeBreaks}
            onSortFlexibleTasks={handleSortFlexibleTasks} // FIX 5: Use defined handler
            onOpenWorkdayWindowDialog={() => setShowWorkdayWindowDialog(true)}
            sortBy={sortBy}
            onCompactSchedule={handleCompactSchedule} // FIX 6: Use defined handler
            onQuickScheduleBlock={handleQuickScheduleBlock}
            retiredTasksCount={retiredTasks.length}
            onZoneFocus={handleZoneFocus} // NEW: Pass handler
          />

          {isSameDay(parseISO(selectedDay), T_current) && (
            <div className="pb-4 animate-slide-in-up">
              <NowFocusCard 
                activeItem={activeItemToday} 
                nextItem={nextItemToday} 
                T_current={T_current} 
                onEnterFocusMode={() => setIsFocusModeActive(true)}
              />
            </div>
          )}
          
          {currentSchedule?.summary.unscheduledCount > 0 && (
            <Card className="animate-pop-in animate-hover-lift">
              <CardContent className="p-4 text-center text-orange-500 font-semibold flex items-center justify-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                <span>⚠️ {currentSchedule.summary.unscheduledCount} task{currentSchedule.summary.unscheduledCount > 1 ? 's' : ''} fall outside your workday window.</span>
              </CardContent>
            </Card>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
            <TabsList className="grid w-full grid-cols-3 h-10 p-1 bg-muted rounded-md">
              <TabsTrigger 
                value="vibe-schedule" 
                className="h-9 px-4 py-2 text-sm font-medium rounded-md text-muted-foreground hover:bg-muted/50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md animate-hover-lift"
              >
                <Sparkles className="h-4 w-4 mr-2 text-logo-yellow" /> Your Vibe Schedule
              </TabsTrigger>
              <TabsTrigger 
                value="aether-sink" 
                className="h-9 px-4 py-2 text-sm font-medium rounded-md text-muted-foreground hover:bg-muted/50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[data-state=active]:shadow-md animate-hover-lift"
              >
                <Trash2 className="h-4 w-4 mr-2 text-muted-foreground" /> The Aether Sink ({retiredTasks.length})
              </TabsTrigger>
              <TabsTrigger 
                value="daily-recap" 
                className="h-9 px-4 py-2 text-sm font-medium rounded-md text-muted-foreground hover:bg-muted/50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[data-state=active]:shadow-md animate-hover-lift"
              >
                <Sparkles className="h-4 w-4 mr-2 text-logo-yellow" /> Daily Vibe Recap
              </TabsTrigger>
            </TabsList>

            <TabsContent value="vibe-schedule" className="space-y-4">
              <Card className="animate-pop-in animate-hover-lift">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Sparkles className="h-5 w-5 text-logo-yellow" /> Your Vibe Schedule for {format(parseISO(selectedDay), 'EEEE, MMMM d')}
                  </CardTitle>
                </CardHeader>
                <CardContent ref={scheduleContainerRef}>
                  {isSchedulerTasksLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : (
                    <SchedulerDisplay 
                      schedule={currentSchedule} 
                      T_current={T_current} 
                      onRemoveTask={(taskId) => handleSchedulerAction('skip', dbScheduledTasks.find(t => t.id === taskId)!)}
                      onRetireTask={(task) => handleSchedulerAction('skip', task)}
                      onCompleteTask={(task) => handleSchedulerAction('complete', task, false)}
                      activeItemId={activeItemToday?.id || null} 
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
                profileEnergy={profile?.energy || 0}
                retiredSortBy={retiredSortBy} 
                setRetiredSortBy={setRetiredSortBy} 
              />
            </TabsContent>

            <TabsContent value="daily-recap" className="space-y-4">
              <DailyVibeRecapCard
                scheduleSummary={currentSchedule?.summary || null}
                tasksCompletedToday={tasksCompletedForSelectedDay} // NEW: Use tasksCompletedForSelectedDay
                xpEarnedToday={xpEarnedForSelectedDay} // NEW: Use xpEarnedForSelectedDay
                profileEnergy={profile?.energy || 0}
                criticalTasksCompletedToday={criticalTasksCompletedForSelectedDay} // NEW: Use criticalTasksCompletedForSelectedDay
                selectedDayString={selectedDay}
                completedScheduledTasks={completedScheduledTasksForRecap} /* NEW: Pass completed tasks */
              />
            </TabsContent>
          </Tabs>
        </>
      )}

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

      <EarlyCompletionModal
        isOpen={showEarlyCompletionModal}
        onOpenChange={(open) => {
          if (!open && !isProcessingCommand) {
            setShowEarlyCompletionModal(false);
            setEarlyCompletionDbTask(null);
          }
        }}
        taskName={earlyCompletionTaskName}
        remainingDurationMinutes={earlyCompletionRemainingMinutes}
        onTakeBreak={() => handleSchedulerAction('takeBreak', earlyCompletionDbTask!, true, earlyCompletionRemainingMinutes)}
        onStartNextTask={() => handleSchedulerAction('startNext', earlyCompletionDbTask!, true)}
        onJustFinish={() => handleSchedulerAction('justFinish', earlyCompletionDbTask!, true)} // NEW: Pass 'justFinish' handler
        isProcessingCommand={isProcessingCommand}
        hasNextTask={!!nextItemToday}
      />
    </div>
  );
};

export default SchedulerPage;