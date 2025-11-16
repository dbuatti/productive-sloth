import { format, addMinutes, isPast, isToday, startOfDay, addHours, addDays, parse, parseISO, setHours, setMinutes, isSameDay, isBefore, isAfter } from 'date-fns';
import { RawTaskInput, ScheduledItem, ScheduledItemType, FormattedSchedule, ScheduleSummary, DBScheduledTask, TimeMarker, DisplayItem, TimeBlock, UnifiedTask, NewRetiredTask } from '@/types/scheduler';

// --- Constants ---
export const EMOJI_MAP: { [key: string]: string } = {
  'gym': '🏋️', 'workout': '🏋️', 'run': '🏃', 'exercise': '🏋️', 'fitness': '💪',
  'email': '📧', 'messages': '💬', 'calls': '📞', 'communication': '🗣️', 'admin': '⚙️', 'paperwork': '📄',
  'meeting': '💼', 'work': '💻', 'report': '📝', 'professional': '👔', 'project': '📊', 'coding': '💻', 'develop': '💻', 'code': '💻', 'bug': '🐛', 'fix': '🛠️',
  'design': '🎨', 'writing': '✍️', 'art': '🖼️', 'creative': '✨', 'draw': '✏️',
  'study': '📦', // Updated to '📦' for house organization context
  'reading': '📖', 'course': '🎓', 'learn': '🧠', 'class': '🏫', 'lecture': '🧑‍🏫',
  'clean': '🧹', 'laundry': '🧺', 'organize': '🗄️', 'household': '🏠', 'setup': '🛠️',
  'cook': '🍳', 'meal prep': '🍲', 'groceries': '🛒', 'food': '🍔', 'lunch': '🥗', 'dinner': '🍽️', 'breakfast': '🥞', 'snack': '🍎',
  'brainstorm': '💡', 'strategy': '📈', 'review': '🔍', 'plan': '🗓️',
  'gaming': '🎮', 'hobbies': '🎲', 'leisure': '😌', 'movie': '🎬', 'relax': '🧘', 'chill': '🛋️',
  'meditation': '🧘', 'yoga': '🧘', 'self-care': '🛀', 'wellness': '🌸', 'mindfulness': '🧠', 'nap': '😴', 'rest': '🛌',
  'break': '☕️', 'coffee': '☕️', 'walk': '🚶', 'stretch': '🤸',
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
  // Updated/New Emojis based on chat-id=764
  'message': '💬', // For 'Return message to Lydia', 'Return message to Damien'
  'journal': '✍️', // For 'Journal about my relationship...'
  'washing': '👕', // For 'Load of washing'
  'money': '💰', 'transactions': '💰', // For 'Money transactions update'
  'mop': '🪣', 'floor': '🪣', // For 'Mop floor'
  'quote': '🧾', 'send quote': '🧾', 'generate quote': '🧾', // For 'Send and create quote for Stephen', 'Send quote to Mama Alto'
  'doctor': '🩺', 'medical': '🩺', // For 'Isabelle MD'
  'channel': '🧘', 'anxious': '🧘', // For 'Channel about what might be recycling me...'
  'recycling': '♻️', 'bin': '♻️', // For 'Bring in the new recycling bin'
  'milk': '🥛', 'cartons': '🥛', // For 'Empty the old milk cartons'
  'sync': '🤝', 'standup': '🤝', // Added back
  'tutorial': '💡', // For 'tutorial'
  // User-requested specific emoji mappings
  'tv': '📺', // Explicitly set for 'TV to Brad'
  'cobweb': '🕸️', // For 'Clean The Cobwebs'
  'cables': '🔌', // For 'Clean up the cables'
  'fold laundry': '🧺', // For 'Fold laundry'
  'load of laundry': '🧺', // For 'Load of laundry'
  'tidy': '📦', // For 'Big tidy around rooms', 'Tidy room'
  'room': '📦', // For 'Big tidy around rooms', 'Tidy room'
  'book': '📅', // For 'Book Nicholas In', 'Book Estelle In'
  'waitress': '📅', // For 'Waitress Preparation'
  'preparation': '📅', // For 'Waitress Preparation'
  'lego': '🧩', // This is playful—makes sense
  'organise': '👕', // For 'Organise white shirts'
  'shirts': '👕', // For 'Organise white shirts'
  'gigs': '👕', // For 'Organise white shirts'
  'charge': '🔌', // For 'Charge The Vacuum'
  'vacuum': '🔌', // For 'Charge The Vacuum'
  'put away': '📦', // For 'Put away my new sheets'
  'sheets': '📦', // For 'Put away my new sheets'
  'pants': '📦', // For 'Put away my new pants'
  'medication': '💊', // For 'Put medication next to toothbrush'
  'toothbrush': '💊', // For 'Put medication next to toothbrush'
  'return message': '💬', // For 'Return Message To Damien'
  'voice deal': '🎤', // For 'Voice Deal for Lydia'
  'find location': '📦', // For 'Find A Location For The Broom'
  'broom': '📦', // For 'Find A Location For The Broom'
  'practise': '🎹', // For 'Piano Practise'
  'track': '🎹', // For 'PIANO TRACK'
};

