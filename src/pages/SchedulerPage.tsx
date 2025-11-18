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
          // Use the onScrollToItem prop from SchedulerDisplay
          if (scheduleContainerRef.current) {
            const element = scheduleContainerRef.current.querySelector(`#scheduled-item-${nextItemId}`);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
        }
      } else if (currentSchedule?.items && scheduledTaskToDeleteIndex > 0) {
        // If the last item was deleted, scroll to the previous one
        const prevItemId = currentSchedule.items[scheduledTaskToDeleteIndex - 1].id;
        if (prevItemId) {
          // Use the onScrollToItem prop from SchedulerDisplay
          if (scheduleContainerRef.current) {
            const element = scheduleContainerRef.current.querySelector(`#scheduled-item-${prevItemId}`);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
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
          task_environment: task.task_environment,
        });
      });

      let currentOccupiedBlocksForPlacement: TimeBlock[] = mergeOverlappingTimeBlocks(
        existingFixedTasks
          .filter(task => task.start_time && task.end_time)
          .map(task => {
            const utcStart = parseISO(task.start_time!);
            const utcEnd = parseISO(task.end_time!);

            let localStart = setHours(setMinutes(selectedDayAsDate, utcStart.getMinutes()), utcStart.getHours());
            let localEnd = setHours(setMinutes(selectedDayAsDate, utcEnd.getMinutes()), utcEnd.getHours());

            if (isBefore(localEnd, localStart)) {
              localEnd = addDays(localEnd, 1);
            }
            return { start: localStart, end: localEnd, duration: Math.floor((localEnd.getTime() - localStart.getTime()) / (1000 * 60)) };
          })
      );

      let currentPlacementCursor = effectiveWorkdayStart;

      for (const unifiedTask of sortedTasks) {
        const taskDuration = unifiedTask.duration;
        const breakDuration = unifiedTask.break_duration || 0;
        const totalDuration = taskDuration + breakDuration;

        let placed = false;
        let searchStartTime = currentPlacementCursor;

        while (isBefore(searchStartTime, workdayEndTime)) {
          const freeBlocks = getFreeTimeBlocks(currentOccupiedBlocksForPlacement, searchStartTime, workdayEndTime);
          const suitableBlock = freeBlocks.find(block => block.duration >= totalDuration);

          if (suitableBlock) {
            const proposedStartTime = suitableBlock.start;
            const proposedEndTime = addMinutes(proposedStartTime, totalDuration);

            if (isSlotFree(proposedStartTime, proposedEndTime, currentOccupiedBlocksForPlacement)) {
              tasksToInsert.push({
                id: unifiedTask.id,
                name: unifiedTask.name,
                start_time: proposedStartTime.toISOString(),
                end_time: proposedEndTime.toISOString(),
                break_duration: unifiedTask.break_duration,
                scheduled_date: formattedSelectedDay,
                is_critical: unifiedTask.is_critical,
                is_flexible: true,
                is_locked: false, // Newly scheduled tasks are not locked by default
                energy_cost: unifiedTask.energy_cost,
                is_completed: unifiedTask.is_completed,
                is_custom_energy_cost: unifiedTask.is_custom_energy_cost,
                task_environment: unifiedTask.task_environment,
              });
              currentOccupiedBlocksForPlacement.push({ start: proposedStartTime, end: proposedEndTime, duration: totalDuration });
              currentOccupiedBlocksForPlacement = mergeOverlappingTimeBlocks(currentOccupiedBlocksForPlacement);
              currentPlacementCursor = proposedEndTime;
              placed = true;
              break;
            }
          }
          if (!placed) {
            const nextOccupiedBlock = currentOccupiedBlocksForPlacement.find(block => isAfter(block.start, searchStartTime));
            if (nextOccupiedBlock) {
              searchStartTime = nextOccupiedBlock.end;
            } else {
              break;
            }
          }
        }

        if (!placed) {
          tasksToKeepInSink.push({
            user_id: user.id,
            name: unifiedTask.name,
            duration: unifiedTask.duration,
            break_duration: unifiedTask.break_duration,
            original_scheduled_date: unifiedTask.originalId === unifiedTask.id && unifiedTask.source === 'scheduled' 
              ? formattedSelectedDay 
              : unifiedTask.created_at.split('T')[0], // Use created_at date if from sink or new
            is_critical: unifiedTask.is_critical,
            is_locked: unifiedTask.is_locked,
            energy_cost: unifiedTask.energy_cost,
            is_completed: unifiedTask.is_completed,
            is_custom_energy_cost: unifiedTask.is_custom_energy_cost,
            task_environment: unifiedTask.task_environment,
          });
        }

        // Collect IDs for deletion
        if (unifiedTask.source === 'scheduled') {
          scheduledTaskIdsToDelete.push(unifiedTask.id);
        } else if (unifiedTask.source === 'retired') {
          retiredTaskIdsToDelete.push(unifiedTask.id);
        }
      }

      // Call the Edge Function to perform the atomic transaction
      const response = await autoBalanceSchedule({
        scheduledTaskIdsToDelete,
        retiredTaskIdsToDelete,
        tasksToInsert,
        tasksToKeepInSink,
        selectedDate: formattedSelectedDay,
      });

      showSuccess(`Auto-schedule complete! Placed ${response.tasksPlaced} tasks, ${response.tasksKeptInSink} returned to Aether Sink.`);
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });

    } catch (error: any) {
      showError(`Failed to auto-schedule: ${error.message}`);
      console.error("Auto-schedule error:", error);
    } finally {
      setIsProcessingCommand(false);
    }
  }, [user, profile, dbScheduledTasks, retiredTasks, formattedSelectedDay, selectedDayAsDate, effectiveWorkdayStart, workdayEndTime, autoBalanceSchedule, queryClient]);

  const handleCommand = useCallback(async (commandInput: string) => {
    if (!user || !profile) {
      showError("Please log in and ensure your profile is loaded to use commands.");
      return;
    }
    setIsProcessingCommand(true);

    const parsedCommand = parseCommand(commandInput);
    const parsedTask = parseTaskInput(commandInput, selectedDayAsDate);
    const parsedInjection = parseInjectionCommand(commandInput);

    try {
      if (parsedCommand) {
        switch (parsedCommand.type) {
          case 'clear':
            setShowClearConfirmation(true);
            break;
          case 'remove':
            if (parsedCommand.target) {
              const taskToRemove = dbScheduledTasks.find(task => task.name.toLowerCase() === parsedCommand.target?.toLowerCase());
              if (taskToRemove) {
                if (taskToRemove.is_locked) {
                  showError(`Task "${taskToRemove.name}" is locked and cannot be removed. Unlock it first.`);
                } else {
                  handlePermanentDeleteScheduledTask(taskToRemove.id, taskToRemove.name, dbScheduledTasks.indexOf(taskToRemove));
                }
              } else {
                showError(`Task "${parsedCommand.target}" not found in schedule.`);
              }
            } else if (parsedCommand.index !== undefined) {
              const taskToRemove = dbScheduledTasks[parsedCommand.index];
              if (taskToRemove) {
                if (taskToRemove.is_locked) {
                  showError(`Task "${taskToRemove.name}" is locked and cannot be removed. Unlock it first.`);
                } else {
                  handlePermanentDeleteScheduledTask(taskToRemove.id, taskToRemove.name, parsedCommand.index);
                }
              } else {
                showError(`No task found at index ${parsedCommand.index + 1}.`);
              }
            } else {
              showError("Please specify a task name or index to remove (e.g., 'remove Gym' or 'remove index 1').");
            }
            break;
          case 'break':
            const breakDuration = parsedCommand.duration || 15;
            const breakName = `Break (${breakDuration} min)`;
            const breakEnergyCost = calculateEnergyCost(breakDuration, false);

            const { proposedStartTime: breakStartTime, proposedEndTime: breakEndTime, message: breakMessage } = await findFreeSlotForTask(
              breakName,
              breakDuration,
              false,
              true,
              breakEnergyCost,
              occupiedBlocks,
              effectiveWorkdayStart,
              workdayEndTime
            );

            if (breakStartTime && breakEndTime) {
              await addScheduledTask({
                name: breakName,
                start_time: breakStartTime.toISOString(),
                end_time: breakEndTime.toISOString(),
                break_duration: breakDuration,
                scheduled_date: formattedSelectedDay,
                is_critical: false,
                is_flexible: true,
                is_locked: false,
                energy_cost: breakEnergyCost,
                is_custom_energy_cost: false,
                task_environment: environmentForPlacement,
              });
              showSuccess(`Added a ${breakDuration}-minute break.`);
              queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
            } else {
              showError(breakMessage);
            }
            break;
          case 'timeoff':
            setInjectionPrompt({
              taskName: 'Time Off',
              isOpen: true,
              isTimed: true,
              isFlexible: false,
              energyCost: 0,
              isCustomEnergyCost: false,
              taskEnvironment: 'away',
            });
            break;
          case 'compact':
            await handleCompactSchedule();
            break;
          case 'aether dump':
            await handleAetherDumpButton();
            break;
          case 'aether dump mega':
            await aetherDumpMega();
            showSuccess("All flexible tasks from all schedules moved to Aether Sink!");
            queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
            break;
          default:
            showError("Unknown command.");
            break;
        }
      } else if (parsedTask) {
        if (parsedTask.shouldSink) {
          await addRetiredTask({
            user_id: user.id,
            name: parsedTask.name,
            duration: parsedTask.duration || null,
            break_duration: parsedTask.breakDuration || null,
            original_scheduled_date: formattedSelectedDay,
            is_critical: parsedTask.isCritical,
            is_locked: false,
            energy_cost: parsedTask.energyCost,
            is_completed: false,
            is_custom_energy_cost: false,
            task_environment: environmentForPlacement,
          });
          showSuccess(`Task "${parsedTask.name}" sent to Aether Sink.`);
        } else if (parsedTask.startTime && parsedTask.endTime) {
          await addScheduledTask({
            name: parsedTask.name,
            start_time: parsedTask.startTime.toISOString(),
            end_time: parsedTask.endTime.toISOString(),
            break_duration: parsedTask.breakDuration || null,
            scheduled_date: formattedSelectedDay,
            is_critical: parsedTask.isCritical,
            is_flexible: parsedTask.isFlexible,
            is_locked: !parsedTask.isFlexible, // Timed tasks are implicitly locked
            energy_cost: parsedTask.energyCost,
            is_custom_energy_cost: false,
            task_environment: environmentForPlacement,
          });
          showSuccess(`Timed task "${parsedTask.name}" added to schedule.`);
          queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
        } else if (parsedTask.duration) {
          const { proposedStartTime, proposedEndTime, message } = await findFreeSlotForTask(
            parsedTask.name,
            parsedTask.duration,
            parsedTask.isCritical,
            parsedTask.isFlexible,
            parsedTask.energyCost,
            occupiedBlocks,
            effectiveWorkdayStart,
            workdayEndTime
          );

          if (proposedStartTime && proposedEndTime) {
            await addScheduledTask({
              name: parsedTask.name,
              start_time: proposedStartTime.toISOString(),
              end_time: proposedEndTime.toISOString(),
              break_duration: parsedTask.breakDuration || null,
              scheduled_date: formattedSelectedDay,
              is_critical: parsedTask.isCritical,
              is_flexible: parsedTask.isFlexible,
              is_locked: !parsedTask.isFlexible, // Duration-based tasks are locked if not flexible
              energy_cost: parsedTask.energyCost,
              is_custom_energy_cost: false,
              task_environment: environmentForPlacement,
            });
            showSuccess(`Task "${parsedTask.name}" added to schedule.`);
            queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
          } else {
            showError(message);
          }
        } else {
          showError("Invalid task format. Please specify duration (e.g., 'Task Name 60') or time range (e.g., 'Task Name 10am-11am').");
        }
      } else if (parsedInjection) {
        setInjectionPrompt({
          taskName: parsedInjection.taskName,
          isOpen: true,
          isTimed: !!(parsedInjection.startTime && parsedInjection.endTime),
          duration: parsedInjection.duration,
          breakDuration: parsedInjection.breakDuration,
          startTime: parsedInjection.startTime,
          endTime: parsedInjection.endTime,
          isCritical: parsedInjection.isCritical,
          isFlexible: parsedInjection.isFlexible,
          energyCost: parsedInjection.energyCost,
          isCustomEnergyCost: false,
          taskEnvironment: environmentForPlacement,
        });
      } else {
        showError("Invalid input. Please enter a valid task or command.");
      }
    } catch (error: any) {
      showError(`Command failed: ${error.message}`);
      console.error("Command execution error:", error);
    } finally {
      setIsProcessingCommand(false);
      setInputValue('');
    }
  }, [user, profile, dbScheduledTasks, retiredTasks, formattedSelectedDay, selectedDayAsDate, occupiedBlocks, effectiveWorkdayStart, workdayEndTime, findFreeSlotForTask, addScheduledTask, addRetiredTask, removeScheduledTask, handleCompactSchedule, handlePermanentDeleteScheduledTask, aetherDumpMega, queryClient, environmentForPlacement]);

  const handleInjectionSubmit = async (values: InjectionPromptState) => {
    if (!user || !profile) {
      showError("You must be logged in to inject tasks.");
      return;
    }
    setIsProcessingCommand(true);

    try {
      let finalStartTime: Date | undefined;
      let finalEndTime: Date | undefined;
      let finalDuration: number | undefined;

      if (values.isTimed && values.startTime && values.endTime) {
        finalStartTime = setTimeOnDate(selectedDayAsDate, values.startTime);
        finalEndTime = setTimeOnDate(selectedDayAsDate, values.endTime);
        if (isBefore(finalEndTime, finalStartTime)) {
          finalEndTime = addDays(finalEndTime, 1);
        }
        finalDuration = differenceInMinutes(finalEndTime, finalStartTime);
      } else if (values.duration) {
        finalDuration = values.duration;
      } else {
        showError("Duration or valid time range is required for injection.");
        return;
      }

      const energyCost = values.isCustomEnergyCost && values.energyCost !== undefined
        ? values.energyCost
        : calculateEnergyCost(finalDuration, values.isCritical ?? false);

      if (finalStartTime && finalEndTime) {
        await addScheduledTask({
          name: values.taskName,
          start_time: finalStartTime.toISOString(),
          end_time: finalEndTime.toISOString(),
          break_duration: values.breakDuration || null,
          scheduled_date: formattedSelectedDay,
          is_critical: values.isCritical ?? false,
          is_flexible: values.isFlexible ?? false, // Timed tasks are implicitly fixed
          is_locked: !(values.isFlexible ?? false),
          energy_cost: energyCost,
          is_custom_energy_cost: values.isCustomEnergyCost ?? false,
          task_environment: values.taskEnvironment ?? environmentForPlacement,
        });
        showSuccess(`Timed task "${values.taskName}" injected into schedule.`);
        queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
      } else if (finalDuration) {
        const { proposedStartTime, proposedEndTime, message } = await findFreeSlotForTask(
          values.taskName,
          finalDuration,
          values.isCritical ?? false,
          values.isFlexible ?? true,
          energyCost,
          occupiedBlocks,
          effectiveWorkdayStart,
          workdayEndTime
        );

        if (proposedStartTime && proposedEndTime) {
          await addScheduledTask({
            name: values.taskName,
            start_time: proposedStartTime.toISOString(),
            end_time: proposedEndTime.toISOString(),
            break_duration: values.breakDuration || null,
            scheduled_date: formattedSelectedDay,
            is_critical: values.isCritical ?? false,
            is_flexible: values.isFlexible ?? true,
            is_locked: !(values.isFlexible ?? true),
            energy_cost: energyCost,
            is_custom_energy_cost: values.isCustomEnergyCost ?? false,
            task_environment: values.taskEnvironment ?? environmentForPlacement,
          });
          showSuccess(`Task "${values.taskName}" injected into schedule.`);
          queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
        } else {
          showError(message);
        }
      }
    } catch (error: any) {
      showError(`Failed to inject task: ${error.message}`);
      console.error("Injection error:", error);
    } finally {
      setIsProcessingCommand(false);
      setInjectionPrompt(null);
      setInjectionDuration('');
      setInjectionBreak('');
      setInjectionStartTime('');
      setInjectionEndTime('');
    }
  };

  const handleOpenDetailedInject = () => {
    setInjectionPrompt({
      taskName: '',
      isOpen: true,
      isTimed: false,
      duration: 30,
      breakDuration: 0,
      isCritical: false,
      isFlexible: true,
      energyCost: calculateEnergyCost(30, false),
      isCustomEnergyCost: false,
      taskEnvironment: environmentForPlacement,
    });
    setInjectionDuration('30');
    setInjectionBreak('0');
  };

  const handleRezoneTask = useCallback(async (task: RetiredTask) => {
    if (!user || !profile) {
      showError("Please log in and ensure your profile is loaded to re-zone tasks.");
      return;
    }
    if (task.is_locked) {
      showError(`Task "${task.name}" is locked and cannot be re-zoned. Unlock it first.`);
      return;
    }
    if (task.is_completed) {
      showError(`Completed task "${task.name}" cannot be re-zoned.`);
      return;
    }
    setIsProcessingCommand(true);

    try {
      const taskDuration = task.duration || 30; // Default to 30 min if duration is null
      const energyCost = task.energy_cost;

      const { proposedStartTime, proposedEndTime, message } = await findFreeSlotForTask(
        task.name,
        taskDuration,
        task.is_critical,
        true, // Re-zoned tasks are flexible by default
        energyCost,
        occupiedBlocks,
        effectiveWorkdayStart,
        workdayEndTime
      );

      if (proposedStartTime && proposedEndTime) {
        await rezoneTask(task.id); // Delete from aethersink
        await addScheduledTask({
          name: task.name,
          start_time: proposedStartTime.toISOString(),
          end_time: proposedEndTime.toISOString(),
          break_duration: task.break_duration,
          scheduled_date: formattedSelectedDay,
          is_critical: task.is_critical,
          is_flexible: true,
          is_locked: false,
          energy_cost: energyCost,
          is_custom_energy_cost: task.is_custom_energy_cost,
          task_environment: task.task_environment,
        });
        showSuccess(`Task "${task.name}" re-zoned to schedule.`);
        queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
      } else {
        showError(message);
      }
    } catch (error: any) {
      showError(`Failed to re-zone task: ${error.message}`);
      console.error("Re-zone task error:", error);
    } finally {
      setIsProcessingCommand(false);
    }
  }, [user, profile, retiredTasks, formattedSelectedDay, occupiedBlocks, effectiveWorkdayStart, workdayEndTime, findFreeSlotForTask, rezoneTask, addScheduledTask, queryClient]);

  const handleRetireTask = useCallback(async (task: DBScheduledTask) => {
    if (!user || !profile) {
      showError("Please log in and ensure your profile is loaded to retire tasks.");
      return;
    }
    if (task.is_locked) {
      showError(`Task "${task.name}" is locked and cannot be retired. Unlock it first.`);
      return;
    }
    setIsProcessingCommand(true);
    try {
      await retireTask(task);
      showSuccess(`Task "${task.name}" moved to Aether Sink.`);
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
    } catch (error: any) {
      showError(`Failed to retire task: ${error.message}`);
      console.error("Retire task error:", error);
    } finally {
      setIsProcessingCommand(false);
    }
  }, [user, profile, retireTask, queryClient]);

  const handleCompleteTask = useCallback(async (task: DBScheduledTask, index: number) => {
    if (!user || !profile) {
      showError("Please log in and ensure your profile is loaded to complete tasks.");
      return;
    }
    if (task.is_locked) {
      showError(`Task "${task.name}" is locked and cannot be completed. Unlock it first.`);
      return;
    }
    if (profile.energy < task.energy_cost) {
      showError(`Insufficient energy to complete "${task.name}". You need ${task.energy_cost} energy, but have ${profile.energy}.`);
      return;
    }
    setIsProcessingCommand(true);

    try {
      const now = T_current;
      const scheduledEndTime = parseISO(task.end_time!);
      const remainingDurationMinutes = differenceInMinutes(scheduledEndTime, now);

      if (remainingDurationMinutes > 5 && !task.is_flexible) { // If more than 5 minutes remaining and it's a fixed task
        setEarlyCompletionTaskName(task.name);
        setEarlyCompletionRemainingMinutes(remainingDurationMinutes);
        setEarlyCompletionDbTask(task);
        setShowEarlyCompletionModal(true);
      } else {
        // Proceed with normal completion
        await completeScheduledTaskMutation(task);
        showSuccess(`Task "${task.name}" completed!`);
        queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
        // Scroll to the next item if it exists
        if (currentSchedule?.items && index < currentSchedule.items.length - 1) {
          const nextItemId = currentSchedule.items[index + 1].id;
          if (nextItemId) {
            if (scheduleContainerRef.current) {
              const element = scheduleContainerRef.current.querySelector(`#scheduled-item-${nextItemId}`);
              if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }
          }
        }
      }
    } catch (error: any) {
      showError(`Failed to complete task: ${error.message}`);
      console.error("Complete task error:", error);
    } finally {
      setIsProcessingCommand(false);
    }
  }, [user, profile, T_current, completeScheduledTaskMutation, currentSchedule?.items, queryClient]);

  const handleEarlyCompletionAction = useCallback(async (action: 'takeBreak' | 'startNext' | 'justFinish') => {
    if (!earlyCompletionDbTask || !user || !profile) return;

    setIsProcessingCommand(true);
    setShowEarlyCompletionModal(false);

    try {
      // First, complete the task
      await completeScheduledTaskMutation(earlyCompletionDbTask);
      showSuccess(`Task "${earlyCompletionDbTask.name}" completed!`);
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });

      const now = T_current;
      const scheduledEndTime = parseISO(earlyCompletionDbTask.end_time!);
      const remainingDurationMinutes = differenceInMinutes(scheduledEndTime, now);

      if (action === 'takeBreak') {
        const breakName = `Early Completion Break (${remainingDurationMinutes} min)`;
        const breakEnergyCost = calculateEnergyCost(remainingDurationMinutes, false);
        const { proposedStartTime, proposedEndTime, message } = await findFreeSlotForTask(
          breakName,
          remainingDurationMinutes,
          false,
          true,
          breakEnergyCost,
          occupiedBlocks,
          effectiveWorkdayStart,
          workdayEndTime
        );
        if (proposedStartTime && proposedEndTime) {
          await addScheduledTask({
            name: breakName,
            start_time: proposedStartTime.toISOString(),
            end_time: proposedEndTime.toISOString(),
            break_duration: remainingDurationMinutes,
            scheduled_date: formattedSelectedDay,
            is_critical: false,
            is_flexible: true,
            is_locked: false,
            energy_cost: breakEnergyCost,
            is_custom_energy_cost: false,
            task_environment: environmentForPlacement,
          });
          showSuccess(`Added a ${remainingDurationMinutes}-minute break.`);
          queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
        } else {
          showError(message);
        }
      } else if (action === 'startNext') {
        // Logic to start the next task immediately
        // This would involve finding the next task and potentially updating its start time
        // For now, we'll just show a message.
        showSuccess("Starting next task (feature to automatically adjust start time coming soon!).");
      } else if (action === 'justFinish') {
        showSuccess("Enjoy your extra free time!");
      }
    } catch (error: any) {
      showError(`Action failed after early completion: ${error.message}`);
      console.error("Early completion action error:", error);
    } finally {
      setIsProcessingCommand(false);
      setEarlyCompletionDbTask(null);
    }
  }, [user, profile, T_current, earlyCompletionDbTask, completeScheduledTaskMutation, findFreeSlotForTask, occupiedBlocks, effectiveWorkdayStart, workdayEndTime, addScheduledTask, formattedSelectedDay, queryClient, environmentForPlacement]);

  const handleFocusModeAction = useCallback(async (action: 'complete' | 'skip' | 'takeBreak' | 'startNext' | 'exitFocus', task: DBScheduledTask, isEarlyCompletion: boolean, remainingDurationMinutes?: number) => {
    if (!user || !profile) {
      showError("Please log in and ensure your profile is loaded to perform this action.");
      return;
    }
    setIsProcessingCommand(true);

    try {
      if (action === 'exitFocus') {
        setIsFocusModeActive(false);
        showSuccess("Exited focus mode.");
        return;
      }

      if (task.is_locked) {
        showError(`Task "${task.name}" is locked. Unlock it to perform this action.`);
        return;
      }

      if (action === 'complete') {
        if (profile.energy < task.energy_cost) {
          showError(`Insufficient energy to complete "${task.name}". You need ${task.energy_cost} energy, but have ${profile.energy}.`);
          return;
        }
        const now = T_current;
        const scheduledEndTime = parseISO(task.end_time!);
        const currentRemainingDurationMinutes = differenceInMinutes(scheduledEndTime, now);

        if (currentRemainingDurationMinutes > 5 && !task.is_flexible) {
          setEarlyCompletionTaskName(task.name);
          setEarlyCompletionRemainingMinutes(currentRemainingDurationMinutes);
          setEarlyCompletionDbTask(task);
          setShowEarlyCompletionModal(true);
        } else {
          await completeScheduledTaskMutation(task);
          showSuccess(`Task "${task.name}" completed!`);
          setIsFocusModeActive(false);
          queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
        }
      } else if (action === 'skip') {
        await retireTask(task);
        showSuccess(`Task "${task.name}" moved to Aether Sink.`);
        setIsFocusModeActive(false);
        queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
      }
    } catch (error: any) {
      showError(`Action failed in focus mode: ${error.message}`);
      console.error("Focus mode action error:", error);
    } finally {
      setIsProcessingCommand(false);
    }
  }, [user, profile, T_current, completeScheduledTaskMutation, retireTask, queryClient]);

  const handleZoneFocus = useCallback(async () => {
    if (!user || !profile) {
      showError("Please log in and ensure your profile is loaded to use Zone Focus.");
      return;
    }
    if (selectedEnvironments.length === 0) {
      showError("Please select at least one environment to use Zone Focus.");
      return;
    }

    setIsProcessingCommand(true);
    try {
      // Filter tasks in the current schedule that are flexible, unlocked, and match selected environments
      const flexibleScheduledTasksToConsider = dbScheduledTasks.filter(task => 
        task.is_flexible && !task.is_locked && selectedEnvironments.includes(task.task_environment)
      );

      // Filter tasks in the Aether Sink that are unlocked and match selected environments
      const unlockedRetiredTasksToConsider = retiredTasks.filter(task => 
        !task.is_locked && selectedEnvironments.includes(task.task_environment)
      );

      // Combine and sort these tasks
      const unifiedPool: UnifiedTask[] = [];
      flexibleScheduledTasksToConsider.forEach(task => {
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
      unlockedRetiredTasksToConsider.forEach(task => {
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

      // Sort by critical first, then longest duration
      const sortedTasks = [...unifiedPool].sort((a, b) => {
        if (a.is_critical && !b.is_critical) return -1;
        if (!a.is_critical && b.is_critical) return 1;
        return (b.duration || 0) - (a.duration || 0);
      });

      // Now, re-schedule these tasks using the auto-schedule logic
      // This will involve deleting them from their original locations (scheduled_tasks or aethersink)
      // and inserting them into scheduled_tasks for the current day.
      // Tasks that don't fit will be returned to the aethersink.
      await handleAutoScheduleAndSort('TIME_LATEST_TO_EARLIEST', 'all-flexible', selectedEnvironments); // Use 'all-flexible' to process both scheduled and retired
      showSuccess("Zone Focus applied! Tasks re-scheduled based on selected environments.");

    } catch (error: any) {
      showError(`Failed to apply Zone Focus: ${error.message}`);
      console.error("Zone Focus error:", error);
    } finally {
      setIsProcessingCommand(false);
    }
  }, [user, profile, selectedEnvironments, dbScheduledTasks, retiredTasks, handleAutoScheduleAndSort]);


  const handleScrollToItem = useCallback((itemId: string) => {
    if (scheduleContainerRef.current) {
      const element = scheduleContainerRef.current.querySelector(`#scheduled-item-${itemId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, []);

  if (isSessionLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const hasFlexibleTasksOnCurrentDay = dbScheduledTasks.some(task => task.is_flexible && !task.is_locked);
  const hasRetiredTasks = retiredTasks.length > 0;

  const totalXpEarnedToday = completedTasksForSelectedDayList.reduce((sum, task) => sum + (task.energy_cost * 2), 0);
  const totalTasksCompletedToday = completedTasksForSelectedDayList.length;

  const isTodaySelected = isSameDay(selectedDayAsDate, T_current);

  if (isFocusModeActive && activeItemToday) {
    return (
      <ImmersiveFocusMode
        activeItem={activeItemToday}
        T_current={T_current}
        onExit={() => setIsFocusModeActive(false)}
        onAction={handleFocusModeAction}
        dbTask={dbScheduledTasks.find(t => t.id === activeItemToday.id) || null}
        nextItem={nextItemToday}
        isProcessingCommand={isProcessingCommand}
      />
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold text-foreground animate-slide-in-up">
        <Clock className="h-7 w-7 text-primary" /> Vibe Scheduler
      </h1>

      <WeatherWidget />

      <NowFocusCard
        activeItem={activeItemToday}
        nextItem={nextItemToday}
        T_current={T_current}
        onEnterFocusMode={() => setIsFocusModeActive(true)}
      />

      <CalendarStrip
        selectedDay={selectedDay}
        setSelectedDay={setSelectedDay}
        datesWithTasks={datesWithTasks}
        isLoadingDatesWithTasks={isLoadingDatesWithTasks}
      />

      {isTodaySelected && totalTasksCompletedToday > 0 && (
        <DailyVibeRecapCard
          scheduleSummary={currentSchedule?.summary || null}
          tasksCompletedToday={totalTasksCompletedToday}
          xpEarnedToday={totalXpEarnedToday}
          profileEnergy={profile?.energy || MAX_ENERGY}
          criticalTasksCompletedToday={currentSchedule?.summary.criticalTasksRemaining || 0}
          selectedDayString={selectedDay}
          completedScheduledTasks={completedTasksForSelectedDayList}
        />
      )}

      <SchedulerUtilityBar
        isProcessingCommand={isProcessingCommand}
        hasFlexibleTasksOnCurrentDay={hasFlexibleTasksOnCurrentDay}
        dbScheduledTasks={dbScheduledTasks}
        onRechargeEnergy={() => rechargeEnergy()}
        onRandomizeBreaks={() => randomizeBreaks({ selectedDate: formattedSelectedDay, workdayStartTime, workdayEndTime, currentDbTasks: dbScheduledTasks })}
        onSortFlexibleTasks={setSortBy}
        onOpenWorkdayWindowDialog={() => setShowWorkdayWindowDialog(true)}
        sortBy={sortBy}
        onCompactSchedule={handleCompactSchedule}
        onQuickScheduleBlock={handleQuickScheduleBlock}
        retiredTasksCount={retiredTasks.length}
        onZoneFocus={handleZoneFocus}
      />

      <EnvironmentMultiSelect />

      <SchedulerInput
        onCommand={handleCommand}
        isLoading={isProcessingCommand}
        inputValue={inputValue}
        setInputValue={setInputValue}
        onDetailedInject={handleOpenDetailedInject}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-9 p-1 bg-muted rounded-md">
          <TabsTrigger
            value="vibe-schedule"
            className="h-8 px-4 py-2 text-sm font-medium rounded-sm text-muted-foreground hover:bg-muted/50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm animate-hover-lift"
          >
            <Clock className="h-4 w-4 mr-2" /> Vibe Schedule
          </TabsTrigger>
          <TabsTrigger
            value="aether-sink"
            className="h-8 px-4 py-2 text-sm font-medium rounded-sm text-muted-foreground hover:bg-muted/50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm animate-hover-lift"
          >
            <Trash2 className="h-4 w-4 mr-2" /> Aether Sink ({retiredTasks.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="vibe-schedule" className="mt-4">
          <SchedulerDashboardPanel
            scheduleSummary={currentSchedule?.summary || null}
            onAetherDump={handleAetherDumpButton}
            isProcessingCommand={isProcessingCommand}
            hasFlexibleTasks={hasFlexibleTasksOnCurrentDay}
            onRefreshSchedule={handleRefreshSchedule}
          />

          <SchedulerDisplay
            schedule={currentSchedule}
            T_current={T_current}
            onRemoveTask={handlePermanentDeleteScheduledTask}
            onRetireTask={handleRetireTask}
            onCompleteTask={handleCompleteTask}
            activeItemId={activeItemToday?.id || null}
            selectedDayString={selectedDay}
            onAddTaskClick={handleOpenDetailedInject}
            onScrollToItem={handleScrollToItem}
          />
        </TabsContent>
        <TabsContent value="aether-sink" className="mt-4">
          <AetherSink
            retiredTasks={retiredTasks}
            onRezoneTask={handleRezoneTask}
            onRemoveRetiredTask={handlePermanentDeleteRetiredTask}
            onAutoScheduleSink={() => handleAutoScheduleAndSort('TIME_LATEST_TO_EARLIEST', 'sink-only')}
            isLoading={isLoadingRetiredTasks}
            isProcessingCommand={isProcessingCommand}
            profileEnergy={profile?.energy || MAX_ENERGY}
            retiredSortBy={retiredSortBy}
            setRetiredSortBy={setRetiredSortBy}
          />
        </TabsContent>
      </Tabs>

      <AlertDialog open={showClearConfirmation} onOpenChange={setShowClearConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will clear all *unlocked* tasks from your schedule for today. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessingCommand}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearSchedule} disabled={isProcessingCommand} className="bg-destructive hover:bg-destructive/90">
              {isProcessingCommand ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Clear Schedule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Scheduled Task Permanent Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteScheduledTaskConfirmation} onOpenChange={setShowDeleteScheduledTaskConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Permanent Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete "{scheduledTaskToDeleteName}" from your schedule? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessingCommand}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPermanentDeleteScheduledTask} disabled={isProcessingCommand} className="bg-destructive hover:bg-destructive/90">
              {isProcessingCommand ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Retired Task Permanent Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteRetiredTaskConfirmation} onOpenChange={setShowDeleteRetiredTaskConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Permanent Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete "{retiredTaskToDeleteName}" from the Aether Sink? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessingCommand}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPermanentDeleteRetiredTask} disabled={isProcessingCommand} className="bg-destructive hover:bg-destructive/90">
              {isProcessingCommand ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={injectionPrompt?.isOpen || false} onOpenChange={() => setInjectionPrompt(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Inject Task</DialogTitle>
            <DialogDescription>
              Provide details for the task you want to inject into the schedule.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); injectionPrompt && handleInjectionSubmit(injectionPrompt); }} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="inject-name">Task Name</Label>
              <Input
                id="inject-name"
                value={injectionPrompt?.taskName || ''}
                onChange={(e) => setInjectionPrompt(prev => prev ? { ...prev, taskName: e.target.value } : null)}
                placeholder="e.g., 'Project X Deep Work'"
                required
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isTimed"
                checked={injectionPrompt?.isTimed || false}
                onChange={(e) => setInjectionPrompt(prev => prev ? { ...prev, isTimed: e.target.checked } : null)}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
              />
              <Label htmlFor="isTimed">Timed Event (e.g., 10:00 - 11:00)</Label>
            </div>
            {injectionPrompt?.isTimed ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="inject-start-time">Start Time</Label>
                  <Input
                    id="inject-start-time"
                    type="time"
                    value={injectionPrompt?.startTime || injectionStartTime}
                    onChange={(e) => {
                      setInjectionStartTime(e.target.value);
                      setInjectionPrompt(prev => prev ? { ...prev, startTime: e.target.value } : null);
                    }}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inject-end-time">End Time</Label>
                  <Input
                    id="inject-end-time"
                    type="time"
                    value={injectionPrompt?.endTime || injectionEndTime}
                    onChange={(e) => {
                      setInjectionEndTime(e.target.value);
                      setInjectionPrompt(prev => prev ? { ...prev, endTime: e.target.value } : null);
                    }}
                    required
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="inject-duration">Duration (min)</Label>
                  <Input
                    id="inject-duration"
                    type="number"
                    value={injectionPrompt?.duration || injectionDuration}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setInjectionDuration(e.target.value);
                      setInjectionPrompt(prev => prev ? { ...prev, duration: isNaN(val) ? undefined : val } : null);
                    }}
                    min="1"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inject-break-duration">Break (min)</Label>
                  <Input
                    id="inject-break-duration"
                    type="number"
                    value={injectionPrompt?.breakDuration || injectionBreak}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setInjectionBreak(e.target.value);
                      setInjectionPrompt(prev => prev ? { ...prev, breakDuration: isNaN(val) ? undefined : val } : null);
                    }}
                    min="0"
                  />
                </div>
              </div>
            )}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isCritical"
                checked={injectionPrompt?.isCritical || false}
                onChange={(e) => setInjectionPrompt(prev => prev ? { ...prev, isCritical: e.target.checked } : null)}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
              />
              <Label htmlFor="isCritical">Critical Task</Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isFlexible"
                checked={injectionPrompt?.isFlexible || false}
                onChange={(e) => setInjectionPrompt(prev => prev ? { ...prev, isFlexible: e.target.checked } : null)}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
              />
              <Label htmlFor="isFlexible">Flexible Task (can be moved by scheduler)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isCustomEnergyCost"
                checked={injectionPrompt?.isCustomEnergyCost || false}
                onChange={(e) => setInjectionPrompt(prev => prev ? { ...prev, isCustomEnergyCost: e.target.checked } : null)}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
              />
              <Label htmlFor="isCustomEnergyCost">Custom Energy Cost</Label>
            </div>
            {injectionPrompt?.isCustomEnergyCost && (
              <div className="space-y-2">
                <Label htmlFor="energyCost">Energy Cost</Label>
                <Input
                  id="energyCost"
                  type="number"
                  value={injectionPrompt?.energyCost || 0}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setInjectionPrompt(prev => prev ? { ...prev, energyCost: isNaN(val) ? undefined : val } : null);
                  }}
                  min="0"
                  required
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="taskEnvironment">Task Environment</Label>
              <select
                id="taskEnvironment"
                value={injectionPrompt?.taskEnvironment || environmentForPlacement}
                onChange={(e) => setInjectionPrompt(prev => prev ? { ...prev, taskEnvironment: e.target.value as TaskEnvironment } : null)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {environmentOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isProcessingCommand}>
                {isProcessingCommand ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Inject Task
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <WorkdayWindowDialog
        open={showWorkdayWindowDialog}
        onOpenChange={setShowWorkdayWindowDialog}
      />

      <EarlyCompletionModal
        isOpen={showEarlyCompletionModal}
        onOpenChange={setShowEarlyCompletionModal}
        taskName={earlyCompletionTaskName}
        remainingDurationMinutes={earlyCompletionRemainingMinutes}
        onTakeBreak={() => handleEarlyCompletionAction('takeBreak')}
        onStartNextTask={() => handleEarlyCompletionAction('startNext')}
        onJustFinish={() => handleEarlyCompletionAction('justFinish')}
        isProcessingCommand={isProcessingCommand}
        hasNextTask={!!nextItemToday}
      />
    </div>
  );
};

export default SchedulerPage;