import { format, parseISO, setHours, setMinutes, addMinutes, isBefore, addDays, isSameDay, startOfDay, differenceInMinutes, isAfter, isPast, parse, addHours } from 'date-fns'; // Added parse, addHours
import { DBScheduledTask, ScheduledItem, TimeBlock, FormattedSchedule, TaskEnvironment, TaskPriority, NewDBScheduledTask, NewRetiredTask } from '@/types/scheduler';
import { Home, Laptop, Globe, Music, Star, Utensils } from 'lucide-react'; // Import icons
import React from 'react'; // Import React for JSX

// Constants for energy calculation
const BASE_ENERGY_COST_PER_MINUTE = 0.5;
const CRITICAL_TASK_MULTIPLIER = 1.5;
const BACKBURNER_TASK_MULTIPLIER = 0.7; // Less energy for backburner tasks
const MEAL_ENERGY_GAIN = -10; // Negative cost means energy gain

// Utility to parse task input from a string
export const parseTaskInput = (input: string, selectedDay: Date) => {
  // Regex for "Task Name Duration" (e.g., "Read Book 30m")
  const durationRegex = /^(.*?)\s+(\d+)(m|min)$/i;
  // Regex for "Task Name HH:MM AM/PM - HH:MM AM/PM" (e.g., "Meeting 9:00 AM - 10:00 AM")
  const timeRangeRegex = /^(.*?)\s+(\d{1,2}(:\d{2})?\s*(am|pm)?)\s*-\s*(\d{1,2}(:\d{2})?\s*(am|pm)?)$/i;
  // Regex for "Task Name to sink"
  const sinkRegex = /^(.*?)\s+to\s+sink$/i;
  // Regex for "Task Name critical"
  const criticalRegex = /^(.*?)\s+critical$/i;
  // Regex for "Task Name flexible"
  const flexibleRegex = /^(.*?)\s+flexible$/i;
  // Regex for "Task Name backburner"
  const backburnerRegex = /^(.*?)\s+backburner$/i;

  let name = input.trim();
  let duration: number | undefined;
  let startTime: Date | undefined;
  let endTime: Date | undefined;
  let isCritical = false;
  let isFlexible = true; // Default to flexible
  let shouldSink = false;
  let isBackburner = false; // Default to not backburner
  let breakDuration: number | undefined;

  // Check for "to sink" first
  const sinkMatch = name.match(sinkRegex);
  if (sinkMatch) {
    name = sinkMatch[1].trim();
    shouldSink = true;
  }

  // Check for "critical"
  const criticalMatch = name.match(criticalRegex);
  if (criticalMatch) {
    name = criticalMatch[1].trim();
    isCritical = true;
  }

  // Check for "flexible" (can override default)
  const flexibleMatch = name.match(flexibleRegex);
  if (flexibleMatch) {
    name = flexibleMatch[1].trim();
    isFlexible = true;
  }

  // Check for "backburner"
  const backburnerMatch = name.match(backburnerRegex);
  if (backburnerMatch) {
    name = backburnerMatch[1].trim();
    isBackburner = true;
    isFlexible = true; // Backburner implies flexible
  }

  // Extract break duration if present (e.g., "Task 30m break 5m")
  const breakRegex = /\s+break\s+(\d+)(m|min)$/i;
  const breakMatch = name.match(breakRegex);
  if (breakMatch) {
    name = name.replace(breakMatch[0], '').trim();
    breakDuration = parseInt(breakMatch[1], 10);
  }

  // Check for duration
  const durationMatch = name.match(durationRegex);
  if (durationMatch) {
    name = durationMatch[1].trim();
    duration = parseInt(durationMatch[2], 10);
  }

  // Check for time range
  const timeRangeMatch = name.match(timeRangeRegex);
  if (timeRangeMatch) {
    name = timeRangeMatch[1].trim();
    startTime = parseFlexibleTime(timeRangeMatch[2], selectedDay);
    endTime = parseFlexibleTime(timeRangeMatch[5], selectedDay);
    isFlexible = false; // Timed tasks are not flexible
  }

  if (duration || (startTime && endTime)) {
    const energyCost = calculateEnergyCost(duration || differenceInMinutes(endTime!, startTime!), isCritical, isBackburner);
    return { name, duration, startTime, endTime, isCritical, isFlexible, shouldSink, isBackburner, energyCost, breakDuration };
  }
  return null;
};

