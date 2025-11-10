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
  'commute': 10, 'drive': 10, 'bus': 10, 'train': 10, 'travel': 200, // Reds/Blues
  'shop': 180, 'bank': 220, 'post': 240, 'errands': 210, // Cyan/Blues/Indigo
  'friends': 300, 'family': 300, 'social': 310, // Rose/Pink
  'wake up': 60, // Added 'wake up' hue (yellow/orange for morning)
  'coles': 180, // Added 'coles' with grocery hue
  'woolworths': 180, // Added 'woolworths' with grocery hue
  'lesson': 260, // Added 'lesson' hue (violet/purple for learning)
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
export const generateFixedTimeMarkers = (T_current: Date): TimeMarker[] => {
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
}

export const parseTaskInput = (input: string): ParsedTaskInput | null => {
  const now = new Date();
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
        return { name: cleanedTaskName, startTime, endTime };
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
      return { name, duration, breakDuration };
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
}

export const parseInjectionCommand = (input: string): ParsedInjectionCommand | null => {
  const injectRegex = /^inject\s+(.*?)(?:\s+(\d+)(?:\s+(\d+))?)?(?:\s+from\s+(\d{1,2}(:\d{2})?\s*(?:am|pm))\s+to\s+(\d{1,2}(:\d{2})?\s*(?:am|pm)))?$/i;
  const match = input.match(injectRegex);

  if (match) {
    const taskName = match[1].trim();
    const duration = match[2] ? parseInt(match[2], 10) : undefined;
    const breakDuration = match[3] ? parseInt(match[3], 10) : undefined;
    const startTime = match[4] ? match[4].trim() : undefined;
    const endTime = match[6] ? match[6].trim() : undefined;

    if (taskName) {
      return { taskName, duration, breakDuration, startTime, endTime };
    }
  }
  return null;
};

interface ParsedCommand {
  type: 'clear' | 'remove' | 'show' | 'reorder';
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

  return null;
};

// --- Core Scheduling Logic ---

export const calculateSchedule = (
  dbTasks: DBScheduledTask[],
  explicitTAnchor: Date | null, // This is tAnchorForSelectedDay from state
  currentMoment: Date, // This is T_current from state
  selectedDateString: string, // This is selectedDay from state
  workdayStartTime: Date, // New parameter
  workdayEndTime: Date   // New parameter
): FormattedSchedule => {
  const scheduledItems: ScheduledItem[] = [];
  let totalActiveTime = 0;
  let totalBreakTime = 0;
  let unscheduledCount = 0; // New counter for tasks outside workday window

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

    const duration = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
    const isStandaloneBreak = task.name.toLowerCase() === 'break';

    scheduledItems.push({
      id: task.id, 
      type: isStandaloneBreak ? 'break' : 'task',
      name: task.name, 
      duration: duration,
      startTime: startTime, 
      endTime: endTime, 
      emoji: isStandaloneBreak ? EMOJI_MAP['break'] : assignEmoji(task.name),
      description: isStandaloneBreak ? getBreakDescription(duration) : undefined,
      isTimedEvent: true, // All tasks from DB are now treated as timed events
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

  const sessionEnd = scheduledItems.length > 0 ? scheduledItems[scheduledItems.length - 1].endTime : (explicitTAnchor || currentMoment);
  const extendsPastMidnight = !isToday(sessionEnd) && scheduledItems.length > 0;
  const midnightRolloverMessage = extendsPastMidnight ? getMidnightRolloverMessage(sessionEnd, currentMoment) : null;

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
  };

  return {
    items: scheduledItems,
    summary: summary,
  };
};