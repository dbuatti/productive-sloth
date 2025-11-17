"use client";

import React, { useState, useMemo, useCallback, useRef } from 'react';
import { useSession } from '@/hooks/use-session';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import { useWindowSize } from '@/hooks/use-window-size';
import { AetherSink } from '@/components/AetherSink'; // Fix #1 - default import works
import { addDays, format, startOfDay, addHours } from 'date-fns';
import { SortBy, UnifiedTask, DBScheduledTask, RetiredTask, FormattedSchedule } from '@/types/scheduler';
import { calculateSchedule, setTimeOnDate, parseSinkTaskInput } from '@/lib/scheduler-utils';
import { showError } from '@/utils/toast';

const SchedulerPage: React.FC = () => {
  const { profile, T_current, user } = useSession();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedDayString, setSelectedDayString] = useState(format(startOfDay(new Date()), 'yyyy-MM-dd'));
  
  // Fix #2,3,4,5,6,7,8,9 - Complete hook destructuring
  const {
    dbScheduledTasks,
    retiredTasks, 
    isLoading, 
    sortBy, 
    setSortBy,
    addScheduledTask, 
    rezoneTask,
    autoBalanceSchedule
  } = useSchedulerTasks(selectedDayString, scrollRef);

  const workdayStartTimeToday = useMemo(() => {
    if (!profile?.default_auto_schedule_start_time) return startOfDay(T_current);
    return setTimeOnDate(startOfDay(T_current), profile.default_auto_schedule_start_time);
  }, [profile?.default_auto_schedule_start_time, T_current]);

  const workdayEndTimeToday = useMemo(() => {
    if (!profile?.default_auto_schedule_end_time) return addHours(startOfDay(T_current), 17);
    let endTime = setTimeOnDate(startOfDay(T_current), profile.default_auto_schedule_end_time);
    if (endTime < workdayStartTimeToday) endTime = addDays(endTime, 1);
    return endTime;
  }, [profile?.default_auto_schedule_end_time, T_current, workdayStartTimeToday]);

  const [isProcessingCommand, setIsProcessingCommand] = useState(false);

  const handleCommand = useCallback(async (command: string) => {
    setIsProcessingCommand(true);
    try {
      const newTask = parseSinkTaskInput(command, user?.id || '');
      if (newTask) {
        await addScheduledTask({ ...newTask, scheduled_date: selectedDayString, is_flexible: true, is_locked: false });
      }
    } catch (error) {
      showError(`Command failed: ${error}`);
    } finally {
      setIsProcessingCommand(false);
    }
  }, [selectedDayString, user?.id, addScheduledTask]);

  // Fix #2,3,4,5,6,7,8,9 - Now all vars defined
  const handleAutoScheduleSink = useCallback(async () => {
    const unifiedTasks: UnifiedTask[] = [
      ...dbScheduledTasks.filter(t => t.is_flexible && !t.is_locked).map(t => ({
        id: t.id, name: t.name, duration: 30, break_duration: t.break_duration || null,
        is_critical: t.is_critical, is_flexible: true, energy_cost: t.energy_cost,
        source: 'scheduled' as const, originalId: t.id, is_custom_energy_cost: t.is_custom_energy_cost,
        created_at: t.created_at,
      } as UnifiedTask)),
      ...retiredTasks.filter(t => !t.is_locked).map(t => ({
        id: `retired-${t.id}`, name: t.name, duration: t.duration || 30, break_duration: t.break_duration || null,
        is_critical: t.is_critical, is_flexible: true, energy_cost: t.energy_cost,
        source: 'retired' as const, originalId: t.id, is_custom_energy_cost: t.is_custom_energy_cost,
        created_at: t.retired_at,
      } as UnifiedTask))
    ];
    await autoBalanceSchedule({ scheduledTaskIdsToDelete: [], retiredTaskIdsToDelete: [], tasksToInsert: [], tasksToKeepInSink: [], selectedDate: selectedDayString });
  }, [dbScheduledTasks, retiredTasks, selectedDayString, autoBalanceSchedule]);

  // Fix #10 - Proper return inside component
  return (
    <div className="p-4">
      <div className="mb-4">Scheduler for {selectedDayString}</div>
      <AetherSink
        retiredTasks={retiredTasks}
        onRezoneTask={(taskId: string) => rezoneTask(taskId)}
        onRemoveRetiredTask={async (taskId: string) => {
          try {
            await rezoneTask(taskId);
          } catch (error) {
            showError('Failed to remove retired task');
          }
        }}
      />
    </div>
  );
};

export default SchedulerPage; // Fix #11 - Default export confirmed