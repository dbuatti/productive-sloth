import { format, addMinutes, isPast, isToday, startOfDay, addHours, addDays, parse, parseISO, setHours, setMinutes, isSameDay, isBefore, isAfter } from 'date-fns';
import { RawTaskInput, ScheduledItem, ScheduledItemType, FormattedSchedule, ScheduleSummary, DBScheduledTask, TimeMarker, DisplayItem } from '@/types/scheduler';

// --- Constants ---
const EMOJI_MAP: { [key: string]: string } = {
  'gym': '🏋️', 'workout': '🏋️', 'run': '🏃', 'exercise': '🏋️', 'fitness': '💪',
  'email': '📧', 'messages': '💬', 'calls': '📞', 'communication': '🗣️', 'admin': '⚙️', 'paperwork': '📄',
  'meeting': '💼', 'work': '💻', 'report': '📝', 'professional': '👔', 'project': '📊', 'coding': '💻', 'develop': '💻', 'code': '💻', 'bug': '🐛', 'fix': '🛠️', 'sync': '🤝', 'standup': '🤝',
  'design': '🎨', 'writing': '✍️', 'art': '🖼️', 'creative': '✨', 'draw': '✏️',
  'study': '📚', 'reading': '📖', 'course': '🎓', 'learn': '🧠', 'class': '🏫', 'lecture': '🧑‍🏫', 'tutorial': '💡',
  'clean': '🧹', 'laundry': '🧺', 'organize': '🗄️', 'household': '🏠', 'setup': '🛠️', 'room': '🛋️',
  'cook': '🍳', 'meal prep': '🍲', 'groceries': '🛒', 'food': '🍔', 'lunch': '🥗', 'dinner': '🍽️', 'breakfast': '🥞', 'snack': '🍎',
  'brainstorm': '💡', 'strategy': '📈', 'review': '🔍', 'plan': '🗓️',
  'gaming': '🎮', 'tv': '📺', 'hobbies': '🎲', 'leisure': '😌', 'movie': '🎬', 'relax': '🧘', 'chill': '🛋️',
  'meditation': '🧘', 'yoga': '🧘', 'self-care': '🛀', 'wellness': '🌸', 'mindfulness': '🧠', 'nap': '😴', 'rest': '🛌',
  'break': '☕️', 'coffee': '☕️', 'walk': '🚶', 'stretch': '🤸',
  'piano': '🎹', 'music': '🎶', 'practice': '🎼',
  'commute': '🚗', 'drive': '🚗', 'bus': '🚌', 'train': '🚆', 'travel': '✈️',
  'shop': '🛍️', 'bank': '🏦', 'post': '✉️', 'errands': '🏃‍♀️',
  'friends': '🧑‍🤝‍🧑', 'family': '👨‍👩‍👧‍👦', 'social': '🎉',
  'wake up': '⏰',
  'coles': '🛒',
  'woolworths': '🛒',
  'lesson': '🧑‍🏫', // Added 'lesson'
  'call': '📞', // New: Call emoji
  'phone': '📱', // New: Phone emoji
  'text': '💬', // New: Text message emoji
  'contact': '🤝', // New: Contact/handshake emoji
};

