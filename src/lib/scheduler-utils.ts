import { format, addMinutes, isPast, isToday, startOfDay, addHours, addDays, parse } from 'date-fns';
import { RawTaskInput, ScheduledItem, ScheduledItemType, FormattedSchedule, ScheduleSummary, DBScheduledTask, TimeMarker, DisplayItem } from '@/types/scheduler';

// --- Constants ---
const EMOJI_MAP: { [key: string]: string } = {
  'gym': '🏋️', 'workout': '🏋️', 'run': '🏋️', 'exercise': '🏋️',
  'email': '📧', 'messages': '📧', 'calls': '📧', 'communication': '📧',
  'meeting': '💼', 'work': '💼', 'report': '💼', 'professional': '💼', 'project': '💼',
  'design': '🎨', 'writing': '🎨', 'art': '🎨', 'creative': '🎨',
  'study': '📚', 'reading': '📚', 'course': '📚', 'learn': '📚',
  'clean': '🧹', 'laundry': '🧹', 'organize': '🧹', 'household': '🧹',
  'cook': '🍳', 'meal prep': '🍳', 'groceries': '🍳', 'food': '🍳',
  'brainstorm': '💡', 'strategy': '💡', '💡review': '💡', 'plan': '💡',
  'gaming': '🎮', 'tv': '🎮', 'hobbies': '🎮', 'leisure': '🎮',
  'meditation': '🧘', 'yoga': '🧘', 'self-care': '🧘', 'wellness': '🧘',
  'break': '☕️', // Special emoji for breaks
};

const BREAK_DESCRIPTIONS: { [key: number]: string } = {
  5: "Quick stretch",
  10: "Stand and hydrate",
  15: "Walk around, refresh",
  20: "Proper rest, step outside",
  30: "Meal break, recharge",
};

const DEFAULT_EMOJI = '📋'; // Default for generic/ambiguous tasks

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

/**
 * Generates fixed time markers for a full 24-hour template.
 */
export const generateFixedTimeMarkers = (T_current: Date): TimeMarker[] => {
  const markers: TimeMarker[] = [];
  const startOfToday = startOfDay(T_current); // 12:00 AM today

  // Add 12 AM marker
  markers.push({ id: 'marker-0', type: 'marker', time: startOfToday, label: formatTime(startOfToday) });

  // Add markers every 3 hours for a full 24-hour cycle
  for (let i = 3; i <= 24; i += 3) { // Changed loop to go up to 24 hours
    const markerTime = addHours(startOfToday, i);
    markers.push({ id: `marker-${i}`, type: 'marker', time: markerTime, label: formatTime(markerTime) });
  }
  
  return markers;
};


// --- Core Scheduling Logic ---

