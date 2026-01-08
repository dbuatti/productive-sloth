"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { format, isBefore, addMinutes, parseISO, isSameDay, startOfDay, addHours, addDays, differenceInMinutes, max, min, isAfter } from 'date-fns';
import { ListTodo, Loader2, Cpu, Zap, Clock, Trash2, Archive, Target, Database, CalendarOff } from 'lucide-react'; // NEW: Import CalendarOff
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
import { Button } from '@/components/ui/button'; // NEW: Import Button
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import { useSession } from '@/hooks/use-session';
import SchedulerDashboardPanel from '@/components/SchedulerDashboardPanel';
import NowFocusCard from '@/components/NowFocusCard';
import CalendarStrip from '@/components/CalendarStrip';
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
import { cn } from '@/lib/utils';
import EnergyRegenPodModal from '@/components/EnergyRegenPodModal'; 
import { REGEN_POD_MAX_DURATION_MINUTES } from '@/lib/constants'; 
import { useNavigate } from 'react-router-dom';
import AetherSink from '@/components/AetherSink';
import CreateTaskDialog from '@/components/CreateTaskDialog';

const SchedulerPage: React.FC<{ view: 'schedule' | 'sink' | 'recap' }> = ({ view }) => {
  const { user, profile, isLoading: isSessionLoading, rechargeEnergy, T_current, activeItemToday, nextItemToday, startRegenPodState, exitRegenPodState, regenPodDurationMinutes } = useSession();
  const { selectedEnvironments } = useEnvironmentContext();
  const environmentForPlacement = selectedEnvironments[0] || 'laptop';
  
  const [selectedDay, setSelectedDay] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const scheduleContainerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

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
    removeRetiredTask, // This is the one we need to adjust
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

  useEffect(() => {
    if (isRegenPodRunning) {
      setShowRegenPodSetup(true);
    }
  }, [isRegenPodRunning]);

  const getStaticConstraints = useCallback((): TimeBlock[] => {
    if (!profile) return [];
    const constraints: TimeBlock[] = [];
    const addConstraint = (name: string, timeStr: string | null, duration: number | null) => {
      const effectiveDuration = (duration !== null && duration !== undefined && !isNaN(duration)) ? duration : 15;

      if (timeStr && effectiveDuration > 0) {
        let anchorStart = setTimeOnDate(selectedDayAsDate, timeStr);
        let anchorEnd = addMinutes(anchorStart, effectiveDuration);

        if (isBefore(anchorEnd, anchorStart)) anchorEnd = addDays(anchorEnd, 1);
        
        const overlaps = (isBefore(anchorEnd, workdayEndTimeForSelectedDay) || anchorEnd.getTime() === workdayEndTimeForSelectedDay.getTime()) && 
                         (isAfter(anchorStart, workdayStartTimeForSelectedDay) || anchorStart.getTime() === workdayStartTimeForSelectedDay.getTime());
        
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
    if (profile?.blocked_days?.includes(selectedDay)) {
      showError("Cannot auto-schedule on a blocked day.");
      return;
    }
    await handleAutoScheduleAndSort(sortBy, 'sink-to-gaps', [], selectedDay);
  }, [handleAutoScheduleAndSort, selectedDay, sortBy, profile?.blocked_days]);

  const handleReshuffleEverything = useCallback(async () => {
    if (profile?.blocked_days?.includes(selectedDay)) {
      showError("Cannot reshuffle on a blocked day.");
      return;
    }
    await handleAutoScheduleAndSort(sortBy, 'all-flexible', [], selectedDay);
  }, [handleAutoScheduleAndSort, selectedDay, sortBy, profile?.blocked_days]);

  const handleZoneFocus = useCallback(async () => {
    if (profile?.blocked_days?.includes(selectedDay)) {
      showError("Cannot zone focus on a blocked day.");
      return;
    }
    await handleAutoScheduleAndSort(sortBy, 'sink-only', selectedEnvironments, selectedDay);
  }, [handleAutoScheduleAndSort, selectedEnvironments, selectedDay, sortBy, profile?.blocked_days]);

  const handleCompact = useCallback(async () => {
    if (profile?.blocked_days?.includes(selectedDay)) {
      showError("Cannot compact schedule on a blocked day.");
      return;
    }
    const tasksToUpdate = compactScheduleLogic(dbScheduledTasks, selectedDayAsDate, workdayStartTimeForSelectedDay, workdayEndTimeForSelectedDay, T_current, profile);
    await compactScheduledTasks({ tasksToUpdate });
  }, [dbScheduledTasks, selectedDayAsDate, workdayStartTimeForSelectedDay, workdayEndTimeForSelectedDay, T_current, compactScheduledTasks, profile]);

  const handleRandomize = useCallback(async () => {
    if (profile?.blocked_days?.includes(selectedDay)) {
      showError("Cannot randomize breaks on a blocked day.");
      return;
    }
    await randomizeBreaks({ selectedDate: selectedDay, workdayStartTime: workdayStartTimeForSelectedDay, workdayEndTime: workdayEndTimeForSelectedDay, currentDbTasks: dbScheduledTasks });
  }, [selectedDay, workdayStartTimeForSelectedDay, workdayEndTimeForSelectedDay, dbScheduledTasks, randomizeBreaks, profile?.blocked_days]);

  const handleRezone = useCallback(async (task: RetiredTask) => {
    if (profile?.blocked_days?.includes(selectedDay)) {
      showError("Cannot re-zone tasks to a blocked day.");
      return;
    }
    await rezoneTask(task);
  }, [rezoneTask, profile?.blocked_days, selectedDay]);

  const handleRemoveRetired = useCallback(async (taskId: string, taskName: string) => { // Added taskName
    await removeRetiredTask(taskId, taskName); // Pass taskName
  }, [removeRetiredTask]);

  const handleSortFlexibleTasks = useCallback(async (newSortBy: SortBy) => {
    setSortBy(newSortBy);
    showSuccess(`Balance logic set to ${newSortBy.replace(/_/g, ' ').toLowerCase()}.`);
  }, [setSortBy]);

  const handleStartPodSession = useCallback(async (activityName: string, activityDuration: number) => {
    if (!user || !profile) return;
    if (profile?.blocked_days?.includes(selectedDay)) {
      showError("Cannot start Regen Pod on a blocked day.");
      return;
    }
    setIsProcessingCommand(true);
    try {
        await startRegenPodState(activityDuration); 
        
        const start = T_current;
        const end = addMinutes(start, activityDuration);
        
        await addScheduledTask({
            name: `Regen Pod: ${activityName}`,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            break_duration: activityDuration,
            scheduled_date: selectedDay,
            is_critical: false,
            is_flexible: false, 
            is_locked: true, 
            energy_cost: 0, 
            task_environment: 'away', 
        });
        
        showSuccess(`Regen Pod activated for ${activityDuration} minutes!`);
    } catch (e: any) {
        showError(`Failed to start Regen Pod: ${e.message}`);
    } finally {
        setIsProcessingCommand(false);
    }
  }, [user, profile, T_current, selectedDay, startRegenPodState, addScheduledTask, profile?.blocked_days]);

  const handleExitPodSession = useCallback(async () => {
    await exitRegenPodState();
    setShowRegenPodSetup(false);
  }, [exitRegenPodState]);


  const handleCommand = useCallback(async (input: string) => {
    if (!user || !profile) return showError("Please log in.");
    if (profile?.blocked_days?.includes(selectedDay)) {
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
          console.log(`[QuickAdd] Processing: "${task.name}" (${task.duration}m)`);
          
          const occupiedBlocks: TimeBlock[] = dbScheduledTasks.filter(t => t.start_time && t.end_time).map(t => ({
            start: parseISO(t.start_time!),
            end: parseISO(t.end_time!),
            duration: differenceInMinutes(parseISO(t.end_time!), parseISO(t.start_time!))
          }));
          
          const staticConstraints = getStaticConstraints();
          
          const allConstraints = mergeOverlappingTimeBlocks([...occupiedBlocks, ...staticConstraints]);
          console.log(`[QuickAdd] Total Constraints: ${allConstraints.length} blocks`);
          allConstraints.forEach(c => console.log(`[QuickAdd] Constraint: ${format(c.start, 'HH:mm')}-${format(c.end, 'HH:mm')}`));

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
            is_locked<dyad-problem-report summary="16 problems">
<problem file="src/hooks/use-session.ts" line="413" column="30" code="1005">'&gt;' expected.</problem>
<problem file="src/hooks/use-session.ts" line="413" column="35" code="1005">')' expected.</problem>
<problem file="src/hooks/use-session.ts" line="414" column="8" code="1136">Property assignment expected.</problem>
<problem file="src/hooks/use-session.ts" line="414" column="9" code="1005">';' expected.</problem>
<problem file="src/hooks/use-session.ts" line="415" column="6" code="1110">Type expected.</problem>
<problem file="src/hooks/use-session.ts" line="416" column="3" code="1128">Declaration or statement expected.</problem>
<problem file="src/hooks/use-session.ts" line="417" column="1" code="1128">Declaration or statement expected.</problem>
<problem file="src/lib/scheduler-utils.ts" line="1097" column="30" code="2552">Cannot find name 'midnightRoloverMessage'. Did you mean 'midnightRolloverMessage'?</problem>
<problem file="src/hooks/use-session.ts" line="48" column="29" code="2304">Cannot find name 'TaskEnvironment'.</problem>
<problem file="src/hooks/use-session.ts" line="413" column="6" code="2503">Cannot find namespace 'SessionContext'.</problem>
<problem file="src/hooks/use-session.ts" line="413" column="30" code="2304">Cannot find name 'value'.</problem>
<problem file="src/hooks/use-session.ts" line="413" column="36" code="2365">Operator '&gt;' cannot be applied to types '{ contextValue: { session: Session; user: User; profile: UserProfile; isLoading: boolean; refreshProfile: () =&gt; Promise&lt;void&gt;; rechargeEnergy: (amount?: number) =&gt; Promise&lt;...&gt;; ... 15 more ...; regenPodDurationMinutes: number; }; }' and '{}'.</problem>
<problem file="src/components/SessionProvider.tsx" line="283" column="12" code="2554">Expected 19 arguments, but got 18.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="488" column="34" code="2304">Cannot find name 'Button'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="488" column="144" code="2304">Cannot find name 'Button'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="542" column="50" code="2552">Cannot find name 'onRemoveRetiredTask'. Did you mean 'removeRetiredTask'?</problem>
</dyad-problem-report><think>**Debugging TypeScript Errors**

I'm currently focused on addressing the barrage of TypeScript errors, starting with the `src/hooks/use-session.ts` file. Right now I am looking at the '>' expected error and the related problems. I plan to tackle each reported issue methodically, resolving them one by one to achieve a clean compile. I'm focusing on the first issue as a pathfinder.


**Fixing the JSX Structure**

My focus has shifted to the JSX structure within `SessionProvider`. I'm seeing a cluster of syntax errors (TS1005, etc.) pointing to a malformed return statement in `use-session.ts`. I believe I mistakenly removed the necessary wrapper, likely `React.Fragment`, during an earlier attempt to resolve another issue. It seems `SessionContext.Provider` needs a root element. I will re-implement the  `SessionProvider` return with a clean JSX structure, ensuring a single JSX element is returned, resolving the reported issues.


**Identifying Further Issues**

I've moved on to scrutinizing more errors beyond the initial JSX structural problems. I've pinpointed a typo, `midnightRoloverMessage`, which needs correction. Additionally, I am currently investigating a 'Cannot find name `TaskEnvironment`' error in `use-session.ts`, that I will solve next. I am also working on the remaining issues as they appear.


**Prioritizing & Fixing Errors**

I'm now prioritizing the fixes based on the error messages. It seems like the JSX structure, particularly the malformed `SessionContext.Provider`, is the root cause of many issues. I'll correct the return statement in `src/components/SessionProvider.tsx` to include the missing closing tag and ensure a single root element. Next, I will address the typo in `src/lib/scheduler-utils.ts` and the missing import for `TaskEnvironment`. Then, I'll focus on passing the missing `profile` argument to `calculateSchedule` in `src/components/SessionProvider.tsx`, now that the issue has been isolated.


**Addressing Compile Errors**

I've got a comprehensive plan to eliminate these compiler errors. First, the initial batch of JSX errors, specifically the ones in `use-session.ts` are due to a missing closing tag for `SessionContext.Provider`. I'll immediately correct this by ensuring the closing tag is present. The plan also includes fixing the `midnightRoloverMessage` typo, importing `TaskEnvironment`, and adding the missing `profile` argument to `calculateSchedule`. I'll also add the necessary imports to the SchedulerPage. Finally I'll replace onRemoveRetiredTask with removeRetiredTask.


**Resolving Compile Issues**

I'm now implementing the comprehensive plan for all 16 TypeScript errors. I've started by fixing the JSX structure in `src/hooks/use-session.ts` and `src/components/SessionProvider.tsx` to include the closing `SessionContext.Provider` tag, which resolves several errors. I will ensure correct imports for `React` and `date-fns` in `use-session.ts`, following existing code. Then, I am updating `midnightRoloverMessage` to `midnightRolloverMessage` and importing `TaskEnvironment` in `use-session.ts` and the needed fixes. I'll also add the `profile` argument to `calculateSchedule` in `src/components/SessionProvider.tsx`, import Button in SchedulerPage, and correct onRemoveRetiredTask. Finally, I will address the BlockedDaysSettings.tsx fixes for lucide-react imports and onSelect compatibility.


**Rectifying Compiler Issues**

I'm now methodically addressing the reported 16 TypeScript errors. I've started by correcting the JSX structure within `SessionProvider` in both `use-session.ts` and `SessionProvider.tsx`, ensuring proper closing tags and root element structure. I'm also adding all the required imports to `use-session.ts` for `React` and `date-fns`, and fixing the typo `midnightRoloverMessage`. I'm next adding the missing `profile` argument to `calculateSchedule`, importing `Button` in `SchedulerPage.tsx` and replacing `onRemoveRetiredTask`. I'm also addressing the BlockedDaysSettings.tsx fixes for lucide-react imports and onSelect compatibility.


</think>It looks like we have a few core issues causing these TypeScript errors, primarily related to missing imports for React hooks and `date-fns` utilities in `use-session.ts`, a typo in `scheduler-utils.ts`, and some minor prop/import corrections in other components.

Here's how I'll address them:

1.  **`src/hooks/use-session.ts`**:
    *   I'll ensure all necessary React hooks (`useState`, `useEffect`, `useCallback`, `useMemo`, `useRef`), `react-router-dom` hooks (`useNavigate`, `useLocation`), `react-query` hooks (`useQueryClient`, `useQuery`), `date-fns` utilities, `supabase` client, and other helper functions/constants are correctly imported.
    *   I'll also add the missing `TaskEnvironment` import.
    *   The JSX syntax errors (1-7, 10-12) indicate a malformed `SessionContext.Provider` return. I'll correct the closing tag to ensure it's valid JSX.

2.  **`src/lib/scheduler-utils.ts`**:
    *   I'll correct the typo `midnightRoloverMessage` to `midnightRolloverMessage` in the `ScheduleSummary` interface and where it's assigned.

3.  **`src/components/SessionProvider.tsx`**:
    *   This file appears to be a duplicate of `src/hooks/use-session.ts`. I'll apply the same comprehensive fixes to this file, including the missing `profile` argument in the `calculateSchedule` call.

4.  **`src/components/BlockedDaysSettings.tsx`**:
    *   I'll correct the import for `lucide-react` as `Block` is not an exported member (it should be `CalendarOff`).
    *   The `onSelect` prop for `Calendar` expects `SelectMultipleEventHandler`, which takes an array of `Date` objects. The current handler is correct, so this might be a stale error, but I'll ensure the type is explicitly handled.

5.  **`src/pages/SettingsPage.tsx`**:
    *   I'll correct the import path for `useForm` from `@hookform/resolvers/zod` to `react-hook-form`.
    *   I'll ensure the `CalendarOff` icon is correctly imported.

6.  **`src/pages/SchedulerPage.tsx`**:
    *   I'll add the missing `Button` import.
    *   I'll correct the typo in the `onRemoveRetiredTask` prop to `removeRetiredTask`.

7.  **`src/pages/DocumentationPage.tsx`**:
    *   I'll ensure `EMOJI_HUE_MAP` is correctly imported from `src/lib/scheduler-utils.ts`.

Let's start by fixing `src/hooks/use-session.ts`.

<dyad-write path="src/hooks/use-session.ts" description="Fixing imports and JSX structure in use-session.ts.">
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';
import { showSuccess, showError } from '@/utils/toast';
import { isToday, parseISO, isPast, addMinutes, startOfDay, isBefore, addDays, addHours, differenceInMinutes, format } from 'date-fns';
import { MAX_ENERGY, RECHARGE_BUTTON_AMOUNT, LOW_ENERGY_THRESHOLD, LOW_ENERGY_NOTIFICATION_COOLDOWN_MINUTES, DAILY_CHALLENGE_TASKS_REQUIRED, REGEN_POD_MAX_DURATION_MINUTES, } from '@/lib/constants';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DBScheduledTask, ScheduledItem, TaskEnvironment } from '@/types/scheduler'; // Import TaskEnvironment
import { calculateSchedule, setTimeOnDate } from '@/lib/scheduler-utils';
import { useEnvironmentContext } from '@/hooks/use-environment-context';
import { MealAssignment } from '@/hooks/use-meals';
import isEqual from 'lodash.isequal'; // Import isEqual for deep comparison

const SUPABASE_PROJECT_ID = "yfgapigmiyclgryqdgne";
const SUPABASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co`;

export interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  xp: number;
  level: number;
  daily_streak: number;
  last_streak_update: string | null;
  energy: number;
  last_daily_reward_claim: string | null;
  last_daily_reward_notification: string | null;
  last_low_energy_notification: string | null;
  tasks_completed_today: number;
  enable_daily_challenge_notifications: boolean;
  enable_low_energy_notifications: boolean;
  daily_challenge_target: number;
  default_auto_schedule_start_time: string | null;
  default_auto_schedule_end_time: string | null;
  enable_delete_hotkeys: boolean;
  enable_aethersink_backup: boolean;
  last_energy_regen_at: string | null;
  is_in_regen_pod: boolean;
  regen_pod_start_time: string | null;
  breakfast_time: string | null;
  lunch_time: string | null;
  dinner_time: string | null;
  breakfast_duration_minutes: number | null;
  lunch_duration_minutes: number | null;
  dinner_duration_minutes: number | null;
  custom_environment_order: TaskEnvironment[] | null; // NEW: Custom order for environment sorting
  enable_environment_chunking: boolean; // NEW: Toggle for AA, BB vs AB, AB
  enable_macro_spread: boolean; // NEW: Split chunks into two sessions per day
  // NEW: Reflection Point configurations
  reflection_count: number;
  reflection_times: string[];
  reflection_durations: number[];
  week_starts_on: number; // NEW: 0 for Sunday, 1 for Monday
  num_days_visible: number; // NEW: For Simplified Schedule view preference
  vertical_zoom_index: number; // NEW: For Simplified Schedule view preference
  is_dashboard_collapsed: boolean; // NEW: Dashboard collapsed state
  is_action_center_collapsed: boolean; // NEW: Action Center collapsed state
  updated_at: string; // NEW: Added updated_at
  blocked_days: string[] | null; // NEW: Added blocked_days
}

interface SessionContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
  rechargeEnergy: (amount?: number) => Promise<void>;
  showLevelUp: boolean;
  levelUpLevel: number;
  triggerLevelUp: (level: number) => void;
  resetLevelUp: () => void;
  resetDailyStreak: () => Promise<void>;
  claimDailyReward: (xpAmount: number, energyAmount: number) => Promise<void>;
  updateNotificationPreferences: (preferences: { enable_daily_challenge_notifications?: boolean; enable_low_energy_notifications?: boolean }) => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  updateSettings: (updates: Partial<UserProfile>) => Promise<void>;
  activeItemToday: ScheduledItem | null;
  nextItemToday: ScheduledItem | null;
  T_current: Date;
  startRegenPodState: (durationMinutes: number) => Promise<void>;
  exitRegenPodState: () => Promise<void>;
  regenPodDurationMinutes: number;
  triggerEnergyRegen: () => Promise<void>;
}

export const SessionContext = React.createContext<SessionContextType | undefined>(undefined);

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpLevel, setLevelUpLevel] = useState(0);
  const [T_current, setT_current] = useState(new Date());
  const [regenPodDurationMinutes, setRegenPodDurationMinutes] = useState(0);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { selectedEnvironments } = useEnvironmentContext();
  const initialSessionLoadedRef = useRef(false);
  const isLoading = isAuthLoading || isProfileLoading;
  const todayString = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    const interval = setInterval(() => setT_current(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Use a ref to hold the latest profile for deep comparison in useCallback
  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const fetchProfile = useCallback(async (userId: string) => {
    setIsProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id, first_name, last_name, avatar_url, xp, level, daily_streak, last_streak_update, energy, 
          last_daily_reward_claim, last_daily_reward_notification, last_low_energy_notification, 
          tasks_completed_today, enable_daily_challenge_notifications, enable_low_energy_notifications, 
          daily_challenge_target, default_auto_schedule_start_time, default_auto_schedule_end_time, 
          enable_delete_hotkeys, enable_aethersink_backup, last_energy_regen_at, is_in_regen_pod, 
          regen_pod_start_time, breakfast_time, lunch_time, dinner_time, breakfast_duration_minutes, 
          lunch_duration_minutes, dinner_duration_minutes, custom_environment_order, reflection_count, 
          reflection_times, reflection_durations, enable_environment_chunking, enable_macro_spread, 
          week_starts_on, num_days_visible, vertical_zoom_index, is_dashboard_collapsed, 
          is_action_center_collapsed, updated_at, blocked_days
        `)
        .eq('id', userId)
        .single();

      if (error) {
        setProfile(null);
      } else if (data) {
        // Create a copy of data without 'updated_at' for comparison
        const dataWithoutUpdatedAt = { ...data };
        delete dataWithoutUpdatedAt.updated_at;

        const currentProfileWithoutUpdatedAt = profileRef.current ? { ...profileRef.current } : null;
        if (currentProfileWithoutUpdatedAt) delete currentProfileWithoutUpdatedAt.updated_at;

        // Only update profile state if there's a meaningful change (excluding updated_at)
        if (!isEqual(currentProfileWithoutUpdatedAt, dataWithoutUpdatedAt)) {
          setProfile(data as UserProfile); // Still set the full profile with updated_at
        }
        if (data.is_in_regen_pod && data.regen_pod_start_time) {
          const start = parseISO(data.regen_pod_start_time);
          const elapsed = differenceInMinutes(new Date(), start);
          const remaining = REGEN_POD_MAX_DURATION_MINUTES - elapsed;
          setRegenPodDurationMinutes(Math.max(0, remaining));
        } else {
          setRegenPodDurationMinutes(0);
        }
      }
    } catch (e) {
      setProfile(null);
    } finally {
      setIsProfileLoading(false);
    }
  }, []); // No 'profile' in dependencies here, as we use profileRef.current

  const refreshProfile = useCallback(async () => {
    if (user?.id) await fetchProfile(user.id);
  }, [user?.id, fetchProfile]);

  const rechargeEnergy = useCallback(async (amount: number = RECHARGE_BUTTON_AMOUNT) => {
    if (!user || !profile) return;
    const newEnergy = Math.min(MAX_ENERGY, profile.energy + amount);
    const { error } = await supabase.from('profiles').update({ energy: newEnergy }).eq('id', user.id);
    if (!error) await refreshProfile();
  }, [user, profile, refreshProfile]);

  const triggerLevelUp = useCallback((level: number) => {
    setShowLevelUp(true);
    setLevelUpLevel(level);
  }, []);

  const resetLevelUp = useCallback(() => {
    setShowLevelUp(false);
    setLevelUpLevel(0);
  }, []);

  const resetDailyStreak = useCallback(async () => {
    if (!user) return;
    const { error } = await supabase.from('profiles').update({ daily_streak: 0, last_streak_update: null }).eq('id', user.id);
    if (!error) await refreshProfile();
  }, [user, refreshProfile]);

  const claimDailyReward = useCallback(async (xpAmount: number, energyAmount: number) => {
    if (!user || !profile) return;
    const newXp = profile.xp + xpAmount;
    const newEnergy = Math.min(MAX_ENERGY, profile.energy + energyAmount);
    const { error } = await supabase.from('profiles').update({ xp: newXp, energy: newEnergy, last_daily_reward_claim: new Date().toISOString() }).eq('id', user.id);
    if (!error) {
      await refreshProfile();
      showSuccess("Reward claimed!");
    }
  }, [user, profile, refreshProfile]);

  const updateNotificationPreferences = useCallback(async (preferences: any) => {
    if (!user) return;
    const { error } = await supabase.from('profiles').update(preferences).eq('id', user.id);
    if (!error) await refreshProfile();
  }, [user, refreshProfile]);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!user) return;
    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
    if (!error) await refreshProfile();
  }, [user, refreshProfile]);

  const updateSettings = useCallback(async (updates: Partial<UserProfile>) => {
    if (!user) return;
    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
    if (!error) await refreshProfile();
  }, [user, refreshProfile]);

  const triggerEnergyRegen = useCallback(async () => {
    if (!user) return;
    await supabase.functions.invoke('trigger-energy-regen');
    await refreshProfile();
  }, [user, refreshProfile]);

  const startRegenPodState = useCallback(async (durationMinutes: number) => {
    if (!user) return;
    setRegenPodDurationMinutes(durationMinutes);
    await supabase.from('profiles').update({ is_in_regen_pod: true, regen_pod_start_time: new Date().toISOString() }).eq('id', user.id);
    await refreshProfile();
  }, [user, refreshProfile]);

  const exitRegenPodState = useCallback(async () => {
    if (!user || !profile?.is_in_regen_pod) return;
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/calculate-pod-exit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          startTime: profile.regen_pod_start_time,
          endTime: new Date().toISOString()
        }),
      });
    } finally {
      await supabase.from('profiles').update({ is_in_regen_pod: false, regen_pod_start_time: null }).eq('id', user.id);
      await refreshProfile();
      setRegenPodDurationMinutes(0);
    }
  }, [user, profile, refreshProfile, session?.access_token]);

  // Memoize the handler for auth state changes
  const handleAuthChange = useCallback(async (event: string, currentSession: Session | null) => {
    console.log("[SessionProvider] Auth state change event:", event);
    setSession(currentSession);
    setUser(currentSession?.user ?? null);
    
    if (currentSession?.user) {
      await fetchProfile(currentSession.user.id);
      // Redirection logic for /login after sign-in is now handled by the useEffect below
    } else if (event === 'SIGNED_OUT') {
      setProfile(null);
      queryClient.clear();
      setRedirectPath('/login');
    }
  }, [fetchProfile, queryClient]); // Removed location.pathname from dependencies

  // Effect to set up the Supabase auth listener once
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, currentSession) => {
      handleAuthChange(event, currentSession);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [handleAuthChange]); // Dependency on handleAuthChange ensures it uses the latest memoized version

  // Effect to load the initial session once
  useEffect(() => {
    const loadInitialSession = async () => {
      if (initialSessionLoadedRef.current) return;
      initialSessionLoadedRef.current = true;
      
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        
        if (initialSession?.user) {
          await fetchProfile(initialSession.user.id);
          // Redirection logic for /login after sign-in is now handled by the useEffect below
        } else if (location.pathname !== '/login') {
          setRedirectPath('/login');
        }
      } finally {
        setIsAuthLoading(false);
      }
    };

    loadInitialSession();
  }, [fetchProfile, queryClient, location.pathname]); // Dependencies for loadInitialSession

  useEffect(() => {
    if (!isAuthLoading && redirectPath && location.pathname !== redirectPath) {
      navigate(redirectPath, { replace: true });
      setRedirectPath(null);
    }
    // NEW: Handle redirection after successful login if currently on /login
    if (!isAuthLoading && user && location.pathname === '/login') {
      setRedirectPath('/');
    }
  }, [redirectPath, navigate, location.pathname, isAuthLoading, user]);

  const { data: dbScheduledTasksToday = [] } = useQuery<DBScheduledTask[]>({
    queryKey: ['scheduledTasksToday', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase.from('scheduled_tasks').select('*')
        .eq('user_id', user.id).eq('scheduled_date', todayString);
      return data as DBScheduledTask[];
    },
    enabled: !!user?.id && !isAuthLoading,
  });

  // NEW: Fetch meal assignments for today
  const { data: mealAssignmentsToday = [] } = useQuery<MealAssignment[]>({
    queryKey: ['mealAssignmentsToday', user?.id, todayString],
    queryFn: async () => {
      if (!user?.id || !todayString) return [];
      const { data, error } = await supabase
        .from('meal_assignments')
        .select('*, meal_idea:meal_ideas(*)')
        .eq('assigned_date', todayString)
        .eq('user_id', user.id);
      if (error) throw error;
      return data as MealAssignment[];
    },
    enabled: !!user?.id && !isAuthLoading,
  });

  const calculatedScheduleToday = useMemo(() => {
    if (!profile) return null;
    const start = profile.default_auto_schedule_start_time ? setTimeOnDate(startOfDay(T_current), profile.default_auto_schedule_start_time) : startOfDay(T_current);
    let end = profile.default_auto_schedule_end_time ? setTimeOnDate(startOfDay(T_current), profile.default_auto_schedule_end_time) : addHours(startOfDay(T_current), 17);
    if (isBefore(end, start)) end = addDays(end, 1);
    return calculateSchedule(
      dbScheduledTasksToday,
      todayString,
      start,
      end,
      profile.is_in_regen_pod,
      profile.regen_pod_start_time ? parseISO(profile.regen_pod_start_time) : null,
      regenPodDurationMinutes,
      T_current,
      profile.breakfast_time,
      profile.lunch_time,
      profile.dinner_time,
      profile.breakfast_duration_minutes,
      profile.lunch_duration_minutes,
      profile.dinner_duration_minutes,
      profile.reflection_count,
      profile.reflection_times,
      profile.reflection_durations,
      mealAssignmentsToday, // PASS MEAL ASSIGNMENTS
      profile // Pass the profile object
    );
  }, [dbScheduledTasksToday, profile, regenPodDurationMinutes, T_current, mealAssignmentsToday, todayString]);

  const activeItemToday = useMemo(() => calculatedScheduleToday?.items.find(i => T_current >= i.startTime && T_current < i.endTime) || null, [calculatedScheduleToday, T_current]);

  const nextItemToday = useMemo(() => calculatedScheduleToday?.items.find(i => i.startTime > T_current) || null, [calculatedScheduleToday, T_current]);

  const contextValue = useMemo(() => ({
    session, 
    user, 
    profile, 
    isLoading, 
    refreshProfile, 
    rechargeEnergy, 
    showLevelUp, 
    levelUpLevel, 
    triggerLevelUp, 
    resetLevelUp, 
    resetDailyStreak, 
    claimDailyReward, 
    updateNotificationPreferences, 
    updateProfile, 
    updateSettings,
    triggerEnergyRegen,
    activeItemToday,
    nextItemToday,
    T_current,
    startRegenPodState,
    exitRegenPodState,
    regenPodDurationMinutes
  }), [
    session, user, profile, isLoading, refreshProfile, rechargeEnergy, showLevelUp, levelUpLevel, 
    triggerLevelUp, resetLevelUp, resetDailyStreak, claimDailyReward, updateNotificationPreferences, 
    updateProfile, updateSettings, triggerEnergyRegen, activeItemToday, nextItemToday, T_current, 
    startRegenPodState, exitRegenPodState, regenPodDurationMinutes
  ]);

  return (
    <SessionContext.Provider value={contextValue}>
      {!isAuthLoading ? children : null}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = React.useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};