// New: Map keywords to HSL hue values (0-360)
const EMOJI_HUE_MAP: { [key: string]: number } = {
  'gym': 200, 'workout': 200, 'run': 210, 'exercise': 200, 'fitness': 200, // Blue/Cyan
  'email': 240, 'messages': 245, 'calls': 250, 'communication': 240, 'admin': 270, 'paperwork': 230, // Indigo/Purple/Blue
  'meeting': 280, 'work': 210, 'report': 230, 'professional': 280, 'project': 290, 'coding': 210, 'develop': 210, 'code': 210, 'bug': 90, 'fix': 40, 'sync': 290, 'standup': 290, // Various blues/purples, lime for bug, gold for fix
  'design': 320, 'writing': 320, 'art': 330, 'creative': 340, 'draw': 320, // Pinks/Magenta
  'study': 260, 'reading': 260, 'course': 260, 'learn': 270, 'class': 260, 'lecture': 260, 'tutorial': 60, // Violets/Yellow
  'clean': 120, 'laundry': 130, 'organize': 140, 'household': 120, 'setup': 40, 'room': 150, // Greens/Teals/Gold
  'cook': 30, 'meal prep': 35, 'groceries': 180, 'food': 25, 'lunch': 45, 'dinner': 10, 'breakfast': 50, 'snack': 350, // Oranges/Reds/Yellows/Cyan
  'brainstorm': 60, 'strategy': 70, 'review': 80, 'plan': 220, // Yellows/Greens/Blue
  'gaming': 0, 'tv': 10, 'hobbies': 20, 'leisure': 150, 'movie': 0, 'relax': 160, 'chill': 150, // Reds/Oranges/Teals
  'meditation': 160, 'yoga': 160, 'self-care': 300, 'wellness': 170, 'mindfulness': 160, 'nap': 20, 'rest': 150, // Teals/Rose/Orange
  'break': 40, 'coffee': 30, 'walk': 100, 'stretch': 110, // Warm oranges/Greens
  'piano': 270, 'music': 270, 'practice': 270, // Purples
  'commute': 10, 'drive': 10, 'bus': 10, 'train': 10, 'travel': 200, // Reds/Oranges/Blues
  'shop': 180, 'bank': 220, 'post': 240, 'errands': 210, // Cyan/Blues/Indigo
  'friends': 300, 'family': 300, 'social': 310, // Rose/Pink
  'wake up': 60, // Added 'wake up' hue (yellow/orange for morning)
  'coles': 180, // Added 'coles' with grocery hue
  'woolworths': 180, // Added 'woolworths' with grocery hue
  'lesson': 260, // Added 'lesson' hue (violet/purple for learning)
  'call': 250, // New: Hue for calls (blue/purple)
  'phone': 255, // New: Hue for phone (blue/purple)
  'text': 245, // New: Hue for text (blue/purple)
  'contact': 290, // New: Hue for contact (purple/magenta)
};

const BREAK_DESCRIPTIONS: { [key: number]: string } = {
  5: "Quick stretch",
  10: "Stand and hydrate",
  15: "Walk around, refresh",
  20: "Proper rest, step outside",
  30: "Meal break, recharge",
};

const DEFAULT_EMOJI = '📋'; // Default for generic/ambiguous tasks
const DEFAULT_HUE = 220; // Default cool blue/grey hue

// --- Helper Functions ---

export const formatTime = (date: Date): string => format(date, 'hh:mm a');
export const formatDateTime = (date: Date): string => format(date, 'EEEE, MMMM d, yyyy at hh:mm a');
export const formatDayMonth = (date: Date): string => format(date, 'EEEE, MMMM d');

export const assignEmoji = (taskName: string): string => {
  const lowerCaseName = taskName.toLowerCase();
  for (const keyword in EMOJI_MAP) {
    if (lowerCaseName.includes(keyword)) {
      return EMOJI_MAP[keyword];
    }
  }
  return DEFAULT_EMOJI;
};

// New: Function to get hue based on task name
export const getEmojiHue = (taskName: string): number => {
  const lowerCaseName = taskName.toLowerCase();
  for (const keyword in EMOJI_HUE_MAP) {
    if (lowerCaseName.includes(keyword)) {
      return EMOJI_HUE_MAP[keyword];
    }
  }
  return DEFAULT_HUE;
};

export const getBreakDescription = (duration: number): string => {
  if (duration >= 30) return BREAK_DESCRIPTIONS[30];
  if (duration >= 20) return BREAK_DESCRIPTIONS[20];
  if (duration >= 15) return BREAK_DESCRIPTIONS[15];
  if (duration >= 10) return BREAK_DESCRIPTIONS[10];
  if (duration >= 5) return BREAK_DESCRIPTIONS[5];
  return "Short pause";
};

