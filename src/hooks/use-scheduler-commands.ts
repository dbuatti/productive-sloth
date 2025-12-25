import { useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from './use-session';
import { useSchedulerTasks } from './use-scheduler-tasks';
import { useEnvironmentContext } from './use-environment-context';
import { showSuccess, showError } from '@/utils/toast';
import {
  parseTaskInput,
  parseInjectionCommand,
  parseCommand,
  formatTime,
  setTimeOnDate,
  compactScheduleLogic,
  mergeOverlappingTimeBlocks,
  isSlotFree,
  getFreeTimeBlocks,
  calculateEnergyCost,
  isMeal,
  getBreakDescription,
} from '@/lib/scheduler-utils';
import {
  DBScheduledTask,
  NewDBScheduledTask,
  RetiredTask,
  NewRetiredTask,
  TaskEnvironment,
  SortBy,
  AutoBalancePayload,
  ScheduledItem,
  TimeBlock,
} from '@/types/scheduler';
import {
  parseISO,
  startOfDay,
  setHours,
  setMinutes,
  format as formatFns,
  addDays,
  addMinutes,
  isBefore,
  isSameDay,
  isAfter,
  differenceInMinutes,
  addHours,
} from 'date-fns';
import { LOW_ENERGY_THRESHOLD, MAX_ENERGY, REGEN_POD_RATE_PER_MINUTE, REGEN_POD_MAX_DURATION_MINUTES } from '@/lib/constants';
import { supabase } from '@/integrations/supabase/client';

interface UseSchedulerCommandsProps {
  selectedDay: string;
  dbScheduledTasks: DBScheduledTask[];
  retiredTasks: RetiredTask[];
  activeItemToday: ScheduledItem | null;
  nextItemToday: ScheduledItem | null;
  T_current: Date;
  workdayStartTime: Date;
  workdayEndTime: Date;
  effectiveWorkdayStart: Date;
  sortBy: SortBy;
  setSortBy: (sortBy: SortBy) => void;
  onPermanentDeleteScheduledTask: (taskId: string, taskName: string, index: number) => void;
  onPermanentDeleteRetiredTask: (taskId: string, taskName: string) => void;
  onScrollToItem: (itemId: string) => void;
  onShowEnergyDeficitConfirmation: (task: DBScheduledTask, index: number | null) => void;
  onShowEarlyCompletionModal: (task: DBScheduledTask, remainingMinutes: number) => void;
  onSetInjectionPrompt: (state: any) => void; // Simplified for now
  onSetInjectionDuration: (value: string) => void;
  onSetInjectionBreak: (value: string) => void;
  onSetInjectionStartTime: (value: string) => void;
  onSetInjectionEndTime: (value: string) => void;
  onSetShowClearConfirmation: (show: boolean) => void;
  onSetShowWorkdayWindowDialog: (show: boolean) => void;
  onSetShowPodSetupModal: (show: boolean) => void;
  onSetCalculatedPodDuration: (duration: number) => void;
}

export const useSchedulerCommands = ({
  selectedDay,
  dbScheduledTasks,
  retiredTasks,
  activeItemToday,
  nextItemToday,
  T_current,
  workdayStartTime,
  workdayEndTime,
  effectiveWorkdayStart,
  sortBy,
  setSortBy,
  onPermanentDeleteScheduledTask,
  onPermanentDeleteRetiredTask,
  onScrollToItem,
  onShowEnergyDeficitConfirmation,
  onShowEarlyCompletionModal,
  onSetInjectionPrompt,
  onSetInjectionDuration,
  onSetInjectionBreak,
  onSetInjectionStartTime,
  onSetInjectionEndTime,
  onSetShowClearConfirmation,
  onSetShowWorkdayWindowDialog,
  onSetShowPodSetupModal,
  onSetCalculatedPodDuration,
}: UseSchedulerCommandsProps) => {
  const queryClient = useQueryClient();
  const { user, profile, session, refreshProfile, startRegenPodState, exitRegenPodState, triggerEnergyRegen } = useSession();
  const { selectedEnvironments } = useEnvironmentContext();
  const environmentForPlacement = selectedEnvironments[0] || 'laptop';

  const {
    addScheduledTask,
    addRetiredTask,
    removeScheduledTask,
    clearScheduledTasks,
    retireTask,
    rezoneTask,
    compactScheduledTasks,
    randomizeBreaks,
    toggleScheduledTaskLock,
    aetherDump,
    aetherDumpMega,
    autoBalanceSchedule,
    completeScheduledTask,
    updateScheduledTaskDetails,
    updateScheduledTaskStatus,
    removeRetiredTask,
    triggerAetherSinkBackup,
  } = useSchedulerTasks(selectedDay);

  const [isProcessingCommand, setIsProcessingCommand] = useState(false);

  const formattedSelectedDay = selectedDay;
  const selectedDayAsDate = useMemo(() => parseISO(selectedDay), [selectedDay]);

  const occupiedBlocks = useMemo(() => {
    if (!dbScheduledTasks) return [];
    const mappedTimes = dbScheduledTasks
      .filter(task => task.start_time && task.end_time)
      .map(task => {
        const utcStart = parseISO(task.start_time!);
        const utcEnd = parseISO(task.end_time!);

        let localStart = setHours(setMinutes(selectedDayAsDate, utcStart.getMinutes()), utcStart.getHours());
        let localEnd = setHours(setMinutes(selectedDayAsDate, utcEnd.getMinutes()), utcEnd.getHours());

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

  const findFreeSlotForTask = useCallback(async (
    taskName: string,
    taskDuration: number,
    isCritical: boolean,
    isFlexible: boolean,
    energyCost: number,
    existingOccupiedBlocks: TimeBlock[],
    effectiveWorkdayStart: Date,
    workdayEndTime: Date
  ): Promise<{ proposedStartTime: Date | null, proposedEndTime: Date | null, message: string }> => {
    let proposedStartTime: Date | null = null;

    const lockedTaskBlocks = dbScheduledTasks
      .filter(task => task.is_locked && task.start_time && task.end_time)
      .map(task => {
        const utcStart = parseISO(task.start_time!);
        const utcEnd = parseISO(task.end_time!);

        let localStart = setHours(setMinutes(selectedDayAsDate, utcStart.getMinutes()), utcStart.getHours());
        let localEnd = setHours(setMinutes(selectedDayAsDate, utcEnd.getMinutes()), utcEnd.getHours());

        if (isBefore(localEnd, localStart)) {
          localEnd = addDays(localEnd, 1);
        }
        return { start: localStart, end: localEnd, duration: Math.floor((localEnd.getTime() - localStart.getTime()) / (10End.getTime() - localStart.getTime()) / (1000 * 60)) };
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    const allOccupiedBlocks = mergeOverlappingTimeBlocks([...existingOccupiedBlocks, ...lockedTaskBlocks]);
    const freeBlocks = getFreeTimeBlocks(allOccupiedBlocks, effectiveWorkdayStart, workdayEndTime);

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
      const message = `No available slot found within your workday (${formatTime(workdayStartTime)} - ${formatTime(workdayEndTime)}) for "${taskName}" (${taskDuration} min).`;
      return { proposedStartTime: null, proposedEndTime: null, message: message };
    }
  }, [workdayStartTime, workdayEndTime, dbScheduledTasks, selectedDayAsDate, effectiveWorkdayStart]);

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
      let eligibleSinkTasks = retiredTasks
        .filter(task => !task.is_locked && !task.is_completed)
        .map(task => ({
          ...task,
          effectiveDuration: task.duration || 30,
          totalDuration: (task.duration || 30) + (task.break_duration || 0),
        }));

      if (eligibleSinkTasks.length === 0) {
        showError("Aether Sink is empty. Cannot quick schedule tasks.");
        return;
      }

      eligibleSinkTasks.sort((a, b) => {
        if (sortPreference === 'shortestFirst') {
          return a.effectiveDuration - b.effectiveDuration;
        } else {
          return b.effectiveDuration - a.effectiveDuration;
        }
      });

      let remainingDuration = duration;
      const tasksToPlace: typeof eligibleSinkTasks = [];

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

      let currentOccupiedBlocksForScheduling = [...occupiedBlocks];
      let freeBlocks = getFreeTimeBlocks(currentOccupiedBlocksForScheduling, effectiveWorkdayStart, workdayEndTime);

      const firstTaskTotalDuration = tasksToPlace[0].totalDuration;
      const initialFreeBlock = freeBlocks.find(block => block.duration >= firstTaskTotalDuration);

      if (!initialFreeBlock) {
        showError(`No available slot found within your workday (${formatTime(workdayStartTime)} - ${formatTime(workdayEndTime)}) to start the quick block.`);
        return;
      }

      let currentPlacementTime = initialFreeBlock.start;
      let tasksSuccessfullyPlaced = 0;

      for (const task of tasksToPlace) {
        const taskDuration = task.duration;
        const breakDuration = task.break_duration || 0;
        const totalDuration = taskDuration + breakDuration;

        const proposedStartTime = currentPlacementTime;
        const proposedEndTime = addMinutes(proposedStartTime, totalDuration);

        if (isAfter(proposedEndTime, workdayEndTime)) {
          console.log(`QuickScheduleBlock: Task "${task.name}" exceeds workday end time. Stopping placement.`);
          break;
        }

        if (isSlotFree(proposedStartTime, proposedEndTime, currentOccupiedBlocksForScheduling)) {
          await addScheduledTask({
            name: task.name,
            start_time: proposedStartTime.toISOString(),
            end_time: proposedEndTime.toISOString(),
            break_duration: task.break_duration,
            scheduled_date: formattedSelectedDay,
            is_critical: task.is_critical,
            is_flexible: true,
            is_locked: false,
            energy_cost: task.energy_cost,
            is_custom_energy_cost: task.is_custom_energy_cost,
            task_environment: task.task_environment,
            is_backburner: task.is_backburner,
          });

          currentOccupiedBlocksForScheduling.push({ start: proposedStartTime, end: proposedEndTime, duration: totalDuration });
          currentOccupiedBlocksForScheduling = mergeOverlappingTimeBlocks(currentOccupiedBlocksForScheduling);
          currentPlacementTime = proposedEndTime;
          tasksSuccessfullyPlaced++;
        } else {
          console.log(`QuickScheduleBlock: Slot for task "${task.name}" is no longer free. Stopping placement.`);
          break;
        }
      }

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
      console.error("Quick schedule error:", error);
    } finally {
      setIsProcessingCommand(false);
    }
  }, [user, profile, retiredTasks, occupiedBlocks, effectiveWorkdayStart, workdayEndTime, addScheduledTask, rezoneTask, formattedSelectedDay, selectedDayAsDate, workdayStartTime, queryClient]);

  const handleCompactSchedule = useCallback(async () => {
    if (!user || !profile) {
      showError("Please log in and ensure your profile is loaded to compact the schedule.");
      return;
    }
    const currentDbTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', user.id, formattedSelectedDay, sortBy]) || [];

    if (!currentDbTasks.some(task => task.is_flexible && !task.is_locked)) {
      showSuccess("No flexible tasks to compact, fixed/locked tasks were skipped.");
      return;
    }

    setIsProcessingCommand(true);
    try {
      const compactedTasks = compactScheduleLogic(
        currentDbTasks,
        selectedDayAsDate,
        workdayStartTime,
        workdayEndTime,
        T_current
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
      console.error("Compact schedule error:", error);
    } finally {
      setIsProcessingCommand(false);
    }
  }, [user, profile, selectedDayAsDate, workdayStartTime, workdayEndTime, T_current, compactScheduledTasks, queryClient, formattedSelectedDay, sortBy]);

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
      console.error("Aether Dump error:", error);
    } finally {
      setIsProcessingCommand(false);
    }
  }, [user, aetherDump, queryClient]);

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
      console.error("Aether Dump Mega error:", error);
    } finally {
      setIsProcessingCommand(false);
    }
  }, [user, aetherDumpMega, queryClient]);

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
        duration: task.duration || 30,
        totalDuration: (task.duration || 30) + (task.break_duration || 0),
      }))
      .filter(task => task.totalDuration <= maxDuration);

    if (eligibleSinkTasks.length === 0) {
      console.log("SinkFill: No eligible tasks found in Aether Sink for the gap.");
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
      let currentOccupiedBlocksForScheduling = [...occupiedBlocks];
      currentOccupiedBlocksForScheduling.push({ start: proposedStartTime, end: proposedEndTime, duration: taskDuration });
      currentOccupiedBlocksForScheduling = mergeOverlappingTimeBlocks(currentOccupiedBlocksForScheduling);

      return true;
    } catch (error: any) {
      showError(`Failed to fill gap with sink task: ${error.message}`);
      console.error("Sink Fill Error:", error);
      return false;
    }
  }, [user, profile, retiredTasks, rezoneTask, addScheduledTask, formattedSelectedDay, occupiedBlocks, effectiveWorkdayStart, workdayEndTime]);

  const handleAutoScheduleAndSort = useCallback(async (
    sortPreference: SortBy,
    taskSource: 'all-flexible' | 'sink-only',
    environmentsToFilterBy: TaskEnvironment[] = []
  ) => {
    if (!user || !profile) {
      showError("Please log in and ensure your profile is loaded to auto-schedule.");
      return;
    }

    const today = startOfDay(new Date());
    if (isBefore(selectedDayAsDate, today)) {
      showError("Cannot auto-schedule for a past day. Please select today or a future day.");
      return;
    }

    setIsProcessingCommand(true);
    console.log(`handleAutoScheduleAndSort: Starting with sort: ${sortPreference}, source: ${taskSource}, environments: ${environmentsToFilterBy.join(', ')}`);

    try {
      const existingFixedTasks = dbScheduledTasks.filter(task => !task.is_flexible || task.is_locked);
      const flexibleScheduledTasks = dbScheduledTasks.filter(task => task.is_flexible && !task.is_locked);
      const unlockedRetiredTasks = retiredTasks.filter(task => !task.is_locked);

      const unifiedPool: UnifiedTask[] = [];
      const scheduledTaskIdsToDelete: string[] = [];
      const retiredTaskIdsToDelete: string[] = [];
      const tasksToInsert: NewDBScheduledTask[] = [];
      const tasksToKeepInSink: NewRetiredTask[] = [];

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

      const pastDueScheduledTasks = flexibleScheduledTasks.filter(task => {
        if (!task.start_time || task.is_completed) return false;
        const taskStartTime = parseISO(task.start_time);
        return isSameDay(selectedDayAsDate, T_current) && isBefore(taskStartTime, T_current);
      });

      pastDueScheduledTasks.forEach(task => {
        if (!scheduledTaskIdsToDelete.includes(task.id)) {
          scheduledTaskIdsToDelete.push(task.id);
          tasksToKeepInSink.push({
            user_id: user.id,
            name: task.name,
            duration: Math.floor((parseISO(task.end_time!).getTime() - parseISO(task.start_time!).getTime()) / (1000 * 60)),
            break_duration: task.break_duration,
            original_scheduled_date: formattedSelectedDay,
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

      const currentFlexibleScheduledTasks = flexibleScheduledTasks.filter(task => !scheduledTaskIdsToDelete.includes(task.id));

      if (taskSource === 'all-flexible') {
        currentFlexibleScheduledTasks.forEach(task => {
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
          is_flexible: true,
          is_backburner: task.is_backburner,
          energy_cost: task.energy_cost,
          source: 'retired',
          originalId: task.id,
          is_custom_energy_cost: task.is_custom_energy_cost,
          created_at: task.retired_at,
          task_environment: task.task_environment,
        });
      });

      const tasksToConsider = unifiedPool.filter(task => {
        if (environmentsToFilterBy.length === 0) {
          return true;
        }
        return environmentsToFilterBy.includes(task.task_environment);
      });

      let sortedTasks = [...tasksToConsider].sort((a, b) => {
        if (a.is_critical && !b.is_critical) return -1;
        if (!a.is_critical && b.is_critical) return 1;
        if (a.is_backburner && !b.is_backburner) return 1;
        if (!a.is_backburner && b.is_backburner) return -1;

        switch (sortPreference) {
          case 'TIME_EARLIEST_TO_LATEST':
            return (a.duration || 0) - (b.duration || 0);
          case 'TIME_LATEST_TO_EARLIEST':
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
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
      });

      let currentOccupiedBlocks = mergeOverlappingTimeBlocks(existingFixedTasks
        .filter(task => task.start_time && task.end_time)
        .map(task => {
          const start = setTimeOnDate(selectedDayAsDate, formatFns(parseISO(task.start_time!), 'HH:mm'));
          let end = setTimeOnDate(selectedDayAsDate, formatFns(parseISO(task.end_time!), 'HH:mm'));
          if (isBefore(end, start)) end = addDays(end, 1);
          return { start, end, duration: differenceInMinutes(end, start) };
        })
      );

      let currentPlacementTime = effectiveWorkdayStart;

      for (const task of sortedTasks) {
        let placed = false;
        let searchTime = currentPlacementTime;

        if (task.is_critical && profile.energy < LOW_ENERGY_THRESHOLD) {
          if (task.source === 'scheduled') {
            tasksToKeepInSink.push({
              user_id: user.id,
              name: task.name,
              duration: task.duration,
              break_duration: task.break_duration,
              original_scheduled_date: formattedSelectedDay,
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
          }
          continue;
        }

        while (isBefore(searchTime, workdayEndTime)) {
          const freeBlocks = getFreeTimeBlocks(currentOccupiedBlocks, searchTime, workdayEndTime);

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
                scheduled_date: formattedSelectedDay,
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
              original_scheduled_date: formattedSelectedDay,
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
              original_scheduled_date: formattedSelectedDay,
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

      const uniqueScheduledTaskIdsToDelete = Array.from(new Set(scheduledTaskIdsToDelete));
      const uniqueRetiredTaskIdsToDelete = Array.from(new Set(retiredTaskIdsToDelete));

      const payload: AutoBalancePayload = {
        scheduledTaskIdsToDelete: uniqueScheduledTaskIdsToDelete,
        retiredTaskIdsToDelete: uniqueRetiredTaskIdsToDelete,
        tasksToInsert: tasksToInsert,
        tasksToKeepInSink: tasksToKeepInSink,
        selectedDate: formattedSelectedDay,
      };

      console.log("handleAutoScheduleAndSort: Final payload for autoBalanceSchedule mutation:", {
        scheduledTaskIdsToDelete: payload.scheduledTaskIdsToDelete,
        retiredTaskIdsToDelete: payload.retiredTaskIdsToDelete,
        tasksToInsert: payload.tasksToInsert.map(t => ({ id: t.id, name: t.name, is_flexible: t.is_flexible, is_locked: t.is_locked, is_backburner: t.is_backburner })),
        tasksToKeepInSink: payload.tasksToKeepInSink.map(t => ({ name: t.name, is_backburner: t.is_backburner })),
        selectedDate: payload.selectedDate,
      });

      await autoBalanceSchedule(payload);
      showSuccess("Schedule re-balanced!");
      setSortBy('TIME_EARLIEST_TO_LATEST');
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
      setIsProcessingCommand(false);
    } catch (error: any) {
      showError(`Failed to auto-schedule: ${error.message}`);
      console.error("Auto-schedule error:", error);
    } finally {
      setIsProcessingCommand(false);
      console.log("handleAutoScheduleAndSort: Auto-schedule process finished.");
    }
  }, [user, profile, dbScheduledTasks, retiredTasks, selectedDayAsDate, formattedSelectedDay, effectiveWorkdayStart, workdayEndTime, autoBalanceSchedule, queryClient, LOW_ENERGY_THRESHOLD, sortBy, T_current, setSortBy]);

  const handleSortFlexibleTasks = useCallback(async (newSortBy: SortBy) => {
    if (!user || !profile) {
      showError("Please log in and ensure your profile is loaded to sort tasks.");
      return;
    }

    if (dbScheduledTasks.length === 0) {
      await handleAutoScheduleAndSort(newSortBy, 'sink-only');
    } else {
      await handleAutoScheduleAndSort(newSortBy, 'all-flexible');
    }
  }, [user, profile, dbScheduledTasks.length, handleAutoScheduleAndSort]);

  const handleZoneFocus = useCallback(async () => {
    if (!user || !profile) {
      showError("Please log in and ensure your profile is loaded to use Zone Focus.");
      return;
    }
    await handleAutoScheduleAndSort('PRIORITY_HIGH_TO_LOW', 'all-flexible', selectedEnvironments);
  }, [user, profile, selectedEnvironments, handleAutoScheduleAndSort]);

  const handleAutoScheduleSinkWrapper = useCallback(async () => {
    if (!user || !profile) {
      showError("Please log in and ensure your profile is loaded to auto-schedule.");
      return;
    }
    await handleAutoScheduleAndSort('PRIORITY_HIGH_TO_LOW', 'sink-only');
  }, [user, profile, handleAutoScheduleAndSort]);

  const handleAutoScheduleDay = useCallback(async () => {
    if (!user || !profile) {
      showError("Please log in and ensure your profile is loaded to auto-schedule your day.");
      return;
    }
    await handleAutoScheduleAndSort('PRIORITY_HIGH_TO_LOW', 'all-flexible', []);
  }, [user, profile, handleAutoScheduleAndSort]);

  const handleStartRegenPod = useCallback(async () => {
    if (!user || !profile) {
      showError("Please log in to start the Energy Regen Pod.");
      return;
    }
    if (profile.is_in_regen_pod) return;

    setIsProcessingCommand(true);

    const energyNeeded = MAX_ENERGY - (profile.energy || 0);

    if (energyNeeded <= 0) {
      showSuccess("Energy is already full! No need for the Pod.");
      setIsProcessingCommand(false);
      return;
    }

    const durationNeeded = Math.ceil(energyNeeded / REGEN_POD_RATE_PER_MINUTE);
    const podDuration = Math.min(durationNeeded, REGEN_POD_MAX_DURATION_MINUTES);

    onSetCalculatedPodDuration(podDuration);
    onSetShowPodSetupModal(true);

    setIsProcessingCommand(false);
  }, [user, profile, onSetCalculatedPodDuration, onSetShowPodSetupModal]);

  const handlePodExit = useCallback(async () => {
    if (!user || !profile || !profile.is_in_regen_pod) {
      onSetShowPodSetupModal(false);
      return;
    }
    setIsProcessingCommand(true);

    try {
      await exitRegenPodState();

      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', user.id] });
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user.id] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', user.id] });

      const latestDbScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', user.id, formattedSelectedDay, sortBy]) || [];
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
        showSuccess(`Schedule compacted after Pod exit.`);
      } else {
        showSuccess(`No flexible tasks to compact after Pod exit.`);
      }
    } catch (error: any) {
      showError(`Failed to exit Pod: ${error.message}`);
      console.error("Pod exit error:", error);
    } finally {
      setIsProcessingCommand(false);
      onSetShowPodSetupModal(false);
    }
  }, [user, profile, exitRegenPodState, queryClient, formattedSelectedDay, sortBy, selectedDayAsDate, workdayStartTime, workdayEndTime, T_current, compactScheduledTasks, onSetShowPodSetupModal]);

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

    let currentOccupiedBlocksForScheduling = [...occupiedBlocks];

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
          is_backburner: parsedInput.isBackburner,
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
            effectiveWorkdayStart,
            workdayEndTime
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
              is_backburner: parsedInput.isBackburner,
            });
            currentOccupiedBlocksForScheduling.push({ start: proposedStartTime, end: proposedEndTime, duration: newTaskDuration });
            currentOccupiedBlocksForScheduling = mergeOverlappingTimeBlocks(currentOccupiedBlocksForScheduling);

            showSuccess(`Scheduled "${parsedInput.name}" from ${formatTime(proposedStartTime)} to ${formatTime(proposedEndTime)}.`);
            success = true;
          } else {
            showError(message);
          }
        } else {
          let startTime = setHours(setMinutes(startOfDay(selectedDayAsDate), parsedInput.startTime!.getMinutes()), parsedInput.startTime!.getHours());
          let endTime = setHours(setMinutes(startOfDay(selectedDayAsDate), parsedInput.endTime!.getMinutes()), parsedInput.endTime!.getHours());

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
            is_backburner: parsedInput.isBackburner,
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

        const isMealTask = isMeal(injectCommand.taskName);
        const calculatedEnergyCost = isMealTask ? -10 : calculateEnergyCost(injectedTaskDuration, injectCommand.isCritical ?? false, injectCommand.isBackburner ?? false);

        const { proposedStartTime, proposedEndTime, message } = await findFreeSlotForTask(
          injectCommand.taskName,
          injectedTaskDuration,
          injectCommand.isCritical,
          injectCommand.isFlexible,
          calculatedEnergyCost,
          currentOccupiedBlocksForScheduling,
          effectiveWorkdayStart,
          workdayEndTime
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
        onSetInjectionPrompt({
          taskName: injectCommand.taskName,
          isOpen: true,
          isTimed: true,
          startTime: injectCommand.startTime,
          endTime: injectCommand.endTime,
          isCritical: injectCommand.isCritical,
          isFlexible: injectCommand.isFlexible,
          isBackburner: injectCommand.isBackburner,
          energyCost: injectCommand.energyCost,
          breakDuration: injectCommand.breakDuration,
          isCustomEnergyCost: false,
          taskEnvironment: environmentForPlacement,
        });
        onSetInjectionStartTime(injectCommand.startTime);
        onSetInjectionEndTime(injectCommand.endTime);
        success = true;
      } else {
        onSetInjectionPrompt({
          taskName: injectCommand.taskName,
          isOpen: true,
          isTimed: false,
          duration: injectCommand.duration,
          startTime: undefined,
          endTime: undefined,
          isCritical: injectCommand.isCritical,
          isFlexible: injectCommand.isFlexible,
          isBackburner: injectCommand.isBackburner,
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
          onSetShowClearConfirmation(true);
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
              onPermanentDeleteScheduledTask(taskToRemove.id, taskToRemove.name, command.index);
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
              onPermanentDeleteScheduledTask(tasksToRemove[0].id, tasksToRemove[0].name, taskIndex);
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
          onSetInjectionPrompt({
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
          onSetInjectionStartTime(formatFns(T_current, 'h:mm a'));
          onSetInjectionEndTime(formatFns(addHours(T_current, 1), 'h:mm a'));
          onSetInjectionDuration('');
          onSetInjectionBreak('');
          success = true;
          break;
        case 'aether dump':
        case 'reset schedule':
          await aetherDump();
          queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
          success = true;
          break;
        case 'aether dump mega':
          await handleAetherDumpMegaButton();
          success = true;
          break;
        case 'break':
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
            is_flexible: false,
            is_locked: true,
            energy_cost: 0,
            is_custom_energy_cost: false,
            task_environment: environmentForPlacement,
            is_backburner: false,
          });

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
    return success;
  }, [user, profile, selectedDayAsDate, formattedSelectedDay, occupiedBlocks, findFreeSlotForTask, effectiveWorkdayStart, workdayEndTime, addRetiredTask, addScheduledTask, T_current, environmentForPlacement, onSetInjectionPrompt, onSetInjectionStartTime, onSetInjectionEndTime, onSetInjectionDuration, onSetInjectionBreak, dbScheduledTasks, onPermanentDeleteScheduledTask, onSetShowClearConfirmation, aetherDump, handleAetherDumpMegaButton, queryClient, triggerEnergyRegen]);

  const handleInjectionSubmit = useCallback(async () => {
    if (!user || !profile) {
      showError("You must be logged in and your profile loaded to use the scheduler.");
      return false;
    }
    setIsProcessingCommand(true);

    let success = false;
    const taskScheduledDate = formattedSelectedDay;
    const selectedDayAsDate = parseISO(selectedDay);

    let calculatedEnergyCost = 0;

    let currentOccupiedBlocksForScheduling = [...occupiedBlocks];

    // Assuming injectionPrompt state is managed externally and passed via props
    // For this refactor, we'll use a placeholder for injectionPrompt
    const injectionPromptPlaceholder = {
      taskName: '', // Replace with actual task name from state
      isTimed: false, // Replace with actual isTimed from state
      startTime: '', // Replace with actual startTime from state
      endTime: '', // Replace with actual endTime from state
      duration: 0, // Replace with actual duration from state
      breakDuration: undefined, // Replace with actual breakDuration from state
      isCritical: false, // Replace with actual isCritical from state
      isFlexible: true, // Replace with actual isFlexible from state
      isBackburner: false, // Replace with actual isBackburner from state
      energyCost: 0, // Replace with actual energyCost from state
      isCustomEnergyCost: false, // Replace with actual isCustomEnergyCost from state
      taskEnvironment: environmentForPlacement, // Replace with actual taskEnvironment from state
    };

    if (injectionPromptPlaceholder.isTimed) {
      if (!injectionPromptPlaceholder.startTime || !injectionPromptPlaceholder.endTime) {
        showError("Start time and end time are required for timed injection.");
        setIsProcessingCommand(false);
        return false;
      }
      const tempStartTime = parseFlexibleTime(injectionPromptPlaceholder.startTime, selectedDayAsDate);
      const tempEndTime = parseFlexibleTime(injectionPromptPlaceholder.endTime, selectedDayAsDate);

      let startTime = setHours(setMinutes(startOfDay(selectedDayAsDate), tempStartTime.getMinutes()), tempStartTime.getHours());
      let endTime = setHours(setMinutes(startOfDay(selectedDayAsDate), tempEndTime.getMinutes()), tempEndTime.getHours());

      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        showError("Invalid time format for start/end times.");
        setIsProcessingCommand(false);
        return false;
      }

      if (isSameDay(selectedDayAsDate, T_current) && isBefore(startTime, T_current)) {
        startTime = addDays(startTime, 1);
        endTime = addDays(endTime, 1);
        showSuccess(`Scheduled "${injectionPromptPlaceholder.taskName}" for tomorrow at ${formatTime(startTime)} as today's time has passed.`);
      } else if (isBefore(endTime, startTime)) {
        endTime = addDays(endTime, 1);
      }

      if (!isSlotFree(startTime, endTime, currentOccupiedBlocksForScheduling)) {
        showError(`The time slot from ${formatTime(startTime)} to ${formatTime(endTime)} is already occupied.`);
        setIsProcessingCommand(false);
        return false;
      }

      const duration = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));

      const isMealTask = isMeal(injectionPromptPlaceholder.taskName);
      calculatedEnergyCost = isMealTask ? -10 : calculateEnergyCost(duration, injectionPromptPlaceholder.isCritical ?? false, injectionPromptPlaceholder.isBackburner ?? false);

      await addScheduledTask({
        name: injectionPromptPlaceholder.taskName,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        break_duration: injectionPromptPlaceholder.breakDuration,
        scheduled_date: taskScheduledDate,
        is_critical: injectionPromptPlaceholder.isCritical,
        is_flexible: injectionPromptPlaceholder.isFlexible,
        energy_cost: calculatedEnergyCost,
        is_custom_energy_cost: false,
        task_environment: environmentForPlacement,
        is_backburner: injectionPromptPlaceholder.isBackburner,
      });
      currentOccupiedBlocksForScheduling.push({ start: startTime, end: endTime, duration: duration });
      currentOccupiedBlocksForScheduling = mergeOverlappingTimeBlocks(currentOccupiedBlocksForScheduling);

      showSuccess(`Injected "${injectionPromptPlaceholder.taskName}" from ${formatTime(startTime)} to ${formatTime(endTime)}.`);
      success = true;
    } else {
      if (!injectionPromptPlaceholder.duration) {
        showError("Duration is required for duration-based injection.");
        setIsProcessingCommand(false);
        return false;
      }
      const injectedTaskDuration = injectionPromptPlaceholder.duration;
      const breakDuration = injectionPromptPlaceholder.breakDuration;

      if (isNaN(injectedTaskDuration) || injectedTaskDuration <= 0) {
        showError("Duration must be a positive number.");
        setIsProcessingCommand(false);
        return false;
      }

      const isMealTask = isMeal(injectionPromptPlaceholder.taskName);
      calculatedEnergyCost = isMealTask ? -10 : calculateEnergyCost(injectedTaskDuration, injectionPromptPlaceholder.isCritical ?? false, injectionPromptPlaceholder.isBackburner ?? false);

      const { proposedStartTime, proposedEndTime, message } = await findFreeSlotForTask(
        injectionPromptPlaceholder.taskName,
        injectedTaskDuration,
        injectionPromptPlaceholder.isCritical,
        injectionPromptPlaceholder.isFlexible,
        calculatedEnergyCost,
        currentOccupiedBlocksForScheduling,
        effectiveWorkdayStart,
        workdayEndTime
      );

      if (proposedStartTime && proposedEndTime) {
        await addScheduledTask({
          name: injectionPromptPlaceholder.taskName,
          start_time: proposedStartTime.toISOString(),
          end_time: proposedEndTime.toISOString(),
          break_duration: breakDuration,
          scheduled_date: taskScheduledDate,
          is_critical: injectionPromptPlaceholder.isCritical,
          is_flexible: injectionPromptPlaceholder.isFlexible,
          energy_cost: calculatedEnergyCost,
          is_custom_energy_cost: false,
          task_environment: environmentForPlacement,
          is_backburner: injectionPromptPlaceholder.isBackburner,
        });
        currentOccupiedBlocksForScheduling.push({ start: proposedStartTime, end: proposedEndTime, duration: injectedTaskDuration });
        currentOccupiedBlocksForScheduling = mergeOverlappingTimeBlocks(currentOccupiedBlocksForScheduling);

        showSuccess(`Injected "${injectionPromptPlaceholder.taskName}" from ${formatTime(proposedStartTime)} to ${formatTime(proposedEndTime)}.`);
        success = true;
      } else {
        showError(message);
      }
    }

    if (success) {
      onSetInjectionPrompt(null);
      onSetInjectionDuration('');
      onSetInjectionBreak('');
      onSetInjectionStartTime('');
      onSetInjectionEndTime('');
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
    }
    setIsProcessingCommand(false);
    return success;
  }, [user, profile, selectedDayAsDate, formattedSelectedDay, occupiedBlocks, findFreeSlotForTask, effectiveWorkdayStart, workdayEndTime, addScheduledTask, onSetInjectionPrompt, onSetInjectionDuration, onSetInjectionBreak, onSetInjectionStartTime, onSetInjectionEndTime, queryClient, T_current, environmentForPlacement]);

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

      let currentOccupiedBlocksForScheduling = [...occupiedBlocks];

      const { proposedStartTime, proposedEndTime, message } = await findFreeSlotForTask(
        retiredTask.name,
        taskDuration,
        retiredTask.is_critical,
        true,
        retiredTask.energy_cost,
        currentOccupiedBlocksForScheduling,
        effectiveWorkdayStart,
        workdayEndTime
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
      console.error("Rezone error:", error);
    } finally {
      setIsProcessingCommand(false);
    }
  }, [user, retiredTasks, selectedDay, occupiedBlocks, findFreeSlotForTask, rezoneTask, addScheduledTask, formattedSelectedDay, effectiveWorkdayStart, workdayEndTime, queryClient]);

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
      console.error("Manual retire error:", error);
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
      workdayStartTime: effectiveWorkdayStart,
      workdayEndTime: workdayEndTime,
      currentDbTasks: dbScheduledTasks,
    });

    queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
    setIsProcessingCommand(false);
  }, [user, profile, dbScheduledTasks, formattedSelectedDay, effectiveWorkdayStart, workdayEndTime, randomizeBreaks, queryClient]);

  const handleSchedulerAction = useCallback(async (
    action: 'complete' | 'skip' | 'takeBreak' | 'startNext' | 'justFinish' | 'exitFocus',
    task: DBScheduledTask,
    isEarlyCompletion: boolean = false,
    remainingDurationMinutes: number = 0,
    index: number | null = null
  ) => {
    if (!user || !profile) {
      showError("You must be logged in to perform this action.");
      return;
    }
    if (task.is_locked && action !== 'exitFocus') {
      showError(`Cannot perform action on locked task "${task.name}". Unlock it first.`);
      return;
    }

    setIsProcessingCommand(true);
    let modalOpened = false;

    try {
      if (action === 'complete') {
        const isMealTask = isMeal(task.name);

        if (!isMealTask && profile.energy < 0) {
          onShowEnergyDeficitConfirmation(task, index);
          modalOpened = true;
          setIsProcessingCommand(false);
          return;
        }

        const activeItem = dbScheduledTasks.find(item => item.id === task.id);

        const isCurrentlyActive = activeItem && isSameDay(parseISO(activeItem.scheduled_date), T_current) && activeItem.start_time && activeItem.end_time && T_current >= parseISO(activeItem.start_time) && T_current < parseISO(activeItem.end_time);

        let shouldOpenEarlyCompletionModal = false;
        let remainingMins = 0;

        if (isCurrentlyActive) {
          remainingMins = activeItem ? differenceInMinutes(parseISO(activeItem.end_time!), T_current) : 0;
          if (remainingMins > 0) {
            shouldOpenEarlyCompletionModal = true;
          }
        }

        if (shouldOpenEarlyCompletionModal && !isMealTask) {
          onShowEarlyCompletionModal(task, remainingMins);
          modalOpened = true;
          setIsProcessingCommand(false);
          return;
        } else {
          const isFixedOrTimed = !task.is_flexible || isMealTask || task.name.toLowerCase() === 'time off';

          if (isFixedOrTimed) {
            await updateScheduledTaskStatus({ taskId: task.id, isCompleted: true });
            showSuccess(`Task "${task.name}" completed!`);
          } else {
            await completeScheduledTask(task);
            if (task.is_flexible) {
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
                showSuccess(`Task "${task.name}" completed! Schedule compacted.`);
              } else {
                showSuccess(`Task "${task.name}" completed! No flexible tasks to compact.`);
              }
            } else {
              showSuccess(`Task "${task.name}" completed!`);
            }
          }

          if (task.name.toLowerCase() === 'break' || isMealTask) {
            await triggerEnergyRegen();
          }
        }

      } else if (action === 'skip') {
        await handleManualRetire(task);
        showSuccess(`Task "${task.name}" skipped and moved to Aether Sink.`);
      } else if (action === 'takeBreak') {
        const breakDuration = remainingDurationMinutes;
        const breakStartTime = T_current;
        const breakEndTime = addMinutes(breakStartTime, breakDuration);

        await addScheduledTask({
          name: 'Flow Break',
          start_time: breakStartTime.toISOString(),
          end_time: breakEndTime.toISOString(),
          break_duration: breakDuration,
          scheduled_date: formattedSelectedDay,
          is_critical: false,
          is_flexible: false,
          is_locked: true,
          energy_cost: 0,
          is_custom_energy_cost: false,
          task_environment: environmentForPlacement,
          is_backburner: false,
        });

        await completeScheduledTask(task);
        if (task.is_flexible) {
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
          }
        }

        await triggerEnergyRegen();

        showSuccess(`Took a ${breakDuration}-minute Flow Break!`);
      } else if (action === 'startNext') {
        if (!nextItemToday) {
          showError("No next task available to start early.");
          return;
        }

        const originalNextTask = dbScheduledTasks.find(t => t.id === nextItemToday.id);
        if (!originalNextTask) {
          showError("Error: Could not find original task details for next item.");
          return;
        }

        const originalNextTaskStartTime = originalNextTask.start_time ? parseISO(originalNextTask.start_time) : nextItemToday.startTime;
        const isNextTaskImmovable = !originalNextTask.is_flexible || originalNextTask.is_locked;
        const remainingMins = differenceInMinutes(originalNextTaskStartTime, T_current);

        await completeScheduledTask(task);
        if (task.is_flexible) {
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
          }
        }

        if (isNextTaskImmovable) {
          if (remainingMins > 0) {
            const gapStart = T_current;
            const gapEnd = originalNextTaskStartTime;

            const filled = await handleSinkFill(gapStart, gapEnd, remainingMins);

            if (filled) {
              showSuccess(`Task completed! Fixed appointment protected. Filled ${remainingMins} min gap from Aether Sink.`);
            } else {
              showSuccess(`Task completed! Fixed appointment protected. ${remainingMins} min free time created before next fixed task.`);
            }
          } else {
            showSuccess(`Task completed! Next task starts immediately.`);
          }
        } else {
          const newNextTaskStartTime = T_current;
          const nextTaskDuration = differenceInMinutes(nextItemToday.endTime, nextItemToday.startTime);
          const newNextTaskEndTime = addMinutes(newNextTaskStartTime, nextTaskDuration);

          await updateScheduledTaskDetails({
            id: nextItemToday.id,
            start_time: newNextTaskStartTime.toISOString(),
            end_time: newNextTaskEndTime.toISOString(),
            is_flexible: originalNextTask.is_flexible,
            is_locked: originalNextTask.is_locked,
            task_environment: originalNextTask.task_environment,
            is_backburner: originalNextTask.is_backburner,
          });

          await handleCompactSchedule();

          showSuccess(`Started "${nextItemToday.name}" early! Schedule compacted.`);
        }
      } else if (action === 'justFinish') {
        await completeScheduledTask(task);
        if (task.is_flexible) {
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
            showSuccess(`Task "${task.name}" completed! Remaining time is now free. Schedule compacted.`);
          } else {
            showSuccess(`Task "${task.name}" completed! Remaining time is now free. No flexible tasks to compact.`);
          }
        } else {
          showSuccess(`Task "${task.name}" completed! Remaining time is now free.`);
        }

        if (task.name.toLowerCase() === 'break' || isMeal(task.name)) {
          await triggerEnergyRegen();
        }
      } else if (action === 'exitFocus') {
        showSuccess("Exited focus mode.");
      }

      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
      if (activeItemToday) {
        onScrollToItem(activeItemToday.id);
      } else if (nextItemToday) {
        onScrollToItem(nextItemToday.id);
      }
    } catch (error: any) {
      if (modalOpened) {
        // Reset modal states if an error occurred after opening a modal
      }
      showError(`Failed to perform action: ${error.message}`);
      console.error("Scheduler action error:", error);
    } finally {
      if (!modalOpened) {
        setIsProcessingCommand(false);
      }
    }
  }, [user, profile, dbScheduledTasks, T_current, onShowEnergyDeficitConfirmation, onShowEarlyCompletionModal, formattedSelectedDay, sortBy, selectedDayAsDate, workdayStartTime, workdayEndTime, completeScheduledTask, updateScheduledTaskStatus, compactScheduledTasks, triggerEnergyRegen, nextItemToday, addScheduledTask, environmentForPlacement, handleSinkFill, updateScheduledTaskDetails, handleCompactSchedule, onScrollToItem, activeItemToday, handleManualRetire, queryClient]);

  const handleFreeTimeClick = useCallback(async (startTime: Date, endTime: Date) => {
    const duration = differenceInMinutes(endTime, startTime);

    onSetInjectionPrompt({
      taskName: '',
      isOpen: true,
      isTimed: false,
      duration: duration,
      startTime: undefined,
      endTime: undefined,
      isCritical: false,
      isFlexible: true,
      isBackburner: false,
      energyCost: calculateEnergyCost(duration, false),
      breakDuration: undefined,
      isCustomEnergyCost: false,
      taskEnvironment: environmentForPlacement,
    });
    onSetInjectionDuration(String(duration));
    onSetInjectionBreak('');
    onSetInjectionStartTime('');
    onSetInjectionEndTime('');
    showSuccess(`Injected ${duration} min free slot into task creation.`);
  }, [onSetInjectionPrompt, onSetInjectionDuration, onSetInjectionBreak, onSetInjectionStartTime, onSetInjectionEndTime, environmentForPlacement]);

  const handleAddTaskClick = useCallback(() => {
    onSetInjectionPrompt({
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
    onSetInjectionDuration('30');
    onSetInjectionBreak('');
    onSetInjectionStartTime('');
    onSetInjectionEndTime('');
  }, [onSetInjectionPrompt, onSetInjectionDuration, onSetInjectionBreak, onSetInjectionStartTime, onSetInjectionEndTime, environmentForPlacement]);

  const handleAddTimeOffClick = useCallback(() => {
    onSetInjectionPrompt({
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
    onSetInjectionStartTime(formatFns(T_current, 'h:mm a'));
    onSetInjectionEndTime(formatFns(addHours(T_current, 1), 'h:mm a'));
    onSetInjectionDuration('');
    onSetInjectionBreak('');
  }, [onSetInjectionPrompt, onSetInjectionStartTime, onSetInjectionEndTime, onSetInjectionDuration, onSetInjectionBreak, T_current]);

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

      let currentOccupiedBlocksForScheduling = [...occupiedBlocks];

      const { proposedStartTime, proposedEndTime, message } = await findFreeSlotForTask(
        retiredTask.name,
        taskDuration,
        retiredTask.is_critical,
        true,
        retiredTask.energy_cost,
        currentOccupiedBlocksForScheduling,
        effectiveWorkdayStart,
        workdayEndTime
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
      console.error("Rezone error:", error);
    } finally {
      setIsProcessingCommand(false);
    }
  }, [user, retiredTasks, selectedDay, occupiedBlocks, findFreeSlotForTask, rezoneTask, addScheduledTask, formattedSelectedDay, effectiveWorkdayStart, workdayEndTime, queryClient]);

  const handleAutoScheduleSinkWrapper = useCallback(async () => {
    if (!user || !profile) {
      showError("Please log in and ensure your profile is loaded to auto-schedule.");
      return;
    }
    await handleAutoScheduleAndSort('PRIORITY_HIGH_TO_LOW', 'sink-only');
  }, [user, profile, handleAutoScheduleAndSort]);

  const handleOpenWorkdayWindowDialog = useCallback(() => {
    onSetShowWorkdayWindowDialog(true);
  }, [onSetShowWorkdayWindowDialog]);

  const handlePermanentDeleteRetiredTaskWrapper = useCallback(async (taskId: string, taskName: string) => {
    onPermanentDeleteRetiredTask(taskId, taskName);
  }, [onPermanentDeleteRetiredTask]);

  const handlePermanentDeleteScheduledTaskWrapper = useCallback(async (taskId: string, taskName: string, index: number) => {
    onPermanentDeleteScheduledTask(taskId, taskName, index);
  }, [onPermanentDeleteScheduledTask]);

  return {
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
  };
};