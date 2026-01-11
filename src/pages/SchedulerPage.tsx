"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { format, isBefore, addMinutes, parseISO, isSameDay, startOfDay, addHours, addDays, differenceInMinutes, max, min, isAfter } from 'date-fns';
import { ListTodo, Loader2, Cpu, Zap, Clock, Trash2, Archive, Target, Database, CalendarDays, Lock, Unlock, Sparkles, Plus, ArrowDownToLine } from 'lucide-react';
import SchedulerInput from '@/components/SchedulerInput';
import SchedulerDisplay from '@/components/SchedulerDisplay';
import { DBScheduledTask, RetiredTask, SortBy, TaskEnvironment, TimeBlock, NewDBScheduledTask } from '@/types/scheduler';
import {
  calculateSchedule,
  parseTaskInput,
  parseCommand,
  setTimeOnDate,
  compactScheduleLogic,
  mergeOverlappingTimeBlocks,
  findFirstAvailableSlot,
  getStaticConstraints,
} from '@/lib/scheduler-utils';
import { showSuccess, showError } from '@/utils/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import { useRetiredTasks } from '@/hooks/use-retired-tasks';
import { useSession } from '@/hooks/use-session';
import SchedulerDashboardPanel from '@/components/SchedulerDashboardPanel';
import NowFocusCard from '@/components/NowFocusCard';
import CalendarStrip from '@/components/CalendarStrip';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import WorkdayWindowDialog from '@/components/WorkdayWindowDialog';
import ImmersiveFocusMode from '@/components/ImmersiveFocusMode';
import SchedulerContextBar from '@/components/SchedulerContextBar';
import SchedulerActionCenter from '@/components/SchedulerActionCenter';
import { useEnvironmentContext } from '@/hooks/use-environment-context';
import { MealAssignment } from '@/hooks/use-meals';
import { cn } from '@/lib/utils';
import EnergyRegenPodModal from '@/components/EnergyRegenPodModal'; 
import { REGEN_POD_MAX_DURATION_MINUTES } from '@/lib/constants'; 
import { useNavigate } from 'react-router-dom';
import CreateTaskDialog from '@/components/CreateTaskDialog';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';