export const getMidnightRolloverMessage = (endDate: Date, T_current: Date): string | null => {
  if (!isToday(endDate) && endDate.getTime() > T_current.getTime()) {
    return `⚠️ Schedule extends past midnight into ${formatDayMonth(endDate)}`;
  }
  return null;
};

/**
 * Generates fixed time markers for a full 24-hour template.
 */
export const generateFixedTimeMarkers = (T_current: Date): TimeMarker => {
  const markers: TimeMarker[] = [];
  const startOfToday = startOfDay(T_current); // 12:00 AM today

  // Add 12 AM marker
  markers.push({ id: 'marker-0', type: 'marker', time: startOfToday, label: formatTime(startOfToday) });

  // Add markers every 3 hours for a full 24-hour cycle
  for (let i = 3; i <= 24; i += 3) { // Changed loop to go up to 24 hours
    const markerTime = addHours(startOfToday, i);
    markers.push({ id: `marker-${i}`, type: 'marker', time: markerTime, label: formatTime(markerTime) });
  }
  
  return markers;
};

// Helper to parse time flexibly
export const parseFlexibleTime = (timeString: string, referenceDate: Date): Date => {
  const formatsToTry = [
    'h:mm a', // e.g., "3:45 PM"
    'h a',    // e.g., "3 PM"
    'h:mma',  // e.g., "3:45pm"
    'ha',     // e.g., "3pm"
  ];

  for (const formatStr of formatsToTry) {
    const parsedDate = parse(timeString, formatStr, referenceDate);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  }

  return new Date('Invalid Date'); // Explicitly return an invalid date
};

/**
 * Parses a time string (e.g., "09:00") and sets it on a reference date.
 */
export const setTimeOnDate = (date: Date, timeString: string): Date => {
  const [hours, minutes] = timeString.split(':').map(Number);
  return setMinutes(setHours(date, hours), minutes);
};

interface ParsedTaskInput {
  name: string;
  duration?: number;
  breakDuration?: number;
  startTime?: Date;
  endTime?: Date;
  isCritical: boolean; // Added isCritical
}

export const parseTaskInput = (input: string): ParsedTaskInput | null => {
  const now = new Date();
  let isCritical = false;

  // Check for critical flag and remove it from the input string for further parsing
  if (input.endsWith(' !')) {
    isCritical = true;
    input = input.slice(0, -2).trim(); // Remove ' !'
  }

  // Regex to find a time range pattern anywhere in the string
  const timeRangePattern = /(\d{1,2}(:\d{2})?\s*(?:AM|PM|am|pm))\s*-\s*(\d{1,2}(:\d{2})?\s*(?:AM|PM|am|pm))/i;
  const timeRangeMatch = input.match(timeRangePattern);

  if (timeRangeMatch) {
    const fullTimeRangeString = timeRangeMatch[0]; // e.g., "3pm - 3:45pm"
    const startTimeStr = timeRangeMatch[1].trim();
    const endTimeStr = timeRangeMatch[3].trim();

    const startTime = parseFlexibleTime(startTimeStr, now);
    const endTime = parseFlexibleTime(endTimeStr, now);

    if (!isNaN(startTime.getTime()) && !isNaN(endTime.getTime())) {
      // Extract task name by removing the time range part
      const rawTaskName = input.replace(fullTimeRangeString, '').trim();

      // Define stop words for cleanup
      const stopWords = ['at', 'from', 'to', 'between', 'is', 'a', 'the', 'and'];
      const stopWordsRegex = new RegExp(`\\b(?:${stopWords.join('|')})\\b`, 'gi');
      
      const cleanedTaskName = rawTaskName
        .replace(stopWordsRegex, '') // Remove stop words
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .trim();

      if (cleanedTaskName) {
        return { name: cleanedTaskName, startTime, endTime, isCritical };
      }
    }
  }

  // If no time range pattern is found, fall back to duration-based parsing
  const durationRegex = /^(.*?)\s+(\d+)(?:\s+(\d+))?$/;
  const durationMatch = input.match(durationRegex);

  if (durationMatch) {
    const name = durationMatch[1].trim();
    const duration = parseInt(durationMatch[2], 10);
    const breakDuration = durationMatch[3] ? parseInt(durationMatch[3], 10) : undefined;
    if (name && duration > 0) {
      return { name, duration, breakDuration, isCritical };
    }
  }

  return null;
};

