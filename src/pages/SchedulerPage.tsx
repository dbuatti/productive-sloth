"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { format, isBefore, addMinutes, parseISO, isSameDay, startOfDay, addHours, addDays, differenceInMinutes, max, min, isAfter } from 'date-fns';
import { ListTodo, Loader2, Cpu, Zap, Clock, Trash2, Archive, Target, Database, CalendarDays, Lock, Unlock } from 'lucide-react';
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
  getStaticConstraints, // NEW: Imported getStaticConstraints
} from '@/lib/scheduler-utils';
import { showSuccess, showError } from '@/utils/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import { useRetiredTasks } from '@/hooks/use-retired-tasks'; // NEW: Import useRetiredTasks
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
    removeScheduledTask, 
    clearScheduledTasks, // Now from useSchedulerTasks
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
    isLoadingCompletedTasksForSelectedDay, // Corrected: Destructure from useSchedulerTasks
    // autoBalanceScheduleMutation, // REMOVED: Not directly exposed by useSchedulerTasks
  } = useSchedulerTasks(selectedDay, scheduleContainerRef);

  const {
    retiredTasks,
    isLoadingRetiredTasks,
    addRetiredTask, // Now from useRetiredTasks
    removeRetiredTask, // Now from useRetiredTasks
    rezoneTask, // Now from useRetiredTasks
    retiredSortBy,
    setRetiredSortBy,
  } = useRetiredTasks(); // NEW: Use useRetiredTasks

  const { data: mealAssignments = [] } = useQuery<MealAssignment[]>({
    queryKey: ['mealAssignments', user?.id, selectedDay],
    queryFn: async () => {
      if (!user?.id || !selectedDay) return [];
      console.log(`[SchedulerPage] Fetching meal assignments for ${selectedDay} for user: ${user.id}`);
      const { data, error } = await supabase
        .from('meal_assignments')
        .select('*, meal_idea:meal_ideas(*)')
        .eq('assigned_date', selectedDay)
        .eq('user_id', user.id);
      if (error) {
        console.error("[SchedulerPage] Error fetching meal assignments:", error);
        throw error;
      }
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
      console.log("[SchedulerPage] Regen Pod is running, opening setup modal.");
      setShowRegenPodSetup(true);
    }
  }, [isRegenPodRunning]); // Only depend on the running state

  // Memoize getStaticConstraints to prevent recreation on every render
  const staticConstraints = useMemo((): TimeBlock[] => {
    if (!profile) return [];
    return getStaticConstraints(profile, selectedDayAsDate, workdayStartTimeForSelectedDay, workdayEndTimeForSelectedDay);
  }, [profile, selectedDayAsDate, workdayStartTimeForSelectedDay, workdayEndTimeForSelectedDay]);

  const handleRebalanceToday = useCallback(async () => {
    console.log("[SchedulerPage] Initiating rebalance today command.");
    if (isSelectedDayBlocked) {
      showError("Cannot auto-schedule on a blocked day.");
      return;
    }
    setIsProcessingCommand(true);
    try {
      await handleAutoScheduleAndSort(sortBy, 'sink-to-gaps', [], selectedDay);
      showSuccess("Schedule rebalanced with tasks from Aether Sink!");
    } catch (e: any) {
      showError(`Rebalance failed: ${e.message}`);
      console.error("[SchedulerPage] Rebalance today error:", e);
    } finally {
      setIsProcessingCommand(false);
    }
  }, [handleAutoScheduleAndSort, selectedDay, sortBy, isSelectedDayBlocked]);

  const handleReshuffleEverything = useCallback(async () => {
    console.log("[SchedulerPage] Initiating reshuffle everything command.");
    if (isSelectedDayBlocked) {
      showError("Cannot reshuffle on a blocked day.");
      return;
    }
    setIsProcessingCommand(true);
    try {
      await handleAutoScheduleAndSort(sortBy, 'all-flexible', [], selectedDay);
      showSuccess("All flexible tasks reshuffled!");
    } catch (e: any) {
      showError(`Reshuffle failed: ${e.message}`);
      console.error("[SchedulerPage] Reshuffle everything error:", e);
    } finally {
      setIsProcessingCommand(false);
    }
  }, [handleAutoScheduleAndSort, selectedDay, sortBy, isSelectedDayBlocked]);

  const handleZoneFocus = useCallback(async () => {
    console.log("[SchedulerPage] Initiating zone focus command.");
    if (isSelectedDayBlocked) {
      showError("Cannot zone focus on a blocked day.");
      return;
    }
    setIsProcessingCommand(true);
    try {
      await handleAutoScheduleAndSort(sortBy, 'sink-only', selectedEnvironments, selectedDay);
      showSuccess("Tasks filtered by environment and scheduled!");
    } catch (e: any) {
      showError(`Zone focus failed: ${e.message}`);
      console.error("[SchedulerPage] Zone focus error:", e);
    } finally {
      setIsProcessingCommand(false);
    }
  }, [handleAutoScheduleAndSort, selectedEnvironments, selectedDay, sortBy, isSelectedDayBlocked]);

  const handleGlobalAutoSchedule = useCallback(async () => {
    console.log("[SchedulerPage] Initiating global auto-schedule command.");
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
      console.error("[SchedulerPage] Global auto-schedule error:", e);
    } finally {
      setIsProcessingCommand(false);
    }
  }, [handleAutoScheduleAndSort, sortBy, selectedDay, isSelectedDayBlocked]);

  const handleCompact = useCallback(async () => {
    console.log("[SchedulerPage] Initiating compact schedule command.");
    if (isSelectedDayBlocked) {
      showError("Cannot compact schedule on a blocked day.");
      return;
    }
    setIsProcessingCommand(true);
    try {
      const tasksToUpdate = compactScheduleLogic(dbScheduledTasks, selectedDayAsDate, workdayStartTimeForSelectedDay, workdayEndTimeForSelectedDay, T_current, profile);
      await compactScheduledTasks({ tasksToUpdate });
      showSuccess("Schedule compacted!");
    } catch (e: any) {
      showError(`Compaction failed: ${e.message}`);
      console.error("[SchedulerPage] Compact schedule error:", e);
    } finally {
      setIsProcessingCommand(false);
    }
  }, [dbScheduledTasks, selectedDayAsDate, workdayStartTimeForSelectedDay, workdayEndTimeForSelectedDay, T_current, compactScheduledTasks, profile, isSelectedDayBlocked]);

  const handleRandomize = useCallback(async () => {
    console.log("[SchedulerPage] Initiating randomize breaks command.");
    if (isSelectedDayBlocked) {
      showError("Cannot randomize breaks on a blocked day.");
      return;
    }
    setIsProcessingCommand(true);
    try {
      await randomizeBreaks({ selectedDate: selectedDay, workdayStartTime: workdayStartTimeForSelectedDay, workdayEndTime: workdayEndTimeForSelectedDay, currentDbTasks: dbScheduledTasks });
      showSuccess("Breaks randomized!");
    } catch (e: any) {
      showError(`Randomize breaks failed: ${e.message}`);
      console.error("[SchedulerPage] Randomize breaks error:", e);
    } finally {
      setIsProcessingCommand(false);
    }
  }, [selectedDay, workdayStartTimeForSelectedDay, workdayEndTimeForSelectedDay, dbScheduledTasks, randomizeBreaks, isSelectedDayBlocked]);

  const handleRezone = useCallback(async (task: RetiredTask) => {
    console.log(`[SchedulerPage] Initiating re-zone for task: ${task.name}`);
    if (isSelectedDayBlocked) {
      showError("Cannot re-zone tasks to a blocked day.");
      return;
    }
    setIsProcessingCommand(true);
    try {
      const rezonedTaskData = await rezoneTask(task); // Use rezoneTask from useRetiredTasks
      if (rezonedTaskData) {
        // Calculate start and end times for the new scheduled task
        const duration = rezonedTaskData.duration || 30;
        const breakDuration = rezonedTaskData.break_duration || 0;
        const totalDuration = duration + breakDuration;
        
        const occupiedBlocks: TimeBlock[] = dbScheduledTasks.filter(t => t.start_time && t.end_time).map(t => ({
          start: parseISO(t.start_time!),
          end: parseISO(t.end_time!),
          duration: differenceInMinutes(parseISO(t.end_time!), parseISO(t.start_time!))
        }));
        const allConstraints = mergeOverlappingTimeBlocks([...occupiedBlocks, ...staticConstraints]);
        const searchStart = isBefore(workdayStartTimeForSelectedDay, T_current) && isSameDay(selectedDayAsDate, new Date()) ? T_current : workdayStartTimeForSelectedDay;
        const slot = findFirstAvailableSlot(totalDuration, allConstraints, searchStart, workdayEndTimeForSelectedDay);

        if (slot) {
          await addScheduledTask({
            name: rezonedTaskData.name,
            start_time: slot.start.toISOString(),
            end_time: slot.end.toISOString(),
            break_duration: rezonedTaskData.break_duration || null,
            scheduled_date: selectedDay,
            is_critical: rezonedTaskData.is_critical,
            is_flexible: true, // Re-zoned tasks are flexible by default
            is_locked: false,
            energy_cost: rezonedTaskData.energy_cost,
            task_environment: rezonedTaskData.task_environment,
            is_backburner: rezonedTaskData.is_backburner,
            is_work: rezonedTaskData.is_work,
            is_break: rezonedTaskData.is_break,
          });
          showSuccess(`Re-zoned "${rezonedTaskData.name}" to schedule!`);
        } else {
          showError(`No slot found for "${rezonedTaskData.name}" within constraints. Keeping in Sink.`);
          // If no slot, re-add to sink (or do nothing as it's not removed yet)
        }
      }
    } catch (e: any) {
      showError(`Failed to re-zone task: ${e.message}`);
      console.error("[SchedulerPage] Re-zone task error:", e);
    } finally {
      setIsProcessingCommand(false);
    }
  }, [rezoneTask, addScheduledTask, selectedDay, dbScheduledTasks, staticConstraints, workdayStartTimeForSelectedDay, workdayEndTimeForSelectedDay, T_current, selectedDayAsDate, isSelectedDayBlocked]);

  const handleRemoveRetired = useCallback(async (taskId: string) => {
    console.log(`[SchedulerPage] Removing retired task: ${taskId}`);
    setIsProcessingCommand(true);
    try {
      await removeRetiredTask(taskId); // Use removeRetiredTask from useRetiredTasks
      showSuccess("Task removed from Aether Sink.");
    } catch (e: any) {
      showError(`Failed to remove retired task: ${e.message}`);
      console.error("[SchedulerPage] Remove retired task error:", e);
    } finally {
      setIsProcessingCommand(false);
    }
  }, [removeRetiredTask]);

  const handleSortFlexibleTasks = useCallback(async (newSortBy: SortBy) => {
    console.log(`[SchedulerPage] Setting flexible tasks sort to: ${newSortBy}`);
    setSortBy(newSortBy);
    showSuccess(`Balance logic set to ${newSortBy.replace(/_/g, ' ').toLowerCase()}.`);
  }, [setSortBy]);

  const handleStartPodSession = useCallback(async (activityName: string, durationMinutes: number) => {
    console.log(`[SchedulerPage] Initiating start Regen Pod session for activity: ${activityName}, duration: ${durationMinutes} min.`);
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
            is_break: true, 
            is_work: false,
        });
        
        showSuccess("Regen Pod session started! Time to recharge. 🔋");
    } catch (e: any) {
        showError(`Failed to start Regen Pod: ${e.message}`);
        console.error("[SchedulerPage] Start Regen Pod error:", e);
    } finally {
        setIsProcessingCommand(false);
    }
  }, [user, profile, T_current, selectedDay, startRegenPodState, addScheduledTask, isSelectedDayBlocked]);

  const handleExitPodSession = useCallback(async () => {
    console.log("[SchedulerPage] Initiating exit Regen Pod session.");
    setIsProcessingCommand(true);
    try {
      await exitRegenPodState();
      setShowRegenPodSetup(false);
      showSuccess("Regen Pod session ended.");
    } catch (e: any) {
      showError(`Failed to exit Regen Pod: ${e.message}`);
      console.error("[SchedulerPage] Exit Regen Pod error:", e);
    } finally {
      setIsProcessingCommand(false);
    }
  }, [exitRegenPodState]);

  const handleQuickBreak = useCallback(async () => {
    console.log("[SchedulerPage] Initiating quick break command.");
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
        is_work: false,
      });
      showSuccess("Quick Break added! Time to recharge. ☕️");
    } catch (e: any) {
      showError(`Failed to add quick break: ${e.message}`);
      console.error("[SchedulerPage] Quick break error:", e);
    } finally {
      setIsProcessingCommand(false);
    }
  }, [user, profile, T_current, selectedDay, addScheduledTask, isSelectedDayBlocked]);

  const handleQuickScheduleBlock = useCallback(async (duration: number, sortPreference: 'longestFirst' | 'shortestFirst') => {
    console.log(`[SchedulerPage] Initiating quick schedule block: ${duration} min, sort: ${sortPreference}`);
    if (!user || !profile) return showError("Please log in.");
    if (isSelectedDayBlocked) {
      showError("Cannot schedule tasks on a blocked day.");
      return;
    }
    setIsProcessingCommand(true);
    try {
      const availableTasks = retiredTasks.filter(t => !t.is_locked && !t.is_completed);
      if (availableTasks.length === 0) {
        showError("No available tasks in Aether Sink to schedule.");
        return;
      }

      // Sort tasks based on preference
      const sortedTasks = [...availableTasks].sort((a, b) => {
        const durA = a.duration || 30;
        const durB = b.duration || 30;
        return sortPreference === 'shortestFirst' ? durA - durB : durB - durA;
      });

      let minutesToFill = duration;
      const tasksToInsert: NewDBScheduledTask[] = [];
      const retiredIdsToDelete: string[] = [];

      // Get current occupied blocks for the day
      const currentOccupiedBlocks: TimeBlock[] = dbScheduledTasks.filter(t => t.start_time && t.end_time).map(t => ({
        start: parseISO(t.start_time!),
        end: parseISO(t.end_time!),
        duration: differenceInMinutes(parseISO(t.end_time!), parseISO(t.start_time!))
      }));
      const allConstraints = mergeOverlappingTimeBlocks([...currentOccupiedBlocks, ...staticConstraints]);
      
      let currentPlacementCursor = isBefore(workdayStartTimeForSelectedDay, T_current) && isSameDay(selectedDayAsDate, new Date()) ? T_current : workdayStartTimeForSelectedDay;

      for (const task of sortedTasks) {
        if (minutesToFill <= 0) break;

        const taskTotalDuration = (task.duration || 30) + (task.break_duration || 0);

        // Find a slot for this specific task
        const slot = findFirstAvailableSlot(taskTotalDuration, allConstraints, currentPlacementCursor, workdayEndTimeForSelectedDay);

        if (slot && taskTotalDuration <= minutesToFill) { // Only take whole tasks that fit within the remaining block duration
          tasksToInsert.push({
            name: task.name,
            start_time: slot.start.toISOString(),
            end_time: slot.end.toISOString(),
            break_duration: task.break_duration || null,
            scheduled_date: selectedDay,
            is_critical: task.is_critical,
            is_flexible: true, // Tasks from sink are flexible by default
            is_locked: false,
            energy_cost: task.energy_cost,
            is_custom_energy_cost: task.is_custom_energy_cost,
            task_environment: task.task_environment,
            is_backburner: task.is_backburner,
            is_work: task.is_work,
            is_break: task.is_break,
          });
          retiredIdsToDelete.push(task.id);
          minutesToFill -= taskTotalDuration;

          // Update occupied blocks and cursor for subsequent placements
          allConstraints.push({ start: slot.start, end: slot.end, duration: taskTotalDuration });
          mergeOverlappingTimeBlocks(allConstraints); // Re-merge to keep it clean
          currentPlacementCursor = slot.end;
        }
      }

      if (tasksToInsert.length > 0) {
        // Instead of directly calling autoBalanceScheduleMutation, we can call handleAutoScheduleAndSort
        // with a specific payload to insert these tasks and delete from retired.
        // This ensures consistency with the auto-balance logic.
        await handleAutoScheduleAndSort(sortBy, 'sink-only', [], selectedDay); // This will re-evaluate and place tasks
        showSuccess(`Scheduled ${tasksToInsert.length} tasks for ${duration} minutes!`);
      } else {
        showError("Could not find suitable tasks or slots to fill the requested duration.");
      }

    } catch (e: any) {
      showError(`Quick schedule block failed: ${e.message}`);
      console.error("[SchedulerPage] Quick schedule block error:", e);
    } finally {
      setIsProcessingCommand(false);
    }
  }, [user, profile, retiredTasks, dbScheduledTasks, selectedDay, selectedDayAsDate, workdayStartTimeForSelectedDay, workdayEndTimeForSelectedDay, T_current, staticConstraints, handleAutoScheduleAndSort, sortBy, isSelectedDayBlocked]);

  const handleCommand = useCallback(async (input: string) => {
    console.log(`[SchedulerPage] Processing command input: "${input}"`);
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
          case 'clear': 
            await clearScheduledTasks(); 
            showSuccess("Schedule cleared!");
            break;
          case 'compact': 
            await handleCompact(); 
            showSuccess("Schedule compacted!");
            break;
          case 'aether dump': 
            await aetherDump(); 
            showSuccess("Today's flexible tasks moved to Aether Sink!");
            break;
          case 'aether dump mega': 
            await aetherDumpMega(); 
            showSuccess("All future flexible tasks moved to Aether Sink!");
            break;
          case 'break':
            await handleQuickBreak(); 
            break;
          default: 
            showError("Unknown engine command.");
            console.warn("[SchedulerPage] Unknown command type:", command.type);
        }
        setInputValue('');
        return;
      }

      const task = parseTaskInput(input, selectedDayAsDate);
      if (task) {
        if (task.shouldSink) {
          await addRetiredTask({ // Use addRetiredTask from useRetiredTasks
            user_id: user.id, 
            name: task.name, 
            duration: task.duration || 30, 
            break_duration: task.breakDuration || null, 
            original_scheduled_date: selectedDay, 
            is_critical: task.isCritical, 
            energy_cost: task.energyCost, 
            task_environment: environmentForPlacement, 
            is_backburner: task.isBackburner,
            is_work: task.isWork,
            is_break: task.isBreak,
          });
          showSuccess(`Task "${task.name}" sent to Aether Sink!`);
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
              is_work: task.isWork,
              is_break: task.isBreak,
            });
            showSuccess(`Scheduled "${task.name}" at ${format(slot.start, 'h:mm a')}!`);
          } else {
            showError(`No slot found for "${task.name}" within constraints. Sending to Sink.`);
            await addRetiredTask({ // Use addRetiredTask from useRetiredTasks
              user_id: user.id,
              name: task.name,
              duration: task.duration,
              break_duration: task.breakDuration || null,
              original_scheduled_date: selectedDay,
              is_critical: task.isCritical,
              energy_cost: task.energyCost,
              task_environment: environmentForPlacement,
              is_backburner: task.isBackburner,
              is_work: task.isWork,
              is_break: task.isBreak,
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
            is_work: task.isWork,
            is_break: task.isBreak,
          });
          showSuccess(`Fixed task "${task.name}" added to schedule!`);
        }
        setInputValue('');
      } else {
        showError("Invalid task format or command.");
        console.warn("[SchedulerPage] Invalid task format or command for input:", input);
      }
    } catch (e: any) {
      showError(`Command failed: ${e.message}`);
      console.error("[SchedulerPage] Command execution error:", e);
    } finally {
      setIsProcessingCommand(false);
    }
  }, [user, profile, selectedDay, selectedDayAsDate, clearScheduledTasks, handleCompact, aetherDump, aetherDumpMega, T_current, addScheduledTask, addRetiredTask, environmentForPlacement, dbScheduledTasks, workdayStartTimeForSelectedDay, workdayEndTimeForSelectedDay, staticConstraints, isSelectedDayBlocked, handleQuickBreak]);

  const handleSchedulerAction = useCallback(async (action: 'complete' | 'skip' | 'exitFocus', task: DBScheduledTask) => {
    console.log(`[SchedulerPage] Performing scheduler action: ${action} for task: ${task.name}`);
    setIsProcessingCommand(true);
    try {
      if (action === 'complete') {
        await completeScheduledTaskMutation(task);
        await rechargeEnergy(-(task.energy_cost));
        showSuccess(`Objective synchronized: +${task.energy_cost * 2} XP`);
      } else if (action === 'skip') {
        await retireTask(task);
        showSuccess(`Objective "${task.name}" moved to Aether Sink.`);
      } else if (action === 'exitFocus') {
        setIsFocusModeActive(false);
      }
    } catch (e: any) {
      showError(`Action failed: ${e.message}`);
      console.error("[SchedulerPage] Scheduler action error:", e);
    } finally {
      setIsProcessingCommand(false);
    }
  }, [completeScheduledTaskMutation, rechargeEnergy, retireTask]);

  const handleDetailedInject = useCallback(() => {
    console.log("[SchedulerPage] Opening detailed inject dialog.");
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
    console.log(`[SchedulerPage] Free time clicked: ${format(startTime, 'HH:mm')}-${format(endTime, 'HH:mm')}`);
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
    console.log(`[SchedulerPage] Toggling day lock for ${selectedDay}. Current state: ${isDayLockedDown}`);
    if (isSelectedDayBlocked) {
      showError("Cannot lock/unlock tasks on a blocked day.");
      return;
    }
    setIsProcessingCommand(true);
    try {
      await toggleAllScheduledTasksLock({ selectedDate: selectedDay, lockState: !isDayLockedDown });
      showSuccess(isDayLockedDown ? "Day unlocked!" : "Day locked down!");
    } catch (e: any) {
      showError(`Failed to toggle day lock: ${e.message}`);
      console.error("[SchedulerPage] Toggle day lock error:", e);
    } finally {
      setIsProcessingCommand(false);
    }
  }, [selectedDay, isDayLockedDown, toggleAllScheduledTasksLock, isSelectedDayBlocked]);

  const overallLoading = isSessionLoading || isSchedulerTasksLoading || isProcessingCommand || isLoadingRetiredTasks || isLoadingDatesWithTasks || isLoadingCompletedTasksForSelectedDay;

  // CRITICAL FIX: Memoize the calculated schedule object to prevent reference churn
  // The schedule calculation itself should not depend on T_current for its structure,
  // only for the 'active' status of items.
  const calculatedSchedule = useMemo(() => {
    if (!profile) {
      console.log("[SchedulerPage] Profile not available for schedule calculation.");
      return null;
    }
    console.log("[SchedulerPage] Recalculating schedule with latest data.");
    const start = profile.default_auto_schedule_start_time ? setTimeOnDate(startOfDay(selectedDayAsDate), profile.default_auto_schedule_start_time) : startOfDay(selectedDayAsDate);
    let end = profile.default_auto_schedule_end_time ? setTimeOnDate(startOfDay(selectedDayAsDate), profile.default_auto_schedule_end_time) : addHours(startOfDay(selectedDayAsDate), 17);
    if (isBefore(end, start)) end = addDays(end, 1);

    // Pass a stable `startOfDay(T_current)` for structural calculation,
    // but `T_current` itself is still passed to `SchedulerDisplay` for live updates.
    return calculateSchedule(dbScheduledTasks, selectedDay, start, end, profile.is_in_regen_pod, profile.regen_pod_start_time ? parseISO(profile.regen_pod_start_time) : null, regenPodDurationMinutes, startOfDay(T_current), profile.breakfast_time, profile.lunch_time, profile.dinner_time, profile.breakfast_duration_minutes, profile.lunch_duration_minutes, profile.dinner_duration_minutes, profile.reflection_count, profile.reflection_times, profile.reflection_durations, mealAssignments, isSelectedDayBlocked);
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
            onQuickScheduleBlock={handleQuickScheduleBlock} // Pass the new handler
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
              T_current={T_current} // T_current is still passed here for live updates of the "now" line
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