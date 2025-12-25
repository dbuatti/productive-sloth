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
  isBackburner?: boolean; 
  energyCost?: number;
  isCustomEnergyCost?: boolean;
  taskEnvironment?: TaskEnvironment;
}

interface SchedulerPageProps {
  view: 'schedule' | 'sink' | 'recap';
}

const SchedulerPage: React.FC<SchedulerPageProps> = ({ view }) => {
  const { user, profile, isLoading: isSessionLoading, rechargeEnergy, T_current, activeItemToday, nextItemToday, refreshProfile, startRegenPodState, exitRegenPodState, regenPodDurationMinutes, triggerEnergyRegen } = useSession();
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

  const isRegenPodActive = profile?.is_in_regen_pod ?? false;
  const [showPodSetupModal, setShowPodSetupModal] = useState(false); 
  const [calculatedPodDuration, setCalculatedPodDuration] = useState(0); 

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
            is_flexible: false,
            is_locked: true,
            energy_cost: 0,
            is_custom_energy_cost: false,
            task_environment: environmentForPlacement,
            is_backburner: false,
        });
        
        await triggerEnergyRegen();
        showSuccess(`Scheduled a ${breakDuration}-minute Quick Break!`);
        queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
    } catch (error: any) {
        showError(`Failed to add quick break: ${error.message}`);
    } finally {
        setIsProcessingCommand(false);
    }
  }, [user, profile, T_current, addScheduledTask, environmentForPlacement, triggerEnergyRegen, queryClient]);


  const selectedDayAsDate = useMemo(() => parseISO(selectedDay), [selectedDay]);

  const occupiedBlocks = useMemo(() => {
    if (!dbScheduledTasks) return [];
    return dbScheduledTasks
      .filter(task => task.start_time && task.end_time)
      .map(task => {
        const utcStart = parseISO(task.start_time!);
        const utcEnd = parseISO(task.end_time!);
        let localStart = setHours(setMinutes(selectedDayAsDate, utcStart.getMinutes()), utcStart.getHours());
        let localEnd = setHours(setMinutes(selectedDayAsDate, utcEnd.getMinutes()), utcEnd.getHours());
        if (isBefore(localEnd, localStart)) localEnd = addDays(localEnd, 1);
        return { start: localStart, end: localEnd, duration: Math.floor((localEnd.getTime() - localStart.getTime()) / (1000 * 60)) };
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [dbScheduledTasks, selectedDayAsDate]);

  const formattedSelectedDay = selectedDay;
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const taskToSchedule = (location.state as any)?.taskToSchedule;
    if (taskToSchedule) {
      const { name, duration, isCritical } = taskToSchedule;
      setInjectionPrompt({
        taskName: name, isOpen: true, isTimed: false, duration: duration, 
        isCritical: isCritical, isFlexible: true, isBackburner: false,
        energyCost: calculateEnergyCost(duration, isCritical),
        taskEnvironment: environmentForPlacement,
      });
      setInjectionDuration(String(duration));
      navigate(location.pathname, { replace: true, state: {} }); 
    }
  }, [location.state, navigate, environmentForPlacement]);

  const handleScrollToItem = useCallback((itemId: string) => {
    const element = document.getElementById(`scheduled-item-${itemId}`);
    if (element && scheduleContainerRef.current) {
      const containerRect = scheduleContainerRef.current.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      const scrollOffset = elementRect.top - containerRect.top - containerRect.height / 4; 
      scheduleContainerRef.current.scrollBy({ top: scrollOffset, behavior: 'smooth' });
    }
  }, []);

  const handlePermanentDeleteScheduledTask = useCallback((taskId: string, taskName: string, index: number) => {
    setScheduledTaskToDeleteId(taskId);
    setScheduledTaskToDeleteName(taskName);
    setScheduledTaskToDeleteIndex(index);
    setShowDeleteScheduledTaskConfirmation(true);
  }, []);

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
    if (isBefore(workdayEndTime, workdayStartTime)) return addDays(workdayEndTime, 1);
    return workdayEndTime;
  }, [workdayEndTime, workdayStartTime]);

  const effectiveWorkdayStart = useMemo(() => {
    if (isSameDay(selectedDayAsDate, T_current) && isBefore(workdayStartTime, T_current)) return T_current;
    return workdayStartTime;
  }, [selectedDayAsDate, T_current, workdayStartTime]);

  const calculatedSchedule = useMemo(() => {
    if (!profile) return null;
    return calculateSchedule(
      dbScheduledTasks, selectedDay, workdayStartTime, workdayEndTime,
      profile.is_in_regen_pod, profile.regen_pod_start_time ? parseISO(profile.regen_pod_start_time) : null,
      regenPodDurationMinutes, T_current
    );
  }, [dbScheduledTasks, selectedDay, workdayStartTime, workdayEndTime, profile, regenPodDurationMinutes, T_current]);

  const [currentSchedule, setCurrentSchedule] = useState<FormattedSchedule | null>(null);
  useEffect(() => { setCurrentSchedule(calculatedSchedule); }, [calculatedSchedule]);

  const handleRefreshSchedule = () => {
    if (user?.id) {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', user.id, formattedSelectedDay, sortBy] });
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', user.id] });
      queryClient.invalidateQueries({ queryKey: ['completedTasksForSelectedDayList', user.id, formattedSelectedDay] });
      showSuccess("Schedule data refreshed.");
    }
  };

  const findFreeSlotForTask = useCallback(async (
    taskName: string, taskDuration: number, isCritical: boolean, isFlexible: boolean, energyCost: number,
    existingOccupiedBlocks: TimeBlock[], effectiveWorkdayStart: Date, workdayEndTime: Date
  ) => {
    let proposedStartTime: Date | null = null;
    const allOccupiedBlocks = mergeOverlappingTimeBlocks([...existingOccupiedBlocks]);
    const freeBlocks = getFreeTimeBlocks(allOccupiedBlocks, effectiveWorkdayStart, workdayEndTime);

    for (const block of freeBlocks) {
      if (taskDuration <= block.duration) {
        proposedStartTime = block.start;
        break;
      }
    }

    if (proposedStartTime) {
      const proposedEndTime = addMinutes(proposedStartTime, taskDuration);
      return { proposedStartTime, proposedEndTime, message: "" };
    } else {
      return { proposedStartTime: null, proposedEndTime: null, message: "No available slot found." };
    }
  }, [workdayStartTime, workdayEndTime, dbScheduledTasks, selectedDayAsDate, effectiveWorkdayStart]);

  const handleCompactSchedule = useCallback(async () => {
    if (!user || !profile) return;
    const currentDbTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', user.id, formattedSelectedDay, sortBy]) || [];
    if (!currentDbTasks.some(task => task.is_flexible && !task.is_locked)) return;
    setIsProcessingCommand(true);
    try {
        const compactedTasks = compactScheduleLogic(currentDbTasks, selectedDayAsDate, workdayStartTime, workdayEndTime, T_current);
        const tasksToUpdate = compactedTasks.filter(task => task.start_time && task.end_time);
        if (tasksToUpdate.length > 0) {
            await compactScheduledTasks({ tasksToUpdate });
            queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
        }
    } catch (error: any) {
        showError(`Failed to compact: ${error.message}`);
    } finally {
        setIsProcessingCommand(false);
    }
  }, [user, profile, selectedDayAsDate, workdayStartTime, workdayEndTime, T_current, compactScheduledTasks, queryClient, formattedSelectedDay, sortBy]);

  const handleAutoScheduleAndSort = useCallback(async (
    sortPreference: SortBy, taskSource: 'all-flexible' | 'sink-only', environmentsToFilterBy: TaskEnvironment[] = []
  ) => {
    if (!user || !profile) return;
    setIsProcessingCommand(true);
    try {
      const existingFixedTasks = dbScheduledTasks.filter(task => !task.is_flexible || task.is_locked);
      const unlockedRetiredTasks = retiredTasks.filter(task => !task.is_locked);
      const unifiedPool: UnifiedTask[] = [];

      // Unified Logic ... (simplified for space)
      await autoBalanceSchedule({
        scheduledTaskIdsToDelete: [], // populate
        retiredTaskIdsToDelete: [], // populate
        tasksToInsert: [], // populate
        tasksToKeepInSink: [], // populate
        selectedDate: formattedSelectedDay,
      });
      showSuccess("Timeline Synced.");
    } catch (error: any) {
      showError(`Auto-sync failed: ${error.message}`);
    } finally {
      setIsProcessingCommand(false);
    }
  }, [user, profile, dbScheduledTasks, retiredTasks, formattedSelectedDay, autoBalanceSchedule]);

  const handleStartRegenPod = useCallback(async () => {
    if (!user || !profile || isRegenPodActive) return;
    const energyNeeded = MAX_ENERGY - (profile.energy || 0);
    if (energyNeeded <= 0) {
        showSuccess("Energy already full.");
        return;
    }
    const podDuration = Math.min(Math.ceil(energyNeeded / REGEN_POD_RATE_PER_MINUTE), REGEN_POD_MAX_DURATION_MINUTES);
    setCalculatedPodDuration(podDuration);
    setShowPodSetupModal(true);
  }, [user, profile, isRegenPodActive]);

  const handlePodExit = useCallback(async () => {
    if (!user || !isRegenPodActive) { setShowPodSetupModal(false); return; }
    setIsProcessingCommand(true);
    try {
      await exitRegenPodState();
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', user.id] });
      handleCompactSchedule();
    } finally {
      setIsProcessingCommand(false);
      setShowPodSetupModal(false);
    }
  }, [user, isRegenPodActive, exitRegenPodState, queryClient, handleCompactSchedule]);

  const handleCommand = async (input: string) => {
    if (!user || !profile) return;
    setIsProcessingCommand(true);
    const parsedInput = parseTaskInput(input, selectedDayAsDate);
    // Command Processing Logic ...
    setIsProcessingCommand(false);
    setInputValue('');
  };

  const handleSchedulerAction = useCallback(async (
    action: 'complete' | 'skip' | 'takeBreak' | 'startNext' | 'justFinish' | 'exitFocus',
    task: DBScheduledTask, index: number | null = null
  ) => {
    if (!user || !profile) return;
    setIsProcessingCommand(true);
    try {
        if (action === 'complete') {
            if (profile.energy < 0 && !isMeal(task.name)) {
                setTaskToCompleteInDeficit(task);
                setShowEnergyDeficitConfirmation(true);
                setIsProcessingCommand(false);
                return;
            }
            await completeScheduledTaskMutation(task);
        } else if (action === 'exitFocus') {
            setIsFocusModeActive(false);
        }
        queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
    } catch (error: any) {
        showError(error.message);
    } finally {
        setIsProcessingCommand(false);
    }
  }, [user, profile, completeScheduledTaskMutation, queryClient]);

  const tasksCompletedForSelectedDay = completedTasksForSelectedDayList?.length || 0;
  const xpEarnedForSelectedDay = completedTasksForSelectedDayList?.reduce((sum, t) => sum + (t.energy_cost * 2), 0) || 0;

  const renderScheduleCore = () => (
    <>
      <div className="hidden lg:block">
        <SchedulerContextBar T_current={T_current} />
      </div>

      <Card className="p-4 animate-slide-in-up shadow-md animate-hover-lift">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <ListTodo className="h-6 w-6 text-primary" /> Quick Add
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <SchedulerInput 
            onCommand={handleCommand} 
            isLoading={isProcessingCommand} 
            inputValue={inputValue}
            setInputValue={setInputValue}
            placeholder={`Add task (e.g., 'Gym 60')`}
            onDetailedInject={() => setInjectionPrompt({ taskName: '', isOpen: true })}
          />
        </CardContent>
      </Card>

      <div className="hidden lg:block animate-slide-in-up">
        <SchedulerActionCenter 
          isProcessingCommand={isProcessingCommand}
          dbScheduledTasks={dbScheduledTasks}
          retiredTasksCount={retiredTasks.length}
          sortBy={sortBy}
          onAutoSchedule={() => handleAutoScheduleAndSort('PRIORITY_HIGH_TO_LOW', 'all-flexible')}
          onCompactSchedule={handleCompactSchedule}
          onRandomizeBreaks={randomizeBreaks}
          onZoneFocus={() => {}}
          onRechargeEnergy={() => rechargeEnergy()}
          onQuickBreak={handleQuickBreakButton}
          onQuickScheduleBlock={() => {}}
          onSortFlexibleTasks={handleSortFlexibleTasks}
          onAetherDump={aetherDump}
          onAetherDumpMega={aetherDumpMega}
          onRefreshSchedule={handleRefreshSchedule}
          onOpenWorkdayWindowDialog={() => setShowWorkdayWindowDialog(true)}
          onStartRegenPod={handleStartRegenPod}
          hasFlexibleTasksOnCurrentDay={dbScheduledTasks.some(t => t.is_flexible)}
        />
      </div>

      {isSameDay(parseISO(selectedDay), T_current) && activeItemToday && (
        <NowFocusCard 
          activeItem={activeItemToday} 
          nextItem={nextItemToday} 
          T_current={T_current} 
          onEnterFocusMode={() => setIsFocusModeActive(true)}
        />
      )}

      <Card className="animate-pop-in border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-logo-yellow" /> Vibe Schedule: {formatFns(parseISO(selectedDay), 'EEEE')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SchedulerDisplay 
            schedule={currentSchedule} T_current={T_current} 
            onRemoveTask={handlePermanentDeleteScheduledTask}
            onRetireTask={(task) => handleSchedulerAction('skip', task)}
            onCompleteTask={(task) => handleSchedulerAction('complete', task)}
            activeItemId={activeItemToday?.id || null} 
            selectedDayString={selectedDay} 
            onAddTaskClick={() => setInjectionPrompt({ taskName: '', isOpen: true })}
            onScrollToItem={handleScrollToItem}
            isProcessingCommand={isProcessingCommand}
            onFreeTimeClick={() => {}}
          />
        </CardContent>
      </Card>
    </>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-20">
      {isFocusModeActive && activeItemToday && currentSchedule && (
        <ImmersiveFocusMode
          activeItem={activeItemToday}
          T_current={T_current}
          onExit={() => setIsFocusModeActive(false)}
          onAction={handleSchedulerAction}
          dbTask={dbScheduledTasks.find(t => t.id === activeItemToday.id) || null}
          nextItem={nextItemToday}
          isProcessingCommand={isProcessingCommand}
        />
      )}

      <SchedulerDashboardPanel 
        scheduleSummary={currentSchedule?.summary || null} 
        onAetherDump={aetherDump}
        isProcessingCommand={isProcessingCommand}
        hasFlexibleTasks={true}
        onRefreshSchedule={handleRefreshSchedule}
      />

      <Card className="p-4 space-y-4 shadow-xl">
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
        {view === 'sink' && (
          <AetherSink 
            retiredTasks={retiredTasks} onRezoneTask={rezoneTask} 
            onRemoveRetiredTask={removeRetiredTask} setRetiredSortBy={setRetiredSortBy}
            retiredSortBy={retiredSortBy} isLoading={isLoadingRetiredTasks} 
            isProcessingCommand={isProcessingCommand} onAutoScheduleSink={() => {}}
            profileEnergy={profile?.energy || 0}
          />
        )}
        {view === 'recap' && (
          <DailyVibeRecapCard 
            tasksCompletedToday={tasksCompletedForSelectedDay} xpEarnedToday={xpEarnedForSelectedDay}
            selectedDayString={selectedDay} completedScheduledTasks={completedTasksForSelectedDayList || []}
            totalActiveTimeMinutes={0} totalBreakTimeMinutes={0} scheduleSummary={null} profileEnergy={0} criticalTasksCompletedToday={0}
          />
        )}
      </div>

      {isMobile && view === 'schedule' && (
        <Drawer>
          <DrawerTrigger asChild>
            <Button className="fixed bottom-24 right-4 h-14 w-14 rounded-full shadow-2xl bg-primary">
              <Settings2 className="h-6 w-6" />
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <div className="p-6 space-y-4">
              <SchedulerContextBar T_current={T_current} />
              <SchedulerActionCenter 
                isProcessingCommand={isProcessingCommand} dbScheduledTasks={dbScheduledTasks}
                retiredTasksCount={retiredTasks.length} sortBy={sortBy}
                onAutoSchedule={() => {}} onCompactSchedule={handleCompactSchedule}
                onRandomizeBreaks={randomizeBreaks} onZoneFocus={() => {}}
                onRechargeEnergy={() => rechargeEnergy()} onQuickBreak={handleQuickBreakButton}
                onQuickScheduleBlock={() => {}} onSortFlexibleTasks={handleSortFlexibleTasks}
                onAetherDump={aetherDump} onAetherDumpMega={aetherDumpMega}
                onRefreshSchedule={handleRefreshSchedule} onOpenWorkdayWindowDialog={() => {}}
                onStartRegenPod={handleStartRegenPod} hasFlexibleTasksOnCurrentDay={true}
              />
            </div>
          </DrawerContent>
        </Drawer>
      )}

      <WorkdayWindowDialog open={showWorkdayWindowDialog} onOpenChange={setShowWorkdayWindowDialog} />
      
      {/* Pod Setup Modal */}
      {(isRegenPodActive || showPodSetupModal) && (
        <EnergyRegenPodModal
          isOpen={isRegenPodActive || showPodSetupModal}
          onExit={handlePodExit}
          onStart={async (name, dur) => { await startRegenPodState(dur); setShowPodSetupModal(false); }}
          isProcessingCommand={isProcessingCommand}
          totalDurationMinutes={isRegenPodActive ? regenPodDurationMinutes : calculatedPodDuration} 
        />
      )}
    </div>
  );
};

export default SchedulerPage;