import { format, addMinutes, isPast, isToday, startOfDay, addHours, addDays, parse, parseISO, setHours, setMinutes, isSameDay, isBefore, isAfter, isPast as isPastDate, differenceInMinutes, min, max, isEqual } from 'date-fns';
import { RawTaskInput, ScheduledItem, ScheduledItemType, FormattedSchedule, ScheduleSummary, DBScheduledTask, TimeMarker, DisplayItem, TimeBlock, UnifiedTask, NewRetiredTask } from '@/types/scheduler';

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
  'reflection': 340,
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
  dbTasks: DBScheduledTask[],
  selectedDayAsDate: Date,
  workdayStartTime: Date,
  workdayEndTime: Date,
  T_current: Date,
  tasksToPlace?: DBScheduledTask[] 
): DBScheduledTask[] => {
  const isTodaySelected = isSameDay(selectedDayAsDate, T_current);
  const effectiveWorkdayStart = isTodaySelected && isBefore(workdayStartTime, T_current) ? T_current : workdayStartTime;

  const fixedAndLockedTasks = dbTasks.filter(task => !task.is_flexible || task.is_locked);
  
  let flexibleTasksToCompact: DBScheduledTask[];

  if (tasksToPlace) {
    flexibleTasksToCompact = tasksToPlace.filter(task => !task.is_completed);
  } else {
    flexibleTasksToCompact = dbTasks.filter(task => task.is_flexible && !task.is_locked && !task.is_completed);
  }

  if (isTodaySelected) {
    flexibleTasksToCompact = flexibleTasksToCompact.filter(task => {
      if (!task.start_time) return true; 
      const taskEndTime = parseISO(task.end_time!);
      return isAfter(taskEndTime, T_current);
    });
  }
  
  flexibleTasksToCompact.sort((a, b) => {
    if (a.is_critical && !b.is_critical) return -1;
    if (!a.is_critical && b.is_critical) return 1;
    
    if (a.is_backburner && !b.is_backburner) return 1;
    if (!a.is_backburner && b.is_backburner) return -1;

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
          localStart = addDays(localStart, 0); // local Date
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
      if (!placed) {
        const nextOccupiedBlock = currentOccupiedBlocks.find(block => isAfter(block.start, searchStartTime));
        if (nextOccupiedBlock) {
          searchStartTime = nextOccupiedBlock.end;
        } else {
          break;
        }
      }
    }
  }

  return [...fixedAndLockedTasks, ...newFlexibleTaskPlacements];
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
  reflectionDurations: number[] = []
): FormattedSchedule => {
  const items: ScheduledItem[] = [];
  let totalActiveTimeMinutes = 0;
  let totalBreakTimeMinutes = 0;
  let criticalTasksRemaining = 0;
  let unscheduledCount = 0;
  let sessionEnd = workdayStart; 
  let extendsPastMidnight = false;
  let midnightRolloverMessage: string | null = null;

  const [year, month, day] = selectedDay.split('-').map(Number);
  const selectedDayDate = new Date(year, month - 1, day); 

  const addStaticAnchor = (name: string, timeStr: string | null, emoji: string, duration: number | null, type: ScheduledItemType = 'meal') => {
    // MODIFIED: Added safe default for duration (15m) if it's missing but a time exists
    const effectiveDuration = (duration !== null && duration !== undefined && !isNaN(duration)) ? duration : 15;

    if (timeStr && effectiveDuration > 0) {
      let anchorStart = setTimeOnDate(selectedDayDate, timeStr);
      let anchorEnd = addMinutes(anchorStart, effectiveDuration);

      if (isBefore(anchorEnd, anchorStart)) {
        anchorEnd = addDays(anchorEnd, 1);
      }

      const overlaps = isBefore(anchorStart, workdayEnd) && isAfter(anchorEnd, workdayStart);
      
      if (overlaps) {
        const intersectionStart = max([anchorStart, workdayStart]);
        const intersectionEnd = min([anchorEnd, workdayEnd]);
        const finalDuration = differenceInMinutes(intersectionEnd, intersectionStart);

        if (finalDuration > 0) { 
          const item: ScheduledItem = {
            id: `${type}-${name.toLowerCase().replace(/\s/g, '-')}-${format(intersectionStart, 'HHmm')}-${Math.random().toString(36).substr(2, 4)}`,
            type: type,
            name: name,
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
          };
          items.push(item);
          if (type === 'meal' || type === 'break') {
            totalBreakTimeMinutes += item.duration;
          } else {
            totalActiveTimeMinutes += item.duration;
          }
          sessionEnd = isAfter(item.endTime, sessionEnd) ? item.endTime : sessionEnd;
          console.log(`[scheduler-utils] Anchor Injected: ${name} (${item.duration}m) at ${format(item.startTime, 'HH:mm')}`);
        } else {
            console.log(`[scheduler-utils] Anchor Skipped (0 effective duration): ${name}`);
        }
      } else {
          console.log(`[scheduler-utils] Anchor Skipped (outside window): ${name} starting at ${format(anchorStart, 'HH:mm')}`);
      }
    }
  };

  addStaticAnchor('Breakfast', breakfastTimeStr, '🥞', breakfastDuration);
  addStaticAnchor('Lunch', lunchTimeStr, '🥗', lunchDuration);
  addStaticAnchor('Dinner', dinnerTimeStr, '🍽️', dinnerDuration);

  if (reflectionCount > 0 && reflectionTimes.length > 0) {
    console.log("[scheduler-utils] Processing Reflections Loop:", { count: reflectionCount, times: reflectionTimes });
    for (let i = 0; i < reflectionCount; i++) {
      const time = reflectionTimes[i];
      const duration = reflectionDurations[i];
      // Diagnostic log showing the raw evaluation before injection logic
      console.log(`[scheduler-utils] Eval Reflection ${i+1}:`, { time, duration });
      if (time) {
        addStaticAnchor(`Reflection Point ${i + 1}`, time, '✨', duration, 'break');
      }
    }
  }

  const sortedTasks = [...dbTasks].sort((a, b) => {
    if (a.start_time && b.start_time) {
      return parseISO(a.start_time).getTime() - parseISO(b.start_time).getTime();
    }
    return 0;
  });

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
        items.push(podItem);
        totalBreakTimeMinutes += podItem.duration;
        sessionEnd = isAfter(podEnd, sessionEnd) ? podEnd : sessionEnd;
    }
  }

  sortedTasks.forEach((dbTask) => {
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

    items.push(item);

    if (item.type === 'task' || item.type === 'time-off' || item.type === 'calendar-event') { 
      totalActiveTimeMinutes += duration;
    } else if (item.type === 'break' || item.type === 'meal') {
      totalBreakTimeMinutes += duration;
    }

    if (item.isCritical && !item.isCompleted) {
      criticalTasksRemaining++;
    }

    sessionEnd = isAfter(item.endTime, sessionEnd) ? item.endTime : sessionEnd;
  });

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