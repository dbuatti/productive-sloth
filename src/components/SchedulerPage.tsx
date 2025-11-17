"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, ListTodo, Sparkles, Loader2, AlertTriangle, Trash2, ChevronsUp, Star, ArrowDownWideNarrow, ArrowUpWideNarrow, Shuffle, CalendarOff, RefreshCcw, Globe, Zap, Settings2 } from 'lucide-react';
import SchedulerInput from '@/components/SchedulerInput';
import SchedulerDisplay from '@/components/SchedulerDisplay';
import SchedulerUtilityBar from '@/components/SchedulerUtilityBar';
import AetherSink from '@/components/AetherSink';
import CalendarStrip from '@/components/CalendarStrip';
import NowFocusCard from '@/components/NowFocusCard';
import DailyVibeRecapCard from '@/components/DailyVibeRecapCard';
import SchedulerDashboardPanel from '@/components/SchedulerDashboardPanel';
import WorkdayWindowDialog from '@/components/WorkdayWindowDialog';
import WeatherWidget from '@/components/WeatherWidget';
import XPGainAnimation from '@/components/XPGainAnimation';
import { useSession } from '@/hooks/use-session';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import { useWindowSize } from '@/hooks/use-window-size';
import { FormattedSchedule, DBScheduledTask, ScheduledItem } from '@/types/scheduler';
import { calculateSchedule, setTimeOnDate } from '@/lib/scheduler-utils';
import EarlyCompletionModal from '@/components/EarlyCompletionModal';
import ImmersiveFocusMode from '@/components/ImmersiveFocusMode';
import { showSuccess, showError } from '@/utils/toast';
import { isToday, parseISO, format, startOfDay, addHours, setHours, setMinutes } from 'date-fns';

