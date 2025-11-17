"use client";

import { format, parseISO, isBefore, addDays, startOfDay, addHours, setHours, setMinutes } from 'date-fns';

export const formatTime = (date: Date): string => {
  return format(date, 'h:mm a');
};

export const formatDayMonth = (date: Date): string => {
  return format(date, 'MMM d');
};

export const getEmojiHue = (taskName: string): number => {
  const keyword = Object.keys(EMOJI_MAP).find(keyword => 
    taskName.toLowerCase().includes(keyword.toLowerCase())
  );
  return keyword ? EMOJI_HUE_MAP[keyword] : 210;
};

export const assignEmoji = (taskName: string): string => {
  const keyword = Object.keys(EMOJI_MAP).find(keyword => 
    taskName.toLowerCase().includes(keyword.toLowerCase())
  );
  return keyword ? EMOJI_MAP[keyword] : '📋';
};

export const calculateEnergyCost = (durationMinutes: number, isCritical: boolean): number => {
  const baseCost = Math.floor(durationMinutes / 3);
  const criticalMultiplier = isCritical ? 1.5 : 1;
  return Math.floor(baseCost * criticalMultiplier);
};

export const setTimeOnDate = (date: Date, timeString: string): Date => {
  const [hours, minutes] = timeString.split(':').map(Number);
  return setMinutes(setHours(date, hours), minutes);
};

export const calculateSchedule = (dbTasks: any[], dateString: string, workdayStart: Date, workdayEnd: Date) => ({
  items: dbTasks.map(task => ({
    id: task.id,
    type: 'task' as const,
    name: task.name,
    duration: 30,
    startTime: workdayStart,
    endTime: addHours(workdayStart, 1),
    emoji: assignEmoji(task.name),
    isTimedEvent: false,
    isCritical: task.is_critical ?? false,
    isFlexible: task.is_flexible ?? true,
    isLocked: task.is_locked ?? false,
    energyCost: task.energy_cost ?? 0,
    isCompleted: task.is_completed ?? false,
    isCustomEnergyCost: task.is_custom_energy_cost ?? false,
  })),
  summary: {
    totalTasks: dbTasks.length,
    activeTime: { hours: 1, minutes: 0 },
    breakTime: 0,
    sessionEnd: workdayEnd,
    extendsPastMidnight: false,
    midnightRolloverMessage: null,
    unscheduledCount: 0,
    criticalTasksRemaining: 0,
  },
  dbTasks,
});

const EMOJI_MAP = {
  'gym': '🏋️', 'exercise': '🏃', 'run': '🏃', 'workout': '💪', 'lift': '🏋️',
  'meeting': '💼', 'call': '📞', 'zoom': '📹', 'team': '👥', 'client': '🤝',
  'email': '📧', 'read': '📖', 'book': '📚', 'study': '📚', 'learn': '🧠',
  'code': '💻', 'program': '💻', 'write': '✍️', 'blog': '📝', 'article': '📝',
  'lunch': '🍽️', 'eat': '🍽️', 'food': '🍲', 'break': '☕', 'coffee': '☕',
  'rest': '😴', 'nap': '😴', 'meditate': '🧘', 'yoga': '🧘', 'walk': '🚶',
  'shower': '🚿', 'clean': '🧹', 'laundry': '🧺', 'shop': '🛒', 'groceries': '🛒',
  'project': '🚀', 'build': '🔨', 'design': '🎨', 'art': '🎨', 'music': '🎵',
  'practice': '🎯', 'review': '🔍', 'plan': '📅', 'schedule': '📅', 'admin': '📋',
  'todo': '📋', 'task': '✅',
} as Record<string, string>;

export { EMOJI_MAP };

const EMOJI_HUE_MAP = {
  'gym': 25, 'exercise': 25, 'run': 25, 'workout': 25, 'lift': 25,
  'meeting': 210, 'call': 210, 'zoom': 210, 'team': 210, 'client': 210,
  'email': 240, 'read': 240, 'book': 240, 'study': 240, 'learn': 240,
  'code': 200, 'program': 200, 'write': 30, 'blog': 30, 'article': 30,
  'lunch': 25, 'eat': 25, 'food': 25, 'break': 340, 'coffee': 340,
  'rest': 340, 'nap': 340, 'meditate': 340, 'yoga': 340, 'walk': 120,
  'shower': 120, 'clean': 120, 'laundry': 120, 'shop': 120, 'groceries': 120,
  'project': 280, 'build': 280, 'design': 300, 'art': 300, 'music': 60,
  'practice': 60, 'review': 45, 'plan': 45, 'schedule': 45, 'admin': 190,
  'todo': 190, 'task': 190,
} as Record<string, number>;

export { EMOJI_HUE_MAP };

export const parseSinkTaskInput = (input: string, userId: string) => {
  const trimmedInput = input.trim();
  const parts = trimmedInput.split(' ');
  const name = parts[0];
  
  if (!name) return null;

  let duration: number | null = null;
  let isCritical = false;

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (!isNaN(Number(part))) {
      duration = Number(part);
    } else if (part === '!') {
      isCritical = true;
    }
  }

  const energyCost = calculateEnergyCost(duration || 30, isCritical);

  return {
    user_id: userId,
    name,
    duration: duration || null,
    break_duration: null,
    original_scheduled_date: format(startOfDay(new Date()), 'yyyy-MM-dd'),
    is_critical: isCritical,
    is_locked: false,
    energy_cost: energyCost,
    is_completed: false,
    is_custom_energy_cost: false,
  };
};