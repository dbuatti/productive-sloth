import { TimeBlock, DBScheduledTask, NewDBScheduledTask, RetiredTask, NewRetiredTask, UnifiedTask, ScheduledItem, ScheduledItemType, CompletedTaskLogEntry, ScheduleSummary } from '../supabase/functions/_shared/types';

export type TaskPriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type TaskStatusFilter = 'ALL' | 'ACTIVE' | 'COMPLETED';
export type TemporalFilter = 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS';
export type SortBy = 'PRIORITY_HIGH_TO_LOW' | 'PRIORITY_LOW_TO_HIGH' | 'TIME_EARLIEST_TO_LATEST' | 'TIME_LATEST_TO_EARLIEST' | 'EMOJI' | 'NAME_ASC' | 'NAME_DESC'; // Updated SortBy

// NEW: Type for task environment
export type TaskEnvironment = 'home' | 'laptop' | 'away' | 'piano' | 'laptop_piano';

// NEW: Type for sorting retired tasks
export type RetiredTaskSortBy = 
  'NAME_ASC' | 'NAME_DESC' |
  'DURATION_ASC' | 'DURATION_DESC' |
  'CRITICAL_FIRST' | 'CRITICAL_LAST' |
  'LOCKED_FIRST' | 'LOCKED_LAST' |
  'ENERGY_ASC' | 'ENERGY_DESC' |
  'RETIRED_AT_NEWEST' | 'RETIRED_AT_OLDEST' |
  'COMPLETED_FIRST' | 'COMPLETED_LAST' |
  'EMOJI'; // Added EMOJI sort option

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description?: string; // Added description
  is_completed: boolean;
  priority: TaskPriority;
  metadata_xp: number;
  energy_cost: number; // Added energy_cost
  due_date: string; // ISO date string
  created_at: string;
  updated_at: string; // Added updated_at
  is_critical: boolean; // NEW: Critical Urgency Flag
  is_custom_energy_cost: boolean; // NEW: Added for custom energy cost
  is_backburner: boolean; // FIX: Added missing property
}

export interface NewTask {
  title: string;
  priority: TaskPriority;
  metadata_xp: number;
  energy_cost: number; // Added energy_cost to NewTask
  due_date: string;
  description?: string; // Added description to NewTask
  is_critical?: boolean; // NEW: Critical Urgency Flag
  is_custom_energy_cost?: boolean; // NEW: Added for custom energy cost
  is_backburner?: boolean; // NEW: Backburner Urgency Flag
}

// --- Scheduler Types ---

export interface RawTaskInput {
  name: string;
  duration: number; // in minutes
  breakDuration?: number; // in minutes
  isCritical?: boolean; // NEW: Critical Urgency Flag
  isFlexible?: boolean; // NEW: Added isFlexible to RawTaskInput
  isBackburner?: boolean; // NEW: Backburner Urgency Flag
  energyCost: number; // NEW: Made energyCost required
}

export { TimeBlock, DBScheduledTask, NewDBScheduledTask, RetiredTask, NewRetiredTask, UnifiedTask, AutoBalancePayload, ScheduledItem, ScheduledItemType, CompletedTaskLogEntry, ScheduleSummary };