interface ParsedInjectionCommand {
  taskName: string;
  duration?: number;
  breakDuration?: number;
  startTime?: string;
  endTime?: string;
  isCritical: boolean; // Added isCritical
  isFlexible?: boolean; // Added isFlexible
}

export const parseInjectionCommand = (input: string): ParsedInjectionCommand | null => {
  let isCritical = false;
  let isFlexible = true; // Default to flexible for injected tasks unless specified otherwise

  // Check for critical flag and remove it from the input string for further parsing
  if (input.endsWith(' !')) {
    isCritical = true;
    input = input.slice(0, -2).trim(); // Remove ' !'
  }

  // Check for fixed flag (e.g., "inject task 60 fixed")
  if (input.endsWith(' fixed')) {
    isFlexible = false;
    input = input.slice(0, -6).trim(); // Remove ' fixed'
  }


  const injectRegex = /^inject\s+(.*?)(?:\s+(\d+)(?:\s+(\d+))?)?(?:\s+from\s+(\d{1,2}(:\d{2})?\s*(?:am|pm))\s+to\s+(\d{1,2}(:\d{2})?\s*(?:am|pm)))?$/i;
  const match = input.match(injectRegex);

  if (match) {
    const taskName = match[1].trim();
    const duration = match[2] ? parseInt(match[2], 10) : undefined;
    const breakDuration = match[3] ? parseInt(match[3], 10) : undefined;
    const startTime = match[4] ? match[4].trim() : undefined;
    const endTime = match[6] ? match[6].trim() : undefined;

    if (taskName) {
      // If start and end times are provided, it's a fixed task
      if (startTime && endTime) {
        isFlexible = false;
      }
      return { taskName, duration, breakDuration, startTime, endTime, isCritical, isFlexible };
    }
  }
  return null;
};

interface ParsedCommand {
  type: 'clear' | 'remove' | 'show' | 'reorder' | 'compact'; // Added 'compact'
  index?: number;
  target?: string;
}

export const parseCommand = (input: string): ParsedCommand | null => {
  const lowerInput = input.toLowerCase();

  if (lowerInput === 'clear queue' || lowerInput === 'clear') {
    return { type: 'clear' };
  }

  const removeByIndexRegex = /^remove\s+index\s+(\d+)$/;
  const removeByTargetRegex = /^remove\s+(.+)$/;

  const removeByIndexMatch = lowerInput.match(removeByIndexRegex);
  if (removeByIndexMatch) {
    const index = parseInt(removeByIndexMatch[1], 10) - 1; // Convert to 0-based index
    return { type: 'remove', index };
  }

  const removeByTargetMatch = lowerInput.match(removeByTargetRegex);
  if (removeByTargetMatch) {
    const target = removeByTargetMatch[1].trim();
    return { type: 'remove', target };
  }

  if (lowerInput === 'show queue' || lowerInput === 'show') {
    return { type: 'show' };
  }

  if (lowerInput.startsWith('reorder')) {
    return { type: 'reorder' }; // Placeholder for future reorder logic
  }

  if (lowerInput === 'compact' || lowerInput === 'reshuffle') { // Added compact/reshuffle command
    return { type: 'compact' };
  }

  return null;
};

