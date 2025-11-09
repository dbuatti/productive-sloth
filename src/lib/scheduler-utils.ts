import { format, addMinutes, isPast, isToday, startOfDay, addDays } from 'date-fns';
import { RawTaskInput, ScheduledItem, ScheduledItemType, FormattedSchedule, ScheduleSummary } from '@/types/scheduler';

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
  rawTasks: RawTaskInput[],
  T_current: Date
): FormattedSchedule => {
  const scheduledItems: ScheduledItem[] = [];
  let currentTime = T_current;
  let totalActiveTime = 0;
  let totalBreakTime = 0;
  let progressLineIndex = -1;
  let progressLineMessage = `➡️ CURRENT PROGRESS - Time is ${formatTime(T_current)}`;

  rawTasks.forEach((task, index) => {
    // Add Task
    const taskStartTime = currentTime;
    const taskEndTime = addMinutes(taskStartTime, task.duration);
    scheduledItems.push({
      id: `task-${index}-${task.name.replace(/\s/g, '-')}`,
      type: 'task',
      name: task.name,
      duration: task.duration,
      startTime: taskStartTime,
      endTime: taskEndTime,
      emoji: assignEmoji(task.name),
    });
    currentTime = taskEndTime;
    totalActiveTime += task.duration;

    // Check if this task's end time is past T_current for progress line
    if (isPast(taskEndTime) && progressLineIndex === -1) {
      progressLineIndex = scheduledItems.length - 1;
    }

    // Add Break if specified
    if (task.breakDuration && task.breakDuration > 0) {
      const breakStartTime = currentTime;
      const breakEndTime = addMinutes(breakStartTime, task.breakDuration);
      scheduledItems.push({
        id: `break-${index}-${task.name.replace(/\s/g, '-')}`,
        type: 'break',
        name: 'BREAK',
        duration: task.breakDuration,
        startTime: breakStartTime,
        endTime: breakEndTime,
        emoji: EMOJI_MAP['break'],
        description: getBreakDescription(task.breakDuration),
      });
      currentTime = breakEndTime;
      totalBreakTime += task.breakDuration;

      // Check if this break's end time is past T_current for progress line
      if (isPast(breakEndTime) && progressLineIndex === -1) {
        progressLineIndex = scheduledItems.length - 1;
      }
    }
  });

  // Handle progress line if no tasks are past T_current
  if (progressLineIndex === -1) {
    if (scheduledItems.length > 0) {
      progressLineIndex = -1; // Before the first item
      const timeUntilFirstTask = Math.round((scheduledItems[0].startTime.getTime() - T_current.getTime()) / (1000 * 60));
      progressLineMessage = `⏳ Schedule starts in ${timeUntilFirstTask} minutes`;
    } else {
      progressLineIndex = 0; // At the very beginning if no tasks
      progressLineMessage = `✅ No tasks scheduled.`;
    }
  }

  const sessionEnd = currentTime;
  const extendsPastMidnight = !isToday(sessionEnd) && scheduledItems.length > 0;
  const midnightRolloverMessage = extendsPastMidnight ? getMidnightRolloverMessage(sessionEnd, T_current) : null;

  const summary: ScheduleSummary = {
    totalTasks: rawTasks.length,
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

export const parseCommand = (input: string): { type: 'clear' | 'remove' | 'show' | 'reorder', target?: string } | null => {
  const lowerInput = input.toLowerCase();
  if (lowerInput === 'clear queue') {
    return { type: 'clear' };
  }
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