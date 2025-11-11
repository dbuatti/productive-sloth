import { format, addMinutes, isPast, isToday, startOfDay, addHours, addDays, parse, parseISO, setHours, setMinutes, isSameDay, isBefore, isAfter } from 'date-fns';
import { RawTaskInput, ScheduledItem, ScheduledItemType, FormattedSchedule, ScheduleSummary, DBScheduledTask, TimeMarker, DisplayItem, TimeBlock } from '@/types/scheduler';

// --- Constants ---
const EMOJI_MAP: { [key: string]: string } = {
  'gym': '🏋️', 'workout': '🏋️', 'run': '🏃', 'exercise': '🏋️', 'fitness': '💪',
  'email': '📧', 'messages': '💬', 'calls': '📞', 'communication': '🗣️', 'admin': '⚙️', 'paperwork': '📄',
  'meeting': '💼', 'work': '💻', 'report': '📝', 'professional': '👔', 'project': '📊', 'coding': '💻', 'develop': '💻', 'code': '💻', 'bug': '🐛', 'fix': '🛠️', 'sync': '🤝', 'standup': '🤝',
  'design': '🎨', 'writing': '✍️', 'art': '🖼️', 'creative': '✨', 'draw': '✏️',
  'study': '📚', 'reading': '📖', 'course': '🎓', 'learn': '🧠', 'class': '🏫', 'lecture': '🧑‍🏫', 'tutorial': '💡',
  'clean': '🧹', 'laundry': '🧺', 'organize': '🗄️', 'household': '🏠', 'setup': '🛠️', 'room': '🛋️',
  'cook': '🍳', 'meal prep': '🍲', 'groceries': '🛒', 'food': '🍔', 'lunch': '🥗', 'dinner': '🍽️', 'breakfast': '🥞', 'snack': '🍎',
  'brainstorm': '💡', 'strategy': '📈', 'review': '🔍', 'plan': '🗓️',
  'gaming': '🎮', 'tv': '📺', 'hobbies': '🎲', 'leisure': '😌', 'movie': '🎬', 'relax': '🧘', 'chill': '🛋️',
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
};

const EMOJI_HUE_MAP: { [key: string]: number } = {
  'gym': 200, 'workout': 200, 'run': 210, 'exercise': 200, 'fitness': 200,
  'email': 240, 'messages': 245, 'calls': 250, 'communication': 240, 'admin': 270, 'paperwork': 230,
  'meeting': 280, 'work': 210, 'report': 230, 'professional': 280, 'project': 290, 'coding': 210, 'develop': 210, 'code': 210, 'bug': 90, 'fix': 40, 'sync': 290, 'standup': 290,
  'design': 320, 'writing': 320, 'art': 330, 'creative': 340, 'draw': 320,
  'study': 260, 'reading': 260, 'course': 260, 'learn': 270, 'class': 260, 'lecture': 260, 'tutorial': 60,
  'clean': 120, 'laundry': 130, 'organize': 140, 'household': 120, 'setup': 40, 'room': 150,
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

export const generateFixedTimeMarkers = (T_current: Date): TimeMarker => {
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

interface ParsedTaskInput {
  name: string;
  duration?: number;
  breakDuration?: number;
  startTime?: Date;
  endTime?: Date;
  isCritical: boolean;
  shouldSink?: boolean;
  isFlexible: boolean;
}

export const parseTaskInput = (input: string, selectedDayAsDate: Date): ParsedTaskInput | null => {
  let isCritical = false;
  let shouldSink = false;
  let isFlexible = true; // Default to flexible

  // Order of parsing flags matters: sink, then critical, then fixed
  if (input.endsWith(' sink')) {
    shouldSink = true;
    input = input.slice(0, -5).trim();
  }

  if (input.endsWith(' !')) {
    isCritical = true;
    input = input.slice(0, -2).trim();
  }

  if (input.endsWith(' fixed')) {
    isFlexible = false;
    input = input.slice(0, -6).trim();
  }

  // Enforce 'Time Off' as fixed, regardless of 'fixed' keyword presence
  if (input.toLowerCase().startsWith('time off')) {
    isFlexible = false;
  }

  const timeRangePattern = /(\d{1,2}(:\d{2})?\s*(?:AM|PM|am|pm))\s*-\s*(\d{1,2}(:\d{2})?\s*(?:AM|PM|am|pm))/i;
  const timeRangeMatch = input.match(timeRangePattern);

  if (timeRangeMatch) {
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
        return { name: cleanedTaskName, startTime, endTime, isCritical, shouldSink, isFlexible };
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
      return { name, duration, breakDuration, isCritical, shouldSink, isFlexible };
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
}

export const parseInjectionCommand = (input: string): ParsedInjectionCommand | null => {
  let isCritical = false;
  let isFlexible = true; // Default to flexible

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
      }
      // Re-apply 'Time Off' fixed enforcement for injection
      if (taskName.toLowerCase() === 'time off') {
        isFlexible = false;
      }
      return { taskName, duration, breakDuration, startTime, endTime, isCritical, isFlexible };
    }
  }
  return null;
};