export const calculateSchedule = (
  dbTasks: DBScheduledTask[],
  T_Anchor: Date | null // T_Anchor can now be null
): FormattedSchedule => {
  const scheduledItems: ScheduledItem[] = [];
  let totalActiveTime = 0;
  let totalBreakTime = 0;

  const fixedAppointments: DBScheduledTask[] = [];
  const adHocTasks: DBScheduledTask[] = [];

  dbTasks.forEach(task => {
    if (task.start_time && task.end_time) {
      fixedAppointments.push(task);
    } else {
      adHocTasks.push(task);
    }
  });

  // 1. Add Fixed Appointments first, sorted by start time
  fixedAppointments.sort((a, b) => new Date(a.start_time!).getTime() - new Date(b.start_time!).getTime());
  fixedAppointments.forEach(task => {
    const startTime = new Date(task.start_time!);
    const endTime = new Date(task.end_time!);
    const duration = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
    scheduledItems.push({
      id: task.id, type: 'task', name: task.name, duration: duration,
      startTime: startTime, endTime: endTime, emoji: assignEmoji(task.name),
      isTimedEvent: true, color: 'bg-blue-500',
    });
    totalActiveTime += duration;
  });

  // 2. Schedule Ad-Hoc Tasks sequentially from T_Anchor, avoiding fixed appointments
  // adHocCursor only advances based on ad-hoc tasks and their breaks.
  // If T_Anchor is null (no ad-hoc tasks added yet), adHocCursor won't be used for placement.
  let adHocCursor = T_Anchor; 

  // Sort ad-hoc tasks by their creation time to maintain the order they were added
  adHocTasks.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  adHocTasks.forEach(task => {
    if (!adHocCursor) { // If T_Anchor is still null, this ad-hoc task shouldn't be placed yet by this logic.
      // This scenario should ideally be prevented by SchedulerPage's T_Anchor setting logic.
      // For robustness, we'll skip if T_Anchor isn't set, or use a fallback (e.g., current time)
      // but the prompt implies T_Anchor will be set by the time ad-hoc tasks are processed here.
      return; 
    }

    let proposedStartTime = adHocCursor;
    let proposedEndTime = addMinutes(proposedStartTime, task.duration!);

    // Check for overlaps with fixed appointments and shift if necessary
    let overlapFound = true;
    while (overlapFound) {
      overlapFound = false;
      for (const fixedAppt of fixedAppointments) {
        const fixedApptStart = new Date(fixedAppt.start_time!).getTime();
        const fixedApptEnd = new Date(fixedAppt.end_time!).getTime();

        // Check if proposed ad-hoc task overlaps with fixed appointment
        if (
          (proposedStartTime.getTime() < fixedApptEnd && proposedEndTime.getTime() > fixedApptStart)
        ) {
          // Overlap detected. Shift ad-hoc task to end immediately after the fixed appointment.
          proposedStartTime = new Date(fixedApptEnd);
          proposedEndTime = addMinutes(proposedStartTime, task.duration!);
          overlapFound = true; // Re-check for overlaps with other fixed appointments from this new position
          // console.log(`DEBUG: Ad-hoc task "${task.name}" shifted due to overlap with fixed appointment.`);
          break; // Break from inner loop to re-evaluate with new proposedStartTime
        }
      }
    }

    // Add the ad-hoc task
    scheduledItems.push({
      id: task.id, type: 'task', name: task.name, duration: task.duration!,
      startTime: proposedStartTime, endTime: proposedEndTime, emoji: assignEmoji(task.name),
      isTimedEvent: false,
    });
    totalActiveTime += task.duration!;

    // Update adHocCursor to the end of the *just-placed ad-hoc task*
    adHocCursor = proposedEndTime;

    // Add Break if specified (also advances adHocCursor)
    if (task.break_duration && task.break_duration > 0) {
      const breakStartTime = adHocCursor;
      const breakEndTime = addMinutes(breakStartTime, task.break_duration);
      scheduledItems.push({
        id: `${task.id}-break`, type: 'break', name: 'BREAK', duration: task.break_duration,
        startTime: breakStartTime, endTime: breakEndTime, emoji: EMOJI_MAP['break'],
        description: getBreakDescription(task.break_duration), isTimedEvent: false,
      });
      adHocCursor = breakEndTime;
      totalBreakTime += task.break_duration;
    }
  });

  // Final sort of all items (fixed and ad-hoc) for display
  scheduledItems.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  const sessionEnd = scheduledItems.length > 0 ? scheduledItems[scheduledItems.length - 1].endTime : (T_Anchor || new Date()); // Fallback for sessionEnd if no tasks
  const extendsPastMidnight = !isToday(sessionEnd) && scheduledItems.length > 0;
  const midnightRolloverMessage = extendsPastMidnight ? getMidnightRolloverMessage(sessionEnd, T_Anchor || new Date()) : null;

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
  };

  return {
    items: scheduledItems,
    summary: summary,
  };
};

// --- Smart Suggestions ---
export const getSmartSuggestions = (totalScheduledMinutes: number): string[] => {
  const suggestions: string[] = [];
  if (totalScheduledMinutes < 6 * 60) { // Less than 6 hours
    suggestions.push("💡 Light day! Consider adding buffer time for flexibility.");
  }
  if (totalScheduledMinutes > 12 * 60) { // More than 12 hours
    suggestions.push("⚠️ Intense schedule. Remember to include meals and rest.");
  }
  return suggestions;
};

