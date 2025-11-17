export type TaskPriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type TaskStatusFilter = 'ALL' | 'ACTIVE' | 'COMPLETED';
export type TemporalFilter = 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS';
export type SortBy = 'PRIORITY_HIGH_TO_LOW' | 'PRIORITY_LOW_TO_HIGH' | 'TIME_EARLIEST_TO_LATEST' | 'TIME_LATEST_TO_EARLIEST';

// Task interface now reflects the structure of AetherSink for general tasks
export interface Task {
  id: string;
  user_id: string;
  name: string; // Renamed from title to name to match AetherSink
  duration: number | null; // Added duration
  break_duration: number | null; // Added break_duration
  original_scheduled_date: string; // The date it was originally scheduled for (YYYY-MM-DD)
  retired_at: string; // Timestamp when it was moved to the sink (used as created_at for general tasks)
  is_critical: boolean;
  is_locked: boolean; // Tasks in AetherSink can be locked
  energy_cost: number;
  is_completed: boolean;
  is_custom_energy_cost: boolean;
}

// NewTask interface for adding tasks to AetherSink
export interface NewTask {
  name: string; // Renamed from title to name
  duration: number | null; // Added duration
  break_duration?: number; // Added break_duration
  original_scheduled_date?: string; // Optional, defaults to today
  is_critical?: boolean;
  is_locked?: boolean;
  energy_cost: number;
  is_completed?: boolean;
  is_custom_energy_cost?: boolean;
}