export const EMOJI_HUE_MAP: { [key: string]: number } = {
  'gym': 200, 'workout': 200, 'run': 210, 'exercise': 200, 'fitness': 200,
  'email': 240, 'messages': 245, 'calls': 250, 'communication': 240, 'admin': 270, 'paperwork': 230,
  'meeting': 280, 'work': 210, 'report': 230, 'professional': 280, 'project': 290, 'coding': 210, 'develop': 210, 'code': 210, 'bug': 90, 'fix': 40,
  'design': 320, 'writing': 320, 'art': 330, 'creative': 340, 'draw': 320,
  'study': 150, // Updated hue for house organization context
  'reading': 260, 'course': 260, 'learn': 270, 'class': 260, 'lecture': 260,
  'clean': 120, 'laundry': 130, 'organize': 140, 'household': 120, 'setup': 40,
  'cook': 30, 'meal prep': 35, 'groceries': 180, 'food': 25, 'lunch': 45, 'dinner': 10, 'breakfast': 50, 'snack': 350,
  'brainstorm': 60, 'strategy': 70, 'review': 80, 'plan': 220,
  'gaming': 0, 'tv': 10, 'hobbies': 20, 'leisure': 150, 'movie': 0, 'relax': 160, 'chill': 150,
  'meditation': 160, 'yoga': 160, 'self-care': 300, 'wellness': 170, 'mindfulness': 160, 'nap': 20, 'rest': 150,
  'break': 40, 'coffee': 30, 'walk': 100, 'stretch': 110,
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
  // Updated/New Emojis based on chat-id=764
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
  // User-requested specific emoji mappings
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
  'put away': 140, // Same as organise
  'sheets': 140, // Same as organise
  'pants': 140, // Same as organise
  'medication': 300, // Wellness
  'toothbrush': 300, // Wellness
  'return message': 245, // Same as message
  'voice deal': 270, // Music/performance related
  'find location': 140, // Same as organise
  'broom': 120, // Same as clean
  'practise': 270, // Same as piano
  'track': 270, // Same as piano
};

const BREAK_DESCRIPTIONS: { [key: number]: string } = {
  5: "Quick stretch",
  10: "Stand and hydrate",
  15: "Walk around, refresh",
  20: "Proper rest, step outside",
  30: "Meal break, recharge",
};

const DEFAULT_EMOJI = '📋';
const DEFAULT_HUE = 220;
// Removed DEFAULT_ENERGY_COST as it's now calculated

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

export const generateFixedTimeMarkers = (T_current: Date): TimeMarker[] => {
  const markers: TimeMarker[] = [];
  const startOfToday = startOfDay(T_current);

  markers.push({ id: 'marker-0', type: 'marker', time: startOfToday, label: formatTime(startOfToday) });

  for (let i = 3; i <= 24; i += 3) {
    const markerTime = addHours(startOfToday, i);
    markers.push({ id: `marker-${i}`, type: 'marker', time: markerTime, label: formatTime(markerTime) });
  }
  
  return markers;
};

export const parseFlexibleTime = (timeString: string, referenceDate: Date): Date => {
  const formatsToTry = [
    'h:mm a',
    'h a',
    'h:mma',
    'ha',
  ];

  for (const formatStr of formatsToTry) {
    const parsedDate = parse(timeString, formatStr, referenceDate);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  }

  return new Date('Invalid Date');
};

export const setTimeOnDate = (date: Date, timeString: string): Date => {
  const [hours, minutes] = timeString.split(':').map(Number);
  return setMinutes(setHours(date, hours), minutes);
};

