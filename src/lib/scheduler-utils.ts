import { format, addMinutes, isPast, isToday, startOfDay, addHours, addDays, parse, parseISO, setHours, setMinutes, isSameDay, isBefore, isAfter, differenceInMinutes, max, min } from 'date-fns';
import { RawTaskInput, ScheduledItem, ScheduledItemType, FormattedSchedule, ScheduleSummary, DBScheduledTask, TimeMarker, DisplayItem, FreeTimeItem, TimeBlock, UnifiedTask, NewRetiredTask, SortBy, TaskEnvironment } from '@/types/scheduler';
import { UserProfile } from '@/hooks/use-session';

// --- Constants ---
export const MEAL_KEYWORDS = ['cook', 'meal prep', 'groceries', 'food', '🍔', 'lunch', 'dinner', 'breakfast', 'snack', 'eat', 'coffee break', 'reflection'];

export const EMOJI_MAP: { [key: string]: string } = {
  'gym': '🏋️', 'workout': '🏋️', 'run': '🏃', 'exercise': '🏋️', 'fitness': '💪',
  'email': '📧', 'messages': '💬', 'calls': '📞', 'communication': '🗣️', 'admin': '⚙️', 'paperwork': '📄',
  'meeting': '💼', 'work': '💻', 'report': '📝', 'professional': '👔', 'project': '📊', 'coding': '💻', 'develop': '💻', 'code': '💻', 'bug': '🐛', 'fix': '🛠️',
  'design': '🎨', 'writing': '✍️', 'art': '🖼️', 'creative': '✨', 'draw': '✏️',
  'study': '🧠', 
  'reading': '📖', 'course': '🎓', 'learn': '🧠', 'class': '🏫', 'lecture': '🧑‍🏫',
  'clean': '🧹', 'laundry': '🧺', 'organize': '🗄️', 'household': '🏠', 'setup': '🛠️',
  'cook': '🍳', 'meal prep': '🍲', 'groceries': '180', 'food': '🍔', 'lunch': '🥗', 'dinner': '🍽️', 'breakfast': '🥞', 'snack': '🍎', 'eat': '🍎', 
  'brainstorm': '💡', 'strategy': '📈', 'review': '🔍', 'plan': '🗓️',
  'gaming': '🎮', 'hobbies': '🎲', 'leisure': '😌', 'movie': '🎬', 'relax': '🧘', 'chill': '🛋️',
  'meditation': '🧘', 'yoga': '🧘', 'self-care': '🛀', 'wellness': '🌸', 'mindfulness': '🧠', 'nap': '😴', 'rest': '🛌',
  'break': '☕️', 'coffee': '☕️', 'walk': '🚶', 'stretch': '🤸', 'coffee break': '☕️',
  'piano': '🎹', 'music': '🎶', 'practice': '🎼',
  'commute': '🚗', 'drive': '🚗', 'bus': '🚌', 'train': '🚆', 'travel': '✈️',
  'shop': '🛍️', 'bank': '🏦', 'post': '✉️', 'errands': '🏃‍♀️',
  'friends': '🧑‍🤝‍🧑', 'family': '👨‍👩‍👧‍👦', 'social': '🎉',
  'wake up': '⏰', 'coles': '🛒', 'woolworths': '🛒', 'lesson': '🧑‍🏫', 'call': '📞', 'phone': '📱', 'text': '💬',
  'contact': '🤝', 'student': '🧑‍🎓', 'rehearsal': '🎭', 'time off': '🌴', 'message': '💬', 'journal': '✍️', 'washing': '👕',
  'money': '💰', 'transactions': '💰', 'mop': '🪣', 'floor': '🪣', 'quote': '🧾', 'send quote': '🧾', 'generate quote': '🧾',
  'doctor': '🩺', 'medical': '🩺', 'channel': '🧘', 'anxious': '🧘', 'recycling': '♻️', 'bin': '♻️', 'milk': '🥛',
  'cartons': '🥛', 'sync': '🤝', 'strongup': '🤝', 'tutorial': '💡', 'tv': '📺', 'cobweb': '🕸️', 'cables': '🔌',
  'fold laundry': '🧺', 'load of laundry': '🧺', 'tidy': '🗄️', 'room': '🏠', 'book': '📅', 'waitress': '📅',
  'preparation': '📝', 'lego': '🧩', 'organise': '🗄️', 'shirts': '👕', 'gigs': '🎤', 'charge': '🔌', 'vacuum': '🔌',
  'put away': '📦', 'sheets': '📦', 'pants': '📦', 'medication': '💊', 'toothbrush': '🪥', 'return message': '💬',
  'voice deal': '🎤', 'find location': '🗺️', 'broom': '🧹', 'practise': '🎹', 'track': '🎼', 'catch up': '🤝',
  'trim': '💅', 'cuticle': '💅', 'payment': '💸', 'link': '🔗', 'send': '📧', 'voice notes': '🎙️', 'job notes': '📝',
  'process': '⚙️', 'usb': '🔌', 'cable': '🔌', 'coil': '🔌', 'write up': '✍️', 'notes': '📝', 'reflection': '🧠',
};

