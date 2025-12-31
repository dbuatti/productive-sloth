import { format, addMinutes, isPast, isToday, startOfDay, addHours, addDays, parse, parseISO, setHours, setMinutes, isSameDay, isBefore, isAfter, isPast as isPastDate, differenceInMinutes, min, max } from 'https://esm.sh/date-fns@2.30.0';
import { TimeBlock, DBScheduledTask, NewRetiredTask, ScheduledItem, ScheduledItemType, FormattedSchedule, ScheduleSummary } from './types.ts'; // Importing from shared types

// --- Constants ---
export const MEAL_KEYWORDS = ['cook', 'meal prep', 'groceries', 'food', '🍔', 'lunch', 'dinner', 'breakfast', 'snack', 'eat', 'coffee break'];

export const EMOJI_MAP: { [key: string]: string } = {
  'gym': '🏋️', 'workout': '🏋️', 'run': '🏃', 'exercise': '🏋️', 'fitness': '💪',
  'email': '📧', 'messages': '💬', 'calls': '📞', 'communication': '🗣️', 'admin': '⚙️', 'paperwork': '📄',
  'meeting': '💼', 'work': '💻', 'report': '📝', 'professional': '👔', 'project': '📊', 'coding': '💻', 'develop': '💻', 'code': '💻', 'bug': '🐛', 'fix': '🛠️',
  'design': '🎨', 'writing': '✍️', 'art': '🖼️', 'creative': '✨', 'draw': '✏️',
  'study': '📦',
  'reading': '📖', 'course': '🎓', 'learn': '🧠', 'class': '🏫', 'lecture': '🧑‍🏫',
  'clean': '🧹', 'laundry': '🧺', 'organize': '🗄️', 'household': '🏠', 'setup': '🛠️',
  'cook': '🍳', 'meal prep': '🍲', 'groceries': '🛒', 'food': '🍔', 'lunch': '🥗', 'dinner': '🍽️', 'breakfast': '🥞', 'snack': '🍎', 'eat': '🍎',
  'brainstorm': '💡', 'strategy': '📈', 'review': '🔍', 'plan': '🗓️',
  'gaming': '🎮', 'hobbies': '🎲', 'leisure': '😌', 'movie': '🎬', 'relax': '🧘', 'chill': '🛋️',
  'meditation': '🧘', 'yoga': '🧘', 'self-care': '🛀', 'wellness': '🌸', 'mindfulness': '🧠', 'nap': '😴', 'rest': '🛌',
  'break': '☕️', 'coffee': '☕️', 'walk': '🚶', 'stretch': '🤸', 'coffee break': '☕️',
  'piano': '🎹', 'music': '🎶', 'practice': '🎼',
  'commute': '🚗', 'drive': '🚗', 'bus': '🚌', 'train': '🚆', 'travel': '✈️',
  'shop': '🛍️', 'bank': '🏦', 'post': '✉️', 'errands': '🏃‍♀️',
  'friends': '🧑‍🤝‍🧑', 'family': '👨‍👩‍👧‍👦', 'social': '🎉',
  'wake up': '⏰',
  'coles': '🛒',
  'woolworths': '🛒',
  'lesson': '🧑‍🏫',
  'call': '📞',
  'phone': '📱',
  'text': '💬',
  'contact': '🤝',
  'student': '🧑‍🎓',
  'rehearsal': '🎭',
  'time off': '🌴',
  'message': '💬',
  'journal': '✍️',
  'washing': '👕',
  'money': '💰', 'transactions': '💰',
  'mop': '🪣', 'floor': '🪣',
  'quote': '🧾', 'send quote': '🧾', 'generate quote': '🧾',
  'doctor': '🩺', 'medical': '🩺',
  'channel': '🧘', 'anxious': '🧘',
  'recycling': '♻️', 'bin': '♻️',
  'milk': '🥛', 'cartons': '🥛',
  'sync': '🤝', 'standup': '🤝',
  'tutorial': '💡',
  'tv': '📺',
  'cobweb': '🕸️',
  'cables': '🔌',
  'fold laundry': '🧺',
  'load of laundry': '🧺',
  'tidy': '🗄️',
  'room': '🏠',
  'book': '📅',
  'waitress': '📅',
  'preparation': '📝',
  'lego': '🧩',
  'organise': '🗄️',
  'shirts': '👕',
  'gigs': '🎤',
  'charge': '🔌',
  'vacuum': '🔌',
  'put away': '📦',
  'sheets': '📦',
  'pants': '📦',
  'medication': '💊',
  'toothbrush': '💊',
  'return message': '💬',
  'voice deal': '🎤',
  'find location': '🗺️',
  'broom': '🧹',
  'practise': '🎹',
  'track': '🎼',
  'catch up': '🤝',
  'trim': '💅',
  'cuticle': '💅',
  'payment': '💸',
  'link': '🔗',
  'send': '📧',
  'voice notes': '🎙️',
  'job notes': '📝',
  'process': '⚙️',
  'usb': '🔌',
  'cable': '🔌',
  'coil': '🔌',
  'write up': '✍️',
  'notes': '📝',
};

export const EMOJI_HUE_MAP: { [key: string]: number } = {
  'gym': 200, 'workout': 200, 'run': 210, 'exercise': 200, 'fitness': 200,
  'email': 240, 'messages': 245, 'calls': 250, 'communication': 240, 'admin': 270, 'paperwork': 230,
  'meeting': 280, 'work': 210, 'report': 230, 'professional': 280, 'project': 290, 'coding': 210, 'develop': 210, 'code': 210, 'bug': 90, 'fix': 40,
  'design': 320, 'writing': 320, 'art': 330, 'creative': 340, 'draw': 320,
  'study': 150,
  'reading': 260, 'course': 260, 'learn': 270, 'class': 260, 'lecture': 260,
  'clean': 120, 'laundry': 130, 'organize': 140, 'household': 120, 'setup': 40,
  'cook': 30, 'meal prep': 35, 'groceries': 180, 'food': 25, 'lunch': 45, 'dinner': 10, 'breakfast': 50, 'snack': 350, 'eat': 35,
  'brainstorm': 60, 'strategy': 70, 'review': 80, 'plan': 220,
  'gaming': 0, 'hobbies': 20, 'leisure': 150, 'movie': 0, 'relax': 160, 'chill': 150, 
  'meditation': 160, 'yoga': 160, 'self-care': 300, 'wellness': 170, 'mindfulness': 160, 'nap': 20, 'rest': 150,
  'break': 40, 'coffee': 30, 'walk': 100, 'stretch': 110, 'coffee break': 30,
  'piano': 270, 'music': 270, 'practice': 270,
  'commute': 10, 'drive': 10, 'bus': 10, 'train': 10, 'travel': 200,
  'shop': 180, 'bank': 220, 'post': 240, 'errands': 210,
  'friends': 300, 'family': 300, 'social': 310,
  'wake up': 60,
  'coles': 180,
  'woolworths': 180,
  'lesson': 260,
  'call': 250,
  'phone': 255,
  'text': 245,
  'contact': 290,
  'student': 265,
  'rehearsal': 315,
  'time off': 100,
  'message': 245,
  'journal': 320,
  'washing': 200,
  'money': 60, 'transactions': 60,
  'mop': 120, 'floor': 120,
  'quote': 230, 'send quote': 230, 'generate quote': 230,
  'doctor': 300, 'medical': 300,
  'channel': 160, 'anxious': 160,
  'recycling': 140, 'bin': 140,
  'milk': 40, 'cartons': 40,
  'sync': 290, 'standup': 290,
  'tutorial': 60,
  'tv': 10,
  'cobweb': 120,
  'cables': 210,
  'fold laundry': 130,
  'load of laundry': 130,
  'tidy': 140,
  'room': 150,
  'book': 220,
  'waitress': 220,
  'preparation': 220,
  'lego': 100,
  'organise': 200,
  'shirts': 200,
  'gigs': 200,
  'charge': 210,
  'vacuum': 210,
  'put away': 140,
  'sheets': 140,
  'pants': 140,
  'medication': 300,
  'toothbrush': 300,
  'return message': 245,
  'voice deal': 270,
  'find location': 140,
  'broom': 120,
  'practise': 270,
  'track': 270,
  'catch up': 290,
  'trim': 330,
  'cuticle': 330,
  'payment': 60,
  'link': 60,
  'send': 270,
  'voice notes': 320,
  'job notes': 230,
  'process': 230,
  'usb': 210,
  'cable': 210,
  'coil': 210,
  'write up': 320,
  'notes': 320,
};

