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
  'gaming': 0, 'hobbies': 20, 'leisure': 150, 'movie': 0, 'relax': 160, 'chill': 150, 
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

export const calculateEnergyCost = (duration: number, isCritical: boolean): number => {
  let baseCost = Math.ceil(duration / 15) * 5; // 5 energy per 15 minutes
  if (isCritical) {
    baseCost = Math.ceil(baseCost * 1.5); // Critical tasks cost 50% more energy
  }
  return Math.max(5, baseCost); // Minimum energy cost of 5
};

export const parseFlexibleTime = (timeString: string, baseDate: Date): Date => {
  const lowerCaseTimeString = timeString.toLowerCase();
  const now = new Date();
  let parsedDate: Date;

  // Try parsing with AM/PM
  parsedDate = parse(lowerCaseTimeString, 'h:mm a', baseDate);
  if (!isNaN(parsedDate.getTime())) return parsedDate;

  parsedDate = parse(lowerCaseTimeString, 'ha', baseDate);
  if (!isNaN(parsedDate.getTime())) return parsedDate;

  // Try parsing 24-hour format
  parsedDate = parse(lowerCaseTimeString, 'HH:mm', baseDate);
  if (!isNaN(parsedDate.getTime())) return parsedDate;

  // Handle simple hour inputs (e.g., "9", "14")
  const hourMatch = lowerCaseTimeString.match(/^(\d{1,2})$/);
  if (hourMatch) {
    const hour = parseInt(hourMatch[1], 10);
    if (hour >= 0 && hour <= 23) {
      return setHours(setMinutes(baseDate, 0), hour);
    }
  }

  // Fallback to current time if parsing fails
  return now;
};

