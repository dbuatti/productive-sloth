import { format, addMinutes, isPast, isToday, startOfDay, addHours, addDays, parse, parseISO, setHours, setMinutes, isSameDay, isBefore, isAfter, differenceInMinutes } from 'date-fns';
import { RawTaskInput, ScheduledItem, FormattedSchedule, ScheduleSummary, DBScheduledTask, TimeMarker, DisplayItem, TimeBlock, UnifiedTask, NewRetiredTask } from '@/types/scheduler';
import { LOW_ENERGY_THRESHOLD } from '@/lib/constants';

export const formatTime = (date: Date): string => {
  return format(date, 'h:mm a');
};

export const formatDateTime = (date: Date): string => {
  return format(date, 'MMM d, h:mm a');
};

export const formatDayMonth = (date: Date): string => {
  return format(date, 'MMM d');
};

export const setTimeOnDate = (date: Date, timeString: string): Date => {
  const [hours, minutes] = timeString.split(':').map(Number);
  const newDate = new Date(date);
  newDate.setHours(hours, minutes, 0, 0);
  return newDate;
};

export const parseFlexibleTime = (timeString: string, baseDate: Date): Date => {
  try {
    const parsed = parse(timeString, 'h:mm a', baseDate);
    return parsed;
  } catch {
    try {
      const parsed = parse(timeString, 'H:mm', baseDate);
      return parsed;
    } catch {
      try {
        const parsed = parse(timeString, 'h a', baseDate);
        return parsed;
      } catch {
        return new Date();
      }
    }
  }
};

export const parseTaskInput = (input: string, selectedDay: Date): RawTaskInput | null => {
  const trimmedInput = input.trim();
  
  // Handle sink command
  if (trimmedInput.toLowerCase().endsWith(' sink')) {
    const taskName = trimmedInput.slice(0, -5).trim();
    return {
      name: taskName,
      isCritical: false,
      isFlexible: true,
      energyCost: 0,
      shouldSink: true,
    };
  }
  
  // Handle duration-based tasks (e.g., "Gym 60")
  const durationMatch = trimmedInput.match(/^(.+?)\s+(\d+)$/);
  if (durationMatch) {
    const [, taskName, durationStr] = durationMatch;
    const duration = parseInt(durationStr, 10);
    const isCritical = taskName.toLowerCase().includes('critical');
    const energyCost = calculateEnergyCost(duration, isCritical);
    
    return {
      name: taskName.trim(),
      duration,
      isCritical,
      isFlexible: true,
      energyCost,
    };
  }
  
  // Handle time-based tasks (e.g., "Meeting 11am-12pm")
  const timeMatch = trimmedInput.match(/^(.+?)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))$/i);
  if (timeMatch) {
    const [, taskName, startTimeStr, endTimeStr] = timeMatch;
    const startTime = parseFlexibleTime(startTimeStr, selectedDay);
    const endTime = parseFlexibleTime(endTimeStr, selectedDay);
    const duration = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
    const isCritical = taskName.toLowerCase().includes('critical');
    const energyCost = calculateEnergyCost(duration, isCritical);
    
    return {
      name: taskName.trim(),
      startTime,
      endTime,
      isCritical,
      isFlexible: false,
      energyCost,
    };
  }
  
  return null;
};

export const parseInjectionCommand = (input: string) => {
  const trimmedInput = input.trim().toLowerCase();
  
  if (!trimmedInput.startsWith('inject ')) return null;
  
  const commandContent = input.trim().substring(7); // Remove "inject "
  
  // Handle quoted task name with duration (e.g., inject "Project X" 30)
  const quotedMatch = commandContent.match(/^"(.+?)"\s+(\d+)$/);
  if (quotedMatch) {
    const [, taskName, durationStr] = quotedMatch;
    const duration = parseInt(durationStr, 10);
    const isCritical = taskName.toLowerCase().includes('critical');
    const energyCost = calculateEnergyCost(duration, isCritical);
    
    return {
      taskName: taskName.trim(),
      duration,
      isCritical,
      isFlexible: true,
      energyCost,
    };
  }
  
  // Handle quoted task name with time range (e.g., inject "Meeting" 11am-12pm)
  const quotedTimeMatch = commandContent.match(/^"(.+?)"\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))$/i);
  if (quotedTimeMatch) {
    const [, taskName, startTime, endTime] = quotedTimeMatch;
    return {
      taskName: taskName.trim(),
      startTime,
      endTime,
      isCritical: taskName.toLowerCase().includes('critical'),
      isFlexible: false,
      energyCost: 0,
    };
  }
  
  // Handle unquoted task name with duration (e.g., inject Project 30)
  const unquotedMatch = commandContent.match(/^(.+?)\s+(\d+)$/);
  if (unquotedMatch) {
    const [, taskName, durationStr] = unquotedMatch;
    const duration = parseInt(durationStr, 10);
    const isCritical = taskName.toLowerCase().includes('critical');
    const energyCost = calculateEnergyCost(duration, isCritical);
    
    return {
      taskName: taskName.trim(),
      duration,
      isCritical,
      isFlexible: true,
      energyCost,
    };
  }
  
  return null;
};

