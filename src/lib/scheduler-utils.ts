import { format, addMinutes, isPast, isToday, startOfDay, addHours, addDays, parse, parseISO, setHours, setMinutes, isSameDay, isBefore, isAfter } from 'date-fns';
import { ScheduledItem, FormattedSchedule, DBScheduledTask, TimeBlock, ScheduledTaskItem, ScheduledBreakItem, FreeSlotItem, ScheduledTimeOffItem, ScheduleSummary } from '@/types/scheduler'; // Updated imports

// NEW: Define RawTaskInput locally as it's internal to parsing
interface RawTaskInput {
  name: string;
  duration?: number; // in minutes
  startTime?: Date;
  endTime?: Date;
  breakDuration?: number; // in minutes
  isCritical: boolean;
  shouldSink?: boolean; // NEW: For tasks that go directly to Aether Sink
}

// NEW: Define TimeMarker locally as it's internal to display logic
interface TimeMarker {
  time: Date;
  label: string;
  isCurrent: boolean;
}

// NEW: Define DisplayItem locally as it's internal to display logic
type DisplayItem = ScheduledItem | TimeMarker;


export const parseFlexibleTime = (timeString: string, baseDate: Date): Date => {
  const lowerCaseTimeString = timeString.toLowerCase();
  const now = new Date();
  let parsedTime: Date;

  // Handle relative times like "in 30 min"
  const inMinutesMatch = lowerCaseTimeString.match(/^in (\d+) min$/);
  if (inMinutesMatch) {
    return addMinutes(now, parseInt(inMinutesMatch[1], 10));
  }

  // Handle "now"
  if (lowerCaseTimeString === 'now') {
    return now;
  }

  // Try parsing with AM/PM
  parsedTime = parse(lowerCaseTimeString, 'h:mm a', baseDate);
  if (!isNaN(parsedTime.getTime())) return parsedTime;

  parsedTime = parse(lowerCaseTimeString, 'h a', baseDate);
  if (!isNaN(parsedTime.getTime())) return parsedTime;

  // Try parsing 24-hour format
  parsedTime = parse(lowerCaseTimeString, 'HH:mm', baseDate);
  if (!isNaN(parsedTime.getTime())) return parsedTime;

  parsedTime = parse(lowerCaseTimeString, 'H', baseDate);
  if (!isNaN(parsedTime.getTime())) return parsedTime;

  // Handle common keywords
  if (lowerCaseTimeString.includes('morning')) {
    return setHours(setMinutes(baseDate, 0), 9); // 9 AM
  }
  if (lowerCaseTimeString.includes('noon')) {
    return setHours(setMinutes(baseDate, 0), 12); // 12 PM
  }
  if (lowerCaseTimeString.includes('afternoon')) {
    return setHours(setMinutes(baseDate, 0), 14); // 2 PM
  }
  if (lowerCaseTimeString.includes('evening')) {
    return setHours(setMinutes(baseDate, 0), 18); // 6 PM
  }
  if (lowerCaseTimeString.includes('night')) {
    return setHours(setMinutes(baseDate, 0), 21); // 9 PM
  }

  // Default to current time if parsing fails
  return now;
};

export const formatTime = (date: Date): string => {
  return format(date, 'h:mm a');
};

export const formatDateTime = (date: Date): string => {
  return format(date, 'MMM d, h:mm a');
};

// NEW: Exported formatDayMonth
export const formatDayMonth = (date: Date): string => {
  return format(date, 'MMM d');
};

export const setTimeOnDate = (date: Date, timeString: string): Date => {
  const [hours, minutes] = timeString.split(':').map(Number);
  return setMinutes(setHours(date, hours), minutes);
};

