"use client";

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { format, isBefore, addMinutes, parseISO, isSameDay, startOfDay, addHours, addDays, differenceInMinutes } from 'date-fns';
import { ListTodo, Loader2, Cpu, Zap, Clock, Trash2, Archive, Target, Database } from 'lucide-react';
import SchedulerInput from '@/components/SchedulerInput';
import SchedulerDisplay from '@/components/SchedulerDisplay';
import { DBScheduledTask, RetiredTask, SortBy, TaskEnvironment } from '@/types/scheduler';
import {
  calculateSchedule,
  parseTaskInput,
  parseCommand,
  setTimeOnDate,
  compactScheduleLogic,
  mergeOverlappingTimeBlocks,
  getFreeTimeBlocks,
} from '@/lib/scheduler-utils';
import { showSuccess, showError } from '@/utils/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import { useSession } from '@/hooks/use-session';
import SchedulerDashboardPanel from '@/components/SchedulerDashboardPanel';
import NowFocusCard from '@/components/NowFocusCard';
import CalendarStrip from '@/components/CalendarStrip';
import AetherSink from '@/components/AetherSink';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import WorkdayWindowDialog from '@/components/WorkdayWindowDialog';
import ImmersiveFocusMode from '@/components/ImmersiveFocusMode';
import SchedulerSegmentedControl from '@/components/SchedulerSegmentedControl';
import SchedulerContextBar from '@/components/SchedulerContextBar';
import SchedulerActionCenter from '@/components/SchedulerActionCenter';
import DailyVibeRecapCard from '@/components/DailyVibeRecapCard';
import { useEnvironmentContext } from '@/hooks/use-environment-context';
import { MealAssignment } from '@/hooks/use-meals';