// Utility to parse injection commands (e.g., "inject Task Name 30m")
export const parseInjectionCommand = (input: string) => {
  const injectRegex = /^inject\s+(.*?)(?:\s+(\d+)(m|min))?(?:\s+(\d{1,2}(:\d{2})?\s*(am|pm)?)\s*-\s*(\d{1,2}(:\d{2})?\s*(am|pm)?))?(?:\s+break\s+(\d+)(m|min))?(?:\s+critical)?(?:\s+flexible)?(?:\s+backburner)?$/i;
  const match = input.match(injectRegex);

  if (match) {
    const taskName = match[1].trim();
    const duration = match[2] ? parseInt(match[2], 10) : undefined;
    const startTime = match[4] ? match[4].trim() : undefined;
    const endTime = match[7] ? match[7].trim() : undefined;
    const breakDuration = match[10] ? parseInt(match[10], 10) : undefined;
    const isCritical = input.toLowerCase().includes('critical');
    const isFlexible = input.toLowerCase().includes('flexible') || (!startTime && !endTime); // Default to flexible if no times
    const isBackburner = input.toLowerCase().includes('backburner');

    const calculatedDuration = duration || (startTime && endTime ? differenceInMinutes(parseFlexibleTime(endTime, new Date()), parseFlexibleTime(startTime, new Date())) : 0);
    const energyCost = calculateEnergyCost(calculatedDuration, isCritical, isBackburner);

    return { taskName, duration, startTime, endTime, isCritical, isFlexible, isBackburner, energyCost, breakDuration };
  }
  return null;
};

// Utility to parse general commands (e.g., "clear", "remove Task Name")
export const parseCommand = (input: string) => {
  const lowerInput = input.toLowerCase();
  if (lowerInput === 'clear') {
    return { type: 'clear' };
  }
  if (lowerInput.startsWith('remove')) {
    const parts = input.split(' ');
    if (parts.length > 1) {
      if (parts[1] === 'index' && parts.length > 2) {
        const index = parseInt(parts[2], 10);
        if (!isNaN(index)) {
          return { type: 'remove', index: index - 1 }; // Convert to 0-based index
        }
      } else {
        const target = parts.slice(1).join(' ');
        return { type: 'remove', target };
      }
    }
    return { type: 'remove' }; // No target specified
  }
  if (lowerInput === 'show') {
    return { type: 'show' };
  }
  if (lowerInput === 'reorder') {
    return { type: 'reorder' };
  }
  if (lowerInput.startsWith('timeoff')) {
    return { type: 'timeoff' };
  }
  if (lowerInput === 'aether dump' || lowerInput === 'reset schedule') {
    return { type: 'aether dump' };
  }
  if (lowerInput === 'aether dump mega') {
    return { type: 'aether dump mega' };
  }
  if (lowerInput.startsWith('break')) {
    const durationMatch = lowerInput.match(/break\s+(\d+)(m|min)/);
    const duration = durationMatch ? parseInt(durationMatch[1], 10) : undefined;
    return { type: 'break', duration };
  }
  return null;
};

// Utility to format date and time
export const formatDateTime = (date: Date) => {
  return format(date, 'MMM d, yyyy h:mm a');
};

