import { format, addMinutes, isPast, isToday, startOfDay, addHours, addDays, parse, parseISO, setHours, setMinutes, isSameDay, isBefore, isAfter, isPast as isPastDate, differenceInMinutes, min, max } from 'date-fns';
import { RawTaskInput, ScheduledItem, ScheduledItemType, FormattedSchedule, ScheduleSummary, DBScheduledTask, TimeMarker, DisplayItem, TimeBlock, UnifiedTask, NewRetiredTask } from '@/types/scheduler';

// --- Constants ---
export const MEAL_KEYWORDS = ['cook', 'meal prep', 'groceries', 'food', '🍔', 'lunch', 'dinner', 'breakfast', 'snack', 'eat', 'coffee break']; // Added 'eat' and 'coffee break'

export const EMOJI_MAP: { [key: string]: string } = {
  'gym': '🏋️', 'workout': '🏋️', 'run': '🏃', 'exercise': '🏋️', 'fitness': '💪',
  'email': '📧', 'messages': '💬', 'calls': '📞', 'communication': '🗣️', 'admin': '⚙️', 'paperwork': '📄',
  'meeting': '💼', 'work': '💻', 'report': '📝', 'professional': '👔', 'project': '📊', 'coding': '💻', 'develop': '💻', 'code': '💻', 'bug': '🐛', 'fix': '🛠️',
  'design': '🎨', 'writing': '✍️', 'art': '🖼️', 'creative': '✨', 'draw': '✏️',
  'study': '📦', // Updated to '📦' for house organization context
  'reading': '📖', 'course': '🎓', 'learn': '🧠', 'class': '🏫', 'lecture': '🧑‍🏫',
  'clean': '🧹', 'laundry': '🧺', 'organize': '🗄️', 'household': '🏠', 'setup': '🛠️',
  'cook': '🍳', 'meal prep': '🍲', 'groceries': '🛒', 'food': '🍔', 'lunch': '🥗', 'dinner': '🍽️', 'breakfast': '🥞', 'snack': '🍎', 'eat': '🍎', // UPDATED: Added 'eat'
  'brainstorm': '💡', 'strategy': '📈', 'review': '🔍', 'plan': '🗓️',
  'gaming': '🎮', 'hobbies': '🎲', 'leisure': '😌', 'movie': '🎬', 'relax': '🧘', 'chill': '🛋️',
  'meditation': '🧘', 'yoga': '🧘', 'self-care': '🛀', 'wellness': '🌸', 'mindfulness': '🧠', 'nap': '😴', 'rest': '🛌',
  'break': '☕️', 'coffee': '☕️', 'walk': '🚶', 'stretch': '🤸', 'coffee break': '☕️', // UPDATED: Added 'coffee break'
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
  'study': 150, // Updated hue for house organization context
  'reading': 260, 'course': 260, 'learn': 270, 'class': 260, 'lecture': 260,
  'clean': 120, 'laundry': 130, 'organize': 140, 'household': 120, 'setup': 40,
  'cook': 30, 'meal prep': 35, 'groceries': 180, 'food': 25, 'lunch': 45, 'dinner': 10, 'breakfast': 50, 'snack': 350, 'eat': 35, // UPDATED: Added 'eat'
  'brainstorm': 60, 'strategy': 70, 'review': 80, 'plan': 220,
  'gaming': 0, 'hobbies': 20, 'leisure': 150, 'movie': 0, 'relax': 160, 'chill': 150, 
  'meditation': 160, 'yoga': 160, 'self-care': 300, 'wellness': 170, 'mindfulness': 160, 'nap': 20, 'rest': 150,
  'break': 40, 'coffee': 30, 'walk': 100, 'stretch': 110, 'coffee break': 30, // UPDATED: Added 'coffee break'
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
  'sync': 290, 'standup': 290, // Added back
  'tutorial': 60,
  'tv': 10, // Explicitly set for 'TV to Brad'
  'cobweb': 120, // Same as clean
  'cables': 210, // Tech-related
  'fold laundry': 130, // Same as laundry
  'load of laundry': 130, // Same as laundry
  'tidy': 140, // Same as organize
  'room': 150, // Same as room
  'book': 220, // General admin
  'waitress': 220, // Same as book
  'preparation': 220, // Same as book
  'lego': 100, // Playful green
  'organise': 200, // General organization
  'shirts': 200, // Same as organise
  'gigs': 200, // Same as organise
  'charge': 210, // Tech-related
  'vacuum': 210, // Same as charge
  'put away': 140, // For 'Put away my new sheets'
  'sheets': 140, // For 'Put away my new sheets'
  'pants': 140, // For 'Put away my new pants'
  'medication': 300, // For 'Put medication next to toothbrush'
  'toothbrush': 300, // For 'Put medication next to toothbrush'
  'return message': 245, // For 'Return Message To Damien'
  'voice deal': 270, // For 'Voice Deal for Lydia'
  'find location': 140, // For 'Find A Location For The Broom'
  'broom': 120, // For 'Find A Location For The Broom'
  'practise': 270, // For 'Piano Practise'
  'track': 270, // For 'PIANO TRACK'
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
    // Check for overlap: (StartA < EndB) and (EndA > StartB)
    if (proposedStart < block.end && proposedEnd > block.start) {
      return false; // Overlaps with an existing block
    }
  }
  return true; // No overlaps found
};

