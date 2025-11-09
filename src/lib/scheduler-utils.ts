import { format, addMinutes, isPast, isToday, startOfDay, addDays } from 'date-fns';
import { RawTaskInput, ScheduledItem, ScheduledItemType, FormattedSchedule, ScheduleSummary, DBScheduledTask } from '@/types/scheduler';

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
    return `⚠️ Schedule extends into ${formatDayMonth(endDate)}`;
  }
  return null;
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
  let progressLineIndex = -1; // -1 means before the first item
  let progressLineMessage = `➡️ CURRENT PROGRESS - Time is ${formatTime(T_current)}`;

  dbTasks.forEach((task, index) => {
    // Add Task
    const taskStartTime = currentTime;
    const taskEndTime = addMinutes(taskStartTime, task.duration);
    scheduledItems.push({
      id: task.id, // Use Supabase ID
      type: 'task',
      name: task.name,
      duration: task.duration,
      startTime: taskStartTime,
      endTime: taskEndTime,
      emoji: assignEmoji(task.name),
    });
    currentTime = taskEndTime;
    totalActiveTime += task.duration;

    // If T_current is within this task or after it, update progressLineIndex
    if (T_current >= taskStartTime && T_current < taskEndTime) {
      progressLineIndex = scheduledItems.length - 1; // Line after this task
    } else if (T_current >= taskEndTime) {
      progressLineIndex = scheduledItems.length - 1; // Line after this task
    }

    // Add Break if specified
    if (task.break_duration && task.break_duration > 0) {
      const breakStartTime = currentTime;
      const breakEndTime = addMinutes(breakStartTime, task.break_duration);
      scheduledItems.push({
        id: `${task.id}-break`, // Derive unique ID for break
        type: 'break',
        name: 'BREAK',
        duration: task.break_duration,
        startTime: breakStartTime,
        endTime: breakEndTime,
        emoji: EMOJI_MAP['break'],
        description: getBreakDescription(task.break_duration),
      });
      currentTime = breakEndTime;
      totalBreakTime += task.break_duration;

      // If T_current is within this break or after it, update progressLineIndex
      if (T_current >= breakStartTime && T_current < breakEndTime) {
        progressLineIndex = scheduledItems.length - 1; // Line after this break
      } else if (T_current >= breakEndTime) {
        progressLineIndex = scheduledItems.length - 1; // Line after this break
      }
    }
  });

  // Final adjustments for progressLineIndex and message
  if (scheduledItems.length === 0) {
    progressLineIndex = 0; // Before any items (or no items)
    progressLineMessage = `✅ No tasks scheduled.`;
  } else if (progressLineIndex === -1) {
    // T_current is before the very first item
    const timeUntilFirstTask = Math.round((scheduledItems[0].startTime.getTime() - T_current.getTime()) / (1000 * 60));
    progressLineMessage = `⏳ Schedule starts in ${timeUntilFirstTask} minutes`;
  } else if (progressLineIndex === scheduledItems.length - 1 && T_current >= scheduledItems[scheduledItems.length - 1].endTime) {
    // T_current is after the very last item
    progressLineMessage = `✅ All tasks completed!`;
  }
  // Otherwise, progressLineIndex and message are already set correctly by the loop

  const sessionEnd = currentTime;
  const extendsPastMidnight = !isToday(sessionEnd) && scheduledItems.length > 0;
  const midnightRolloverMessage = extendsPastMidnight ? getMidnightRolloverMessage(sessionEnd, T_current) : null;

  const summary: ScheduleSummary = {
    totalTasks: dbTasks.length, // Use dbTasks.length for total tasks
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
    progressLineIndex: progressLineIndex,
    progressLineMessage: progressLineMessage,
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
export const parseTaskInput = (input: string): RawTaskInput | null => {
  // Regex for "Task Name Duration" or "Task Name Duration Break"
  const regex = /^(.*?)\s+(\d+)(?:\s+(\d+))?$/;
  const match = input.match(regex);

  if (match) {
    const name = match[1].trim();
    const duration = parseInt(match[2], 10);
    const breakDuration = match[3] ? parseInt(match[3], 10) : undefined;

    if (name && duration > 0) {
      return { name, duration, breakDuration };
    }
  }
  return null;
};

export const parseInjectionCommand = (input: string): { type: 'inject', taskName: string, duration?: number, breakDuration?: number } | null => {
  const injectRegex = /^inject\s+(.*?)(?:\s+duration\s+(\d+))?(?:\s+break\s+(\d+))?$/i;
  const match = input.match(injectRegex);

  if (match) {
    const taskName = match[1].trim();
    const duration = match[2] ? parseInt(match[2], 10) : undefined;
    const breakDuration = match[3] ? parseInt(match[3], 10) : undefined;
    return { type: 'inject', taskName, duration, breakDuration };
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