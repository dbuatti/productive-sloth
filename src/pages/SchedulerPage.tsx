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
import { supabase } from '@/integrations/supabase/client'; // Corrected import path
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
import EnvironmentMultiSelect from '@/components/EnvironmentMultiSelect';
import { useEnvironmentContext } from '@/hooks/use-environment-context';

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
  taskEnvironment?: TaskEnvironment;
}

const SchedulerPage: React.FC = () => {
  const { user, profile, isLoading: isSessionLoading, rechargeEnergy, T_current, activeItemToday, nextItemToday } = useSession();
  const { selectedEnvironments } = useEnvironmentContext();
  const environmentForPlacement = selectedEnvironments[0] || 'laptop';
  const [selectedDay, setSelectedDay] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const scheduleContainerRef = useRef<HTMLDivElement>(null);

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
  const [activeTab, setActiveTab] = useState('vibe-schedule');
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
  const [scheduledTaskToDeleteIndex, setScheduledTaskToDeleteIndex] = useState<number | null>(null); // NEW: Index for deletion

  // State for retired task permanent deletion confirmation
  const [showDeleteRetiredTaskConfirmation, setShowDeleteRetiredTaskConfirmation] = useState(false);
  const [retiredTaskToDeleteId, setRetiredTaskToDeleteId] = useState<string | null>(null);
  const [retiredTaskToDeleteName, setRetiredTaskToDeleteName] = useState<string | null>(null);


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

  // New handler for permanent deletion of scheduled tasks
  const handlePermanentDeleteScheduledTask = useCallback((taskId: string, taskName: string, index: number) => { // Added index
    setScheduledTaskToDeleteId(taskId);
    setScheduledTaskToDeleteName(taskName);
    setScheduledTaskToDeleteIndex(index); // NEW: Set index
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
          task_environment: environmentForPlacement,
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

  const handleCompactSchedule = useCallback(async (tasksToProcess?: DBScheduledTask[]) => { // Make argument optional
    if (!user || !profile) {
        showError("Please log in and ensure your profile is loaded to compact the schedule.");
        return;
    }

    // Get the current tasks from the query cache if not provided as an argument
    const currentTasks = tasksToProcess || queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', user.id, formattedSelectedDay, sortBy]) || [];

    // Check if there are any flexible tasks to compact among the currentTasks
    if (!currentTasks.some(task => task.is_flexible && !task.is_locked)) {
        showSuccess("No flexible tasks to compact.");
        return;
    }

    setIsProcessingCommand(true);
    try {
        const compactedTasks = compactScheduleLogic(
            currentTasks, // Use currentTasks here
            parseISO(formattedSelectedDay), // Use formattedSelectedDate directly
            profile.default_auto_schedule_start_time 
              ? setTimeOnDate(parseISO(formattedSelectedDay), profile.default_auto_schedule_start_time) 
              : startOfDay(parseISO(formattedSelectedDay)),
            profile.default_auto_schedule_end_time 
              ? setTimeOnDate(parseISO(formattedSelectedDay), profile.default_auto_schedule_end_time) 
              : addHours(startOfDay(parseISO(formattedSelectedDay)), 17),
            new Date() // T_current
        );

        // Now, we need to determine which tasks to DELETE from the DB
        // These are tasks that were in currentTasks but are NOT in compactedTasks
        const tasksToDeleteIds = currentTasks
            .filter(task => !compactedTasks.some(ct => ct.id === task.id))
            .map(task => task.id);

        // And which tasks to UPSERT (all tasks that should be present after compaction)
        const tasksToUpsert = compactedTasks;

        // Perform deletion first, then upsertion
        if (tasksToDeleteIds.length > 0) {
            const { error: deleteError } = await supabase
                .from('scheduled_tasks')
                .delete()
                .in('id', tasksToDeleteIds)
                .eq('user_id', user.id)
                .eq('scheduled_date', formattedSelectedDay); // Ensure we only delete for the current day
            if (deleteError) throw new Error(`Failed to delete tasks during compaction: ${deleteError.message}`);
        }

        if (tasksToUpsert.length > 0) {
            await compactScheduledTasks({ tasksToUpdate: tasksToUpsert });
            showSuccess("Schedule compacted successfully!");
            queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
        } else if (tasksToDeleteIds.length > 0) {
            // If all tasks were deleted, and no new ones were upserted, still show success
            showSuccess("Schedule compacted successfully (all flexible tasks removed).");
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
  }, [user, profile, formattedSelectedDay, sortBy, compactScheduledTasks, queryClient]);

  // Confirmation handler for scheduled task permanent deletion
  const confirmPermanentDeleteScheduledTask = useCallback(async () => {
    if (!scheduledTaskToDeleteId || !user || scheduledTaskToDeleteIndex === null) return; // Check index
    setIsProcessingCommand(true);
    try {
      await removeScheduledTask(scheduledTaskToDeleteId); // This deletes from DB and optimistically updates cache

      // Get the latest state of scheduled tasks from the cache after deletion
      const latestScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', user.id, formattedSelectedDay, sortBy]);
      
      if (latestScheduledTasks) {
        await handleCompactSchedule(latestScheduledTasks); // Pass the latest tasks
      } else {
        // If no tasks are left, just invalidate to ensure UI reflects empty state
        queryClient.invalidateQueries({ queryKey: ['scheduledTasks', user.id, formattedSelectedDay, sortBy] });
      }
      
      showSuccess(`Task "${scheduledTaskToDeleteName}" permanently deleted.`);

      // Scroll to the next item if it exists
      if (currentSchedule?.items && scheduledTaskToDeleteIndex < currentSchedule.items.length) {
        const nextItemId = currentSchedule.items[scheduledTaskToDeleteIndex].id; // Item at this index is now the one after the deleted one
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
      setScheduledTaskToDeleteIndex(null); // Reset index
    }
  }, [scheduledTaskToDeleteId, scheduledTaskToDeleteName, scheduledTaskToDeleteIndex, user, removeScheduledTask, handleCompactSchedule, currentSchedule?.items, queryClient, formattedSelectedDay, sortBy]);

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

        return true;
    } catch (error: any) {
        showError(`Failed to fill gap with sink task: ${error.message}`);
        console.error("Sink Fill Error:", error);
        return false;
    }
  }, [user, profile, retiredTasks, rezoneTask, addScheduledTask, formattedSelectedDay]);

  // NEW: Generic auto-schedule and sort function
  const handleAutoScheduleAndSort = useCallback(async (
    sortPreference: SortBy,
    taskSource: 'all-flexible' | 'sink-only',
    environmentsToFilterBy: TaskEnvironment[] = [] // Optional environment filter
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

      // Collect tasks based on taskSource
      if (taskSource === 'all-flexible') {
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
          case 'EMOJI':
            const hueA = getEmojiHue(a.name);
            const hueB = getEmojiHue(b.name);
            return hueA - hueB;
          default:
            // Default to oldest first if no specific sort or for tie-breaking
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
      });

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
          task_environment: task.task<dyad-problem-report summary="6 problems">
<problem file="src/hooks/use-scheduler-tasks.ts" line="842" column="55" code="2304">Cannot find name 'isSameDay'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="843" column="64" code="2304">Cannot find name 'differenceInMinutes'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="1175" column="5" code="2322">Type '(_data: void, _error: Error, _variables: void, context: MutationContext) =&gt; void' is not assignable to type '(data: void, error: Error, variables: void, context: { previousScheduledTasks: [readonly unknown[], DBScheduledTask[]][]; previousRetiredTasks: RetiredTask[]; previousScrollTop: number; }) =&gt; unknown'.
  Types of parameters 'context' and 'context' are incompatible.
    Type '{ previousScheduledTasks: [readonly unknown[], DBScheduledTask[]][]; previousRetiredTasks: RetiredTask[]; previousScrollTop: number; }' is not assignable to type 'MutationContext'.
      Types of property 'previousScheduledTasks' are incompatible.
        Type '[readonly unknown[], DBScheduledTask[]][]' is not assignable to type 'DBScheduledTask[]'.
          Type '[readonly unknown[], DBScheduledTask[]]' is not assignable to type 'DBScheduledTask'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="1202" column="43" code="2445">Property 'supabaseUrl' is protected and only accessible within class 'SupabaseClient&lt;Database, SchemaNameOrClientOptions, SchemaName, Schema, ClientOptions&gt;' and its subclasses.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="1226" column="110" code="2345">Argument of type '(old: DBScheduledTask[]) =&gt; NewDBScheduledTask[]' is not assignable to parameter of type 'Updater&lt;DBScheduledTask[], DBScheduledTask[]&gt;'.
  Type '(old: DBScheduledTask[]) =&gt; NewDBScheduledTask[]' is not assignable to type '(input: DBScheduledTask[]) =&gt; DBScheduledTask[]'.
    Type 'NewDBScheduledTask[]' is not assignable to type 'DBScheduledTask[]'.
      Type 'NewDBScheduledTask' is missing the following properties from type 'DBScheduledTask': user_id, created_at, updated_at</problem>
<problem file="src/pages/SchedulerPage.tsx" line="484" column="107" code="2552">Cannot find name 'userId'. Did you mean 'user'?</problem>
</dyad-problem-report><think>**Tackling TypeScript Errors**

I'm currently addressing two TypeScript compile-time errors within `use-scheduler-tasks.ts`. The errors center around the missing imports for `isSameDay` and `differenceInMinutes`, which are crucial date utility functions. I'll need to figure out where they should be imported from.


**Debugging TypeScript Issues**

I've got more TypeScript errors to address now. I've pinpointed three new issues. There's a type mismatch with `onSettled` for `aetherDumpMegaMutation`, stemming from how `queryClient.getQueriesData` returns data.  I need to either redefine `MutationContext` or refactor the use of `previousScheduledTasks` there. Additionally, a protected property, `supabase.supabaseUrl`, is causing problems, and I should use an alternative like `supabase.from('table').url`. Also, I've noticed issues with the `supabase` client and edge functions.


**Resolving Type Mismatches**

I'm tackling some more TypeScript errors. I've encountered 6 issues now. First, I need to add `isSameDay` and `differenceInMinutes` to the imports within `use-scheduler-tasks.ts`. For `onSettled`, I'll redefine `MutationContext` in `aetherDumpMegaMutation` to handle the `queryClient.getQueriesData` return type, or refine how I use `previousScheduledTasks` there. Next, `supabase.supabaseUrl` is off-limits; I should employ `supabase.from('table').url` instead. Then, I need to ensure  `NewDBScheduledTask` includes properties of `DBScheduledTask` when updating the cache. Finally, I need to define the `userId`  variable, to solve a missing name issue in `SchedulerPage.tsx`.


**Tackling TypeScript Incompatibilities**

I'm currently addressing the remaining TypeScript errors. I've successfully addressed the missing `isSameDay` and `differenceInMinutes` imports and the `supabaseUrl` protection.  The focus is now on the type mismatch in `aetherDumpMegaMutation`'s `onMutate` function, where the context and the returned data from the query don't align. I will address this conflict to correctly capture cached data. Finally, I'm working to correctly cast `NewDBScheduledTask` to `DBScheduledTask` for optimistic updates and resolve the `userId` scoping problem within `SchedulerPage.tsx`.


**Addressing TypeScript Issues**

I'm now actively addressing the remaining TypeScript errors. I've resolved the missing `isSameDay` and `differenceInMinutes` imports, as well as the incorrect use of `supabaseUrl`. I'm focusing on the `aetherDumpMegaMutation` function, specifically the mismatch between `onMutate`'s context and the data returned by `getQueriesData`. I'll update `MutationContext` to accommodate this discrepancy. After that, I will work to correctly type the `NewDBScheduledTask` so that I can cast to `DBScheduledTask` for the cache update. Lastly, I'll  fix the scoping issue with `userId` in `SchedulerPage.tsx`.


**Implementing Type Corrections**

I'm currently focused on resolving the remaining TypeScript errors. I've already tackled the imports for the date utility functions and `supabaseUrl`. I'm now honing in on `aetherDumpMegaMutation` to ensure `onSettled` properly handles the context derived from `onMutate`, refining `MutationContext` to accommodate the return type of `queryClient.getQueriesData`. After that, I'll revise how optimistic updates incorporate `NewDBScheduledTask` into the cache, making sure it aligns with the `DBScheduledTask` structure. Finally, I need to fix the `userId`  scoping issue in `SchedulerPage.tsx`.


**Finalizing TypeScript Corrections**

I'm now fully immersed in the final stage of resolving these TypeScript errors. I've addressed the import issues for the date functions and the `supabaseUrl` protection. Currently, I am focused on refining the type definitions for `aetherDumpMegaMutation` to make sure it functions correctly with the cache update. Next, I'll revise the `NewDBScheduledTask` definition to make sure the data is stored in the cache correctly. Lastly, I will fix the scoping error in `SchedulerPage.tsx`.



</think>It looks like there were a few issues related to missing imports, type mismatches in optimistic updates, and a protected property access. I've addressed these by:

1.  **Adding missing `date-fns` imports**: `isSameDay` and `differenceInMinutes` were not imported in `src/hooks/use-scheduler-tasks.ts`, causing compilation errors.
2.  **Correcting `supabaseUrl` access**: The `supabase.supabaseUrl` property is protected. I've updated `src/hooks/use-scheduler-tasks.ts` to import and use the `SUPABASE_URL` constant from `src/integrations/supabase/client.ts` for constructing the Edge Function URL.
3.  **Refining `MutationContext` and optimistic updates**:
    *   For `aetherDumpMegaMutation`, the `onMutate` function was returning a type for `previousScheduledTasks` that didn't match the `MutationContext`. I've updated `MutationContext` to correctly handle the array of `[queryKey, data]` tuples returned by `queryClient.getQueriesData`.
    *   When optimistically updating the cache in `autoBalanceScheduleMutation`, `NewDBScheduledTask` objects were being inserted where `DBScheduledTask` objects were expected. I've ensured that these optimistic tasks are fully formed `DBScheduledTask` objects by adding the necessary `user_id`, `created_at`, and `updated_at` properties.
4.  **Fixing `userId` scope in `SchedulerPage.tsx`**: The `userId` variable was not correctly scoped within the `handleCompactSchedule` `useCallback`. I've updated it to use `user.id` and added `user` to the dependency array of the `useCallback` to ensure it has access to the authenticated user's ID.

These changes resolve all the reported TypeScript errors and ensure the application's data flow and type safety are correctly maintained.

<dyad-write path="src/hooks/use-scheduler-tasks.ts" description="Added missing date-fns imports, corrected supabaseUrl access, and refined MutationContext and optimistic updates for type safety.">
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, QueryKey } from '@tanstack/react-query';
import { supabase, SUPABASE_URL } from '@/integrations/supabase/client'; // Import SUPABASE_URL
import { Task, NewTask, TaskStatusFilter, TemporalFilter } from '@/types';
import { DBScheduledTask, NewDBScheduledTask, RawTaskInput, RetiredTask, NewRetiredTask, SortBy, TaskPriority, TimeBlock, AutoBalancePayload, UnifiedTask, RetiredTaskSortBy } from '@/types/scheduler';
import { useSession } from './use-session';
import { showSuccess, showError } from '@/utils/toast';
import { startOfDay, subDays, formatISO, parseISO, isToday, isYesterday, format, addMinutes, isBefore, isAfter, addDays, addHours, setHours, setMinutes, isSameDay, differenceInMinutes } from 'date-fns'; // Added isSameDay, differenceInMinutes
import { XP_PER_LEVEL, MAX_ENERGY } from '@/lib/constants';
import { mergeOverlappingTimeBlocks, getFreeTimeBlocks, isSlotFree, calculateEnergyCost, compactScheduleLogic, getEmojiHue, setTimeOnDate } from '@/lib/scheduler-utils';
import { useTasks } from './use-tasks';

const getDateRange = (filter: TemporalFilter): { start: string, end: string } | null => {
  const now = new Date();
  const startOfToday = startOfDay(now);
  
  let startDate: Date;
  let endDate: Date;

  switch (filter) {
    case 'TODAY':
      startDate = new Date(0);
      endDate = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
      break;
    case 'YESTERDAY':
      startDate = subDays(startOfToday, 1);
      endDate = startOfToday;
      break;
    case 'LAST_7_DAYS':
      startDate = subDays(startOfToday, 7);
      endDate = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
      break;
    default:
      return null;
  }

  return {
    start: formatISO(startDate),
    end: formatISO(endDate),
  };
};

const sortTasks = (tasks: Task[], sortBy: SortBy): Task[] => {
  const priorityOrder: Record<TaskPriority, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

  return [...tasks].sort((a, b) => {
    if (sortBy === 'PRIORITY_HIGH_TO_LOW') {
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
    } else if (sortBy === 'PRIORITY_LOW_TO_HIGH') {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
    }
    return 0; 
  });
};

const calculateLevelAndRemainingXp = (totalXp: number) => {
  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
  const xpForCurrentLevel = (level - 1) * XP_PER_LEVEL;
  const xpTowardsNextLevel = totalXp - xpForCurrentLevel;
  const xpRemainingForNextLevel = XP_PER_LEVEL - xpTowardsNextLevel;
  return { level, xpTowardsNextLevel, xpRemainingForNextLevel };
};

// Define a common interface for mutation context
interface MutationContext {
  previousScheduledTasks?: DBScheduledTask[]; // For single query
  previousAllScheduledTasks?: Array<[QueryKey, DBScheduledTask[] | undefined]>; // For multiple queries (aetherDumpMega)
  previousRetiredTasks?: RetiredTask[];
  previousScrollTop?: number;
}

export const useSchedulerTasks = (selectedDate: string, scrollRef?: React.RefObject<HTMLElement>) => {
  const queryClient = useQueryClient();
  const { user, profile, refreshProfile, triggerLevelUp, session } = useSession();
  const userId = user?.id;

  const formattedSelectedDate = selectedDate;

  const [sortBy, setSortBy] = useState<SortBy>('TIME_EARLIEST_TO_LATEST');
  // Initialize retiredSortBy from localStorage or default
  const [retiredSortBy, setRetiredSortBy] = useState<RetiredTaskSortBy>(() => {
    if (typeof window !== 'undefined') {
      const savedSortBy = localStorage.getItem('aetherSinkSortBy');
      return savedSortBy ? (savedSortBy as RetiredTaskSortBy) : 'RETIRED_AT_NEWEST';
    }
    return 'RETIRED_AT_NEWEST';
  });
  const [xpGainAnimation, setXpGainAnimation] = useState<{ taskId: string, xpAmount: number } | null>(null);

  // Effect to save retiredSortBy to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('aetherSinkSortBy', retiredSortBy);
    }
  }, [retiredSortBy]);

  const { data: dbScheduledTasks = [], isLoading } = useQuery<DBScheduledTask[]>({
    queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy],
    queryFn: async () => {
      if (!userId) {
        console.log("useSchedulerTasks: No user ID, returning empty array.");
        return [];
      }
      if (!formattedSelectedDate) {
        console.log("useSchedulerTasks: No selected date, returning empty array.");
        return [];
      }
      console.log("useSchedulerTasks: Fetching scheduled tasks for user:", userId, "on date:", formattedSelectedDate, "sorted by:", sortBy);
      let query = supabase
        .from('scheduled_tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('scheduled_date', formattedSelectedDate);

      if (sortBy === 'TIME_EARLIEST_TO_LATEST') {
        query = query.order('start_time', { ascending: true });
      } else if (sortBy === 'TIME_LATEST_TO_EARLIEST') {
        query = query.order('start_time', { ascending: false });
      } else if (sortBy === 'PRIORITY_HIGH_TO_LOW') {
        query = query.order('is_critical', { ascending: false }).order('start_time', { ascending: true });
      } else if (sortBy === 'PRIORITY_LOW_TO_HIGH') {
        query = query.order('is_critical', { ascending: true }).order('start_time', { ascending: true });
      } else if (sortBy === 'EMOJI') {
        // EMOJI sorting is client-side as it depends on task name parsing
        // We'll fetch by creation time and sort client-side
        query = query.order('created_at', { ascending: true });
      } else {
        query = query.order('created_at', { ascending: true });
      }

      const { data, error } = await query;

      if (error) {
        console.error("useSchedulerTasks: Error fetching scheduled tasks:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully fetched tasks:", data.map(t => ({ id: t.id, name: t.name, scheduled_date: t.scheduled_date, start_time: t.start_time, end_time: t.end_time, is_critical: t.is_critical, is_flexible: t.is_flexible, is_locked: t.is_locked, energy_cost: t.energy_cost, is_completed: t.is_completed, is_custom_energy_cost: t.is_custom_energy_cost, task_environment: t.task_environment })));
      
      // Client-side sorting for EMOJI
      if (sortBy === 'EMOJI') {
        return (data as DBScheduledTask[]).sort((a, b) => {
          const hueA = getEmojiHue(a.name);
          const hueB = getEmojiHue(b.name);
          return hueA - hueB;
        });
      }

      return data as DBScheduledTask[];
    },
    enabled: !!userId && !!formattedSelectedDate,
  });

  const { data: datesWithTasks = [], isLoading: isLoadingDatesWithTasks } = useQuery<string[]>({
    queryKey: ['datesWithTasks', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('scheduled_tasks')
        .select('scheduled_date')
        .eq('user_id', userId);

      if (error) {
        console.error("useSchedulerTasks: Error fetching dates with tasks:", error.message);
        throw new Error(error.message);
      }
      const uniqueDates = Array.from(new Set(data.map(item => format(parseISO(item.scheduled_date), 'yyyy-MM-dd'))));
      return uniqueDates;
    },
    enabled: !!userId,
  });

  const { data: retiredTasks = [], isLoading: isLoadingRetiredTasks } = useQuery<RetiredTask[]>({
    queryKey: ['retiredTasks', userId, retiredSortBy],
    queryFn: async () => {
      if (!userId) return [];
      console.log("useSchedulerTasks: Fetching retired tasks for user:", userId, "sorted by:", retiredSortBy);
      let query = supabase
        .from('aethersink')
        .select('*')
        .eq('user_id', userId);

      // Apply sorting based on retiredSortBy
      switch (retiredSortBy) {
        case 'NAME_ASC':
          query = query.order('name', { ascending: true });
          break;
        case 'NAME_DESC':
          query = query.order('name', { ascending: false });
          break;
        case 'DURATION_ASC':
          query = query.order('duration', { ascending: true, nullsFirst: true });
          break;
        case 'DURATION_DESC':
          query = query.order('duration', { ascending: false });
          break;
        case 'CRITICAL_FIRST':
          query = query.order('is_critical', { ascending: false }).order('retired_at', { ascending: false });
          break;
        case 'CRITICAL_LAST':
          query = query.order('is_critical', { ascending: true }).order('retired_at', { ascending: false });
          break;
        case 'LOCKED_FIRST':
          query = query.order('is_locked', { ascending: false }).order('retired_at', { ascending: false });
          break;
        case 'LOCKED_LAST':
          query = query.order('is_locked', { ascending: true }).order('retired_at', { ascending: false });
          break;
        case 'ENERGY_ASC':
          query = query.order('energy_cost', { ascending: true });
          break;
        case 'ENERGY_DESC':
          query = query.order('energy_cost', { ascending: false });
          break;
        case 'RETIRED_AT_OLDEST':
          query = query.order('retired_at', { ascending: true });
          break;
        case 'COMPLETED_FIRST':
          query = query.order('is_completed', { ascending: false }).order('retired_at', { ascending: false });
          break;
        case 'COMPLETED_LAST':
          query = query.order('is_completed', { ascending: true }).order('retired_at', { ascending: false });
          break;
        case 'EMOJI':
          // Fetch all and sort client-side
          query = query.order('retired_at', { ascending: false }); // Default DB sort
          break;
        case 'RETIRED_AT_NEWEST':
        default:
          query = query.order('retired_at', { ascending: false });
          break;
      }

      const { data, error } = await query;

      if (error) {
        console.error("useSchedulerTasks: Error fetching retired tasks:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully fetched retired tasks:", data.map(t => ({ id: t.id, name: t.name, is_critical: t.is_critical, is_locked: t.is_locked, energy_cost: t.energy_cost, is_completed: t.is_completed, is_custom_energy_cost: t.is_custom_energy_cost, task_environment: t.task_environment })));
      
      // Client-side sorting for EMOJI
      if (retiredSortBy === 'EMOJI') {
        return (data as RetiredTask[]).sort((a, b) => {
          const hueA = getEmojiHue(a.name);
          const hueB = getEmojiHue(b.name);
          return hueA - hueB;
        });
      }

      return data as RetiredTask[];
    },
    enabled: !!userId,
    placeholderData: (previousData) => previousData,
  });

  // Renamed from completedTasksTodayList to completedTasksForSelectedDayList
  const { data: completedTasksForSelectedDayList = [], isLoading: isLoadingCompletedTasksForSelectedDay } = useQuery<DBScheduledTask[]>({
    queryKey: ['completedTasksForSelectedDayList', userId, formattedSelectedDate],
    queryFn: async () => {
      if (!userId) return [];
      
      // Correctly calculate UTC start and end of the selected day
      const selectedDayDate = parseISO(formattedSelectedDate);
      const selectedDayStartUTC = new Date(Date.UTC(selectedDayDate.getFullYear(), selectedDayDate.getMonth(), selectedDayDate.getDate())).toISOString();
      const selectedDayEndUTC = new Date(Date.UTC(selectedDayDate.getFullYear(), selectedDayDate.getMonth(), selectedDayDate.getDate() + 1)).toISOString();

      console.log("useSchedulerTasks: Fetching completed tasks for selected day. User ID:", userId, "Selected Day:", formattedSelectedDate);
      console.log("useSchedulerTasks: Selected Day Start UTC:", selectedDayStartUTC);
      console.log("useSchedulerTasks: Selected Day End UTC:", selectedDayEndUTC);

      // Fetch completed scheduled tasks for selected day
      const { data: scheduled, error: scheduledError } = await supabase
        .from('scheduled_tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('is_completed', true)
        .gte('updated_at', selectedDayStartUTC)
        .lt('updated_at', selectedDayEndUTC);

      if (scheduledError) {
        console.error('useSchedulerTasks: Error fetching completed scheduled tasks for selected day:', scheduledError);
        throw new Error(scheduledError.message);
      }
      console.log("useSchedulerTasks: Completed Scheduled Tasks for selected day:", scheduled);

      // Fetch completed retired tasks for selected day
      const { data: retired, error: retiredError } = await supabase
        .from('aethersink')
        .select('*')
        .eq('user_id', userId)
        .eq('is_completed', true)
        .gte('retired_at', selectedDayStartUTC)
        .lt('retired_at', selectedDayEndUTC);

      if (retiredError) {
        console.error('useSchedulerTasks: Error fetching completed retired tasks for selected day:', retiredError);
        throw new Error(retiredError.message);
      }
      console.log("useSchedulerTasks: Completed Retired Tasks for selected day:", retired);

      // Fetch completed general tasks for selected day
      const { data: generalTasks, error: generalTasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('is_completed', true)
        .gte('updated_at', selectedDayStartUTC)
        .lt('updated_at', selectedDayEndUTC);

      if (generalTasksError) {
        console.error('useSchedulerTasks: Error fetching completed general tasks for selected day:', generalTasksError);
        throw new Error(generalTasksError.message);
      }
      console.log("useSchedulerTasks: Completed General Tasks for selected day:", generalTasks);

      // Combine and map tasks
      const combinedTasks: DBScheduledTask[] = [
        ...(scheduled || []).map(t => ({ ...t, task_environment: t.task_environment || 'laptop' })),
        ...(retired || []).map(rt => ({
          id: rt.id,
          user_id: rt.user_id,
          name: rt.name,
          break_duration: rt.break_duration,
          start_time: null,
          end_time: null,
          scheduled_date: rt.original_scheduled_date,
          created_at: rt.retired_at,
          updated_at: rt.retired_at,
          is_critical: rt.is_critical,
          is_flexible: false,
          is_locked: rt.is_locked,
          energy_cost: rt.energy_cost,
          is_completed: rt.is_completed,
          is_custom_energy_cost: rt.is_custom_energy_cost,
          task_environment: rt.task_environment,
        })),
        ...(generalTasks || []).map(gt => ({
          id: gt.id,
          user_id: gt.user_id,
          name: gt.title,
          break_duration: null,
          start_time: null,
          end_time: null,
          scheduled_date: format(parseISO(gt.updated_at), 'yyyy-MM-dd'),
          created_at: gt.created_at,
          updated_at: gt.updated_at,
          is_critical: gt.is_critical,
          is_flexible: false,
          is_locked: false,
          energy_cost: gt.energy_cost,
          is_completed: gt.is_completed,
          is_custom_energy_cost: gt.is_custom_energy_cost,
          task_environment: 'laptop',
        })),
      ];

      console.log("useSchedulerTasks: Combined Tasks for selected day (before sorting):", combinedTasks);
      combinedTasks.forEach(task => console.log(`useSchedulerTasks: Task: ${task.name}, Energy Cost: ${task.energy_cost}, Is Completed: ${task.is_completed}`));

      // Sort by updated_at/retired_at descending (most recent first)
      return combinedTasks.sort((a, b) => {
        const timeA = parseISO(a.updated_at || a.created_at).getTime();
        const timeB = parseISO(b.updated_at || b.created_at).getTime();
        return timeB - timeA;
      });
    },
    enabled: !!userId && !!formattedSelectedDate,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });


  const rawTasks: RawTaskInput[] = dbScheduledTasks.map(dbTask => ({
    name: dbTask.name,
    duration: Math.floor((parseISO(dbTask.end_time!).getTime() - parseISO(dbTask.start_time!).getTime()) / (1000 * 60)),
    breakDuration: dbTask.break_duration ?? undefined,
    isCritical: dbTask.is_critical,
    energyCost: dbTask.energy_cost,
  }));

  const addScheduledTaskMutation = useMutation({
    mutationFn: async (newTask: NewDBScheduledTask) => {
      if (!userId) throw new Error("User not authenticated.");
      const taskToInsert = { ...newTask, user_id: userId, energy_cost: newTask.energy_cost ?? 0, is_completed: newTask.is_completed ?? false, is_custom_energy_cost: newTask.is_custom_energy_cost ?? false, task_environment: newTask.task_environment ?? 'laptop' };
      console.log("useSchedulerTasks: Attempting to insert new task:", taskToInsert);
      const { data, error } = await supabase.from('scheduled_tasks').insert(taskToInsert).select().single();
      if (error) {
        console.error("useSchedulerTasks: Error inserting task:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully inserted task:", data);
      return data as DBScheduledTask;
    },
    onMutate: async (newTask: NewDBScheduledTask) => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });

      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], (old) => {
        const tempId = Math.random().toString(36).substring(2, 9);
        const now = new Date().toISOString();
        const optimisticTask: DBScheduledTask = {
          id: tempId,
          user_id: userId!,
          name: newTask.name,
          break_duration: newTask.break_duration ?? null,
          start_time: newTask.start_time ?? now,
          end_time: newTask.end_time ?? now,
          scheduled_date: newTask.scheduled_date,
          created_at: now,
          updated_at: now,
          is_critical: newTask.is_critical ?? false,
          is_flexible: newTask.is_flexible ?? true,
          is_locked: newTask.is_locked ?? false,
          energy_cost: newTask.energy_cost ?? 0,
          is_completed: newTask.is_completed ?? false,
          is_custom_energy_cost: newTask.is_custom_energy_cost ?? false,
          task_environment: newTask.task_environment ?? 'laptop',
        };
        return [...(old || []), optimisticTask];
      });

      return { previousScheduledTasks, previousScrollTop };
    },
    onSuccess: () => {
      // No toast here, moved to onSettled
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
      showSuccess('Task added to schedule!');
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (e) => {
      showError(`Failed to add task to schedule: ${e.message}`);
    }
  });

  const addRetiredTaskMutation = useMutation({
    mutationFn: async (newTask: NewRetiredTask) => {
      if (!userId) throw new Error("User not authenticated.");
      const taskToInsert = { ...newTask, user_id: userId, retired_at: new Date().toISOString(), energy_cost: newTask.energy_cost ?? 0, is_completed: newTask.is_completed ?? false, is_custom_energy_cost: newTask.is_custom_energy_cost ?? false, task_environment: newTask.task_environment ?? 'laptop' };
      console.log("useSchedulerTasks: Attempting to insert new retired task:", taskToInsert);
      const { data, error } = await supabase.from('aethersink').insert(taskToInsert).select().single();
      if (error) {
        console.error("useSchedulerTasks: Error inserting retired task:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully inserted retired task:", data);
      return data as RetiredTask;
    },
    onMutate: async (newTask: NewRetiredTask) => {
      await queryClient.cancelQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      const previousRetiredTasks = queryClient.getQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      // Removed optimistic update for retiredTasks to prevent duplicates
      // queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId], (old) => {
      //   const tempId = Math.random().toString(36).substring(2, 9);
      //   const optimisticTask: RetiredTask = {
      //     id: tempId,
      //     user_id: userId!,
      //     name: newTask.name,
      //     duration: newTask.duration ?? null,
      //     break_duration: newTask.break_duration ?? null,
      //     original_scheduled_date: newTask.original_scheduled_date,
      //     retired_at: new Date().toISOString(),
      //     is_critical: newTask.is_critical ?? false,
      //     is_locked: newTask.is_locked ?? false,
      //     energy_cost: newTask.energy_cost ?? 0,
      //   };
      //   return [optimisticTask, ...(old || [])];
      // });
      return { previousRetiredTasks, previousScrollTop };
    },
    onSuccess: () => {
      // No toast here, moved to onSettled
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      showSuccess('Task sent directly to Aether Sink!');
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (err, newTask, context) => {
      // Check if the error message indicates a unique constraint violation (409 Conflict)
      if (err instanceof Error && err.message.includes('409 (Conflict)')) {
        showError(`A task named "${newTask.name}" for the original date ${format(parseISO(newTask.original_scheduled_date), 'MMM d, yyyy')} already exists in the Aether Sink. If you wish to add it again, consider modifying its name slightly.`);
      } else {
        showError(`Failed to send task to Aether Sink: ${err.message}`);
      }
      if (context?.previousRetiredTasks) {
        queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], context.previousRetiredTasks);
      }
    }
  });


  const removeScheduledTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("useSchedulerTasks: Attempting to remove task ID:", taskId);
      const { error } = await supabase.from('scheduled_tasks').delete().eq('id', taskId).eq('user_id', userId);
      if (error) {
        console.error("useSchedulerTasks: Error removing task:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully removed task ID:", taskId);
    },
    onMutate: async (taskId: string) => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], (old) =>
        (old || []).filter(task => task.id !== taskId)
      );
      return { previousScheduledTasks, previousScrollTop };
    },
    onSuccess: () => {
      // No toast here, moved to onSettled
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
      showSuccess('Task removed from schedule.');
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (e, taskId, context) => {
      showError(`Failed to remove task from schedule: ${e.message}`);
      if (context?.previousScheduledTasks) {
        queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], context.previousScheduledTasks);
      }
    }
  });

  const removeRetiredTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("useSchedulerTasks: Attempting to remove retired task ID:", taskId);
      const { error } = await supabase.from('aethersink').delete().eq('id', taskId).eq('user_id', userId);
      if (error) {
        console.error("useSchedulerTasks: Error removing retired task:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully removed retired task ID:", taskId);
    },
    onMutate: async (taskId: string) => {
      await queryClient.cancelQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      const previousRetiredTasks = queryClient.getQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], (old) =>
        (old || []).filter(task => task.id !== taskId)
      );
      return { previousRetiredTasks, previousScrollTop };
    },
    onSuccess: () => {
      // No toast here, moved to onSettled
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      showSuccess('Retired task permanently deleted.');
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (e, taskId, context) => {
      showError(`Failed to remove retired task: ${e.message}`);
      if (context?.previousRetiredTasks) {
        queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], context.previousRetiredTasks);
      }
    }
  });

  const clearScheduledTasksMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("useSchedulerTasks: Attempting to clear all scheduled tasks for user:", userId);
      const { error } = await supabase.from('scheduled_tasks').delete().eq('user_id', userId).eq('scheduled_date', formattedSelectedDate);
      if (error) {
        console.error("useSchedulerTasks: Error clearing scheduled tasks:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully cleared all scheduled tasks for user:", userId, "on date:", formattedSelectedDate);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], []);
      return { previousScheduledTasks, previousScrollTop };
    },
    onSuccess: () => {
      // No toast here, moved to onSettled
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
      showSuccess('Schedule cleared for today!');
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (e, _variables, context) => {
      showError(`Failed to clear schedule: ${e.message}`);
      if (context?.previousScheduledTasks) {
        queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], context.previousScheduledTasks);
      }
    }
  });

  const retireTaskMutation = useMutation({
    mutationFn: async (taskToRetire: DBScheduledTask) => {
      if (!userId) throw new Error("User not authenticated.");

      const newRetiredTask: NewRetiredTask = {
        user_id: userId,
        name: taskToRetire.name,
        duration: (taskToRetire.start_time && taskToRetire.end_time) 
                  ? Math.floor((parseISO(taskToRetire.end_time!).getTime() - parseISO(taskToRetire.start_time!).getTime()) / (1000 * 60)) 
                  : null,
        break_duration: taskToRetire.break_duration ?? null,
        original_scheduled_date: taskToRetire.scheduled_date,
        is_critical: taskToRetire.is_critical,
        is_locked: taskToRetire.is_locked,
        energy_cost: taskToRetire.energy_cost,
        is_completed: taskToRetire.is_completed,
        is_custom_energy_cost: taskToRetire.is_custom_energy_cost,
        task_environment: taskToRetire.task_environment,
      };

      const { error: insertError } = await supabase.from('aethersink').insert(newRetiredTask);
      if (insertError) throw new Error(`Failed to add task to Aether Sink: ${insertError.message}`);

      const { error: deleteError } = await supabase.from('scheduled_tasks').delete().eq('id', taskToRetire.id).eq('user_id', userId);
      if (deleteError) throw new Error(`Failed to remove task from schedule: ${deleteError.message}`);
    },
    onMutate: async (taskToRetire: DBScheduledTask) => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      await queryClient.cancelQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);
      const previousRetiredTasks = queryClient.getQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], (old) =>
        (old || []).filter(task => task.id !== taskToRetire.id)
      );
      queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], (old) => {
        const newRetiredTask: RetiredTask = {
          id: taskToRetire.id, // Use original ID for optimistic update
          user_id: userId!,
          name: taskToRetire.name,
          duration: (taskToRetire.start_time && taskToRetire.end_time) 
                    ? Math.floor((parseISO(taskToRetire.end_time!).getTime() - parseISO(taskToRetire.start_time!).getTime()) / (1000 * 60)) 
                    : null,
          break_duration: taskToRetire.break_duration ?? null,
          original_scheduled_date: taskToRetire.scheduled_date,
          retired_at: new Date().toISOString(),
          is_critical: taskToRetire.is_critical,
          is_locked: taskToRetire.is_locked,
          energy_cost: taskToRetire.energy_cost,
          is_completed: taskToRetire.is_completed,
          is_custom_energy_cost: taskToRetire.is_custom_energy_cost,
          task_environment: taskToRetire.task_environment,
        };
        return [newRetiredTask, ...(old || [])];
      });
      return { previousScheduledTasks, previousRetiredTasks, previousScrollTop };
    },
    onSuccess: () => {
      // No toast here, moved to onSettled
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
      showSuccess('Task moved to Aether Sink.');
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (e, _variables, context) => {
      showError(`Failed to retire task: ${e.message}`);
      if (context?.previousScheduledTasks) {
        queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], context.previousScheduledTasks);
      }
      if (context?.previousRetiredTasks) {
        queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], context.previousRetiredTasks);
      }
    }
  });

  const rezoneTaskMutation = useMutation({
    mutationFn: async (retiredTaskId: string) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("useSchedulerTasks: Attempting to rezone retired task ID:", retiredTaskId);
      const { error } = await supabase.from('aethersink').delete().eq('id', retiredTaskId).eq('user_id', userId);
      if (error) {
        console.error("useSchedulerTasks: Error rezoning task (deleting from sink):", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully rezoned task (deleted from sink) ID:", retiredTaskId);
    },
    onMutate: async (retiredTaskId: string) => {
      await queryClient.cancelQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      const previousRetiredTasks = queryClient.getQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], (old) =>
        (old || []).filter(task => task.id !== retiredTaskId)
      );
      return { previousRetiredTasks, previousScrollTop };
    },
    onSuccess: () => {
      // No toast here, handled by the calling function
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (e, retiredTaskId, context) => {
      showError(`Failed to rezone task: ${e.message}`);
      if (context?.previousRetiredTasks) {
        queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], context.previousRetiredTasks);
      }
    }
  });

  const compactScheduledTasksMutation = useMutation({
    mutationFn: async ({ tasksToUpdate }: { tasksToUpdate: DBScheduledTask[] }) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("useSchedulerTasks: Attempting to upsert compacted tasks:", tasksToUpdate.map(t => ({ id: t.id, name: t.name, start_time: t.start_time, end_time: t.end_time })));
      const { data, error } = await supabase
        .from('scheduled_tasks')
        .upsert(tasksToUpdate, { onConflict: 'id' })
        .select();
      if (error) {
        console.error("useSchedulerTasks: Error upserting compacted tasks:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully upserted compacted tasks:", data);
      return data as DBScheduledTask[];
    },
    onMutate: async ({ tasksToUpdate }: { tasksToUpdate: DBScheduledTask[] }) => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], tasksToUpdate);
      return { previousScheduledTasks, previousScrollTop };
    },
    onSuccess: () => {
      // No toast here, handled by the calling function
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (e, _variables, context) => {
      showError(`Failed to compact schedule: ${e.message}`);
      if (context?.previousScheduledTasks) {
        queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], context.previousScheduledTasks);
      }
    }
  });

  const randomizeBreaksMutation = useMutation({
    mutationFn: async ({ selectedDate, workdayStartTime, workdayEndTime, currentDbTasks }: { selectedDate: string, workdayStartTime: Date, workdayEndTime: Date, currentDbTasks: DBScheduledTask[] }) => {
      if (!userId) throw new Error("User not authenticated.");

      const breaksToRandomize = currentDbTasks.filter(task => task.name.toLowerCase() === 'break' && !task.is_locked);
      const fixedAndLockedTasks = currentDbTasks.filter(task => task.name.toLowerCase() !== 'break' || task.is_locked);

      let currentOccupiedBlocks: TimeBlock[] = mergeOverlappingTimeBlocks(
        fixedAndLockedTasks
          .filter(task => task.start_time && task.end_time)
          .map(task => {
            const utcStart = parseISO(task.start_time!);
            const utcEnd = parseISO(task.end_time!);

            let localStart = setHours(setMinutes(parseISO(selectedDate), utcStart.getMinutes()), utcStart.getHours());
            let localEnd = setHours(setMinutes(parseISO(selectedDate), utcEnd.getMinutes()), utcEnd.getHours());

            if (isBefore(localEnd, localStart)) {
              localEnd = addDays(localEnd, 1);
            }
            return { start: localStart, end: localEnd, duration: Math.floor((localEnd.getTime() - localStart.getTime()) / (1000 * 60)) };
          })
      );

      const updatedBreaks: DBScheduledTask[] = [];
      const availableSlots: TimeBlock[] = [];

      // Collect all possible free slots
      let currentFreeTimeCursor = workdayStartTime;
      for (const occupiedBlock of currentOccupiedBlocks) {
        if (currentFreeTimeCursor < occupiedBlock.start) {
          availableSlots.push({
            start: currentFreeTimeCursor,
            end: occupiedBlock.start,
            duration: Math.floor((occupiedBlock.start.getTime() - currentFreeTimeCursor.getTime()) / (1000 * 60)),
          });
        }
        currentFreeTimeCursor = new Date(Math.max(currentFreeTimeCursor.getTime(), occupiedBlock.end.getTime()));
      }
      if (currentFreeTimeCursor < workdayEndTime) {
        availableSlots.push({
          start: currentFreeTimeCursor,
          end: workdayEndTime,
          duration: Math.floor((workdayEndTime.getTime() - currentFreeTimeCursor.getTime()) / (1000 * 60)),
        });
      }

      // Shuffle breaks and try to place them
      const shuffledBreaks = [...breaksToRandomize].sort(() => 0.5 - Math.random());
      let tempOccupiedBlocks = [...currentOccupiedBlocks];

      for (const breakTask of shuffledBreaks) {
        const breakDuration = Math.floor((parseISO(breakTask.end_time!).getTime() - parseISO(breakTask.start_time!).getTime()) / (1000 * 60));
        let placed = false;

        // Find a random suitable slot
        const shuffledAvailableSlots = [...availableSlots].sort(() => 0.5 - Math.random());
        for (const slot of shuffledAvailableSlots) {
          if (slot.duration >= breakDuration) {
            // Try to place it randomly within the slot
            const maxStartTime = addMinutes(slot.end, -breakDuration);
            if (isBefore(slot.start, maxStartTime) || isSameDay(slot.start, maxStartTime)) {
              const randomOffset = Math.floor(Math.random() * (differenceInMinutes(maxStartTime, slot.start) + 1));
              const proposedStartTime = addMinutes(slot.start, randomOffset);
              const proposedEndTime = addMinutes(proposedStartTime, breakDuration);

              if (isSlotFree(proposedStartTime, proposedEndTime, tempOccupiedBlocks)) {
                updatedBreaks.push({
                  ...breakTask,
                  start_time: proposedStartTime.toISOString(),
                  end_time: proposedEndTime.toISOString(),
                  updated_at: new Date().toISOString(),
                });
                tempOccupiedBlocks.push({ start: proposedStartTime, end: proposedEndTime, duration: breakDuration });
                tempOccupiedBlocks = mergeOverlappingTimeBlocks(tempOccupiedBlocks);
                placed = true;
                break;
              }
            }
          }
        }
        if (!placed) {
          // If a break can't be placed, keep its original position or handle as unplaced
          updatedBreaks.push(breakTask);
        }
      }

      const { error } = await supabase
        .from('scheduled_tasks')
        .upsert(updatedBreaks, { onConflict: 'id' });

      if (error) throw new Error(`Failed to randomize breaks: ${error.message}`);
      return updatedBreaks;
    },
    onMutate: async ({ currentDbTasks }) => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      // Optimistically update breaks
      const breaksToRandomize = currentDbTasks.filter(task => task.name.toLowerCase() === 'break' && !task.is_locked);
      const fixedAndLockedTasks = currentDbTasks.filter(task => task.name.toLowerCase() !== 'break' || task.is_locked);

      const optimisticBreaks = breaksToRandomize.map(b => ({
        ...b,
        start_time: new Date().toISOString(), // Placeholder for visual update
        end_time: addMinutes(new Date(), b.break_duration || 15).toISOString(),
        updated_at: new Date().toISOString(),
      }));

      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], [...fixedAndLockedTasks, ...optimisticBreaks]);
      return { previousScheduledTasks, previousScrollTop };
    },
    onSuccess: () => {
      showSuccess('Breaks randomized!');
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (e, _variables, context) => {
      showError(`Failed to randomize breaks: ${e.message}`);
      if (context?.previousScheduledTasks) {
        queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], context.previousScheduledTasks);
      }
    }
  });

  const toggleScheduledTaskLockMutation = useMutation({
    mutationFn: async ({ taskId, isLocked }: { taskId: string; isLocked: boolean }) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log(`useSchedulerTasks: Attempting to toggle lock for scheduled task ID: ${taskId} to ${isLocked}`);
      const { data, error } = await supabase
        .from('scheduled_tasks')
        .update({ is_locked: isLocked, updated_at: new Date().toISOString() })
        .eq('id', taskId)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) {
        console.error("useSchedulerTasks: Error toggling scheduled task lock:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully toggled scheduled task lock:", data);
      return data as DBScheduledTask;
    },
    onMutate: async ({ taskId, isLocked }: { taskId: string; isLocked: boolean }) => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], (old) =>
        (old || []).map(task =>
          task.id === taskId ? { ...task, is_locked: isLocked, updated_at: new Date().toISOString() } : task
        )
      );
      return { previousScheduledTasks, previousScrollTop };
    },
    onSuccess: (_data, { isLocked }) => {
      showSuccess(`Task ${isLocked ? 'locked' : 'unlocked'}!`);
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (e, _variables, context) => {
      showError(`Failed to toggle task lock: ${e.message}`);
      if (context?.previousScheduledTasks) {
        queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], context.previousScheduledTasks);
      }
    }
  });

  const toggleRetiredTaskLockMutation = useMutation({
    mutationFn: async ({ taskId, isLocked }: { taskId: string; isLocked: boolean }) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log(`useSchedulerTasks: Attempting to toggle lock for retired task ID: ${taskId} to ${isLocked}`);
      const { data, error } = await supabase
        .from('aethersink')
        .update({ is_locked: isLocked, retired_at: new Date().toISOString() })
        .eq('id', taskId)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) {
        console.error("useSchedulerTasks: Error toggling retired task lock:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully toggled retired task lock:", data);
      return data as RetiredTask;
    },
    onMutate: async ({ taskId, isLocked }: { taskId: string; isLocked: boolean }) => {
      await queryClient.cancelQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      const previousRetiredTasks = queryClient.getQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], (old) =>
        (old || []).map(task =>
          task.id === taskId ? { ...task, is_locked: isLocked, retired_at: new Date().toISOString() } : task
        )
      );
      return { previousRetiredTasks, previousScrollTop };
    },
    onSuccess: (_data, { isLocked }) => {
      showSuccess(`Retired task ${isLocked ? 'locked' : 'unlocked'}!`);
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (e, _variables, context) => {
      showError(`Failed to toggle retired task lock: ${e.message}`);
      if (context?.previousRetiredTasks) {
        queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], context.previousRetiredTasks);
      }
    }
  });

  const aetherDumpMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("useSchedulerTasks: Performing Aether Dump for user:", userId, "on date:", formattedSelectedDate);

      const flexibleUnlockedTasks = dbScheduledTasks.filter(task => task.is_flexible && !task.is_locked);

      if (flexibleUnlockedTasks.length === 0) {
        showSuccess("No flexible, unlocked tasks to dump to Aether Sink.");
        return;
      }

      const newRetiredTasks: NewRetiredTask[] = flexibleUnlockedTasks.map(task => ({
        user_id: userId,
        name: task.name,
        duration: (task.start_time && task.end_time) 
                  ? Math.floor((parseISO(task.end_time!).getTime() - parseISO(task.start_time!).getTime()) / (1000 * 60)) 
                  : null,
        break_duration: task.break_duration ?? null,
        original_scheduled_date: task.scheduled_date,
        is_critical: task.is_critical,
        is_locked: false, // Tasks dumped to sink are not locked by default
        energy_cost: task.energy_cost,
        is_completed: task.is_completed,
        is_custom_energy_cost: task.is_custom_energy_cost,
        task_environment: task.task_environment,
      }));

      const { error: insertError } = await supabase.from('aethersink').insert(newRetiredTasks);
      if (insertError) throw new Error(`Failed to add tasks to Aether Sink: ${insertError.message}`);

      const { error: deleteError } = await supabase.from('scheduled_tasks').delete().in('id', flexibleUnlockedTasks.map(task => task.id)).eq('user_id', userId);
      if (deleteError) throw new Error(`Failed to remove tasks from schedule: ${deleteError.message}`);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      await queryClient.cancelQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);
      const previousRetiredTasks = queryClient.getQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      const flexibleUnlockedTasks = dbScheduledTasks.filter(task => task.is_flexible && !task.is_locked);
      const remainingScheduledTasks = dbScheduledTasks.filter(task => !task.is_flexible || task.is_locked);

      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], remainingScheduledTasks);
      queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], (old) => {
        const newRetiredTasks = flexibleUnlockedTasks.map(task => ({
          id: task.id,
          user_id: userId!,
          name: task.name,
          duration: (task.start_time && task.end_time) 
                    ? Math.floor((parseISO(task.end_time!).getTime() - parseISO(task.start_time!).getTime()) / (1000 * 60)) 
                    : null,
          break_duration: task.break_duration ?? null,
          original_scheduled_date: task.scheduled_date,
          retired_at: new Date().toISOString(),
          is_critical: task.is_critical,
          is_locked: false,
          energy_cost: task.energy_cost,
          is_completed: task.is_completed,
          is_custom_energy_cost: task.is_custom_energy_cost,
          task_environment: task.task_environment,
        }));
        return [...newRetiredTasks, ...(old || [])];
      });
      return { previousScheduledTasks, previousRetiredTasks, previousScrollTop };
    },
    onSuccess: () => {
      showSuccess('Flexible tasks moved to Aether Sink!');
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (e, _variables, context) => {
      showError(`Failed to perform Aether Dump: ${e.message}`);
      if (context?.previousScheduledTasks) {
        queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], context.previousScheduledTasks);
      }
      if (context?.previousRetiredTasks) {
        queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], context.previousRetiredTasks);
      }
    }
  });

  const aetherDumpMegaMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("useSchedulerTasks: Performing Aether Dump Mega for user:", userId);

      const { data: allFlexibleUnlockedTasks, error: fetchError } = await supabase
        .from('scheduled_tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('is_flexible', true)
        .eq('is_locked', false);

      if (fetchError) throw new Error(`Failed to fetch all flexible tasks: ${fetchError.message}`);

      if (allFlexibleUnlockedTasks.length === 0) {
        showSuccess("No flexible, unlocked tasks across all schedules to dump to Aether Sink.");
        return;
      }

      const newRetiredTasks: NewRetiredTask[] = allFlexibleUnlockedTasks.map(task => ({
        user_id: userId,
        name: task.name,
        duration: (task.start_time && task.end_time) 
                  ? Math.floor((parseISO(task.end_time!).getTime() - parseISO(task.start_time!).getTime()) / (1000 * 60)) 
                  : null,
        break_duration: task.break_duration ?? null,
        original_scheduled_date: task.scheduled_date,
        is_critical: task.is_critical,
        is_locked: false,
        energy_cost: task.energy_cost,
        is_completed: task.is_completed,
        is_custom_energy_cost: task.is_custom_energy_cost,
        task_environment: task.task_environment,
      }));

      const { error: insertError } = await supabase.from('aethersink').insert(newRetiredTasks);
      if (insertError) throw new Error(`Failed to add tasks to Aether Sink: ${insertError.message}`);

      const { error: deleteError } = await supabase.from('scheduled_tasks').delete().in('id', allFlexibleUnlockedTasks.map(task => task.id)).eq('user_id', userId);
      if (deleteError) throw new Error(`Failed to remove tasks from all schedules: ${deleteError.message}`);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId] }); // Cancel all scheduled tasks queries
      await queryClient.cancelQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      const previousAllScheduledTasks = queryClient.getQueriesData<DBScheduledTask[]>({ queryKey: ['scheduledTasks', userId] });
      const previousRetiredTasks = queryClient.getQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      // Optimistically clear all flexible tasks from all scheduled queries
      queryClient.setQueriesData<DBScheduledTask[]>({ queryKey: ['scheduledTasks', userId] }, (old) => {
        if (!old) return old;
        const flexibleUnlockedTasks = old.filter(task => task.is_flexible && !task.is_locked);
        const remainingScheduledTasks = old.filter(task => !task.is_flexible || task.is_locked);

        queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], (oldRetired) => {
          const newRetiredTasks = flexibleUnlockedTasks.map(task => ({
            id: task.id,
            user_id: userId!,
            name: task.name,
            duration: (task.start_time && task.end_time) 
                      ? Math.floor((parseISO(task.end_time!).getTime() - parseISO(task.start_time!).getTime()) / (1000 * 60)) 
                      : null,
            break_duration: task.break_duration ?? null,
            original_scheduled_date: task.scheduled_date,
            retired_at: new Date().toISOString(),
            is_critical: task.is_critical,
            is_locked: false,
            energy_cost: task.energy_cost,
            is_completed: task.is_completed,
            is_custom_energy_cost: task.is_custom_energy_cost,
            task_environment: task.task_environment,
          }));
          return [...newRetiredTasks, ...(oldRetired || [])];
        });
        return remainingScheduledTasks;
      });
      return { previousAllScheduledTasks, previousRetiredTasks, previousScrollTop };
    },
    onSuccess: () => {
      showSuccess('All flexible tasks moved to Aether Sink!');
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
      if (context?.previousAllScheduledTasks) {
        // Restore previous scheduled tasks for all queries
        context.previousAllScheduledTasks.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
      }
    },
    onError: (e, _variables, context) => {
      showError(`Failed to perform Aether Dump Mega: ${e.message}`);
      if (context?.previousAllScheduledTasks) {
        // Restore previous scheduled tasks for all queries
        context.previousAllScheduledTasks.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
      }
      if (context?.previousRetiredTasks) {
        queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], context.previousRetiredTasks);
      }
    }
  });

  const autoBalanceScheduleMutation = useMutation({
    mutationFn: async (payload: AutoBalancePayload) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("useSchedulerTasks: Invoking auto-balance-schedule Edge Function with payload:", payload);

      const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/auto-balance-schedule`; // Use imported SUPABASE_URL
      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to auto-balance schedule via Edge Function');
      }
      return response.json();
    },
    onMutate: async (payload: AutoBalancePayload) => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      await queryClient.cancelQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy]);
      const previousRetiredTasks = queryClient.getQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      // Optimistic update: remove deleted tasks, add inserted tasks, update sink
      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], (old) => {
        const remaining = (old || []).filter(task => !payload.scheduledTaskIdsToDelete.includes(task.id));
        const now = new Date().toISOString();
        const tasksToInsertAsDBScheduled: DBScheduledTask[] = payload.tasksToInsert.map(newTask => ({
          id: newTask.id || Math.random().toString(36).substring(2, 9), // Ensure ID
          user_id: userId!,
          name: newTask.name,
          break_duration: newTask.break_duration ?? null,
          start_time: newTask.start_time ?? now,
          end_time: newTask.end_time ?? now,
          scheduled_date: newTask.scheduled_date,
          created_at: now,
          updated_at: now,
          is_critical: newTask.is_critical ?? false,
          is_flexible: newTask.is_flexible ?? true,
          is_locked: newTask.is_locked ?? false,
          energy_cost: newTask.energy_cost ?? 0,
          is_completed: newTask.is_completed ?? false,
          is_custom_energy_cost: newTask.is_custom_energy_cost ?? false,
          task_environment: newTask.task_environment ?? 'laptop',
        }));
        return [...remaining, ...tasksToInsertAsDBScheduled];
      });

      queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], (old) => {
        const remaining = (old || []).filter(task => !payload.retiredTaskIdsToDelete.includes(task.id));
        const newSinkTasks = payload.tasksToKeepInSink.map(t => ({
          id: Math.random().toString(36).substring(2, 9), // Temp ID
          user_id: userId!,
          name: t.name,
          duration: t.duration,
          break_duration: t.break_duration,
          original_scheduled_date: t.original_scheduled_date,
          retired_at: new Date().toISOString(),
          is_critical: t.is_critical ?? false,
          is_locked: t.is_locked ?? false,
          energy_cost: t.energy_cost ?? 0,
          is_completed: t.is_completed ?? false,
          is_custom_energy_cost: t.is_custom_energy_cost ?? false,
          task_environment: t.task_environment ?? 'laptop',
        }));
        return [...remaining, ...newSinkTasks];
      });

      return { previousScheduledTasks, previousRetiredTasks, previousScrollTop };
    },
    onSuccess: () => {
      // No toast here, handled by the calling function
    },
    onSettled: (_data, _error, _variables, context: MutationContext | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
      if (scrollRef?.current && context?.previousScrollTop !== undefined) {
        scrollRef.current.scrollTop = context.previousScrollTop;
      }
    },
    onError: (e, _variables, context) => {
      showError(`Failed to auto-balance schedule: ${e.message}`);
      if (context?.previousScheduledTasks) {
        queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, formattedSelectedDate, sortBy], context.previousScheduledTasks);
      }
      if (context?.previousRetiredTasks) {
        queryClient.setQueryData<RetiredTask[]>(['retiredTasks', userId, retiredSortBy], context.previousRetiredTasks);
      }
    }
  });

  const completeScheduledTaskMutation = useMutation({
    mutationFn: async (task: DBScheduledTask) => {
      if (!userId) throw new Error("User not authenticated.");
      if (!profile) throw new Error("User profile not loaded.");
      if (profile.energy < task.energy_cost) {
        throw new Error("Insufficient energy.");
      }

      const newXp = profile.xp + (task.energy_cost * 2);
      const newLevel = Math.floor(newXp / XP_PER_LEVEL) + 1;
      const newEnergy = profile.energy - task.energy_cost;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          xp: newXp,
          level: newLevel,
          energy: newEnergy,
          tasks_completed_today: profile.tasks_completed_today + 1,
          daily_streak: isToday(parseISO(profile.last_streak_update || new Date().toISOString())) ? profile.daily_streak : profile.daily_streak + 1,
          last_streak_update: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (profileError) throw new Error(`Failed to update profile: ${profileError.message}`);

      // Mark task as completed in scheduled_tasks
      const { error: taskError } = await supabase
        .from('scheduled_tasks')
        .update({ is_completed: true, updated_at: new Date().toISOString() })
        .eq('id', task.id)
        .eq('user_id', userId);

      if (taskError) throw new Error(`Failed to mark scheduled task as completed: ${taskError.message}`);

      // Add to completedtasks log
      const { error: completedLogError } = await supabase
        .from('completedtasks')
        .insert({
          user_id: userId,
          task_name: task.name,
          original_id: task.id,
          duration_scheduled: (task.start_time && task.end_time) ? Math.floor((parseISO(task.end_time).getTime() - parseISO(task.start_time).getTime()) / (1000 * 60)) : null,
          duration_used: (task.start_time && task.end_time) ? Math.floor((parseISO(task.end_time).getTime() - parseISO(task.start_time).getTime()) / (1000 * 60)) : null,
          xp_earned: task.energy_cost * 2,
          energy_cost: task.energy_cost,
          is_critical: task.is_critical,
          original_source: 'scheduled_tasks',
          original_scheduled_date: task.scheduled_date,
        });
      if (completedLogError) console.error("Failed to log completed scheduled task:", completedLogError.message);

      return { newXp, newLevel, newEnergy };
    },
    onSuccess: async ({ newXp, newLevel, newEnergy }) => {
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      queryClient.invalidateQueries({ queryKey: ['completedTasksForSelectedDayList', userId, formattedSelectedDate] });
      if (profile && newLevel > profile.level) {
        triggerLevelUp(newLevel);
      }
    },
    onError: (e) => {
      showError(`Failed to complete scheduled task: ${e.message}`);
    }
  });

  const updateScheduledTaskDetailsMutation = useMutation({
    mutationFn: async (task: Partial<DBScheduledTask> & { id: string }) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("useSchedulerTasks: Attempting to update scheduled task details:", task);
      const { data, error } = await supabase
        .from('scheduled_tasks')
        .update({ ...task, updated_at: new Date().toISOString() })
        .eq('id', task.id)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) {
        console.error("useSchedulerTasks: Error updating scheduled task details:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully updated scheduled task details:", data);
      return data as DBScheduledTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', userId] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
      showSuccess('Scheduled task details updated.');
    },
    onError: (e) => {
      showError(`Failed to update scheduled task details: ${e.message}`);
    }
  });

  const updateScheduledTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, isCompleted }: { taskId: string; isCompleted: boolean }) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log(`useSchedulerTasks: Attempting to update completion status for scheduled task ID: ${taskId} to ${isCompleted}`);

      const { data: currentTask, error: fetchError } = await supabase
        .from('scheduled_tasks')
        .select('*')
        .eq('id', taskId)
        .eq('user_id', userId)
        .single();

      if (fetchError) throw new Error(`Failed to fetch task for status update: ${fetchError.message}`);
      if (!currentTask) throw new Error("Task not found.");

      if (isCompleted && !currentTask.is_completed) {
        // If marking as complete, trigger the full completion logic
        await completeScheduledTaskMutation.mutateAsync(currentTask);
      } else if (!isCompleted && currentTask.is_completed) {
        // If marking as incomplete, only update the task status and profile (reverse XP/Energy if needed)
        // For simplicity, we'll just update the task status here. Reversing XP/Energy is more complex
        // and usually handled by a dedicated "undo" or "uncomplete" feature.
        const { error } = await supabase
          .from('scheduled_tasks')
          .update({ is_completed: isCompleted, updated_at: new Date().toISOString() })
          .eq('id', taskId)
          .eq('user_id', userId);
        if (error) throw new Error(`Failed to update scheduled task completion status: ${error.message}`);
        await refreshProfile();
      } else {
        // No change needed if status is already as requested
        return currentTask;
      }
      
      return currentTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId, formattedSelectedDate, sortBy] });
      queryClient.invalidateQueries({ queryKey: ['completedTasksForSelectedDayList', userId, formattedSelectedDate] });
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', userId] });
      showSuccess('Scheduled task status updated.');
    },
    onError: (e) => {
      showError(`Failed to update scheduled task status: ${e.message}`);
    }
  });

  const updateRetiredTaskDetailsMutation = useMutation({
    mutationFn: async (task: Partial<RetiredTask> & { id: string }) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("useSchedulerTasks: Attempting to update retired task details:", task);
      const { data, error } = await supabase
        .from('aethersink')
        .update({ ...task, retired_at: new Date().toISOString() })
        .eq('id', task.id)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) {
        console.error("useSchedulerTasks: Error updating retired task details:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully updated retired task details:", data);
      return data as RetiredTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      queryClient.invalidateQueries({ queryKey: ['completedTasksForSelectedDayList', userId, formattedSelectedDate] });
      showSuccess('Retired task details updated.');
    },
    onError: (e) => {
      showError(`Failed to update retired task details: ${e.message}`);
    }
  });

  const updateRetiredTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, isCompleted }: { taskId: string; isCompleted: boolean }) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log(`useSchedulerTasks: Attempting to update completion status for retired task ID: ${taskId} to ${isCompleted}`);

      const { data: currentTask, error: fetchError } = await supabase
        .from('aethersink')
        .select('*')
        .eq('id', taskId)
        .eq('user_id', userId)
        .single();

      if (fetchError) throw new Error(`Failed to fetch retired task for status update: ${fetchError.message}`);
      if (!currentTask) throw new Error("Retired task not found.");

      if (isCompleted && !currentTask.is_completed) {
        // If marking as complete, trigger the full completion logic for retired tasks
        await completeRetiredTaskMutation.mutateAsync(currentTask);
      } else if (!isCompleted && currentTask.is_completed) {
        // If marking as incomplete, only update the task status
        const { error } = await supabase
          .from('aethersink')
          .update({ is_completed: isCompleted, retired_at: new Date().toISOString() })
          .eq('id', taskId)
          .eq('user_id', userId);
        if (error) throw new Error(`Failed to update retired task completion status: ${error.message}`);
        await refreshProfile();
      } else {
        // No change needed if status is already as requested
        return currentTask;
      }
      
      return currentTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      queryClient.invalidateQueries({ queryKey: ['completedTasksForSelectedDayList', userId, formattedSelectedDate] });
      showSuccess('Retired task status updated.');
    },
    onError: (e) => {
      showError(`Failed to update retired task status: ${e.message}`);
    }
  });

  const completeRetiredTaskMutation = useMutation({
    mutationFn: async (task: RetiredTask) => {
      if (!userId) throw new Error("User not authenticated.");
      if (!profile) throw new Error("User profile not loaded.");
      if (profile.energy < task.energy_cost) {
        throw new Error("Insufficient energy.");
      }

      const newXp = profile.xp + (task.energy_cost * 2);
      const newLevel = Math.floor(newXp / XP_PER_LEVEL) + 1;
      const newEnergy = profile.energy - task.energy_cost;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          xp: newXp,
          level: newLevel,
          energy: newEnergy,
          tasks_completed_today: profile.tasks_completed_today + 1,
          daily_streak: isToday(parseISO(profile.last_streak_update || new Date().toISOString())) ? profile.daily_streak : profile.daily_streak + 1,
          last_streak_update: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (profileError) throw new Error(`Failed to update profile: ${profileError.message}`);

      // Mark task as completed in aethersink
      const { error: taskError } = await supabase
        .from('aethersink')
        .update({ is_completed: true, retired_at: new Date().toISOString() })
        .eq('id', task.id)
        .eq('user_id', userId);

      if (taskError) throw new Error(`Failed to mark retired task as completed: ${taskError.message}`);

      // Add to completedtasks log
      const { error: completedLogError } = await supabase
        .from('completedtasks')
        .insert({
          user_id: userId,
          task_name: task.name,
          original_id: task.id,
          duration_scheduled: task.duration,
          duration_used: task.duration,
          xp_earned: task.energy_cost * 2,
          energy_cost: task.energy_cost,
          is_critical: task.is_critical,
          original_source: 'aethersink',
          original_scheduled_date: task.original_scheduled_date,
        });
      if (completedLogError) console.error("Failed to log completed retired task:", completedLogError.message);

      return { newXp, newLevel, newEnergy };
    },
    onSuccess: async ({ newXp, newLevel, newEnergy }) => {
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId, retiredSortBy] });
      queryClient.invalidateQueries({ queryKey: ['completedTasksForSelectedDayList', userId, formattedSelectedDate] });
      if (profile && newLevel > profile.level) {
        triggerLevelUp(newLevel);
      }
    },
    onError: (e) => {
      showError(`Failed to complete retired task: ${e.message}`);
    }
  });

  // NEW: Mutation to trigger Aether Sink backup
  const triggerAetherSinkBackupMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("User not authenticated.");
      console.log("useSchedulerTasks: Triggering Aether Sink backup for user:", userId);
      const { data, error } = await supabase.rpc('backup_aethersink_for_user', { p_user_id: userId });
      if (error) {
        console.error("useSchedulerTasks: Error triggering Aether Sink backup:", error.message);
        throw new Error(error.message);
      }
      console.log("useSchedulerTasks: Successfully triggered Aether Sink backup.");
      return data;
    },
    onSuccess: () => {
      showSuccess('Aether Sink backup created successfully!');
    },
    onError: (e) => {
      showError(`Failed to create Aether Sink backup: ${e.message}`);
    }
  });


  return {
    dbScheduledTasks,
    isLoading: isLoading || isLoadingRetiredTasks || isLoadingCompletedTasksForSelectedDay,
    addScheduledTask: addScheduledTaskMutation.mutateAsync,
    addRetiredTask: addRetiredTaskMutation.mutateAsync,
    removeScheduledTask: removeScheduledTaskMutation.mutateAsync,
    clearScheduledTasks: clearScheduledTasksMutation.mutateAsync,
    datesWithTasks,
    isLoadingDatesWithTasks,
    retiredTasks,
    isLoadingRetiredTasks,
    completedTasksForSelectedDayList,
    isLoadingCompletedTasksForSelectedDay,
    retireTask: retireTaskMutation.mutateAsync,
    rezoneTask: rezoneTaskMutation.mutateAsync,
    compactScheduledTasks: compactScheduledTasksMutation.mutateAsync,
    randomizeBreaks: randomizeBreaksMutation.mutateAsync,
    toggleScheduledTaskLock: toggleScheduledTaskLockMutation.mutateAsync,
    toggleRetiredTaskLock: toggleRetiredTaskLockMutation.mutateAsync,
    aetherDump: aetherDumpMutation.mutateAsync,
    aetherDumpMega: aetherDumpMegaMutation.mutateAsync,
    sortBy,
    setSortBy,
    retiredSortBy,
    setRetiredSortBy,
    autoBalanceSchedule: autoBalanceScheduleMutation.mutateAsync,
    completeScheduledTask: completeScheduledTaskMutation.mutateAsync,
    updateScheduledTaskDetails: updateScheduledTaskDetailsMutation.mutateAsync,
    updateScheduledTaskStatus: updateScheduledTaskStatusMutation.mutateAsync,
    updateRetiredTaskDetails: updateRetiredTaskDetailsMutation.mutateAsync,
    updateRetiredTaskStatus: updateRetiredTaskStatusMutation.mutateAsync,
    completeRetiredTask: completeRetiredTaskMutation.mutateAsync,
    removeRetiredTask: removeRetiredTaskMutation.mutateAsync,
    triggerAetherSinkBackup: triggerAetherSinkBackupMutation.mutateAsync, // NEW: Export backup trigger
  };
};