// Utility to parse flexible time inputs (e.g., "9am", "14:30", "2:30 pm")
export const parseFlexibleTime = (timeString: string, baseDate: Date): Date => {
  const lowerCaseTimeString = timeString.toLowerCase().trim();
  let parsedDate: Date;

  // Try parsing with AM/PM
  if (lowerCaseTimeString.includes('am') || lowerCaseTimeString.includes('pm')) {
    parsedDate = parse(lowerCaseTimeString, 'h:mm a', baseDate);
    if (!isNaN(parsedDate.getTime())) return parsedDate;
    parsedDate = parse(lowerCaseTimeString, 'h a', baseDate);
    if (!isNaN(parsedDate.getTime())) return parsedDate;
  }

  // Try parsing 24-hour format
  parsedDate = parse(lowerCaseTimeString, 'HH:mm', baseDate);
  if (!isNaN(parsedDate.getTime())) return parsedDate;
  parsedDate = parse(lowerCaseTimeString, 'H', baseDate);
  if (!isNaN(parsedDate.getTime())) return parsedDate;

  // Fallback for simple numbers (e.g., "9" for 9 AM)
  const num = parseInt(lowerCaseTimeString, 10);
  if (!isNaN(num)) {
    if (lowerCaseTimeString.includes('pm') && num < 12) {
      return setHours(baseDate, num + 12);
    }
    if (lowerCaseTimeString.includes('am') && num === 12) { // 12 AM is midnight
      return setHours(baseDate, 0);
    }
    return setHours(baseDate, num);
  }

  return new Date(NaN); // Return invalid date if parsing fails
};

export const formatTime = (date: Date) => format(date, 'h:mm a');

export const setTimeOnDate = (date: Date, timeString: string): Date => {
  const [hours, minutes] = timeString.split(':').map(Number);
  let newDate = setHours(date, hours);
  newDate = setMinutes(newDate, minutes);
  return newDate;
};

export const getEmojiHue = (text: string): number => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash % 360;
};

export const getBreakDescription = (duration: number): string => {
  if (duration <= 5) return "Quick stretch";
  if (duration <= 15) return "Short mental reset";
  if (duration <= 30) return "Coffee/tea break";
  if (duration <= 60) return "Lunch break";
  return "Extended break";
};

export const isMeal = (taskName: string): boolean => {
  const lowerCaseName = taskName.toLowerCase();
  return lowerCaseName.includes('meal') || lowerCaseName.includes('lunch') || lowerCaseName.includes('dinner') || lowerCaseName.includes('breakfast');
};

export const calculateEnergyCost = (duration: number, isCritical: boolean, isBackburner: boolean = false): number => {
  if (duration <= 0) return 0;

  // Meals have a fixed energy gain
  // This check should ideally happen before calling calculateEnergyCost if possible,
  // but included here for robustness.
  // If a task is explicitly marked as a meal, it should provide energy.
  // For simplicity, we'll assume `isMeal` check is done externally or task name is passed.
  // If this function is called for a meal, it should return a negative cost.
  // For now, we'll rely on the `isMeal` check in `SchedulerPage.tsx` to set a fixed -10.
  // If this function is called for a task that *is* a meal, but not explicitly handled,
  // it will calculate a positive cost. This is a design decision.

  let cost = duration * BASE_ENERGY_COST_PER_MINUTE;

  if (isCritical) {
    cost *= CRITICAL_TASK_MULTIPLIER;
  } else if (isBackburner) {
    cost *= BACKBURNER_TASK_MULTIPLIER;
  }

  return Math.round(cost);
};

export const mergeOverlappingTimeBlocks = (blocks: TimeBlock[]): TimeBlock[] => {
  if (blocks.length === 0) return [];

  const sortedBlocks = [...blocks].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: TimeBlock[] = [];

  let currentMergedBlock = { ...sortedBlocks[0] };

  for (let i = 1; i < sortedBlocks.length; i++) {
    const nextBlock = sortedBlocks[i];

    if (nextBlock.start <= currentMergedBlock.end) {
      // Overlap or touch, merge them
      currentMergedBlock.end = new Date(Math.max(currentMergedBlock.end.getTime(), nextBlock.end.getTime()));
      currentMergedBlock.duration = differenceInMinutes(currentMergedBlock.end, currentMergedBlock.start);
    } else {
      // No overlap, add current merged block and start a new one
      merged.push(currentMergedBlock);
      currentMergedBlock = { ...nextBlock };
    }
  }

  merged.push(currentMergedBlock); // Add the last merged block
  return merged;
};

