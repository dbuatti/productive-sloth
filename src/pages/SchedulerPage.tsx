import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, ListTodo, Sparkles, Loader2, AlertTriangle, Trash2, ChevronsUp, Star, ArrowDownWideNarrow, ArrowUpWideNarrow, Shuffle, CalendarOff, RefreshCcw, Globe, Zap, Settings2, Menu } from 'lucide-react';
import SchedulerInput from '@/components/SchedulerInput';
import SchedulerDisplay from '@/components/SchedulerDisplay';
import { FormattedSchedule, DBScheduledTask, ScheduledItem, NewDBScheduledTask, RetiredTask, NewRetiredTask, SortBy, TaskPriority, AutoBalancePayload, UnifiedTask, TimeBlock, TaskEnvironment, CompletedTaskLogEntry } from '@/types/scheduler';
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
  isMeal,
} from '@/lib/scheduler-utils';
import { showSuccess, showError } from '@/utils/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import { useSession } from '@/hooks/use-session';
import { parse, startOfDay, setHours, setMinutes, format, isSameDay, addDays, addMinutes, parseISO, isBefore, isAfter, isPast, format as formatFns, subDays, differenceInMinutes, addHours } from 'date-fns';
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
import WorkdayWindowDialog from '@/components/WorkdayWindowDialog';
import ScheduledTaskDetailDialog from '@/components/ScheduledTaskDetailDialog';
import ImmersiveFocusMode from '@/components/ImmersiveFocusMode';
import EarlyCompletionModal from '@/components/EarlyCompletionModal';
import DailyVibeRecapCard from '@/components/DailyVibeRecapCard';
import { LOW_ENERGY_THRESHOLD, MAX_ENERGY, REGEN_POD_MAX_DURATION_MINUTES, REGEN_POD_RATE_PER_MINUTE } from '@/lib/constants';
import EnvironmentMultiSelect from '@/components/EnvironmentMultiSelect';
import { useEnvironmentContext } from '@/hooks/use-environment-context';
import EnergyDeficitConfirmationDialog from '@/components/EnergyDeficitConfirmationDialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import EnergyRegenPodModal from '@/components/EnergyRegenPodModal';
import SchedulerSegmentedControl from '@/components/SchedulerSegmentedControl';
import SchedulerContextBar from '@/components/SchedulerContextBar';
import SchedulerActionCenter from '@/components/SchedulerActionCenter';
import { cn } from '@/lib/utils';

const DURATION_BUCKETS = [5, 10, 15, 20, 25, 30, 45, 60, 75, 90];
const LONG_TASK_THRESHOLD = 90;

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
  isBackburner?: boolean; // NEW: Backburner flag
  energyCost?: number;
  isCustomEnergyCost?: boolean;
  taskEnvironment?: TaskEnvironment;
}

interface SchedulerPageProps {
  view: 'schedule' | 'sink' | 'recap';
}

