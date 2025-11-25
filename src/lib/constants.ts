export const XP_PER_LEVEL = 100;
export const MAX_ENERGY = 100;
export const RECHARGE_BUTTON_AMOUNT = 25;
export const LOW_ENERGY_THRESHOLD = 20;
export const LOW_ENERGY_NOTIFICATION_COOLDOWN_MINUTES = 30;
export const DAILY_CHALLENGE_XP = 50;
export const DAILY_CHALLENGE_ENERGY = 20;
export const DAILY_CHALLENGE_TASKS_REQUIRED = 3;
export const DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION = 30; // New: Default duration for energy calculation for general tasks

// NEW: Server-side energy regeneration rates (per minute)
export const PASSIVE_ENERGY_REGEN_PER_MINUTE = 10 / 60; // +10 Energy per hour (Increased from 1/60)
export const BREAK_ENERGY_BOOST_PER_MINUTE = 5 / 60; // +5 Energy per break-hour (additional to passive) (Increased from 2/60)
export const NIGHT_ENERGY_BOOST_PER_MINUTE = 5 / 60; // +5 Energy per night-hour (additional to passive)