export const getFreeTimeBlocks = (occupiedBlocks: TimeBlock[], workdayStart: Date, workdayEnd: Date): TimeBlock[] => {
  const freeBlocks: TimeBlock[] = [];
  let currentFreeTimeStart = workdayStart;

  const sortedOccupiedBlocks = [...occupiedBlocks].sort((a, b) => a.start.getTime() - b.start.getTime());

  for (const block of sortedOccupiedBlocks) {
    // Ensure currentFreeTimeStart is not before workdayStart
    currentFreeTimeStart = new Date(Math.max(currentFreeTimeStart.getTime(), workdayStart.getTime()));

    // If there's a gap between currentFreeTimeStart and the start of the current occupied block
    if (isBefore(currentFreeTimeStart, block.start)) {
      const freeDuration = differenceInMinutes(block.start, currentFreeTimeStart);
      if (freeDuration > 0) {
        freeBlocks.push({ start: currentFreeTimeStart, end: block.start, duration: freeDuration });
      }
    }
    // Advance currentFreeTimeStart past the end of the current occupied block
    currentFreeTimeStart = new Date(Math.max(currentFreeTimeStart.getTime(), block.end.getTime()));
  }

  // Add any remaining free time after the last occupied block until workdayEnd
  if (isBefore(currentFreeTimeStart, workdayEnd)) {
    const freeDuration = differenceInMinutes(workdayEnd, currentFreeTimeStart);
    if (freeDuration > 0) {
      freeBlocks.push({ start: currentFreeTimeStart, end: workdayEnd, duration: freeDuration });
    }
  }

  return freeBlocks;
};

export const isSlotFree = (proposedStart: Date, proposedEnd: Date, occupiedBlocks: TimeBlock[]): boolean => {
  for (const block of occupiedBlocks) {
    // Check for overlap:
    // (StartA < EndB) && (EndA > StartB)
    if (isBefore(proposedStart, block.end) && isAfter(proposedEnd, block.start)) {
      return false; // Overlap found
    }
  }
  return true; // No overlap
};

