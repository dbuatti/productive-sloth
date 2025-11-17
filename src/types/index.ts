export type TaskPriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type TaskStatusFilter = 'ALL' | 'ACTIVE' | 'COMPLETED';
export type TemporalFilter = 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS';
export type SortBy = 'PRIORITY_HIGH_TO_LOW' | 'PRIORITY_LOW_TO_HIGH' | 'TIME_EARLIEST_TO_LATEST' | 'TIME_LATEST_TO_EARLIEST';

// Task interface now reflects the structure of AetherSink for general tasks
export interface Task {
  id: string;
  user_id: string;
  name: string;
  duration: number | null;
  break_duration: number | null;
  original_scheduled_date: string;
  retired_at: string;
  is_critical: boolean;
  is_locked: boolean;
  energy_cost: number;
  is_completed: boolean;
  is_custom_energy_cost: boolean;
}

// NewTask interface for adding tasks to AetherSink
export interface NewTask {
  user_id: string;
  name: string;
  duration: number | null;
  break_duration?: number;
  original_scheduled_date?: string;
  is_critical?: boolean;
  is_locked?: boolean;
  energy_cost: number;
  is_completed?: boolean;
  is_custom_energy_cost?: boolean;
}