export const compactScheduleLogic = (
  dbTasks: DBScheduledTask[],
  selectedDayAsDate: Date,
  workdayStartTime: Date,
  workdayEndTime: Date,
  T_current: Date,
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
    fixedAndLockedTasks
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
      })
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
    const isMealTask = isMeal(dbTask.name);
    const isCalendarEvent = !!dbTask.source_calendar_id; // NEW: Check for calendar source

    let itemType: ScheduledItemType;
    if (isCalendarEvent) { // NEW: Highest priority type check
      itemType = 'calendar-event';
    } else if (isTimeOff) {
      itemType = 'time-off';
    } else if (isBreak) {
      itemType = 'break';
    } else if (isMealTask) {
      itemType = 'meal';
    } else {
      itemType = 'task';
    }

    const item: ScheduledItem = {
      id: dbTask.id,
      type: itemType,
      name: dbTask.name,
      duration: duration,
      startTime: startTime,
      endTime: endTime,
      emoji: isCalendarEvent ? '📅' : assignEmoji(dbTask.name), // NEW: Use calendar emoji for sync events
      description: isBreak ? getBreakDescription(duration) : undefined,
      isTimedEvent: true,
      isCritical: dbTask.is_critical,
      isFlexible: dbTask.is_flexible,
      isLocked: dbTask.is_locked,
      energyCost: dbTask.energy_cost,
      isCompleted: dbTask.is_completed,
      isCustomEnergyCost: dbTask.is_custom_energy_cost,
      taskEnvironment: dbTask.task_environment,
      sourceCalendarId: dbTask.source_calendar_id, // NEW: Pass source calendar ID
      isBackburner: dbTask.is_backburner, // NEW: Pass backburner status
    };

    items.push(item);

    if (item.type === 'task' || item.type === 'time-off' || item.type === 'calendar-event') { // UPDATED: Calendar events count as active time
      totalActiveTimeMinutes += duration;
    } else if (item.type === 'break' || item.type === 'meal') {
      totalBreakTimeMinutes += duration;
    }

    if (item.isCritical && !item.isCompleted) {
      criticalTasksRemaining++;
    }

    sessionEnd = isAfter(item.endTime, sessionEnd) ? item.endTime : sessionEnd;
  });

  // Re-sort all items (including the dynamically added Pod item and meals) by start time
  items.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  const totalActiveTimeHours = Math.floor(totalActiveTimeMinutes / 60);
  const totalActiveTimeMins = totalActiveTimeMinutes % 60;

  const summary: ScheduleSummary = {
    totalTasks: items.length,
    activeTime: { hours: totalActiveTimeHours, minutes: totalActiveTimeMins },
    breakTime: totalBreakTimeMinutes,
    sessionEnd: sessionEnd,
    extendsPastMidnight: extendsPastMidnight,
    midnightRolloverMessage: midnightRolloverMessage,
    unscheduledCount: unscheduledCount,
    criticalTasksRemaining: criticalTasksRemaining,
  };

  return {
    items: items,
    summary: summary,
    dbTasks: dbTasks,
  };
};