const SchedulerPage: React.FC<{ view: 'schedule' | 'sink' | 'recap' }> = ({ view }) => {
  const { user, profile, isLoading: isSessionLoading, rechargeEnergy, T_current, activeItemToday, nextItemToday, startRegenPodState, regenPodDurationMinutes } = useSession();
  const { selectedEnvironments } = useEnvironmentContext();
  const environmentForPlacement = selectedEnvironments[0] || 'laptop';
  
  const [selectedDay, setSelectedDay] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const scheduleContainerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

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
      return data as MealAssignment[];
    },
    enabled: !!user?.id && !!selectedDay,
  });

  const [isProcessingCommand, setIsProcessingCommand] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [showWorkdayWindowDialog, setShowWorkdayWindowDialog] = useState(false);
  const [isFocusModeActive, setIsFocusModeActive] = useState(false);

  const selectedDayAsDate = useMemo(() => {
    const [year, month, day] = selectedDay.split('-').map(Number);
    return new Date(year, month - 1, day);
  }, [selectedDay]);

  const workdayStartTimeForSelectedDay = useMemo(() => profile?.default_auto_schedule_start_time ? setTimeOnDate(selectedDayAsDate, profile.default_auto_schedule_start_time) : startOfDay(selectedDayAsDate), [profile?.default_auto_schedule_start_time, selectedDayAsDate]);
  let workdayEndTimeForSelectedDay = useMemo(() => profile?.default_auto_schedule_end_time ? setTimeOnDate(startOfDay(selectedDayAsDate), profile.default_auto_schedule_end_time) : addHours(startOfDay(selectedDayAsDate), 17), [profile?.default_auto_schedule_end_time, selectedDayAsDate]);
  if (isBefore(workdayEndTimeForSelectedDay, workdayStartTimeForSelectedDay)) workdayEndTimeForSelectedDay = addDays(workdayEndTimeForSelectedDay, 1);

  const handleRebalanceToday = useCallback(async () => {
    await handleAutoScheduleAndSort(sortBy, 'sink-to-gaps', [], selectedDay);
  }, [handleAutoScheduleAndSort, selectedDay, sortBy]);

  const handleReshuffleEverything = useCallback(async () => {
    await handleAutoScheduleAndSort(sortBy, 'all-flexible', [], selectedDay);
  }, [handleAutoScheduleAndSort, selectedDay, sortBy]);

  const handleZoneFocus = useCallback(async () => {
    await handleAutoScheduleAndSort(sortBy, 'sink-only', selectedEnvironments, selectedDay);
  }, [handleAutoScheduleAndSort, selectedEnvironments, selectedDay, sortBy]);

  const handleCompact = useCallback(async () => {
    const tasksToUpdate = compactScheduleLogic(dbScheduledTasks, selectedDayAsDate, workdayStartTimeForSelectedDay, workdayEndTimeForSelectedDay, T_current);
    await compactScheduledTasks({ tasksToUpdate });
  }, [dbScheduledTasks, selectedDayAsDate, workdayStartTimeForSelectedDay, workdayEndTimeForSelectedDay, T_current, compactScheduledTasks]);

  const handleRandomize = useCallback(async () => {
    await randomizeBreaks({ selectedDate: selectedDay, workdayStartTime: workdayStartTimeForSelectedDay, workdayEndTime: workdayEndTimeForSelectedDay, currentDbTasks: dbScheduledTasks });
  }, [selectedDay, workdayStartTimeForSelectedDay, workdayEndTimeForSelectedDay, dbScheduledTasks, randomizeBreaks]);

  const handleRezone = useCallback(async (task: RetiredTask) => {
    await rezoneTask(task);
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
        } else {
          if (task.duration && !task.startTime) {
            const effectiveStart = isBefore(workdayStartTimeForSelectedDay, T_current) ? T_current : workdayStartTimeForSelectedDay;
            const occupiedBlocks = dbScheduledTasks.filter(t => t.start_time && t.end_time).map(t => {
                const start = setTimeOnDate(selectedDayAsDate, format(parseISO(t.start_time!), 'HH:mm'));
                let end = setTimeOnDate(selectedDayAsDate, format(parseISO(t.end_time!), 'HH:mm'));
                if (isBefore(end, start)) end = addDays(end, 1);
                return { start, end, duration: differenceInMinutes(end, start) };
            });
            const totalDuration = (task.duration || 30) + (task.breakDuration || 0);
            const freeBlocks = getFreeTimeBlocks(occupiedBlocks, effectiveStart, workdayEndTimeForSelectedDay);
            const suitableBlock = freeBlocks.find(block => block.duration >= totalDuration);
            if (suitableBlock) {
                const proposedStartTime = suitableBlock.start;
                const proposedEndTime = addMinutes(proposedStartTime, totalDuration);
                await addScheduledTask({ 
                  name: task.name, 
                  start_time: proposedStartTime.toISOString(), 
                  end_time: proposedEndTime.toISOString(), 
                  break_duration: task.breakDuration, 
                  scheduled_date: selectedDay, 
                  is_critical: task.isCritical, 
                  is_flexible: task.isFlexible, 
                  is_locked: !task.isFlexible, 
                  energy_cost: task.energyCost, 
                  task_environment: environmentForPlacement, 
                  is_backburner: task.isBackburner 
                });
            } else {
                showError("No free slot found. Sent to Sink.");
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
            }
          } else {
            const sStart = task.startTime ? task.startTime.toISOString() : undefined;
            const sEnd = task.endTime ? task.endTime.toISOString() : undefined;
            await addScheduledTask({ 
              name: task.name, 
              start_time: sStart, 
              end_time: sEnd, 
              break_duration: task.breakDuration, 
              scheduled_date: selectedDay, 
              is_critical: task.isCritical, 
              is_flexible: task.isFlexible, 
              is_locked: !task.isFlexible, 
              energy_cost: task.energyCost, 
              task_environment: environmentForPlacement, 
              is_backburner: task.isBackburner 
            });
          }
        }
        setInputValue('');
      } else {
        showError("Invalid task format.");
      }
    } finally {
      setIsProcessingCommand(false);
    }
  }, [user, profile, selectedDay, selectedDayAsDate, clearScheduledTasks, handleCompact, aetherDump, aetherDumpMega, T_current, addScheduledTask, addRetiredTask, environmentForPlacement, dbScheduledTasks, workdayStartTimeForSelectedDay, workdayEndTimeForSelectedDay]);

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

  const overallLoading = isSessionLoading || isSchedulerTasksLoading || isProcessingCommand || isLoadingRetiredTasks || isLoadingCompletedTasksForSelectedDay;

  const calculatedSchedule = useMemo(() => {
    if (!profile) return null;
    return calculateSchedule(dbScheduledTasks, selectedDay, workdayStartTimeForSelectedDay, workdayEndTimeForSelectedDay, profile.is_in_regen_pod, profile.regen_pod_start_time ? parseISO(profile.regen_pod_start_time) : null, regenPodDurationMinutes, T_current, profile.breakfast_time, profile.lunch_time, profile.dinner_time, profile.breakfast_duration_minutes, profile.lunch_duration_minutes, profile.dinner_duration_minutes, profile.reflection_count, profile.reflection_times, profile.reflection_durations, mealAssignments);
  }, [dbScheduledTasks, selectedDay, workdayStartTimeForSelectedDay, workdayEndTimeForSelectedDay, profile, regenPodDurationMinutes, T_current, mealAssignments]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {isFocusModeActive && activeItemToday && calculatedSchedule && (
        <ImmersiveFocusMode activeItem={activeItemToday} T_current={T_current} onExit={() => setIsFocusModeActive(false)} onAction={(action, task) => handleSchedulerAction(action as any, task)} dbTask={calculatedSchedule.dbTasks.find(t => t.id === activeItemToday.id) || null} nextItem={nextItemToday} isProcessingCommand={isProcessingCommand} />
      )}
      <SchedulerDashboardPanel scheduleSummary={calculatedSchedule?.summary || null} onAetherDump={aetherDump} isProcessingCommand={isProcessingCommand} hasFlexibleTasks={dbScheduledTasks.some(i => i.is_flexible && !i.is_locked)} onRefreshSchedule={() => queryClient.invalidateQueries()} />
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
              onReshuffleEverything={handleReshuffleEverything}
              onCompactSchedule={handleCompact} 
              onRandomizeBreaks={handleRandomize} 
              onZoneFocus={handleZoneFocus} 
              onRechargeEnergy={() => rechargeEnergy()} 
              onQuickBreak={() => handleCommand('break 15')} 
              onQuickScheduleBlock={() => Promise.resolve()} 
              onSortFlexibleTasks={handleSortFlexibleTasks} 
              onAetherDump={aetherDump} 
              onAetherDumpMega={aetherDumpMega} 
              onRefreshSchedule={() => queryClient.invalidateQueries()} 
              onOpenWorkdayWindowDialog={() => setShowWorkdayWindowDialog(true)} 
              onStartRegenPod={() => startRegenPodState(15)} 
              hasFlexibleTasksOnCurrentDay={dbScheduledTasks.some(t => t.is_flexible && !t.is_locked)}
            />
            <NowFocusCard activeItem={activeItemToday} nextItem={nextItemToday} T_current={T_current} onEnterFocusMode={() => setIsFocusModeActive(true)} />
            <Card className="animate-pop-in">
              <CardHeader><CardTitle>Your Vibe Schedule</CardTitle></CardHeader>
              <CardContent className="p-4">
                <SchedulerDisplay schedule={calculatedSchedule} T_current={T_current} onRemoveTask={(id) => removeScheduledTask(id)} onRetireTask={(t) => retireTask(t)} onCompleteTask={(t) => handleSchedulerAction('complete', t)} activeItemId={activeItemToday?.id || null} selectedDayString={selectedDay} onAddTaskClick={() => {}} onScrollToItem={() => {}} isProcessingCommand={isProcessingCommand} onFreeTimeClick={() => {}} />
              </CardContent>
            </Card>
          </>
        )}
        {view === 'sink' && <AetherSink retiredTasks={retiredTasks} onRezoneTask={(t) => handleRezone(t)} onRemoveRetiredTask={(id) => handleRemoveRetired(id, '')} onAutoScheduleSink={() => handleAutoScheduleAndSort(sortBy, 'sink-only', [], selectedDay)} isLoading={isLoadingRetiredTasks} isProcessingCommand={isProcessingCommand} profileEnergy={profile?.energy || 0} retiredSortBy={retiredSortBy} setRetiredSortBy={setRetiredSortBy} />}
        {view === 'recap' && <DailyVibeRecapCard scheduleSummary={calculatedSchedule?.summary || null} tasksCompletedToday={completedTasksForSelectedDayList.length} xpEarnedToday={0} profileEnergy={profile?.energy || 0} criticalTasksCompletedToday={0} selectedDayString={selectedDay} completedScheduledTasks={completedTasksForSelectedDayList} totalActiveTimeMinutes={0} totalBreakTimeMinutes={0} />}
      </div>
      <WorkdayWindowDialog open={showWorkdayWindowDialog} onOpenChange={setShowWorkdayWindowDialog} />
    </div>
  );
};

export default SchedulerPage;