export const parseCommand = (input: string) => {
  const trimmedInput = input.trim().toLowerCase();
  
  if (trimmedInput === 'clear') {
    return { type: 'clear' };
  }
  
  if (trimmedInput === 'show') {
    return { type: 'show' };
  }
  
  if (trimmedInput === 'reorder') {
    return { type: 'reorder' };
  }
  
  if (trimmedInput === 'compact') {
    return { type: 'compact' };
  }
  
  if (trimmedInput === 'timeoff' || trimmedInput === 'time off') {
    return { type: 'timeoff' };
  }
  
  if (trimmedInput === 'aether dump' || trimmedInput === 'reset schedule') {
    return { type: 'aether dump' };
  }
  
  if (trimmedInput === 'aether dump mega') {
    return { type: 'aether dump mega' };
  }
  
  if (trimmedInput.startsWith('remove ')) {
    const removeContent = input.trim().substring(7);
    
    if (removeContent.startsWith('index ')) {
      const indexStr = removeContent.substring(6);
      const index = parseInt(indexStr, 10);
      if (!isNaN(index)) {
        return { type: 'remove', index: index - 1 };
      }
    }
    
    return { type: 'remove', target: removeContent };
  }
  
  if (trimmedInput.startsWith('break')) {
    const durationMatch = trimmedInput.match(/^break\s+(\d+)$/);
    if (durationMatch) {
      const duration = parseInt(durationMatch[1], 10);
      return { type: 'break', duration };
    }
    return { type: 'break', duration: 15 };
  }
  
  return null;
};

export const calculateEnergyCost = (duration: number, isCritical: boolean): number => {
  const baseCost = Math.ceil(duration / 10);
  return isCritical ? baseCost * 2 : baseCost;
};

export const getEmojiHue = (text: string): number => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
};

export const getBreakDescription = (breakDuration: number): string => {
  if (breakDuration < 5) return 'micro-break';
  if (breakDuration < 15) return 'short break';
  if (breakDuration < 30) return 'break';
  return 'long break';
};

export const isMeal = (taskName: string): boolean => {
  const lowerName = taskName.toLowerCase();
  return lowerName.includes('lunch') || 
         lowerName.includes('breakfast') || 
         lowerName.includes('dinner') || 
         lowerName.includes('snack') || 
         lowerName.includes('meal');
};

export const mergeOverlappingTimeBlocks = (blocks: TimeBlock[]): TimeBlock[] => {
  if (blocks.length <= 1) return blocks;
  
  const sorted = [...blocks].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: TimeBlock[] = [sorted[0]];
  
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    
    if (current.start <= last.end) {
      last.end = new Date(Math.max(last.end.getTime(), current.end.getTime()));
      last.duration = Math.floor((last.end.getTime() - last.start.getTime()) / (1000 * 60));
    } else {
      merged.push(current);
    }
  }
  
  return merged;
};

export const isSlotFree = (startTime: Date, endTime: Date, occupiedBlocks: TimeBlock[]): boolean => {
  for (const block of occupiedBlocks) {
    if (
      (startTime >= block.start && startTime < block.end) ||
      (endTime > block.start && endTime <= block.end) ||
      (startTime <= block.start && endTime >= block.end)
    ) {
      return false;
    }
  }
  return true;
};

export const getFreeTimeBlocks = (occupiedBlocks: TimeBlock[], startTime: Date, endTime: Date): TimeBlock[] => {
  if (occupiedBlocks.length === 0) {
    return [{ start: startTime, end: endTime, duration: differenceInMinutes(endTime, startTime) }];
  }
  
  const sortedBlocks = [...occupiedBlocks].sort((a, b) => a.start.getTime() - b.start.getTime());
  const freeBlocks: TimeBlock[] = [];
  let currentStart = startTime;
  
  for (const block of sortedBlocks) {
    if (currentStart < block.start) {
      const duration = differenceInMinutes(block.start, currentStart);
      if (duration > 0) {
        freeBlocks.push({ start: currentStart, end: block.start, duration });
      }
    }
    if (block.end > currentStart) {
      currentStart = block.end;
    }
  }
  
  if (currentStart < endTime) {
    const duration = differenceInMinutes(endTime, currentStart);
    if (duration > 0) {
      freeBlocks.push({ start: currentStart, end: endTime, duration });
    }
  }
  
  return freeBlocks;
};

