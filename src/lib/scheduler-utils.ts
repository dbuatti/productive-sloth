import { format, addMinutes, isPast, isToday, startOfDay, addHours, addDays, parse, parseISO, setHours, setMinutes, isSameDay, isBefore, isAfter, isPast as isPastDate, differenceInMinutes, min, max, isEqual } from 'date-fns';
import { RawTaskInput, ScheduledItem, ScheduledItemType, FormattedSchedule, ScheduleSummary, DBScheduledTask, TimeMarker, DisplayItem, TimeBlock, UnifiedTask, NewRetiredTask } from '@/types/scheduler';
import { UserProfile } from '@/hooks/use-session'; // Import UserProfile

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
  'tv': '10',
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
  'reflection': 180,
};

export const EMOJI_HUE_MAP: { [key: string]: number } = {
  'gym': 10, 'workout': 10, 'run': 10, 'exercise': 10, 'fitness': 10,
  'email': 200, 'messages': 200, 'calls': 200, 'communication': 200, 'admin': 200, 'paperwork': 200,
  'meeting': 240, 'work': 240, 'report': 240, 'professional': 240, 'project': 240, 'coding': 240, 'develop': 240, 'code': 240, 'bug': 240, 'fix': 240,
  'design': 280, 'writing': 280, 'art': 280, 'creative': 280, 'draw': 280,
  'study': 320, 
  'reading': 320, 'course': 320, 'learn': 320, 'class': 320, 'lecture': 320,
  'clean': 40, 'laundry': 40, 'organize': 40, 'household': 40, 'setup': 40,
  'cook': 30, 'meal prep': 30, 'groceries': 30, 'food': 30, 'lunch': 30, 'dinner': 30, 'breakfast': 30, 'snack': 30, 'eat': 30, 
  'brainstorm': 60, 'strategy': 60, 'review': 60, 'plan': 60,
  'gaming': 120, 'hobbies': 120, 'leisure': 120, 'movie': 120, 'relax': 120, 'chill': 120,
  'meditation': 180, 'yoga': 180, 'self-care': 180, 'wellness': 180, 'mindfulness': 180, 'nap': 180, 'rest': 180,
  'break': 30, 'coffee': 30, 'walk': 30, 'stretch': 30, 'coffee break': 30,
  'piano': 270, 'music': 270, 'practice': 270,
  'commute': 210, 'drive': 210, 'bus': 210, 'train': 210, 'travel': 210,
  'shop': 150, 'bank': 150, 'post': 150, 'errands': 150,
  'friends': 300, 'family': 300, 'social': 300,
  'wake up': 50,
  'coles': 150,
  'woolworths': 150,
  'lesson': 320,
  'call': 200,
  'phone': 200,
  'text': 200,
  'contact': 200,
  'student': 320,
  'rehearsal': 270,
  'time off': 100,
  'message': 200,
  'journal': 280,
  'washing': 40,
  'money': 150, 'transactions': 150,
  'mop': 40, 'floor': 40,
  'quote': 240, 'send quote': 240, 'generate quote': 240,
  'doctor': 10, 'medical': 10,
  'channel': 180, 'anxious': 180,
  'recycling': 40, 'bin': 40,
  'milk': 30, 'cartons': 30,
  'sync': 240, 'standup': 240,
  'tutorial': 60,
  'tv': 120,
  'cobweb': 40,
  'cables': 40,
  'fold laundry': 40,
  'load of laundry': 40,
  'tidy': 40,
  'room': 40,
  'book': 320,
  'waitress': 240,
  'preparation': 280,
  'lego': 120,
  'organise': 40,
  'shirts': 40,
  'gigs': 270,
  'charge': 40,
  'vacuum': 40,
  'put away': 40,
  'sheets': 40,
  'pants': 40,
  'medication': 10,
  'toothbrush': 10,
  'return message': 200,
  'voice deal': 270,
  'find location': 210,
  'broom': 40,
  'practise': 270,
  'track': 270,
  'catch up': 240,
  'trim': 10,
  'cuticle': 10,
  'payment': 150,
  'link': 200,
  'send': 200,
  'voice notes': 280,
  'job notes': 280,
  'process': 240,
  'usb': 40,
  'cable': 40,
  'coil': 40,
  'write up': 280,
  'notes': 280,
  'reflection': 180,
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

export const calculateEnergyCost = (duration: number, isCritical: boolean, isBackburner: boolean = false): number => {
  if (isMeal('meal')) { 
    return -10; 
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
} | null => {
  let rawInput = input.trim();
  let lowerInput = rawInput.toLowerCase();
  let isCritical = false;
  let isBackburner = false; 
  let shouldSink = false;
  let isFlexible = true; 

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
      const energyCost = isMealTask ? -10 : calculateEnergyCost(duration, isCritical, isBackburner);

      return { name, startTime, endTime, isCritical, isBackburner, isFlexible: false, shouldSink, energyCost }; 
    }
  }

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
  isBackburner?: boolean; 
  energyCost: number;
} | null => {
  const lowerInput = input.toLowerCase().trim();
  const injectMatch = lowerInput.match(/^inject\s+"([^"]+)"(?:\s+(\d+))?(?:\s+(\d{1,2}(:\d{2})?\s*(am|pm)?))?(?:\s*-\s*(\d{1,2}(:\d{2})?\s*(am|pm)?))?(?:\s+(!))?(?:\s+(-))?(?:\s+(fixed))?$/);

  if (injectMatch) {
    const taskName = injectMatch[1];
    const duration = injectMatch[2] ? parseInt(injectMatch[2], 10) : undefined;
    const startTime = injectMatch[3] || undefined;
    const endTime = injectMatch[6] || undefined;
    const isCritical = !!injectMatch[9];
    const isBackburner = !!injectMatch[10]; 
    const isFlexible = !injectMatch[11]; 

    let calculatedEnergyCost = 0;
    const isMealTask = isMeal(taskName);

    if (isMealTask) {
      calculatedEnergyCost = -10;
    } else if (duration) {
      calculatedEnergyCost = calculateEnergyCost(duration, isCritical, isBackburner);
    } else {
      calculatedEnergyCost = calculateEnergyCost(30, isCritical, isBackburner); 
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

  if (name.endsWith(' !')) {
    isCritical = true;
    name = name.slice(0, -2).trim();
  }

  if (name.startsWith('-')) {
    isBackburner = true;
    name = name.slice(1).trim();
  }

  const durationMatch = name.match(/^(.*?)\s+(\d+)$/);
  if (durationMatch) {
    name = durationMatch[1].trim();
    duration = parseInt(durationMatch[2], 10);
  }

  if (!name) return null;

  const isMealTask = isMeal(name);
  const energyCost = isMealTask ? -10 : calculateEnergyCost(duration || 30, isCritical, isBackburner); 

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

export const isSlotFree = (
  proposedStart: Date,
  proposedEnd: Date,
  occupiedBlocks: TimeBlock[]
): boolean => {
  for (const block of occupiedBlocks) {
    if (proposedStart < block.end && proposedEnd > block.start) {
      return false; 
    }
  }
  return true; 
};

export const compactScheduleLogic = (
  currentDbTasks: DBScheduledTask[],
  selectedDayDate: Date,
  workdayStartTime: Date,
  workdayEndTime: Date,
  T_current: Date,
  profile: UserProfile | null // NEW: Accept profile to get static anchors
): DBScheduledTask[] => {
  // NEW: If the day is blocked, return an empty array of tasks to update
  if (profile?.blocked_days?.includes(format(selectedDayDate, 'yyyy-MM-dd'))) {
    return [];
  }

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
  const staticConstraints: TimeBlock[] = [];
  const addStaticConstraint = (name: string, timeStr: string | null, duration: number | null) => {
    const effectiveDuration = (duration !== null && duration !== undefined && !isNaN(duration)) ? duration : 15;

    if (profile && timeStr && effectiveDuration > 0) {
      let anchorStart = setTimeOnDate(selectedDayDate, timeStr);
      let anchorEnd = addMinutes(anchorStart, effectiveDuration);

      if (isBefore(anchorEnd, anchorStart)) {
        anchorEnd = addDays(anchorEnd, 1);
      }

      // Check if the anchor overlaps with the workday window
      const overlaps = (isBefore(anchorEnd, workdayEndTime) || isEqual(anchorEnd, workdayEndTime)) && 
                       (isAfter(anchorStart, workdayStartTime) || isEqual(anchorStart, workdayStartTime));
      
      if (overlaps) {
        const intersectionStart = max([anchorStart, workdayStartTime]);
        const intersectionEnd = min([anchorEnd, workdayEndTime]);
        const finalDuration = differenceInMinutes(intersectionEnd, intersectionStart);

        if (finalDuration > 0) { 
          staticConstraints.push({
            start: intersectionStart,
            end: intersectionEnd,
            duration: finalDuration,
          });
        }
      }
    }
  };

  if (profile) {
    addStaticConstraint('Breakfast', profile.breakfast_time, profile.breakfast_duration_minutes);
    addStaticConstraint('Lunch', profile.lunch_time, profile.lunch_duration_minutes);
    addStaticConstraint('Dinner', profile.dinner_time, profile.dinner_duration_minutes);

    for (let r = 0; r < (profile.reflection_count || 0); r++) {
        const rTime = profile.reflection_times?.[r];
        const rDur = profile.reflection_durations?.[r];
        if (rTime && rDur) addStaticConstraint(`Reflection Point ${r + 1}`, rTime, rDur);
    }
  }

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
  profile: UserProfile | null // NEW: Pass profile to check for blocked days
): FormattedSchedule => {
  let allRawItems: ScheduledItem[] = [];
  let totalActiveTimeMinutes = 0;
  let totalBreakTimeMinutes = 0;
  let criticalTasksRemaining = 0;
  let unscheduledCount = 0;
  let sessionEnd = workdayStart; 
  let extendsPastMidnight = false;
  let midnightRolloverMessage: string | null = null;

  const [year, month, day] = selectedDay.split('-').map(Number);
  const selectedDayDate = new Date(year, month - 1, day); 

  // NEW: Check if the day is blocked
  const isDayBlocked = profile?.blocked_days?.includes(selectedDay);

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
        unscheduledCount: dbTasks.length, // All tasks are unscheduled if day is blocked
        criticalTasksRemaining: 0,
      },
      dbTasks: dbTasks,
      isBlocked: true, // NEW: Add isBlocked flag to the schedule
    };
  }

  // 1. Add Scheduled Tasks from DB
  dbTasks.forEach((dbTask) => {
    if (!dbTask.start_time || !dbTask.end_time) {
      unscheduledCount++;
      return;
    }

    const startTimeUTC = parseISO(dbTask.start_time);
    const endTimeUTC = parseISO(dbTask.end_time);

    let startTime = setTimeOnDate(selectedDayDate, format(startTimeUTC, 'HH:mm'));
    let endTime = setTimeOnDate(selectedDayDate, format(endTimeUTC, 'HH:mm'));

    if (isBefore(endTime, startTime)) {
      endTime = addDays(endTime, 1);
      extendsPastMidnight = true;
      midnightRolloverMessage = "Schedule extends past midnight.";
    }

    const duration = differenceInMinutes(endTime, startTime);
    if (duration <= 0) return;

    const isTimeOff = dbTask.name.toLowerCase() === 'time off';
    const isBreak = dbTask.name.toLowerCase() === 'break';
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
        const assignment = isStandardMeal ? mealAssignments.find(a => a.assigned_date === selectedDay && a.meal_type === mealTypeKey) : undefined;
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
          color: type === 'meal' ? 'bg-logo-orange/20' : undefined,
          isCritical: false,
          isFlexible: false, 
          isLocked: true,   
          energyCost: type === 'meal' ? -10 : 0,  
          isCompleted: false,
          isCustomEnergyCost: false,
          taskEnvironment: 'home', 
          sourceCalendarId: null,
          isBackburner: false,
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

      if (currentMergedItem.endTime > nextItem.startTime) {
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
        } else if (currentMergedItem.type === 'task' && (nextItem.type === 'meal' || nextItem.type === 'break')) {
          // current is task, next is meal/break, keep current
        } else {
          // Both are tasks, or both are static, or other combinations. Combine names.
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
    midnightRolloverMessage: midnightRoloverMessage,
    unscheduledCount: unscheduledCount,
    criticalTasksRemaining: criticalTasksRemaining,
  };

  return {
    items: finalItems, // Use the merged items
    summary: summary,
    dbTasks: dbTasks, // Keep original dbTasks for other logic
    isBlocked: false, // Not blocked
  };
};