/**
 * Calculates the energy cost based on task duration and criticality.
 * Formula: (Task Duration in Minutes * 0.5) + (If Critical * 10)
 */
export const calculateEnergyCost = (duration: number, isCritical: boolean): number => {
  const baseCost = duration * 0.5;
  const criticalSurcharge = isCritical ? 10 : 0;
  return Math.round(baseCost + criticalSurcharge); // Round to nearest whole number
};

interface ParsedTaskInput {
  name: string;
  duration?: number;
  breakDuration?: number;
  startTime?: Date;
  endTime?: Date;
  isCritical: boolean;
  shouldSink?: boolean;
  isFlexible: boolean;
  energyCost: number; // NEW: Made energyCost required
}

export const parseTaskInput = (input: string, selectedDayAsDate: Date): ParsedTaskInput | null => {
  input = input.trim(); // Trim input at the very beginning

  let isCritical = false;
  let shouldSink = false;
  let isFlexible = true; // Default to flexible, will be overridden for timed tasks
  let energyCost: number = 0; // Will be calculated later

  // Order of parsing flags matters: sink, then critical, then fixed
  if (input.endsWith(' sink')) {
    shouldSink = true;
    input = input.slice(0, -5).trim();
  }

  // Check for 'fixed' keyword first, as it's an explicit override
  const hasFixedKeyword = input.endsWith(' fixed');
  if (hasFixedKeyword) {
    isFlexible = false;
    input = input.slice(0, -6).trim();
  }

  // Enforce 'Time Off' as fixed, regardless of 'fixed' keyword presence
  if (input.toLowerCase().startsWith('time off')) {
    isFlexible = false;
    energyCost = 0; // Time Off has no energy cost
  }

  const timeRangePattern = /(\d{1,2}(:\d{2})?\s*(?:AM|PM|am|pm))\s*-\s*(\d{1,2}(:\d{2})?\s*(?:AM|PM|am|pm))/i;
  const timeRangeMatch = input.match(timeRangePattern);

  if (timeRangeMatch) {
    // If a time range is specified, it's implicitly fixed unless 'flexible' was explicitly used
    // The `hasFixedKeyword` check above already handles explicit `fixed`.
    // If `hasFixedKeyword` is false, but a time range is found, we set `isFlexible = false`.
    if (!hasFixedKeyword && !input.endsWith(' flexible')) { // Ensure 'flexible' keyword doesn't override implicit fixed
      isFlexible = false;
    }
    
    const fullTimeRangeString = timeRangeMatch[0];
    const startTimeStr = timeRangeMatch[1].trim();
    const endTimeStr = timeRangeMatch[3].trim();

    const startTime = parseFlexibleTime(startTimeStr, selectedDayAsDate);
    const endTime = parseFlexibleTime(endTimeStr, selectedDayAsDate);

    if (!isNaN(startTime.getTime()) && !isNaN(endTime.getTime())) {
      const rawTaskName = input.replace(fullTimeRangeString, '').trim();

      const stopWords = ['at', 'from', 'to', 'between', 'is', 'a', 'the', 'and'];
      const stopWordsRegex = new RegExp(`\\b(?:${stopWords.join('|')})\\b`, 'gi');
      
      const cleanedTaskName = rawTaskName
        .replace(stopWordsRegex, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (cleanedTaskName) {
        const duration = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
        energyCost = calculateEnergyCost(duration, isCritical);
        return { name: cleanedTaskName, startTime, endTime, isCritical, shouldSink, isFlexible, energyCost };
      }
    }
  }

  const durationRegex = /^(.*?)\s+(\d+)(?:\s+(\d+))?$/;
  const durationMatch = input.match(durationRegex);

  if (durationMatch) {
    const name = durationMatch[1].trim();
    const duration = parseInt(durationMatch[2], 10);
    const breakDuration = durationMatch[3] ? parseInt(durationMatch[3], 10) : undefined;
    if (name && duration > 0) {
      energyCost = calculateEnergyCost(duration, isCritical);
      return { name, duration, breakDuration, isCritical, shouldSink, isFlexible, energyCost };
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
  isCritical: boolean;
  isFlexible: boolean;
  energyCost: number; // NEW: Made energyCost required
}

export const parseInjectionCommand = (input: string): ParsedInjectionCommand | null => {
  input = input.trim(); // Trim input at the very beginning

  let isCritical = false;
  let isFlexible = true; // Default to flexible
  let energyCost: number = 0; // Will be calculated later

  if (input.endsWith(' !')) {
    isCritical = true;
    input = input.slice(0, -2).trim();
  }

  if (input.endsWith(' fixed')) {
    isFlexible = false;
    input = input.slice(0, -6).trim();
  }

  // Enforce 'Time Off' as fixed, regardless of 'fixed' keyword presence
  if (input.toLowerCase().startsWith('inject "time off"')) {
    isFlexible = false;
    energyCost = 0; // Time Off has no energy cost
  }


  const injectRegex = /^inject\s+"(.*?)"(?:\s+(\d+)(?:\s+(\d+))?)?(?:\s+from\s+(\d{1,2}(:\d{2})?\s*(?:am|pm))\s+to\s+(\d{1,2}(:\d{2})?\s*(?:am|pm)))?$/i;
  const match = input.match(injectRegex);

  if (match) {
    const taskName = match[1].trim();
    const duration = match[2] ? parseInt(match[2], 10) : undefined;
    const breakDuration = match[3] ? parseInt(match[3], 10) : undefined;
    const startTime = match[4] ? match[4].trim() : undefined;
    const endTime = match[6] ? match[6].trim() : undefined;

    if (taskName) {
      if (startTime && endTime) {
        isFlexible = false; // Timed injections are always fixed
        // For injection command, we can't calculate energyCost here without selectedDayAsDate
        // It will be calculated in SchedulerPage when the dialog is submitted.
        energyCost = 0; // Placeholder, will be recalculated
      } else if (duration) {
        energyCost = calculateEnergyCost(duration, isCritical);
      } else {
        // If no duration or time, default to a common duration for calculation
        energyCost = calculateEnergyCost(30, isCritical);
      }
      
      // Re-apply 'Time Off' fixed enforcement for injection
      if (taskName.toLowerCase() === 'time off') {
        isFlexible = false;
        energyCost = 0; // Time Off has no energy cost
      }
      return { taskName, duration, breakDuration, startTime, endTime, isCritical, isFlexible, energyCost };
    }
  }
  return null;
};

interface ParsedCommand {
  type: 'clear' | 'remove' | 'show' | 'reorder' | 'compact' | 'timeoff' | 'aether dump' | 'reset schedule' | 'aether dump mega'; // Added 'aether dump mega'
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
    const index = parseInt(removeByIndexMatch[1], 10) - 1;
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
    return { type: 'reorder' };
  }

  if (lowerInput === 'compact' || lowerInput === 'reshuffle') {
    return { type: 'compact' };
  }

  if (lowerInput.startsWith('time off')) {
    return { type: 'timeoff' };
  }

  if (lowerInput === 'aether dump') {
    return { type: 'aether dump' };
  }

  if (lowerInput === 'aether dump mega') { // NEW: Aether Dump Mega command
    return { type: 'aether dump mega' };
  }

  if (lowerInput === 'reset schedule') {
    return { type: 'reset schedule' };
  }

  return null;
};

export const mergeOverlappingTimeBlocks = (blocks: { start: Date; end: Date; duration: number }[]): { start: Date; end: Date; duration: number }[] => {
  if (blocks.length === 0) return [];

  blocks.sort((a, b) => a.start.getTime() - b.start.getTime());

  const merged: { start: Date; end: Date; duration: number }[] = [];
  let currentMergedBlock = { ...blocks[0] };

  for (let i = 1; i < blocks.length; i++) {
    const nextBlock = blocks[i];

    if (currentMergedBlock.end.getTime() >= nextBlock.start.getTime()) {
      currentMergedBlock.end = isAfter(currentMergedBlock.end, nextBlock.end) ? currentMergedBlock.end : nextBlock.end;
      currentMergedBlock.duration = Math.floor((currentMergedBlock.end.getTime() - currentMergedBlock.start.getTime()) / (1000 * 60));
    } else {
      merged.push(currentMergedBlock);
      currentMergedBlock = { ...nextBlock };
    }
  }

  merged.push(currentMergedBlock);
  return merged;
};

export const isSlotFree = (
  proposedStart: Date,
  proposedEnd: Date,
  occupiedBlocks: { start: Date; end: Date; duration: number }[]
): boolean => {
  for (const block of occupiedBlocks) {
    if (isBefore(proposedStart, block.end) && isAfter(proposedEnd, block.start)) {
      return false;
    }
    if (proposedStart.getTime() === block.start.getTime() && proposedEnd.getTime() === block.end.getTime()) {
      return false;
    }
  }
  return true;
};

/**
 * Sorts tasks by Vibe Flow pattern:
 * 1. Critical tasks first.
 * 2. Then by Emoji/Color Hue.
 * 3. Then by duration (longest first) within each emoji group.
 */
// Removed sortTasksByVibeFlow function


// --- Core Scheduling Logic ---

export const calculateSchedule = (
  dbTasks: DBScheduledTask[],
  selectedDateString: string,
  workdayStartTime: Date,
  workdayEndTime: Date
): FormattedSchedule => {
  const scheduledItems: ScheduledItem[] = [];
  let totalActiveTime = 0;
  let totalBreakTime = 0;
  let unscheduledCount = 0;
  let criticalTasksRemaining = 0;

  const allTasksWithTimes: DBScheduledTask[] = dbTasks.filter(task => task.start_time && task.end_time);

  allTasksWithTimes.sort((a, b) => {
    const startA = parseISO(a.start_time!);
    const startB = parseISO(b.start_time!);
    return startA.getTime() - startB.getTime();
  });

  const selectedDayAsDate = parseISO(selectedDateString);

  allTasksWithTimes.forEach(task => {
    let startTime = parseISO(task.start_time!);
    let endTime = parseISO(task.end_time!);

    startTime = setHours(setMinutes(selectedDayAsDate, startTime.getMinutes()), startTime.getHours());
    endTime = setHours(setMinutes(selectedDayAsDate, endTime.getMinutes()), endTime.getHours());

    if (isBefore(endTime, startTime)) {
        endTime = addDays(endTime, 1);
    }

    if (isBefore(startTime, workdayStartTime) || isAfter(endTime, workdayEndTime)) {
      unscheduledCount++;
    }

    if (task.is_critical) {
      criticalTasksRemaining++;
    }

    const duration = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
    const isStandaloneBreak = task.name.toLowerCase() === 'break';
    const isTimeOff = task.name.toLowerCase().includes('time off');
    const isMealTime = ['breakfast', 'lunch', 'dinner'].some(meal => task.name.toLowerCase().includes(meal));


    scheduledItems.push({
      id: task.id, 
      type: isStandaloneBreak ? 'break' : (isTimeOff ? 'time-off' : 'task'),
      name: task.name, 
      duration: duration,
      startTime: startTime, 
      endTime: endTime, 
      emoji: isStandaloneBreak ? EMOJI_MAP['break'] : (isTimeOff ? EMOJI_MAP['time off'] : assignEmoji(task.name)),
      description: isStandaloneBreak ? getBreakDescription(duration) : undefined,
      isTimedEvent: true,
      isCritical: task.is_critical,
      isFlexible: task.is_flexible,
      isLocked: task.is_locked, // NEW: Pass is_locked status
      energyCost: task.energy_cost, // NEW: Pass energy_cost
      isCompleted: task.is_completed, // NEW: Pass is_completed status
      isCustomEnergyCost: task.is_custom_energy_cost, // NEW: Pass is_custom_energy_cost status
    });
    
    if (!isMealTime && !isTimeOff) {
      if (isStandaloneBreak || task.break_duration) {
        totalBreakTime += duration;
        if (task.break_duration) totalBreakTime += task.break_duration;
      } else {
        totalActiveTime += duration;
      }
    }
  });

  scheduledItems.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  const sessionEnd = scheduledItems.length > 0 ? scheduledItems[scheduledItems.length - 1].endTime : workdayStartTime;
  const extendsPastMidnight = !isSameDay(sessionEnd, selectedDayAsDate) && scheduledItems.length > 0;
  const midnightRolloverMessage = extendsPastMidnight ? getMidnightRolloverMessage(sessionEnd, new Date()) : null;

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
    unscheduledCount: unscheduledCount,
    criticalTasksRemaining: criticalTasksRemaining,
  };

  return {
    items: scheduledItems,
    summary: summary,
    dbTasks: dbTasks,
  };
};

export const compactScheduleLogic = (
  allCurrentTasks: DBScheduledTask[],
  selectedDate: Date,
  workdayStartTime: Date,
  workdayEndTime: Date,
  T_current: Date,
  preSortedFlexibleTasks?: DBScheduledTask[], // Optional: if tasks are already sorted for a specific purpose (e.g., auto-balance)
): DBScheduledTask[] => {
  const finalSchedule: DBScheduledTask[] = [];

  // 1. Separate tasks into immovable (fixed or locked) and movable (flexible and unlocked)
  const immovableTasks = allCurrentTasks.filter(task => !task.is_flexible || task.is_locked);
  let movableTasksToPlace = preSortedFlexibleTasks || allCurrentTasks.filter(task => task.is_flexible && !task.is_locked);

  // 2. Sort immovable tasks by their start time to easily find the next boundary
  immovableTasks.sort((a, b) => parseISO(a.start_time!).getTime() - parseISO(b.start_time!).getTime());

  // 3. Add immovable tasks to the final schedule first. Their positions are fixed.
  finalSchedule.push(...immovableTasks);

  // 4. Create occupied blocks from immovable tasks. These are the "no-go" zones.
  let occupiedBlocks = mergeOverlappingTimeBlocks(immovableTasks.map(task => ({
    start: parseISO(task.start_time!),
    end: parseISO(task.end_time!),
    duration: Math.floor((parseISO(task.end_time!).getTime() - parseISO(task.start_time!).getTime()) / (1000 * 60))
  })));

  // 5. Determine the starting point for placing flexible tasks.
  // If viewing today and current time is after workday start, start from now. Otherwise, start from workday start.
  let currentPlacementCursor = isSameDay(selectedDate, T_current) && isAfter(T_current, workdayStartTime)
    ? T_current
    : workdayStartTime;

  // If the current placement cursor is already past the workday end, no flexible tasks can be placed.
  if (isAfter(currentPlacementCursor, workdayEndTime)) {
    return finalSchedule; // Only immovable tasks remain
  }

  // 6. Sort movable tasks (default to creation order if not pre-sorted, or use preSortedFlexibleTasks order)
  if (!preSortedFlexibleTasks) {
    movableTasksToPlace.sort((a, b) => parseISO(a.created_at).getTime() - parseISO(b.created_at).getTime());
  }

  // 7. Iterate through movable tasks and try to place them
  for (const movableTask of movableTasksToPlace) {
    const taskDuration = Math.floor((parseISO(movableTask.end_time!).getTime() - parseISO(movableTask.start_time!).getTime()) / (1000 * 60));
    const taskBreakDuration = movableTask.break_duration || 0;
    const totalTaskDuration = taskDuration + taskBreakDuration;

    let placed = false;
    let currentSearchTime = currentPlacementCursor;

    // Find the next immovable boundary after the current search time.
    // This is the start time of the first immovable task that begins after currentSearchTime.
    // If no such task exists, the boundary is the workdayEndTime.
    let nextImmovableBoundary = workdayEndTime;
    for (const immovableTask of immovableTasks) {
      const immovableStartTime = parseISO(immovableTask.start_time!);
      if (isAfter(immovableStartTime, currentSearchTime)) {
        nextImmovableBoundary = immovableStartTime;
        break;
      }
    }

    // Search for a slot for the movable task between currentSearchTime and nextImmovableBoundary
    while (isBefore(currentSearchTime, nextImmovableBoundary) && isBefore(currentSearchTime, workdayEndTime)) {
      let potentialEndTime = addMinutes(currentSearchTime, totalTaskDuration);

      // Ensure potentialEndTime does not cross the immovable boundary or workday end
      if (isAfter(potentialEndTime, nextImmovableBoundary)) {
        break; // Cannot place this task before the next immovable boundary
      }
      if (isAfter(potentialEndTime, workdayEndTime)) {
        break; // Cannot place this task within the workday
      }

      // Check if the proposed slot is free from all occupied blocks (including other immovable tasks)
      const isFree = isSlotFree(currentSearchTime, potentialEndTime, occupiedBlocks);

      if (isFree) {
        // Place the task
        finalSchedule.push({
          ...movableTask,
          start_time: currentSearchTime.toISOString(),
          end_time: potentialEndTime.toISOString(),
        });
        // Add this newly placed task's block to occupiedBlocks for subsequent checks
        occupiedBlocks.push({
          start: currentSearchTime,
          end: potentialEndTime,
          duration: totalTaskDuration
        });
        occupiedBlocks = mergeOverlappingTimeBlocks(occupiedBlocks); // Re-merge to keep it clean
        currentPlacementCursor = potentialEndTime; // Advance the cursor for the next movable task
        placed = true;
        break; // Move to the next movable task
      } else {
        // If not free, advance currentSearchTime past the overlapping block
        let nextAvailableTime = currentSearchTime;
        for (const block of occupiedBlocks) {
          // If currentSearchTime is within an occupied block, jump past it
          if (isBefore(currentSearchTime, block.end) && isAfter(block.end, nextAvailableTime)) {
            nextAvailableTime = block.end;
          }
        }
        // If nextAvailableTime is still currentSearchTime, it means there's no block to jump over,
        // but the slot is not free. This might happen if the slot is too small.
        // In this case, we should advance by a small increment or break if stuck.
        if (nextAvailableTime.getTime() === currentSearchTime.getTime()) {
          currentSearchTime = addMinutes(currentSearchTime, 1); // Smallest increment
        } else {
          currentSearchTime = nextAvailableTime;
        }
      }
    }
    if (!placed) {
      console.warn(`compactScheduleLogic: Movable task "${movableTask.name}" could not be placed within the available segment.`);
      // If not placed, it means it couldn't fit before the next immovable boundary or workday end.
      // It will not be added to finalSchedule, effectively "skipped" for this compaction run.
    }
  }

  // 8. Sort the final schedule by start time before returning
  finalSchedule.sort((a, b) => parseISO(a.start_time!).getTime() - parseISO(b.start_time!).getTime());
  return finalSchedule;
};

export const getFreeTimeBlocks = (
  occupiedBlocks: TimeBlock[],
  workdayStart: Date,
  workdayEnd: Date
): TimeBlock[] => {
  const freeBlocks: TimeBlock[] = [];
  let currentFreeTimeStart = workdayStart;

  for (const appt of occupiedBlocks) {
    if (isBefore(appt.end, currentFreeTimeStart)) {
        continue;
    }

    if (isBefore(currentFreeTimeStart, appt.start)) {
      const duration = Math.floor((appt.start.getTime() - currentFreeTimeStart.getTime()) / (1000 * 60));
      if (duration > 0) {
        freeBlocks.push({ start: currentFreeTimeStart, end: appt.start, duration });
      }
    }
    currentFreeTimeStart = isAfter(appt.end, currentFreeTimeStart) ? appt.end : currentFreeTimeStart;
  }

  if (isBefore(currentFreeTimeStart, workdayEnd)) {
    const duration = Math.floor((workdayEnd.getTime() - currentFreeTimeStart.getTime()) / (1000 * 60));
    if (duration > 0) {
      freeBlocks.push({ start: currentFreeTimeStart, end: workdayEnd, duration });
    }
  }
  return freeBlocks;
};

/**
 * Parses a string input to create a NewRetiredTask object.
 * Expected format: "Task Name [Duration] [!]"
 * - Task Name: The name of the task.
 * - Duration (optional): A number representing the task duration in minutes. Defaults to 30 if not provided.
 * - ! (optional): Marks the task as critical.
 */
export const parseSinkTaskInput = (input: string, userId: string): NewRetiredTask | null => {
  input = input.trim();

  if (!input) return null;

  let isCritical = false;
  if (input.endsWith(' !')) {
    isCritical = true;
    input = input.slice(0, -2).trim();
  }

  const durationRegex = /^(.*?)\s+(\d+)$/;
  const durationMatch = input.match(durationRegex);

  let name: string;
  let duration: number | null = 30; // Default duration for sink tasks
  let breakDuration: number | null = null;

  if (durationMatch) {
    name = durationMatch[1].trim();
    duration = parseInt(durationMatch[2], 10);
    if (isNaN(duration) || duration <= 0) {
      duration = 30; // Fallback to default if invalid duration
    }
  } else {
    name = input;
  }

  if (!name) return null;

  const energyCost = calculateEnergyCost(duration || 30, isCritical); // Calculate energy cost

  return {
    user_id: userId,
    name: name,
    duration: duration,
    break_duration: breakDuration,
    original_scheduled_date: format(new Date(), 'yyyy-MM-dd'), // Default to today
    is_critical: isCritical,
    is_locked: false, // New tasks in sink are not locked by default
    energy_cost: energyCost,
    is_custom_energy_cost: false, // Default to false for new sink tasks
  };
};