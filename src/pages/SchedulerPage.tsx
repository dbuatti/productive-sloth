import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, ListTodo, Sparkles, Loader2, AlertTriangle, Trash2, ChevronsUp, Star, ArrowDownWideNarrow, ArrowUpWideNarrow, Shuffle, CalendarOff, RefreshCcw, Globe, Zap, Settings2, Menu } from 'lucide-react';
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
import SchedulerUtilityBar from '@/components/SchedulerUtilityBar';
import WorkdayWindowDialog from '@/components/WorkdayWindowDialog';
import ScheduledTaskDetailDialog from '@/components/ScheduledTaskDetailDialog';
import ImmersiveFocusMode from '@/components/ImmersiveFocusMode';
import EarlyCompletionModal from '@/components/EarlyCompletionModal';
import DailyVibeRecapCard from '@/components/DailyVibeRecapCard';
import { LOW_ENERGY_THRESHOLD, MAX_ENERGY } from '@/lib/constants';
import EnvironmentMultiSelect from '@/components/EnvironmentMultiSelect';
import { useEnvironmentContext } from '@/hooks/use-environment-context';
import EnergyDeficitConfirmationDialog from '@/components/EnergyDeficitConfirmationDialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import SchedulerSegmentedControl from '@/components/SchedulerSegmentedControl'; // NEW IMPORT

// Helper to get initial state from localStorage
const getInitialSelectedDay = () => {
  if (typeof window !== 'undefined') {
    const savedDay = localStorage.getItem('aetherflow-selected-day');
    if (savedDay && !isNaN(parseISO(savedDay).getTime())) {
      return savedDay;
    }
  }
  return format(new Date(), 'yyyy-MM-dd');
};

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
  taskEnvironment?: TaskEnvironment;
}

interface SchedulerPageProps {
  view: 'schedule' | 'sink' | 'recap';
}

