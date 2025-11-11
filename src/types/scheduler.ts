import { TimeBlock } from './scheduler-utils'; // <-- REMOVE THIS LINE

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type SortBy = 'PRIORITY_HIGH_TO_LOW' | 'PRIORITY_LOW_TO_HIGH' | 'TIME_EARLIEST_TO_LATEST' | 'TIME_LATEST_TO_EARLIEST';

export interface DBScheduledTask {
  id: string;
  user_id: string;
  name: string;
  start_time: string | null; // ISO string
  end_time: string | null;   // ISO string
  scheduled_date: string; // YYYY-MM-DD
  is_critical: boolean;
  is_flexible: boolean;
  break_duration: number | null; // Duration in minutes for breaks associated with this task
  created_at: string;
  updated_at: string;
}

export interface NewDBScheduledTask {
  name: string;
  start_time: string | null;
  end_time: string | null;
  scheduled_date: string;
  is_critical: boolean;
  is_flexible: boolean;
  break_duration?: number | null;
}

export interface RetiredTask {
  id: string;
  user_id: string;
  name: string;
  duration: number | null; // Original duration in minutes
  break_duration: number | null;
  original_scheduled_date: string; // YYYY-MM-DD
  is_critical: boolean;
  created_at: string;
}

export interface NewRetiredTask {
  user_id: string;
  name: string;
  duration: number | null;
  break_duration: number | null;
  original_scheduled_date: string;
  is_critical: boolean;
}

// Define TimeBlock here, as it's a fundamental type
export interface TimeBlock {
  start: Date;
  end: Date;
  duration: number; // in minutes
}

// Base interface for all scheduled items
export interface BaseScheduledItem {
  id: string;
  name: string;
  startTime: Date;
  endTime: Date;
  duration: number; // in minutes
  emoji?: string; // NEW: Optional emoji property
}

// Specific interface for a scheduled task
export interface ScheduledTaskItem extends BaseScheduledItem {
  type: 'task';
  isCritical: boolean;
  isFlexible: boolean;
  breakDuration?: number | null;
  originalTask: DBScheduledTask;
}

// Specific interface for a scheduled break
export interface ScheduledBreakItem extends BaseScheduledItem {
  type: 'break';
}

// Specific interface for a free time slot
export interface FreeSlotItem extends BaseScheduledItem {
  type: 'free-slot';
}

// NEW: Specific interface for a scheduled time-off block
export interface ScheduledTimeOffItem extends BaseScheduledItem {
  type: 'time-off';
}

// Discriminated union for all possible scheduled items
export type ScheduledItem = ScheduledTaskItem | ScheduledBreakItem | FreeSlotItem | ScheduledTimeOffItem; // NEW: Added ScheduledTimeOffItem

// Export ScheduleSummary as a standalone interface
export interface ScheduleSummary {
  totalScheduledDuration: number;
  totalBreakDuration: number;
  totalFreeTime: number;
  unscheduledCount: number;
  workdayStart: Date;
  workdayEnd: Date;
}

export interface FormattedSchedule {
  items: ScheduledItem[];
  summary: ScheduleSummary; // Use the exported ScheduleSummary
}