// --- Utility Functions ---

export const formatTime = (date: Date): string => format(date, 'h:mm a');
export const formatDayMonth = (date: Date): string => format(date, 'MMM d');
export const formatDateTime = (date: Date): string => format(date, 'MMM d, h:mm a');

export const setTimeOnDate = (date: Date, timeString: string): Date => {
  const [hours, minutes] = timeString.split(':').map(Number);
  // Use local setters for consistency with local time display
  return setMinutes(setHours(date, hours), minutes);
};

export const assignEmoji = (taskName: string): string => {
  const lowerCaseTaskName = taskName.toLowerCase();
  for (const keyword in EMOJI_MAP) {
    if (lowerCaseTaskName.includes(keyword)) {
      return EMOJI_MAP[keyword];
    }
  }
  return '📋'; // Default emoji
};

export const getEmojiHue = (taskName: string): number => {
  const lowerCaseTaskName = taskName.toLowerCase();
  for (const keyword in EMOJI_HUE_MAP) {
    if (lowerCaseTaskName.includes(keyword)) {
      return EMOJI_HUE_MAP[keyword];
    }
  }
  return 220; // Default hue (blue)
};

export const getBreakDescription = (duration: number): string => {
  if (duration <= 5) return "Quick Stretch";
  if (duration <= 15) return "Coffee Break";
  if (duration <= 30) return "Mindful Pause";
  return "Extended Break";
};

export const isMeal = (taskName: string): boolean => {
  const lowerCaseTaskName = taskName.toLowerCase();
  return MEAL_KEYWORDS.some(keyword => lowerCaseTaskName.includes(keyword));
};

export const calculateEnergyCost = (duration: number, isCritical: boolean, isBackburner: boolean = false): number => {
  // Meals provide positive energy
  if (isMeal('meal')) { // Check against a generic meal keyword or rely on the caller to pass a meal task name
    return -10; // Fixed positive energy gain (e.g., +10 Energy)
  }

  let baseCost = Math.ceil(duration / 15) * 5; // 5 energy per 15 minutes
  
  if (isCritical) {
    baseCost = Math.ceil(baseCost * 1.5); // Critical tasks cost 50% more energy
  } else if (isBackburner) {
    // Backburner tasks cost 25% less energy
    baseCost = Math.ceil(baseCost * 0.75);
  }
  
  return Math.max(5, baseCost); // Minimum energy cost of 5
};

export const parseFlexibleTime = (timeString: string, baseDate: Date): Date => {
  const lowerCaseTimeString = timeString.toLowerCase();
  let parsedDate: Date;

  // Try parsing with h:mma (e.g., "12:15pm", "1am")
  parsedDate = parse(lowerCaseTimeString, 'h:mma', baseDate);
  if (!isNaN(parsedDate.getTime())) return parsedDate;

  // Try parsing with h:mm a (e.g., "12:15 pm", "1 am")
  parsedDate = parse(lowerCaseTimeString, 'h:mm a', baseDate);
  if (!isNaN(parsedDate.getTime())) return parsedDate;

  // Try parsing with ha (e.g., "12pm", "1am")
  parsedDate = parse(lowerCaseTimeString, 'ha', baseDate);
  if (!isNaN(parsedDate.getTime())) return parsedDate;

  // Try parsing 24-hour format (e.g., "13:00", "09:30")
  parsedDate = parse(lowerCaseTimeString, 'HH:mm', baseDate);
  if (!isNaN(parsedDate.getTime())) return parsedDate;

  // Try parsing simple hour inputs (e.g., "9", "14")
  const hourMatch = lowerCaseTimeString.match(/^(\d{1,2})$/);
  if (hourMatch) {
    const hour = parseInt(hourMatch[1], 10);
    if (hour >= 0 && hour <= 23) {
      return setHours(setMinutes(baseDate, 0), hour);
    }
  }

  // If all parsing attempts fail, log an error and return the baseDate
  console.error(`Failed to parse time string "${timeString}". Returning baseDate.`);
  return baseDate; // Fallback to baseDate, not current time
};

export const parseTaskInput = (input: string, selectedDayAsDate: Date): {
  name: string;
  duration?: number;
  breakDuration?: number;
  startTime?: Date;
  endTime?: Date;
  isCritical: boolean;
  isFlexible: boolean;
  isBackburner: boolean; // NEW: Backburner flag
  shouldSink: boolean;
  energyCost: number;
} | null => {
  let rawInput = input.trim();
  let lowerInput = rawInput.toLowerCase();
  let isCritical = false;
  let isBackburner = false; // NEW: Backburner flag
  let shouldSink = false;
  let isFlexible = true; // Default to flexible

  // Check for critical flag (suffix)
  if (lowerInput.endsWith(' !')) {
    isCritical = true;
    rawInput = rawInput.slice(0, -2).trim();
    lowerInput = rawInput.toLowerCase();
  }

  // Check for Backburner flag (prefix)
  if (lowerInput.startsWith('-')) {
    isBackburner = true;
    rawInput = rawInput.slice(1).trim();
    lowerInput = rawInput.toLowerCase();
  }

  // Check for sink flag (suffix)
  if (lowerInput.endsWith(' sink')) {
    shouldSink = true;
    rawInput = rawInput.slice(0, -5).trim();
    lowerInput = rawInput.toLowerCase();
  }

  // Check for fixed flag (suffix)
  if (lowerInput.endsWith(' fixed')) {
    isFlexible = false;
    rawInput = rawInput.slice(0, -6).trim();
    lowerInput = rawInput.toLowerCase();
  }
  
  // Re-check for critical/backburner after removing other suffixes
  if (rawInput.endsWith(' !')) {
    isCritical = true;
    rawInput = rawInput.slice(0, -2).trim();
    lowerInput = rawInput.toLowerCase();
  }
  if (rawInput.startsWith('-')) {
    isBackburner = true;
    rawInput = rawInput.slice(1).trim();
    lowerInput = rawInput.toLowerCase();
  }
  
  // Time Off (always fixed, no energy cost)
  const timeOffMatch = rawInput.match(/^(time off)\s+(\d{1,2}(:\d{2})?\s*(am|pm)?)\s*-\s*(\d{1,2}(:\d{2})?\s*(am|pm)?)$/i);
  if (timeOffMatch) {
    const name = timeOffMatch[1];
    const startTimeString = timeOffMatch[2];
    const endTimeString = timeOffMatch[5];

    const startTime = parseFlexibleTime(startTimeString, selectedDayAsDate);
    const endTime = parseFlexibleTime(endTimeString, selectedDayAsDate);

    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      return null;
    }

    return {
      name: name,
      startTime: startTime,
      endTime: endTime,
      isCritical: false,
      isBackburner: false,
      isFlexible: false, // Time Off is always fixed
      shouldSink: false,
      energyCost: 0, // Time Off has no energy cost
    };
  }

  // Timed task: "Task Name 10am-11am"
  const timeRangeMatch = rawInput.match(/^(.*?)\s+(\d{1,2}(:\d{2})?\s*(am|pm)?)\s*-\s*(\d{1,2}(:\d{2})?\s*(am|pm)?)$/i);
  if (timeRangeMatch) {
    const name = timeRangeMatch[1].trim();
    const startTimeString = timeRangeMatch[2];
    const endTimeString = timeRangeMatch[5];

    const startTime = parseFlexibleTime(startTimeString, selectedDayAsDate);
    const endTime = parseFlexibleTime(endTimeString, selectedDayAsDate);

    if (name && !isNaN(startTime.getTime()) && !isNaN(endTime.getTime())) {
      const duration = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
      
      const isMealTask = isMeal(name);
      const energyCost = isMealTask ? -10 : calculateEnergyCost(duration, isCritical, isBackburner);

      return { name, startTime, endTime, isCritical, isBackburner, isFlexible: false, shouldSink, energyCost }; // Timed tasks are implicitly fixed
    }
  }

  // Duration-based task: "Task Name 60 [10]"
  const durationMatch = rawInput.match(/^(.*?)\s+(\d+)(?:\s+(\d+))?$/);
  if (durationMatch) {
    const name = durationMatch[1].trim();
    const duration = parseInt(durationMatch[2], 10);
    const breakDuration = durationMatch[3] ? parseInt(durationMatch[3], 10) : undefined;

    if (name && duration > 0) {
      const isMealTask = isMeal(name);
      const energyCost = isMealTask ? -10 : calculateEnergyCost(duration, isCritical, isBackburner);
      return { name, duration, breakDuration, isCritical, isBackburner, isFlexible, shouldSink, energyCost };
    }
  }

  return null;
};

