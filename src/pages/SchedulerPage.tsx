"use client";

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { format, isBefore, addMinutes, parseISO, isSameDay, startOfDay, addHours, addDays, differenceInMinutes, max, min, isAfter } from 'date-fns';
import { ListTodo, Loader2, Cpu, Zap, Clock, Trash2, Archive, Target, Database } from 'lucide-react';
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
  getFreeTimeBlocks,
  findFirstAvailableSlot,
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
    handleAutoScheduleAndSort, // This is the engine we need to use
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

  // --- NEW: Helper to get static constraints (Meals/Reflections) ---
  const getStaticConstraints = useCallback((): TimeBlock[] => {
    if (!profile) return [];
    const constraints: TimeBlock[] = [];
    const addConstraint = (name: string, timeStr: string | null, duration: number | null) => {
      const effectiveDuration = (duration !== null && duration !== undefined && !isNaN(duration)) ? duration : 15;
      if (timeStr && effectiveDuration > 0) {
        let anchorStart = setTimeOnDate(selectedDayAsDate, timeStr);
        let anchorEnd = addMinutes(anchorStart, effectiveDuration);
        if (isBefore(anchorEnd, anchorStart)) anchorEnd = addDays(anchorEnd, 1);
        
        // Check overlap with workday
        const overlaps = (isBefore(anchorStart, workdayEndTimeForSelectedDay) || anchorStart.getTime() === workdayEndTimeForSelectedDay.getTime()) && 
                         (isAfter(anchorEnd, workdayStartTimeForSelectedDay) || anchorEnd.getTime() === workdayStartTimeForSelectedDay.getTime());
        
        if (overlaps) {
          const intersectionStart = max([anchorStart, workdayStartTimeForSelectedDay]);
          const intersectionEnd = min([anchorEnd, workdayEndTimeForSelectedDay]);
          const finalDuration = differenceInMinutes(intersectionEnd, intersectionStart);
          if (finalDuration > 0) {
            constraints.push({ start: intersectionStart, end: intersectionEnd, duration: finalDuration });
            console.log(`[QuickAdd] Constraint: ${name} (${finalDuration}m) ${format(intersectionStart, 'HH:mm')}-${format(intersectionEnd, 'HH:mm')}`);
          }
        }
      }
    };

    addConstraint('Breakfast', profile.breakfast_time, profile.breakfast_duration_minutes);
    addConstraint('Lunch', profile.lunch_time, profile.lunch_duration_minutes);
    addConstraint('Dinner', profile.dinner_time, profile.dinner_duration_minutes);

    for (let r = 0; r < (profile.reflection_count || 0); r++) {
      const rTime = profile.reflection_times?.[r];
      const rDur = profile.reflection_durations?.[r];
      if (rTime && rDur) addConstraint(`Reflection Point ${r + 1}`, rTime, rDur);
    }
    return constraints;
  }, [profile, selectedDayAsDate, workdayStartTimeForSelectedDay, workdayEndTimeForSelectedDay]);

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

  // --- CRITICAL UPDATE: handleCommand now does Client-Side Placement ---
  const handleCommand = useCallback(async (input: string) => {
    if (!user || !profile) return showError("Please log in.");
    setIsProcessingCommand(true);
    try {
      // 1. Check if it's a system command (clear, compact, etc.)
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

      // 2. Parse the task input
      const task = parseTaskInput(input, selectedDayAsDate);
      if (task) {
        if (task.shouldSink) {
          // If user explicitly says "sink", add to retired tasks
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
          // --- CLIENT SIDE PLACEMENT LOGIC ---
          console.log(`[QuickAdd] Processing: "${task.name}" (${task.duration}m)`);
          
          // 1. Get current schedule constraints (Fixed/Locked tasks)
          const occupiedBlocks: TimeBlock[] = dbScheduledTasks.filter(t => t.start_time && t.end_time).map(t => ({
            start: parseISO(t.start_time!),
            end: parseISO(t.end_time!),
            duration: differenceInMinutes(parseISO(t.end_time!), parseISO(t.start_time!))
          }));
          
          // 2. Get Static Constraints (Meals/Reflections)
          const staticConstraints = getStaticConstraints();
          
          // 3. Merge all constraints
          const allConstraints = mergeOverlappingTimeBlocks([...occupiedBlocks, ...staticConstraints]);
          console.log(`[QuickAdd] Total Constraints: ${allConstraints.length} blocks`);
          allConstraints.forEach(c => console.log(`[QuickAdd] Constraint: ${format(c.start, 'HH:mm')}-${format(c.end, 'HH:mm')}`));

          // 4. Find the next available slot
          const taskTotalDuration = task.duration + (task.breakDuration || 0);
          const searchStart = isBefore(workdayStartTimeForSelectedDay, T_current) && isSameDay(selectedDayAsDate, new Date()) ? T_current : workdayStartTimeForSelectedDay;
          
          const slot = findFirstAvailableSlot(taskTotalDuration, allConstraints, searchStart, workdayEndTimeForSelectedDay);

          if (slot) {
            console.log(`[QuickAdd] Found Slot: ${format(slot.start, 'HH:mm')} - ${format(slot.end, 'HH:mm')}`);
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
            showError(`No slot found for "${task.name}" within constraints.`);
            // Optional: Send to sink if no slot found
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
          // Handle time-based tasks (e.g., "Coffee 10am-11am") - Direct Insert
          await addScheduledTask({
            name: task.name,
            start_time: task.startTime!.toISOString(),
            end_time: task.endTime!.toISOString(),
            break_duration: task.breakDuration || null,
            scheduled_date: selectedDay,
            is_critical: task.isCritical,
            is_flexible: false,
            is_locked: true, // Time-based tasks are locked by default
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
  }, [user, profile, selectedDay, selectedDayAsDate, clearScheduledTasks, handleCompact, aetherDump, aetherDumpMega, T_current, addScheduledTask, addRetiredTask, environmentForPlacement, dbScheduledTasks, workdayStartTimeForSelectedDay, workdayEndTimeForSelectedDay, getStaticConstraints]);

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
        {view === 'sink' && <AetherSink retiredTasks={retiredTasks} onRezoneTask={(t) => handleRezone(t)} onRemoveRetiredTask={(id) => handleRemoveRetired(id, '')} onAutoScheduleSink={() => handleAutoScheduleAndSort(sortBy, 'sink-only', [], selectedDay)} isLoading={isLoadingRetiredTasks} isProcessingCommand={isProcessingCommand} profile={profile} retiredSortBy={retiredSortBy} setRetiredSortBy={setRetiredSortBy} />}
        {view === 'recap' && <DailyVibeRecapCard scheduleSummary={calculatedSchedule?.summary || null} tasksCompletedToday={completedTasksForSelectedDayList.length} xpEarnedToday={0} profileEnergy={profile?.energy || 0} criticalTasksCompletedToday={0} selectedDayString={selectedDay} completedScheduledTasks={completedTasksForSelectedDayList} totalActiveTimeMinutes={0} totalBreakTimeMinutes={0} />}
      </div>
      <WorkdayWindowDialog open={showWorkdayWindowDialog} onOpenChange={setShowWorkdayWindowDialog} />
    </div>
  );
};

export default SchedulerPage;