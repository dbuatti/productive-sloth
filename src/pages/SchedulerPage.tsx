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
import { useSchedulerCommands } from '@/hooks/use-scheduler-commands'; // NEW IMPORT

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
  isBackburner?: boolean;
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
  const { user, profile, isLoading: isSessionLoading, rechargeEnergy, T_current, activeItemToday, nextItemToday, refreshProfile, session, startRegenPodState, exitRegenPodState, regenPodDurationMinutes, triggerEnergyRegen } = useSession();
  const { selectedEnvironments } = useEnvironmentContext();
  const environmentForPlacement = selectedEnvironments[0] || 'laptop';
  
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
  
  const [inputValue, setInputValue] = useState('');
  const [hasMorningFixRunToday, setHasMorningFixRunToday] = useState(false);
  
  const [isFocusModeActive, setIsFocusModeActive] = useState(false);

  // Modals and Dialogs states
  const [injectionPrompt, setInjectionPrompt] = useState<InjectionPromptState | null>(null);
  const [injectionDuration, setInjectionDuration] = useState('');
  const [injectionBreak, setInjectionBreak] = useState('');
  const [injectionStartTime, setInjectionStartTime] = useState('');
  const [injectionEndTime, setInjectionEndTime] = useState('');
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [showWorkdayWindowDialog, setShowWorkdayWindowDialog] = useState(false);
  const [showEarlyCompletionModal, setShowEarlyCompletionModal] = useState(false);
  const [earlyCompletionTaskName, setEarlyCompletionTaskName] = useState('');
  const [earlyCompletionRemainingMinutes, setEarlyCompletionRemainingMinutes] = useState(0);
  const [earlyCompletionDbTask, setEarlyCompletionDbTask] = useState<DBScheduledTask | null>(null);
  const [showDeleteScheduledTaskConfirmation, setShowDeleteScheduledTaskConfirmation] = useState(false);
  const [scheduledTaskToDeleteId, setScheduledTaskToDeleteId] = useState<string | null>(null);
  const [scheduledTaskToDeleteName, setScheduledTaskToDeleteName] = useState<string | null>(null);
  const [scheduledTaskToDeleteIndex, setScheduledTaskToDeleteIndex] = useState<number | null>(null);
  const [showDeleteRetiredTaskConfirmation, setShowDeleteRetiredTaskConfirmation] = useState(false);
  const [retiredTaskToDeleteId, setRetiredTaskToDeleteId] = useState<string | null>(null);
  const [retiredTaskToDeleteName, setRetiredTaskToDeleteName] = useState<string | null>(null);
  const [showEnergyDeficitConfirmation, setShowEnergyDeficitConfirmation] = useState(false);
  const [taskToCompleteInDeficit, setTaskToCompleteInDeficit] = useState<DBScheduledTask | null>(null);
  const [taskToCompleteInDeficitIndex, setTaskToCompleteInDeficitIndex] = useState<number | null>(null);
  const [showPodSetupModal, setShowPodSetupModal] = useState(false);
  const [calculatedPodDuration, setCalculatedPodDuration] = useState(0);

  // NEW: Use useSchedulerCommands hook
  const {
    isProcessingCommand,
    handleCommand,
    handleInjectionSubmit,
    handleRefreshSchedule,
    handleQuickScheduleBlock,
    handleCompactSchedule,
    handleRandomizeBreaks,
    handleAetherDumpButton,
    handleAetherDumpMegaButton,
    handleAutoScheduleDay,
    handleSortFlexibleTasks,
    handleZoneFocus,
    handleStartRegenPod,
    handlePodExit,
    handleFreeTimeClick,
    handleAddTaskClick,
    handleAddTimeOffClick,
    handleRezoneFromSink,
    handleAutoScheduleSinkWrapper,
    handleOpenWorkdayWindowDialog,
    handlePermanentDeleteRetiredTaskWrapper,
    handlePermanentDeleteScheduledTaskWrapper,
    handleSchedulerAction,
  } = useSchedulerCommands({
    selectedDay,
    dbScheduledTasks,
    retiredTasks,
    activeItemToday,
    nextItemToday,
    T_current,
    workdayStartTime: profile?.default_auto_schedule_start_time 
      ? setTimeOnDate(parseISO(selectedDay), profile.default_auto_schedule_start_time) 
      : startOfDay(parseISO(selectedDay)),
    workdayEndTime: profile?.default_auto_schedule_end_time 
      ? setTimeOnDate(startOfDay(parseISO(selectedDay)), profile.default_auto_schedule_end_time) 
      : addHours(startOfDay(parseISO(selectedDay)), 17),
    effectiveWorkdayStart: useMemo(() => {
      const ws = profile?.default_auto_schedule_start_time 
        ? setTimeOnDate(parseISO(selectedDay), profile.default_auto_schedule_start_time) 
        : startOfDay(parseISO(selectedDay));
      return isSameDay(parseISO(selectedDay), T_current) && isBefore(ws, T_current) ? T_current : ws;
    }, [selectedDay, T_current, profile?.default_auto_schedule_start_time]),
    sortBy,
    setSortBy,
    onPermanentDeleteScheduledTask: (id, name, index) => {
      setScheduledTaskToDeleteId(id);
      setScheduledTaskToDeleteName(name);
      setScheduledTaskToDeleteIndex(index);
      setShowDeleteScheduledTaskConfirmation(true);
    },
    onPermanentDeleteRetiredTask: (id, name) => {
      setRetiredTaskToDeleteId(id);
      setRetiredTaskToDeleteName(name);
      setShowDeleteRetiredTaskConfirmation(true);
    },
    onScrollToItem: (itemId) => {
      const element = document.getElementById(`scheduled-item-${itemId}`);
      if (element && scheduleContainerRef.current) {
        const containerRect = scheduleContainerRef.current.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        const scrollOffset = elementRect.top - containerRect.top - containerRect.height / 4; 
        scheduleContainerRef.current.scrollBy({ top: scrollOffset, behavior: 'smooth' });
      }
    },
    onShowEnergyDeficitConfirmation: (task, index) => {
      setTaskToCompleteInDeficit(task);
      setTaskToCompleteInDeficitIndex(index);
      setShowEnergyDeficitConfirmation(true);
    },
    onShowEarlyCompletionModal: (task, remainingMinutes) => {
      setEarlyCompletionTaskName(task.name);
      setEarlyCompletionRemainingMinutes(remainingMinutes);
      setEarlyCompletionDbTask(task);
      setShowEarlyCompletionModal(true);
    },
    onSetInjectionPrompt: setInjectionPrompt,
    onSetInjectionDuration: setInjectionDuration,
    onSetInjectionBreak: setInjectionBreak,
    onSetInjectionStartTime: setInjectionStartTime,
    onSetInjectionEndTime: setInjectionEndTime,
    onSetShowClearConfirmation: setShowClearConfirmation,
    onSetShowWorkdayWindowDialog: setShowWorkdayWindowDialog,
    onSetShowPodSetupModal: setShowPodSetupModal,
    onSetCalculatedPodDuration: setCalculatedPodDuration,
  });

  const selectedDayAsDate = useMemo(() => parseISO(selectedDay), [selectedDay]);

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

  const calculatedSchedule = useMemo(() => {
    if (!profile) return null;
    const newSchedule = calculateSchedule(
      dbScheduledTasks, 
      selectedDay, 
      workdayStartTime, 
      workdayEndTime,
      profile.is_in_regen_pod,
      profile.regen_pod_start_time ? parseISO(profile.regen_pod_start_time) : null,
      regenPodDurationMinutes,
      T_current
    );
    return newSchedule;
  }, [dbScheduledTasks, selectedDay, workdayStartTime, workdayEndTime, profile, regenPodDurationMinutes, T_current]);

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
        isBackburner: false,
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

  const location = useLocation();
  const navigate = useNavigate();

  const confirmPermanentDeleteScheduledTask = useCallback(async () => {
    if (!scheduledTaskToDeleteId || !user || scheduledTaskToDeleteIndex === null) return;
    setIsProcessingCommand(true);
    try {
      await removeScheduledTask(scheduledTaskToDeleteId);
      showSuccess(`Task "${scheduledTaskToDeleteName}" permanently deleted.`);

      try {
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

      if (activeItemToday) {
        // Use the onScrollToItem from the hook
        handleSchedulerAction('exitFocus', activeItemToday as DBScheduledTask, false); // Exit focus mode if active
        // onScrollToItem(activeItemToday.id);
      } else if (nextItemToday) {
        // onScrollToItem(nextItemToday.id);
      } else if (scheduleContainerRef.current) {
        scheduleContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
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
  }, [scheduledTaskToDeleteId, scheduledTaskToDeleteName, scheduledTaskToDeleteIndex, user, removeScheduledTask, activeItemToday, nextItemToday, queryClient, formattedSelectedDay, sortBy, selectedDayAsDate, workdayStartTime, workdayEndTime, T_current, compactScheduledTasks, handleSchedulerAction]);

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
    }

    setIsProcessingCommand(false);
    setShowClearConfirmation(false);
    setInputValue('');
  };

  const confirmCompleteTaskInDeficit = useCallback(async () => {
    if (!taskToCompleteInDeficit || !profile) return;
    setIsProcessingCommand(true);
    try {
      const isMealTask = isMeal(taskToCompleteInDeficit.name);
      const isFixedOrTimed = !taskToCompleteInDeficit.is_flexible || isMealTask || taskToCompleteInDeficit.name.toLowerCase() === 'time off';

      if (isFixedOrTimed) {
        await updateScheduledTaskStatus({ taskId: taskToCompleteInDeficit.id, isCompleted: true });
        showSuccess(`Task "${taskToCompleteInDeficit.name}" completed!`);
      } else {
        await completeScheduledTaskMutation(taskToCompleteInDeficit);
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
      }
      
      if (taskToCompleteInDeficit.name.toLowerCase() === 'break' || isMealTask) {
        await triggerEnergyRegen();
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
  }, [taskToCompleteInDeficit, profile, completeScheduledTaskMutation, queryClient, user?.id, formattedSelectedDay, sortBy, selectedDayAsDate, workdayStartTime, workdayEndTime, T_current, compactScheduledTasks, setIsFocusModeActive, updateScheduledTaskStatus, triggerEnergyRegen]);


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

  const { totalActiveTimeMinutes, totalBreakTimeMinutes } = useMemo(() => {
    let activeTime = 0;
    let breakTime = 0;

    completedTasksForSelectedDayList.forEach(task => {
      const duration = task.effective_duration_minutes;
      const isBreakOrMeal = task.name.toLowerCase() === 'break' || isMeal(task.name);
      
      if (isBreakOrMeal) {
        breakTime += duration;
      } else {
        activeTime += duration;
      }
    });

    return { totalActiveTimeMinutes: activeTime, totalBreakTimeMinutes: breakTime };
  }, [completedTasksForSelectedDayList]);


  const overallLoading = isSessionLoading || isSchedulerTasksLoading || isProcessingCommand || isLoadingRetiredTasks || isLoadingCompletedTasksForSelectedDay;

  const hasFlexibleTasksOnCurrentDay = dbScheduledTasks.some(item => item.is_flexible && !item.is_locked);

  const renderScheduleCore = () => (
    <>
      <div className="hidden lg:block">
        <SchedulerContextBar T_current={T_current} />
      </div>

      <Card className="p-4 animate-slide-in-up shadow-md animate-hover-lift">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
            <ListTodo className="h-6 w-6 text-primary" /> Quick Add
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <SchedulerInput 
            onCommand={handleCommand} 
            isLoading={isProcessingCommand} 
            inputValue={inputValue}
            setInputValue={setInputValue}
            placeholder={`Add task (e.g., 'Gym 60', '-Clean desk') or command`}
            onDetailedInject={handleAddTaskClick}
          />
          <p className="text-sm text-muted-foreground mt-2">
            Examples: "Gym 60", "-Clean desk 30", "Meeting 11am-12pm", 'inject "Project X" 30', 'remove "Gym"', 'clear', 'compact', "Clean the sink 30 sink", "Time Off 2pm-3pm", "Aether Dump", "Aether Dump Mega"
          </p>
        </CardContent>
      </Card>

      <div className="animate-slide-in-up hidden lg:block">
        <SchedulerActionCenter 
          isProcessingCommand={isProcessingCommand}
          dbScheduledTasks={dbScheduledTasks}
          retiredTasksCount={retiredTasks.length}
          sortBy={sortBy}
          onAutoSchedule={handleAutoScheduleDay}
          onCompactSchedule={handleCompactSchedule}
          onRandomizeBreaks={handleRandomizeBreaks}
          onZoneFocus={handleZoneFocus}
          onRechargeEnergy={() => rechargeEnergy()}
          onQuickBreak={handleQuickBreakButton}
          onQuickScheduleBlock={handleQuickScheduleBlock}
          onSortFlexibleTasks={handleSortFlexibleTasks}
          onAetherDump={handleAetherDumpButton}
          onAetherDumpMega={handleAetherDumpMegaButton}
          onRefreshSchedule={handleRefreshSchedule}
          onOpenWorkdayWindowDialog={handleOpenWorkdayWindowDialog}
          onStartRegenPod={handleStartRegenPod}
          hasFlexibleTasksOnCurrentDay={hasFlexibleTasksOnCurrentDay}
        />
      </div>

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
            <Sparkles className="h-5 w-5 text-logo-yellow" /> Your Vibe Schedule for {formatFns(parseISO(selectedDay), 'EEEE, MMMM d')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {isSchedulerTasksLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <SchedulerDisplay 
              schedule={currentSchedule} 
              T_current={T_current} 
              onRemoveTask={handlePermanentDeleteScheduledTaskWrapper}
              onRetireTask={(task) => handleSchedulerAction('skip', task)}
              onCompleteTask={(task, index) => handleSchedulerAction('complete', task, false, 0, index)}
              activeItemId={activeItemToday?.id || null} 
              selectedDayString={selectedDay} 
              onAddTaskClick={handleAddTaskClick}
              onScrollToItem={(itemId) => {
                const element = document.getElementById(`scheduled-item-${itemId}`);
                if (element && scheduleContainerRef.current) {
                  const containerRect = scheduleContainerRef.current.getBoundingClientRect();
                  const elementRect = element.getBoundingClientRect();
                  const scrollOffset = elementRect.top - containerRect.top - containerRect.height / 4; 
                  scheduleContainerRef.current.scrollBy({ top: scrollOffset, behavior: 'smooth' });
                }
              }}
              isProcessingCommand={isProcessingCommand}
              onFreeTimeClick={handleFreeTimeClick}
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
      onRemoveRetiredTask={handlePermanentDeleteRetiredTaskWrapper}
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
      totalActiveTimeMinutes={totalActiveTimeMinutes}
      totalBreakTimeMinutes={totalBreakTimeMinutes}
    />
  );

  const isRegenPodActive = profile?.is_in_regen_pod ?? false;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
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

      {(isRegenPodActive || showPodSetupModal) && (
        <EnergyRegenPodModal
          isOpen={isRegenPodActive || showPodSetupModal}
          onExit={handlePodExit}
          onStart={async (activityName, activityDuration) => { 
            await startRegenPodState(activityDuration); 
            setShowPodSetupModal(false);
          }}
          isProcessingCommand={isProcessingCommand}
          totalDurationMinutes={isRegenPodActive ? regenPodDurationMinutes : calculatedPodDuration} 
        />
      )}

      <SchedulerDashboardPanel 
        scheduleSummary={currentSchedule?.summary || null} 
        onAetherDump={handleAetherDumpButton}
        isProcessingCommand={isProcessingCommand}
        hasFlexibleTasks={hasFlexibleTasksOnCurrentDay}
        onRefreshSchedule={handleRefreshSchedule}
      />

      <Card className="p-4 space-y-4 animate-slide-in-up animate-hover-lift">
        <CalendarStrip 
          selectedDay={selectedDay} 
          setSelectedDay={setSelectedDay} 
          datesWithTasks={datesWithTasks} 
          isLoadingDatesWithTasks={isLoadingDatesWithTasks}
        />
        
        <SchedulerSegmentedControl currentView={view} />
      </Card>

      <div className="animate-slide-in-up">
        {view === 'schedule' && renderScheduleCore()}
        {view === 'recap' && renderRecapView()}
        {view === 'sink' && renderSinkView()}
      </div>

      {isMobile && view === 'schedule' && (
          <Drawer>
              <DrawerTrigger asChild>
                  <Button
                      variant="default"
                      size="icon"
                      className={cn(
                          "fixed bottom-28 right-4 z-50 h-14 w-14 rounded-full shadow-xl bg-accent hover:bg-accent/90 transition-all duration-200",
                          isProcessingCommand && "opacity-70 cursor-not-allowed"
                      )}
                      disabled={isProcessingCommand}
                  >
                      <Settings2 className="h-6 w-6" />
                      <span className="sr-only">Open Schedule Controls</span>
                  </Button>
              </DrawerTrigger>
              <DrawerContent className="max-h-[90vh]">
                  <DrawerHeader className="text-left">
                      <DrawerTitle className="flex items-center gap-2 text-xl font-bold">
                          <Settings2 className="h-6 w-6 text-primary" /> Schedule Controls
                      </DrawerTitle>
                  </DrawerHeader>
                  <div className="p-4 overflow-y-auto space-y-4">
                      <SchedulerContextBar T_current={T_current} />
                      
                      <SchedulerActionCenter 
                          isProcessingCommand={isProcessingCommand}
                          dbScheduledTasks={dbScheduledTasks}
                          retiredTasksCount={retiredTasks.length}
                          sortBy={sortBy}
                          onAutoSchedule={handleAutoScheduleDay}
                          onCompactSchedule={handleCompactSchedule}
                          onRandomizeBreaks={handleRandomizeBreaks}
                          onZoneFocus={handleZoneFocus}
                          onRechargeEnergy={() => rechargeEnergy()}
                          onQuickBreak={handleQuickBreakButton}
                          onQuickScheduleBlock={handleQuickScheduleBlock}
                          onSortFlexibleTasks={handleSortFlexibleTasks}
                          onAetherDump={handleAetherDumpButton}
                          onAetherDumpMega={handleAetherDumpMegaButton}
                          onRefreshSchedule={handleRefreshSchedule}
                          onOpenWorkdayWindowDialog={handleOpenWorkdayWindowDialog}
                          onStartRegenPod={handleStartRegenPod}
                          hasFlexibleTasksOnCurrentDay={hasFlexibleTasksOnCurrentDay}
                      />
                  </div>
              </DrawerContent>
          </Drawer>
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
              This action will permanently delete all scheduled tasks for {formatFns(parseISO(selectedDay), 'EEEE, MMMM d')}. This cannot be undone.
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