export const parseInjectionCommand = (input: string): {
  taskName: string;
  duration?: number;
  breakDuration?: number;
  startTime?: string;
  endTime?: string;
  isCritical?: boolean;
  isFlexible?: boolean;
  isBackburner?: boolean; // NEW: Backburner flag
  energyCost: number;
} | null => {
  const lowerInput = input.toLowerCase().trim();
  // Regex updated to capture the Backburner flag (-) and ensure it's handled correctly
  const injectMatch = lowerInput.match(/^inject\s+"([^"]+)"(?:\s+(\d+))?(?:\s+(\d{1,2}(:\d{2})?\s*(am|pm)?))?(?:\s*-\s*(\d{1,2}(:\d{2})?\s*(am|pm)?))?(?:\s+(!))?(?:\s+(-))?(?:\s+(fixed))?$/);

  if (injectMatch) {
    const taskName = injectMatch[1];
    const duration = injectMatch[2] ? parseInt(injectMatch[2], 10) : undefined;
    const startTime = injectMatch[3] || undefined;
    const endTime = injectMatch[6] || undefined;
    const isCritical = !!injectMatch[9];
    const isBackburner = !!injectMatch[10]; // Capture the Backburner flag
    const isFlexible = !injectMatch[11]; // If 'fixed' flag is present, it's not flexible

    let calculatedEnergyCost = 0;
    const isMealTask = isMeal(taskName);

    if (isMealTask) {
      calculatedEnergyCost = -10;
    } else if (duration) {
      calculatedEnergyCost = calculateEnergyCost(duration, isCritical, isBackburner);
    } else {
      calculatedEnergyCost = calculateEnergyCost(30, isCritical, isBackburner); // Default for unknown duration
    }

    return {
      taskName,
      duration,
      startTime,
      endTime,
      isCritical,
      isBackburner,
      isFlexible,
      energyCost: calculatedEnergyCost,
    };
  }
  return null;
};

export const parseCommand = (input: string): { type: string; target?: string; index?: number; duration?: number } | null => {
  const lowerInput = input.toLowerCase().trim();

  if (lowerInput === 'clear') {
    return { type: 'clear' };
  }
  if (lowerInput.startsWith('remove')) {
    const parts = lowerInput.split(' ');
    if (parts.length > 1) {
      if (parts[1] === 'index' && parts.length > 2) {
        const index = parseInt(parts[2], 10);
        if (!isNaN(index)) {
          return { type: 'remove', index: index - 1 }; // Convert to 0-based index
        }
      } else {
        return { type: 'remove', target: parts.slice(1).join(' ') };
      }
    }
  }
  if (lowerInput === 'show') {
    return { type: 'show' };
  }
  if (lowerInput === 'reorder') {
    return { type: 'reorder' };
  }
  if (lowerInput === 'time off') {
    return { type: 'timeoff' };
  }
  if (lowerInput === 'compact') {
    return { type: 'compact' };
  }
  if (lowerInput === 'aether dump' || lowerInput === 'reset schedule') {
    return { type: 'aether dump' };
  }
  if (lowerInput === 'aether dump mega') {
    return { type: 'aether dump mega' };
  }
  if (lowerInput.startsWith('break')) {
    const parts = lowerInput.split(' ');
    if (parts.length > 1) {
      const duration = parseInt(parts[1], 10);
      if (!isNaN(duration) && duration > 0) {
        return { type: 'break', duration: duration };
      }
    }
    return { type: 'break', duration: 15 }; // Default to 15 min break
  }
  return null;
};

export const parseSinkTaskInput = (input: string, userId: string): NewRetiredTask | null => {
  let name = input.trim();
  let duration: number | null = null;
  let isCritical = false;
  let isBackburner = false; // NEW: Backburner flag

  // Check for critical flag (suffix)
  if (name.endsWith(' !')) {
    isCritical = true;
    name = name.slice(0, -2).trim();
  }

  // Check for Backburner flag (prefix)
  if (name.startsWith('-')) {
    isBackburner = true;
    name = name.slice(1).trim();
  }

  // Check for duration
  const durationMatch = name.match(/^(.*?)\s+(\d+)$/);
  if (durationMatch) {
    name = durationMatch[1].trim();
    duration = parseInt(durationMatch[2], 10);
  }

  if (!name) return null;

  const isMealTask = isMeal(name);
  const energyCost = isMealTask ? -10 : calculateEnergyCost(duration || 30, isCritical, isBackburner); // Default to 30 min if no duration

  return {
    user_id: userId,
    name: name,
    duration: duration,
    break_duration: null, // Default to no break for sink tasks
    original_scheduled_date: format(new Date(), 'yyyy-MM-dd'), // Default to today
    is_critical: isCritical,
    is_locked: false,
    energy_cost: energyCost,
    is_completed: false,
    is_custom_energy_cost: false,
    task_environment: 'laptop', // Default environment for sink tasks
    is_backburner: isBackburner, // NEW: Include backburner status
  };
};