// --- Input Parsing ---
// Updated to handle timed events like "mindfulness 11am - 12pm"
export const parseTaskInput = (input: string): RawTaskInput | { name: string, startTime: Date, endTime: Date } | null => {
  // Regex for "Task Name Duration" or "Task Name Duration Break"
  const durationRegex = /^(.*?)\s+(\d+)(?:\s+(\d+))?$/;
  const durationMatch = input.match(durationRegex);

  if (durationMatch) {
    const name = durationMatch[1].trim();
    const duration = parseInt(durationMatch[2], 10);
    const breakDuration = durationMatch[3] ? parseInt(durationMatch[3], 10) : undefined;

    if (name && duration > 0) {
      return { name, duration, breakDuration };
    }
  }

  // Regex for "Task Name HH:MM AM/PM - HH:MM AM/PM"
  const timedRegex = /^(.*?)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))$/i;
  const timedMatch = input.match(timedRegex);

  if (timedMatch) {
    const name = timedMatch[1].trim();
    const startTimeStr = timedMatch[2].trim();
    const endTimeStr = timedMatch[3].trim();

    console.log('DEBUG: Timed match found:', { name, startTimeStr, endTimeStr });
    try {
      // Added 'ha' and 'h:mma' for better parsing of "11am" and "11:00am"
      const formatStrings = ['h a', 'h:mm a', 'ha', 'h:mma']; 
      let parsedStartTime: Date | null = null;
      let parsedEndTime: Date | null = null;
      const now = new Date(); // Use a consistent reference date for parsing

      for (const fmt of formatStrings) {
        const tempStart = parse(startTimeStr, fmt, now);
        console.log(`DEBUG: Trying start: "${startTimeStr}" with format "${fmt}" -> ${tempStart} (isValid: ${!isNaN(tempStart.getTime())})`);
        if (!isNaN(tempStart.getTime())) {
          parsedStartTime = tempStart;
          break;
        }
      }
      for (const fmt of formatStrings) {
        const tempEnd = parse(endTimeStr, fmt, now);
        console.log(`DEBUG: Trying end: "${endTimeStr}" with format "${fmt}" -> ${tempEnd} (isValid: ${!isNaN(tempEnd.getTime())})`);
        if (!isNaN(tempEnd.getTime())) {
          parsedEndTime = tempEnd;
          break;
        }
      }

      console.log('DEBUG: Final parsed times:', { parsedStartTime, parsedEndTime });

      if (!parsedStartTime || !parsedEndTime || isNaN(parsedStartTime.getTime()) || isNaN(parsedEndTime.getTime())) {
        console.error('DEBUG: Failed to parse one or both times, throwing error.');
        throw new Error("Invalid time format");
      }
      
      // Ensure end time is after start time, potentially rolling over to next day if needed
      if (parsedEndTime.getTime() < parsedStartTime.getTime()) {
        parsedEndTime = addDays(parsedEndTime, 1);
      }

      return { name, startTime: parsedStartTime, endTime: parsedEndTime };
    } catch (e) {
      console.error("DEBUG: Error caught during timed event parsing:", e);
      return null;
    }
  }

  return null;
};

export const parseInjectionCommand = (input: string): { type: 'inject', taskName: string, duration?: number, breakDuration?: number, startTime?: string, endTime?: string } | null => {
  // Regex for duration-based injection: "inject Task Name duration X break Y"
  const injectDurationRegex = /^inject\s+(.*?)(?:\s+duration\s+(\d+))?(?:\s+break\s+(\d+))?$/i;
  const injectDurationMatch = input.match(injectDurationRegex);

  if (injectDurationMatch) {
    const taskName = injectDurationMatch[1].trim();
    const duration = injectDurationMatch[2] ? parseInt(injectDurationMatch[2], 10) : undefined;
    const breakDuration = injectDurationMatch[3] ? parseInt(injectDurationMatch[3], 10) : undefined;
    return { type: 'inject', taskName, duration, breakDuration };
  }

  // Regex for timed event injection: "inject Task Name from HH:MM AM/PM to HH:MM AM/PM"
  const injectTimedRegex = /^inject\s+(.*?)\s+from\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s+to\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm))$/i;
  const injectTimedMatch = input.match(injectTimedRegex);

  if (injectTimedMatch) {
    const taskName = injectTimedMatch[1].trim();
    const startTime = injectTimedMatch[2].trim();
    const endTime = injectTimedMatch[3].trim();
    return { type: 'inject', taskName, startTime, endTime };
  }

  return null;
};

export const parseCommand = (input: string): { type: 'clear' | 'remove' | 'show' | 'reorder', target?: string, index?: number } | null => {
  const lowerInput = input.toLowerCase();
  if (lowerInput === 'clear queue') {
    return { type: 'clear' };
  }
  // New: remove by index
  const removeIndexMatch = lowerInput.match(/^remove\s+index\s+(\d+)$/);
  if (removeIndexMatch) {
    return { type: 'remove', index: parseInt(removeIndexMatch[1], 10) - 1 }; // Convert to 0-based index
  }
  // Existing: remove by name (can be made more precise later if needed, for now keep includes)
  if (lowerInput.startsWith('remove ')) {
    const target = input.substring('remove '.length).trim();
    return { type: 'remove', target };
  }
  if (lowerInput === 'show queue') {
    return { type: 'show' };
  }
  if (lowerInput === 'reorder') {
    return { type: 'reorder' }; // Not implemented yet, but recognized
  }
  return null;
};