export const parseTaskInput = (input: string, selectedDayAsDate: Date): RawTaskInput | null => {
  input = input.trim();

  // Regex for "Task Name Duration [Break] [!] [sink]"
  const durationRegex = /^(.*?)\s+(\d+)(?:\s+(\d+))?(?:\s+(!))?(?:\s+(sink))?$/i;
  const durationMatch = input.match(durationRegex);

  if (durationMatch) {
    const name = durationMatch[1].trim().replace(/^"|"$/g, ''); // Remove quotes if present
    const duration = parseInt(durationMatch[2], 10);
    const breakDuration = durationMatch[3] ? parseInt(durationMatch[3], 10) : undefined;
    const isCritical = !!durationMatch[4]; // Check for '!'
    const shouldSink = !!durationMatch[5]; // Check for 'sink'

    if (name && duration > 0) {
      return { name, duration, breakDuration, isCritical, shouldSink };
    }
  }

  // Regex for "Task Name HH:MM AM/PM - HH:MM AM/PM [!]"
  const timeRangeRegex = /^(.*?)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)(?:\s+(!))?$/i;
  const timeRangeMatch = input.match(timeRangeRegex);

  if (timeRangeMatch) {
    const name = timeRangeMatch[1].trim().replace(/^"|"$/g, ''); // Remove quotes if present
    const startTimeString = timeRangeMatch[2].trim();
    const endTimeString = timeRangeMatch[3].trim();
    const isCritical = !!timeRangeMatch[4]; // Check for '!'

    const startTime = parseFlexibleTime(startTimeString, selectedDayAsDate);
    let endTime = parseFlexibleTime(endTimeString, selectedDayAsDate);

    // If end time is before start time, assume it's the next day
    if (isBefore(endTime, startTime)) {
      endTime = addDays(endTime, 1);
    }

    if (name && !isNaN(startTime.getTime()) && !isNaN(endTime.getTime())) {
      return { name, startTime, endTime, isCritical };
    }
  }

  return null;
};

export const parseInjectionCommand = (input: string) => {
  input = input.trim();
  // Regex for 'inject "Task Name" [Duration] [Break] [!] [flexible]'
  const injectDurationRegex = /^inject\s+"(.*?)"(?:\s+(\d+))?(?:\s+(\d+))?(?:\s+(!))?(?:\s+(flexible))?$/i;
  const injectDurationMatch = input.match(injectDurationRegex);

  if (injectDurationMatch) {
    const taskName = injectDurationMatch[1].trim();
    const duration = injectDurationMatch[2] ? parseInt(injectDurationMatch[2], 10) : undefined;
    const breakDuration = injectDurationMatch[3] ? parseInt(injectDurationMatch[3], 10) : undefined;
    const isCritical = !!injectDurationMatch[4];
    const isFlexible = !!injectDurationMatch[5];
    return { taskName, duration, breakDuration, isCritical, isFlexible, startTime: undefined, endTime: undefined };
  }

  // Regex for 'inject "Task Name" HH:MM AM/PM - HH:MM AM/PM [!] [flexible]'
  const injectTimeRangeRegex = /^inject\s+"(.*?)"\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)(?:\s+(!))?(?:\s+(flexible))?$/i;
  const injectTimeRangeMatch = input.match(injectTimeRangeRegex);

  if (injectTimeRangeMatch) {
    const taskName = injectTimeRangeMatch[1].trim();
    const startTime = injectTimeRangeMatch[2].trim();
    const endTime = injectTimeRangeMatch[3].trim();
    const isCritical = !!injectTimeRangeMatch[4];
    const isFlexible = !!injectTimeRangeMatch[5];
    return { taskName, startTime, endTime, isCritical, isFlexible, duration: undefined, breakDuration: undefined };
  }

  return null;
};

