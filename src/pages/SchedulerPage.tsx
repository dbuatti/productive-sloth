"use client";

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

const SchedulerPage: React.FC<{ view: 'schedule' | 'sink' | 'recap' }> = ({ view }) => {
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
    handleAutoScheduleAndSort,
  } = useSchedulerTasks(selectedDay, scheduleContainerRef);

  const queryClient = useQueryClient();
  const [isProcessingCommand, setIsProcessingCommand] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [showWorkdayWindowDialog, setShowWorkdayWindowDialog] = useState(false);
  const [isFocusModeActive, setIsFocusModeActive] = useState(false);
  const [showPodSetupModal, setShowPodSetupModal] = useState(false); 

  const selectedDayAsDate = useMemo(() => {
    const [year, month, day] = selectedDay.split('-').map(Number);
    return new Date(year, month - 1, day);
  }, [selectedDay]);

  const workdayStartTimeForSelectedDay = useMemo(() => profile?.default_auto_schedule_start_time ? setTimeOnDate(selectedDayAsDate, profile.default_auto_schedule_start_time) : startOfDay(selectedDayAsDate), [profile?.default_auto_schedule_start_time, selectedDayAsDate]);
  let workdayEndTimeForSelectedDay = useMemo(() => profile?.default_auto_schedule_end_time ? setTimeOnDate(startOfDay(selectedDayAsDate), profile.default_auto_schedule_end_time) : addHours(startOfDay(selectedDayAsDate), 17), [profile?.default_auto_schedule_end_time, selectedDayAsDate]);
  if (isBefore(workdayEndTimeForSelectedDay, workdayStartTimeForSelectedDay)) workdayEndTimeForSelectedDay = addDays(workdayEndTimeForSelectedDay, 1);

  const handleRebalanceToday = useCallback(async () => {
    setIsProcessingCommand(true);
    await handleAutoScheduleAndSort(sortBy, 'all-flexible', [], selectedDay);
    setIsProcessingCommand(false);
  }, [handleAutoScheduleAndSort, selectedDay, sortBy]);

  const handleRebalanceAllFlexible = useCallback(async () => {
    setIsProcessingCommand(true);
    await handleAutoScheduleAndSort(sortBy, 'all-flexible', [], selectedDay);
    setIsProcessingCommand(false);
  }, [handleAutoScheduleAndSort, selectedDay, sortBy]);

  const handleZoneFocus = useCallback(async () => {
    setIsProcessingCommand(true);
    await handleAutoScheduleAndSort(sortBy, 'sink-only', selectedEnvironments, selectedDay);
    setIsProcessingCommand(false);
  }, [handleAutoScheduleAndSort, selectedEnvironments, selectedDay, sortBy]);

  const handleCompact = useCallback(async () => {
    const tasksToUpdate = compactScheduleLogic(
      dbScheduledTasks,
      selectedDayAsDate,
      workdayStartTimeForSelectedDay,
      workdayEndTimeForSelectedDay,
      T_current
    );
    await compactScheduledTasks({ tasksToUpdate });
  }, [dbScheduledTasks, selectedDayAsDate, workdayStartTimeForSelectedDay, workdayEndTimeForSelectedDay, T_current, compactScheduledTasks]);

  const handleRandomize = useCallback(async () => {
    await randomizeBreaks({
      selectedDate: selectedDay,
      workdayStartTime: workdayStartTimeForSelectedDay,
      workdayEndTime: workdayEndTimeForSelectedDay,
      currentDbTasks: dbScheduledTasks
    });
  }, [selectedDay, workdayStartTimeForSelectedDay, workdayEndTimeForSelectedDay, dbScheduledTasks, randomizeBreaks]);

  const handleRezone = useCallback(async (task: RetiredTask) => {
    await rezoneTask(task.id);
  }, [rezoneTask]);

  const handleRemoveRetired = useCallback(async (taskId: string, taskName: string) => {
    await removeRetiredTask(taskId);
  }, [removeRetiredTask]);

  const handleSortFlexibleTasks = useCallback(async (newSortBy: SortBy) => {
    setSortBy(newSortBy);
    showSuccess(`Balance logic set to ${newSortBy.replace(/_/g, ' ').toLowerCase()}.`);
  }, [setSortBy]);

  const handleCommand = useCallback(async (input: string) => {
    if (!user || !profile) return showError("Please log in.");
    setIsProcessingCommand(true);
    console.log("[SchedulerPage] Processing input command:", input);

    try {
      const command = parseCommand(input);
      if (command) {
        switch (command.type) {
          case 'clear': await clearScheduledTasks(); break;
          case 'compact': await handleCompact(); break;
          case 'aether dump': await aetherDump(); break;
          case 'aether dump mega': await aetherDumpMega(); break;
          case 'break':
            const breakDur = command.duration || 15;
            const bStart = T_current;
            const bEnd = addMinutes(bStart, breakDur);
            await addScheduledTask({ name: 'Break', start_time: bStart.toISOString(), end_time: bEnd.toISOString(), break_duration: breakDur, scheduled_date: selectedDay, is_critical: false, is_flexible: false, is_locked: true, energy_cost: 0, task_environment: 'away' });
            break;
          default: showError("Unknown engine command.");
        }
        setInputValue('');
        return;
      }

      const task = parseTaskInput(input, selectedDayAsDate);
      if (task) {
        if (task.shouldSink) {
          await addRetiredTask({ 
            user_id: user.id, name: task.name, duration: task.duration || 30, break_duration: task.breakDuration || null, 
            original_scheduled_date: selectedDay, is_critical: task.isCritical, energy_cost: task.energyCost, 
            task_environment: environmentForPlacement, is_backburner: task.isBackburner 
          });
        } else {
          const sStart = task.startTime ? task.startTime.toISOString() : undefined;
          const sEnd = task.endTime ? task.endTime.toISOString() : undefined;
          await addScheduledTask({ 
            name: task.name, start_time: sStart, end_time: sEnd, break_duration: task.breakDuration, 
            scheduled_date: selectedDay, is_critical: task.isCritical, is_flexible: task.isFlexible, 
            is_locked: !task.isFlexible, energy_cost: task.energyCost, task_environment: environmentForPlacement, 
            is_backburner: task.isBackburner 
          });
        }
        setInputValue('');
      } else {
        showError("Temporal mismatch: Task format unrecognized.");
      }
    } finally {
      setIsProcessingCommand(false);
    }
  }, [user, profile, selectedDay, selectedDayAsDate, clearScheduledTasks, handleCompact, aetherDump, aetherDumpMega, T_current, addScheduledTask, addRetiredTask, environmentForPlacement]);

  const handleSchedulerAction = useCallback(async (action: any, task: DBScheduledTask) => {
    setIsProcessingCommand(true);
    try {
      if (action === 'complete') {
        await completeScheduledTaskMutation(task);
        await rechargeEnergy(-(task.energy_cost));
        showSuccess(`Objective synchronized: +${task.energy_cost * 2} XP`);
      } else if (action === 'skip') {
        await retireTask(task);
      } else if (action === 'exitFocus') {
        setIsFocusModeActive(false);
      }
    } finally {
      setIsProcessingCommand(false);
    }
  }, [completeScheduledTaskMutation, rechargeEnergy, retireTask]);

  const overallLoading = isSessionLoading || isSchedulerTasksLoading || isProcessingCommand || isLoadingRetiredTasks || isLoadingCompletedTasksForSelectedDay;

  const calculatedSchedule = useMemo(() => {
    if (!profile) return null;
    return calculateSchedule(dbScheduledTasks, selectedDay, workdayStartTimeForSelectedDay, workdayEndTimeForSelectedDay, profile.is_in_regen_pod, profile.regen_pod_start_time ? parseISO(profile.regen_pod_start_time) : null, regenPodDurationMinutes, T_current, profile.breakfast_time, profile.lunch_time, profile.dinner_time, profile.breakfast_duration_minutes, profile.lunch_duration_minutes, profile.dinner_duration_minutes);
  }, [dbScheduledTasks, selectedDay, workdayStartTimeForSelectedDay, workdayEndTimeForSelectedDay, profile, regenPodDurationMinutes, T_current]);

  const [currentSchedule, setCurrentSchedule] = useState<FormattedSchedule | null>(null);
  useEffect(() => { setCurrentSchedule(calculatedSchedule); }, [calculatedSchedule]);

  const handleQuickBreakButton = useCallback(async () => {
    if (!user || !profile) return showError("Please log in.");
    setIsProcessingCommand(true);
    try {
        const breakDuration = 15;
        const breakStartTime = T_current;
        const breakEndTime = addMinutes(breakStartTime, breakDuration);
        const scheduledDate = formatFns(T_current, 'yyyy-MM-dd');
        await addScheduledTask({ name: 'Quick Break', start_time: breakStartTime.toISOString(), end_time: breakEndTime.toISOString(), break_duration: breakDuration, scheduled_date: scheduledDate, is_critical: false, is_flexible: false, is_locked: true, energy_cost: 0, is_custom_energy_cost: false, task_environment: 'away', is_backburner: false });
        await triggerEnergyRegen();
        showSuccess(`Scheduled a 15-minute Quick Break!`);
    } finally { setIsProcessingCommand(false); }
  }, [user, profile, T_current, addScheduledTask, triggerEnergyRegen]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {isFocusModeActive && activeItemToday && currentSchedule && (
        <ImmersiveFocusMode activeItem={activeItemToday} T_current={T_current} onExit={() => setIsFocusModeActive(false)} onAction={handleSchedulerAction} dbTask={currentSchedule.dbTasks.find(t => t.id === activeItemToday.id) || null} nextItem={nextItemToday} isProcessingCommand={isProcessingCommand} />
      )}
      <SchedulerDashboardPanel scheduleSummary={currentSchedule?.summary || null} onAetherDump={aetherDump} isProcessingCommand={isProcessingCommand} hasFlexibleTasks={dbScheduledTasks.some(i => i.is_flexible && !i.is_locked)} onRefreshSchedule={() => {}} />
      <Card className="p-4 space-y-4 animate-slide-in-up">
        <CalendarStrip selectedDay={selectedDay} setSelectedDay={setSelectedDay} datesWithTasks={datesWithTasks} isLoadingDatesWithTasks={isLoadingDatesWithTasks} />
        <SchedulerSegmentedControl currentView={view} />
      </Card>
      <div className="animate-slide-in-up">
        {view === 'schedule' && (
          <>
            <SchedulerContextBar T_current={T_current} />
            <Card className="p-4 shadow-md">
              <CardHeader className="p-0 pb-4"><CardTitle className="text-xl font-bold flex items-center gap-2"><ListTodo className="h-6 w-6 text-primary" /> Quick Add</CardTitle></CardHeader>
              <CardContent className="p-0"><SchedulerInput onCommand={handleCommand} isLoading={overallLoading} inputValue={inputValue} setInputValue={setInputValue} onDetailedInject={() => {}} /></CardContent>
            </Card>
            <SchedulerActionCenter 
              isProcessingCommand={overallLoading} 
              dbScheduledTasks={dbScheduledTasks} 
              retiredTasksCount={retiredTasks.length} 
              sortBy={sortBy} 
              onRebalanceToday={handleRebalanceToday} 
              onRebalanceAllFlexible={handleRebalanceAllFlexible} 
              onCompactSchedule={handleCompact} 
              onRandomizeBreaks={handleRandomize} 
              onZoneFocus={handleZoneFocus} 
              onRechargeEnergy={() => rechargeEnergy()} 
              onQuickBreak={handleQuickBreakButton} 
              onQuickScheduleBlock={() => Promise.resolve()} 
              onSortFlexibleTasks={handleSortFlexibleTasks} 
              onAetherDump={aetherDump} 
              onAetherDumpMega={aetherDumpMega} 
              onRefreshSchedule={() => {}} 
              onOpenWorkdayWindowDialog={() => setShowWorkdayWindowDialog(true)} 
              onStartRegenPod={() => setShowPodSetupModal(true)} 
              hasFlexibleTasksOnCurrentDay={dbScheduledTasks.some(t => t.is_flexible && !t.is_locked)}
            />
            <NowFocusCard activeItem={activeItemToday} nextItem={nextItemToday} T_current={T_current} onEnterFocusMode={() => setIsFocusModeActive(true)} />
            <Card className="animate-pop-in">
              <CardHeader><CardTitle>Your Vibe Schedule</CardTitle></CardHeader>
              <CardContent className="p-4">
                <SchedulerDisplay schedule={currentSchedule} T_current={T_current} onRemoveTask={() => {}} onRetireTask={() => {}} onCompleteTask={() => {}} activeItemId={activeItemToday?.id || null} selectedDayString={selectedDay} onAddTaskClick={() => {}} onScrollToItem={() => {}} isProcessingCommand={isProcessingCommand} onFreeTimeClick={() => {}} />
              </CardContent>
            </Card>
          </>
        )}
        {view === 'sink' && <AetherSink retiredTasks={retiredTasks} onRezoneTask={handleRezone} onRemoveRetiredTask={handleRemoveRetired} onAutoScheduleSink={() => handleAutoScheduleAndSort(sortBy, 'sink-only', [], selectedDay)} isLoading={isLoadingRetiredTasks} isProcessingCommand={isProcessingCommand} profileEnergy={profile?.energy || 0} retiredSortBy={retiredSortBy} setRetiredSortBy={setRetiredSortBy} />}
        {view === 'recap' && <DailyVibeRecapCard scheduleSummary={currentSchedule?.summary || null} tasksCompletedToday={completedTasksForSelectedDayList.length} xpEarnedToday={0} profileEnergy={profile?.energy || 0} criticalTasksCompletedToday={0} selectedDayString={selectedDay} completedScheduledTasks={completedTasksForSelectedDayList} totalActiveTimeMinutes={0} totalBreakTimeMinutes={0} />}
      </div>
      <WorkdayWindowDialog open={showWorkdayWindowDialog} onOpenChange={setShowWorkdayWindowDialog} />
    </div>
  );
};

export default SchedulerPage;