export const parseTaskInput = (input: string, selectedDayAsDate: Date): {
  name: string;
  duration?: number;
  breakDuration?: number;
  startTime?: Date;
  endTime?: Date;
  isCritical: boolean;
  isFlexible: boolean;
  shouldSink: boolean;
  energyCost: number;
} | null => {
  const lowerInput = input.toLowerCase().trim();
  let isCritical = false;
  let shouldSink = false;
  let isFlexible = true; // Default to flexible

  // Check for critical flag
  if (lowerInput.endsWith(' !')) {
    isCritical = true;
    input = input.slice(0, -2).trim();
  }

  // Check for sink flag
  if (lowerInput.endsWith(' sink')) {
    shouldSink = true;
    input = input.slice(0, -5).trim();
  }

  // Check for fixed flag (only applies to duration-based tasks, timed tasks are implicitly fixed)
  if (lowerInput.endsWith(' fixed')) {
    isFlexible = false;
    input = input.slice(0, -6).trim();
  }

  // Time Off (always fixed, no energy cost)
  const timeOffMatch = input.match(/^(time off)\s+(\d{1,2}(:\d{2})?\s*(am|pm)?)\s*-\s*(\d{1,2}(:\d{2})?\s*(am|pm)?)$/i);
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
      isFlexible: false, // Time Off is always fixed
      shouldSink: false,
      energyCost: 0, // Time Off has no energy cost
    };
  }

  // Duration-based task: "Task Name 60 [10] [!] [sink] [fixed]"
  const durationMatch = input.match(/^(.*?)\s+(\d+)(?:\s+(\d+))?$/);
  if (durationMatch) {
    const name = durationMatch[1].trim();
    const duration = parseInt(durationMatch[2], 10);
    const breakDuration = durationMatch[3] ? parseInt(durationMatch[3], 10) : undefined;

    if (name && duration > 0) {
      const energyCost = calculateEnergyCost(duration, isCritical);
      return { name, duration, breakDuration, isCritical, isFlexible, shouldSink, energyCost };
    }
  }

  // Timed task: "Task Name 10am-11am [!] [fixed]"
  const timeRangeMatch = input.match(/^(.*?)\s+(\d{1,2}(:\d{2})?\s*(am|pm)?)\s*-\s*(\d{1,2}(:\d{2})?\s*(am|pm)?)$/i);
  if (timeRangeMatch) {
    const name = timeRangeMatch[1].trim();
    const startTimeString = timeRangeMatch[2];
    const endTimeString = timeRangeMatch[5];

    const startTime = parseFlexibleTime(startTimeString, selectedDayAsDate);
    const endTime = parseFlexibleTime(endTimeString, selectedDayAsDate);

    if (name && !isNaN(startTime.getTime()) && !isNaN(endTime.getTime())) {
      const duration = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
      const energyCost = calculateEnergyCost(duration, isCritical);
      return { name, startTime, endTime, isCritical, isFlexible: false, shouldSink, energyCost }; // Timed tasks are implicitly fixed
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
  energyCost: number;
} | null => {
  const lowerInput = input.toLowerCase().trim();
  const injectMatch = lowerInput.match(/^inject\s+"([^"]+)"(?:\s+(\d+))?(?:\s+(\d{1,2}(:\d{2})?\s*(am|pm)?))?(?:\s*-\s*(\d{1,2}(:\d{2})?\s*(am|pm)?))?(?:\s+(!))?(?:\s+(fixed))?$/);

  if (injectMatch) {
    const taskName = injectMatch[1];
    const duration = injectMatch[2] ? parseInt(injectMatch[2], 10) : undefined;
    const startTime = injectMatch[3] || undefined;
    const endTime = injectMatch[6] || undefined;
    const isCritical = !!injectMatch[9];
    const isFlexible = !injectMatch[10]; // If 'fixed' flag is present, it's not flexible

    let calculatedEnergyCost = 0;
    if (duration) {
      calculatedEnergyCost = calculateEnergyCost(duration, isCritical);
    } else if (startTime && endTime) {
      // For injection, we can't reliably calculate energy cost without a base date for parsing times
      // This will be handled in the component where the actual date is known.
      // For now, provide a default or placeholder.
      calculatedEnergyCost = calculateEnergyCost(60, isCritical); // Assume 60 min for placeholder
    } else {
      calculatedEnergyCost = calculateEnergyCost(30, isCritical); // Default for unknown duration
    }

    return {
      taskName,
      duration,
      startTime,
      endTime,
      isCritical,
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
  if (lowerInput.startsWith('time off')) {
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

  // Check for critical flag
  if (name.endsWith(' !')) {
    isCritical = true;
    name = name.slice(0, -2).trim();
  }

  // Check for duration
  const durationMatch = name.match(/^(.*?)\s+(\d+)$/);
  if (durationMatch) {
    name = durationMatch[1].trim();
    duration = parseInt(durationMatch[2], 10);
  }

  if (!name) return null;

  const energyCost = calculateEnergyCost(duration || 30, isCritical); // Default to 30 min if no duration

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
  const flexibleTasksToCompact = tasksToPlace || dbTasks.filter(task => task.is_flexible && !task.is_locked);

  // Sort flexible tasks by priority (critical first), then duration (longest first)
  flexibleTasksToCompact.sort((a, b) => {
    if (a.is_critical && !b.is_critical) return -1;
    if (!a.is_critical && b.is_critical) return 1;
    const durationA = Math.floor((parseISO(a.end_time!).getTime() - parseISO(a.start_time!).getTime()) / (1000 * 60));
    const durationB = Math.floor((parseISO(b.end_time!).getTime() - parseISO(b.start_time!).getTime()) / (1000 * 60));
    return durationB - durationA; // Longest first
  });

  let currentOccupiedBlocks: TimeBlock[] = mergeOverlappingTimeBlocks(
    fixedAndLockedTasks
      .filter(task => task.start_time && task.end_time)
      .map(task => {
        const utcStart = parseISO(task.start_time!);
        const utcEnd = parseISO(task.end_time!);

        let localStart = setHours(setMinutes(selectedDayAsDate, utcStart.getMinutes()), utcStart.getHours());
        let localEnd = setHours(setMinutes(selectedDayAsDate, utcEnd.getMinutes()), utcEnd.getHours());

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
  selectedDayString: string,
  workdayStartTime: Date,
  workdayEndTime: Date
): FormattedSchedule => {
  const selectedDayAsDate = parseISO(selectedDayString);
  const now = new Date();
  const isTodaySelected = isSameDay(selectedDayAsDate, now);

  const scheduledItems: ScheduledItem[] = [];
  let totalActiveTimeMinutes = 0;
  let totalBreakTimeMinutes = 0;
  let sessionEnd = workdayStartTime;
  let extendsPastMidnight = false;
  let midnightRolloverMessage: string | null = null; // Corrected declaration
  let criticalTasksRemaining = 0;

  // Filter out tasks that are not for the selected day
  const tasksForSelectedDay = dbTasks.filter(task =>
    isSameDay(parseISO(task.scheduled_date), selectedDayAsDate)
  );

  // Sort tasks by start time
  tasksForSelectedDay.sort((a, b) => {
    const startTimeA = a.start_time ? parseISO(a.start_time).getTime() : 0;
    const startTimeB = b.start_time ? parseISO(b.start_time).getTime() : 0;
    return startTimeA - startTimeB;
  });

  for (const task of tasksForSelectedDay) {
    if (!task.start_time || !task.end_time) continue;

    const utcStart = parseISO(task.start_time);
    const utcEnd = parseISO(task.end_time);

    let localStart = setHours(setMinutes(selectedDayAsDate, utcStart.getMinutes()), utcStart.getHours());
    let localEnd = setHours(setMinutes(selectedDayAsDate, utcEnd.getMinutes()), utcEnd.getHours());

    // Handle tasks that roll over to the next day
    if (isBefore(localEnd, localStart)) {
      localEnd = addDays(localEnd, 1);
      extendsPastMidnight = true;
      midnightRolloverMessage = "Your schedule extends past midnight."; // Corrected assignment
    }

    const duration = Math.floor((localEnd.getTime() - localStart.getTime()) / (1000 * 60));

    const isBreak = task.name.toLowerCase() === 'break';
    const isTimeOff = task.name.toLowerCase() === 'time off';

    const itemType: ScheduledItemType = isBreak ? 'break' : (isTimeOff ? 'time-off' : 'task');

    scheduledItems.push({
      id: task.id,
      type: itemType,
      name: task.name,
      duration: duration,
      startTime: localStart,
      endTime: localEnd,
      emoji: assignEmoji(task.name),
      description: isBreak ? getBreakDescription(duration) : undefined,
      isTimedEvent: true,
      isCritical: task.is_critical,
      isFlexible: task.is_flexible,
      isLocked: task.is_locked,
      energyCost: task.energy_cost,
      isCompleted: task.is_completed,
      isCustomEnergyCost: task.is_custom_energy_cost,
    });

    if (itemType === 'task') {
      totalActiveTimeMinutes += duration;
      if (task.is_critical && !task.is_completed) {
        criticalTasksRemaining++;
      }
    } else if (itemType === 'break') {
      totalBreakTimeMinutes += duration;
    }

    if (localEnd > sessionEnd) {
      sessionEnd = localEnd;
    }
  }

  const occupiedBlocks = scheduledItems.map(item => ({
    start: item.startTime,
    end: item.endTime,
    duration: item.duration,
  }));

  const freeTimeBlocks = getFreeTimeBlocks(occupiedBlocks, workdayStartTime, workdayEndTime);
  const totalFreeTimeMinutes = freeTimeBlocks.reduce((sum, block) => sum + block.duration, 0);

  const unscheduledCount = tasksForSelectedDay.filter(task => {
    if (!task.start_time || !task.end_time) return true; // Tasks without times are unscheduled
    const taskStart = parseISO(task.start_time);
    const taskEnd = parseISO(task.end_time);
    return isBefore(taskEnd, workdayStartTime) || isAfter(taskStart, workdayEndTime);
  }).length;

  const summary: ScheduleSummary = {
    totalTasks: scheduledItems.length,
    activeTime: {
      hours: Math.floor(totalActiveTimeMinutes / 60),
      minutes: totalActiveTimeMinutes % 60,
    },
    breakTime: totalBreakTimeMinutes,
    sessionEnd: sessionEnd,
    extendsPastMidnight: extendsPastMidnight,
    midnightRolloverMessage: midnightRolloverMessage,
    unscheduledCount: unscheduledCount,
    criticalTasksRemaining: criticalTasksRemaining,
  };

  return {
    items: scheduledItems,
    summary: summary,
    dbTasks: tasksForSelectedDay,
  };
};