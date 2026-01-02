import { format, addMinutes, isPast, isToday, startOfDay, addHours, addDays, parse, parseISO, setHours, setMinutes, isSameDay, isBefore, isAfter, differenceInMinutes, min, max, isEqual } from 'date-fns';
import { RawTaskInput, ScheduledItem, ScheduledItemType, FormattedSchedule, ScheduleSummary, DBScheduledTask, TimeMarker, DisplayItem, TimeBlock, UnifiedTask, NewRetiredTask } from '@/types/scheduler';
import { UserProfile } from '@/hooks/use-session'; // Import UserProfile
import { MealAssignment } from '@/hooks/use-meals'; // Import MealAssignment

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
  'reflection': '✨',
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
  'reflection': 60,
};

// --- Utility Functions ---

export const formatTime = (date: Date): string => format(date, 'h:mm a');
export const formatDayMonth = (date: Date): string => format(date, 'MMM d');
export const formatDateTime = (date: Date): string => format(date, 'MMM d, h:mm a');

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

  if (lowerInput.endsWith(' !')) {
    isCritical = true;
    rawInput = rawInput.slice(0, -2).trim();
    lowerInput = rawInput.toLowerCase();
  }

  if (lowerInput.startsWith('-')) {
    isBackburner = true;
    rawInput = rawInput.slice(1).trim();
    lowerInput = rawInput.toLowerCase();
  }

  if (lowerInput.endsWith(' sink')) {
    shouldSink = true;
    rawInput = rawInput.slice(0, -5).trim();
    lowerInput = rawInput.toLowerCase();
  }

  if (lowerInput.endsWith(' fixed')) {
    isFlexible = false;
    rawInput = rawInput.slice(0, -6).trim();
    lowerInput = rawInput.toLowerCase();
  }
  
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
  selectedDayAsDate: Date,
  workdayStartTime: Date,
  workdayEndTime: Date,
  T_current: Date,
  profile: UserProfile, // NEW: Add profile
  mealAssignments: MealAssignment[] // NEW: Add mealAssignments
): DBScheduledTask[] => {
  // 1. Separate tasks: Fixed/Locked/Completed stay put. Flexible/Incomplete move.
  const fixedDbTasks = currentDbTasks.filter(
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

    if (timeStr && effectiveDuration > 0) {
      let anchorStart = setTimeOnDate(selectedDayAsDate, timeStr);
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

  addStaticConstraint('Breakfast', profile.breakfast_time, profile.breakfast_duration_minutes);
  addStaticConstraint('Lunch', profile.lunch_time, profile.lunch_duration_minutes);
  addStaticConstraint('Dinner', profile.dinner_time, profile.dinner_duration_minutes);

  for (let r = 0; r < (profile.reflection_count || 0); r++) {
      const rTime = profile.reflection_times?.[r];
      const rDur = profile.reflection_durations?.[r];
      if (rTime && rDur) addStaticConstraint(`Reflection Point ${r + 1}`, rTime, rDur);
  }

  // 3. Combine all fixed blocks (scheduled fixed tasks + static constraints)
  const allFixedBlocks: TimeBlock[] = [
    ...fixedDbTasks.filter(t => t.start_time && t.end_time).map(t => {
      const start = setTimeOnDate(selectedDayAsDate, format(parseISO(t.start_time!), 'HH:mm'));
      let end = setTimeOnDate(selectedDayAsDate, format(parseISO(t.end_time!), 'HH:mm'));
      if (isBefore(end, start)) end = addDays(end, 1);
      return { start, end, duration: differenceInMinutes(end, start) };
    }),
    ...staticConstraints
  ];

  const mergedOccupiedBlocks = mergeOverlappingTimeBlocks(allFixedBlocks);

  // 4. Determine the starting point for compaction
  // If viewing today, start from Now. If viewing future, start from Workday Start.
  const isTodaySelected = isSameDay(selectedDayAsDate, new Date());
  let insertionCursor = isTodaySelected ? max([workdayStartTime, T_current]) : workdayStartTime;

  const updatedTasks: DBScheduledTask[] = [...fixedDbTasks]; // Start with fixed tasks

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

      // Check for collisions with all merged occupied blocks
      const collidingBlock = mergedOccupiedBlocks.find(block => {
        // Collision occurs if the proposed slot overlaps with the occupied block
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
        // Find the end of the colliding block and move cursor there
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
  dbScheduledTasks: DBScheduledTask[],
  selectedDayString: string,
  workdayStartTime: Date,
  workdayEndTime: Date,
  isInRegenPod: boolean,
  regenPodStartTime: Date | null,
  regenPodDurationMinutes: number,
  T_current: Date,
  profileBreakfastTime: string | null,
  profileLunchTime: string | null,
  profileDinnerTime: string | null,
  profileBreakfastDuration: number | null,
  profileLunchDuration: number | null,
  profileDinnerDuration: number | null,
  profileReflectionCount: number,
  profileReflectionTimes: string[],
  profileReflectionDurations: number[],
  mealAssignments: MealAssignment[]
): FormattedSchedule => {
  const selectedDayAsDate = parseISO(selectedDayString);
  const items: ScheduledItem[] = [];
  const dbTasks: DBScheduledTask[] = []; // To store the actual DB tasks for reference

  // 1. Add scheduled tasks from DB
  dbScheduledTasks.forEach(task => {
    const startTime = task.start_time ? parseISO(task.start_time) : null;
    const endTime = task.end_time ? parseISO(task.end_time) : null;

    if (startTime && endTime) {
      const duration = differenceInMinutes(endTime, startTime);
      const isMealTask = ['breakfast', 'lunch', 'dinner'].includes(task.name.toLowerCase());
      let taskName = task.name;

      if (isMealTask) {
        const assignment = mealAssignments.find(a => a.assigned_date === selectedDayString && a.meal_type === task.name.toLowerCase());
        if (assignment?.meal_idea?.name) {
          taskName = assignment.meal_idea.name;
        }
      }

      items.push({
        id: task.id,
        type: isMealTask ? 'meal' : 'task',
        name: taskName,
        duration: duration,
        startTime: startTime,
        endTime: endTime,
        emoji: assignEmoji(taskName),
        isTimedEvent: true,
        isCritical: task.is_critical,
        isFlexible: task.is_flexible,
        isLocked: task.is_locked,
        energyCost: task.energy_cost,
        isCompleted: task.is_completed,
        isCustomEnergyCost: task.is_custom_energy_cost,
        taskEnvironment: task.task_environment,
        sourceCalendarId: task.source_calendar_id,
        isBackburner: task.is_backburner,
      });
      dbTasks.push(task);
    }
  });

  // 2. Add static anchors (Meals, Reflections)
  const addStaticAnchor = (name: string, timeStr: string | null, duration: number | null, type: ScheduledItemType, emoji: string, energyCost: number = 0) => {
    const effectiveDuration = (duration !== null && duration !== undefined && !isNaN(duration)) ? duration : 15;

    if (timeStr && effectiveDuration > 0) {
      let anchorStart = setTimeOnDate(selectedDayAsDate, timeStr);
      let anchorEnd = addMinutes(anchorStart, effectiveDuration);

      if (isBefore(anchorEnd, anchorStart)) {
        anchorEnd = addDays(anchorEnd, 1);
      }

      // Ensure static anchors are within the workday window
      const intersectionStart = max([anchorStart, workdayStartTime]);
      const intersectionEnd = min([anchorEnd, workdayEndTime]);
      const finalDuration = differenceInMinutes(intersectionEnd, intersectionStart);

      if (finalDuration > 0) {
        // Check if an existing scheduled task already covers this static anchor's time
        const isCoveredByExistingTask = dbScheduledTasks.some(task => {
          if (!task.start_time || !task.end_time) return false;
          const taskStart = parseISO(task.start_time);
          const taskEnd = parseISO(task.end_time);
          return (
            (intersectionStart < taskEnd && intersectionEnd > taskStart) ||
            (taskStart < intersectionEnd && taskEnd > intersectionStart)
          );
        });

        if (!isCoveredByExistingTask) {
          let finalName = name;
          if (type === 'meal') {
            const assignment = mealAssignments.find(a => a.assigned_date === selectedDayString && a.meal_type === name.toLowerCase());
            if (assignment?.meal_idea?.name) {
              finalName = assignment.meal_idea.name;
            }
          }

          items.push({
            id: `${type}-${name.toLowerCase().replace(/\s/g, '-')}-${selectedDayString}-${format(intersectionStart, 'HHmm')}`,
            type: type,
            name: finalName,
            duration: finalDuration,
            startTime: intersectionStart,
            endTime: intersectionEnd,
            emoji: emoji,
            isTimedEvent: true,
            isCritical: false,
            isFlexible: false,
            isLocked: true,
            energyCost: energyCost,
            isCompleted: false,
            isCustomEnergyCost: false,
            taskEnvironment: 'home', // Default environment for meals/reflections
            sourceCalendarId: null,
            isBackburner: false,
          });
        }
      }
    }
  };

  addStaticAnchor('Breakfast', profileBreakfastTime, profileBreakfastDuration, 'meal', '🥞', -10);
  addStaticAnchor('Lunch', profileLunchTime, profileLunchDuration, 'meal', '🥗', -10);
  addStaticAnchor('Dinner', profileDinnerTime, profileDinnerDuration, 'meal', '🍽️', -10);

  for (let r = 0; r < (profileReflectionCount || 0); r++) {
    const rTime = profileReflectionTimes?.[r];
    const rDur = profileReflectionDurations?.[r];
    if (rTime && rDur) addStaticAnchor(`Reflection Point ${r + 1}`, rTime, rDur, 'break', '✨', 0);
  }

  // 3. Add Regen Pod session if active
  if (isInRegenPod && regenPodStartTime) {
    const podEnd = addMinutes(regenPodStartTime, regenPodDurationMinutes);
    const intersectionStart = max([regenPodStartTime, workdayStartTime]);
    const intersectionEnd = min([podEnd, workdayEndTime]);
    const finalDuration = differenceInMinutes(intersectionEnd, intersectionStart);

    if (finalDuration > 0) {
      items.push({
        id: 'regen-pod',
        type: 'break', // Treat as a special break
        name: 'Energy Regen Pod',
        duration: finalDuration,
        startTime: intersectionStart,
        endTime: intersectionEnd,
        emoji: '🔋',
        isTimedEvent: true,
        isCritical: false,
        isFlexible: false,
        isLocked: true,
        energyCost: 0,
        isCompleted: false,
        isCustomEnergyCost: false,
        taskEnvironment: 'away', // Pod is a special environment
        sourceCalendarId: null,
        isBackburner: false,
      });
    }
  }

  // Sort all items by start time
  items.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  // Calculate summary
  let totalActiveTimeMinutes = 0;
  let totalBreakTimeMinutes = 0;
  let lastEndTime = workdayStartTime;
  let unscheduledCount = 0;
  let criticalTasksRemaining = 0;

  const processedItems: ScheduledItem[] = [];
  const occupiedBlocks: TimeBlock[] = [];

  items.forEach(item => {
    // Ensure item is within workday bounds
    const itemStart = max([item.startTime, workdayStartTime]);
    const itemEnd = min([item.endTime, workdayEndTime]);

    if (isBefore(itemEnd, itemStart)) return; // Skip if item is entirely outside or inverted

    const effectiveDuration = differenceInMinutes(itemEnd, itemStart);
    if (effectiveDuration <= 0) return;

    // Add to occupied blocks for gap calculation
    occupiedBlocks.push({ start: itemStart, end: itemEnd, duration: effectiveDuration });

    if (item.type === 'task' || item.type === 'calendar-event') {
      totalActiveTimeMinutes += effectiveDuration;
      if (item.isCritical && !item.isCompleted) {
        criticalTasksRemaining++;
      }
    } else if (item.type === 'break' || item.type === 'meal') {
      totalBreakTimeMinutes += effectiveDuration;
    }
    processedItems.push(item);
  });

  // Merge overlapping occupied blocks to accurately calculate free time
  const mergedOccupiedBlocks = mergeOverlappingTimeBlocks(occupiedBlocks);

  // Calculate unscheduled count (tasks that couldn't fit)
  // This logic is typically handled by the auto-scheduler, but for display,
  // we can assume any flexible, incomplete tasks not in `processedItems` are unscheduled.
  // For now, we'll rely on the auto-scheduler to manage this.
  // The `unscheduledCount` in summary is usually derived from tasks that failed placement.

  const sessionEnd = processedItems.length > 0 ? processedItems[processedItems.length - 1].endTime : workdayStartTime;
  const extendsPastMidnight = isAfter(sessionEnd, addDays(startOfDay(selectedDayAsDate), 1));
  const midnightRolloverMessage = extendsPastMidnight ? "Schedule extends past midnight." : null;

  const summary: ScheduleSummary = {
    totalTasks: processedItems.filter(i => i.type === 'task' || i.type === 'calendar-event').length,
    activeTime: {
      hours: Math.floor(totalActiveTimeMinutes / 60),
      minutes: totalActiveTimeMinutes % 60,
    },
    breakTime: totalBreakTimeMinutes,
    sessionEnd: sessionEnd,
    extendsPastMidnight: extendsPastMidnight,
    midnightRolloverMessage: midnightRolloverMessage,
    unscheduledCount: unscheduledCount, // This needs to be calculated by the auto-scheduler
    criticalTasksRemaining: criticalTasksRemaining,
  };

  return {
    items: processedItems,
    summary: summary,
    dbTasks: dbTasks,
  };
};