interface ParsedCommand {
  type: 'clear' | 'remove' | 'show' | 'reorder' | 'compact' | 'timeoff';
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
  preSortedFlexibleTasks?: DBScheduledTask[]
): DBScheduledTask[] => {
  const finalSchedule: DBScheduledTask[] = [];

  const fixedTasks = allCurrentTasks.filter(task => !task.is_flexible);
  const flexibleTasksToPlace = preSortedFlexibleTasks || allCurrentTasks.filter(task => task.is_flexible);

  fixedTasks.sort((a, b) => parseISO(a.start_time!).getTime() - parseISO(b.start_time!).getTime());

  finalSchedule.push(...fixedTasks);

  let occupiedBlocks = mergeOverlappingTimeBlocks(fixedTasks.map(task => ({
    start: parseISO(task.start_time!),
    end: parseISO(task.end_time!),
    duration: Math.floor((parseISO(task.end_time!).getTime() - parseISO(task.start_time!).getTime()) / (1000 * 60))
  })));


  let currentPlacementTime = isSameDay(selectedDate, T_current) && isAfter(T_current, workdayStartTime)
    ? T_current
    : workdayStartTime;


  if (isAfter(currentPlacementTime, workdayEndTime)) {
    return fixedTasks;
  }

  for (const flexibleTask of flexibleTasksToPlace) {
    const taskDuration = Math.floor((parseISO(flexibleTask.end_time!).getTime() - parseISO(flexibleTask.start_time!).getTime()) / (1000 * 60));
    const taskBreakDuration = flexibleTask.break_duration || 0;
    const totalTaskDuration = taskDuration + taskBreakDuration;

    let currentSearchTime = currentPlacementTime;
    let placed = false;

    while (isBefore(currentSearchTime, workdayEndTime)) {
      let potentialEndTime = addMinutes(currentSearchTime, totalTaskDuration);

      if (isAfter(potentialEndTime, workdayEndTime)) {
        break;
      }

      const isFree = isSlotFree(currentSearchTime, potentialEndTime, occupiedBlocks);

      if (isFree) {
        finalSchedule.push({
          ...flexibleTask,
          start_time: currentSearchTime.toISOString(),
          end_time: potentialEndTime.toISOString(),
        });
        occupiedBlocks.push({
          start: currentSearchTime,
          end: potentialEndTime,
          duration: totalTaskDuration
        });
        occupiedBlocks = mergeOverlappingTimeBlocks(occupiedBlocks);
        currentPlacementTime = potentialEndTime;
        placed = true;
        break;
      } else {
        let nextAvailableTime = currentSearchTime;
        for (const block of occupiedBlocks) {
          if (isBefore(currentSearchTime, block.end) && isAfter(potentialEndTime, block.start)) {
            if (isAfter(block.end, nextAvailableTime)) {
              nextAvailableTime = block.end;
            }
          }
        }
        currentSearchTime = nextAvailableTime;
      }
    }
    if (!placed) {
      console.warn(`compactScheduleLogic: Flexible task "${flexibleTask.name}" could not be placed within the workday.`);
    }
  }

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