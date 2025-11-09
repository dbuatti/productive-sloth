export type TaskPriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type TaskStatusFilter = 'ALL' | 'ACTIVE' | 'COMPLETED';
export type TemporalFilter = 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS';
export type SortBy = 'PRIORITY' | 'DUE_DATE';

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description?: string; // Added description
  is_completed: boolean;
  priority: TaskPriority;
  metadata_xp: number;
  energy_cost: number;
  due_date: string; // ISO date string
  created_at: string;
  updated_at: string; // Added updated_at
}

export interface NewTask {
  title: string;
  priority: TaskPriority;
  metadata_xp: number;
  energy_cost: number;
  due_date: string;
  description?: string; // Added description to NewTask
}

// --- Scheduler Types ---

export interface RawTaskInput {
  name: string;
  duration: number; // in minutes
  breakDuration?: number; // in minutes
}

// Supabase-specific types for scheduled tasks
export interface DBScheduledTask {
  id: string;
  user_id: string;
  name: string;
  duration: number;
  break_duration: number | null; // Supabase will store null for undefined
  created_at: string;
}

export interface NewDBScheduledTask {
  name: string;
  duration: number;
  break_duration?: number;
}

export type ScheduledItemType = 'task' | 'break';

export interface ScheduledItem {
  id: string; // Unique ID for React keys
  type: ScheduledItemType;
  name: string; // Task name or "BREAK"
  duration: number; // in minutes
  startTime: Date;
  endTime: Date;
  emoji: string;
  description?: string; // For breaks
}

export interface ScheduleSummary {
  totalTasks: number;
  activeTime: { hours: number; minutes: number };
  breakTime: number; // in minutes
  sessionEnd: Date;
  extendsPastMidnight: boolean;
  midnightRolloverMessage: string | null;
}

// New type for fixed time markers
export interface TimeMarker {
  id: string;
  type: 'marker';
  time: Date;
  label: string;
}

export type DisplayItem = ScheduledItem | TimeMarker;

export interface FormattedSchedule {
  items: ScheduledItem[];
  summary: ScheduleSummary;
}