const SchedulerPage: React.FC<{ view: 'schedule' | 'sink' | 'recap' }> = ({ view }) => {
  const { user, profile, isLoading: isSessionLoading, rechargeEnergy, activeItemToday, nextItemToday, startRegenPodState, exitRegenPodState, regenPodDurationMinutes } = useSession();
  const { selectedEnvironments } = useEnvironmentContext();
  const environmentForPlacement = selectedEnvironments[0] || 'laptop';
  
  const [selectedDay, setSelectedDay] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [T_current, setT_current] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setT_current(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const { 
    dbScheduledTasks,
    isLoading: isSchedulerTasksLoading, 
    addScheduledTask, 
    removeScheduledTask, 
    clearScheduledTasks,
    datesWithTasks,
    isLoadingDatesWithTasks,
    retireTask,
    compactScheduledTasks,
    randomizeBreaks,
    aetherDump,
    aetherDumpMega,
    sortBy,
    setSortBy,
    completeScheduledTask: completeScheduledTaskMutation,
    handleAutoScheduleAndSort,
    toggleAllScheduledTasksLock,
    pullNextFromSink,
  } = useSchedulerTasks(selectedDay);

  const { retiredTasks, isLoadingRetiredTasks, addRetiredTask, rezoneTask } = useRetiredTasks();

  const { data: mealAssignments = [] } = useQuery<MealAssignment[]>({
    queryKey: ['mealAssignments', user?.id, selectedDay],
    queryFn: async () => {
      if (!user?.id || !selectedDay) return [];
      const { data, error } = await supabase.from('meal_assignments').select('*, meal_idea:meal_ideas(*)').eq('assigned_date', selectedDay).eq('user_id', user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && !!selectedDay,
  });

  const [isProcessingCommand, setIsProcessingCommand] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [showWorkdayWindowDialog, setShowWorkdayWindowDialog] = useState(false);
  const [isFocusModeActive, setIsFocusModeActive] = useState(false);
  const [showRegenPodSetup, setShowRegenPodSetup] = useState(false); 
  const [isCreateTaskDialogOpen, setIsCreateTaskDialogOpen] = useState(false);
  const [createTaskDefaultValues, setCreateTaskDefaultValues] = useState<any>({ defaultPriority: 'MEDIUM', defaultDueDate: new Date() });

  const selectedDayAsDate = useMemo(() => parseISO(selectedDay), [selectedDay]);

  const workdayStartTime = useMemo(() => profile?.default_auto_schedule_start_time ? setTimeOnDate(selectedDayAsDate, profile.default_auto_schedule_start_time) : startOfDay(selectedDayAsDate), [profile?.default_auto_schedule_start_time, selectedDayAsDate]);
  let workdayEndTime = useMemo(() => profile?.default_auto_schedule_end_time ? setTimeOnDate(selectedDayAsDate, profile.default_auto_schedule_end_time) : addHours(startOfDay(selectedDayAsDate), 17), [profile?.default_auto_schedule_end_time, selectedDayAsDate]);
  if (isBefore(workdayEndTime, workdayStartTime)) workdayEndTime = addDays(workdayEndTime, 1);

  // MEMOIZED CONSTRAINTS: Fix for Pull Next logic
  const staticConstraints = useMemo(() => {
    if (!profile) return [];
    return getStaticConstraints(profile, selectedDayAsDate, workdayStartTime, workdayEndTime);
  }, [profile, selectedDayAsDate, workdayStartTime, workdayEndTime]);

  const isDayLockedDown = useMemo(() => dbScheduledTasks.length > 0 && dbScheduledTasks.every(t => t.is_locked), [dbScheduledTasks]);

  const calculatedSchedule = useMemo(() => {
    if (!profile) return null;
    return calculateSchedule(dbScheduledTasks, selectedDay, workdayStartTime, workdayEndTime, profile.is_in_regen_pod, profile.regen_pod_start_time ? parseISO(profile.regen_pod_start_time) : null, regenPodDurationMinutes, T_current, profile.breakfast_time, profile.lunch_time, profile.dinner_time, profile.breakfast_duration_minutes, profile.lunch_duration_minutes, profile.dinner_duration_minutes, profile.reflection_count, profile.reflection_times, profile.reflection_durations, mealAssignments, profile.blocked_days?.includes(selectedDay));
  }, [dbScheduledTasks, selectedDay, workdayStartTime, workdayEndTime, profile, regenPodDurationMinutes, mealAssignments, T_current]);

  const scheduleSummary = useMemo(() => calculatedSchedule?.summary || null, [
    calculatedSchedule?.summary.totalTasks,
    calculatedSchedule?.summary.activeTime.hours,
    calculatedSchedule?.summary.activeTime.minutes,
    calculatedSchedule?.summary.breakTime,
    calculatedSchedule?.summary.sessionEnd.getTime()
  ]);

  const handleCommand = useCallback(async (input: string) => {
    if (!user || !profile) return showError("Please log in.");
    setIsProcessingCommand(true);
    try {
      const cmd = parseCommand(input);
      if (cmd) {
        if (cmd.type === 'clear') await clearScheduledTasks();
        else if (cmd.type === 'compact') {
            const tasksToUpdate = compactScheduleLogic(dbScheduledTasks, selectedDayAsDate, workdayStartTime, workdayEndTime, T_current, profile, sortBy);
            await compactScheduledTasks({ tasksToUpdate });
        }
        else if (cmd.type === 'aether dump') await aetherDump();
        else if (cmd.type === 'aether dump mega') await aetherDumpMega();
        setInputValue('');
        return;
      }
      const task = parseTaskInput(input, selectedDayAsDate);
      if (task) {
        if (task.shouldSink) {
          await addRetiredTask({ user_id: user.id, name: task.name, duration: task.duration || 30, break_duration: task.breakDuration || null, original_scheduled_date: selectedDay, is_critical: task.isCritical, energy_cost: task.energyCost, task_environment: environmentForPlacement, is_backburner: task.isBackburner, is_work: task.isWork, is_break: task.isBreak });
        } else if (task.duration) {
          const blocks = dbScheduledTasks.filter(t => t.start_time && t.end_time).map(t => ({ start: parseISO(t.start_time!), end: parseISO(t.end_time!), duration: differenceInMinutes(parseISO(t.end_time!), parseISO(t.start_time!)) }));
          const allConstraints = mergeOverlappingTimeBlocks([...blocks, ...getStaticConstraints(profile, selectedDayAsDate, workdayStartTime, workdayEndTime)]);
          const slot = findFirstAvailableSlot(task.duration + (task.breakDuration || 0), allConstraints, isSameDay(selectedDayAsDate, new Date()) ? max([workdayStartTime, T_current]) : workdayStartTime, workdayEndTime);
          if (slot) await addScheduledTask({ name: task.name, start_time: slot.start.toISOString(), end_time: slot.end.toISOString(), break_duration: task.breakDuration || null, scheduled_date: selectedDay, is_critical: task.isCritical, is_flexible: true, is_locked: false, energy_cost: task.energyCost, task_environment: environmentForPlacement, is_backburner: task.isBackburner, is_work: task.isWork, is_break: task.isBreak });
          else showError("No slot found.");
        }
        setInputValue('');
      }
    } catch (e: any) { showError(e.message); } finally { setIsProcessingCommand(false); }
  }, [user, profile, selectedDay, selectedDayAsDate, dbScheduledTasks, workdayStartTime, workdayEndTime, T_current, environmentForPlacement, sortBy]);

  useKeyboardShortcuts({ onCompact: () => handleCommand('compact'), onRebalance: () => handleAutoScheduleAndSort(sortBy, 'sink-to-gaps', [], selectedDay), onClear: () => handleCommand('clear') });

  const isDashboardLoading = isSessionLoading || isSchedulerTasksLoading;

  if (isSessionLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="w-full pb-4 space-y-6">
      {isFocusModeActive && activeItemToday && calculatedSchedule && (
        <ImmersiveFocusMode activeItem={activeItemToday} T_current={T_current} onExit={() => setIsFocusModeActive(false)} onAction={async (action, task) => {
            setIsProcessingCommand(true);
            try {
              if (action === 'complete') { await completeScheduledTaskMutation(task); await rechargeEnergy(-(task.energy_cost)); }
              else if (action === 'skip') await retireTask(task);
              else if (action === 'exitFocus') setIsFocusModeActive(false);
            } finally { setIsProcessingCommand(false); }
        }} dbTask={calculatedSchedule.dbTasks.find(t => t.id === activeItemToday.id) || null} nextItem={nextItemToday} isProcessingCommand={isProcessingCommand} />
      )}
      
      <div className="max-w-4xl mx-auto w-full space-y-6">
        <SchedulerDashboardPanel scheduleSummary={scheduleSummary} onAetherDump={aetherDump} isProcessingCommand={isProcessingCommand} hasFlexibleTasks={dbScheduledTasks.some(t => t.is_flexible && !t.is_locked)} onRefreshSchedule={() => queryClient.invalidateQueries()} isLoading={isDashboardLoading} />
        <CalendarStrip selectedDay={selectedDay} setSelectedDay={setSelectedDay} datesWithTasks={datesWithTasks} isLoadingDatesWithTasks={isLoadingDatesWithTasks} weekStartsOn={profile?.week_starts_on ?? 0} blockedDays={profile?.blocked_days || []} />
        <SchedulerContextBar />
        <Card className="p-4 rounded-xl shadow-sm border-white/5"><CardHeader className="p-0 pb-4"><CardTitle className="text-xl font-bold flex items-center gap-2"><ListTodo className="h-6 w-6 text-primary" /> Quick Add</CardTitle></CardHeader><CardContent className="p-0"><SchedulerInput onCommand={handleCommand} isLoading={isProcessingCommand} inputValue={inputValue} setInputValue={setInputValue} onDetailedInject={() => (setCreateTaskDefaultValues({ defaultPriority: 'MEDIUM', defaultDueDate: selectedDayAsDate }), setIsCreateTaskDialogOpen(true))} onQuickBreak={async () => handleCommand('break 15')} /></CardContent></Card>
        <SchedulerActionCenter isProcessingCommand={isProcessingCommand} dbScheduledTasks={dbScheduledTasks} retiredTasksCount={retiredTasks.length} sortBy={sortBy} onRebalanceToday={() => handleAutoScheduleAndSort(sortBy, 'sink-to-gaps', [], selectedDay)} onReshuffleEverything={() => handleAutoScheduleAndSort(sortBy, 'all-flexible', [], selectedDay)} onCompactSchedule={async () => handleCommand('compact')} onRandomizeBreaks={async () => randomizeBreaks({ selectedDate: selectedDay, workdayStartTime, workdayEndTime, currentDbTasks: dbScheduledTasks })} onZoneFocus={() => handleAutoScheduleAndSort(sortBy, 'sink-only', selectedEnvironments, selectedDay)} onRechargeEnergy={() => rechargeEnergy()} onQuickBreak={async () => handleCommand('break 15')} onQuickScheduleBlock={async (d, s) => { /* logic */ }} onSortFlexibleTasks={async (s) => setSortBy(s)} onAetherDump={aetherDump} onAetherDumpMega={aetherDumpMega} onRefreshSchedule={() => queryClient.invalidateQueries()} onOpenWorkdayWindowDialog={() => setShowWorkdayWindowDialog(true)} onStartRegenPod={() => setShowRegenPodSetup(true)} hasFlexibleTasksOnCurrentDay={dbScheduledTasks.some(t => t.is_flexible && !t.is_locked)} navigate={navigate} onGlobalAutoSchedule={() => handleAutoScheduleAndSort(sortBy, 'global-all-future', [], selectedDay, 30)} onClearToday={clearScheduledTasks} onPullNext={() => pullNextFromSink({ selectedDateString: selectedDay, workdayStart: workdayStartTime, workdayEnd: workdayEndTime, T_current, staticConstraints })} />
        <NowFocusCard activeItem={activeItemToday} nextItem={nextItemToday} onEnterFocusMode={() => setIsFocusModeActive(true)} isLoading={isDashboardLoading} />
        <SchedulerDisplay schedule={calculatedSchedule} T_current={T_current} onRemoveTask={removeScheduledTask} onRetireTask={retireTask} onCompleteTask={async (t) => { await completeScheduledTaskMutation(t); await rechargeEnergy(-(t.energy_cost)); }} activeItemId={activeItemToday?.id || null} selectedDayString={selectedDay} onScrollToItem={() => {}} isProcessingCommand={isProcessingCommand} onFreeTimeClick={(s, e) => (setCreateTaskDefaultValues({ defaultPriority: 'MEDIUM', defaultDueDate: selectedDayAsDate, defaultStartTime: s, defaultEndTime: e }), setIsCreateTaskDialogOpen(true))} isDayLockedDown={isDayLockedDown} onToggleDayLock={async () => toggleAllScheduledTasksLock({ selectedDate: selectedDay, lockState: !isDayLockedDown })} />
      </div>
      <WorkdayWindowDialog open={showWorkdayWindowDialog} onOpenChange={setShowWorkdayWindowDialog} />
      <CreateTaskDialog defaultPriority={createTaskDefaultValues.defaultPriority} defaultDueDate={createTaskDefaultValues.defaultDueDate} defaultStartTime={createTaskDefaultValues.defaultStartTime} defaultEndTime={createTaskDefaultValues.defaultEndTime} onTaskCreated={() => queryClient.invalidateQueries()} isOpen={isCreateTaskDialogOpen} onOpenChange={setIsCreateTaskDialogOpen} />
    </div>
  );
};

export default SchedulerPage;