const SchedulerPage: React.FC = () => {
  const { profile, T_current, activeItemToday, nextItemToday } = useSession();
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Default to today
  const [selectedDayString, setSelectedDayString] = useState(format(startOfDay(new Date()), 'yyyy-MM-dd'));
  
  const {
    dbScheduledTasks,
    datesWithTasks,
    retiredTasks,
    completedTasksForSelectedDayList,
    isLoading,
    sortBy,
    setSortBy,
    retiredSortBy,
    setRetiredSortBy,
    addScheduledTask,
    removeScheduledTask,
    clearScheduledTasks,
    retireTask,
    rezoneTask,
    compactScheduledTasks,
    randomizeBreaks,
    toggleScheduledTaskLock,
    toggleRetiredTaskLock,
    aetherDump,
    aetherDumpMega,
    autoBalanceSchedule,
    completeScheduledTask,
    completeRetiredTask,
    updateScheduledTaskStatus,
    updateRetiredTaskStatus,
    updateScheduledTaskDetails,
    updateRetiredTaskDetails,
    xpGainAnimation,
    clearXpGainAnimation
  } = useSchedulerTasks(selectedDayString, scrollRef);

  // Calculate workday window
  const workdayStartTimeToday = useMemo(() => {
    if (!profile?.default_auto_schedule_start_time) return startOfDay(T_current);
    return setTimeOnDate(startOfDay(T_current), profile.default_auto_schedule_start_time);
  }, [profile?.default_auto_schedule_start_time, T_current]);

  const workdayEndTimeToday = useMemo(() => {
    if (!profile?.default_auto_schedule_end_time) return addHours(startOfDay(T_current), 17);
    let endTime = setTimeOnDate(startOfDay(T_current), profile.default_auto_schedule_end_time);
    if (endTime < workdayStartTimeToday) {
      endTime = addDays(endTime, 1);
    }
    return endTime;
  }, [profile?.default_auto_schedule_end_time, T_current, workdayStartTimeToday]);

  const calculatedScheduleToday: FormattedSchedule | null = useMemo(() => {
    if (!profile || !dbScheduledTasks.length) return null;
    return calculateSchedule(dbScheduledTasks, selectedDayString, workdayStartTimeToday, workdayEndTimeToday);
  }, [dbScheduledTasks, profile, selectedDayString, workdayStartTimeToday, workdayEndTimeToday]);

  // Active item detection for the selected day
  const activeItem: ScheduledItem | null = useMemo(() => {
    if (!calculatedScheduleToday) return null;
    for (const item of calculatedScheduleToday.items) {
      if ((item.type === 'task' || item.type === 'break' || item.type === 'time-off') && 
          T_current >= item.startTime && T_current < item.endTime) {
        return item;
      }
    }
    return null;
  }, [calculatedScheduleToday, T_current]);

  const [isProcessingCommand, setIsProcessingCommand] = useState(false);
  const [showWorkdayDialog, setShowWorkdayDialog] = useState(false);
  const [showImmersiveFocus, setShowImmersiveFocus] = useState(false);
  const [showEarlyCompletionModal, setShowEarlyCompletionModal] = useState(false);
  const [earlyCompletionData, setEarlyCompletionData] = useState<{
    task: DBScheduledTask;
    remainingMinutes: number;
  } | null>(null);

  // Check for flexible tasks on current day
  const hasFlexibleTasksOnCurrentDay = useMemo(() => 
    dbScheduledTasks.some(task => task.is_flexible && !task.is_locked),
    [dbScheduledTasks]
  );

  const handleCommand = useCallback(async (command: string) => {
    setIsProcessingCommand(true);
    try {
      const parts = command.trim().toLowerCase().split(' ');
      const action = parts[0];

      switch (action) {
        case 'clear':
          await clearScheduledTasks();
          break;
        case 'compact':
          await compactScheduledTasks({ tasksToUpdate: dbScheduledTasks });
          break;
        case 'aether':
        case 'dump':
          if (parts[1] === 'mega') {
            await aetherDumpMega();
          } else {
            await aetherDump();
          }
          break;
        default:
          // Parse task input and add
          const selectedDayDate = parseISO(selectedDayString);
          const newTask = parseSinkTaskInput(command, user?.id || '');
          if (newTask) {
            await addScheduledTask({
              ...newTask,
              scheduled_date: selectedDayString,
              is_flexible: true,
              is_locked: false,
            });
          }
      }
    } catch (error) {
      showError(`Command failed: ${error}`);
    } finally {
      setIsProcessingCommand(false);
    }
  }, [dbScheduledTasks, selectedDayString, user?.id, clearScheduledTasks, compactScheduledTasks, aetherDump, aetherDumpMega, addScheduledTask]);

  const handleRechargeEnergy = useCallback(async () => {
    if (profile) {
      // This will be handled by SessionProvider's rechargeEnergy
    }
  }, [profile]);

  const handleRandomizeBreaks = useCallback(async () => {
    await randomizeBreaks({
      selectedDate: selectedDayString,
      workdayStartTime: workdayStartTimeToday,
      workdayEndTime: workdayEndTimeToday,
      currentDbTasks: dbScheduledTasks
    });
  }, [selectedDayString, workdayStartTimeToday, workdayEndTimeToday, dbScheduledTasks, randomizeBreaks]);

  const handleSortFlexibleTasks = useCallback(async (newSortBy: SortBy) => {
    setSortBy(newSortBy);
  }, [setSortBy]);

  const handleQuickScheduleBlock = useCallback(async (duration: number, sortPreference: 'longestFirst' | 'shortestFirst') => {
    // Implementation for quick scheduling blocks
    console.log(`Quick schedule ${duration}min, ${sortPreference}`);
  }, []);

  const handleAutoScheduleSink = useCallback(async () => {
    // Implementation for auto-balancing sink tasks into schedule
    const unifiedTasks: UnifiedTask[] = [
      ...dbScheduledTasks.filter(t => t.is_flexible && !t.is_locked).map(t => ({
        id: t.id,
        name: t.name,
        duration: t.start_time && t.end_time ? 
          Math.floor((parseISO(t.end_time).getTime() - parseISO(t.start_time).getTime()) / (1000 * 60)) : 30,
        break_duration: t.break_duration || null,
        is_critical: t.is_critical,
        is_flexible: t.is_flexible,
        energy_cost: t.energy_cost,
        source: 'scheduled',
        originalId: t.id,
        is_custom_energy_cost: t.is_custom_energy_cost,
        created_at: t.created_at,
      })),
      ...retiredTasks.filter(t => !t.is_locked).map(t => ({
        id: `retired-${t.id}`,
        name: t.name,
        duration: t.duration || 30,
        break_duration: t.break_duration || null,
        is_critical: t.is_critical,
        is_flexible: true,
        energy_cost: t.energy_cost,
        source: 'retired',
        originalId: t.id,
        is_custom_energy_cost: t.is_custom_energy_cost,
        created_at: t.retired_at,
      }))
    ];

    // Simple auto-balance logic (in real implementation, this would be more sophisticated)
    await autoBalanceSchedule({
      scheduledTaskIdsToDelete: dbScheduledTasks.filter(t => t.is_flexible && !t.is_locked).map(t => t.id),
      retiredTaskIdsToDelete: retiredTasks.filter(t => !t.is_locked).map(t => t.id),
      tasksToInsert: unifiedTasks.slice(0, 5).map((ut, index) => ({
        id: ut.originalId,
        name: ut.name,
        break_duration: ut.break_duration || null,
        start_time: null,
        end_time: null,
        scheduled_date: selectedDayString,
        is_critical: ut.is_critical,
        is_flexible: true,
        is_locked: false,
        energy_cost: ut.energy_cost,
        is_completed: false,
        is_custom_energy_cost: ut.is_custom_energy_cost,
      })),
      tasksToKeepInSink: unifiedTasks.slice(5).map(ut => ({
        user_id: user?.id || '',
        name: ut.name,
        duration: ut.duration,
        break_duration: ut.break_duration || null,
        original_scheduled_date: selectedDayString,
        is_critical: ut.is_critical,
        is_locked: false,
        energy_cost: ut.energy_cost,
        is_completed: false,
        is_custom_energy_cost: ut.is_custom_energy_cost,
      })),
      selectedDate: selectedDayString,
    });
  }, [dbScheduledTasks, retiredTasks, selectedDayString, autoBalanceSchedule, user?.id]);

  // Early completion handlers
  const handleEarlyCompletionTakeBreak = useCallback(() => {
    if (earlyCompletionData) {
      // Implementation for taking a break
    }
    setShowEarlyCompletionModal(false);
  }, [earlyCompletionData]);

  const handleEarlyCompletionStartNext = useCallback(() => {
    if (earlyCompletionData) {
      // Implementation for starting next task
    }
    setShowEarlyCompletionModal(false);
  }, [earlyCompletionData]);

  const handleEarlyCompletionJustFinish = useCallback(async () => {
    if (earlyCompletionData) {
      await completeScheduledTask(earlyCompletionData.task);
    }
    setShowEarlyCompletionModal(false);
  }, [earlyCompletionData, completeScheduledTask]);

  // Focus mode handlers
  const handleEnterFocusMode = useCallback(() => {
    setShowImmersiveFocus(true);
  }, []);

  const handleFocusModeAction = useCallback(async (action: string, task: DBScheduledTask, isEarlyCompletion: boolean, remainingDurationMinutes?: number) => {
    if (action === 'complete') {
      if (isEarlyCompletion && remainingDurationMinutes && remainingDurationMinutes > 0) {
        setEarlyCompletionData({ task, remainingMinutes: remainingDurationMinutes });
        setShowEarlyCompletionModal(true);
      } else {
        await completeScheduledTask(task);
      }
    } else if (action === 'skip') {
      await retireTask(task);
    } else if (action === 'exitFocus') {
      setShowImmersiveFocus(false);
    }
    // Handle other actions...
  }, [completeScheduledTask, retireTask]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
        <span>Loading schedule...</span>
      </div>
    );
  }

  const hasFlexibleTasks = hasFlexibleTasksOnCurrentDay || retiredTasks.length > 0;

  return (
    <div className="space-y-6 p-4 max-w-7xl mx-auto">
      {/* Header Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <WeatherWidget />
          <SchedulerDashboardPanel
            schedule={calculatedScheduleToday}
            onAetherDump={aetherDump}
            isProcessingCommand={isProcessingCommand}
            hasFlexibleTasks={hasFlexibleTasks}
            onRefreshSchedule={() => {}} // Add refresh logic
          />
        </div>
        <DailyChallengeCard />
      </div>

      {/* Calendar Strip */}
      <CalendarStrip
        selectedDay={selectedDayString}
        setSelectedDay={setSelectedDayString}
        datesWithTasks={datesWithTasks}
        isLoadingDatesWithTasks={false}
      />

      {/* Now Focus Card */}
      {activeItem && (
        <NowFocusCard
          activeItem={activeItem}
          nextItem={nextItemToday}
          T_current={T_current}
          onEnterFocusMode={handleEnterFocusMode}
        />
      )}

      {/* Main Content Area */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-[600px]">
        {/* Schedule Display */}
        <div className="xl:col-span-2 space-y-4">
          <div ref={scrollRef} className="h-[500px] overflow-y-auto">
            <SchedulerDisplay
              schedule={calculatedScheduleToday}
              T_current={T_current}
              onRemoveTask={removeScheduledTask}
              onRetireTask={retireTask}
              onCompleteTask={completeScheduledTask}
              activeItemId={activeItem?.id || null}
              selectedDayString={selectedDayString}
              onAddTaskClick={() => {}}
            />
          </div>
          
          {/* Utility Bar */}
          <SchedulerUtilityBar
            isProcessingCommand={isProcessingCommand}
            hasFlexibleTasksOnCurrentDay={hasFlexibleTasksOnCurrentDay}
            dbScheduledTasks={dbScheduledTasks}
            onRechargeEnergy={handleRechargeEnergy}
            onRandomizeBreaks={handleRandomizeBreaks}
            onSortFlexibleTasks={handleSortFlexibleTasks}
            onOpenWorkdayWindowDialog={() => setShowWorkdayDialog(true)}
            sortBy={sortBy}
            onCompactSchedule={() => compactScheduledTasks({ tasksToUpdate: dbScheduledTasks })}
            onQuickScheduleBlock={handleQuickScheduleBlock}
            retiredTasksCount={retiredTasks.length}
          />
        </div>

        {/* Aether Sink */}
        <div className="space-y-4">
          <AetherSink
            retiredTasks={retiredTasks}
            onRezoneTask={rezoneTask}
            onRemoveRetiredTask={async (taskId: string) => {
              try {
                await rezoneTask(taskId);
              } catch (error) {
                showError('Failed to remove retired task');
              }
            }}
            onAutoScheduleSink={handleAutoScheduleSink}
            isLoading={isLoading}
            isProcessingCommand={isProcessingCommand}
            profileEnergy={profile?.energy || 0}
            retiredSortBy={retiredSortBy}
            setRetiredSortBy={setRetiredSortBy}
          />
          
          {/* Daily Vibe Recap */}
          <DailyVibeRecapCard
            scheduleSummary={calculatedScheduleToday?.summary || null}
            tasksCompletedToday={completedTasksForSelectedDayList.length}
            xpEarnedToday={0} // Calculate from completed tasks
            profileEnergy={profile?.energy || 0}
            criticalTasksCompletedToday={0} // Calculate from completed tasks
            selectedDayString={selectedDayString}
            completedScheduledTasks={completedTasksForSelectedDayList}
          />
        </div>
      </div>

      {/* Input Bar */}
      <SchedulerInput
        onCommand={handleCommand}
        isLoading={isProcessingCommand}
        inputValue={''}
        setInputValue={() => {}}
        onDetailedInject={() => {}}
      />

      {/* XP Gain Animation Overlay */}
      {xpGainAnimation && (
        <XPGainAnimation
          xpAmount={xpGainAnimation.xpAmount}
          onAnimationEnd={clearXpGainAnimation}
        />
      )}

      {/* Modals */}
      <WorkdayWindowDialog
        open={showWorkdayDialog}
        onOpenChange={setShowWorkdayDialog}
      />
      
      <EarlyCompletionModal
        isOpen={showEarlyCompletionModal}
        onOpenChange={setShowEarlyCompletionModal}
        taskName={earlyCompletionData?.task.name || ''}
        remainingDurationMinutes={earlyCompletionData?.remainingMinutes || 0}
        onTakeBreak={handleEarlyCompletionTakeBreak}
        onStartNextTask={handleEarlyCompletionStartNext}
        onJustFinish={handleEarlyCompletionJustFinish}
        isProcessingCommand={isProcessingCommand}
        hasNextTask={!!nextItemToday}
      />

      {showImmersiveFocus && activeItem && (
        <ImmersiveFocusMode
          activeItem={activeItem}
          T_current={T_current}
          onExit={() => setShowImmersiveFocus(false)}
          onAction={handleFocusModeAction}
          dbTask={dbScheduledTasks.find(t => t.id === activeItem.id) || null}
          nextItem={nextItemToday}
          isProcessingCommand={isProcessingCommand}
        />
      )}
    </div>
  );
};

export default SchedulerPage;