export const calculateSchedule = (
  dbTasks: DBScheduledTask[],
  selectedDayString: string,
  workdayStartTime: Date,
  workdayEndTime: Date,
  isRegenPodActive: boolean,
  regenPodStartTime: Date | null,
  regenPodDurationMinutes: number,
  T_current: Date
): FormattedSchedule => {
  const selectedDay = parseISO(selectedDayString);
  const items: ScheduledItem[] = [];
  let totalActiveMinutes = 0;
  let totalBreakMinutes = 0;
  let totalEnergyCost = 0;
  let criticalTasksRemaining = 0;

  // Filter tasks for the selected day
  const tasksForSelectedDay = dbTasks.filter(task => isSameDay(parseISO(task.scheduled_date), selectedDay));

  // Add Regen Pod as a fixed item if active and on the current day
  if (isRegenPodActive && regenPodStartTime && isSameDay(regenPodStartTime, selectedDay)) {
    const podEndTime = addMinutes(regenPodStartTime, regenPodDurationMinutes);
    items.push({
      id: 'regen-pod-active',
      name: 'Energy Regen Pod',
      startTime: regenPodStartTime,
      endTime: podEndTime,
      duration: regenPodDurationMinutes,
      isCritical: false,
      isFlexible: false,
      isLocked: true,
      isCompleted: false,
      energyCost: 0, // Pod itself has no cost, it provides energy via session hook
      taskEnvironment: 'home', // Or a specific 'regen' environment
      isBackburner: false,
      emoji: '⚡',
      type: 'break', // Treat as a break for display purposes
      description: 'Recharging energy...',
    });
  }

  tasksForSelectedDay.forEach(task => {
    if (task.start_time && task.end_time) {
      const startTime = parseISO(task.start_time);
      const endTime = parseISO(task.end_time);
      const duration = differenceInMinutes(endTime, startTime);

      let type: ScheduledItem['type'] = 'task';
      let emoji = '📝';
      let description: string | undefined;

      if (task.name.toLowerCase().includes('break')) {
        type = 'break';
        emoji = '☕';
        description = getBreakDescription(duration);
      } else if (task.name.toLowerCase().includes('time off')) {
        type = 'time-off';
        emoji = '🏖️';
      } else if (isMeal(task.name)) {
        type = 'meal';
        emoji = '🍔';
      } else if (task.source_calendar_id) { // Assuming source_calendar_id indicates an external calendar event
        type = 'calendar-event';
        emoji = '🗓️';
        description = 'External Calendar Event';
      } else {
        emoji = String.fromCodePoint(getEmojiHue(task.name) % 0x1F600 + 0x1F600); // Simple emoji generation
      }

      items.push({
        id: task.id,
        name: task.name,
        startTime,
        endTime,
        duration,
        breakDuration: task.break_duration || undefined,
        isCritical: task.is_critical,
        isFlexible: task.is_flexible,
        isLocked: task.is_locked,
        isCompleted: task.is_completed,
        energyCost: task.energy_cost,
        taskEnvironment: task.task_environment,
        isBackburner: task.is_backburner,
        emoji,
        type,
        description,
      });

      if (type === 'task' || type === 'calendar-event') {
        totalActiveMinutes += duration;
        if (task.is_critical && !task.is_completed && isAfter(endTime, T_current)) {
          criticalTasksRemaining++;
        }
      } else if (type === 'break' || type === 'meal' || type === 'time-off') {
        totalBreakMinutes += duration;
      }
      totalEnergyCost += task.energy_cost;
    }
  });

  items.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  // Calculate free time
  const allOccupiedBlocks = items.map(item => ({
    start: item.startTime,
    end: item.endTime,
    duration: item.duration,
  }));
  const mergedOccupiedBlocks = mergeOverlappingTimeBlocks(allOccupiedBlocks);
  const freeTimeBlocks = getFreeTimeBlocks(mergedOccupiedBlocks, workdayStartTime, workdayEndTime);
  const totalFreeMinutes = freeTimeBlocks.reduce((sum, block) => sum + block.duration, 0);

  const freeTimeHours = Math.floor(totalFreeMinutes / 60);
  const freeTimeMinutes = totalFreeMinutes % 60;

  const activeTimeHours = Math.floor(totalActiveMinutes / 60);
  const activeTimeMinutes = totalActiveMinutes % 60;

  // Check for midnight rollover
  let extendsPastMidnight = false;
  let midnightRolloverMessage = '';
  if (items.length > 0 && isAfter(items[items.length - 1].endTime, addDays(startOfDay(selectedDay), 1))) {
    extendsPastMidnight = true;
    midnightRolloverMessage = `Your schedule extends past midnight into ${format(addDays(selectedDay, 1), 'EEEE')}.`;
  }

  return {
    items,
    dbTasks: tasksForSelectedDay, // Pass the filtered DB tasks
    summary: {
      totalTasks: items.length,
      activeTime: { hours: activeTimeHours, minutes: activeTimeMinutes },
      breakTime: totalBreakMinutes,
      freeTime: { hours: freeTimeHours, minutes: freeTimeMinutes },
      extendsPastMidnight,
      midnightRolloverMessage,
      criticalTasksRemaining,
      totalEnergyCost,
    },
  };
};