export const EMOJI_HUE_MAP: { [key: string]: number } = {
  'gym': 200, 'workout': 200, 'run': 210, 'exercise': 200, 'fitness': 200,
  'email': 240, 'messages': 245, 'calls': 250, 'communication': 240, 'admin': 270, 'paperwork': 230,
  'meeting': 280, 'work': 210, 'report': 230, 'professional': 280, 'project': 290, 'coding': 210, 'develop': 210, 'code': 210, 'bug': 90, 'fix': 40,
  'design': 320, 'writing': 320, 'art': 330, 'creative': 340, 'draw': 320,
  'study': 150, 'reading': 260, 'course': 260, 'learn': 270, 'class': 260, 'lecture': 260,
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
};

// --- Utility Functions ---

export const formatTime = (date: Date): string => format(date, 'h:mm a');
export const formatDayMonth = (date: Date): string => format(date, 'MMM d');
export const formatDateTime = (date: Date): string => format(date, 'MMM d, h:mm a');

export const formatDurationToHoursMinutes = (totalMinutes: number): string => {
  if (totalMinutes <= 0) return '0m';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  else if (hours > 0) return `${hours}h`;
  else return `${minutes}m`;
};

export const setTimeOnDate = (date: Date, timeString: string): Date => {
  const [hours, minutes] = timeString.split(':').map(Number);
  return setMinutes(setHours(date, hours), minutes);
};

export const assignEmoji = (taskName: string): string => {
  const lowerCaseTaskName = taskName.toLowerCase();
  for (const keyword in EMOJI_MAP) {
    if (lowerCaseTaskName.includes(keyword)) return EMOJI_MAP[keyword];
  }
  return '📋'; 
};

