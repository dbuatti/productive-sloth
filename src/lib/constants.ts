"use client";

export const XP_PER_LEVEL = 100;
export const MAX_ENERGY = 100;
export const RECHARGE_BUTTON_AMOUNT = 25;
export const LOW_ENERGY_THRESHOLD = 20;
export const LOW_ENERGY_NOTIFICATION_COOLDOWN_MINUTES = 30;
export const DAILY_CHALLENGE_XP = 50;
export const DAILY_CHALLENGE_ENERGY = 20;
export const DAILY_CHALLENGE_TASKS_REQUIRED = 3;
export const ENERGY_REGEN_AMOUNT = 5;
export const ENERGY_REGEN_INTERVAL_MS = 60 * 1000; // 1 minute
export const DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION = 30;

// Emoji mapping for task categorization
export const EMOJI_MAP = {
  'gym': '🏋️',
  'exercise': '🏃',
  'run': '🏃',
  'workout': '💪',
  'lift': '🏋️',
  'meeting': '💼',
  'call': '📞',
  'zoom': '📹',
  'team': '👥',
  'client': '🤝',
  'email': '📧',
  'read': '📖',
  'book': '📚',
  'study': '📚',
  'learn': '🧠',
  'code': '💻',
  'program': '💻',
  'write': '✍️',
  'blog': '📝',
  'article': '📝',
  'lunch': '🍽️',
  'eat': '🍽️',
  'food': '🍲',
  'break': '☕',
  'coffee': '☕',
  'rest': '😴',
  'nap': '😴',
  'meditate': '🧘',
  'yoga': '🧘',
  'walk': '🚶',
  'shower': '🚿',
  'clean': '🧹',
  'laundry': '🧺',
  'shop': '🛒',
  'groceries': '🛒',
  'project': '🚀',
  'build': '🔨',
  'design': '🎨',
  'art': '🎨',
  'music': '🎵',
  'practice': '🎯',
  'review': '🔍',
  'plan': '📅',
  'schedule': '📅',
  'admin': '📋',
  'todo': '📋',
  'task': '✅',
} as Record<string, string>;