import { format, addMinutes, isPast, isToday, startOfDay, addHours, addDays, parse } from 'date-fns'; // Added parse
import { RawTaskInput, ScheduledItem, ScheduledItemType, FormattedSchedule, ScheduleSummary, DBScheduledTask, TimeMarker, DisplayItem } from '@/types/scheduler';

// --- Constants ---
const EMOJI_MAP: { [key: string]: string } = {
  'gym': '🏋️', 'workout': '🏋️', 'run': '🏋️', 'exercise': '🏋️',
  'email': '📧', 'messages': '📧', 'calls': '📧', 'communication': '📧',
  'meeting': '💼', 'work': '💼', 'report': '💼', 'professional': '💼', 'project': '💼',
  'design': '🎨', 'writing': '🎨', 'art': '🎨', 'creative': '🎨',
  'study': '📚', 'reading': '📚', 'course': '📚', 'learn': '📚',
  'clean': '🧹', 'laundry': '🧹', 'organize': '🧹', 'household': '🧹',
  'cook': '🍳', 'meal prep': '🍳', 'groceries': '🍳', 'food': '🍳',
  'brainstorm': '💡', 'strategy': '💡', '💡review': '💡', 'plan': '💡',
  'gaming': '🎮', 'tv': '🎮', 'hobbies': '🎮', 'leisure': '🎮',
  'meditation': '🧘', 'yoga': '🧘', 'self-care': '🧘', 'wellness': '🧘',
  'break': '☕️', // Special emoji for breaks
};

const BREAK_DESCRIPTIONS: { [key: number]: string } = {
  5: "Quick stretch",
  10: "Stand and hydrate",
  15: "Walk around, refresh",
  20: "Proper rest, step outside",
  30: "Meal break, recharge",
};

const DEFAULT_EMOJI = '📋'; // Default for generic/ambiguous tasks

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
 * Generates fixed time markers for the 12 AM to 12 PM (noon) template.
 */
export const generateFixedTimeMarkers = (T_current: Date): TimeMarker[] => {
  const markers: TimeMarker[] = [];
  const startOfToday = startOfDay(T_current); // 12:00 AM today

  // Add 12 AM marker
  markers.push({ id: 'marker-0', type: 'marker', time: startOfToday, label: formatTime(startOfToday) });

  // Add markers every 3 hours until 12 PM
  for (let i = 3; i <= 12; i += 3) {
    const markerTime = addHours(startOfToday, i);
    markers.push({ id: `marker-${i}`, type: 'marker', time: markerTime, label: formatTime(markerTime) });
  }
  
  return markers;
};


// --- Core Scheduling Logic ---

export const calculateSchedule = (
  dbTasks: DBScheduledTask[], // Now accepts DBScheduledTask[]
  T_current: Date
): FormattedSchedule => {
  const scheduledItems: ScheduledItem[] = [];
  let currentTime = T_current;
  let totalActiveTime = 0;
  let totalBreakTime = 0;

  // Separate timed events from duration-based tasks
  const timedEvents: DBScheduledTask[] = [];
  const durationTasks: DBScheduledTask[] = [];

  dbTasks.forEach(task => {
    if (task.start_time && task.end_time) {
      timedEvents.push(task);
    } else {
      durationTasks.push(task);
    }
  });

  // Sort timed events by their start time
  timedEvents.sort((a, b) => new Date(a.start_time!).getTime() - new Date(b.start_time!).getTime());

  // Add timed events first
  timedEvents.forEach(task => {
    const startTime = new Date(task.start_time!);
    const endTime = new Date(task.end_time!);
    const duration = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));

    scheduledItems.push({
      id: task.id,
      type: 'task',
      name: task.name,
      duration: duration,
      startTime: startTime,
      endTime: endTime,
      emoji: assignEmoji(task.name),
      isTimedEvent: true, // Mark as timed event
      color: 'bg-blue-500', // Default color for timed events
    });
    totalActiveTime += duration;
  });

  // Now, schedule duration-based tasks sequentially after the current time,
  // avoiding overlaps with already scheduled timed events.
  // This logic needs to be more sophisticated to truly "queue around" timed events.
  // For simplicity, we'll append them after the last timed event or T_current.
  
  // Find the latest end time among all currently scheduled items (timed events + T_current)
  let sequentialCursor = T_current;
  if (scheduledItems.length > 0) {
    const lastScheduledItem = scheduledItems[scheduledItems.length - 1];
    if (lastScheduledItem.endTime.getTime() > sequentialCursor.getTime()) {
      sequentialCursor = lastScheduledItem.endTime;
    }
  }

  durationTasks.forEach(task => {
    const taskStartTime = sequentialCursor;
    const taskEndTime = addMinutes(taskStartTime, task.duration!); // duration is not null for duration tasks

    scheduledItems.push({
      id: task.id,
      type: 'task',
      name: task.name,
      duration: task.duration!,
      startTime: taskStartTime,
      endTime: taskEndTime,
      emoji: assignEmoji(task.name),
      isTimedEvent: false, // Mark as not a timed event
    });
    sequentialCursor = taskEndTime;
    totalActiveTime += task.duration!;

    // Add Break if specified
    if (task.break_duration && task.break_duration > 0) {
      const breakStartTime = sequentialCursor;
      const breakEndTime = addMinutes(breakStartTime, task.break_duration);
      scheduledItems.push({
        id: `${task.id}-break`,
        type: 'break',
        name: 'BREAK',
        duration: task.break_duration,
        startTime: breakStartTime,
        endTime: breakEndTime,
        emoji: EMOJI_MAP['break'],
        description: getBreakDescription(task.break_duration),
        isTimedEvent: false, // Mark as not a timed event
      });
      sequentialCursor = breakEndTime;
      totalBreakTime += task.break_duration;
    }
  });

  // Re-sort all items by start time to ensure correct display order
  scheduledItems.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  const sessionEnd = scheduledItems.length > 0 ? scheduledItems[scheduledItems.length - 1].endTime : T_current;
  const extendsPastMidnight = !isToday(sessionEnd) && scheduledItems.length > 0;
  const midnightRolloverMessage = extendsPastMidnight ? getMidnightRolloverMessage(sessionEnd, T_current) : null;

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
  };

  return {
    items: scheduledItems,
    summary: summary,
  };
};

