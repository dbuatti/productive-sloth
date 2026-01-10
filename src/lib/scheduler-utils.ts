import { format, addMinutes, isPast, isToday, startOfDay, addHours, addDays, parse, parseISO, setHours, setMinutes, isSameDay, isBefore, isAfter, isPast as isPastDate, differenceInMinutes, min, max, isEqual } from 'date-fns';
import { RawTaskInput, ScheduledItem, ScheduledItemType, FormattedSchedule, ScheduleSummary, DBScheduledTask, TimeMarker, DisplayItem, TimeBlock, UnifiedTask, NewRetiredTask } from '@/types/scheduler';
import { UserProfile } from '@/hooks/use-session'; // Import UserProfile from the hook file

// --- Constants ---
export const MEAL_KEYWORDS = ['cook', 'meal prep', 'groceries', 'food', '🍔', 'lunch', 'dinner', 'breakfast', 'snack', 'eat', 'coffee break', 'reflection'];

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
  'toothbrush': '🪥',
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
  'reflection': '🧠',
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
  'gaming': 100, 'hobbies': 20, 'leisure': 150, 'movie': 0, 'relax': 160, 'chill': 150, 
  'meditation': 160, 'yoga': 160, 'self-care': 300, 'wellness': 170, 'mindfulness': 160, 'nap': 20, 'rest': 150,
  'break': 40, 'coffee': 30, 'walk': 100, 'stretch': 110, 'coffee break': 30,
  'piano': 270, 'music': 270, 'practice': 270,
  'commute': 10, 'drive': 10, 'bus': 10, 'train': 10, 'travel': 200,
  'shop': 180, 'bank': 220, 'post': 240, 'errands': 210,
  'friends': 300, 'family': 300, 'social': 310,
  'wake up': 0,
  'coles': 0,
  'woolworths': 0,
  'lesson': 0,
  'call': 0,
  'phone': 0,
  'text': 0,
  'contact': 0,
  'student': 0,
  'rehearsal': 0,
  'time off': 0,
  'message': 0,
  'journal': 0,
  'washing': 0,
  'money': 0, 'transactions': 0,
  'mop': 0, 'floor': 0,
  'quote': 0, 'send quote': 0, 'generate quote': 0,
  'doctor': 0, 'medical': 0,
  'channel': 0, 'anxious': 0,
  'recycling': 0, 'bin': 0,
  'milk': 0, 'cartons': 0,
  'sync': 0, 'standup': 0,
  'tutorial': 0,
  'tv': 0,
  'cobweb': 0,
  'cables': 0,
  'fold laundry': 0,
  'load of laundry': 0,
  'tidy': 0,
  'room': 0,
  'book': 0,
  'waitress': 0,
  'preparation': 0,
  'lego': 0,
  'organise': 0,
  'shirts': 0,
  'gigs': 0,
  'charge': 0,
  'vacuum': 0,
  'put away': 0,
  'sheets': 0,
  'pants': 0,
  'medication': 0,
  'toothbrush': 0,
  'return message': 0,
  'voice deal': 0,
  'find location': 0,
  'broom': 0,
  'practise': 0,
  'track': 0,
  'catch up': 0,
  'trim': 0, 
  'cuticle': 0, 
  'payment': 0,
  'link': 0,
  'send': 0,
  'voice notes': 0,
  'job notes': 0,
  'process': 0,
  'usb': 0,
  'cable': 0,
  'coil': 0,
  'write up': 0,
  'notes': 0,
  'reflection': 0,
};

// --- Utility Functions ---

export const formatTime = (date: Date): string => format(date, 'h:mm a');
export const formatDayMonth = (date: Date): string => format(date, 'MMM d');
export const formatDateTime = (date: Date): string => format(date, 'MMM d, h:mm a');

/**
 * Formats a duration in minutes into a human-readable string like '1h 30m' or '45m'.
 */
export const formatDurationToHoursMinutes = (totalMinutes: number): string => {
  if (totalMinutes <= 0) return '0m';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else {
    return `${minutes}m`;
  }
};

export const setTimeOnDate = (date: Date, timeString: string): Date => {
  const [hours, minutes] = timeString.split(':').map(Number);
  return setMinutes(setHours(date, hours), minutes);
};

export const assignEmoji = (taskName: string): string => {
  const lowerCaseTaskName = taskName.toLowerCase();
  for (const keyword in EMOJI_MAP) {
    if (lowerCaseTaskName.includes(keyword)) {
      return EMOJI_MAP[keyword];
    }
  }
  return '📋'; 
};