const SchedulerPage: React.FC<SchedulerPageProps> = ({ view }) => {
  const { user, profile, isLoading: isSessionLoading, rechargeEnergy, T_current, activeItemToday, nextItemToday } = useSession();
  const { selectedEnvironments } = useEnvironmentContext();
  const environmentForPlacement = selectedEnvironments[0] || 'laptop';
  
  // NEW: Initialize selectedDay from localStorage
  const [selectedDay, setSelectedDay] = useState<string>(getInitialSelectedDay());
  
  const scheduleContainerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

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
    completedTasksForSelectedDayList,
    isLoadingCompletedTasksForSelectedDay,
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
    removeRetiredTask,
  } = useSchedulerTasks(selectedDay, scheduleContainerRef);

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
  
  const [showWorkdayWindowDialog, setShowWorkdayWindowDialog] = useState(false);
  const [isFocusModeActive, setIsFocusModeActive] = useState(false);

  const [showEarlyCompletionModal, setShowEarlyCompletionModal] = useState(false);
  const [earlyCompletionTaskName, setEarlyCompletionTaskName] = useState('');
  const [earlyCompletionRemainingMinutes, setEarlyCompletionRemainingMinutes] = useState(0);
  const [earlyCompletionDbTask, setEarlyCompletionDbTask] = useState<DBScheduledTask | null>(null);

  // State for scheduled task permanent deletion confirmation
  const [showDeleteScheduledTaskConfirmation, setShowDeleteScheduledTaskConfirmation] = useState(false);
  const [scheduledTaskToDeleteId, setScheduledTaskToDeleteId] = useState<string | null>(null);
  const [scheduledTaskToDeleteName, setScheduledTaskToDeleteName] = useState<string | null>(null);
  const [scheduledTaskToDeleteIndex, setScheduledTaskToDeleteIndex] = useState<number | null>(null);

  // State for retired task permanent deletion confirmation
  const [showDeleteRetiredTaskConfirmation, setShowDeleteRetiredTaskConfirmation] = useState(false);
  const [retiredTaskToDeleteId, setRetiredTaskToDeleteId] = useState<string | null>(null);
  const [retiredTaskToDeleteName, setRetiredTaskToDeleteName] = useState<string | null>(null);

  // NEW: State for energy deficit confirmation
  const [showEnergyDeficitConfirmation, setShowEnergyDeficitConfirmation] = useState(false);
  const [taskToCompleteInDeficit, setTaskToCompleteInDeficit] = useState<DBScheduledTask | null>(null);
  const [taskToCompleteInDeficitIndex, setTaskToCompleteInDeficitIndex] = useState<number | null>(null);

  // NEW: Persistence effects
  useEffect(() => {
    localStorage.setItem('aetherflow-selected-day', selectedDay);
  }, [selectedDay]);


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
        taskEnvironment: environmentForPlacement,
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

  const handleScrollToItem = useCallback((itemId: string) => {
    const element = document.getElementById(`scheduled-item-${itemId}`);
    if (element && scheduleContainerRef.current) {
      const containerRect = scheduleContainerRef.current.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      // Calculate scroll offset to bring the element into view,
      // ideally centered or near the top, but not completely at the top.
      const scrollOffset = elementRect.top - containerRect.top - containerRect.height / 4; 
      scheduleContainerRef.current.scrollBy({ top: scrollOffset, behavior: 'smooth' });
    }
  }, []);

  // New handler for permanent deletion of scheduled tasks
  const handlePermanentDeleteScheduledTask = useCallback((taskId: string, taskName: string, index: number) => {
    setScheduledTaskToDeleteId(taskId);
    setScheduledTaskToDeleteName(taskName);
    setScheduledTaskToDeleteIndex(index);
    setShowDeleteScheduledTaskConfirmation(true);
  }, []);

  // New handler for permanent deletion of retired tasks
  const handlePermanentDeleteRetiredTask = useCallback((taskId: string, taskName: string) => {
    setRetiredTaskToDeleteId(taskId);
    setRetiredTaskToDeleteName(taskName);
    setShowDeleteRetiredTaskConfirmation(true);
  }, []);

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
      queryClient.invalidateQueries({ queryKey: ['completedTasksForSelectedDayList', user.id, formattedSelectedDay] });
      showSuccess("Schedule data refreshed.");
    }
  };

  const handleQuickScheduleBlock = async (duration: number, sortPreference: 'longestFirst' | 'shortestFirst') => {
    if (!user || !profile) {
      showError("Please log in and ensure your profile is loaded to quick schedule.");
      return;
    }
    setIsProcessingCommand(true);

    try {
      // 1. Get eligible tasks from Aether Sink
      const eligibleSinkTasks = retiredTasks
        .filter(task => !task.is_locked && !task.is_completed)
        .map(task => ({
          ...task,
          // Ensure duration is a number for sorting, default to 30 if null
          effectiveDuration: task.duration || 30,
        }))
        .filter(task => task.effectiveDuration <= duration); // Only consider tasks that fit within the block duration

      if (eligibleSinkTasks.length === 0) {
        // Fallback to creating a generic Focus Block if no eligible tasks in sink
        const taskName = `Focus Block (${duration} min)`;
        const energyCost = calculateEnergyCost(duration, false);
        const { proposedStartTime, proposedEndTime, message } = await findFreeSlotForTask(
          taskName,
          duration,
          false, // isCritical
          true,  // isFlexible
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
            task_environment: environmentForPlacement,
          });
          showSuccess(`Quick Scheduled a generic ${duration} min focus block.`);
          queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
        } else {
          showError(message);
        }
        setIsProcessingCommand(false);
        return;
      }

      // 2. Sort tasks based on sortPreference
      eligibleSinkTasks.sort((a, b) => {
        if (sortPreference === 'shortestFirst') {
          return a.effectiveDuration - b.effectiveDuration;
        } else { // 'longestFirst'
          return b.effectiveDuration - a.effectiveDuration;
        }
      });

      // 3. Select the top task
      const taskToSchedule = eligibleSinkTasks[0];
      const taskDuration = taskToSchedule.effectiveDuration;
      const energyCost = taskToSchedule.energy_cost; // Use task's actual energy cost

      // 4. Find a free slot for the selected task
      const { proposedStartTime, proposedEndTime, message } = await findFreeSlotForTask(
        taskToSchedule.name,
        taskDuration,
        taskToSchedule.is_critical,
        true, // Quick scheduled tasks are flexible by default
        energyCost,
        occupiedBlocks,
        effectiveWorkdayStart,
        workdayEndTime
      );

      if (proposedStartTime && proposedEndTime) {
        // 5. Add the selected task to scheduled_tasks
        await addScheduledTask({
          name: taskToSchedule.name,
          start_time: proposedStartTime.toISOString(),
          end_time: proposedEndTime.toISOString(),
          break_duration: taskToSchedule.break_duration,
          scheduled_date: formattedSelectedDay,
          is_critical: taskToSchedule.is_critical,
          is_flexible: true, // Quick scheduled tasks are flexible by default
          is_locked: false,
          energy_cost: energyCost,
          is_custom_energy_cost: taskToSchedule.is_custom_energy_cost,
          task_environment: taskToSchedule.task_environment,
        });
        showSuccess(`Quick Scheduled "${taskToSchedule.name}" for ${taskDuration} min.`);
        queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });

        // 6. Remove the task from Aether Sink
        await rezoneTask(taskToSchedule.id); // rezoneTask actually deletes from aethersink
      } else {
        showError(message);
      }
    } catch (error: any) {
      showError(`Failed to quick schedule: ${error.message}`);
    } finally {
      setIsProcessingCommand(false);
    }
  };

  const handleCompactSchedule = useCallback(async () => {
    if (!user || !profile) {
        showError("Please log in and ensure your profile is loaded to compact the schedule.");
        return;
    }
    // Use the current dbScheduledTasks from the query cache directly
    const currentDbTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', user.id, formattedSelectedDay, sortBy]) || [];

    if (!currentDbTasks.some(task => task.is_flexible && !task.is_locked)) {
        showSuccess("No flexible tasks to compact.");
        return;
    }

    setIsProcessingCommand(true);
    try {
        const compactedTasks = compactScheduleLogic(
            currentDbTasks, // Pass the current tasks
            selectedDayAsDate,
            workdayStartTime,
            workdayEndTime,
            T_current
        );

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
  }, [user, profile, selectedDayAsDate, workdayStartTime, workdayEndTime, T_current, compactScheduledTasks, queryClient, formattedSelectedDay, sortBy]);

  const confirmPermanentDeleteScheduledTask = useCallback(async () => {
    if (!scheduledTaskToDeleteId || !user || scheduledTaskToDeleteIndex === null) return;
    setIsProcessingCommand(true);
    try {
      // Perform deletion first
      await removeScheduledTask(scheduledTaskToDeleteId);
      showSuccess(`Task "${scheduledTaskToDeleteName}" permanently deleted.`);

      // Then attempt compaction
      try {
        // Fetch the *latest* scheduled tasks after deletion for compaction
        const latestDbScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', user.id, formattedSelectedDay, sortBy]) || [];
        const compactedTasks = compactScheduleLogic(
            latestDbScheduledTasks,
            selectedDayAsDate,
            workdayStartTime,
            workdayEndTime,
            T_current
        );
        const tasksToUpdate = compactedTasks.filter(task => task.start_time && task.end_time);

        if (tasksToUpdate.length > 0) {
            await compactScheduledTasks({ tasksToUpdate });
            showSuccess("Schedule compacted after deletion.");
        } else {
            showSuccess("No flexible tasks to compact after deletion.");
        }
      } catch (compactionError: any) {
        showError(`Failed to compact schedule after deletion: ${compactionError.message}`);
        console.error("Compaction after deletion error:", compactionError);
      }

      // Scroll to the next item if it exists
      if (currentSchedule?.items && scheduledTaskToDeleteIndex < currentSchedule.items.length) {
        const nextItemId = currentSchedule.items[scheduledTaskToDeleteIndex].id;
        if (nextItemId) {
          handleScrollToItem(nextItemId);
        }
      } else if (currentSchedule?.items && scheduledTaskToDeleteIndex > 0) {
        // If the last item was deleted, scroll to the previous one
        const prevItemId = currentSchedule.items[scheduledTaskToDeleteIndex - 1].id;
        if (prevItemId) {
          handleScrollToItem(prevItemId);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
    } catch (error: any) {
      showError(`Failed to delete task: ${error.message}`);
      console.error("Permanent delete scheduled task error:", error);
    } finally {
      setIsProcessingCommand(false);
      setShowDeleteScheduledTaskConfirmation(false);
      setScheduledTaskToDeleteId(null);
      setScheduledTaskToDeleteName(null);
      setScheduledTaskToDeleteIndex(null);
    }
  }, [scheduledTaskToDeleteId, scheduledTaskToDeleteName, scheduledTaskToDeleteIndex, user, removeScheduledTask, handleCompactSchedule, currentSchedule?.items, queryClient, handleScrollToItem, formattedSelectedDay, sortBy, selectedDayAsDate, workdayStartTime, workdayEndTime, T_current, compactScheduledTasks]);

  // Confirmation handler for retired task permanent deletion
  const confirmPermanentDeleteRetiredTask = useCallback(async () => {
    if (!retiredTaskToDeleteId || !user) return;
    setIsProcessingCommand(true);
    try {
      await removeRetiredTask(retiredTaskToDeleteId);
      showSuccess(`Retired task "${retiredTaskToDeleteName}" permanently deleted.`);
    } catch (error: any) {
      showError(`Failed to delete retired task: ${error.message}`);
      console.error("Permanent delete retired task error:", error);
    } finally {
      setIsProcessingCommand(false);
      setShowDeleteRetiredTaskConfirmation(false);
      setRetiredTaskToDeleteId(null);
      setRetiredTaskToDeleteName(null);
    }
  }, [retiredTaskToDeleteId, retiredTaskToDeleteName, user, removeRetiredTask]);

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
            // Ensure duration is a number for sorting, default to 30 if null
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
          task_environment: taskToPlace.task_environment,
        });
        // Declare currentOccupiedBlocksForScheduling locally within this function
        let currentOccupiedBlocksForScheduling = [...occupiedBlocks];
        currentOccupiedBlocksForScheduling.push({ start: proposedStartTime, end: proposedEndTime, duration: taskDuration });
        currentOccupiedBlocksForScheduling = mergeOverlappingTimeBlocks(currentOccupiedBlocksForScheduling);

        return true;
    } catch (error: any) {
        showError(`Failed to fill gap with sink task: ${error.message}`);
        console.error("Sink Fill Error:", error);
        return false;
    }
  }, [user, profile, retiredTasks, rezoneTask, addScheduledTask, formattedSelectedDay, occupiedBlocks, effectiveWorkdayStart, workdayEndTime]);

  // NEW: Generic auto-schedule and sort function
  const handleAutoScheduleAndSort = useCallback(async (
    sortPreference: SortBy,
    taskSource: 'all-flexible' | 'sink-only',
    environmentsToFilterBy: TaskEnvironment[] = []
  ) => {
    if (!user || !profile) {
      showError("Please log in and ensure your profile is loaded to auto-schedule.");
      return;
    }

    const today = startOfDay(new Date());
    if (isBefore(selectedDayAsDate, today)) {
      showError("Cannot auto-schedule for a past day. Please select today or a future day.");
      return;
    }

    setIsProcessingCommand(true);
    console.log(`handleAutoScheduleAndSort: Starting with sort: ${sortPreference}, source: ${taskSource}, environments: ${environmentsToFilterBy.join(', ')}`);

    try {
      const existingFixedTasks = dbScheduledTasks.filter(task => !task.is_flexible || task.is_locked);
      const flexibleScheduledTasks = dbScheduledTasks.filter(task => task.is_flexible && !task.is_locked);
      const unlockedRetiredTasks = retiredTasks.filter(task => !task.is_locked);

      const unifiedPool: UnifiedTask[] = [];
      const scheduledTaskIdsToDelete: string[] = [];
      const retiredTaskIdsToDelete: string[] = [];
      const tasksToInsert: NewDBScheduledTask[] = [];
      const tasksToKeepInSink: NewRetiredTask[] = []; // Tasks that couldn't be placed

      // Add existing fixed tasks to tasksToInsert (they are not moved)
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

      // --- CRITICAL FIX: Auto-retire past-due, uncompleted, flexible scheduled tasks ---
      // This prevents tasks that should have already started/finished from being rescheduled.
      const pastDueScheduledTasks = flexibleScheduledTasks.filter(task => {
          if (!task.start_time || task.is_completed) return false;
          
          const taskStartTime = parseISO(task.start_time);
          // Check if the task's start time is before T_current AND it's today's schedule
          return isSameDay(selectedDayAsDate, T_current) && isBefore(taskStartTime, T_current);
      });

      pastDueScheduledTasks.forEach(task => {
          if (!scheduledTaskIdsToDelete.includes(task.id)) {
              scheduledTaskIdsToDelete.push(task.id);
              tasksToKeepInSink.push({
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
      // ---------------------------------------------------------------------------------

      // Filter flexibleScheduledTasks to exclude those already marked for retirement
      const currentFlexibleScheduledTasks = flexibleScheduledTasks.filter(task => !scheduledTaskIdsToDelete.includes(task.id));


      // Collect tasks based on taskSource (now using currentFlexibleScheduledTasks)
      if (taskSource === 'all-flexible') {
        currentFlexibleScheduledTasks.forEach(task => { // <-- Use filtered list
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
      }

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

      // Apply environment filtering if specified
      const tasksToConsider = unifiedPool.filter(task => {
        if (environmentsToFilterBy.length === 0) {
          return true; // No filter, consider all
        }
        return environmentsToFilterBy.includes(task.task_environment);
      });

      // Sort the tasksToConsider based on sortPreference
      let sortedTasks = [...tasksToConsider].sort((a, b) => {
        // Primary sort: Critical tasks first
        if (a.is_critical && !b.is_critical) return -1;
        if (!a.is_critical && b.is_critical) return 1;

        switch (sortPreference) {
          case 'TIME_EARLIEST_TO_LATEST': // Changed from DURATION_ASC
            return (a.duration || 0) - (b.duration || 0);
          case 'TIME_LATEST_TO_EARLIEST': // Changed from DURATION_DESC
            return (b.duration || 0) - (a.duration || 0);
          case 'PRIORITY_HIGH_TO_LOW':
            // Assuming higher energy cost implies higher priority if not critical
            return (b.energy_cost || 0) - (a.energy_cost || 0);
          case 'PRIORITY_LOW_TO_HIGH':
            return (a.energy_cost || 0) - (b.energy_cost || 0);
          case 'NAME_ASC':
            return a.name.localeCompare(b.name);
          case 'NAME_DESC':
            return b.name.localeCompare(a.name);
          case 'EMOJI':
            const hueA = getEmojiHue(a.name);
            const hueB = getEmojiHue(b.name);
            return hueA - hueB;
          default:
            // Default to oldest first if no specific sort or for tie-breaking
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
      });

      let currentOccupiedBlocks = mergeOverlappingTimeBlocks(existingFixedTasks
        .filter(task => task.start_time && task.end_time)
        .map(task => {
          const start = setTimeOnDate(selectedDayAsDate, format(parseISO(task.start_time!), 'HH:mm'));
          let end = setTimeOnDate(selectedDayAsDate, format(parseISO(task.end_time!), 'HH:mm'));
          if (isBefore(end, start)) end = addDays(end, 1);
          return { start, end, duration: differenceInMinutes(end, start) };
        })
      );

      let currentPlacementTime = effectiveWorkdayStart;

      for (const task of sortedTasks) {
        let placed = false;
        let searchTime = currentPlacementTime;

        // Critical tasks with low energy are sent to sink
        if (task.is_critical && profile.energy < LOW_ENERGY_THRESHOLD) {
          if (task.source === 'scheduled') {
            tasksToKeepInSink.push({
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
          } else if (task.source === 'retired') {
            // If it's already in sink, it stays in sink (no action needed for tasksToKeepInSink)
            // But we need to ensure it's not deleted from sink if it was considered for placement
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
          if (task.source === 'scheduled') {
            tasksToKeepInSink.push({
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

      // Any flexible scheduled tasks that were NOT considered for placement (due to environment filter)
      // or were considered but not placed, should be moved to the sink.
      flexibleScheduledTasks.forEach(task => {
        const isConsidered = tasksToConsider.some(t => t.originalId === task.id && t.source === 'scheduled');
        const isPlaced = tasksToInsert.some(t => t.id === task.id);

        if (!isConsidered || (isConsidered && !isPlaced)) {
          if (!scheduledTaskIdsToDelete.includes(task.id)) {
            scheduledTaskIdsToDelete.push(task.id);
            tasksToKeepInSink.push({
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
        }
      });

      // Filter out duplicates from scheduledTaskIdsToDelete and retiredTaskIdsToDelete
      const uniqueScheduledTaskIdsToDelete = Array.from(new Set(scheduledTaskIdsToDelete));
      const uniqueRetiredTaskIdsToDelete = Array.from(new Set(retiredTaskIdsToDelete));

      const payload: AutoBalancePayload = {
        scheduledTaskIdsToDelete: uniqueScheduledTaskIdsToDelete,
        retiredTaskIdsToDelete: uniqueRetiredTaskIdsToDelete,
        tasksToInsert: tasksToInsert,
        tasksToKeepInSink: tasksToKeepInSink,
        selectedDate: formattedSelectedDay,
      };

      console.log("handleAutoScheduleAndSort: Final payload for autoBalanceSchedule mutation:", {
        scheduledTaskIdsToDelete: payload.scheduledTaskIdsToDelete,
        retiredTaskIdsToDelete: payload.retiredTaskIdsToDelete,
        tasksToInsert: payload.tasksToInsert.map(t => ({ id: t.id, name: t.name, is_flexible: t.is_flexible, is_locked: t.is_locked })),
        tasksToKeepInSink: payload.tasksToKeepInSink.map(t => ({ name: t.name })),
        selectedDate: payload.selectedDate,
      });

      await autoBalanceSchedule(payload);
      showSuccess("Schedule re-balanced!");
      setSortBy('TIME_EARLIEST_TO_LATEST');
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
      setIsProcessingCommand(false);
    } catch (error: any) {
      showError(`Failed to auto-schedule: ${error.message}`);
      console.error("Auto-schedule error:", error);
    } finally {
      setIsProcessingCommand(false);
      console.log("handleAutoScheduleAndSort: Auto-schedule process finished.");
    }
  }, [user, profile, dbScheduledTasks, retiredTasks, selectedDayAsDate, formattedSelectedDay, effectiveWorkdayStart, workdayEndTime, autoBalanceSchedule, queryClient, LOW_ENERGY_THRESHOLD, sortBy]);

  const handleSortFlexibleTasks = useCallback(async (newSortBy: SortBy) => {
    if (!user || !profile) {
      showError("Please log in and ensure your profile is loaded to sort tasks.");
      return;
    }

    // If schedule is empty, treat it as a sink-only auto-schedule
    if (dbScheduledTasks.length === 0) {
      await handleAutoScheduleAndSort(newSortBy, 'sink-only');
    } else {
      // If schedule is not empty, re-balance existing flexible tasks and potentially pull from sink
      await handleAutoScheduleAndSort(newSortBy, 'all-flexible');
    }
  }, [user, profile, dbScheduledTasks.length, handleAutoScheduleAndSort]);

  const handleZoneFocus = useCallback(async () => {
    if (!user || !profile) {
      showError("Please log in and ensure your profile is loaded to use Zone Focus.");
      return;
    }
    // Pass selectedEnvironments to filter by
    await handleAutoScheduleAndSort('PRIORITY_HIGH_TO_LOW', 'all-flexible', selectedEnvironments);
  }, [user, profile, selectedEnvironments, handleAutoScheduleAndSort]);

  const handleAutoScheduleSinkWrapper = useCallback(async () => {
    if (!user || !profile) {
      showError("Please log in and ensure your profile is loaded to auto-schedule.");
      return;
    }
    // Auto-schedule from sink, default sort by priority high to low
    await handleAutoScheduleAndSort('PRIORITY_HIGH_TO_LOW', 'sink-only');
  }, [user, profile, handleAutoScheduleAndSort]);

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
          task_environment: environmentForPlacement,
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
              task_environment: environmentForPlacement,
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
            task_environment: environmentForPlacement,
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
        const breakDuration = injectCommand.breakDuration;
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
            break_duration: breakDuration, 
            scheduled_date: taskScheduledDate,
            is_critical: injectCommand.isCritical,
            is_flexible: injectCommand.isFlexible,
            energy_cost: injectCommand.energyCost,
            is_custom_energy_cost: false,
            task_environment: environmentForPlacement,
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
          taskEnvironment: environmentForPlacement,
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
          taskEnvironment: environmentForPlacement,
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
              handlePermanentDeleteScheduledTask(taskToRemove.id, taskToRemove.name, command.index);
              success = true;
            } else {
              showError(`Invalid index. Please provide a number between 1 and ${dbScheduledTasks.length}.`);
            }
          } else if (command.target) {
            const tasksToRemove = dbScheduledTasks.filter(task => task.name.toLowerCase().includes(command.target!.toLowerCase()));
            if (tasksToRemove.length > 0) {
                const lockedTasksFound = tasksToRemove.filter(task => task.is_locked);
                if (lockedTasksFound.length > 0) {
                    showError(`Multiple tasks found matching "${command.target}". Please be more specific or use 'remove index X'.`);
                    setIsProcessingCommand(false);
                    return;
                }
                if (tasksToRemove.length > 1) {
                    showError(`Multiple tasks found matching "${command.target}". Please be more specific or use 'remove index X'.`);
                    setIsProcessingCommand(false);
                    return;
                }
                const taskIndex = dbScheduledTasks.findIndex(t => t.id === tasksToRemove[0].id);
                handlePermanentDeleteScheduledTask(tasksToRemove[0].id, tasksToRemove[0].name, taskIndex);
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
            taskEnvironment: 'away',
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
    if (!user || !profile) {
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
        task_environment: environmentForPlacement,
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
          task_environment: environmentForPlacement,
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
          task_environment: retiredTask.task_environment,
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
      taskEnvironment: environmentForPlacement,
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
      taskEnvironment: 'away',
    });
    setInjectionStartTime(format(T_current, 'h:mm a'));
    setInjectionEndTime(format(addHours(T_current, 1), 'h:mm a'));
    setInjectionDuration('');
    setInjectionBreak('');
    setInputValue('');
  };

  const handleSchedulerAction = useCallback(async (
    action: 'complete' | 'skip' | 'takeBreak' | 'startNext' | 'justFinish' | 'exitFocus',
    task: DBScheduledTask,
    isEarlyCompletion: boolean = false,
    remainingDurationMinutes: number = 0,
    index: number | null = null
  ) => {
    if (!user || !profile) {
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
        // NEW: Energy Deficit Check
        if (profile.energy < 0) {
          setTaskToCompleteInDeficit(task);
          setTaskToCompleteInDeficitIndex(index);
          setShowEnergyDeficitConfirmation(true);
          modalOpened = true;
          setIsFocusModeActive(false);
          setIsProcessingCommand(false);
          return;
        }

        const activeItem = currentSchedule?.items.find(item => item.id === task.id);
        
        const isCurrentlyActive = activeItem && isSameDay(activeItem.startTime, T_current) && T_current >= activeItem.startTime && T_current < activeItem.endTime;
        
        let shouldOpenEarlyCompletionModal = false;
        let remainingMins = 0;

        if (isCurrentlyActive) {
            remainingMins = activeItem ? differenceInMinutes(activeItem.endTime, T_current) : 0;
            if (remainingMins > 0) {
                shouldOpenEarlyCompletionModal = true;
            }
        }
        
        if (shouldOpenEarlyCompletionModal) {
            setEarlyCompletionTaskName(task.name);
            setEarlyCompletionRemainingMinutes(remainingMins);
            setEarlyCompletionDbTask(task);
            setShowEarlyCompletionModal(true);
            modalOpened = true;
            setIsFocusModeActive(false);
            setIsProcessingCommand(false); 
            return;
        } else {
            await completeScheduledTaskMutation(task);
            // After completion, if it was a flexible task, compact the schedule
            if (task.is_flexible) {
              const latestDbScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', user.id, formattedSelectedDay, sortBy]) || [];
              const compactedTasks = compactScheduleLogic(
                  latestDbScheduledTasks,
                  selectedDayAsDate,
                  workdayStartTime,
                  workdayEndTime,
                  T_current
              );
              const tasksToUpdate = compactedTasks.filter(t => t.start_time && t.end_time);
              if (tasksToUpdate.length > 0) {
                  await compactScheduledTasks({ tasksToUpdate });
                  showSuccess(`Task "${task.name}" completed! Schedule compacted.`);
              } else {
                  showSuccess(`Task "${task.name}" completed! No flexible tasks to compact.`);
              }
            } else {
              showSuccess(`Task "${task.name}" completed!`);
            }
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
          task_environment: environmentForPlacement,
        });

        // Mark the original task as completed and remove if flexible
        await completeScheduledTaskMutation(task);
        if (task.is_flexible) {
          // After completion, if it was a flexible task, compact the schedule
          const latestDbScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', user.id, formattedSelectedDay, sortBy]) || [];
          const compactedTasks = compactScheduleLogic(
              latestDbScheduledTasks,
              selectedDayAsDate,
              workdayStartTime,
              workdayEndTime,
              T_current
          );
          const tasksToUpdate = compactedTasks.filter(t => t.start_time && t.end_time);
          if (tasksToUpdate.length > 0) {
              await compactScheduledTasks({ tasksToUpdate });
          }
        }
        showSuccess(`Took a ${breakDuration}-minute Flow Break!`);
        setShowEarlyCompletionModal(false);
        setEarlyCompletionDbTask(null);
        setIsFocusModeActive(false);
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
        
        // Mark the current task as completed and remove if flexible
        await completeScheduledTaskMutation(task);
        if (task.is_flexible) {
          // After completion, if it was a flexible task, compact the schedule
          const latestDbScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', user.id, formattedSelectedDay, sortBy]) || [];
          const compactedTasks = compactScheduleLogic(
              latestDbScheduledTasks,
              selectedDayAsDate,
              workdayStartTime,
              workdayEndTime,
              T_current
          );
          const tasksToUpdate = compactedTasks.filter(t => t.start_time && t.end_time);
          if (tasksToUpdate.length > 0) {
              await compactScheduledTasks({ tasksToUpdate });
          }
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
            task_environment: originalNextTask.task_environment,
          });

          await handleCompactSchedule();

          showSuccess(`Started "${nextItemToday.name}" early! Schedule compacted.`);
        }

        setShowEarlyCompletionModal(false);
        setEarlyCompletionDbTask(null);
        setIsFocusModeActive(false);
      } else if (action === 'justFinish') {
        await completeScheduledTaskMutation(task);
        if (task.is_flexible) {
          // After completion, if it was a flexible task, compact the schedule
          const latestDbScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', user.id, formattedSelectedDay, sortBy]) || [];
          const compactedTasks = compactScheduleLogic(
              latestDbScheduledTasks,
              selectedDayAsDate,
              workdayStartTime,
              workdayEndTime,
              T_current
          );
          const tasksToUpdate = compactedTasks.filter(t => t.start_time && t.end_time);
          if (tasksToUpdate.length > 0) {
              await compactScheduledTasks({ tasksToUpdate });
              showSuccess(`Task "${task.name}" completed! Remaining time is now free. Schedule compacted.`);
          } else {
              showSuccess(`Task "${task.name}" completed! Remaining time is now free. No flexible tasks to compact.`);
          }
        } else {
          showSuccess(`Task "${task.name}" completed! Remaining time is now free.`);
        }
        setIsFocusModeActive(false);
      } else if (action === 'exitFocus') {
        setIsFocusModeActive(false);
        showSuccess("Exited focus mode.");
      }

      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
      // NEW: Scroll to the active item after any action that might change the schedule
      if (activeItemToday) {
        handleScrollToItem(activeItemToday.id);
      } else if (nextItemToday) {
        handleScrollToItem(nextItemToday.id);
      }
    } catch (error: any) {
      if (modalOpened) {
        setShowEarlyCompletionModal(false);
        setEarlyCompletionDbTask(null);
        setShowEnergyDeficitConfirmation(false);
        setTaskToCompleteInDeficit(null);
        setTaskToCompleteInDeficitIndex(null);
      }
      // Removed "Insufficient energy" specific error message as it's now handled by the dialog
      showError(`Failed to perform action: ${error.message}`);
      console.error("Scheduler action error:", error);
    } finally {
      if (!modalOpened) {
        setIsProcessingCommand(false);
      }
    }
  }, [user, profile, T_current, formattedSelectedDay, nextItemToday, completeScheduledTaskMutation, removeScheduledTask, updateScheduledTaskStatus, addScheduledTask, handleManualRetire, updateScheduledTaskDetails, handleCompactSchedule, queryClient, currentSchedule, dbScheduledTasks, handleSinkFill, setIsFocusModeActive, selectedDayAsDate, workdayStartTime, workdayEndTime, effectiveWorkdayStart, environmentForPlacement, activeItemToday, handleScrollToItem, sortBy, compactScheduledTasks]);

  // NEW: Handler for confirming task completion in deficit
  const confirmCompleteTaskInDeficit = useCallback(async () => {
    if (!taskToCompleteInDeficit || !profile) return;
    setIsProcessingCommand(true);
    try {
      await completeScheduledTaskMutation(taskToCompleteInDeficit);
      // After completion, if it was a flexible task, compact the schedule
      if (taskToCompleteInDeficit.is_flexible) {
        const latestDbScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', user?.id, formattedSelectedDay, sortBy]) || [];
        const compactedTasks = compactScheduleLogic(
            latestDbScheduledTasks,
            selectedDayAsDate,
            workdayStartTime,
            workdayEndTime,
            T_current
        );
        const tasksToUpdate = compactedTasks.filter(t => t.start_time && t.end_time);
        if (tasksToUpdate.length > 0) {
            await compactScheduledTasks({ tasksToUpdate });
            showSuccess(`Task "${taskToCompleteInDeficit.name}" completed! Schedule compacted.`);
        } else {
            showSuccess(`Task "${taskToCompleteInDeficit.name}" completed! No flexible tasks to compact.`);
        }
      } else {
        showSuccess(`Task "${taskToCompleteInDeficit.name}" completed!`);
      }
      setIsFocusModeActive(false);
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
    } catch (error: any) {
      showError(`Failed to complete task: ${error.message}`);
      console.error("Complete task in deficit error:", error);
    } finally {
      setIsProcessingCommand(false);
      setShowEnergyDeficitConfirmation(false);
      setTaskToCompleteInDeficit(null);
      setTaskToCompleteInDeficitIndex(null);
    }
  }, [taskToCompleteInDeficit, profile, completeScheduledTaskMutation, queryClient, user?.id, formattedSelectedDay, sortBy, selectedDayAsDate, workdayStartTime, workdayEndTime, T_current, compactScheduledTasks, setIsFocusModeActive]);


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

  const completedScheduledTasksForRecap = useMemo(() => {
    return completedTasksForSelectedDayList;
  }, [completedTasksForSelectedDayList]);


  const overallLoading = isSessionLoading || isSchedulerTasksLoading || isProcessingCommand || isLoadingRetiredTasks || isLoadingCompletedTasksForSelectedDay;

  const hasFlexibleTasksOnCurrentDay = dbScheduledTasks.some(item => item.is_flexible && !item.is_locked);

  // --- Conditional View Rendering ---

  const renderScheduleCore = () => (
    <>
      {/* Input & Environment/Weather Card (Now de-boxed with gradient wash) */}
      <div className="p-4 pt-6 space-y-4 animate-pop-in bg-primary-wash rounded-lg">
        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
          <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <ListTodo className="h-5 w-5 text-primary" /> Schedule Your Day
          </h2>
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground hidden sm:block">
              Current Time: <span className="font-semibold">{formatDateTime(T_current)}</span>
            </p>
          </div>
        </div>
        <EnvironmentMultiSelect /> 
        <WeatherWidget />
        <SchedulerInput 
          onCommand={handleCommand} 
          isLoading={overallLoading} 
          inputValue={inputValue}
          setInputValue={setInputValue}
          placeholder={`Add task (e.g., 'Gym 60') or command`}
          onDetailedInject={handleAddTaskClick}
        />
        <p className="text-sm text-muted-foreground">
          Examples: "Gym 60", "Meeting 11am-12pm", 'inject "Project X" 30', 'remove "Gym"', 'clear', 'compact', "Clean the sink 30 sink", "Time Off 2pm-3pm", "Aether Dump", "Aether Dump Mega"
        </p>
      </div>

      {/* Utility Bar (Always visible) */}
      <SchedulerUtilityBar 
        isProcessingCommand={isProcessingCommand}
        hasFlexibleTasksOnCurrentDay={hasFlexibleTasksOnCurrentDay}
        dbScheduledTasks={dbScheduledTasks}
        onRechargeEnergy={() => rechargeEnergy()}
        onRandomizeBreaks={handleRandomizeBreaks}
        onSortFlexibleTasks={handleSortFlexibleTasks}
        onOpenWorkdayWindowDialog={() => setShowWorkdayWindowDialog(true)}
        sortBy={sortBy}
        onCompactSchedule={handleCompactSchedule}
        onQuickScheduleBlock={handleQuickScheduleBlock}
        retiredTasksCount={retiredTasks.length}
        onZoneFocus={handleZoneFocus}
        onAetherDump={handleAetherDumpButton}
        onRefreshSchedule={handleRefreshSchedule}
      />

      {/* Now Focus Card (Always visible) */}
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

      <Card className="animate-pop-in animate-hover-lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-logo-yellow" /> Your Vibe Schedule for {format(parseISO(selectedDay), 'EEEE, MMMM d')}
          </CardTitle>
        </CardHeader>
        <CardContent ref={scheduleContainerRef} className="p-4">
          {isSchedulerTasksLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <SchedulerDisplay 
              schedule={currentSchedule} 
              T_current={T_current} 
              onRemoveTask={handlePermanentDeleteScheduledTask}
              onRetireTask={(task) => handleSchedulerAction('skip', task)}
              onCompleteTask={(task, index) => handleSchedulerAction('complete', task, false, 0, index)}
              activeItemId={activeItemToday?.id || null} 
              selectedDayString={selectedDay} 
              onAddTaskClick={handleAddTaskClick}
              onScrollToItem={handleScrollToItem}
              isProcessingCommand={isProcessingCommand}
            />
          )}
        </CardContent>
      </Card>
    </>
  );

  const renderSinkView = () => (
    <AetherSink 
      retiredTasks={retiredTasks} 
      onRezoneTask={handleRezoneFromSink} 
      onRemoveRetiredTask={handlePermanentDeleteRetiredTask}
      onAutoScheduleSink={handleAutoScheduleSinkWrapper}
      isLoading={isLoadingRetiredTasks}
      isProcessingCommand={isProcessingCommand}
      hideTitle={false} 
      profileEnergy={profile?.energy || 0}
      retiredSortBy={retiredSortBy} 
      setRetiredSortBy={setRetiredSortBy} 
    />
  );

  const renderRecapView = () => (
    <DailyVibeRecapCard
      scheduleSummary={currentSchedule?.summary || null}
      tasksCompletedToday={tasksCompletedForSelectedDay}
      xpEarnedToday={xpEarnedForSelectedDay}
      profileEnergy={profile?.energy || 0}
      criticalTasksCompletedToday={criticalTasksCompletedForSelectedDay}
      selectedDayString={selectedDay}
      completedScheduledTasks={completedScheduledTasksForRecap}
    />
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Immersive Focus Mode (Highest Layer) */}
      {isFocusModeActive && activeItemToday && currentSchedule && (
        <ImmersiveFocusMode
          activeItem={activeItemToday}
          T_current={T_current}
          onExit={() => setIsFocusModeActive(false)}
          onAction={handleSchedulerAction}
          dbTask={currentSchedule.dbTasks.find(t => t.id === activeItemToday.id) || null}
          nextItem={nextItemToday}
          isProcessingCommand={isProcessingCommand}
        />
      )}

      {/* Section A: Metrics & Calendar (Always Visible) */}
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

      {/* NEW: Segmented Control for View Switching */}
      <SchedulerSegmentedControl currentView={view} />

      {/* Conditional View Rendering based on 'view' prop */}
      <div className="animate-slide-in-up">
        {view === 'schedule' && renderScheduleCore()}
        {view === 'recap' && renderRecapView()}
        {view === 'sink' && renderSinkView()}
      </div>

      {/* Modals and Dialogs */}
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
                      placeholder="e.g., 60"
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
                      placeholder="e.g., 15"
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

      {/* Scheduled Task Permanent Delete Confirmation */}
      <AlertDialog open={showDeleteScheduledTaskConfirmation} onOpenChange={setShowDeleteScheduledTaskConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete Task?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete "{scheduledTaskToDeleteName}" from your schedule? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPermanentDeleteScheduledTask} className="bg-destructive hover:bg-destructive/90" autoFocus>
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Retired Task Permanent Delete Confirmation */}
      <AlertDialog open={showDeleteRetiredTaskConfirmation} onOpenChange={setShowDeleteRetiredTaskConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete Retired Task?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete "{retiredTaskToDeleteName}" from the Aether Sink? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPermanentDeleteRetiredTask} className="bg-destructive hover:bg-destructive/90" autoFocus>
              Delete Permanently
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
        onJustFinish={() => handleSchedulerAction('justFinish', earlyCompletionDbTask!, true)}
        isProcessingCommand={isProcessingCommand}
        hasNextTask={!!nextItemToday}
      />

      {/* NEW: Energy Deficit Confirmation Dialog */}
      {profile && taskToCompleteInDeficit && (
        <EnergyDeficitConfirmationDialog
          isOpen={showEnergyDeficitConfirmation}
          onOpenChange={(open) => {
            if (!open && !isProcessingCommand) {
              setShowEnergyDeficitConfirmation(false);
              setTaskToCompleteInDeficit(null);
              setTaskToCompleteInDeficitIndex(null);
            }
          }}
          taskName={taskToCompleteInDeficit.name}
          taskEnergyCost={taskToCompleteInDeficit.energy_cost}
          currentEnergy={profile.energy}
          onConfirm={confirmCompleteTaskInDeficit}
          isProcessingCommand={isProcessingCommand}
        />
      )}
    </div>
  );
};

export default SchedulerPage;