export const getEmojiHue = (taskName: string): number => {
  const lowerCaseTaskName = taskName.toLowerCase();
  for (const keyword in EMOJI_HUE_MAP) {
    if (lowerCaseTaskName.includes(keyword)) return EMOJI_HUE_MAP[keyword];
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
  if (isBreak) return -10;
  let baseCost = Math.ceil(duration / 15) * 5; 
  if (isCritical) baseCost = Math.ceil(baseCost * 1.5); 
  else if (isBackburner) baseCost = Math.ceil(baseCost * 0.75);
  return Math.max(5, baseCost); 
};

export const parseFlexibleTime = (timeString: string, baseDate: Date): Date => {
  const lowerCaseTime = timeString.toLowerCase();
  let parsedDate: Date;
  parsedDate = parse(lowerCaseTime, 'h:mma', baseDate);
  if (!isNaN(parsedDate.getTime())) return parsedDate;
  parsedDate = parse(lowerCaseTime, 'h:mm a', baseDate);
  if (!isNaN(parsedDate.getTime())) return parsedDate;
  parsedDate = parse(lowerCaseTime, 'ha', baseDate);
  if (!isNaN(parsedDate.getTime())) return parsedDate;
  parsedDate = parse(lowerCaseTime, 'HH:mm', baseDate);
  if (!isNaN(parsedDate.getTime())) return parsedDate;
  const hourMatch = lowerCaseTime.match(/^(\d{1,2})$/);
  if (hourMatch) {
    const hour = parseInt(hourMatch[1], 10);
    if (hour >= 0 && hour <= 23) return setHours(setMinutes(baseDate, 0), hour);
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
  isWork: boolean; 
  isBreak: boolean; 
} | null => {
  let rawInput = input.trim();
  let isCritical = false;
  let isBackburner = false; 
  let shouldSink = false;
  let isFlexible = true; 
  let isWork = false;
  let isBreak = false;

  if (rawInput.startsWith('!')) {
    isCritical = true;
    rawInput = rawInput.substring(1).trim();
  }
  if (rawInput.startsWith('-')) {
    isBackburner = true;
    rawInput = rawInput.substring(1).trim();
  }

  let lowerRawInput = rawInput.toLowerCase();
  if (lowerRawInput.endsWith(' sink')) {
    shouldSink = true;
    rawInput = rawInput.substring(0, rawInput.length - 5).trim();
    lowerRawInput = rawInput.toLowerCase();
  }
  if (lowerRawInput.endsWith(' fixed')) {
    isFlexible = false;
    rawInput = rawInput.substring(0, rawInput.length - 6).trim();
    lowerRawInput = rawInput.toLowerCase();
  }
  if (lowerRawInput.endsWith(' w')) {
    isWork = true;
    rawInput = rawInput.substring(0, rawInput.length - 2).trim();
    lowerRawInput = rawInput.toLowerCase();
  }
  if (lowerRawInput.endsWith(' b')) {
    isBreak = true;
    rawInput = rawInput.substring(0, rawInput.length - 2).trim();
    lowerRawInput = rawInput.toLowerCase();
  }
  
  const timeOffMatch = rawInput.match(/^(time off)\s+(\d{1,2}(:\d{2})?\s*(am|pm)?)\s*-\s*(\d{1,2}(:\d{2})?\s*(am|pm)?)$/i);
  if (timeOffMatch) {
    const startTime = parseFlexibleTime(timeOffMatch[2], selectedDayAsDate);
    const endTime = parseFlexibleTime(timeOffMatch[5], selectedDayAsDate);
    if (!isNaN(startTime.getTime()) && !isNaN(endTime.getTime())) {
      return { name: timeOffMatch[1], startTime, endTime, isCritical: false, isBackburner: false, isFlexible: false, shouldSink: false, energyCost: 0, isWork: false, isBreak: false };
    }
  }

  const timeRangeMatch = rawInput.match(/^(.*?)\s+(\d{1,2}(:\d{2})?\s*(am|pm)?)\s*-\s*(\d{1,2}(:\d{2})?\s*(am|pm)?)$/i);
  if (timeRangeMatch) {
    const name = timeRangeMatch[1].trim();
    const startTime = parseFlexibleTime(timeRangeMatch[2], selectedDayAsDate);
    const endTime = parseFlexibleTime(timeRangeMatch[5], selectedDayAsDate);
    if (name && !isNaN(startTime.getTime()) && !isNaN(endTime.getTime())) {
      const duration = differenceInMinutes(endTime, startTime);
      return { name, startTime, endTime, isCritical, isBackburner, isFlexible: false, shouldSink, energyCost: isMeal(name) ? -10 : calculateEnergyCost(duration, isCritical, isBackburner, isBreak), isWork, isBreak }; 
    }
  }

  const durationMatch = rawInput.match(/^(.*?)\s+(\d+)(?:\s+(\d+))?$/);
  if (durationMatch) {
    const name = durationMatch[1].trim();
    const duration = parseInt(durationMatch[2], 10);
    const breakDuration = durationMatch[3] ? parseInt(durationMatch[3], 10) : undefined;
    if (name && duration > 0) {
      return { name, duration, breakDuration, isCritical, isBackburner, isFlexible, shouldSink, energyCost: isMeal(name) ? -10 : calculateEnergyCost(duration, isCritical, isBackburner, isBreak), isWork, isBreak };
    }
  }
  return null;
};

export const parseCommand = (input: string): { type: string; target?: string; index?: number; duration?: number } | null => {
  const lowerInput = input.toLowerCase().trim();
  if (lowerInput === 'clear') return { type: 'clear' };
  if (lowerInput.startsWith('remove')) {
    const parts = lowerInput.split(' ');
    if (parts.length > 1) {
      if (parts[1] === 'index' && parts.length > 2) {
        const index = parseInt(parts[2], 10);
        if (!isNaN(index)) return { type: 'remove', index: index - 1 }; 
      } else return { type: 'remove', target: parts.slice(1).join(' ') };
    }
  }
  if (lowerInput === 'compact') return { type: 'compact' };
  if (lowerInput === 'aether dump') return { type: 'aether dump' };
  if (lowerInput === 'aether dump mega') return { type: 'aether dump mega' };
  if (lowerInput.startsWith('break')) {
    const parts = lowerInput.split(' ');
    const duration = parts.length > 1 ? parseInt(parts[1], 10) : 15;
    if (!isNaN(duration) && duration > 0) return { type: 'break', duration };
  }
  return null;
};

export const parseSinkTaskInput = (input: string, userId: string): NewRetiredTask | null => {
  let name = input.trim();
  let duration: number | null = null;
  let isCritical = false;
  let isBackburner = false; 
  let isWork = false; 
  let isBreak = false; 

  if (name.endsWith(' !')) { isCritical = true; name = name.slice(0, -2).trim(); }
  if (name.startsWith('-')) { isBackburner = true; name = name.slice(1).trim(); }
  if (name.toLowerCase().endsWith(' w')) { isWork = true; name = name.slice(0, -2).trim(); }
  if (name.toLowerCase().endsWith(' b')) { isBreak = true; name = name.slice(0, -2).trim(); }

  const durationMatch = name.match(/^(.*?)\s+(\d+)$/);
  if (durationMatch) { name = durationMatch[1].trim(); duration = parseInt(durationMatch[2], 10); }

  if (!name) return null;
  return {
    user_id: userId, name: name, duration: duration, break_duration: null, original_scheduled_date: format(new Date(), 'yyyy-MM-dd'), is_critical: isCritical,
    is_locked: false, energy_cost: isMeal(name) ? -10 : calculateEnergyCost(duration || 30, isCritical, isBackburner, isBreak), is_completed: false, is_custom_energy_cost: false,
    task_environment: 'laptop', is_backburner: isBackburner, is_work: isWork, is_break: isBreak,
  };
};

export const mergeOverlappingTimeBlocks = (blocks: TimeBlock[]): TimeBlock[] => {
  if (blocks.length === 0) return [];
  const sorted = [...blocks].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: TimeBlock[] = [];
  let current = { ...sorted[0] };
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    if (current.end >= next.start) {
      current.end = max([current.end, next.end]);
      current.duration = differenceInMinutes(current.end, current.start);
    } else {
      merged.push(current);
      current = { ...next };
    }
  }
  merged.push(current);
  return merged;
};

export const getFreeTimeBlocks = (occupiedBlocks: TimeBlock[], workdayStart: Date, workdayEnd: Date): TimeBlock[] => {
  const freeBlocks: TimeBlock[] = [];
  let cursor = workdayStart;
  const sortedOccupied = mergeOverlappingTimeBlocks(occupiedBlocks);
  for (const block of sortedOccupied) {
    if (cursor < block.start) {
      const duration = differenceInMinutes(block.start, cursor);
      if (duration > 0) freeBlocks.push({ start: cursor, end: block.start, duration });
    }
    cursor = max([cursor, block.end]);
  }
  if (cursor < workdayEnd) {
    const duration = differenceInMinutes(workdayEnd, cursor);
    if (duration > 0) freeBlocks.push({ start: cursor, end: workdayEnd, duration });
  }
  return freeBlocks;
};

export const findFirstAvailableSlot = (durationMinutes: number, occupiedBlocks: TimeBlock[], searchStart: Date, workdayEnd: Date): { start: Date; end: Date } | null => {
  const freeBlocks = getFreeTimeBlocks(occupiedBlocks, searchStart, workdayEnd);
  for (const slot of freeBlocks) {
    const effectiveStart = max([slot.start, searchStart]);
    const proposedEnd = addMinutes(effectiveStart, durationMinutes);
    if (proposedEnd <= slot.end && proposedEnd <= workdayEnd) return { start: effectiveStart, end: proposedEnd };
  }
  return null;
};

export const getStaticConstraints = (profile: UserProfile, selectedDayDate: Date, workdayStart: Date, workdayEnd: Date): TimeBlock[] => {
  const constraints: TimeBlock[] = [];
  const addConstraint = (name: string, timeStr: string | null, duration: number | null) => {
    const effectiveDuration = duration ?? 15;
    if (timeStr && effectiveDuration > 0) {
      const anchorStart = setTimeOnDate(selectedDayDate, timeStr);
      let anchorEnd = addMinutes(anchorStart, effectiveDuration);
      if (isBefore(anchorEnd, anchorStart)) anchorEnd = addDays(anchorEnd, 1);
      if (isBefore(anchorStart, workdayEnd) && isAfter(anchorEnd, workdayStart)) {
        const intersectionStart = max([anchorStart, workdayStart]);
        const intersectionEnd = min([anchorEnd, workdayEnd]);
        if (differenceInMinutes(intersectionEnd, intersectionStart) > 0) {
          constraints.push({ start: intersectionStart, end: intersectionEnd, duration: differenceInMinutes(intersectionEnd, intersectionStart) });
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

// --- SPATIAL CORE REFACTOR: LIQUID BUDGETING ---

export interface ZoneWeight {
  value: string;
  target_weight: number;
}

/**
 * LIQUID FLOW SEQUENCER:
 * Now respects quotas by limiting tasks *before* sorting them into the placement sequence.
 * SYNC FIX: Uses referenceDuration (full workday) for quota calculation to match UI.
 * TASK-AWARE FIX: Ensures every zone gets at least enough room for its smallest task.
 */
export const sortAndChunkTasks = (
  tasks: UnifiedTask[],
  profile: UserProfile,
  sortPreference: SortBy,
  referenceDuration: number, // Use total workday duration to sync with UI
  zoneWeights: ZoneWeight[]
): UnifiedTask[] => {
  const { enable_environment_chunking, enable_macro_spread, custom_environment_order } = profile;

  const internalSort = (a: UnifiedTask, b: UnifiedTask) => {
    if (a.is_critical !== b.is_critical) return a.is_critical ? -1 : 1;
    if (a.is_break !== b.is_break) return a.is_break ? -1 : 1;
    if (a.is_backburner !== b.is_backburner) return a.is_backburner ? 1 : -1;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  };

  const groups = new Map<TaskEnvironment, UnifiedTask[]>();
  tasks.forEach(task => {
    const env = task.task_environment || 'laptop';
    if (!groups.has(env)) groups.set(env, []);
    groups.get(env)!.push(task);
  });

  // Apply Quotas and Task-Aware Sizing
  const weightMap = new Map(zoneWeights.map(zw => [zw.value, zw.target_weight]));
  for (const [env, groupTasks] of groups.entries()) {
      const weight = weightMap.get(env) || 0;
      
      // 1. Calculate the 'UI-Synchronized' quota based on full workday
      let quotaMinutes = Math.floor(referenceDuration * (weight / 100));
      
      groupTasks.sort(internalSort);
      
      // 2. TASK-AWARE SIZING: If we have tasks but quota is too small for even one, 
      // expand the floor to the smallest task duration (or first task in priority).
      if (groupTasks.length > 0 && weight > 0) {
          const firstTaskTotal = (groupTasks[0].duration || 30) + (groupTasks[0].break_duration || 0);
          quotaMinutes = Math.max(quotaMinutes, firstTaskTotal);
      }

      let cumulative = 0;
      const limitedGroup: UnifiedTask[] = [];
      for (const t of groupTasks) {
          const dur = (t.duration || 30) + (t.break_duration || 0);
          // If adding this task exceeds the quota, but we haven't added anything yet, 
          // we force at least one task (Task-Aware Sizing floor).
          if (cumulative + dur > quotaMinutes && limitedGroup.length > 0) break;
          limitedGroup.push(t);
          cumulative += dur;
      }
      groups.set(env, limitedGroup);
  }

  const order = custom_environment_order?.length ? custom_environment_order : ['home', 'laptop', 'away', 'piano', 'laptop_piano'];
  const activeEnvs = Array.from(groups.keys());
  const finalOrder = order.filter(e => activeEnvs.includes(e)).concat(activeEnvs.filter(e => !order.includes(e)));

  if (enable_macro_spread) {
    const amBatch: UnifiedTask[] = [];
    const pmBatch: UnifiedTask[] = [];

    finalOrder.forEach(env => {
      const groupTasks = groups.get(env) || [];
      if (groupTasks.length > 1) {
        const half = Math.ceil(groupTasks.length / 2);
        amBatch.push(...groupTasks.slice(0, half));
        pmBatch.push(...groupTasks.slice(half));
      } else if (groupTasks.length === 1) amBatch.push(...groupTasks);
    });
    return [...amBatch, ...pmBatch];
  } 
  
  if (enable_environment_chunking || sortPreference === 'ENVIRONMENT_RATIO') {
    return finalOrder.map(env => (groups.get(env) || []).sort(internalSort)).flat();
  }

  return [...tasks].sort(internalSort);
};

export const compactScheduleLogic = (
  currentDbTasks: DBScheduledTask[], 
  selectedDayDate: Date, 
  workdayStartTime: Date, 
  workdayEndTime: Date, 
  T_current: Date, 
  profile: UserProfile | null,
  sortPreference: SortBy = 'ENVIRONMENT_RATIO'
): DBScheduledTask[] => {
  if (!profile) return currentDbTasks;

  const fixed = currentDbTasks.filter(t => t.is_locked || !t.is_flexible || t.is_completed);
  const flexible = currentDbTasks.filter(t => t.is_flexible && !t.is_locked && !t.is_completed);

  const unified: UnifiedTask[] = flexible.map(t => ({
    id: t.id, name: t.name, duration: t.start_time && t.end_time ? differenceInMinutes(parseISO(t.end_time), parseISO(t.start_time)) : 30,
    break_duration: t.break_duration, is_critical: t.is_critical, is_flexible: t.is_flexible, is_backburner: t.is_backburner,
    energy_cost: t.energy_cost, source: 'scheduled', originalId: t.id, is_custom_energy_cost: t.is_custom_energy_cost,
    created_at: t.created_at, task_environment: t.task_environment, is_work: t.is_work || false, is_break: t.is_break || false,
  }));

  // For compaction, we don't strictly enforce spatial quotas against the workday, 
  // but we still want the chunking behavior.
  const workdayTotal = differenceInMinutes(workdayEndTime, workdayStartTime);
  const sorted = sortAndChunkTasks(unified, profile, sortPreference, workdayTotal, []);
  
  const staticConstraints = getStaticConstraints(profile, selectedDayDate, workdayStartTime, workdayEndTime);
  const fixedBlocks = mergeOverlappingTimeBlocks([...fixed.filter(t => t.start_time && t.end_time).map(t => ({ start: parseISO(t.start_time!), end: parseISO(t.end_time!), duration: differenceInMinutes(parseISO(t.end_time!), parseISO(t.start_time!)) })), ...staticConstraints]);

  const isSelectedToday = isSameDay(selectedDayDate, new Date());
  let insertionCursor = isSelectedToday ? max([workdayStartTime, T_current]) : workdayStartTime;
  const results: DBScheduledTask[] = [...fixed];

  for (const task of sorted) {
    const total = task.duration + (task.break_duration || 0);
    const slot = findFirstAvailableSlot(total, fixedBlocks, insertionCursor, workdayEndTime);
    if (slot) {
      const original = currentDbTasks.find(t => t.id === task.id);
      if (original) {
        results.push({ ...original, start_time: slot.start.toISOString(), end_time: slot.end.toISOString() });
        insertionCursor = slot.end;
        fixedBlocks.push({ start: slot.start, end: slot.end, duration: total });
        mergeOverlappingTimeBlocks(fixedBlocks);
      }
    }
  }
  return results;
};

export const calculateSchedule = (dbTasks: DBScheduledTask[], selectedDay: string, workdayStart: Date, workdayEnd: Date, isRegenPodActive: boolean, regenPodStartTime: Date | null, regenPodDurationMinutes: number, T_current: Date, breakfastTimeStr: string | null, lunchTimeStr: string | null, dinnerTimeStr: string | null, breakfastDuration: number | null, lunchDuration: number | null, dinnerDuration: number | null, reflectionCount: number = 0, reflectionTimes: string[] = [], reflectionDurations: number[] = [], mealAssignments: any[] = [], isDayBlocked: boolean = false): FormattedSchedule => {
  if (isDayBlocked) return { items: [], summary: { totalTasks: 0, activeTime: { hours: 0, minutes: 0 }, breakTime: 0, sessionEnd: workdayStart, extendsPastMidnight: false, midnightRolloverMessage: null, unscheduledCount: 0, criticalTasksRemaining: 0, isBlocked: true }, dbTasks: [] };
  
  const selectedDayDate = parseISO(selectedDay);
  const rawItems: ScheduledItem[] = [];
  
  dbTasks.forEach(t => {
    if (!t.start_time || !t.end_time) return;
    const start = parseISO(t.start_time);
    let end = parseISO(t.end_time);
    if (isBefore(end, start)) end = addDays(end, 1);
    rawItems.push({ id: t.id, type: t.is_break ? 'break' : 'task', name: t.name, duration: differenceInMinutes(end, start), startTime: start, endTime: end, emoji: assignEmoji(t.name), isTimedEvent: true, isCritical: t.is_critical, isFlexible: t.is_flexible, isLocked: t.is_locked, energyCost: t.energy_cost, isCompleted: t.is_completed, isCustomEnergyCost: t.is_custom_energy_cost, taskEnvironment: t.task_environment, sourceCalendarId: t.source_calendar_id, isBackburner: t.is_backburner, isWork: t.is_work || false, isBreak: t.is_break || false });
  });

  const addStatic = (name: string, timeStr: string | null, emoji: string, dur: number | null, type: ScheduledItemType = 'meal') => {
    const effectiveDur = dur ?? 15;
    if (timeStr && effectiveDur > 0) {
      const start = setTimeOnDate(selectedDayDate, timeStr);
      let end = addMinutes(start, effectiveDur);
      if (isBefore(end, start)) end = addDays(end, 1);
      const iStart = max([start, workdayStart]);
      const iEnd = min([end, workdayEnd]);
      if (differenceInMinutes(iEnd, iStart) > 0) {
        const assignment = mealAssignments.find((a: any) => a.assigned_date === selectedDay && a.meal_type === name.toLowerCase());
        rawItems.push({ id: `${type}-${name.toLowerCase()}-${format(iStart, 'HHmm')}`, type, name: assignment?.meal_idea?.name ? `${name}: ${assignment.meal_idea.name}` : name, duration: differenceInMinutes(iEnd, iStart), startTime: iStart, endTime: iEnd, emoji, isTimedEvent: true, energyCost: type === 'meal' ? -10 : 0, isCompleted: false, isCustomEnergyCost: false, taskEnvironment: 'home', sourceCalendarId: null, isBackburner: false, isWork: false, isBreak: true });
      }
    }
  };

  addStatic('Breakfast', breakfastTimeStr, '🥞', breakfastDuration);
  addStatic('Lunch', lunchTimeStr, '🥗', lunchDuration);
  addStatic('Dinner', dinnerTimeStr, '🍽️', dinnerDuration);
  for (let i = 0; i < reflectionCount; i++) {
    if (reflectionTimes[i]) addStatic(`Reflection Point ${i + 1}`, reflectionTimes[i], '✨', reflectionDurations[i], 'break');
  }

  const items = [...rawItems].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  let totalWork = 0, totalBreak = 0, critRemaining = 0, sessionEnd = workdayStart;
  items.forEach(i => {
    if (i.type === 'task' || i.type === 'calendar-event') totalWork += i.duration;
    else totalBreak += i.duration;
    if (i.isCritical && !i.isCompleted) critRemaining++;
    sessionEnd = max([sessionEnd, i.endTime]);
  });

  return { items, dbTasks, summary: { totalTasks: items.length, activeTime: { hours: Math.floor(totalWork / 60), minutes: totalWork % 60 }, breakTime: totalBreak, sessionEnd, extendsPastMidnight: isAfter(sessionEnd, addDays(startOfDay(selectedDayDate), 1)), midnightRolloverMessage: null, unscheduledCount: dbTasks.filter(t => !t.start_time).length, criticalTasksRemaining: critRemaining, isBlocked: isDayBlocked } };
};