export const getEmojiHue = (taskName: string): number => {
  const lowerCaseTaskName = taskName.toLowerCase();
  for (const keyword in EMOJI_HUE_MAP) {
    if (lowerCaseTaskName.includes(keyword)) {
      return EMOJI_HUE_MAP[keyword];
    }
  }
  return 220; 
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

export const calculateEnergyCost = (duration: number, isCritical: boolean, isBackburner: boolean = false, isBreak: boolean = false): number => {
  if (isBreak) { 
    return -10; // Fixed energy gain for explicit breaks
  }
  if (isMeal('meal')) { 
    return -10; // Fixed energy gain for meals
  }

  let baseCost = Math.ceil(duration / 15) * 5; 
  
  if (isCritical) {
    baseCost = Math.ceil(baseCost * 1.5); 
  } else if (isBackburner) {
    baseCost = Math.ceil(baseCost * 0.75);
  }
  
  return Math.max(5, baseCost); 
};

export const parseFlexibleTime = (timeString: string, baseDate: Date): Date => {
  const lowerCaseTimeString = timeString.toLowerCase();
  let parsedDate: Date;

  parsedDate = parse(lowerCaseTimeString, 'h:mma', baseDate);
  if (!isNaN(parsedDate.getTime())) return parsedDate;

  parsedDate = parse(lowerCaseTimeString, 'h:mm a', baseDate);
  if (!isNaN(parsedDate.getTime())) return parsedDate;

  parsedDate = parse(lowerCaseTimeString, 'ha', baseDate);
  if (!isNaN(parsedDate.getTime())) return parsedDate;

  parsedDate = parse(lowerCaseTimeString, 'HH:mm', baseDate);
  if (!isNaN(parsedDate.getTime())) return parsedDate;

  const hourMatch = lowerCaseTimeString.match(/^(\d{1,2})$/);
  if (hourMatch) {
    const hour = parseInt(hourMatch[1], 10);
    if (hour >= 0 && hour <= 23) {
      return setHours(setMinutes(baseDate, 0), hour);
    }
  }

  return baseDate; 
};

export const parseTaskInput = (input: string, selectedDayAsDate: Date): {
  name: string;
  duration?: number;
  breakDuration?: number;
  startTime?: Date;
  endTime?: Date;
  isCritical: boolean;
  isFlexible: boolean;
  isBackburner: boolean; 
  shouldSink: boolean;
  energyCost: number;
  isWork: boolean; // NEW
  isBreak: boolean; // NEW
} | null => {
  let rawInput = input.trim();
  let lowerInput = rawInput.toLowerCase();
  let isCritical = false;
  let isBackburner = false; 
  let shouldSink = false;
  let isFlexible = true; 
  let isWork = false; // NEW
  let isBreak = false; // NEW

  // Check for Critical Flag (Prefix: !)
  if (rawInput.startsWith('!')) {
    isCritical = true;
    rawInput = rawInput.substring(1).trim();
    lowerInput = rawInput.toLowerCase();
  }

  // Check for Backburner Flag (Prefix: -)
  if (rawInput.startsWith('-')) {
    isBackburner = true;
    rawInput = rawInput.substring(1).trim();
    lowerInput = rawInput.toLowerCase();
  }

  // Check for Sink Flag (Suffix: sink)
  if (lowerInput.endsWith(' sink')) {
    shouldSink = true;
    rawInput = rawInput.substring(0, rawInput.length - 5).trim();
    lowerInput = rawInput.toLowerCase();
  }

  // Check for Fixed Flag (Suffix: fixed)
  if (lowerInput.endsWith(' fixed')) {
    isFlexible = false;
    rawInput = rawInput.substring(0, rawInput.length - 6).trim();
    lowerInput = rawInput.toLowerCase();
  }

  // Check for Work Flag (Suffix: W)
  if (lowerInput.endsWith(' w')) {
    isWork = true;
    rawInput = rawInput.substring(0, rawInput.length - 2).trim();
    lowerInput = rawInput.toLowerCase();
  }

  // Check for Break Flag (Suffix: B)
  if (lowerInput.endsWith(' b')) {
    isBreak = true;
    rawInput = rawInput.substring(0, rawInput.length - 2).trim();
    lowerInput = rawInput.toLowerCase();
  }
  
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
      isFlexible: false, 
      shouldSink: false,
      energyCost: 0,
      isWork: false, // Time off is not work
      isBreak: false, // Time off is not a break task
    };
  }

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
      const energyCost = isMealTask ? -10 : calculateEnergyCost(duration, isCritical, isBackburner, isBreak);

      return { name, startTime, endTime, isCritical, isBackburner, isFlexible: false, shouldSink, energyCost, isWork, isBreak }; 
    }
  }

  const durationMatch = rawInput.match(/^(.*?)\s+(\d+)(?:\s+(\d+))?$/);
  if (durationMatch) {
    const name = durationMatch[1].trim();
    const duration = parseInt(durationMatch[2], 10);
    const breakDuration = durationMatch[3] ? parseInt(durationMatch[3], 10) : undefined;

    if (name && duration > 0) {
      const isMealTask = isMeal(name);
      const energyCost = isMealTask ? -10 : calculateEnergyCost(duration, isCritical, isBackburner, isBreak);
      return { name, duration, breakDuration, isCritical, isBackburner, isFlexible, shouldSink, energyCost, isWork, isBreak };
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
  isBackburner?: boolean; 
  energyCost: number;
  isWork: boolean; // NEW
  isBreak: boolean; // NEW
} | null => {
  const lowerInput = input.toLowerCase().trim();
  const injectMatch = lowerInput.match(/^inject\s+"([^"]+)"(?:\s+(\d+))?(?:\s+(\d{1,2}(:\d{2})?\s*(am|pm)?))?(?:\s*-\s*(\d{1,2}(:\d{2})?\s*(am|pm)?))?(?:\s+(!))?(?:\s+(-))?(?:\s+(fixed))?(?:\s+(w))?(?:\s+(b))?$/);

  if (injectMatch) {
    const taskName = injectMatch[1];
    const duration = injectMatch[2] ? parseInt(injectMatch[2], 10) : undefined;
    const startTime = injectMatch[3] || undefined;
    const endTime = injectMatch[6] || undefined;
    const isCritical = !!injectMatch[9];
    const isBackburner = !!injectMatch[10]; 
    const isFlexible = !injectMatch[11]; 
    const isWork = !!injectMatch[12]; // NEW
    const isBreak = !!injectMatch[13]; // NEW

    let calculatedEnergyCost = 0;
    const isMealTask = isMeal(taskName);

    if (isBreak) {
      calculatedEnergyCost = -10;
    } else if (isMealTask) {
      calculatedEnergyCost = -10;
    } else if (duration) {
      calculatedEnergyCost = calculateEnergyCost(duration, isCritical, isBackburner, isBreak);
    } else {
      calculatedEnergyCost = calculateEnergyCost(30, isCritical, isBackburner, isBreak); 
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
      isWork,
      isBreak,
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
          return { type: 'remove', index: index - 1 }; 
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
    return { type: 'break', duration: 15 }; 
  }
  return null;
};

export const parseSinkTaskInput = (input: string, userId: string): NewRetiredTask | null => {
  let name = input.trim();
  let duration: number | null = null;
  let isCritical = false;
  let isBackburner = false; 
  let isWork = false; // NEW
  let isBreak = false; // NEW

  if (name.endsWith(' !')) {
    isCritical = true;
    name = name.slice(0, -2).trim();
  }

  if (name.startsWith('-')) {
    isBackburner = true;
    name = name.slice(1).trim();
  }

  // Check for Work Flag (Suffix: W)
  if (name.endsWith(' w')) {
    isWork = true;
    name = name.slice(0, -2).trim();
  }

  // Check for Break Flag (Suffix: B)
  if (name.endsWith(' b')) {
    isBreak = true;
    name = name.slice(0, -2).trim();
  }

  const durationMatch = name.match(/^(.*?)\s+(\d+)$/);
  if (durationMatch) {
    name = durationMatch[1].trim();
    duration = parseInt(durationMatch[2], 10);
  }

  if (!name) return null;

  const isMealTask = isMeal(name);
  const energyCost = isMealTask ? -10 : calculateEnergyCost(duration || 30, isCritical, isBackburner, isBreak); 

  return {
    user_id: userId,
    name: name,
    duration: duration,
    break_duration: null, 
    original_scheduled_date: format(new Date(), 'yyyy-MM-dd'), 
    is_critical: isCritical,
    is_locked: false,
    energy_cost: energyCost,
    is_completed: false,
    is_custom_energy_cost: false,
    task_environment: 'laptop', 
    is_backburner: isBackburner, 
    is_work: isWork, // NEW
    is_break: isBreak, // NEW
  };
};

export const mergeOverlappingTimeBlocks = (blocks: TimeBlock[]): TimeBlock[] => {
  if (blocks.length === 0) return [];

  blocks.sort((a, b) => a.start.getTime() - b.start.getTime());

  const merged: TimeBlock[] = [];
  let currentMergedBlock = { ...blocks[0] };

  for (let i = 1; i < blocks.length; i++) {
    const nextBlock = blocks[i];

    if (currentMergedBlock.end >= nextBlock.start) {
      currentMergedBlock.end = new Date(Math.max(currentMergedBlock.end.getTime(), nextBlock.end.getTime()));
      currentMergedBlock.duration = Math.floor((currentMergedBlock.end.getTime() - currentMergedBlock.start.getTime()) / (1000 * 60));
    } else {
      merged.push(currentMergedBlock);
      currentMergedBlock = { ...nextBlock };
    }
  }

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
    currentFreeTimeCursor = new Date(Math.max(currentFreeTimeCursor.getTime(), occupiedBlock.end.getTime()));
  }

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

export const findFirstAvailableSlot = (
  durationMinutes: number,
  occupiedBlocks: TimeBlock[],
  searchStart: Date,
  workdayEnd: Date
): { start: Date; end: Date } | null => {
  const freeBlocks = getFreeTimeBlocks(occupiedBlocks, searchStart, workdayEnd);
  
  // --- SAFETY CHECK: Verify slot does not overlap with any occupied block ---
  for (const slot of freeBlocks) {
    if (slot.duration >= durationMinutes) {
      const proposedStart = slot.start;
      const proposedEnd = addMinutes(proposedStart, durationMinutes);
      
      // Double check against original occupied blocks to ensure no overlap
      const isSafe = occupiedBlocks.every(block => {
        return proposedEnd <= block.start || proposedStart >= block.end;
      });

      if (isSafe) {
        return {
          start: proposedStart,
          end: proposedEnd
        };
      }
    }
  }
  
  return null;
};

export const getStaticConstraints = (
  profile: UserProfile,
  selectedDayDate: Date,
  workdayStart: Date,
  workdayEnd: Date
): TimeBlock[] => {
  const constraints: TimeBlock[] = [];
  const addConstraint = (name: string, timeStr: string | null, duration: number | null) => {
    const effectiveDuration = (duration !== null && duration !== undefined && !isNaN(duration)) ? duration : 15;

    if (timeStr && effectiveDuration > 0) {
      let anchorStart = setTimeOnDate(selectedDayDate, timeStr);
      let anchorEnd = addMinutes(anchorStart, effectiveDuration);

      if (isBefore(anchorEnd, anchorStart)) {
        anchorEnd = addDays(anchorEnd, 1);
      }

      // Check if the anchor overlaps with the workday window
      const overlaps = (isBefore(anchorEnd, workdayEnd) || isEqual(anchorEnd, workdayEnd)) && 
                       (isAfter(anchorStart, workdayStart) || isEqual(anchorStart, workdayStart));
      
      if (overlaps) {
        const intersectionStart = max([anchorStart, workdayStart]);
        const intersectionEnd = min([anchorEnd, workdayEnd]);
        const finalDuration = differenceInMinutes(intersectionEnd, intersectionStart);
        if (finalDuration > 0) {
          constraints.push({ start: intersectionStart, end: intersectionEnd, duration: finalDuration });
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
};

export const compactScheduleLogic = (
  currentDbTasks: DBScheduledTask[],
  selectedDayDate: Date,
  workdayStartTime: Date,
  workdayEndTime: Date,
  T_current: Date,
  profile: UserProfile | null // NEW: Accept profile to get static anchors
): DBScheduledTask[] => {
  // 1. Separate tasks: Fixed/Locked/Completed stay put. Flexible/Incomplete move.
  const fixedTasks = currentDbTasks.filter(
    t => t.is_locked || !t.is_flexible || t.is_completed
  );
  
  const flexibleTasks = currentDbTasks
    .filter(t => t.is_flexible && !t.is_locked && !t.is_completed)
    .sort((a, b) => {
      // Prioritize by original chronological order
      return new Date(a.start_time!).getTime() - new Date(b.start_time!).getTime();
    });

  // 2. Generate static constraints (meals, reflections)
  const staticConstraints: TimeBlock[] = getStaticConstraints(
    profile!, // We assume profile is not null based on usage context
    selectedDayDate,
    workdayStartTime,
    workdayEndTime
  );

  // 3. Combine all fixed blocks (existing fixed tasks + static anchors)
  const allFixedAndStaticBlocks: TimeBlock[] = mergeOverlappingTimeBlocks([
    ...fixedTasks.filter(t => t.start_time && t.end_time).map(t => {
      const start = parseISO(t.start_time!);
      let end = parseISO(t.end_time!);
      if (isBefore(end, start)) end = addDays(end, 1);
      return { start, end, duration: differenceInMinutes(end, start) };
    }),
    ...staticConstraints
  ]);

  // 4. Determine the starting point for compaction
  // If viewing today, start from Now. If viewing future, start from Workday Start.
  const isToday = isSameDay(selectedDayDate, new Date());
  let insertionCursor = isToday ? max([workdayStartTime, T_current]) : workdayStartTime;

  const updatedTasks: DBScheduledTask[] = [...fixedTasks]; // Start with fixed tasks

  // 5. Re-place flexible tasks chronologically
  flexibleTasks.forEach((task) => {
    const duration = differenceInMinutes(
      parseISO(task.end_time!),
      parseISO(task.start_time!)
    );
    const totalDuration = duration + (task.break_duration || 0);

    let placed = false;
    let currentCursor = insertionCursor; // Use a local cursor for the loop

    while (!placed && isBefore(currentCursor, workdayEndTime)) {
      const proposedEnd = addMinutes(currentCursor, totalDuration);

      // Check for collisions with all fixed and static blocks
      const collidingBlock = allFixedAndStaticBlocks.find(block => {
        // Collision occurs if the proposed slot overlaps with the fixed block
        return (
          (isAfter(proposedEnd, block.start) && isBefore(currentCursor, block.end))
        );
      });

      if (!collidingBlock) {
        // No collision, place the task
        updatedTasks.push({
          ...task,
          start_time: currentCursor.toISOString(),
          end_time: proposedEnd.toISOString(),
        });
        insertionCursor = proposedEnd; // Move cursor to end of this task
        placed = true;
      } else {
        // Find the end of the colliding fixed block and move cursor there
        const collidingBlockEnd = collidingBlock.end;
        currentCursor = collidingBlockEnd;
        
        // Ensure the main insertion cursor is also updated if the collision pushes it further
        if (isAfter(currentCursor, insertionCursor)) {
            insertionCursor = currentCursor;
        }
      }
    }
  });

  return updatedTasks;
};


export const calculateSchedule = (
  dbTasks: DBScheduledTask[],
  selectedDay: string, 
  workdayStart: Date, 
  workdayEnd: Date,   
  isRegenPodActive: boolean, 
  regenPodStartTime: Date | null, 
  regenPodDurationMinutes: number, 
  T_current: Date, 
  breakfastTimeStr: string | null, 
  lunchTimeStr: string | null,     
  dinnerTimeStr: string | null,    
  breakfastDuration: number | null, 
  lunchDuration: number | null,     
  dinnerDuration: number | null,
  reflectionCount: number = 0,
  reflectionTimes: string[] = [],
  reflectionDurations: number[] = [],
  mealAssignments: any[] = [],
  isDayBlocked: boolean = false // NEW: Add isDayBlocked parameter
): FormattedSchedule => {
  let allRawItems: ScheduledItem[] = [];
  let totalActiveTimeMinutes = 0;
  let totalBreakTimeMinutes = 0;
  let criticalTasksRemaining = 0;
  let unscheduledCount = 0;
  let sessionEnd = workdayStart; 
  let extendsPastMidnight = false;
  let midnightRolloverMessage: string | null = null; // Corrected spelling here

  const [year, month, day] = selectedDay.split('-').map(Number);
  const selectedDayDate = new Date(year, month - 1, day); 

  // If the day is blocked, return an empty schedule with a specific message
  if (isDayBlocked) {
    return {
      items: [],
      summary: {
        totalTasks: 0,
        activeTime: { hours: 0, minutes: 0 },
        breakTime: 0,
        sessionEnd: workdayStart,
        extendsPastMidnight: false,
        midnightRolloverMessage: null,
        unscheduledCount: 0,
        criticalTasksRemaining: 0,
        isBlocked: true, // Indicate that the day is blocked
      },
      dbTasks: [],
    };
  }

  // 1. Add Scheduled Tasks from DB
  dbTasks.forEach((dbTask) => {
    if (!dbTask.start_time || !dbTask.end_time) {
      unscheduledCount++;
      return;
    }

    // Directly parse ISO strings to get Date objects representing the exact moment in time.
    // JavaScript's Date object will handle the local timezone interpretation for comparisons and display.
    let startTime = parseISO(dbTask.start_time);
    let endTime = parseISO(dbTask.end_time);

    // Ensure tasks are within the selected day's context, adjusting if they cross midnight
    // This logic is primarily for display and summary, assuming dbTasks are already filtered by scheduled_date
    if (isBefore(endTime, startTime) && isSameDay(startTime, selectedDayDate)) {
      endTime = addDays(endTime, 1);
      extendsPastMidnight = true;
      midnightRolloverMessage = "Schedule extends past midnight.";
    } else if (isBefore(endTime, startTime) && !isSameDay(startTime, selectedDayDate)) {
      // If the task starts on a previous day but ends on selectedDay, adjust startTime to selectedDayDate's start
      startTime = setHours(setMinutes(selectedDayDate, startTime.getMinutes()), startTime.getHours());
    }


    const duration = differenceInMinutes(endTime, startTime);
    if (duration <= 0) return;

    const isTimeOff = dbTask.name.toLowerCase() === 'time off';
    const isBreak = dbTask.name.toLowerCase() === 'break' || dbTask.is_break; // Check new is_break flag
    const isMealTask = isMeal(dbTask.name);
    const isCalendarEvent = !!dbTask.source_calendar_id; 

    let itemType: ScheduledItemType;
    if (isCalendarEvent) { 
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
      emoji: isCalendarEvent ? '📅' : assignEmoji(dbTask.name), 
      description: isBreak ? getBreakDescription(duration) : undefined,
      isTimedEvent: true,
      isCritical: dbTask.is_critical,
      isFlexible: dbTask.is_flexible,
      isLocked: dbTask.is_locked,
      energyCost: dbTask.energy_cost,
      isCompleted: dbTask.is_completed,
      isCustomEnergyCost: dbTask.is_custom_energy_cost,
      taskEnvironment: dbTask.task_environment,
      sourceCalendarId: dbTask.source_calendar_id, 
      isBackburner: dbTask.is_backburner, 
      isWork: dbTask.is_work || false, // NEW: Add isWork flag
      isBreak: dbTask.is_break || false, // NEW: Add isBreak flag
    };
    allRawItems.push(item);
  });

  // 2. Add Static Anchors (Meals, Reflections, Regen Pod)
  const addStaticAnchorItem = (name: string, timeStr: string | null, emoji: string, duration: number | null, type: ScheduledItemType = 'meal') => {
    const effectiveDuration = (duration !== null && duration !== undefined && !isNaN(duration)) ? duration : 15;

    if (timeStr && effectiveDuration > 0) {
      let anchorStart = setTimeOnDate(selectedDayDate, timeStr);
      let anchorEnd = addMinutes(anchorStart, effectiveDuration);

      if (isBefore(anchorEnd, anchorStart)) {
        anchorEnd = addDays(anchorEnd, 1);
      }

      const intersectionStart = max([anchorStart, workdayStart]);
      const intersectionEnd = min([anchorEnd, workdayEnd]);
      const finalDuration = differenceInMinutes(intersectionEnd, intersectionStart);

      if (finalDuration > 0) { 
        const mealTypeKey = name.toLowerCase();
        const isStandardMeal = ['breakfast', 'lunch', 'dinner'].includes(mealTypeKey);
        const assignment = mealAssignments.find(a => a.assigned_date === selectedDay && a.meal_type === mealTypeKey);
        const assignedMealName = assignment?.meal_idea?.name;
        
        let finalName: string = name;
        if (assignedMealName) {
          finalName = `${name}: ${assignedMealName}`;
        }

        const item: ScheduledItem = {
          id: `${type}-${name.toLowerCase().replace(/\s/g, '-')}-${format(intersectionStart, 'HHmm')}-${Math.random().toString(36).substr(2, 4)}`,
          type: type,
          name: finalName,
          duration: finalDuration,
          startTime: intersectionStart,
          endTime: intersectionEnd,
          emoji: emoji,
          description: `${name} window`,
          isTimedEvent: true,
          isCritical: false,
          isFlexible: false, 
          isLocked: true,   
          energyCost: type === 'meal' ? -10 : 0,  
          isCompleted: false,
          isCustomEnergyCost: false,
          taskEnvironment: 'home',
          sourceCalendarId: null,
          isBackburner: false,
          isWork: false, // Static anchors are not work
          isBreak: type === 'break' || type === 'meal', // Mark as break if it's a break or meal type
        };
        allRawItems.push(item);
      }
    }
  };

  addStaticAnchorItem('Breakfast', breakfastTimeStr, '🥞', breakfastDuration);
  addStaticAnchorItem('Lunch', lunchTimeStr, '🥗', lunchDuration);
  addStaticAnchorItem('Dinner', dinnerTimeStr, '🍽️', dinnerDuration);

  if (reflectionCount > 0 && reflectionTimes.length > 0) {
    for (let i = 0; i < reflectionCount; i++) {
      const time = reflectionTimes[i];
      const duration = reflectionDurations[i];
      if (time) {
        addStaticAnchorItem(`Reflection Point ${i + 1}`, time, '✨', duration, 'break');
      }
    }
  }

  if (isRegenPodActive && regenPodStartTime && isSameDay(regenPodStartTime, selectedDayDate)) {
    const podStart = regenPodStartTime;
    const podEnd = addMinutes(podStart, regenPodDurationMinutes);
    
    if (!isBefore(podEnd, T_current)) {
        const podItem: ScheduledItem = {
            id: 'regen-pod-active',
            type: 'break', 
            name: 'Energy Regen Pod',
            duration: differenceInMinutes(podEnd, podStart),
            startTime: podStart,
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
            isBackburner: false,
            isWork: false, // Regen Pod is not work
            isBreak: true, // Regen Pod is a break
        };
        allRawItems.push(podItem);
    }
  }

  // 3. Sort all raw items by start time
  allRawItems.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  // 4. Merge overlapping items into a final non-overlapping list
  const finalItems: ScheduledItem[] = [];
  if (allRawItems.length > 0) {
    let currentMergedItem = { ...allRawItems[0] };

    for (let i = 1; i < allRawItems.length; i++) {
      const nextItem = allRawItems[i];

      // Only merge if there's a strict overlap (current item starts before next item ends AND next item starts before current item ends)
      // This prevents merging of contiguous tasks (where current.endTime === next.startTime)
      if (currentMergedItem.startTime < nextItem.endTime && nextItem.startTime < currentMergedItem.endTime) {
        // Overlap detected, merge them
        const newStartTime = min([currentMergedItem.startTime, nextItem.startTime]);
        const newEndTime = max([currentMergedItem.endTime, nextItem.endTime]);
        const newDuration = differenceInMinutes(newEndTime, newStartTime);

        // Prioritize dbTask over static anchors if they overlap, or combine names
        let newName = currentMergedItem.name;
        let newEmoji = currentMergedItem.emoji;
        let newType = currentMergedItem.type;
        let newEnergyCost = currentMergedItem.energyCost;
        let newIsCritical = currentMergedItem.isCritical;
        let newIsBackburner = currentMergedItem.isBackburner;
        let newIsLocked = currentMergedItem.isLocked;
        let newIsFlexible = currentMergedItem.isFlexible;
        let newIsCompleted = currentMergedItem.isCompleted;
        let newIsCustomEnergyCost = currentMergedItem.isCustomEnergyCost;
        let newTaskEnvironment = currentMergedItem.taskEnvironment;
        let newSourceCalendarId = currentMergedItem.sourceCalendarId;
        let newIsWork = currentMergedItem.isWork; // NEW
        let newIsBreak = currentMergedItem.isBreak; // NEW

        // Simple prioritization: if nextItem is a 'task' and current is a 'meal'/'break', prioritize task
        // Or if both are tasks, combine names.
        if (nextItem.type === 'task' && (currentMergedItem.type === 'meal' || currentMergedItem.type === 'break')) {
          newName = nextItem.name;
          newEmoji = nextItem.emoji;
          newType = nextItem.type;
          newEnergyCost = nextItem.energyCost;
          newIsCritical = nextItem.isCritical;
          newIsBackburner = nextItem.isBackburner;
          newIsLocked = nextItem.isLocked;
          newIsFlexible = nextItem.isFlexible;
          newIsCompleted = nextItem.isCompleted;
          newIsCustomEnergyCost = nextItem.isCustomEnergyCost;
          newTaskEnvironment = nextItem.taskEnvironment;
          newSourceCalendarId = nextItem.sourceCalendarId;
          newIsWork = nextItem.isWork; // NEW
          newIsBreak = nextItem.isBreak; // NEW
        } else if (currentMergedItem.type === 'task' && (nextItem.type === 'meal' || nextItem.type === 'break')) {
          // current is task, next is meal/break, keep current
        } else {
          // Both are tasks, or static, or other combinations. Combine names.
          newName = `${currentMergedItem.name} / ${nextItem.name}`;
          // For emoji, pick the first one or a generic one
          newEmoji = currentMergedItem.emoji; 
          newType = 'task'; // Default to generic task if mixed
          newEnergyCost = currentMergedItem.energyCost + nextItem.energyCost;
          newIsCritical = currentMergedItem.isCritical || nextItem.isCritical;
          newIsBackburner = currentMergedItem.isBackburner || nextItem.isBackburner;
          newIsLocked = currentMergedItem.isLocked || nextItem.isLocked;
          newIsFlexible = currentMergedItem.isFlexible && nextItem.isFlexible;
          newIsCompleted = currentMergedItem.isCompleted && nextItem.isCompleted;
          newIsCustomEnergyCost = currentMergedItem.isCustomEnergyCost || nextItem.isCustomEnergyCost;
          // Environment and source calendar ID are tricky to merge, keep first for now
          newIsWork = currentMergedItem.isWork || nextItem.isWork; // NEW
          newIsBreak = currentMergedItem.isBreak || nextItem.isBreak; // NEW
        }

        currentMergedItem = {
          ...currentMergedItem,
          id: currentMergedItem.id, // Keep original ID if it's a primary task, or generate new if truly merged
          name: newName,
          startTime: newStartTime,
          endTime: newEndTime,
          duration: newDuration,
          emoji: newEmoji,
          type: newType,
          isCritical: newIsCritical,
          isBackburner: newIsBackburner,
          isLocked: newIsLocked,
          isFlexible: newIsFlexible,
          energyCost: newEnergyCost,
          isCompleted: newIsCompleted,
          isCustomEnergyCost: newIsCustomEnergyCost,
          taskEnvironment: newTaskEnvironment,
          sourceCalendarId: newSourceCalendarId,
          isWork: newIsWork, // NEW
          isBreak: newIsBreak, // NEW
        };
      } else {
        // No overlap, push the current merged item and start a new one
        finalItems.push(currentMergedItem);
        currentMergedItem = { ...nextItem };
      }
    }
    finalItems.push(currentMergedItem); // Push the last merged item
  }

  // 5. Recalculate summary based on finalItems
  finalItems.forEach(item => {
    if (item.type === 'task' || item.type === 'time-off' || item.type === 'calendar-event') { 
      totalActiveTimeMinutes += item.duration;
    } else if (item.type === 'break' || item.type === 'meal') {
      totalBreakTimeMinutes += item.duration;
    }

    if (item.isCritical && !item.isCompleted) {
      criticalTasksRemaining++;
    }
    sessionEnd = isAfter(item.endTime, sessionEnd) ? item.endTime : sessionEnd;
  });

  const totalActiveTimeHours = Math.floor(totalActiveTimeMinutes / 60);
  const totalActiveTimeMins = totalActiveTimeMinutes % 60;

  const summary: ScheduleSummary = {
    totalTasks: finalItems.length, // Count of merged items
    activeTime: { hours: totalActiveTimeHours, minutes: totalActiveTimeMins },
    breakTime: totalBreakTimeMinutes,
    sessionEnd: sessionEnd,
    extendsPastMidnight: extendsPastMidnight,
    midnightRolloverMessage: midnightRolloverMessage, // Corrected spelling here
    unscheduledCount: unscheduledCount,
    criticalTasksRemaining: criticalTasksRemaining,
    isBlocked: isDayBlocked, // Default to false
  };

  return {
    items: finalItems, // Use the merged items
    summary: summary,
    dbTasks: dbTasks, // Keep original dbTasks for other logic
  };
};

// NEW FUNCTION: Handles the core logic for environment chunking and macro-spread
const applyChunkingAndSpreading = (
  tasks: UnifiedTask[],
  enableEnvironmentChunking: boolean,
  enableMacroSpread: boolean,
  environmentOrder: string[]
): UnifiedTask[] => {
  if (!enableEnvironmentChunking && !enableMacroSpread) {
    return tasks;
  }

  // 1. Group tasks by environment
  const tasksByEnv: Record<string, UnifiedTask[]> = {};
  environmentOrder.forEach(env => tasksByEnv[env] = []);
  
  tasks.forEach(task => {
    const env = task.task_environment || 'laptop';
    if (!tasksByEnv[env]) tasksByEnv[env] = [];
    tasksByEnv[env].push(task);
  });

  // 2. Create ordered chunks
  const orderedChunks: UnifiedTask[][] = [];
  
  if (enableEnvironmentChunking) {
    // Interleave environments based on the user's defined order
    // We iterate until all environment buckets are empty
    let allEmpty = false;
    while (!allEmpty) {
      allEmpty = true;
      for (const env of environmentOrder) {
        if (tasksByEnv[env] && tasksByEnv[env].length > 0) {
          const chunk: UnifiedTask[] = [];
          // Take one task from this environment
          const task = tasksByEnv[env].shift();
          if (task) chunk.push(task);
          
          // If macro-spread is enabled, take a second task from the same environment if available
          if (enableMacroSpread && tasksByEnv[env].length > 0) {
            const secondTask = tasksByEnv[env].shift();
            if (secondTask) chunk.push(secondTask);
          }
          
          if (chunk.length > 0) {
            orderedChunks.push(chunk);
            allEmpty = false; // We found at least one task, so not all buckets are empty yet
          }
        }
      }
    }
  } else {
    // If only macro-spread is enabled (no chunking), we just create pairs from the single pool
    // This is a simplified interpretation of "macro-spread" without chunking
    const allTasks = tasks.slice(); // Copy
    while (allTasks.length > 0) {
      const chunk = allTasks.splice(0, 2); // Take up to 2 tasks
      if (chunk.length > 0) orderedChunks.push(chunk);
    }
  }

  // 3. Flatten the chunks back into a single array
  return orderedChunks.flat();
};

export const handleAutoScheduleAndSort = async (
  // This function is now implemented inside the hook, but the logic is here for reference.
  // The hook will call this logic.
  // This is a placeholder to show the logic is now available.
) => {
  // The actual implementation is in src/hooks/use-scheduler-tasks.ts
  // This function is now a utility that the hook can use.
  // The logic above (applyChunkingAndSpreading) is what needs to be integrated.
  // The hook's handleAutoScheduleAndSort will need to:
  // 1. Get the pool of tasks to schedule.
  // 2. Sort them by priority/created_at.
  // 3. Apply the chunking/spreading logic if enabled.
  // 4. Then proceed with the placement loop.
};