// NEW: Helper to merge overlapping time blocks
export const mergeOverlappingTimeBlocks = (blocks: { start: Date; end: Date; duration: number }[]): { start: Date; end: Date; duration: number }[] => {
  if (blocks.length === 0) return [];

  // Sort blocks by start time
  blocks.sort((a, b) => a.start.getTime() - b.start.getTime());

  const merged: { start: Date; end: Date; duration: number }[] = [];
  let currentMergedBlock = { ...blocks[0] };

  for (let i = 1; i < blocks.length; i++) {
    const nextBlock = blocks[i];

    // If the current merged block overlaps with the next block
    // (i.e., current block ends at or after the next block starts)
    if (currentMergedBlock.end.getTime() >= nextBlock.start.getTime()) {
      // Extend the current merged block to cover the next block's end time if it extends further
      currentMergedBlock.end = isAfter(currentMergedBlock.end, nextBlock.end) ? currentMergedBlock.end : nextBlock.end;
      currentMergedBlock.duration = Math.floor((currentMergedBlock.end.getTime() - currentMergedBlock.start.getTime()) / (1000 * 60));
    } else {
      // No overlap, add the current merged block and start a new one
      merged.push(currentMergedBlock);
      currentMergedBlock = { ...nextBlock };
    }
  }

  merged.push(currentMergedBlock); // Add the last merged block
  return merged;
};


// --- Core Scheduling Logic ---

export const calculateSchedule = (
  dbTasks: DBScheduledTask[],
  selectedDateString: string, // This is selectedDay from state
  workdayStartTime: Date, // New parameter
  workdayEndTime: Date   // New parameter
): FormattedSchedule => {
  const scheduledItems: ScheduledItem[] = [];
  let totalActiveTime = 0;
  let totalBreakTime = 0;
  let unscheduledCount = 0; // New counter for tasks outside workday window
  let criticalTasksRemaining = 0; // NEW: Counter for critical tasks

  // All tasks from DB are now treated as fixed appointments since they will have start/end times
  const allTasksWithTimes: DBScheduledTask[] = dbTasks.filter(task => task.start_time && task.end_time);

  // Sort all tasks by their start time
  allTasksWithTimes.sort((a, b) => {
    const scheduledDateA = startOfDay(parseISO(a.scheduled_date));
    const utcStartA = parseISO(a.start_time!);
    const localTimeA = setHours(setMinutes(scheduledDateA, utcStartA.getUTCMinutes()), utcStartA.getUTCHours());

    const scheduledDateB = startOfDay(parseISO(b.scheduled_date));
    const utcStartB = parseISO(b.start_time!);
    const localTimeB = setHours(setMinutes(scheduledDateB, utcStartB.getUTCMinutes()), utcStartB.getUTCHours());

    return localTimeA.getTime() - localTimeB.getTime();
  });

  const selectedDayAsDate = parseISO(selectedDateString); // Parse selectedDateString once

  allTasksWithTimes.forEach(task => {
    const referenceDay = startOfDay(parseISO(task.scheduled_date)); 
    let startTime = parseISO(task.start_time!);
    let endTime = parseISO(task.end_time!);

    startTime = setHours(setMinutes(referenceDay, startTime.getMinutes()), startTime.getHours());
    endTime = setHours(setMinutes(referenceDay, endTime.getMinutes()), endTime.getHours());

    if (endTime.getTime() < startTime.getTime()) {
        endTime = addDays(endTime, 1);
    }

    // Check if task falls outside the workday window
    if (isBefore(startTime, workdayStartTime) || isAfter(endTime, workdayEndTime)) {
      unscheduledCount++;
    }

    // Increment critical tasks remaining if it's a critical task
    if (task.is_critical) {
      criticalTasksRemaining++;
    }

    const duration = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
    const isStandaloneBreak = task.name.toLowerCase() === 'break';

    scheduledItems.push({
      id: task.id, 
      type: isStandaloneBreak ? 'break' : 'task',
      name: task.name, 
      duration: duration, // Duration is derived from start_time and end_time
      startTime: startTime, 
      endTime: endTime, 
      emoji: isStandaloneBreak ? EMOJI_MAP['break'] : assignEmoji(task.name),
      description: isStandaloneBreak ? getBreakDescription(duration) : undefined,
      isTimedEvent: true, // All tasks from DB are now treated as timed events
      isCritical: task.is_critical, // Pass critical flag
      isFlexible: task.is_flexible, // Pass flexible flag
    });
    
    if (isStandaloneBreak || task.break_duration) { // If it's a break or has a break_duration, count it as break time
      totalBreakTime += duration;
      if (task.break_duration) totalBreakTime += task.break_duration; // Add explicit break duration if present
    } else {
      totalActiveTime += duration;
    }
  });

  // Final sort of all items (should already be sorted, but good to ensure)
  scheduledItems.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  // Determine session end based on the last scheduled item or start of the workday
  const sessionEnd = scheduledItems.length > 0 ? scheduledItems[scheduledItems.length - 1].endTime : workdayStartTime;
  const extendsPastMidnight = !isSameDay(sessionEnd, selectedDayAsDate) && scheduledItems.length > 0;
  const midnightRolloverMessage = extendsPastMidnight ? getMidnightRolloverMessage(sessionEnd, new Date()) : null; // Use new Date() for current moment check

  const summary: ScheduleSummary = {
    totalTasks: dbTasks.length, 
    activeTime: {
      hours: Math.floor(totalActiveTime / 60),
      minutes: totalActiveTime % 60,
    },
    breakTime: totalBreakTime,
    sessionEnd: sessionEnd,
    extendsPastMidnight: extendsPastMidnight,
    midnightRolloverMessage: midnightRolloverMessage,
    unscheduledCount: unscheduledCount, // Add to summary
    criticalTasksRemaining: criticalTasksRemaining, // NEW: Add to summary
  };

  return {
    items: scheduledItems,
    summary: summary,
    dbTasks: dbTasks, // Include the original dbTasks array
  };
};