export const compactScheduleLogic = (
  tasks: DBScheduledTask[],
  selectedDay: Date,
  workdayStart: Date,
  workdayEnd: Date,
  T_current: Date
): DBScheduledTask[] => {
  const compactedTasks: DBScheduledTask[] = [];
  let currentTime = new Date(workdayStart);
  
  const flexibleTasks = tasks
    .filter(task => task.is_flexible && !task.is_locked && task.start_time && task.end_time)
    .sort((a, b) => {
      const aStart = parseISO(a.start_time!);
      const bStart = parseISO(b.start_time!);
      return aStart.getTime() - bStart.getTime();
    });
  
  for (const task of flexibleTasks) {
    if (!task.start_time || !task.end_time) continue;
    
    const duration = differenceInMinutes(parseISO(task.end_time), parseISO(task.start_time));
    
    // Skip tasks that are in the past
    if (isBefore(addMinutes(currentTime, duration), T_current)) {
      compactedTasks.push(task);
      continue;
    }
    
    // Place task at current time
    const newStart = new Date(currentTime);
    const newEnd = addMinutes(currentTime, duration);
    
    // Only update if the time has changed
    if (newStart.getTime() !== parseISO(task.start_time).getTime()) {
      compactedTasks.push({
        ...task,
        start_time: newStart.toISOString(),
        end_time: newEnd.toISOString(),
      });
    } else {
      compactedTasks.push(task);
    }
    
    currentTime = newEnd;
  }
  
  // Add non-flexible tasks unchanged
  const nonFlexibleTasks = tasks.filter(task => !task.is_flexible || task.is_locked);
  return [...compactedTasks, ...nonFlexibleTasks];
};

export const calculateSchedule = (
  dbTasks: DBScheduledTask[],
  selectedDay: string,
  workdayStart: Date,
  workdayEnd: Date,
  isRegenPodActive: boolean,
  regenPodStartTime: Date | null,
  regenPodDurationMinutes: number,
  T_current: Date
): FormattedSchedule => {
  const items: ScheduledItem[] = [];
  let totalDuration = 0;
  let completedCount = 0;
  let criticalCount = 0;
  let scheduledCount = 0;
  let unscheduledCount = 0;
  let energyCost = 0;
  let breakTime = 0;
  
  // Process tasks
  dbTasks.forEach(task => {
    if (task.start_time && task.end_time) {
      const startTime = parseISO(task.start_time);
      const endTime = parseISO(task.end_time);
      const duration = differenceInMinutes(endTime, startTime);
      
      items.push({
        id: task.id,
        name: task.name,
        startTime,
        endTime,
        duration,
        breakDuration: task.break_duration || 0,
        isCritical: task.is_critical,
        isLocked: task.is_locked,
        isFlexible: task.is_flexible,
        energyCost: task.energy_cost,
        taskEnvironment: task.task_environment,
      });
      
      totalDuration += duration;
      if (task.is_completed) completedCount++;
      if (task.is_critical) criticalCount++;
      scheduledCount++;
      energyCost += task.energy_cost;
      
      if (task.break_duration) {
        breakTime += task.break_duration;
      }
    } else {
      unscheduledCount++;
    }
  });
  
  // Sort items by start time
  items.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  
  // Calculate active time
  let activeTimeHours = 0;
  let activeTimeMinutes = 0;
  if (items.length > 0) {
    const firstTask = items[0];
    const lastTask = items[items.length - 1];
    const totalMinutes = differenceInMinutes(lastTask.endTime, firstTask.startTime);
    activeTimeHours = Math.floor(totalMinutes / 60);
    activeTimeMinutes = totalMinutes % 60;
  }
  
  const summary: ScheduleSummary = {
    totalTasks: items.length,
    completedCount,
    criticalCount,
    totalDuration,
    scheduledCount,
    unscheduledCount,
    energyCost,
    breakTime,
    startTime: items.length > 0 ? items[0].startTime.toISOString() : null,
    endTime: items.length > 0 ? items[items.length - 1].endTime.toISOString() : null,
    activeTime: {
      hours: activeTimeHours,
      minutes: activeTimeMinutes,
    },
    sessionEnd: items.length > 0 ? format(items[items.length - 1].endTime, 'h:mm a') : '',
    criticalTasksRemaining: criticalCount - completedCount,
  };
  
  return {
    items,
    summary,
    dbTasks,
  };
};