export const mergeOverlappingTimeBlocks = (blocks: TimeBlock[]): TimeBlock[] => {
  if (blocks.length === 0) return [];

  // Sort blocks by start time
  blocks.sort((a, b) => a.start.getTime() - b.start.getTime());

  const merged: TimeBlock[] = [];
  let currentMergedBlock = { ...blocks[0] };

  for (let i = 1; i < blocks.length; i++) {
    const nextBlock = blocks[i];

    // If the current merged block overlaps with the next block
    if (currentMergedBlock.end >= nextBlock.start) {
      // Extend the current merged block to include the next block's end time
      currentMergedBlock.end = new Date(Math.max(currentMergedBlock.end.getTime(), nextBlock.end.getTime()));
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

export const getFreeTimeBlocks = (
  occupiedBlocks: TimeBlock[],
  workdayStart: Date,
  workdayEnd: Date
): TimeBlock[] => {
  const freeBlocks: TimeBlock[] = [];
  let currentFreeTimeCursor = workdayStart;

  const sortedOccupiedBlocks = mergeOverlappingTimeBlocks(occupiedBlocks);

  for (const occupiedBlock of sortedOccupiedBlocks) {
    // If there's a gap between the current cursor and the start of the occupied block
    if (currentFreeTimeCursor < occupiedBlock.start) {
      const duration = Math.floor((occupiedBlock.start.getTime() - currentFreeTimeCursor.getTime()) / (1000 * 60));
      if (duration > 0) {
        freeBlocks.push({
          start: currentFreeTimeCursor,
          end: occupiedBlock.start,
          duration: duration,
        });
      }
    }
    // Move the cursor past the end of the occupied block
    currentFreeTimeCursor = new Date(Math.max(currentFreeTimeCursor.getTime(), occupiedBlock.end.getTime()));
  }

  // Add any remaining free time after the last occupied block until workday end
  if (currentFreeTimeCursor < workdayEnd) {
    const duration = Math.floor((workdayEnd.getTime() - currentFreeTimeCursor.getTime()) / (1000 * 60));
    if (duration > 0) {
      freeBlocks.push({
        start: currentFreeTimeCursor,
        end: workdayEnd,
        duration: duration,
      });
    }
  }

  return freeBlocks;
};

export const isSlotFree = (
  proposedStart: Date,
  proposedEnd: Date,
  occupiedBlocks: TimeBlock[]
): boolean => {
  for (const block of occupiedBlocks) {
    // Check for overlap: (start1 < end2) && (end1 > start2)
    if (proposedStart < block.end && proposedEnd > block.start) {
      return false; // Overlaps with an existing block
    }
  }
  return true; // No overlap found
};

export const compactScheduleLogic = (
  dbTasks: DBScheduledTask[],
  selectedDayAsDate: Date,
  workdayStartTime: Date,
  workdayEndTime: Date,
  T_current: Date,
  additionalOccupiedBlocks: TimeBlock[] = [], // NEW: Add additional occupied blocks
  tasksToPlace?: DBScheduledTask[] // Optional: specific tasks to place, if not all flexible tasks
): DBScheduledTask[] => {
  const isTodaySelected = isSameDay(selectedDayAsDate, T_current);
  const effectiveWorkdayStart = isTodaySelected && isBefore(workdayStartTime, T_current) ? T_current : workdayStartTime;

  const fixedAndLockedTasks = dbTasks.filter(task => !task.is_flexible || task.is_locked);
  
  let flexibleTasksToCompact: DBScheduledTask[];

  if (tasksToPlace) {
    // If tasksToPlace is provided (e.g., from auto-balance), use it, but ensure it's not completed
    flexibleTasksToCompact = tasksToPlace.filter(task => !task.is_completed);
  } else {
    // If no tasksToPlace provided (e.g., manual 'compact' command), filter from current DB tasks
    flexibleTasksToCompact = dbTasks.filter(task => task.is_flexible && !task.is_locked && !task.is_completed);
  }

  // CRITICAL FIX: If today is selected, filter out tasks whose end time is already past T_current.
  // These tasks should be retired, not compacted/moved forward.
  if (isTodaySelected) {
    flexibleTasksToCompact = flexibleTasksToCompact.filter(task => {
      if (!task.start_time) return true; 
      const taskEndTime = parseISO(task.end_time!);
      // Only keep tasks that end AFTER the current time
      return isAfter(taskEndTime, T_current);
    });
  }
  
  // Sort flexible tasks by priority (critical first), then duration (longest first)
  flexibleTasksToCompact.sort((a, b) => {
    // 1. Critical tasks first
    if (a.is_critical && !b.is_critical) return -1;
    if (!a.is_critical && b.is_critical) return 1;
    
    // 2. Backburner tasks last
    if (a.is_backburner && !b.is_backburner) return 1;
    if (!a.is_backburner && b.is_backburner) return -1;

    // 3. Tie-breaker: Duration (Longest first)
    const durationA = Math.floor((parseISO(a.end_time!).getTime() - parseISO(a.start_time!).getTime()) / (1000 * 60));
    const durationB = Math.floor((parseISO(b.end_time!).getTime() - parseISO(b.start_time!).getTime()) / (1000 * 60));
    return durationB - durationA; 
  });

  let currentOccupiedBlocks: TimeBlock[] = mergeOverlappingTimeBlocks(
    [
      ...fixedAndLockedTasks
        .filter(task => task.start_time && task.end_time)
        .map(task => {
          const utcStart = parseISO(task.start_time!);
          const utcEnd = parseISO(task.end_time!);

          let localStart = setTimeOnDate(selectedDayAsDate, format(utcStart, 'HH:mm'));
          let localEnd = setTimeOnDate(selectedDayAsDate, format(utcEnd, 'HH:mm'));

          if (isBefore(localEnd, localStart)) {
            localEnd = addDays(localEnd, 1);
          }
          return { start: localStart, end: localEnd, duration: Math.floor((localEnd.getTime() - localStart.getTime()) / (1000 * 60)) };
        }),
      ...additionalOccupiedBlocks // NEW: Include additional occupied blocks
    ]
  );

  const newFlexibleTaskPlacements: DBScheduledTask[] = [];
  let currentPlacementCursor = effectiveWorkdayStart;

  for (const task of flexibleTasksToCompact) {
    const taskDuration = Math.floor((parseISO(task.end_time!).getTime() - parseISO(task.start_time!).getTime()) / (1000 * 60));
    const breakDuration = task.break_duration || 0;
    const totalDuration = taskDuration + breakDuration;

    let placed = false;
    let searchStartTime = currentPlacementCursor;

    while (isBefore(searchStartTime, workdayEndTime)) {
      const freeBlocks = getFreeTimeBlocks(currentOccupiedBlocks, searchStartTime, workdayEndTime);
      const suitableBlock = freeBlocks.find(block => block.duration >= totalDuration);

      if (suitableBlock) {
        const proposedStartTime = suitableBlock.start;
        const proposedEndTime = addMinutes(proposedStartTime, totalDuration);

        if (isSlotFree(proposedStartTime, proposedEndTime, currentOccupiedBlocks)) {
          newFlexibleTaskPlacements.push({
            ...task,
            start_time: proposedStartTime.toISOString(),
            end_time: proposedEndTime.toISOString(),
            scheduled_date: format(selectedDayAsDate, 'yyyy-MM-dd'),
            updated_at: new Date().toISOString(),
          });
          currentOccupiedBlocks.push({ start: proposedStartTime, end: proposedEndTime, duration: totalDuration });
          currentOccupiedBlocks = mergeOverlappingTimeBlocks(currentOccupiedBlocks);
          currentPlacementCursor = proposedEndTime;
          placed = true;
          break;
        }
      }
      // If no suitable block found from current searchStartTime, advance searchStartTime
      // to the end of the next occupied block or the start of the next free block
      if (!placed) {
        const nextOccupiedBlock = currentOccupiedBlocks.find(block => isAfter(block.start, searchStartTime));
        if (nextOccupiedBlock) {
          searchStartTime = nextOccupiedBlock.end;
        } else {
          // No more occupied blocks, so no more free blocks to check
          break;
        }
      }
    }
  }

  return [...fixedAndLockedTasks, ...newFlexibleTaskPlacements];
};


export const calculateSchedule = (
  dbTasks: DBScheduledTask[],
  selectedDay: string, // 'yyyy-MM-dd' string
  workdayStart: Date, // Local Date object
  workdayEnd: Date,   // Local Date object
  isRegenPodActive: boolean, // NEW: Pod state
  regenPodStartTime: Date | null, // NEW: Pod start time
  regenPodDurationMinutes: number, // NEW: Pod duration
  T_current: Date, // NEW: Current time for dynamic calculation
  breakfastTimeStr: string | null, // NEW: Breakfast time from profile
  lunchTimeStr: string | null,     // NEW: Lunch time from profile
  dinnerTimeStr: string | null,    // NEW: Dinner time from profile
  breakfastDuration: number | null, // NEW: Breakfast duration from profile
  lunchDuration: number | null,     // NEW: Lunch duration from profile
  dinnerDuration: number | null     // NEW: Dinner duration from profile
): FormattedSchedule => {
  const items: ScheduledItem[] = [];
  let totalActiveTimeMinutes = 0;
  let totalBreakTimeMinutes = 0;
  let criticalTasksRemaining = 0;
  let unscheduledCount = 0;
  let sessionEnd = workdayStart; // Initialize with workdayStart
  let extendsPastMidnight = false;
  let midnightRolloverMessage: string | null = null;
  const dynamicOccupiedBlocks: TimeBlock[] = []; // NEW: Collect dynamic blocks here

  // Create a local Date object for the start of the selected day
  const [year, month, day] = selectedDay.split('-').map(Number);
  const selectedDayDate = new Date(year, month - 1, day); 

  // --- NEW: Add Meal Times as Fixed Tasks ---
  const addMealTask = (name: string, timeStr: string | null, emoji: string, duration: number | null) => {
    if (timeStr && duration !== null && duration > 0) {
      let mealStart = setTimeOnDate(selectedDayDate, timeStr);
      let mealEnd = addMinutes(mealStart, duration);

      // Ensure mealEnd is after mealStart, potentially spanning midnight
      if (isBefore(mealEnd, mealStart)) {
        mealEnd = addDays(mealEnd, 1);
      }

      // Calculate the intersection with the provided workday window
      const intersectionStart = max([mealStart, workdayStart]);
      const intersectionEnd = min([mealEnd, workdayEnd]);

      const effectiveDuration = differenceInMinutes(intersectionEnd, intersectionStart);

      if (effectiveDuration > 0) { // Only add if there's a valid intersection
        const mealItem: ScheduledItem = {
          id: `meal-${name.toLowerCase()}-${format(intersectionStart, 'HHmm')}`, // More unique ID
          type: 'meal',
          name: name,
          duration: effectiveDuration,
          startTime: intersectionStart,
          endTime: intersectionEnd,
          emoji: emoji,
          description: `${name} time`,
          isTimedEvent: true,
          isCritical: false,
          isFlexible: false, // Meals are fixed
          isLocked: true,   // Meals are locked
          energyCost: -10,  // Meals provide energy
          isCompleted: false,
          isCustomEnergyCost: false,
          taskEnvironment: 'home', // Default environment for meals
          sourceCalendarId: null,
          isBackburner: false,
        };
        items.push(mealItem);
        dynamicOccupiedBlocks.push({ start: intersectionStart, end: intersectionEnd, duration: effectiveDuration }); // NEW: Add to dynamic blocks
        totalBreakTimeMinutes += mealItem.duration; // Meals count as break time
        sessionEnd = isAfter(mealItem.endTime, sessionEnd) ? mealItem.endTime : sessionEnd;
      }
    }
  };

  addMealTask('Breakfast', breakfastTimeStr, '🥞', breakfastDuration);
  addMealTask('Lunch', lunchTimeStr, '🥗', lunchDuration);
  addMealTask('Dinner', dinnerTimeStr, '🍽️', dinnerDuration);
  // --- END NEW: Add Meal Times as Fixed Tasks ---


  const sortedTasks = [...dbTasks].sort((a, b) => {
    if (a.start_time && b.start_time) {
      return parseISO(a.start_time).getTime() - parseISO(b.start_time).getTime();
    }
    return 0;
  });

  // --- NEW: Insert Active Regen Pod Block ---
  if (isRegenPodActive && regenPodStartTime && isSameDay(regenPodStartTime, selectedDayDate)) {
    const podStart = regenPodStartTime;
    const podEnd = addMinutes(podStart, regenPodDurationMinutes);
    
    // Only display the Pod if it's currently running or scheduled for the future today
    if (isBefore(podEnd, T_current)) {
        // Pod is finished, do not display
    } else {
        const podItem: ScheduledItem = {
            id: 'regen-pod-active',
            type: 'break', // Treat as a break for scheduling purposes
            name: 'Energy Regen Pod',
            duration: differenceInMinutes(podEnd, podStart),
            startTime: podStart,
            // If the pod is currently running, the end time is the calculated end time
            endTime: podEnd, 
            emoji: '🔋',
            description: getBreakDescription(regenPodDurationMinutes),
            isTimedEvent: true,
            isCritical: false,
            isFlexible: false,
            isLocked: true,
            energyCost: 0,
            isCompleted: false,
            isCustomEnergyCost: false,
            taskEnvironment: 'away',
            sourceCalendarId: null,
            isBackburner: false, // NEW: Default to false
        };
        items.push(podItem);
        dynamicOccupiedBlocks.push({ start: podStart, end: podEnd, duration: podItem.duration }); // NEW: Add to dynamic blocks
        totalBreakTimeMinutes += podItem.duration;
        sessionEnd = isAfter(podEnd, sessionEnd) ? podEnd : sessionEnd;
    }
  }
  // --- END NEW: Insert Active Regen Pod Block ---


  sortedTasks.forEach((dbTask, index) => {
    
    if (!dbTask.start_time || !dbTask.end_time) {
      unscheduledCount++;
      return;
    }

    const startTimeUTC = parseISO(dbTask.start_time);
    const endTimeUTC = parseISO(dbTask.end_time);

    // Convert UTC times to local times relative to the selected day
    let startTime = setTimeOnDate(selectedDayDate, format(startTimeUTC, 'HH:mm'));
    let endTime = setTimeOnDate(selectedDayDate, format(endTimeUTC, 'HH:mm'));

    // Handle rollover past midnight
    if (isBefore(endTime, startTime)) {
      endTime = addDays(endTime, 1);
      extendsPastMidnight = true;
      midnightRolloverMessage = "Schedule extends past midnight.";
    }

    const duration = differenceInMinutes(endTime, startTime);
    const breakDuration = dbTask.break_duration || 0;

    if (duration <= 0) return;

    const isTimeOff = dbTask.name.toLowerCase() === 'time off';
    const isBreak = dbTask.name.toLowerCase() === 'break';
    const isMealTask = isMeal<dyad-problem-report summary="608 problems">
<problem file="src/pages/SchedulerPage.tsx" line="1865" column="16" code="2657">JSX expressions must have one parent element.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1871" column="139" code="1005">'}' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1871" column="293" code="1381">Unexpected token. Did you mean `{'}'}` or `&amp;rbrace;`?</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1872" column="27" code="1005">'}' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1872" column="233" code="1381">Unexpected token. Did you mean `{'}'}` or `&amp;rbrace;`?</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1873" column="93" code="1005">'}' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1873" column="134" code="1381">Unexpected token. Did you mean `{'}'}` or `&amp;rbrace;`?</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1874" column="16" code="1005">'}' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1874" column="57" code="1381">Unexpected token. Did you mean `{'}'}` or `&amp;rbrace;`?</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1916" column="161" code="1005">'}' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1916" column="208" code="1381">Unexpected token. Did you mean `{'}'}` or `&amp;rbrace;`?</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1916" column="259" code="1005">'}' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1916" column="307" code="1381">Unexpected token. Did you mean `{'}'}` or `&amp;rbrace;`?</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2002" column="161" code="1005">'}' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2002" column="208" code="1381">Unexpected token. Did you mean `{'}'}` or `&amp;rbrace;`?</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2002" column="259" code="1005">'}' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2002" column="307" code="1381">Unexpected token. Did you mean `{'}'}` or `&amp;rbrace;`?</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="9" code="1005">',' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="12" code="1005">',' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="18" code="1005">',' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="23" code="1005">',' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="29" code="1005">',' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="33" code="1005">',' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="41" code="1005">',' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="52" code="1005">',' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="59" code="1005">',' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="67" code="1005">',' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="70" code="1005">',' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="78" code="1005">',' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="98" code="1005">',' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="103" code="1005">',' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="127" code="1005">',' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="138" code="1005">',' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="142" code="1005">',' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="149" code="1005">',' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="157" code="1005">',' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="167" code="1005">',' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="171" code="1005">',' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="175" code="1005">',' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="191" code="1005">',' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="203" code="1005">',' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="302" code="1002">Unterminated string literal.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2115" column="1" code="1005">',' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2115" column="5" code="1005">',' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2115" column="35" code="1005">',' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2115" column="38" code="1005">',' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2115" column="42" code="1005">',' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2117" column="28" code="1109">Expression expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2117" column="35" code="1005">',' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2117" column="43" code="1005">',' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2117" column="55" code="1005">'(' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2117" column="72" code="1005">',' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2117" column="79" code="1005">',' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2117" column="83" code="1005">',' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2117" column="87" code="1005">',' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2117" column="184" code="1002">Unterminated string literal.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2118" column="1" code="1005">',' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2118" column="32" code="1005">',' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2118" column="57" code="1109">Expression expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2119" column="5" code="1109">Expression expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2119" column="10" code="1005">',' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2119" column="249" code="1002">Unterminated string literal.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2120" column="10" code="1005">',' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2120" column="167" code="1002">Unterminated string literal.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2121" column="10" code="1005">',' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2121" column="97" code="1002">Unterminated string literal.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2122" column="10" code="1005">',' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2122" column="110" code="1002">Unterminated string literal.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2123" column="1" code="1005">',' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2123" column="35" code="1005">',' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2123" column="39" code="1005">'(' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2123" column="44" code="1005">';' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2123" column="53" code="1005">';' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2123" column="68" code="1109">Expression expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2123" column="105" code="1005">';' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2123" column="113" code="1435">Unknown keyword or identifier. Did you mean 'set'?</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2123" column="118" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2123" column="121" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2123" column="125" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2123" column="144" code="1005">'(' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2123" column="147" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2123" column="176" code="1005">';' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2123" column="176" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2123" column="262" code="1002">Unterminated string literal.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2124" column="31" code="1005">';' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2124" column="37" code="1109">Expression expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2124" column="39" code="1109">Expression expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2124" column="57" code="1005">';' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2124" column="60" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2124" column="83" code="1005">';' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2124" column="89" code="1128">Declaration or statement expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2124" column="96" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2124" column="114" code="1005">';' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2124" column="121" code="1128">Declaration or statement expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2124" column="123" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2124" column="158" code="1002">Unterminated string literal.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2125" column="14" code="1005">';' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2125" column="21" code="1435">Unknown keyword or identifier. Did you mean 'type'?</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2125" column="31" code="1005">'(' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2125" column="40" code="1005">';' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2125" column="45" code="1005">';' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2125" column="56" code="1109">Expression expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2125" column="58" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2125" column="61" code="1435">Unknown keyword or identifier. Did you mean 'void'?</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2125" column="67" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2125" column="96" code="1005">'=' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2125" column="100" code="1005">';' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2125" column="121" code="1005">';' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2125" column="330" code="1002">Unterminated string literal.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="1" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="7" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="15" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="20" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="27" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="32" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="36" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="47" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="53" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="63" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="76" code="1005">'(' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="81" code="1005">';' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="87" code="1005">';' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="91" code="1005">')' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="97" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="117" code="1005">';' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="122" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="126" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="137" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="146" code="1228">A type predicate is only allowed in return type position for functions and methods.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2129" column="13" code="1005">';' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2129" column="43" code="1005">';' expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2130" column="1" code="1109">Expression expected.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2389" column="2" code="1005">'}' expected.</problem>
<problem file="src/lib/scheduler-utils.ts" line="2" column="157" code="2307">Cannot find module '../supabase/functions/_shared/types' or its corresponding type declarations.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="96" column="7" code="2322">Type '({ view }: SchedulerPageProps) =&gt; void' is not assignable to type 'FC&lt;SchedulerPageProps&gt;'.
  Type 'void' is not assignable to type 'ReactNode'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1234" column="9" code="2322">Type '{ start: string; end: string; duration: number; }[]' is not assignable to type 'TimeBlock[]'.
  Type '{ start: string; end: string; duration: number; }' is not assignable to type 'TimeBlock'.
    Types of property 'start' are incompatible.
      Type 'string' is not assignable to type 'Date'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1864" column="24" code="2349">This expression is not callable.
  Type '{ taskName: Element; It: any; looks: any; like: any; there: any; are: any; several: any; TypeScript: any; errors: any; related: any; to: any; missing: any; imports: any; scope: any; and: any; type: any; ... 6 more ...; functions: any; }' has no call signatures.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1865" column="16" code="2339">Property 'dyad-problem-report' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1866" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1866" column="109" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1867" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1867" column="163" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1868" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1868" column="151" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1869" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1869" column="151" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1870" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1870" column="157" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1871" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1872" column="274" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1873" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1873" column="88" code="2304">Cannot find name 'start'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1874" column="11" code="2304">Cannot find name 'start'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1876" column="54" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1877" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1877" column="112" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1878" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1878" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1879" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1879" column="113" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1880" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1880" column="108" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1881" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1881" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1882" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1882" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1883" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1883" column="146" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1884" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1884" column="146" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1885" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1885" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1886" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1886" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1887" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1887" column="108" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1888" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1888" column="110" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1889" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1889" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1890" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1890" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1891" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1891" column="114" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1892" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1892" column="116" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1893" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1893" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1894" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1894" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1895" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1895" column="110" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1896" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1896" column="109" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1897" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1897" column="112" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1898" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1898" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1899" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1899" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1900" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1900" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1901" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1901" column="108" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1902" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1902" column="110" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1903" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1903" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1904" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1904" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1905" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1905" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1906" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1906" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1907" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1907" column="116" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1908" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1908" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1909" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1909" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1910" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1910" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1911" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1911" column="110" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1912" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1912" column="109" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1913" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1913" column="112" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1914" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1914" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1915" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1915" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1916" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1916" column="156" code="2304">Cannot find name 'newXp'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1916" column="237" code="2304">Cannot find name 'previousScheduledTasks'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1916" column="314" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1917" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1917" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1918" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1918" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1919" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1919" column="108" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1920" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1920" column="110" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1921" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1921" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1922" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1922" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1923" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1923" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1924" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1924" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1925" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1925" column="116" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1926" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1926" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1927" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1927" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1928" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1928" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1929" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1929" column="110" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1930" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1930" column="109" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1931" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1931" column="112" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1932" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1932" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1933" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1933" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1934" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1934" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1935" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1935" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1936" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1936" column="110" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1937" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1937" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1938" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1938" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1939" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1939" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1940" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1940" column="116" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1941" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1941" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1942" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1942" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1943" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1943" column="110" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1944" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1944" column="109" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1945" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1945" column="112" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1946" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1946" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1947" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1947" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1948" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1948" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1949" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1949" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1950" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1950" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1951" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1951" column="110" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1952" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1952" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1953" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1953" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1954" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1954" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1955" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1955" column="116" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1956" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1956" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1957" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1957" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1958" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1958" column="110" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1959" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1959" column="109" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1960" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1960" column="112" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1961" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1961" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1962" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1962" column="113" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1963" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1963" column="108" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1964" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1964" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1965" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1965" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1966" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1966" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1967" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1967" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1968" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1968" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1969" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1969" column="110" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1970" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1970" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1971" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1971" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1972" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1972" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1973" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1973" column="122" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1974" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1974" column="114" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1975" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1975" column="116" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1976" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1976" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1977" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1977" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1978" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1978" column="122" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1979" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1979" column="110" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1980" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1980" column="109" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1981" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1981" column="112" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1982" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1982" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1983" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1983" column="107" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1984" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1984" column="110" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1985" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1985" column="116" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1986" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1986" column="110" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1987" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1987" column="109" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1988" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1988" column="110" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1989" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1989" column="158" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1990" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1990" column="123" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1991" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1991" column="164" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1992" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1992" column="164" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1993" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1993" column="119" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1994" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1994" column="119" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1995" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1995" column="176" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1996" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1996" column="124" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1997" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1997" column="132" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1998" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1998" column="130" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1999" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1999" column="119" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2000" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2000" column="123" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2001" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2001" column="128" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2002" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2002" column="156" code="2304">Cannot find name 'newXp'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2002" column="237" code="2304">Cannot find name 'previousScheduledTasks'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2002" column="314" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2003" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2003" column="126" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2004" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2004" column="177" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2005" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2005" column="188" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2006" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2006" column="132" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2007" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2007" column="127" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2008" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2008" column="127" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2009" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2009" column="127" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2010" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2010" column="127" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2011" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2011" column="126" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2012" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2012" column="127" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2013" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2013" column="133" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2014" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2014" column="127" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2015" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2015" column="133" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2016" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2016" column="132" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2017" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2017" column="133" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2018" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2018" column="127" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2019" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2019" column="133" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2020" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2020" column="128" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2021" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2021" column="133" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2022" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2022" column="134" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2023" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2023" column="131" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2024" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2024" column="127" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2025" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2025" column="131" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2026" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2026" column="131" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2027" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2027" column="135" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2028" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2028" column="131" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2029" column="1" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2029" column="133" code="2339">Property 'problem' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2030" column="1" code="2339">Property 'dyad-problem-report' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2030" column="23" code="2339">Property 'think' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="1" code="2339">Property 'think' does not exist on type 'JSX.IntrinsicElements'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="9" code="18004">No value exists in scope for the shorthand property 'It'. Either declare one or provide an initializer.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="12" code="18004">No value exists in scope for the shorthand property 'looks'. Either declare one or provide an initializer.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="18" code="18004">No value exists in scope for the shorthand property 'like'. Either declare one or provide an initializer.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="23" code="18004">No value exists in scope for the shorthand property 'there'. Either declare one or provide an initializer.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="29" code="18004">No value exists in scope for the shorthand property 'are'. Either declare one or provide an initializer.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="33" code="18004">No value exists in scope for the shorthand property 'several'. Either declare one or provide an initializer.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="41" code="18004">No value exists in scope for the shorthand property 'TypeScript'. Either declare one or provide an initializer.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="52" code="18004">No value exists in scope for the shorthand property 'errors'. Either declare one or provide an initializer.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="59" code="18004">No value exists in scope for the shorthand property 'related'. Either declare one or provide an initializer.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="67" code="18004">No value exists in scope for the shorthand property 'to'. Either declare one or provide an initializer.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="70" code="18004">No value exists in scope for the shorthand property 'missing'. Either declare one or provide an initializer.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="78" code="18004">No value exists in scope for the shorthand property 'imports'. Either declare one or provide an initializer.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="87" code="18004">No value exists in scope for the shorthand property 'scope'. Either declare one or provide an initializer.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="94" code="18004">No value exists in scope for the shorthand property 'and'. Either declare one or provide an initializer.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="98" code="18004">No value exists in scope for the shorthand property 'type'. Either declare one or provide an initializer.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="103" code="2693">'definitions' only refers to a type, but is being used as a value here.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="116" code="18004">No value exists in scope for the shorthand property 'especially'. Either declare one or provide an initializer.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="127" code="18004">No value exists in scope for the shorthand property 'concerning'. Either declare one or provide an initializer.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="138" code="18004">No value exists in scope for the shorthand property 'the'. Either declare one or provide an initializer.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="142" code="18004">No value exists in scope for the shorthand property 'shared'. Either declare one or provide an initializer.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="149" code="18004">No value exists in scope for the shorthand property 'utility'. Either declare one or provide an initializer.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="157" code="18004">No value exists in scope for the shorthand property 'functions'. Either declare one or provide an initializer.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="167" code="18004">No value exists in scope for the shorthand property 'and'. Either declare one or provide an initializer.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="171" code="18004">No value exists in scope for the shorthand property 'the'. Either declare one or provide an initializer.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="191" code="2304">Cannot find name 'component'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2113" column="191" code="2554">Expected 1 arguments, but got 24.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2115" column="1" code="2304">Cannot find name 'Here'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2115" column="35" code="2304">Cannot find name 'll'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2115" column="38" code="2304">Cannot find name 'make'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2117" column="7" code="2304">Cannot find name 'Export'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2117" column="30" code="2304">Cannot find name 'This'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2117" column="35" code="2304">Cannot find name 'utility'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2117" column="55" code="2304">Cannot find name 'used'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2117" column="63" code="2304">Cannot find name 'multiple'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2117" column="72" code="2304">Cannot find name 'places'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2117" column="79" code="2304">Cannot find name 'but'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2117" column="83" code="2304">Cannot find name 'wasn'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2118" column="7" code="2304">Cannot find name 'Refactor'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2118" column="32" code="2304">Cannot find name 'and'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2119" column="9" code="2304">Cannot find name 'I'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2119" column="10" code="2362">The left-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2120" column="9" code="2304">Cannot find name 'I'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2120" column="10" code="2362">The left-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2121" column="9" code="2304">Cannot find name 'I'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2121" column="10" code="2362">The left-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2122" column="9" code="2304">Cannot find name 'I'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2123" column="7" code="2304">Cannot find name 'Adjust'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2123" column="39" code="2304">Cannot find name 'Edge'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2123" column="53" code="2304">Cannot find name 'communication'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2123" column="70" code="2304">Cannot find name 'The'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2123" column="101" code="2304">Cannot find name 'the'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2123" column="105" code="2304">Cannot find name 'payload'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2123" column="113" code="2552">Cannot find name 'sent'. Did you mean 'Set'?</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2123" column="118" code="2304">Cannot find name 'to'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2123" column="121" code="2304">Cannot find name 'the'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2123" column="125" code="2304">Cannot find name 'edge'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2123" column="144" code="2304">Cannot find name 'to'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2123" column="147" code="2304">Cannot find name 'be'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2123" column="150" code="2304">Cannot find name 'serialized'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2123" column="164" code="2304">Cannot find name 'strings'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2123" column="173" code="2304">Cannot find name 'so'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2123" column="176" code="2304">Cannot find name 'I'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2124" column="7" code="2304">Cannot find name 'Correct'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2124" column="57" code="2304">Cannot find name 'is'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2124" column="60" code="2304">Cannot find name 'currently'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2124" column="70" code="2304">Cannot find name 'defined'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2124" column="81" code="2304">Cannot find name 'a'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2124" column="83" code="2304">Cannot find name 'named'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2124" column="96" code="2304">Cannot find name 'but'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2124" column="100" code="2304">Cannot find name 'imported'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2124" column="112" code="2304">Cannot find name 'a'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2124" column="123" code="2304">Cannot find name 'I'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2125" column="7" code="2304">Cannot find name 'Create'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2125" column="14" code="2304">Cannot find name 'shared'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2125" column="21" code="2304">Cannot find name 'types'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2125" column="31" code="2304">Cannot find name 'Supabase'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2125" column="40" code="2304">Cannot find name 'Edge'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2125" column="45" code="2304">Cannot find name 'Functions'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2125" column="58" code="2304">Cannot find name 'To'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2125" column="61" code="2304">Cannot find name 'avoid'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2125" column="67" code="2304">Cannot find name 'duplicating'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2125" column="96" code="2304">Cannot find name 'and'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2125" column="100" code="2304">Cannot find name 'ensure'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2125" column="107" code="2304">Cannot find name 'consistency'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2125" column="107" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2125" column="120" code="2304">Cannot find name 'I'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="1" code="2304">Cannot find name 'These'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="7" code="2304">Cannot find name 'changes'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="15" code="2304">Cannot find name 'will'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="20" code="2304">Cannot find name 'ensure'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="27" code="2304">Cannot find name 'that'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="32" code="2304">Cannot find name 'the'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="36" code="2304">Cannot find name 'scheduling'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="47" code="2304">Cannot find name 'logic'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="53" code="2304">Cannot find name 'correctly'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="63" code="2304">Cannot find name 'accounts'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="76" code="2304">Cannot find name 'meal'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="81" code="2304">Cannot find name 'times'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="87" code="2304">Cannot find name 'and'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="91" code="2304">Cannot find name 'other'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="97" code="2304">Cannot find name 'dynamic'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="105" code="2304">Cannot find name 'blocks'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="105" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="113" code="2304">Cannot find name 'and'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="117" code="2304">Cannot find name 'that'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="122" code="2304">Cannot find name 'the'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="126" code="2304">Cannot find name 'TypeScript'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="137" code="2304">Cannot find name 'compiler'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="146" code="2304">Cannot find name 'is'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2127" column="149" code="2304">Cannot find name 'happy'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2129" column="2" code="2304">Cannot find name 'dyad'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2129" column="7" code="2304">Cannot find name 'write'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2129" column="13" code="2304">Cannot find name 'path'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2129" column="43" code="2304">Cannot find name 'description'.</problem>
<problem file="src/App.tsx" line="13" column="8" code="1192">Module '&quot;/Users/danielebuatti/dyad-apps/productive-sloth/src/pages/SchedulerPage&quot;' has no default export.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="1" column="206" code="2307">Cannot find module 'https://esm.sh/date-fns@2.30.0' or its corresponding type declarations.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="489" column="68" code="2304">Cannot find name 'NewRetiredTask'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="535" column="52" code="2304">Cannot find name 'TimeBlock'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="535" column="66" code="2304">Cannot find name 'TimeBlock'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="541" column="17" code="2304">Cannot find name 'TimeBlock'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="565" column="19" code="2304">Cannot find name 'TimeBlock'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="568" column="4" code="2304">Cannot find name 'TimeBlock'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="569" column="21" code="2304">Cannot find name 'TimeBlock'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="606" column="12" code="2304">Cannot find name 'DBScheduledTask'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="611" column="29" code="2304">Cannot find name 'TimeBlock'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="612" column="18" code="2304">Cannot find name 'DBScheduledTask'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="613" column="4" code="2304">Cannot find name 'DBScheduledTask'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="619" column="31" code="2304">Cannot find name 'DBScheduledTask'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="656" column="30" code="2304">Cannot find name 'TimeBlock'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="676" column="36" code="2304">Cannot find name 'DBScheduledTask'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="695" column="13" code="2304">Cannot find name 'isSlotFree'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="729" column="12" code="2304">Cannot find name 'DBScheduledTask'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="743" column="4" code="2304">Cannot find name 'FormattedSchedule'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="744" column="16" code="2304">Cannot find name 'ScheduledItem'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="752" column="32" code="2304">Cannot find name 'TimeBlock'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="776" column="25" code="2304">Cannot find name 'ScheduledItem'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="826" column="24" code="2304">Cannot find name 'ScheduledItem'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="887" column="19" code="2304">Cannot find name 'ScheduledItemType'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="900" column="17" code="2304">Cannot find name 'ScheduledItem'.</problem>
<problem file="supabase/functions/_shared/scheduler-utils.ts" line="942" column="18" code="2304">Cannot find name 'ScheduleSummary'.</problem>
<problem file="supabase/functions/_shared/types.ts" line="1" column="24" code="2307">Cannot find module 'https://esm.sh/date-fns@2.30.0' or its corresponding type declarations.</problem>
</dyad-problem-report>You're right, my apologies! It seems my previous response was cut off and introduced new errors by including the problem report directly into the code. That was a significant oversight on my part.

I will now correct all the TypeScript errors you've listed. The core issues are:

1.  **Missing `isSlotFree` export**: The `isSlotFree` function was defined but not exported from `src/lib/scheduler-utils.ts` and `supabase/functions/_shared/scheduler-utils.ts`.
2.  **Type inconsistencies in `AutoBalancePayload`**: The `dynamicOccupiedBlocks` in the `AutoBalancePayload` were expected as `Date` objects in the client-side type but as `string` (ISO dates) in the server-side edge function. I'll align these.
3.  **Redeclared variables in `useSchedulerTasks`**: Several mutation functions were being redeclared within the `useSchedulerTasks` hook, causing `TS2451` errors. I'll ensure they are correctly referenced.
4.  **Missing imports in `useSchedulerTasks`**: `XP_PER_LEVEL`, `MAX_ENERGY`, `DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION`, `isToday`, `useMutation`, `useQueryClient`, `MutationContext` were not imported in `src/hooks/use-scheduler-tasks.ts`.
5.  **`SchedulerPage` export**: `SchedulerPage` was imported as a default but defined as a named export. I'll correct its export.
6.  **`date-fns` module import in Supabase functions**: The `date-fns` import in `supabase/functions/_shared/scheduler-utils.ts` and `supabase/functions/_shared/types.ts` needs to be correctly typed for Deno.
7.  **JSX in `setInjectionPrompt`**: The JSX problem report was accidentally inserted into the `setInjectionPrompt` call in `SchedulerPage.tsx`. I'll remove this.
8.  **Missing `TimeBlock` and other types in shared utils**: The `supabase/functions/_shared/scheduler-utils.ts` file needs to import `TimeBlock`, `DBScheduledTask`, `NewRetiredTask`, `ScheduledItem`, `ScheduledItemType`, `FormattedSchedule`, and `ScheduleSummary` from the new `supabase/functions/_shared/types.ts` file.

Here are the corrected files:

<dyad-write path="supabase/functions/_shared/types.ts" description="Creating a shared types file for Supabase Edge Functions.">
import { format } from 'https://esm.sh/date-fns@2.30.0';

// NEW: TimeBlock interface for scheduler utility functions
export interface TimeBlock {
  start: Date;
  end: Date;
  duration: number; // in minutes
}

// Supabase-specific types for scheduled tasks
export interface DBScheduledTask {
  id: string;
  user_id: string;
  name: string;
  break_duration: number | null;
  start_time: string | null; // New: ISO date string for timed events
  end_time: string | null;   // New: ISO date string for timed events
  scheduled_date: string; // New: Date (YYYY-MM-DD) for which the task is scheduled
  created_at: string;
  updated_at: string; // NEW: Added updated_at
  is_critical: boolean; // NEW: Critical Urgency Flag
  is_flexible: boolean; // NEW: Flag for schedule compaction
  is_locked: boolean; // NEW: Task Immutability Flag
  energy_cost: number; // NEW: Made energyCost required
  is_completed: boolean; // NEW: Added is_completed for scheduled tasks
  is_custom_energy_cost: boolean; // NEW: Flag for custom energy cost
  task_environment: 'home' | 'laptop' | 'away' | 'piano' | 'laptop_piano'; // NEW: Task environment
  source_calendar_id: string | null; // NEW: Source calendar ID for read-only events
  is_backburner: boolean; // NEW: Backburner Urgency Flag
}

export interface NewDBScheduledTask {
  id?: string; // NEW: Added optional ID for upsert operations
  name: string;
  break_duration?: number;
  start_time?: string; // Optional for duration-based tasks
  end_time?: string;   // Optional for duration-based tasks
  scheduled_date: string; // New: Date (YYYY-MM-DD) for which the task is scheduled
  is_critical?: boolean; // NEW: Critical Urgency Flag
  is_flexible?: boolean; // NEW: Flag for schedule compaction
  is_locked?: boolean; // NEW: Task Immutability Flag
  energy_cost: number; // NEW: Made energyCost required
  is_completed?: boolean; // NEW: Added is_completed for new scheduled tasks
  is_custom_energy_cost?: boolean; // NEW: Flag for custom energy cost
  task_environment?: 'home' | 'laptop' | 'away' | 'piano' | 'laptop_piano'; // NEW: Task environment
  source_calendar_id?: string | null; // NEW: Source calendar ID
  is_backburner?: boolean; // NEW: Backburner Urgency Flag
}

// New types for retired tasks (Aether Sink)
export interface RetiredTask {
  id: string;
  user_id: string;
  name: string;
  duration: number | null; // Duration in minutes (retained for re-zoning)
  break_duration: number | null; // Break duration in minutes (retained for re-zoning)
  original_scheduled_date: string; // The date it was originally scheduled for (YYYY-MM-DD)
  retired_at: string; // Timestamp when it was moved to the sink
  is_critical: boolean; // NEW: Critical Urgency Flag
  is_locked: boolean; // NEW: Task Immutability Flag
  energy_cost: number; // NEW: Made energyCost required
  is_completed: boolean; // NEW: Added is_completed
  is_custom_energy_cost: boolean; // NEW: Flag for custom energy cost
  task_environment: 'home' | 'laptop' | 'away' | 'piano' | 'laptop_piano'; // NEW: Task environment
  is_backburner: boolean; // NEW: Backburner Urgency Flag
}

export interface NewRetiredTask {
  user_id: string;
  name: string;
  duration: number | null;
  break_duration: number | null;
  original_scheduled_date: string;
  is_critical?: boolean; // NEW: Critical Urgency Flag
  is_locked?: boolean; // NEW: Task Immutability Flag
  energy_cost: number; // NEW: Made energyCost required
  is_completed?: boolean; // NEW: Added is_completed
  is_custom_energy_cost?: boolean; // NEW: Flag for custom energy cost
  task_environment?: 'home' | 'laptop' | 'away' | 'piano' | 'laptop_piano'; // NEW: Task environment
  is_backburner?: boolean; // NEW: Backburner Urgency Flag
}

// Helper type for unification (moved from SchedulerPage.tsx)
export interface UnifiedTask {
  id: string;
  name: string;
  duration: number;
  break_duration: number | null;
  is_critical: boolean;
  is_flexible: boolean;
  is_backburner: boolean; // NEW: Backburner Urgency Flag
  energy_cost: number;
  source: 'scheduled' | 'retired';
  originalId: string; // ID in the source table
  is_custom_energy_cost: boolean; // NEW: Add custom energy cost flag
  created_at: string; // NEW: Add created_at for age sorting
  task_environment: 'home' | 'laptop' | 'away' | 'piano' | 'laptop_piano'; // NEW: Task environment
}

// NEW: Payload for the atomic auto-balance mutation
export interface AutoBalancePayload {
  scheduledTaskIdsToDelete: string[];
  retiredTaskIdsToDelete: string[];
  tasksToInsert: NewDBScheduledTask[];
  tasksToKeepInSink: NewRetiredTask[];
  selectedDate: string;
  dynamicOccupiedBlocks: { start: string; end: string; duration: number }[]; // Changed to string for serialization over network
}

export type ScheduledItemType = 'task' | 'break' | 'time-off' | 'meal' | 'calendar-event'; // UPDATED: Added 'calendar-event'

export interface ScheduledItem {
  id: string; // Unique ID for React keys
  type: ScheduledItemType;
  name: string; // Task name or "BREAK"
  duration: number; // in minutes (calculated for timed events)
  startTime: Date;
  endTime: Date;
  emoji: string;
  description?: string; // For breaks
  isTimedEvent: boolean; // New: Flag to differentiate
  color?: string; // New: For custom colors (e.g., Tailwind class like 'bg-blue-500')
  isCritical?: boolean; // NEW: Critical Urgency Flag
  isFlexible?: boolean; // NEW: Flag for schedule compaction
  isLocked?: boolean; // NEW: Task Immutability Flag
  energyCost: number; // NEW: Made energyCost required
  isCompleted: boolean; // NEW: Added isCompleted for scheduled items
  isCustomEnergyCost: boolean; // NEW: Flag for custom energy cost
  taskEnvironment: 'home' | 'laptop' | 'away' | 'piano' | 'laptop_piano'; // NEW: Task environment
  sourceCalendarId: string | null; // NEW: Source calendar ID
  isBackburner: boolean; // NEW: Backburner Urgency Flag
}

// NEW: Type for combined completed task log entry for recap metrics
export interface CompletedTaskLogEntry {
  id: string;
  user_id: string;
  name: string;
  effective_duration_minutes: number; // Calculated duration for recap metrics
  break_duration: number | null;
  start_time: string | null;
  end_time: string | null;
  scheduled_date: string;
  created_at: string;
  updated_at: string;
  is_critical: boolean;
  is_flexible: boolean;
  is_locked: boolean;
  energy_cost: number;
  is_completed: boolean;
  is_custom_energy_cost: boolean;
  task_environment: 'home' | 'laptop' | 'away' | 'piano' | 'laptop_piano';
  original_source: 'scheduled_tasks' | 'aethersink' | 'tasks';
}

export interface ScheduleSummary {
  totalTasks: number;
  activeTime: { hours: number; minutes: number };
  breakTime: number; // in minutes
  sessionEnd: Date;
  extendsPastMidnight: boolean;
  midnightRolloverMessage: string | null;
  unscheduledCount: number; // New: Count of tasks that couldn't fit within the workday window
  criticalTasksRemaining: number; // NEW: Count of critical tasks not yet completed
}