const SUPABASE_PROJECT_ID = "yfgapigmiyclgryqdgne";
const SUPABASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co`;

const SchedulerPage: React.FC<SchedulerPageProps> = ({ view }) => {
  const { user, profile, isLoading: isSessionLoading, rechargeEnergy, T_current, activeItemToday, nextItemToday, refreshProfile, session, startRegenPodState, exitRegenPodState, regenPodDurationMinutes, triggerEnergyRegen, dynamicMealBlocksToday } = useSession(); // NEW: Get dynamicMealBlocksToday
  const { selectedEnvironments } = useEnvironmentContext();
  const environmentForPlacement = selectedEnvironments[0] || 'laptop';
  
  // Always default to today's date, ignoring localStorage
  const [selectedDay, setSelectedDay] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  
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

  // NEW: Energy Regen Pod State (Derived from profile)
  const isRegenPodActive = profile?.is_in_regen_pod ?? false;
  const regenPodStartTime = profile?.regen_pod_start_time ? parseISO(profile.regen_pod_start_time) : null;
  
  // NEW: Pod Activity State (Internal to SchedulerPage for modal communication)
  const [showPodSetupModal, setShowPodSetupModal] = useState(false); 
  const [calculatedPodDuration, setCalculatedPodDuration] = useState(0); 


  // Removed: Persistence effects for selectedDay

  // NEW: Handler for Quick Break Button (MOVED FROM LOCAL DEFINITION)
  const handleQuickBreakButton = useCallback(async () => {
    if (!user || !profile) {
        showError("Please log in to add a quick break.");
        return;
    }
    setIsProcessingCommand(true);
    try {
        const breakDuration = 15;
        const breakStartTime = T_current;
        const breakEndTime = addMinutes(breakStartTime, breakDuration);
        const scheduledDate = formatFns(T_current, 'yyyy-MM-dd');

        await addScheduledTask({
            name: 'Quick Break',
            start_time: breakStartTime.toISOString(),
            end_time: breakEndTime.toISOString(),
            break_duration: breakDuration,
            scheduled_date: scheduledDate,
            is_critical: false,
            is_flexible: false, // Fixed for immediate use
            is_locked: true, // Locked for immediate use
            energy_cost: 0, // Breaks have 0 energy cost (but trigger regen)
            is_custom_energy_cost: false,
            task_environment: environmentForPlacement,
            is_backburner: false, // NEW: Default to false
        });
        
        // Trigger energy regen immediately upon starting a break
        await triggerEnergyRegen();

        showSuccess(`Scheduled a ${breakDuration}-minute Quick Break! Energy boost applied.`);
        queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
    } catch (error: any) {
        showError(`Failed to add quick break: ${error.message}`);
    } finally {
        setIsProcessingCommand(false);
    }
  }, [user, profile, T_current, addScheduledTask, environmentForPlacement, triggerEnergyRegen, queryClient]);


  const selectedDayAsDate = useMemo(() => {
    const [year, month, day] = selectedDay.split('-').map(Number);
    return new Date(year, month - 1, day); // Creates a local Date object for 00:00:00 of that day
  }, [selectedDay]);

  const occupiedBlocks = useMemo(() => {
    if (!dbScheduledTasks) return [];
    const mappedTimes = dbScheduledTasks
      .filter(task => task.start_time && task.end_time)
      .map(task => {
        const utcStart = parseISO(task.start_time!);
        const utcEnd = parseISO(task.end_time!);

        let localStart = setTimeOnDate(selectedDayAsDate, format(utcStart, 'HH:mm'));
        let localEnd = setTimeOnDate(selectedDayAsDate, format(utcEnd, 'HH:mm'));

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
        isBackburner: false, // Default to false when scheduling from task list
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
          setSelectedDay(formatFns(newDate, 'yyyy-MM-dd'));
          break;
        case 'ArrowRight':
          event.preventDefault();
          newDate = addDays(currentSelectedDate, 1);
          setSelectedDay(formatFns(newDate, 'yyyy-MM-dd'));
          break;
        case ' ':
          event.preventDefault();
          setSelectedDay(formatFns(new Date(), 'yyyy-MM-dd'));
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

  // Memoize workday start/end for the *currently selected day*
  const workdayStartTimeForSelectedDay = useMemo(() => profile?.default_auto_schedule_start_time 
    ? setTimeOnDate(selectedDayAsDate, profile.default_auto_schedule_start_time) 
    : startOfDay(selectedDayAsDate), [profile?.default_auto_schedule_start_time, selectedDayAsDate]);
  
  let workdayEndTimeForSelectedDay = useMemo(() => profile?.default_auto_schedule_end_time 
    ? setTimeOnDate(startOfDay(selectedDayAsDate), profile.default_auto_schedule_end_time) 
    : addHours(startOfDay(selectedDayAsDate), 17), [profile?.default_auto_schedule_end_time, selectedDayAsDate]);

  workdayEndTimeForSelectedDay = useMemo(() => {
    if (isBefore(workdayEndTimeForSelectedDay, workdayStartTimeForSelectedDay)) {
      return addDays(workdayEndTimeForSelectedDay, 1);
    }
    return workdayEndTimeForSelectedDay;
  }, [workdayEndTimeForSelectedDay, workdayStartTimeForSelectedDay]);

  const effectiveWorkdayStartForSelectedDay = useMemo(() => {
    if (isSameDay(selectedDayAsDate, T_current) && isBefore(workdayStartTimeForSelectedDay, T_current)) {
      return T_current;
    }
    return workdayStartTimeForSelectedDay;
  }, [selectedDayAsDate, T_current, workdayStartTimeForSelectedDay]);

  const previousCalculatedScheduleRef = useRef<FormattedSchedule | null>(null);

  const calculatedSchedule = useMemo(() => {
    if (!profile) return null;
    // Use workday window for the currently selected day
    const currentDayDate = selectedDayAsDate;
    const currentWorkdayStart = workdayStartTimeForSelectedDay;
    const currentWorkdayEnd = workdayEndTimeForSelectedDay;

    const newSchedule = calculateSchedule(
      dbScheduledTasks, 
      selectedDay, 
      currentWorkdayStart, // Pass currentWorkdayStart
      currentWorkdayEnd,   // Pass currentWorkdayEnd
      profile.is_in_regen_pod, // NEW
      profile.regen_pod_start_time ? parseISO(profile.regen_pod_start_time) : null, // NEW
      regenPodDurationMinutes, // NEW
      T_current, // NEW
      profile.breakfast_time, // NEW
      profile.lunch_time,     // NEW
      profile.dinner_time,    // NEW
      profile.breakfast_duration_minutes, // NEW: Added breakfast duration
      profile.lunch_duration_minutes,     // NEW: Added lunch duration
      profile.dinner_duration_minutes     // NEW: Added dinner duration
    );
    return newSchedule;
  }, [dbScheduledTasks, selectedDay, workdayStartTimeForSelectedDay, workdayEndTimeForSelectedDay, profile, regenPodDurationMinutes, T_current]);

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

        const taskEndTime = setTimeOnDate(currentDay, formatFns(parseISO(task.end_time), 'HH:mm'));
        
        const workdayStart = profile.default_auto_schedule_start_time
          ? setTimeOnDate(currentDay, profile.default_auto_schedule_start_time)
          : startOfDay(currentDay);

        return isBefore(taskEndTime, workdayStart) && isAfter(now, workdayStart);
      });

      if (tasksToRetire.length > 0) {
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
    currentDayDate: Date, // NEW
    currentWorkdayStart: Date, // NEW
    currentWorkdayEnd: Date // NEW
  ): Promise<{ proposedStartTime: Date | null, proposedEndTime: Date | null, message: string }> => {
    let proposedStartTime: Date | null = null;
    
    const lockedTaskBlocks = dbScheduledTasks
      .filter(task => task.is_locked && task.start_time && task.end_time)
      .map(task => {
        const utcStart = parseISO(task.start_time!);
        const utcEnd = parseISO(task.end_time!);

        let localStart = setTimeOnDate(currentDayDate, format(utcStart, 'HH:mm')); // Use currentDayDate
        let localEnd = setTimeOnDate(currentDayDate, format(utcEnd, 'HH:mm')); // Use currentDayDate

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

    const allOccupiedBlocks = mergeOverlappingTimeBlocks([...existingOccupiedBlocks, ...lockedTaskBlocks, ...dynamicMealBlocksToday]); // NEW: Include dynamicMealBlocksToday
    const freeBlocks = getFreeTimeBlocks(allOccupiedBlocks, currentWorkdayStart, currentWorkdayEnd); // Use currentWorkdayStart/End

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
      const message = `No available slot found within your workday (${formatTime(currentWorkdayStart)} - ${formatTime(currentWorkdayEnd)}) for "${taskName}" (${taskDuration} min).`;
      return { proposedStartTime: null, proposedEndTime: null, message: message };
    }
  }, [dbScheduledTasks, dynamicMealBlocksToday]); // Dependencies for findFreeSlotForTask

  const handleRefreshSchedule = useCallback(() => {
    if (user?.id) {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', user.id, formattedSelectedDay, sortBy] });
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', user.id] });
      queryClient.invalidateQueries({ queryKey: ['completedTasksForSelectedDayList', user.id, formattedSelectedDay] });
      showSuccess("Schedule data refreshed.");
    }
  }, [user?.id, queryClient, formattedSelectedDay, sortBy]);

  const handleQuickScheduleBlock = useCallback(async (duration: number, sortPreference: 'longestFirst' | 'shortestFirst') => {
    if (!user || !profile) {
      showError("Please log in and ensure your profile is loaded to quick schedule.");
      return;
    }
    setIsProcessingCommand(true);

    try {
      // 1. Get eligible tasks from Aether Sink
      let eligibleSinkTasks = retiredTasks
        .filter(task => !task.is_locked && !task.is_completed)
        .map(task => ({
          ...task,
          // Ensure duration is a number for sorting, default to 30 if null
          effectiveDuration: task.duration || 30,
          totalDuration: (task.duration || 30) + (task.break_duration || 0),
        }));

      if (eligibleSinkTasks.length === 0) {
        showError("Aether Sink is empty. Cannot quick schedule tasks.");
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

      let remainingDuration = duration;
      const tasksToPlace: typeof eligibleSinkTasks = [];
      
      // 3. Select tasks until the duration is filled
      for (const task of eligibleSinkTasks) {
        if (task.effectiveDuration <= remainingDuration) {
          tasksToPlace.push(task);
          remainingDuration -= task.effectiveDuration;
        }
      }
      
      if (tasksToPlace.length === 0) {
          showError(`No tasks in the Aether Sink fit within the ${duration} minute block.`);
          return;
      }

      // Use workday window for the currently selected day
      const currentDayDate = selectedDayAsDate;
      const currentWorkdayStart = workdayStartTimeForSelectedDay;
      const currentWorkdayEnd = workdayEndTimeForSelectedDay;
      const currentEffectiveWorkdayStart = effectiveWorkdayStartForSelectedDay;

      // 4. Find the first available free slot large enough to hold the *first* task
      let currentOccupiedBlocksForScheduling = [...occupiedBlocks, ...dynamicMealBlocksToday]; // NEW: Include dynamicMealBlocksToday
      let freeBlocks = getFreeTimeBlocks(currentOccupiedBlocksForScheduling, currentEffectiveWorkdayStart, currentWorkdayEnd); // Use currentEffectiveWorkdayStart, currentWorkdayEnd
      
      const firstTaskTotalDuration = tasksToPlace[0].totalDuration;
      const initialFreeBlock = freeBlocks.find(block => block.duration >= firstTaskTotalDuration);

      if (!initialFreeBlock) {
          showError(`No available slot found within your workday (${formatTime(currentWorkdayStart)} - ${formatTime(currentWorkdayEnd)}) to start the quick block.`); // Use currentWorkdayStart, currentWorkdayEnd
          return;
      }

      let currentPlacementTime = initialFreeBlock.start;
      let tasksSuccessfullyPlaced = 0;

      // 5. Sequentially place the selected tasks
      for (const task of tasksToPlace) {
        const taskDuration = task.duration;
        const breakDuration = task.break_duration || 0;
        const totalDuration = taskDuration + breakDuration;
        
        const proposedStartTime = currentPlacementTime;
        const proposedEndTime = addMinutes(proposedStartTime, totalDuration);

        // Check if the proposed slot is still within the workday and free
        if (isAfter(proposedEndTime, currentWorkdayEnd)) { // Use currentWorkdayEnd
            break;
        }
        
        // Re-check slot freedom against the dynamically updated occupied blocks
        if (isSlotFree(proposedStartTime, proposedEndTime, currentOccupiedBlocksForScheduling)) {
            // 5a. Add the task to scheduled_tasks
            await addScheduledTask({
                name: task.name,
                start_time: proposedStartTime.toISOString(),
                end_time: proposedEndTime.toISOString(),
                break_duration: task.break_duration,
                scheduled_date: formattedSelectedDay,
                is_critical: task.is_critical,
                is_flexible: true, // Quick scheduled tasks are flexible by default
                is_locked: false,
                energy_cost: task.energy_cost,
                is_custom_energy_cost: task.is_custom_energy_cost,
                task_environment: task.task_environment,
                is_backburner: task.is_backburner, // NEW: Pass backburner status
            });
            
            // 5b. Update local occupied blocks and cursor
            currentOccupiedBlocksForScheduling.push({ start: proposedStartTime, end: proposedEndTime, duration: totalDuration });
            currentOccupiedBlocksForScheduling = mergeOverlappingTimeBlocks(currentOccupiedBlocksForScheduling);
            currentPlacementTime = proposedEndTime;
            tasksSuccessfullyPlaced++;
        } else {
            break;
        }
      }
      
      // 6. Remove successfully placed tasks from Aether Sink
      if (tasksSuccessfullyPlaced > 0) {
          const placedIds = tasksToPlace.slice(0, tasksSuccessfullyPlaced).map(t => t.id);
          
          await Promise.all(placedIds.map(id => rezoneTask(id)));
          
          showSuccess(`Quick Scheduled ${tasksSuccessfullyPlaced} tasks (${duration - remainingDuration} min) from the Aether Sink.`);
          queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
      } else {
          showError("Allocation failed: Could not place any tasks in the schedule.");
      }

    } catch (error: any) {
      showError(`Failed to quick schedule: ${error.message}`);
    } finally {
      setIsProcessingCommand(false);
    }
  }, [user, profile, retiredTasks, occupiedBlocks, workdayStartTimeForSelectedDay, workdayEndTimeForSelectedDay, effectiveWorkdayStartForSelectedDay, addScheduledTask, rezoneTask, formattedSelectedDay, selectedDayAsDate, queryClient, dynamicMealBlocksToday]);

  const handleCompactSchedule = useCallback(async () => {
    if (!user || !profile) {
        showError("Please log in and ensure your profile is loaded to compact the schedule.");
        return;
    }
    // Use the current dbScheduledTasks from the query cache directly
    const currentDbTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', user.id, formattedSelectedDay, sortBy]) || [];

    if (!currentDbTasks.some(task => task.is_flexible && !task.is_locked)) {
        showSuccess("No flexible tasks to compact, fixed/locked tasks were skipped.");
        return;
    }

    setIsProcessingCommand(true);
    try {
        const compactedTasks = compactScheduleLogic(
            currentDbTasks, // Pass the current tasks
            selectedDayAsDate,
            workdayStartTimeForSelectedDay, // Pass workdayStartTimeForSelectedDay
            workdayEndTimeForSelectedDay,   // Pass workdayEndTimeForSelectedDay
            T_current,
            dynamicMealBlocksToday // NEW: Pass dynamicMealBlocksToday
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
    } finally {
        setIsProcessingCommand(false);
    }
  }, [user, profile, selectedDayAsDate, workdayStartTimeForSelectedDay, workdayEndTimeForSelectedDay, T_current, compactScheduledTasks, queryClient, formattedSelectedDay, sortBy, dynamicMealBlocksToday]);

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
            workdayStartTimeForSelectedDay, // Pass workdayStartTimeForSelectedDay
            workdayEndTimeForSelectedDay,   // Pass workdayEndTimeForSelectedDay
            T_current,
            dynamicMealBlocksToday // NEW: Pass dynamicMealBlocksToday
        );
        const tasksToUpdate = compactedTasks.filter(t => t.start_time && t.end_time);

        if (tasksToUpdate.length > 0) {
            await compactScheduledTasks({ tasksToUpdate });
            showSuccess("Schedule compacted after deletion.");
        } else {
            showSuccess("No flexible tasks to compact after deletion.");
        }
      } catch (compactionError: any) {
        showError(`Failed to compact schedule after deletion: ${compactionError.message}`);
      }

      // Scroll to the active item or the next item after deletion/compaction
      if (activeItemToday) {
        handleScrollToItem(activeItemToday.id);
      } else if (nextItemToday) {
        handleScrollToItem(nextItemToday.id);
      } else if (scheduleContainerRef.current) {
        scheduleContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
      
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
    } catch (error: any) {
      showError(`Failed to delete task: ${error.message}`);
    } finally {
      setIsProcessingCommand(false);
      setShowDeleteScheduledTaskConfirmation(false);
      setScheduledTaskToDeleteId(null);
      setScheduledTaskToDeleteName(null);
      setScheduledTaskToDeleteIndex(null);
    }
  }, [scheduledTaskToDeleteId, scheduledTaskToDeleteName, scheduledTaskToDeleteIndex, user, removeScheduledTask, activeItemToday, nextItemToday, queryClient, handleScrollToItem, formattedSelectedDay, sortBy, selectedDayAsDate, workdayStartTimeForSelectedDay, workdayEndTimeForSelectedDay, T_current, compactScheduledTasks, dynamicMealBlocksToday]);

  // Confirmation handler for retired task permanent deletion
  const confirmPermanentDeleteRetiredTask = useCallback(async () => {
    if (!retiredTaskToDeleteId || !user) return;
    setIsProcessingCommand(true);
    try {
      await removeRetiredTask(retiredTaskToDeleteId);
      showSuccess(`Retired task "${retiredTaskToDeleteName}" permanently deleted.`);
    } catch (error: any) {
      showError(`Failed to delete retired task: ${error.message}`);
    } finally {
      setIsProcessingCommand(false);
      setShowDeleteRetiredTaskConfirmation(false);
      setRetiredTaskToDeleteId(null);
      setRetiredTaskToDeleteName(null);
    }
  }, [retiredTaskToDeleteId, retiredTaskToDeleteName, user, removeRetiredTask]);

  const handleAetherDumpButton = useCallback(async () => {
    if (!user) {
      showError("You must be logged in to perform Aether Dump.");
      return;
    }
    setIsProcessingCommand(true);

    try {
      await aetherDump();
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
    } catch (error) {
    } finally {
      setIsProcessingCommand(false);
    }
  }, [user, aetherDump, queryClient]);

  // FIX: Define handleAetherDumpMegaButton
  const handleAetherDumpMegaButton = useCallback(async () => {
    if (!user) {
      showError("You must be logged in to perform Aether Dump Mega.");
      return;
    }
    setIsProcessingCommand(true);

    try {
      await aetherDumpMega();
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
    } catch (error) {
    } finally {
      setIsProcessingCommand(false);
    }
  }, [user, aetherDumpMega, queryClient]);

  const handleClearSchedule = useCallback(async () => {
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
    } else {
      // Success toast and query invalidation are now handled in useSchedulerTasks' onSettled
    }

    setIsProcessingCommand(false);
    setShowClearConfirmation(false);
    setInputValue('');
  }, [user, dbScheduledTasks, formattedSelectedDay]);

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
        return false;
    }

    eligibleSinkTasks.sort((a, b) => {
        if (a.is_critical && !b.is_critical) return -1;
        if (!a.is_critical && b.is_critical) return 1;
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
          is_backburner: taskToPlace.is_backburner, 
        });
        // Declare currentOccupiedBlocksForScheduling locally within this function
        let currentOccupiedBlocksForScheduling = [...occupiedBlocks, ...dynamicMealBlocksToday]; // NEW: Include dynamicMealBlocksToday
        currentOccupiedBlocksForScheduling.push({ start: proposedStartTime, end: proposedEndTime, duration: taskDuration });
        currentOccupiedBlocksForScheduling = mergeOverlappingTimeBlocks(currentOccupiedBlocksForScheduling);

        return true;
    } catch (error: any) {
        showError(`Failed to fill gap with sink task: ${error.message}`);
        return false;
    }
  }, [user, profile, retiredTasks, rezoneTask, addScheduledTask, formattedSelectedDay, occupiedBlocks, dynamicMealBlocksToday]);

  // NEW: Generic auto-schedule and sort function
  const handleAutoScheduleAndSort = useCallback(async (
    sortPreference: SortBy,
    taskSource: 'all-flexible' | 'sink-only',
    environmentsToFilterBy: TaskEnvironment[] = [],
    targetDateString: string // Renamed to avoid confusion with Date object
  ) => {
    if (!user || !profile) {
      showError("Please log in and ensure your profile is loaded to auto-schedule.");
      return;
    }

    const currentTargetDate = parseISO(targetDateString); // Use targetDateString
    const today = startOfDay(new Date());
    if (isBefore(currentTargetDate, today)) {
      showError("Cannot auto-schedule for a past day. Please select today or a future day.");
      return;
    }

    setIsProcessingCommand(true);

    try {
      // Derive workday start/end for the targetDateString
      const targetWorkdayStart = profile?.default_auto_schedule_start_time 
        ? setTimeOnDate(currentTargetDate, profile.default_auto_schedule_start_time) 
        : startOfDay(currentTargetDate);
      let targetWorkdayEnd = profile?.default_auto_schedule_end_time 
        ? setTimeOnDate(startOfDay(currentTargetDate), profile.default_auto_schedule_end_time) 
        : addHours(startOfDay(currentTargetDate), 17);
      if (isBefore(targetWorkdayEnd, targetWorkdayStart)) {
        targetWorkdayEnd = addDays(targetWorkdayEnd, 1);
      }
      const effectiveTargetWorkdayStart = isSameDay(currentTargetDate, T_current) && isBefore(targetWorkdayStart, T_current) ? T_current : targetWorkdayStart;

      // Fetch tasks for the targetDate specifically
      const { data: dbScheduledTasksForTargetDate, error: fetchScheduledError } = await supabase
        .from('scheduled_tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('scheduled_date', targetDateString); // Use targetDateString

      if (fetchScheduledError) throw new Error(`Failed to fetch scheduled tasks for target date: ${fetchScheduledError.message}`);

      const existingFixedTasks = dbScheduledTasksForTargetDate.filter(task => !task.is_flexible || task.is_locked);
      const flexibleScheduledTasks = dbScheduledTasksForTargetDate.filter(task => task.is_flexible && !task.is_locked);
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
          is_backburner: task.is_backburner,
        });
      });

      // --- CRITICAL FIX: Auto-retire past-due, uncompleted, flexible scheduled tasks ---
      const pastDueScheduledTasks = flexibleScheduledTasks.filter(task => {
          if (!task.start_time || task.is_completed) return false;
          
          const taskStartTime = parseISO(task.start_time);
          // Check if the task's start time is before T_current AND it's today's schedule
          return isSameDay(currentTargetDate, T_current) && isBefore(taskStartTime, T_current);
      });

      pastDueScheduledTasks.forEach(task => {
          if (!scheduledTaskIdsToDelete.includes(task.id)) {
              scheduledTaskIdsToDelete.push(task.id);
              tasksToKeepInSink.push({
                  user_id: user.id,
                  name: task.name,
                  duration: Math.floor((parseISO(task.end_time!).getTime() - parseISO(task.start_time!).getTime()) / (1000 * 60)),
                  break_duration: task.break_duration,
                  original_scheduled_date: targetDateString,
                  is_critical: task.is_critical,
                  is_locked: false,
                  energy_cost: task.energy_cost,
                  is_completed: false,
                  is_custom_energy_cost: task.is_custom_energy_cost,
                  task_environment: task.task_environment,
                  is_backburner: task.is_backburner,
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
            is_backburner: task.is_backburner,
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
          is_flexible: true, // <-- FIX: Retired tasks are flexible for scheduling
          is_backburner: task.is_backburner,
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

      // --- NEW: Tiered Sorting Logic ---
      let sortedTasks = [...tasksToConsider].sort((a, b) => {
        // 1. Primary Sort: Critical (High) > Neutral (Standard) > Backburner (Low)
        if (a.is_critical && !b.is_critical) return -1;
        if (!a.is_critical && b.is_critical) return 1;
        if (a.is_backburner && !b.is_backburner) return 1;
        if (!a.is_backburner && b.is_backburner) return -1;

        // 2. Secondary Sort: Apply user's sort preference within each tier
        switch (sortPreference) {
          case 'TIME_EARLIEST_TO_LATEST': // Shortest Duration First
            return (a.duration || 0) - (b.duration || 0);
          case 'TIME_LATEST_TO_EARLIEST': // Longest Duration First
            return (b.duration || 0) - (a.duration || 0);
          case 'PRIORITY_HIGH_TO_LOW':
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
      // --- END NEW: Tiered Sorting Logic ---

      let currentOccupiedBlocks = mergeOverlappingTimeBlocks([
        ...existingFixedTasks
          .filter(task => task.start_time && task.end_time)
          .map(task => {
            const start = setTimeOnDate(currentTargetDate, formatFns(parseISO(task.start_time!), 'HH:mm'));
            let end = setTimeOnDate(currentTargetDate, formatFns(parseISO(task.end_time!), 'HH:mm'));
            if (isBefore(end, start)) end = addDays(end, 1);
            return { start, end, duration: differenceInMinutes(end, start) };
          }),
        ...dynamicMealBlocksToday.map(block => ({ // NEW: Include dynamicMealBlocksToday
          start: block.start,
          end: block.end,
          duration: block.duration,
        }))
      ]);

      let currentPlacementTime = effectiveTargetWorkdayStart; // Use effectiveTargetWorkdayStart for the current day

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
              original_scheduled_date: targetDateString,
              is_critical: task.is_critical,
              is_locked: false,
              energy_cost: task.energy_cost,
              is_completed: false,
              is_custom_energy_cost: task.is_custom_energy_cost,
              task_environment: task.task_environment,
              is_backburner: task.is_backburner,
            });
            scheduledTaskIdsToDelete.push(task.originalId);
          } else if (task.source === 'retired') {
            // If it's already in sink, it stays in sink (no action needed for tasksToKeepInSink)
          }
          continue;
        }

        while (isBefore(searchTime, targetWorkdayEnd)) {
          const freeBlocks = getFreeTimeBlocks(currentOccupiedBlocks, searchTime, targetWorkdayEnd);
          
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
                scheduled_date: targetDateString,
                is_critical: task.is_critical,
                is_flexible: true,
                is_locked: false,
                energy_cost: task.energy_cost,
                is_completed: false,
                is_custom_energy_cost: task.is_custom_energy_cost,
                task_environment: task.task_environment,
                is_backburner: task.is_backburner,
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
              original_scheduled_date: targetDateString,
              is_critical: task.is_critical,
              is_locked: false,
              energy_cost: task.energy_cost,
              is_completed: false,
              is_custom_energy_cost: task.is_custom_energy_cost,
              task_environment: task.task_environment,
              is_backburner: task.is_backburner,
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
              original_scheduled_date: targetDateString,
              is_critical: task.is_critical,
              is_locked: false,
              energy_cost: task.energy_cost,
              is_completed: false,
              is_custom_energy_cost: task.is_custom_energy_cost,
              task_environment: task.task_environment,
              is_backburner: task.is_backburner,
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
        selectedDate: targetDateString, // Use targetDateString
        dynamicOccupiedBlocks: dynamicMealBlocksToday.map(block => ({ // NEW: Pass dynamic occupied blocks
          start: block.start.toISOString(),
          end: block.end.toISOString(),
          duration: block.duration,
        })),
      };

      await autoBalanceSchedule(payload);
      showSuccess(`Schedule auto-balanced for ${targetDateString}!`); // Use targetDateString
      setSortBy('TIME_EARLIEST_TO_LATEST');
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
      setIsProcessingCommand(false);
    } catch (error: any) {
      showError(`Failed to auto-schedule: ${error.message}`);
    } finally {
      setIsProcessingCommand(false);
    }
  }, [user, profile, retiredTasks, T_current, autoBalanceSchedule, queryClient, LOW_ENERGY_THRESHOLD, dynamicMealBlocksToday]);

  const handleCommand = useCallback(async (input: string) => {
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

    let currentOccupiedBlocksForScheduling = [...occupiedBlocks, ...dynamicMealBlocksToday]; // NEW: Include dynamicMealBlocksToday

    // Use workday window for the currently selected day
    const currentDayDate = selectedDayAsDate;
    const currentWorkdayStart = workdayStartTimeForSelectedDay;
    const currentWorkdayEnd = workdayEndTimeForSelectedDay;
    const currentEffectiveWorkdayStart = effectiveWorkdayStartForSelectedDay;


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
          is_backburner: parsedInput.isBackburner, // NEW: Pass backburner status
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
            currentDayDate, // Pass currentDayDate
            currentEffectiveWorkdayStart, // Pass currentEffectiveWorkdayStart
            currentWorkdayEnd // Pass currentWorkdayEnd
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
              is_backburner: parsedInput.isBackburner, // NEW: Pass backburner status
            }); 
            currentOccupiedBlocksForScheduling.push({ start: proposedStartTime, end: proposedEndTime, duration: newTaskDuration });
            currentOccupiedBlocksForScheduling = mergeOverlappingTimeBlocks(currentOccupiedBlocksForScheduling);

            showSuccess(`Scheduled "${parsedInput.name}" from ${formatTime(proposedStartTime)} to ${formatTime(proposedEndTime)}.`);
            success = true;
          } else {
            showError(message);
          }

        } else {
          let startTime = setTimeOnDate(selectedDayAsDate, format(parsedInput.startTime!, 'HH:mm'));
          let endTime = setTimeOnDate(selectedDayAsDate, format(parsedInput.endTime!, 'HH:mm'));
          
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
            is_backburner: parsedInput.isBackburner, // NEW: Pass backburner status
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
        
        // Recalculate energy cost based on task name if it's a meal
        const isMealTask = isMeal(injectCommand.taskName);
        const calculatedEnergyCost = isMealTask ? -10 : calculateEnergyCost(injectedTaskDuration, injectCommand.isCritical ?? false, injectCommand.isBackburner ?? false);

        const { proposedStartTime, proposedEndTime, message } = await findFreeSlotForTask(
          injectCommand.taskName,
          injectedTaskDuration,
          injectCommand.isCritical,
          injectCommand.isFlexible,
          calculatedEnergyCost,
          currentOccupiedBlocksForScheduling,
          currentDayDate, // Pass currentDayDate
          currentEffectiveWorkdayStart, // Pass currentEffectiveWorkdayStart
          currentWorkdayEnd // Pass currentWorkdayEnd
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
            energy_cost: calculatedEnergyCost,
            is_custom_energy_cost: false,
            task_environment: environmentForPlacement,
            is_backburner: injectCommand.isBackburner,
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
          isBackburner: injectCommand.isBackburner, // NEW: Pass backburner status
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
          isBackburner: injectCommand.isBackburner, // NEW: Pass backburner status
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
            startTime: formatFns(T_current, 'h:mm a'),
            endTime: formatFns(addHours(T_current, 1), 'h:mm a'),
            isCritical: false,
            isFlexible: false,
            isBackburner: false,
            energyCost: 0,
            breakDuration: undefined,
            isCustomEnergyCost: false,
            taskEnvironment: 'away',
          });
          setInjectionStartTime(formatFns(T_current, 'h:mm a'));
          setInjectionEndTime(formatFns(addHours(T_current, 1), 'h:mm a'));
          setInjectionDuration('');
          setInjectionBreak('');
          setInputValue('');
          success = true;
          break;
        case 'aether dump':
        case 'reset schedule':
          await aetherDump();
          queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
          success = true;
          break;
        case 'aether dump mega':
          await handleAetherDumpMegaButton(); // Use the new handler
          success = true;
          break;
        case 'break':
          // Immediate break trigger
          const breakDuration = command.duration || 15;
          const breakStartTime = T_current;
          const breakEndTime = addMinutes(breakStartTime, breakDuration);
          const scheduledDate = formatFns(T_current, 'yyyy-MM-dd');

          await addScheduledTask({
            name: 'Quick Break',
            start_time: breakStartTime.toISOString(),
            end_time: breakEndTime.toISOString(),
            break_duration: breakDuration,
            scheduled_date: scheduledDate,
            is_critical: false,
            is_flexible: false, // Quick breaks are fixed/locked for immediate use
            is_locked: true,
            energy_cost: 0,
            is_custom_energy_cost: false,
            task_environment: environmentForPlacement,
            is_backburner: false,
          });
          
          // NEW: Trigger energy regen immediately upon starting a break
          await triggerEnergyRegen();

          showSuccess(`Scheduled a ${breakDuration}-minute break! Energy boost applied.`);
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
  }, [user, profile, selectedDayAsDate, formattedSelectedDay, occupiedBlocks, workdayStartTimeForSelectedDay, workdayEndTimeForSelectedDay, effectiveWorkdayStartForSelectedDay, addRetiredTask, addScheduledTask, environmentForPlacement, T_current, handlePermanentDeleteScheduledTask, dbScheduledTasks, aetherDump, queryClient, handleAetherDumpMegaButton, triggerEnergyRegen, findFreeSlotForTask, dynamicMealBlocksToday]);

  const handleInjectionSubmit = useCallback(async () => {
    if (!user || !profile) {
      showError("You must be logged in and your profile loaded to use the scheduler.");
      return;
    }
    setIsProcessingCommand(true);

    let success = false;
    const taskScheduledDate = formattedSelectedDay;
    const selectedDayAsDate = parseISO(selectedDay);
    
    let calculatedEnergyCost = 0;

    let currentOccupiedBlocksForScheduling = [...occupiedBlocks, ...dynamicMealBlocksToday]; // NEW: Include dynamicMealBlocksToday

    // Use workday window for the currently selected day
    const currentDayDate = selectedDayAsDate;
    const currentWorkdayStart = workdayStartTimeForSelectedDay;
    const currentWorkdayEnd = workdayEndTimeForSelectedDay;
    const currentEffectiveWorkdayStart = effectiveWorkdayStartForSelectedDay;


    if (injectionPrompt.isTimed) {
      if (!injectionStartTime || !injectionEndTime) {
        showError("Start time and end time are required for timed injection.");
        setIsProcessingCommand(false);
        return;
      }
      const tempStartTime = parseFlexibleTime(injectionStartTime, selectedDayAsDate);
      const tempEndTime = parseFlexibleTime(injectionEndTime, selectedDayAsDate);

      let startTime = setTimeOnDate(selectedDayAsDate, format(tempStartTime, 'HH:mm'));
      let endTime = setTimeOnDate(selectedDayAsDate, format(tempEndTime, 'HH:mm'));

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
      
      // Recalculate energy cost based on task name if it's a meal
      const isMealTask = isMeal(injectionPrompt.taskName);
      calculatedEnergyCost = isMealTask ? -10 : calculateEnergyCost(duration, injectionPrompt.isCritical ?? false, injectionPrompt.isBackburner ?? false);

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
        is_backburner: injectionPrompt.isBackburner,
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
      
      // Recalculate energy cost based on task name if it's a meal
      const isMealTask = isMeal(injectionPrompt.taskName);
      calculatedEnergyCost = isMealTask ? -10 : calculateEnergyCost(injectedTaskDuration, injectionPrompt.isCritical ?? false, injectionPrompt.isBackburner ?? false);

      const { proposedStartTime, proposedEndTime, message } = await findFreeSlotForTask(
        injectionPrompt.taskName,
        injectedTaskDuration,
        injectionPrompt.isCritical,
        injectionPrompt.isFlexible,
        calculatedEnergyCost,
        currentOccupiedBlocksForScheduling,
        currentDayDate, // Pass currentDayDate
        currentEffectiveWorkdayStart, // Pass currentEffectiveWorkdayStart
        currentWorkdayEnd // Pass currentWorkdayEnd
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
          is_backburner: injectionPrompt.isBackburner,
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
  }, [user, profile, injectionPrompt, injectionStartTime, injectionEndTime, injectionDuration, injectionBreak, formattedSelectedDay, selectedDay, occupiedBlocks, workdayStartTimeForSelectedDay, workdayEndTimeForSelectedDay, effectiveWorkdayStartForSelectedDay, addScheduledTask, environmentForPlacement, T_current, findFreeSlotForTask, queryClient, dynamicMealBlocksToday]);

  const handleRezoneFromSink = useCallback(async (retiredTask: RetiredTask) => {
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

      let currentOccupiedBlocksForScheduling = [...occupiedBlocks, ...dynamicMealBlocksToday]; // NEW: Include dynamicMealBlocksToday

      // Use workday window for the currently selected day
      const currentDayDate = selectedDayAsDate;
      const currentWorkdayStart = workdayStartTimeForSelectedDay;
      const currentWorkdayEnd = workdayEndTimeForSelectedDay;
      const currentEffectiveWorkdayStart = effectiveWorkdayStartForSelectedDay;


      const { proposedStartTime, proposedEndTime, message } = await findFreeSlotForTask(
        retiredTask.name,
        taskDuration,
        retiredTask.is_critical,
        true,
        retiredTask.energy_cost,
        currentOccupiedBlocksForScheduling,
        currentDayDate, // Pass currentDayDate
        currentEffectiveWorkdayStart, // Pass currentEffectiveWorkdayStart
        currentWorkdayEnd // Pass currentWorkdayEnd
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
          is_backburner: retiredTask.is_backburner, 
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
    } finally {
      setIsProcessingCommand(false);
    }
  }, [user, retiredTasks, selectedDay, occupiedBlocks, workdayStartTimeForSelectedDay, workdayEndTimeForSelectedDay, effectiveWorkdayStartForSelectedDay, rezoneTask, addScheduledTask, formattedSelectedDay, findFreeSlotForTask, queryClient, dynamicMealBlocksToday]);

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
    } finally {
      setIsProcessingCommand(false);
    }
  }, [user, retireTask, queryClient]);
  
  const handleRandomizeBreaks = useCallback(async () => {
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
      workdayStartTime: workdayStartTimeForSelectedDay, // Pass workdayStartTimeForSelectedDay
      workdayEndTime: workdayEndTimeForSelectedDay,   // Pass workdayEndTimeForSelectedDay
      currentDbTasks: dbScheduledTasks,
      dynamicOccupiedBlocks: dynamicMealBlocksToday, // NEW: Pass dynamicMealBlocksToday
    });

    queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
    setIsProcessingCommand(false);
  }, [user, profile, dbScheduledTasks, formattedSelectedDay, workdayStartTimeForSelectedDay, workdayEndTimeForSelectedDay, randomizeBreaks, queryClient, dynamicMealBlocksToday]);

  const handleAddTaskClick = useCallback(() => {
    setInjectionPrompt({ 
      taskName: '',
      isOpen: true, 
      isTimed: false,
      duration: 30,
      startTime: undefined,
      endTime: undefined,
      isCritical: false,
      isFlexible: true,
      isBackburner: false,
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
  }, [environmentForPlacement]);

  const handleAddTimeOffClick = useCallback(() => {
    setInjectionPrompt({ 
      taskName:<dyad-problem-report summary="160 problems">
<problem file="src/lib/scheduler-utils.ts" line="696" column="13" code="2304">Cannot find name 'isSlotFree'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="10" column="57" code="2305">Module '&quot;@/lib/scheduler-utils&quot;' has no exported member 'isSlotFree'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="132" column="28" code="2451">Cannot redeclare block-scoped variable 'completeScheduledTaskMutation'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1253" column="9" code="2451">Cannot redeclare block-scoped variable 'completeScheduledTaskMutation'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="18" column="3" code="2305">Module '&quot;@/lib/scheduler-utils&quot;' has no exported member 'isSlotFree'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="96" column="7" code="2322">Type '({ view }: SchedulerPageProps) =&gt; { dbScheduledTasks: DBScheduledTask[]; isLoading: any; addScheduledTask: any; addRetiredTask: any; removeScheduledTask: any; ... 27 more ...; triggerAetherSinkBackup: any; }' is not assignable to type 'FC&lt;SchedulerPageProps&gt;'.
  Type '{ dbScheduledTasks: DBScheduledTask[]; isLoading: any; addScheduledTask: any; addRetiredTask: any; removeScheduledTask: any; clearScheduledTasks: any; datesWithTasks: string[]; ... 25 more ...; triggerAetherSinkBackup: any; }' is not assignable to type 'ReactNode'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1234" column="9" code="2322">Type '{ start: string; end: string; duration: number; }[]' is not assignable to type 'TimeBlock[]'.
  Type '{ start: string; end: string; duration: number; }' is not assignable to type 'TimeBlock'.
    Types of property 'start' are incompatible.
      Type 'string' is not assignable to type 'Date'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1253" column="41" code="2304">Cannot find name 'useMutation'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1255" column="12" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1263" column="43" code="2304">Cannot find name 'XP_PER_LEVEL'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1273" column="25" code="2304">Cannot find name 'isToday'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1277" column="19" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1285" column="20" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1288" column="140" code="2304">Cannot find name 'DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1289" column="135" code="2304">Cannot find name 'DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1303" column="24" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1310" column="70" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1311" column="101" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1312" column="33" code="2304">Cannot find name 'scrollRef'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1315" column="70" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1322" column="86" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1324" column="9" code="2304">Cannot find name 'triggerLevelUp'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1327" column="53" code="2304">Cannot find name 'MutationContext'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1328" column="68" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1329" column="73" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1330" column="11" code="2304">Cannot find name 'scrollRef'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1331" column="9" code="2304">Cannot find name 'scrollRef'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1340" column="46" code="2304">Cannot find name 'useMutation'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1342" column="12" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1347" column="24" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1356" column="70" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1357" column="101" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1358" column="33" code="2304">Cannot find name 'scrollRef'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1360" column="70" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1368" column="68" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1369" column="73" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1370" column="68" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1373" column="53" code="2304">Cannot find name 'MutationContext'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1374" column="68" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1375" column="73" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1376" column="68" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1377" column="11" code="2304">Cannot find name 'scrollRef'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1378" column="9" code="2304">Cannot find name 'scrollRef'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1386" column="45" code="2304">Cannot find name 'useMutation'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1388" column="12" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1393" column="24" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1401" column="45" code="2339">Property 'mutateAsync' does not exist on type 'UseMutateAsyncFunction&lt;{ newXp: number; newLevel: number; newEnergy: number; }, Error, DBScheduledTask, { previousScheduledTasks: DBScheduledTask[]; previousScrollTop: number; }&gt;'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1410" column="26" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1421" column="70" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1422" column="101" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1423" column="33" code="2304">Cannot find name 'scrollRef'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1425" column="70" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1433" column="68" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1434" column="86" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1435" column="73" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1438" column="53" code="2304">Cannot find name 'MutationContext'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1439" column="68" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1440" column="86" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1441" column="73" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1442" column="11" code="2304">Cannot find name 'scrollRef'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1443" column="9" code="2304">Cannot find name 'scrollRef'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1451" column="44" code="2304">Cannot find name 'useMutation'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1453" column="12" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1458" column="24" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1467" column="68" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1468" column="93" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1469" column="33" code="2304">Cannot find name 'scrollRef'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1471" column="64" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1479" column="66" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1480" column="86" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1483" column="53" code="2304">Cannot find name 'MutationContext'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1484" column="66" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1485" column="86" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1486" column="11" code="2304">Cannot find name 'scrollRef'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1487" column="9" code="2304">Cannot find name 'scrollRef'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1495" column="43" code="2304">Cannot find name 'useMutation'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1497" column="12" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1502" column="24" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1517" column="26" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1528" column="68" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1529" column="93" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1530" column="33" code="2304">Cannot find name 'scrollRef'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1532" column="64" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1540" column="66" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1541" column="86" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1544" column="53" code="2304">Cannot find name 'MutationContext'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1545" column="66" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1546" column="86" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1547" column="11" code="2304">Cannot find name 'scrollRef'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1548" column="9" code="2304">Cannot find name 'scrollRef'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1556" column="39" code="2304">Cannot find name 'useMutation'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1558" column="12" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1566" column="43" code="2304">Cannot find name 'XP_PER_LEVEL'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1576" column="25" code="2304">Cannot find name 'isToday'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1580" column="19" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1588" column="20" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1606" column="24" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1613" column="68" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1614" column="93" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1615" column="33" code="2304">Cannot find name 'scrollRef'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1618" column="64" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1625" column="66" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1626" column="86" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1626" column="94" code="2304">Cannot find name 'formattedSelectedDate'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1628" column="9" code="2304">Cannot find name 'triggerLevelUp'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1631" column="53" code="2304">Cannot find name 'MutationContext'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1632" column="66" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1633" column="86" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1633" column="94" code="2304">Cannot find name 'formattedSelectedDate'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1634" column="11" code="2304">Cannot find name 'scrollRef'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1635" column="9" code="2304">Cannot find name 'scrollRef'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1645" column="43" code="2304">Cannot find name 'useMutation'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1647" column="12" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1648" column="93" code="2304">Cannot find name 'userId'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1655" column="33" code="2304">Cannot find name 'scrollRef'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1661" column="53" code="2304">Cannot find name 'MutationContext'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1662" column="11" code="2304">Cannot find name 'scrollRef'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1663" column="9" code="2304">Cannot find name 'scrollRef'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1674" column="16" code="2304">Cannot find name 'isLoading'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1675" column="23" code="2552">Cannot find name 'addScheduledTaskMutation'. Did you mean 'addScheduledTask'?</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1676" column="21" code="2304">Cannot find name 'addRetiredTaskMutation'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1677" column="26" code="2552">Cannot find name 'removeScheduledTaskMutation'. Did you mean 'removeScheduledTask'?</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1678" column="26" code="2552">Cannot find name 'clearScheduledTasksMutation'. Did you mean 'clearScheduledTasks'?</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1685" column="17" code="2304">Cannot find name 'retireTaskMutation'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1686" column="17" code="2304">Cannot find name 'rezoneTaskMutation'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1687" column="28" code="2552">Cannot find name 'compactScheduledTasksMutation'. Did you mean 'completeScheduledTaskMutation'?</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1688" column="22" code="2304">Cannot find name 'randomizeBreaksMutation'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1689" column="30" code="2304">Cannot find name 'toggleScheduledTaskLockMutation'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1690" column="28" code="2304">Cannot find name 'toggleRetiredTaskLockMutation'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1691" column="17" code="2304">Cannot find name 'aetherDumpMutation'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1692" column="21" code="2304">Cannot find name 'aetherDumpMegaMutation'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1697" column="26" code="2304">Cannot find name 'autoBalanceScheduleMutation'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1698" column="58" code="2339">Property 'mutateAsync' does not exist on type 'UseMutateAsyncFunction&lt;{ newXp: number; newLevel: number; newEnergy: number; }, Error, DBScheduledTask, { previousScheduledTasks: DBScheduledTask[]; previousScrollTop: number; }&gt;'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1704" column="24" code="2304">Cannot find name 'removeRetiredTaskMutation'.</problem>
<problem file="src/App.tsx" line="13" column="8" code="1192">Module '&quot;/Users/danielebuatti/dyad-apps/productive-sloth/src/pages/SchedulerPage&quot;' has no default export.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="1" column="206" code="2307">Cannot find module 'https://esm.sh/date-fns@2.30.0' or its corresponding type declarations.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="489" column="68" code="2304">Cannot find name 'NewRetiredTask'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="535" column="52" code="2304">Cannot find name 'TimeBlock'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="535" column="66" code="2304">Cannot find name 'TimeBlock'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="541" column="17" code="2304">Cannot find name 'TimeBlock'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="565" column="19" code="2304">Cannot find name 'TimeBlock'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="568" column="4" code="2304">Cannot find name 'TimeBlock'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="569" column="21" code="2304">Cannot find name 'TimeBlock'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="606" column="12" code="2304">Cannot find name 'DBScheduledTask'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="611" column="29" code="2304">Cannot find name 'TimeBlock'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="612" column="18" code="2304">Cannot find name 'DBScheduledTask'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="613" column="4" code="2304">Cannot find name 'DBScheduledTask'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="619" column="31" code="2304">Cannot find name 'DBScheduledTask'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="656" column="30" code="2304">Cannot find name 'TimeBlock'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="676" column="36" code="2304">Cannot find name 'DBScheduledTask'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="695" column="13" code="2304">Cannot find name 'isSlotFree'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="729" column="12" code="2304">Cannot find name 'DBScheduledTask'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="743" column="4" code="2304">Cannot find name 'FormattedSchedule'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="744" column="16" code="2304">Cannot find name 'ScheduledItem'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="752" column="32" code="2304">Cannot find name 'TimeBlock'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="776" column="25" code="2304">Cannot find name 'ScheduledItem'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="826" column="24" code="2304">Cannot find name 'ScheduledItem'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="887" column="19" code="2304">Cannot find name 'ScheduledItemType'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="900" column="17" code="2304">Cannot find name 'ScheduledItem'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="942" column="18" code="2304">Cannot find name 'ScheduleSummary'.</problem>
</dyad-problem-report><think>**Fixing TypeScript Errors**

I'm currently addressing 160 TypeScript compile-time errors. The bulk of these involve missing imports, variable redeclarations, and type inconsistencies, particularly with `TimeBlock` and `Scheduled` types. I'm focusing on resolving these errors methodically, starting with the most frequent and impactful ones to maintain code reliability.


**Resolving Missing Imports**

I'm making progress resolving missing imports, variable redeclarations, and type mismatches.  Specifically, I've identified that `isSlotFree` is unexported, and I am correcting that.  The errors were spread across `src/lib/scheduler-utils.ts`, `supabase/functions/_shared/scheduler-utils.ts`, and `src/pages/SchedulerPage.tsx`. I am methodically tracking these fixes.


**Refining Type Declarations**

I've been analyzing and categorizing the remaining TypeScript errors. I see that there are several type declaration errors, including those for the return values of  the `useSchedulerTasks` and `useUser` hooks, which are causing type inference issues, particularly for the components. This is coupled with a need to correctly manage imports and exports. I'm focusing on strengthening  the type definitions of all the variables and functions to ensure clear type assignments and resolution of type mismatches.


**Prioritizing Remaining Issues**

I've examined the remaining 160 TypeScript errors and divided them into categories. Many pertain to missing imports, particularly `isSlotFree` and the various mutation functions returned by `useSchedulerTasks`. Type mismatches, especially involving `TimeBlock` and related types, are also prevalent. I'll focus on these areas for efficient resolution. I'll start with exporting `isSlotFree`, and then fixing the `useSchedulerTasks` function.

I'm now focusing on the `useSchedulerTasks` function because its return type is complex and is likely causing many of the other type errors. The function returns a complex object with various mutation functions, state, and other data, and this return type isn't correctly handled by the `SchedulerPage` component. I'm going to refine the typing of `useSchedulerTasks` hook's return value to ensure consistency with how it's used within the `SchedulerPage` component.


**Refining Hook Typing**

I'm now diving into the `useSchedulerTasks` hook, focusing on refining its complex return type to address numerous downstream type errors. Its return value is extensive, encompassing mutation functions, state, and other data, creating type inference problems with the `SchedulerPage` component. I'm scrutinizing the typing of all internal hooks and data structures to ensure clear type assignments and resolve mismatches with how the returned values are utilized within the component.


**Analyzing Type Mismatches**

I'm now diving into the remaining type mismatches, particularly focusing on `TimeBlock` and related types in the auto-balance schedule and related edge functions. There's inconsistency between `Date` objects and string ISO dates within the `AutoBalancePayload`, and I'm updating definitions in `src/types/scheduler.ts` and `supabase/functions/auto-balance-schedule/index.ts` to ensure consistency and correct data transformation during API calls.


**Tackling Type Inference**

I'm now focusing on resolving the most complex type errors, especially those linked to `useSchedulerTasks` and the `SchedulerPage` component. I'm scrutinizing how the return values of hooks are being used within the component.



**Addressing Type Mismatches**

I'm now focusing on resolving type mismatches related to `TimeBlock`, particularly around date serialization in edge functions. Inconsistent types exist between date objects and ISO strings, causing issues with auto-balance schedule calculations. I'm updating definitions in `src/types/scheduler.ts` and related edge function code to ensure data consistency and correct API call transformations, especially in the `AutoBalancePayload`.


**Prioritizing Remaining Tasks**

I am now focusing on refining the complex return type of the `useSchedulerTasks` hook and resolving the resulting type inference issues. I need to resolve the type conflicts surrounding TimeBlock and the AutoBalancePayload to ensure correct data serialization and avoid mismatches. I'm also addressing the missing import of `isSlotFree`.


**Tackling Complex Types**

I'm now focusing on resolving the type errors, particularly the complexities around `useSchedulerTasks` and `SchedulerPage`. The return types need refinement to align with their usage, resolving downstream mismatches. I'm carefully scrutinizing all related hooks and data structures to ensure clear and consistent typing across components.


**Tackling Complex Type Issues**

I'm now focusing on resolving type errors related to `useSchedulerTasks` return value. These are causing complex downstream issues, especially around how the component uses the hook's returned data. Refining the type structure of `useSchedulerTasks` will significantly improve type safety across the application and eliminate the type inference problems.


**Addressing Complex Type Inference**

I'm now focusing on resolving type mismatches within the `useSchedulerTasks` hook, specifically with `completeScheduledTaskMutation` and related functions. This should eliminate numerous downstream errors. I'll meticulously review the hook's return value and its use within the `SchedulerPage` component to ensure type consistency, particularly the mutations and their types.


**Refining Hook Types**

I'm working on the `useSchedulerTasks` hook, focusing on fixing type errors stemming from its complex return type. The hook returns several mutation functions and state, which has caused problems when being destructured and utilized within the `SchedulerPage` component. I'm carefully scrutinizing all related hooks and data structures to ensure clear type assignments and resolve mismatches with how the returned values are used within the component.


**Resolving Type Mismatches**

I'm starting to resolve the type conflicts, especially focusing on `TimeBlock` and `AutoBalancePayload`, ensuring consistent data formats during serialization and API calls within edge functions. I'll meticulously update the definitions in `src/types/scheduler.ts` and related code.


**Tackling Complex Inference**

I'm now wrestling with the complexities of type inference, particularly around `useSchedulerTasks` and its interactions with `SchedulerPage`. The type mismatches are proving trickier than anticipated. I'm focusing on ensuring data consistency and correctness throughout the application.


**Tackling Complex Inference**

I've been meticulously addressing the remaining type errors, particularly those concerning `useSchedulerTasks` return type. These issues span `TimeBlock` inconsistencies in date serialization to downstream problems with mutation function inference. I'm carefully scrutinizing all related hooks and data structures to ensure clear and consistent typing, resolving mismatches that are hindering code reliability.


</think>It looks like there are several TypeScript errors related to missing imports, scope, and type definitions, especially concerning the shared utility functions and the `SchedulerPage` component. I'll go through and fix these issues to ensure the scheduling logic works correctly with meal times.

Here's a summary of the changes I'll make:

1.  **Export `isSlotFree`**: This utility function is used in multiple places but wasn't exported from `src/lib/scheduler-utils.ts` or `supabase/functions/_shared/scheduler-utils.ts`.
2.  **Refactor `SchedulerPage` and `useSchedulerTasks`**:
    *   I'll ensure all necessary hooks (`useMutation`, `useQueryClient`) and constants (`XP_PER_LEVEL`, `DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION`) are correctly imported in `src/hooks/use-scheduler-tasks.ts` and `src/pages/SchedulerPage.tsx`.
    *   I'll fix the redeclaration of `completeScheduledTaskMutation` in `src/pages/SchedulerPage.tsx` by using the function returned by `useSchedulerTasks` directly.
    *   I'll ensure `userId` and `profile` are correctly accessed within the mutation functions.
    *   I'll export `MutationContext` from `src/hooks/use-scheduler-tasks.ts` so it can be used consistently.
3.  **Adjust `AutoBalancePayload` for Edge Function communication**: The `dynamicOccupiedBlocks` in the payload sent to the edge function need to be serialized as strings, so I'll update the `AutoBalancePayload` type in `src/types/scheduler.ts` to reflect this.
4.  **Correct `SchedulerPage` export**: `SchedulerPage` is currently defined as a named export but imported as a default. I'll change it to a default export.
5.  **Create shared types for Supabase Edge Functions**: To avoid duplicating type definitions and ensure consistency, I'll create a new file `supabase/functions/_shared/types.ts` and move common scheduler-related types there. Then, `src/types/scheduler.ts` and the Supabase functions will import from this new shared types file.

These changes will ensure that the scheduling logic correctly accounts for meal times and other dynamic blocks, and that the TypeScript compiler is happy!

<dyad-write path="src/types/scheduler.ts" description="Updating the FormattedSchedule interface to include dynamic occupied blocks and adjusting AutoBalancePayload for string dates.">
export type TaskPriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type TaskStatusFilter = 'ALL' | 'ACTIVE' | 'COMPLETED';
export type TemporalFilter = 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS';
export type SortBy = 'PRIORITY_HIGH_TO_LOW' | 'PRIORITY_LOW_TO_HIGH' | 'TIME_EARLIEST_TO_LATEST' | 'TIME_LATEST_TO_EARLIEST' | 'EMOJI' | 'NAME_ASC' | 'NAME_DESC'; // Updated SortBy

// NEW: Type for task environment
export type TaskEnvironment = 'home' | 'laptop' | 'away' | 'piano' | 'laptop_piano';

// NEW: Type for sorting retired tasks
export type RetiredTaskSortBy = 
  'NAME_ASC' | 'NAME_DESC' |
  'DURATION_ASC' | 'DURATION_DESC' |
  'CRITICAL_FIRST' | 'CRITICAL_LAST' |
  'LOCKED_FIRST' | 'LOCKED_LAST' |
  'ENERGY_ASC' | 'ENERGY_DESC' |
  'RETIRED_AT_NEWEST' | 'RETIRED_AT_OLDEST' |
  'COMPLETED_FIRST' | 'COMPLETED_LAST' |
  'EMOJI'; // Added EMOJI sort option

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description?: string; // Added description
  is_completed: boolean;
  priority: TaskPriority;
  metadata_xp: number;
  energy_cost: number; // Added energy_cost
  due_date: string; // ISO date string
  created_at: string;
  updated_at: string; // Added updated_at
  is_critical: boolean; // NEW: Critical Urgency Flag
  is_custom_energy_cost: boolean; // NEW: Added for custom energy cost
  is_backburner: boolean; // FIX: Added missing property
}

export interface NewTask {
  title: string;
  priority: TaskPriority;
  metadata_xp: number;
  energy_cost: number; // Added energy_cost to NewTask
  due_date: string;
  description?: string; // Added description to NewTask
  is_critical?: boolean; // NEW: Critical Urgency Flag
  is_custom_energy_cost?: boolean; // NEW: Added for custom energy cost
  is_backburner?: boolean; // NEW: Backburner Urgency Flag
}

// --- Scheduler Types ---

export interface RawTaskInput {
  name: string;
  duration: number; // in minutes
  breakDuration?: number; // in minutes
  isCritical?: boolean; // NEW: Critical Urgency Flag
  isFlexible?: boolean; // NEW: Added isFlexible to RawTaskInput
  isBackburner?: boolean; // NEW: Backburner Urgency Flag
  energyCost: number; // NEW: Made energyCost required
}

// Supabase-specific types for scheduled tasks
export interface DBScheduledTask {
  id: string;
  user_id: string;
  name: string;
  break_duration: number | null;
  start_time: string | null; // New: ISO date string for timed events
  end_time: string | null;   // New: ISO date string for timed events
  scheduled_date: string; // New: Date (YYYY-MM-DD) for which the task is scheduled
  created_at: string;
  updated_at: string; // NEW: Added updated_at
  is_critical: boolean; // NEW: Critical Urgency Flag
  is_flexible: boolean; // NEW: Flag for schedule compaction
  is_locked: boolean; // NEW: Task Immutability Flag
  energy_cost: number; // NEW: Made energyCost required
  is_completed: boolean; // NEW: Added is_completed for scheduled tasks
  is_custom_energy_cost: boolean; // NEW: Flag for custom energy cost
  task_environment: TaskEnvironment; // NEW: Task environment
  source_calendar_id: string | null; // NEW: Source calendar ID for read-only events
  is_backburner: boolean; // NEW: Backburner Urgency Flag
}

export interface NewDBScheduledTask {
  id?: string; // NEW: Added optional ID for upsert operations
  name: string;
  break_duration?: number;
  start_time?: string; // Optional for duration-based tasks
  end_time?: string;   // Optional for duration-based tasks
  scheduled_date: string; // New: Date (YYYY-MM-DD) for which the task is scheduled
  is_critical?: boolean; // NEW: Critical Urgency Flag
  is_flexible?: boolean; // NEW: Flag for schedule compaction
  is_locked?: boolean; // NEW: Task Immutability Flag
  energy_cost: number; // NEW: Made energyCost required
  is_completed?: boolean; // NEW: Added is_completed for new scheduled tasks
  is_custom_energy_cost?: boolean; // NEW: Flag for custom energy cost
  task_environment?: TaskEnvironment; // NEW: Task environment
  source_calendar_id?: string | null; // NEW: Source calendar ID
  is_backburner?: boolean; // NEW: Backburner Urgency Flag
}

// New types for retired tasks (Aether Sink)
export interface RetiredTask {
  id: string;
  user_id: string;
  name: string;
  duration: number | null; // Duration in minutes (retained for re-zoning)
  break_duration: number | null; // Break duration in minutes (retained for re-zoning)
  original_scheduled_date: string; // The date it was originally scheduled for (YYYY-MM-DD)
  retired_at: string; // Timestamp when it was moved to the sink
  is_critical: boolean; // NEW: Critical Urgency Flag
  is_locked: boolean; // NEW: Task Immutability Flag
  energy_cost: number; // NEW: Made energyCost required
  is_completed: boolean; // NEW: Added is_completed
  is_custom_energy_cost: boolean; // NEW: Flag for custom energy cost
  task_environment: TaskEnvironment; // NEW: Task environment
  is_backburner: boolean; // NEW: Backburner Urgency Flag
}

export interface NewRetiredTask {
  user_id: string;
  name: string;
  duration: number | null;
  break_duration: number | null;
  original_scheduled_date: string;
  is_critical?: boolean; // NEW: Critical Urgency Flag
  is_locked?: boolean; // NEW: Task Immutability Flag
  energy_cost: number; // NEW: Made energyCost required
  is_completed?: boolean; // NEW: Added is_completed
  is_custom_energy_cost?: boolean; // NEW: Flag for custom energy cost
  task_environment?: TaskEnvironment; // NEW: Task environment
  is_backburner?: boolean; // NEW: Backburner Urgency Flag
}

// Helper type for unification (moved from SchedulerPage.tsx)
export interface UnifiedTask {
  id: string;
  name: string;
  duration: number;
  break_duration: number | null;
  is_critical: boolean;
  is_flexible: boolean;
  is_backburner: boolean; // NEW: Backburner Urgency Flag
  energy_cost: number;
  source: 'scheduled' | 'retired';
  originalId: string; // ID in the source table
  is_custom_energy_cost: boolean; // NEW: Add custom energy cost flag
  created_at: string; // NEW: Add created_at for age sorting
  task_environment: TaskEnvironment; // NEW: Task environment
}

// NEW: Payload for the atomic auto-balance mutation
export interface AutoBalancePayload {
  scheduledTaskIdsToDelete: string[];
  retiredTaskIdsToDelete: string[];
  tasksToInsert: NewDBScheduledTask[];
  tasksToKeepInSink: NewRetiredTask[];
  selectedDate: string;
  // Changed to string for serialization over network
  dynamicOccupiedBlocks: { start: string; end: string; duration: number }[]; 
}

export type ScheduledItemType = 'task' | 'break' | 'time-off' | 'meal' | 'calendar-event'; // UPDATED: Added 'calendar-event'

export interface ScheduledItem {
  id: string; // Unique ID for React keys
  type: ScheduledItemType;
  name: string; // Task name or "BREAK"
  duration: number; // in minutes (calculated for timed events)
  startTime: Date;
  endTime: Date;
  emoji: string;
  description?: string; // For breaks
  isTimedEvent: boolean; // New: Flag to differentiate
  color?: string; // New: For custom colors (e.g., Tailwind class like 'bg-blue-500')
  isCritical?: boolean; // NEW: Critical Urgency Flag
  isFlexible?: boolean; // NEW: Flag for schedule compaction
  isLocked?: boolean; // NEW: Task Immutability Flag
  energyCost: number; // NEW: Made energyCost required
  isCompleted: boolean; // NEW: Added isCompleted for scheduled items
  isCustomEnergyCost: boolean; // NEW: Flag for custom energy cost
  taskEnvironment: TaskEnvironment; // NEW: Task environment
  sourceCalendarId: string | null; // NEW: Source calendar ID
  isBackburner: boolean; // NEW: Backburner Urgency Flag
}

// NEW: Type for combined completed task log entry for recap metrics
export interface CompletedTaskLogEntry {
  id: string;
  user_id: string;
  name: string;
  effective_duration_minutes: number; // Calculated duration for recap metrics
  break_duration: number | null;
  start_time: string | null;
  end_time: string | null;
  scheduled_date: string;
  created_at: string;
  updated_at: string;
  is_critical: boolean;
  is_flexible: boolean;
  is_locked: boolean;
  energy_cost: number;
  is_completed: boolean;
  is_custom_energy_cost: boolean;
  task_environment: TaskEnvironment;
  original_source: 'scheduled_tasks' | 'aethersink' | 'tasks';
}

export interface ScheduleSummary {
  totalTasks: number;
  activeTime: { hours: number; minutes: number };
  breakTime: number; // in minutes
  sessionEnd: Date;
  extendsPastMidnight: boolean;
  midnightRolloverMessage: string | null;
  unscheduledCount: number; // New: Count of tasks that couldn't fit within the workday window
  criticalTasksRemaining: number; // NEW: Count of critical tasks not yet completed
}

// New type for fixed time markers
export interface TimeMarker {
  id: string;
  type: 'marker';
  time: Date;
  label: string;
}

// New type for free time blocks
export interface FreeTimeItem {
  id: string;
  type: 'free-time';
  startTime: Date;
  endTime: Date;
  duration: number; // in minutes
  message: string;
  suggestedTask?: RetiredTask | null; // NEW: Add suggested task
}

// New type for current time marker
export interface CurrentTimeMarker {
  id: string;
  type: 'current-time';
  time: Date;
}

// Define FormattedSchedule here
export interface FormattedSchedule {
  items: ScheduledItem[];
  summary: ScheduleSummary;
  dbTasks: DBScheduledTask[]; // Added for type safety in SchedulerDisplay
  dynamicOccupiedBlocks: TimeBlock[]; // NEW: Add dynamic occupied blocks (meals, regen pod)
}

export type DisplayItem = ScheduledItem | TimeMarker | FreeTimeItem | CurrentTimeMarker; // Added CurrentTimeMarker

// NEW: TimeBlock interface for scheduler utility functions
export interface TimeBlock {
  start: Date;
  end: Date;
  duration: number; // in minutes
}