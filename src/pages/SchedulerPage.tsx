"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { format, isBefore, addMinutes, parseISO, isSameDay, startOfDay, addHours, addDays, differenceInMinutes, max, min, isAfter } from 'date-fns';
import { ListTodo, Loader2, Cpu, Zap, Clock, Trash2, Archive, Target, Database, CalendarDays, Lock, Unlock } from 'lucide-react';
import SchedulerInput from '@/components/SchedulerInput';
import SchedulerDisplay from '@/components/SchedulerDisplay';
import { DBScheduledTask, RetiredTask, SortBy, TaskEnvironment, TimeBlock } from '@/types/scheduler';
import {
  calculateSchedule,
  parseTaskInput,
  parseCommand,
  setTimeOnDate,
  compactScheduleLogic,
  mergeOverlappingTimeBlocks,
  findFirstAvailableSlot,
  getStaticConstraints, // NEW: Imported getStaticConstraints
} from '@/lib/scheduler-utils';
import { showSuccess, showError } from '@/utils/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';

const SchedulerPage: React.FC<{ view: 'schedule' | 'sink' | 'recap' }> = ({ view }) => {
  const { user, profile, isLoading: isSessionLoading, rechargeEnergy, activeItemToday, nextItemToday, startRegenPodState, exitRegenPodState, regenPodDurationMinutes } = useSession();
  const { selectedEnvironments } = useEnvironmentContext();
  const environmentForPlacement = selectedEnvironments[0] || 'laptop';
  
  // Initialize date once on mount to prevent re-initialization on re-renders
  const [selectedDay, setSelectedDay] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const scheduleContainerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Local ticker for components that need the "current moment" line/status
  const [T_current, setT_current] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setT_current(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

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
    aetherDump,
    aetherDumpMega,
    sortBy,
    setSortBy,
    retiredSortBy,
    setRetiredSortBy,
    completeScheduledTask: completeScheduledTaskMutation,
    removeRetiredTask,
    handleAutoScheduleAndSort,
    toggleAllScheduledTasksLock,
  } = useSchedulerTasks(selectedDay, scheduleContainerRef);

  const { data: mealAssignments = [] } = useQuery<MealAssignment[]>({
    queryKey: ['mealAssignments', user?.id, selectedDay],
    queryFn: async () => {
      if (!user?.id || !selectedDay) return [];
      const { data, error } = await supabase
        .from('meal_assignments')
        .select('*, meal_idea:meal_ideas(*)')
        .eq('assigned_date', selectedDay)
        .eq('user_id', user.id);
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
  const [createTaskDefaultValues, setCreateTaskDefaultValues] = useState<{
    defaultPriority: 'HIGH' | 'MEDIUM' | 'LOW';
    defaultDueDate: Date;
    defaultStartTime?: Date;
    defaultEndTime?: Date;
  }>({
    defaultPriority: 'MEDIUM',
    defaultDueDate: new Date(),
  });

  const selectedDayAsDate = useMemo(() => {
    const [year, month, day] = selectedDay.split('-').map(Number);
    return new Date(year, month - 1, day);
  }, [selectedDay]);

  const workdayStartTimeForSelectedDay = useMemo(() => profile?.default_auto_schedule_start_time ? setTimeOnDate(selectedDayAsDate, profile.default_auto_schedule_start_time) : startOfDay(selectedDayAsDate), [profile?.default_auto_schedule_start_time, selectedDayAsDate]);
  let workdayEndTimeForSelectedDay = useMemo(() => profile?.default_auto_schedule_end_time ? setTimeOnDate(startOfDay(selectedDayAsDate), profile.default_auto_schedule_end_time) : addHours(startOfDay(selectedDayAsDate), 17), [profile?.default_auto_schedule_end_time, selectedDayAsDate]);
  if (isBefore(workdayEndTimeForSelectedDay, workdayStartTimeForSelectedDay)) workdayEndTimeForSelectedDay = addDays(workdayEndTimeForSelectedDay, 1);

  const isRegenPodRunning = profile?.is_in_regen_pod ?? false;
  const isSelectedDayBlocked = profile?.blocked_days?.includes(selectedDay) ?? false;

  const isDayLockedDown = useMemo(() => {
    if (dbScheduledTasks.length === 0) return false;
    return dbScheduledTasks.every(task => task.is_locked);
  }, [dbScheduledTasks]);

  // Stabilize the RegenPod setup trigger
  useEffect(() => {
    if (isRegenPodRunning && !showRegenPodSetup) {
      setShowRegenPodSetup(true);
    }
  }, [isRegenPodRunning]); // Only depend on the running state

  // Memoize getStaticConstraints to prevent recreation on every render
  const staticConstraints = useMemo((): TimeBlock[] => {
    if (!profile) return [];
    return getStaticConstraints(profile, selectedDayAsDate, workdayStartTimeForSelectedDay, workdayEndTimeForSelectedDay);
  }, [profile, selectedDayAsDate, workdayStartTimeForSelectedDay, workdayEndTimeForSelectedDay]);

  const handleRebalanceToday = useCallback(async () => {
    if (isSelectedDayBlocked) {
      showError("Cannot auto-schedule on a blocked day.");
      return;
    }
    await handleAutoScheduleAndSort(sortBy, 'sink-to-gaps', [], selectedDay);
  }, [handleAutoScheduleAndSort, selectedDay, sortBy, isSelectedDayBlocked]);

  const handleReshuffleEverything = useCallback(async () => {
    if (isSelectedDayBlocked) {
      showError("Cannot reshuffle on a blocked day.");
      return;
    }
    await handleAutoScheduleAndSort(sortBy, 'all-flexible', [], selectedDay);
  }, [handleAutoScheduleAndSort, selectedDay, sortBy, isSelectedDayBlocked]);

  const handleZoneFocus = useCallback(async () => {
    if (isSelectedDayBlocked) {
      showError("Cannot zone focus on a blocked day.");
      return;
    }
    await handleAutoScheduleAndSort(sortBy, 'sink-only', selectedEnvironments, selectedDay);
  }, [handleAutoScheduleAndSort, selectedEnvironments, selectedDay, sortBy, isSelectedDayBlocked]);

  const handleGlobalAutoSchedule = useCallback(async () => {
    if (isSelectedDayBlocked) {
      showError("Cannot global auto-schedule starting on a blocked day.");
      return;
    }
    setIsProcessingCommand(true);
    try {
      await handleAutoScheduleAndSort(sortBy, 'global-all-future', [], selectedDay, 30);
      showSuccess("Global auto-schedule initiated for the next 30 days!");
    } catch (e: any) {
      showError(`Global auto-schedule failed: ${e.message}`);
    } finally {
      setIsProcessingCommand(false);
    }
  }, [handleAutoScheduleAndSort, sortBy, selectedDay, isSelectedDayBlocked]);

  const handleCompact = useCallback(async () => {
    if (isSelectedDayBlocked) {
      showError("Cannot compact schedule on a blocked day.");
      return;
    }
    const tasksToUpdate = compactScheduleLogic(dbScheduledTasks, selectedDayAsDate, workdayStartTimeForSelectedDay, workdayEndTimeForSelectedDay, T_current, profile);
    await compactScheduledTasks({ tasksToUpdate });
  }, [dbScheduledTasks, selectedDayAsDate, workdayStartTimeForSelectedDay, workdayEndTimeForSelectedDay, T_current, compactScheduledTasks, profile, isSelectedDayBlocked]);

  const handleRandomize = useCallback(async () => {
    if (isSelectedDayBlocked) {
      showError("Cannot randomize breaks on a blocked day.");
      return;
    }
    await randomizeBreaks({ selectedDate: selectedDay, workdayStartTime: workdayStartTimeForSelectedDay, workdayEndTime: workdayEndTimeForSelectedDay, currentDbTasks: dbScheduledTasks });
  }, [selectedDay, workdayStartTimeForSelectedDay, workdayEndTimeForSelectedDay, dbScheduledTasks, randomizeBreaks, isSelectedDayBlocked]);

  const handleRezone = useCallback(async (task: RetiredTask) => {
    if (isSelectedDayBlocked) {
      showError("Cannot re-zone tasks to a blocked day.");
      return;
    }
    await rezoneTask(task);
  }, [rezoneTask, isSelectedDayBlocked]);

  const handleRemoveRetired = useCallback(async (taskId: string) => {
    await removeRetiredTask(taskId);
  }, [removeRetiredTask]);

  const handleSortFlexibleTasks = useCallback(async (newSortBy: SortBy) => {
    setSortBy(newSortBy);
    showSuccess(`Balance logic set to ${newSortBy.replace(/_/g, ' ').toLowerCase()}.`);
  }, [setSortBy]);

  const handleStartPodSession = useCallback(async (activityName: string, durationMinutes: number) => {
    if (!user || !profile) return;
    if (isSelectedDayBlocked) {
      showError("Cannot start Regen Pod on a blocked day.");
      return;
    }
    setIsProcessingCommand(true);
    try {
        await startRegenPodState(activityName, durationMinutes); 
        
        const start = T_current;
        const end = addMinutes(start, durationMinutes); 
        
        await addScheduledTask({
            name: `Regen Pod: ${activityName}`,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            break_duration: durationMinutes, 
            scheduled_date: selectedDay,
            is_critical: false,
            is_flexible: false, 
            is_locked: true, 
            energy_cost: 0, 
            task_environment: 'away', 
        });
        
        showSuccess("Quick Break added! Time to recharge. ☕️");
    } catch (e: any) {
        showError(`Failed to start Regen Pod: ${e.message}`);
    } finally {
        setIsProcessingCommand(false);
    }
  }, [user, profile, T_current, selectedDay, startRegenPodState, addScheduledTask, isSelectedDayBlocked]);

  const handleExitPodSession = useCallback(async () => {
    await exitRegenPodState();
    setShowRegenPodSetup(false);
  }, [exitRegenPodState]);

  const handleQuickBreak = useCallback(async () => {
    if (!user || !profile) return showError("Please log in.");
    if (isSelectedDayBlocked) {
      showError("Cannot add tasks to a blocked day.");
      return;
    }
    setIsProcessingCommand(true);
    try {
      const breakDur = 15;
      const bStart = T_current;
      const bEnd = addMinutes(bStart, breakDur);
      await addScheduledTask({ 
        name: 'Quick Break', 
        start_time: bStart.toISOString(), 
        end_time: bEnd.toISOString(), 
        break_duration: breakDur, 
        scheduled_date: selectedDay, 
        is_critical: false, 
        is_flexible: false, 
        is_locked: true, 
        energy_cost: 0, 
        task_environment: 'away',
        is_break: true, 
      });
      showSuccess("Quick Break added! Time to recharge. ☕️");
    } catch (e: any) {
      showError(`Failed to add quick break: ${e.message}`);
    } finally {
      setIsProcessingCommand(false);
    }
  }, [user, profile, T_current, selectedDay, addScheduledTask, isSelectedDayBlocked]);


  const handleCommand = useCallback(async (input: string) => {
    if (!user || !profile) return showError("Please log in.");
    if (isSelectedDayBlocked) {
      showError("Cannot perform scheduling actions on a blocked day.");
      return;
    }
    setIsProcessingCommand(true);
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
            await addScheduledTask({ name: 'Quick Break', start_time: bStart.toISOString(), end_time: bEnd.toISOString(), break_duration: breakDur, scheduled_date: selectedDay, is_critical: false, is_flexible: false, is_locked: true, energy_cost: 0, task_environment: 'away' });
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
            user_id: user.id, 
            name: task.name, 
            duration: task.duration || 30, 
            break_duration: task.breakDuration || null, 
            original_scheduled_date: selectedDay, 
            is_critical: task.isCritical, 
            energy_cost: task.energyCost, 
            task_environment: environmentForPlacement, 
            is_backburner: task.isBackburner 
          });
        } else if (task.duration) {
          const occupiedBlocks: TimeBlock[] = dbScheduledTasks.filter(t => t.start_time && t.end_time).map(t => ({
            start: parseISO(t.start_time!),
            end: parseISO(t.end_time!),
            duration: differenceInMinutes(parseISO(t.end_time!), parseISO(t.start_time!))
          }));
          
          // Use the memoized static constraints
          const allConstraints = mergeOverlappingTimeBlocks([...occupiedBlocks, ...staticConstraints]);
          const taskTotalDuration = task.duration + (task.breakDuration || 0);
          const searchStart = isBefore(workdayStartTimeForSelectedDay, T_current) && isSameDay(selectedDayAsDate, new Date()) ? T_current : workdayStartTimeForSelectedDay;
          
          const slot = findFirstAvailableSlot(taskTotalDuration, allConstraints, searchStart, workdayEndTimeForSelectedDay);

          if (slot) {
            await addScheduledTask({
              name: task.name,
              start_time: slot.start.toISOString(),
              end_time: slot.end.toISOString(),
              break_duration: task.breakDuration || null,
              scheduled_date: selectedDay,
              is_critical: task.isCritical,
              is_flexible: true,
              is_locked: false,
              energy_cost: task.energyCost,
              task_environment: environmentForPlacement,
              is_backburner: task.isBackburner,
            });
            showSuccess(`Scheduled "${task.name}" at ${format(slot.start, 'h:mm a')}`);
          } else {
            showError(`No slot found for "${task.name}" within constraints. Sending to Sink.`);
            await addRetiredTask({
              user_id: user.id,
              name: task.name,
              duration: task.duration,
              break_duration: task.breakDuration || null,
              original_scheduled_date: selectedDay,
              is_critical: task.isCritical,
              energy_cost: task.energyCost,
              task_environment: environmentForPlacement,
              is_backburner: task.isBackburner,
            });
          }
        } else {
          await addScheduledTask({
            name: task.name,
            start_time: task.startTime!.toISOString(),
            end_time: task.endTime!.toISOString(),
            break_duration: task.breakDuration || null,
            scheduled_date: selectedDay,
            is_critical: task.isCritical,
            is_flexible: false,
            is_locked: true,
            energy_cost: task.energyCost,
            task_environment: environmentForPlacement,
            is_backburner: task.isBackburner,
          });
        }
        setInputValue('');
      } else {
        showError("Invalid task format.");
      }
    } catch (e: any) {
      showError(`Command failed: ${e.message}`);
    } finally {
      setIsProcessingCommand(false);
    }
  }, [user, profile, selectedDay, selectedDayAsDate, clearScheduledTasks, handleCompact, aetherDump, aetherDumpMega, T_current, addScheduledTask, addRetiredTask, environmentForPlacement, dbScheduledTasks, workdayStartTimeForSelectedDay, workdayEndTimeForSelectedDay, staticConstraints, isSelectedDayBlocked, handleQuickBreak]);

  const handleSchedulerAction = useCallback(async (action: 'complete' | 'skip' | 'exitFocus', task: DBScheduledTask) => {
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

  const handleDetailedInject = useCallback(() => {
    if (isSelectedDayBlocked) {
      showError("Cannot add tasks to a blocked day.");
      return;
    }
    setCreateTaskDefaultValues({
      defaultPriority: 'MEDIUM',
      defaultDueDate: selectedDayAsDate,
    });
    setIsCreateTaskDialogOpen(true);
  }, [selectedDayAsDate, isSelectedDayBlocked]);

  const handleFreeTimeClick = useCallback((startTime: Date, endTime: Date) => {
    if (isSelectedDayBlocked) {
      showError("Cannot add tasks to a blocked day.");
      return;
    }
    setCreateTaskDefaultValues({
      defaultPriority: 'MEDIUM',
      defaultDueDate: selectedDayAsDate,
      defaultStartTime: startTime,
      defaultEndTime: endTime,
    });
    setIsCreateTaskDialogOpen(true);
  }, [selectedDayAsDate, isSelectedDayBlocked]);

  const handleToggleDayLock = useCallback(async () => {
    if (isSelectedDayBlocked) {
      showError("Cannot lock/unlock tasks on a blocked day.");
      return;
    }
    setIsProcessingCommand(true);
    try {
      await toggleAllScheduledTasksLock({ selectedDate: selectedDay, lockState: !isDayLockedDown });
    } catch (e) {
    } finally {
      setIsProcessingCommand(false);
    }
  }, [selectedDay, isDayLockedDown, toggleAllScheduledTasksLock, isSelectedDayBlocked]);

  const overallLoading = isSessionLoading || isSchedulerTasksLoading || isProcessingCommand || isLoadingRetiredTasks || isLoadingCompletedTasksForSelectedDay;

  // CRITICAL FIX: Memoize the calculated schedule object to prevent reference churn
  const calculatedSchedule = useMemo(() => {
    if (!profile) return null;
    const start = profile.default_auto_schedule_start_time ? setTimeOnDate(startOfDay(selectedDayAsDate), profile.default_auto_schedule_start_time) : startOfDay(selectedDayAsDate);
    let end = profile.default_auto_schedule_end_time ? setTimeOnDate(startOfDay(selectedDayAsDate), profile.default_auto_schedule_end_time) : addHours(startOfDay(selectedDayAsDate), 17);
    if (isBefore(end, start)) end = addDays(end, 1);

    return calculateSchedule(dbScheduledTasks, selectedDay, start, end, profile.is_in_regen_pod, profile.regen_pod_start_time ? parseISO(profile.regen_pod_start_time) : null, regenPodDurationMinutes, start, profile.breakfast_time, profile.lunch_time, profile.dinner_time, profile.breakfast_duration_minutes, profile.lunch_duration_minutes, profile.dinner_duration_minutes, profile.reflection_count, profile.reflection_times, profile.reflection_durations, mealAssignments, isSelectedDayBlocked);
  }, [dbScheduledTasks, selectedDay, selectedDayAsDate, profile, regenPodDurationMinutes, mealAssignments, isSelectedDayBlocked]);

  const wrapperClass = "max-w-4xl mx-auto w-full space-y-6";

  // If profile is loading, show a minimal loader to prevent double render flash
  if (isSessionLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Only show Scheduler components if view is 'schedule'
  if (view !== 'schedule') return null;

  return (
    <div className="w-full pb-4 space-y-6">
      {isFocusModeActive && activeItemToday && calculatedSchedule && (
        <ImmersiveFocusMode activeItem={activeItemToday} T_current={T_current} onExit={() => setIsFocusModeActive(false)} onAction={(action, task) => handleSchedulerAction(action as any, task)} dbTask={calculatedSchedule.dbTasks.find(t => t.id === activeItemToday.id) || null} nextItem={nextItemToday} isProcessingCommand={isProcessingCommand} />
      )}
      
      {(showRegenPodSetup || isRegenPodRunning) && (
        <EnergyRegenPodModal 
          isOpen={showRegenPodSetup || isRegenPodRunning}
          onExit={handleExitPodSession}
          onStart={handleStartPodSession}
          isProcessingCommand={overallLoading}
          totalDurationMinutes={isRegenPodRunning ? regenPodDurationMinutes : REGEN_POD_MAX_DURATION_MINUTES}
        />
      )}

      <CreateTaskDialog
        defaultPriority={createTaskDefaultValues.defaultPriority}
        defaultDueDate={createTaskDefaultValues.defaultDueDate}
        defaultStartTime={createTaskDefaultValues.defaultStartTime}
        defaultEndTime={createTaskDefaultValues.defaultEndTime}
        onTaskCreated={() => {
          setIsCreateTaskDialogOpen(false);
          queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
          queryClient.invalidateQueries({ queryKey: ['datesWithTasks'] });
          queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday'] });
        }}
        isOpen={isCreateTaskDialogOpen}
        onOpenChange={setIsCreateTaskDialogOpen}
      />

      <div className={wrapperClass}>
        {/* 
          KEY FIX: Pass stable props to SchedulerDashboardPanel.
          We are passing the memoized calculatedSchedule.summary.
        */}
        <SchedulerDashboardPanel 
          scheduleSummary={calculatedSchedule?.summary || null} 
          onAetherDump={aetherDump} 
          isProcessingCommand={isProcessingCommand} 
          hasFlexibleTasks={dbScheduledTasks.some(t => t.is_flexible && !t.is_locked)} 
          onRefreshSchedule={() => queryClient.invalidateQueries()} 
          isLoading={overallLoading} 
        />
      </div>
      
      <div className={wrapperClass}>
        <div className="space-y-6">
          <CalendarStrip selectedDay={selectedDay} setSelectedDay={setSelectedDay} datesWithTasks={datesWithTasks} isLoadingDatesWithTasks={isLoadingDatesWithTasks} weekStartsOn={profile?.week_starts_on ?? 0} blockedDays={profile?.blocked_days || []} />
          {/* REMOVED: SchedulerSegmentedControl */}
        </div>
      </div>

      <div className="space-y-6">
        <div className={wrapperClass}>
          <SchedulerContextBar />
          
          <Card className="p-4 rounded-xl shadow-sm">
            <CardHeader className="p-0 pb-4">
              <CardTitle className="text-xl font-bold flex items-center gap-2"><ListTodo className="h-6 w-6 text-primary" /> Quick Add</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <SchedulerInput onCommand={handleCommand} isLoading={overallLoading} inputValue={inputValue} setInputValue={setInputValue} onDetailedInject={handleDetailedInject} onQuickBreak={handleQuickBreak} />
            </CardContent>
          </Card>
          
          <SchedulerActionCenter 
            isProcessingCommand={overallLoading} 
            dbScheduledTasks={dbScheduledTasks} 
            retiredTasksCount={retiredTasks.length} 
            sortBy={sortBy} 
            onRebalanceToday={handleRebalanceToday} 
            onReshuffleEverything={handleReshuffleEverything}
            onCompactSchedule={handleCompact} 
            onRandomizeBreaks={handleRandomize} 
            onZoneFocus={handleZoneFocus} 
            onRechargeEnergy={() => rechargeEnergy()} 
            onQuickBreak={handleQuickBreak} 
            onQuickScheduleBlock={() => Promise.resolve()} 
            onSortFlexibleTasks={handleSortFlexibleTasks} 
            onAetherDump={aetherDump} 
            onAetherDumpMega={aetherDumpMega} 
            onRefreshSchedule={() => queryClient.invalidateQueries()} 
            onOpenWorkdayWindowDialog={() => setShowWorkdayWindowDialog(true)} 
            onStartRegenPod={() => setShowRegenPodSetup(true)} 
            hasFlexibleTasksOnCurrentDay={dbScheduledTasks.some(t => t.is_flexible && !t.is_locked)}
            navigate={navigate}
            onGlobalAutoSchedule={handleGlobalAutoSchedule}
          />
          <NowFocusCard activeItem={activeItemToday} nextItem={nextItemToday} onEnterFocusMode={() => setIsFocusModeActive(true)} isLoading={overallLoading} />
          {calculatedSchedule?.summary.isBlocked ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed rounded-2xl border-destructive/50 bg-destructive/5">
              <CalendarDays className="h-10 w-10 mb-3 opacity-20 text-destructive" />
              <p className="font-bold uppercase tracking-widest text-xs text-destructive/60">Day Blocked</p>
              <p className="text-[10px] font-bold text-muted-foreground/30 uppercase tracking-widest max-w-[200px] text-center">No tasks can be scheduled on this day.</p>
            </div>
          ) : (
            <SchedulerDisplay 
              schedule={calculatedSchedule} 
              T_current={T_current} 
              onRemoveTask={(id) => removeScheduledTask(id)} 
              onRetireTask={(t) => retireTask(t)} 
              onCompleteTask={(t) => handleSchedulerAction('complete', t)} 
              activeItemId={activeItemToday?.id || null} 
              selectedDayString={selectedDay} 
              onScrollToItem={() => {}} 
              isProcessingCommand={isProcessingCommand} 
              onFreeTimeClick={handleFreeTimeClick} 
              isDayLockedDown={isDayLockedDown}
              onToggleDayLock={handleToggleDayLock}
            />
          )}
        </div>
      </div>
      <WorkdayWindowDialog open={showWorkdayWindowDialog} onOpenChange={setShowWorkdayWindowDialog} />
    </div>
  );
};

export default SchedulerPage;