export const parseCommand = (input: string) => {
  input = input.trim().toLowerCase();
  if (input === 'clear') {
    return { type: 'clear' };
  }
  if (input.startsWith('remove')) {
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
  if (input === 'show') {
    return { type: 'show' };
  }
  if (input === 'reorder') {
    return { type: 'reorder' };
  }
  if (input === 'compact') {
    return { type: 'compact' };
  }
  return null;
};

export const mergeOverlappingTimeBlocks = (blocks: TimeBlock[]): TimeBlock[] => {
  if (blocks.length === 0) {
    return [];
  }

  // Sort blocks by start time
  blocks.sort((a, b) => a.start.getTime() - b.start.getTime());

  const merged: TimeBlock[] = [];
  let currentMergedBlock = { ...blocks[0] };

  for (let i = 1; i < blocks.length; i++) {
    const nextBlock = blocks[i];

    // If the current block overlaps with the next block
    if (isBefore(nextBlock.start, currentMergedBlock.end) || isSameDay(nextBlock.start, currentMergedBlock.end)) {
      // Merge them by extending the end time of the current merged block
      currentMergedBlock.end = isAfter(nextBlock.end, currentMergedBlock.end) ? nextBlock.end : currentMergedBlock.end;
      currentMergedBlock.duration = Math.floor((currentMergedBlock.end.getTime() - currentMergedBlock.start.getTime()) / (1000 * 60));
    } else {
      // No overlap, add the current merged block to the result and start a new one
      merged.push(currentMergedBlock);
      currentMergedBlock = { ...nextBlock };
    }
  }

  // Add the last merged block
  merged.push(currentMergedBlock);
  return merged;
};

export const isSlotFree = (
  newSlotStart: Date,
  newSlotEnd: Date,
  occupiedBlocks: TimeBlock[]
): boolean => {
  for (const block of occupiedBlocks) {
    // Check for overlap:
    // (StartA < EndB) && (EndA > StartB)
    if (isBefore(newSlotStart, block.end) && isAfter(newSlotEnd, block.start)) {
      return false; // Overlap found
    }
  }
  return true; // No overlap
};

export const calculateSchedule = (
  dbTasks: DBScheduledTask[],
  selectedDay: string,
  workdayStartTime: Date,
  workdayEndTime: Date,
  flexibleTasksOrder?: DBScheduledTask[] // Optional: provide a specific order for flexible tasks
): FormattedSchedule => {
  const selectedDayAsDate = parseISO(selectedDay);
  const now = new Date();

  const fixedTasks: DBScheduledTask[] = [];
  const flexibleTasks: DBScheduledTask[] = [];
  const timeOffBlocks: TimeBlock[] = []; // For 'time-off' tasks

  dbTasks.forEach(task => {
    if (task.is_flexible) {
      flexibleTasks.push(task);
    } else if (task.name.toLowerCase() === 'time off') { // Identify 'time off' tasks
      if (task.start_time && task.end_time) {
        const start = setTimeOnDate(selectedDayAsDate, format(parseISO(task.start_time), 'HH:mm'));
        let end = setTimeOnDate(selectedDayAsDate, format(parseISO(task.end_time), 'HH:mm'));
        if (isBefore(end, start)) end = addDays(end, 1); // Handle overnight
        timeOffBlocks.push({ start, end, duration: Math.floor((end.getTime() - start.getTime()) / (1000 * 60)) });
      }
    } else {
      fixedTasks.push(task);
    }
  });

  // Sort fixed tasks by start time
  fixedTasks.sort((a, b) => parseISO(a.start_time!).getTime() - parseISO(b.start_time!).getTime());

  // Create initial occupied blocks from fixed tasks and time-off
  let occupiedBlocks: TimeBlock[] = [];
  fixedTasks.forEach(task => {
    if (task.start_time && task.end_time) {
      const start = setTimeOnDate(selectedDayAsDate, format(parseISO(task.start_time), 'HH:mm'));
      let end = setTimeOnDate(selectedDayAsDate, format(parseISO(task.end_time), 'HH:mm'));
      if (isBefore(end, start)) end = addDays(end, 1); // Handle overnight
      occupiedBlocks.push({ start, end, duration: Math.floor((end.getTime() - start.getTime()) / (1000 * 60)) });
    }
  });
  occupiedBlocks = mergeOverlappingTimeBlocks([...occupiedBlocks, ...timeOffBlocks]); // Merge fixed tasks and time-off

  const scheduledItems: ScheduledItem[] = [];
  let currentOccupiedBlocks = [...occupiedBlocks]; // Use a mutable copy for scheduling flexible tasks

  // Add fixed tasks and time-off to scheduled items first
  fixedTasks.forEach(task => {
    if (task.start_time && task.end_time) {
      const start = setTimeOnDate(selectedDayAsDate, format(parseISO(task.start_time), 'HH:mm'));
      let end = setTimeOnDate(selectedDayAsDate, format(parseISO(task.end_time), 'HH:mm'));
      if (isBefore(end, start)) end = addDays(end, 1);
      scheduledItems.push({
        id: task.id,
        type: 'task',
        name: task.name,
        startTime: start,
        endTime: end,
        duration: Math.floor((end.getTime() - start.getTime()) / (1000 * 60)),
        isCritical: task.is_critical,
        isFlexible: task.is_flexible,
        breakDuration: task.break_duration,
        originalTask: task,
        emoji: '📝' // Default emoji for tasks
      } as ScheduledTaskItem);
    }
  });

  timeOffBlocks.forEach((block, index) => {
    scheduledItems.push({
      id: `time-off-${index}`, // Unique ID for time-off blocks
      type: 'time-off', // Corrected type
      name: 'Time Off',
      startTime: block.start,
      endTime: block.end,
      duration: block.duration,
      emoji: '🏖️' // Emoji for time off
    } as ScheduledTimeOffItem);
  });


  // Schedule flexible tasks
  const tasksToSchedule = flexibleTasksOrder || flexibleTasks; // Use provided order or default
  for (const task of tasksToSchedule) {
    const taskDuration = task.break_duration || 30; // Assuming break_duration is the actual duration for 'break' tasks, or default
    const isStandaloneBreak = task.name.toLowerCase() === 'break';

    // Find a free slot for the flexible task
    const freeBlocks = getFreeTimeBlocks(currentOccupiedBlocks, workdayStartTime, workdayEndTime);

    let placed = false;
    for (const freeBlock of freeBlocks) {
      if (freeBlock.duration >= taskDuration) {
        const proposedStartTime = freeBlock.start;
        const proposedEndTime = addMinutes(proposedStartTime, taskDuration);

        scheduledItems.push({
          id: task.id,
          type: isStandaloneBreak ? 'break' : 'task', // Corrected type
          name: task.name,
          startTime: proposedStartTime,
          endTime: proposedEndTime,
          duration: taskDuration,
          isCritical: task.is_critical,
          isFlexible: task.is_flexible,
          breakDuration: task.break_duration,
          originalTask: task,
          emoji: isStandaloneBreak ? '☕' : '✨' // Emojis for breaks and flexible tasks
        } as ScheduledTaskItem | ScheduledBreakItem);

        // Update current occupied blocks
        currentOccupiedBlocks.push({ start: proposedStartTime, end: proposedEndTime, duration: taskDuration });
        currentOccupiedBlocks = mergeOverlappingTimeBlocks(currentOccupiedBlocks);
        placed = true;
        break;
      }
    }
    if (!placed) {
      // Mark as unscheduled if it couldn't be placed
      console.warn(`Task "${task.name}" could not be scheduled.`);
    }
  }

  // Sort all scheduled items by start time
  scheduledItems.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  // Generate free slots based on the final scheduled items
  const finalOccupiedBlocks = mergeOverlappingTimeBlocks(scheduledItems.map(item => ({
    start: item.startTime,
    end: item.endTime,
    duration: item.duration,
  })));

  const finalFreeBlocks = getFreeTimeBlocks(finalOccupiedBlocks, workdayStartTime, workdayEndTime);
  finalFreeBlocks.forEach((block, index) => {
    scheduledItems.push({
      id: `free-slot-${index}`, // Unique ID for free slots
      type: 'free-slot',
      name: 'Free Time',
      startTime: block.start,
      endTime: block.end,
      duration: block.duration,
      emoji: '🧘' // Emoji for free time
    } as FreeSlotItem);
  });

  // Re-sort after adding free slots
  scheduledItems.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  // Calculate summary
  const summary: ScheduleSummary = {
    totalScheduledDuration: scheduledItems.filter(item => item.type === 'task' || item.type === 'time-off').reduce((sum, item) => sum + item.duration, 0),
    totalBreakDuration: scheduledItems.filter(item => item.type === 'break').reduce((sum, item) => sum + item.duration, 0),
    totalFreeTime: scheduledItems.filter(item => item.type === 'free-slot').reduce((sum, item) => sum + item.duration, 0),
    unscheduledCount: dbTasks.length - scheduledItems.filter(item => item.type === 'task' || item.type === 'break' || item.type === 'time-off').length,
    workdayStart: workdayStartTime,
    workdayEnd: workdayEndTime,
  };

  return {
    items: scheduledItems,
    summary: summary,
  };
};

export const getFreeTimeBlocks = (
  occupiedBlocks: TimeBlock[],
  workdayStart: Date,
  workdayEnd: Date
): TimeBlock[] => {
  const freeBlocks: TimeBlock[] = [];
  let currentFreeTimeStart = workdayStart;

  for (const appt of occupiedBlocks) {
    if (isBefore(appt.end, currentFreeTimeStart)) {
      continue;
    }

    if (isBefore(currentFreeTimeStart, appt.start)) {
      const duration = Math.floor((appt.start.getTime() - currentFreeTimeStart.getTime()) / (1000 * 60));
      if (duration > 0) {
        freeBlocks.push({ start: currentFreeTimeStart, end: appt.start, duration });
      }
    }
    currentFreeTimeStart = isAfter(appt.end, currentFreeTimeStart) ? appt.end : currentFreeTimeStart;
  }

  if (isBefore(currentFreeTimeStart, workdayEnd)) {
    const duration = Math.floor((workdayEnd.getTime() - currentFreeTimeStart.getTime()) / (1000 * 60));
    if (duration > 0) {
      freeBlocks.push({ start: currentFreeTimeStart, end: workdayEnd, duration });
    }
  }
  return freeBlocks;
};

// Placeholder for compactScheduleLogic
export const compactScheduleLogic = (
  dbTasks: DBScheduledTask[],
  selectedDayAsDate: Date,
  workdayStartTime: Date,
  workdayEndTime: Date,
  T_current: Date,
  flexibleTasksOrder?: DBScheduledTask[]
): DBScheduledTask[] => {
  // This is a placeholder. Implement your actual compaction logic here.
  // For now, it will just return the flexible tasks in the given order,
  // or the original flexible tasks if no order is provided.
  const flexibleTasks = dbTasks.filter(task => task.is_flexible);
  const tasksToCompact = flexibleTasksOrder || flexibleTasks;

  // Simple placeholder: just return the flexible tasks without actual compaction
  // In a real scenario, this would re-calculate start/end times to fill gaps.
  return tasksToCompact.map(task => ({
    ...task,
    start_time: task.start_time || new Date().toISOString(), // Provide a default if null
    end_time: task.end_time || addMinutes(new Date(), task.break_duration || 30).toISOString(), // Provide a default if null
  }));
};

// Placeholder for getEmojiHue
export const getEmojiHue = (name: string): number => {
  // Simple hash to a hue value (0-360)
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash % 360);
};

// Placeholder for assignEmoji
export const assignEmoji = (name: string): string => {
  const emojis = ['✨', '🚀', '💡', '📚', '💻', '💪', '🧘', '☕', '📝', '🗓️'];
  const index = name.length % emojis.length;
  return emojis[index];
};