/**
 * Compacts the schedule by moving flexible tasks forward to fill gaps.
 * Fixed appointments are not moved.
 * @param currentTasks The current list of DBScheduledTask objects.
 * @param selectedDate The date for which the schedule is being compacted.
 * @param workdayStartTime The start time of the user's workday.
 * @param workdayEndTime The end time of the user's workday.
 * @param T_current The current real-world time.
 * @returns An array of DBScheduledTask objects with updated start_time and end_time.
 */
export const compactScheduleLogic = (
  currentTasks: DBScheduledTask[],
  selectedDate: Date,
  workdayStartTime: Date,
  workdayEndTime: Date,
  T_current: Date
): DBScheduledTask[] => {
  const updatedTasks: DBScheduledTask[] = [];

  // Separate flexible and fixed tasks
  const flexibleTasks = currentTasks.filter(task => task.is_flexible);
  const fixedTasks = currentTasks.filter(task => !task.is_flexible);

  // Sort fixed tasks by their start time to establish immovable blocks
  fixedTasks.sort((a, b) => {
    const startA = parseISO(a.start_time!);
    const startB = parseISO(b.start_time!);
    return startA.getTime() - startB.getTime();
  });

  // Sort flexible tasks by their original start time (or creation time) to maintain relative order
  flexibleTasks.sort((a, b) => {
    const startA = parseISO(a.start_time!);
    const startB = parseISO(b.start_time!);
    return startA.getTime() - startB.getTime();
  });

  // Determine the starting point for compaction
  // It should be the later of the workday start or the current time (if today)
  let currentPlacementTime = isSameDay(selectedDate, T_current) && isAfter(T_current, workdayStartTime)
    ? T_current
    : workdayStartTime;

  // Ensure currentPlacementTime is not after workdayEndTime
  if (isAfter(currentPlacementTime, workdayEndTime)) {
    return currentTasks; // No compaction possible if starting point is past workday end
  }

  // Combine fixed and flexible tasks for processing, maintaining original order for fixed
  const allTasksForProcessing = [...fixedTasks, ...flexibleTasks].sort((a, b) => {
    const startA = parseISO(a.start_time!);
    const startB = parseISO(b.start_time!);
    return startA.getTime() - startB.getTime();
  });

  // Iterate through all tasks, placing fixed tasks and compacting flexible tasks
  for (const task of allTasksForProcessing) {
    if (!task.start_time || !task.end_time) {
      // Should not happen with current logic, but as a safeguard
      updatedTasks.push(task);
      continue;
    }

    const taskDuration = Math.floor((parseISO(task.end_time).getTime() - parseISO(task.start_time).getTime()) / (1000 * 60));
    const taskBreakDuration = task.break_duration || 0;
    const totalTaskDuration = taskDuration + taskBreakDuration;

    if (!task.is_flexible) {
      // Fixed tasks retain their original times, but we need to advance currentPlacementTime past them
      updatedTasks.push(task);
      const fixedTaskEndTime = parseISO(task.end_time);
      if (isAfter(fixedTaskEndTime, currentPlacementTime)) {
        currentPlacementTime = fixedTaskEndTime;
      }
    } else {
      // Flexible tasks are moved
      let newStartTime = currentPlacementTime;
      let newEndTime = addMinutes(newStartTime, totalTaskDuration);

      // Check for overlaps with fixed tasks
      let overlapDetected = false;
      for (const fixed of fixedTasks) {
        const fixedStart = parseISO(fixed.start_time!);
        const fixedEnd = parseISO(fixed.end_time!);

        // If the new flexible task overlaps with a fixed task
        if (
          (isBefore(newStartTime, fixedEnd) && isAfter(newEndTime, fixedStart)) || // Flexible task spans fixed task
          (isSameDay(newStartTime, fixedStart) && isSameDay(newEndTime, fixedEnd) && newStartTime.getTime() === fixedStart.getTime() && newEndTime.getTime() === fixedEnd.getTime()) // Exact overlap
        ) {
          overlapDetected = true;
          // Move currentPlacementTime past the fixed task and re-calculate
          currentPlacementTime = fixedEnd;
          newStartTime = currentPlacementTime;
          newEndTime = addMinutes(newStartTime, totalTaskDuration);
          break; // Re-check for overlaps with the new position
        }
      }

      // If after adjusting for fixed tasks, the task still fits within workday
      if (isBefore(newEndTime, workdayEndTime) || isSameDay(newEndTime, workdayEndTime)) {
        updatedTasks.push({
          ...task,
          start_time: newStartTime.toISOString(),
          end_time: newEndTime.toISOString(),
        });
        currentPlacementTime = newEndTime; // Advance cursor for next task
      } else {
        // Task cannot fit within the workday, mark as unscheduled or handle as needed
        // For now, we'll just skip adding it to the updated list if it doesn't fit
        // This means it will effectively be removed from the schedule for the day
        console.warn(`Flexible task "${task.name}" could not be compacted within the workday.`);
      }
    }
  }

  // Filter out any flexible tasks that couldn't be placed
  const finalCompactedTasks = updatedTasks.filter(task => {
    if (task.is_flexible) {
      // Check if its start_time is within the workday boundaries
      const taskStart = parseISO(task.start_time!);
      const taskEnd = parseISO(task.end_time!);
      return (isAfter(taskStart, workdayStartTime) || isSameDay(taskStart, workdayStartTime)) &&
             (isBefore(taskEnd, workdayEndTime) || isSameDay(taskEnd, workdayEndTime));
    }
    return true; // Keep fixed tasks
  });

  return finalCompactedTasks;
};