// --- Smart Suggestions ---
export const getSmartSuggestions = (totalScheduledMinutes: number): string[] => {
  const suggestions: string[] = [];
  if (totalScheduledMinutes < 6 * 60) { // Less than 6 hours
    suggestions.push("💡 Light day! Consider adding buffer time for flexibility.");
  }
  if (totalScheduledMinutes > 12 * 60) { // More than 12 hours
    suggestions.push("⚠️ Intense schedule. Remember to include meals and rest.");
  }
  return suggestions;
};

// --- Input Parsing ---
// Updated to handle timed events like "mindfulness 11am - 12pm"
export const parseTaskInput = (input: string): RawTaskInput | { name: string, startTime: string, endTime: string } | null => {
  // Regex for "Task Name Duration" or "Task Name Duration Break"
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

  // Regex for "Task Name HH:MM AM/PM - HH:MM AM/PM"
  const timedRegex = /^(.*?)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))$/i;
  const timedMatch = input.match(timedRegex);

  if (timedMatch) {
    const name = timedMatch[1].trim();
    const startTime = timedMatch[2].trim();
    const endTime = timedMatch[3].trim();

    // Basic validation for time format (can be enhanced)
    try {
      const parsedStartTime = parse(startTime, 'h:mm a', new Date());
      const parsedEndTime = parse(endTime, 'h:mm a', new Date());
      if (isNaN(parsedStartTime.getTime()) || isNaN(parsedEndTime.getTime())) {
        throw new Error("Invalid time format");
      }
      return { name, startTime, endTime };
    } catch (e) {
      console.error("Error parsing timed event:", e);
      return null;
    }
  }

  return null;
};

export const parseInjectionCommand = (input: string): { type: 'inject', taskName: string, duration?: number, breakDuration?: number, startTime?: string, endTime?: string } | null => {
  // Regex for duration-based injection: "inject Task Name duration X break Y"
  const injectDurationRegex = /^inject\s+(.*?)(?:\s+duration\s+(\d+))?(?:\s+break\s+(\d+))?$/i;
  const injectDurationMatch = input.match(injectDurationRegex);

  if (injectDurationMatch) {
    const taskName = injectDurationMatch[1].trim();
    const duration = injectDurationMatch[2] ? parseInt(injectDurationMatch[2], 10) : undefined;
    const breakDuration = injectDurationMatch[3] ? parseInt(injectDurationMatch[3], 10) : undefined;
    return { type: 'inject', taskName, duration, breakDuration };
  }

  // Regex for timed event injection: "inject Task Name from HH:MM AM/PM to HH:MM AM/PM"
  const injectTimedRegex = /^inject\s+(.*?)\s+from\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s+to\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm))$/i;
  const injectTimedMatch = input.match(injectTimedRegex);

  if (injectTimedMatch) {
    const taskName = injectTimedMatch[1].trim();
    const startTime = injectTimedMatch[2].trim();
    const endTime = injectTimedMatch[3].trim();
    return { type: 'inject', taskName, startTime, endTime };
  }

  return null;
};

export const parseCommand = (input: string): { type: 'clear' | 'remove' | 'show' | 'reorder', target?: string, index?: number } | null => {
  const lowerInput = input.toLowerCase();
  if (lowerInput === 'clear queue') {
    return { type: 'clear' };
  }
  // New: remove by index
  const removeIndexMatch = lowerInput.match(/^remove\s+index\s+(\d+)$/);
  if (removeIndexMatch) {
    return { type: 'remove', index: parseInt(removeIndexMatch[1], 10) - 1 }; // Convert to 0-based index
  }
  // Existing: remove by name (can be made more precise later if needed, for now keep includes)
  if (lowerInput.startsWith('remove ')) {
    const target = input.substring('remove '.length).trim();
    return { type: 'remove', target };
  }
  if (lowerInput === 'show queue') {
    return { type: 'show' };
  }
  if (lowerInput === 'reorder') {
    return { type: 'reorder' }; // Not implemented yet, but recognized
  }
  return null;
};