export const compactScheduleLogic = (
  currentDbTasks: DBScheduledTask[],
  selectedDayAsDate: Date,
  workdayStartTime: Date,
  workdayEndTime: Date,
  T_current: Date
): NewDBScheduledTask[] => {
  const flexibleTasks = currentDbTasks.filter(task => task.is_flexible && !task.is_locked && !task.is_completed);
  const fixedTasks = currentDbTasks.filter(task => !task.is_flexible || task.is_locked || task.is_completed);

  const fixedBlocks = fixedTasks
    .filter(task => task.start_time && task.end_time)
    .map(task => ({
      start: parseISO(task.start_time!),
      end: parseISO(task.end_time!),
      duration: differenceInMinutes(parseISO(task.end_time!), parseISO(task.start_time!)),
    }));

  const mergedFixedBlocks = mergeOverlappingTimeBlocks(fixedBlocks);

  // Sort flexible tasks by priority (critical first), then duration (longest first)
  flexibleTasks.sort((a, b) => {
    if (a.is_critical && !b.is_critical) return -1;
    if (!a.is_critical && b.is_critical) return 1;
    return (b.break_duration || b.duration || 0) - (a.break_duration || a.duration || 0);
  });

  const newScheduledTasks: NewDBScheduledTask[] = [...fixedTasks];
  let currentPlacementTime = isSameDay(selectedDayAsDate, T_current) && isAfter(T_current, workdayStartTime)
    ? T_current
    : workdayStartTime;

  for (const task of flexibleTasks) {
    const taskDuration = task.duration || differenceInMinutes(parseISO(task.end_time!), parseISO(task.start_time!));
    const breakDuration = task.break_duration || 0;
    const totalDuration = taskDuration + breakDuration;

    let placed = false;
    let searchStartTime = currentPlacementTime;

    while (isBefore(searchStartTime, workdayEndTime)) {
      const freeBlocks = getFreeTimeBlocks(mergedFixedBlocks, searchStartTime, workdayEndTime);
      const suitableBlock = freeBlocks.find(block => block.duration >= totalDuration);

      if (suitableBlock) {
        const proposedStartTime = suitableBlock.start;
        const proposedEndTime = addMinutes(proposedStartTime, totalDuration);

        if (isSlotFree(proposedStartTime, proposedEndTime, mergedFixedBlocks)) {
          newScheduledTasks.push({
            ...task,
            start_time: proposedStartTime.toISOString(),
            end_time: proposedEndTime.toISOString(),
            scheduled_date: format(selectedDayAsDate, 'yyyy-MM-dd'),
            is_flexible: true, // Ensure it remains flexible
            is_locked: false, // Ensure it's not locked by compaction
            updated_at: new Date().toISOString(),
          });

          // Update mergedFixedBlocks with the newly placed task
          mergedFixedBlocks.push({ start: proposedStartTime, end: proposedEndTime, duration: totalDuration });
          mergedFixedBlocks.sort((a, b) => a.start.getTime() - b.start.getTime());
          // Re-merge to handle new overlaps
          // This is a simplified re-merge; a full re-merge might be needed for complex scenarios
          // For now, assuming simple insertion and re-sorting is sufficient for compaction
          // A more robust solution would be to re-run mergeOverlappingTimeBlocks on all blocks
          // after each placement.
          // For this context, we'll just update the currentPlacementTime
          currentPlacementTime = proposedEndTime;
          placed = true;
          break;
        }
      }
      // If no suitable block found from current searchStartTime, advance searchStartTime
      // to the end of the next occupied block or the next hour, to avoid infinite loops
      // in case of very fragmented free time.
      const nextOccupiedBlock = mergedFixedBlocks.find(block => isAfter(block.start, searchStartTime));
      if (nextOccupiedBlock) {
        searchStartTime = nextOccupiedBlock.end;
      } else {
        searchStartTime = addHours(searchStartTime, 1); // Advance by an hour if no more blocks
      }
    }
  }

  // Filter out any tasks that couldn't be placed (e.g., if no slot was found)
  // This logic assumes that tasks in newScheduledTasks are the ones successfully placed or fixed.
  // Any flexible tasks from the original list that are not in newScheduledTasks were not placed.
  const finalTasks = newScheduledTasks.filter(task => task.start_time && task.end_time);

  return finalTasks;
};

// NEW: getEnvironmentIcon utility function
export const getEnvironmentIcon = (environment: TaskEnvironment) => {
  switch (environment) {
    case 'home':
      return <Home className="h-4 w-4 text-logo-green" />;
    case 'laptop':
      return <Laptop className="h-4 w-4 text-primary" />;
    case 'away':
      return <Globe className="h-4 w-4 text-logo-orange" />;
    case 'piano':
      return <Music className="h-4 w-4 text-accent" />;
    case 'laptop_piano':
      return (
        <div className="relative">
          <Laptop className="h-4 w-4 text-primary" />
          <Music className="h-2.5 w-2.5 absolute -bottom-0.5 -right-0.5 text-accent" />
        </div>
      );
    default:
      return null;
  }
};