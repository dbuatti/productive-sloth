export type TaskPriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type TaskStatusFilter = 'ALL' | 'ACTIVE' | 'COMPLETED';
export type TemporalFilter = 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS';
export type SortBy = 'PRIORITY_HIGH_TO_LOW' | 'PRIORITY_LOW_TO_HIGH' | 'TIME_EARLIEST_TO_LATEST' | 'TIME_LATEST_TO_EARLIEST';

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  is_completed: boolean;
  priority: TaskPriority;
  metadata_xp: number;
  energy_cost: number;
  due_date: string;
  created_at: string;
  updated_at: string;
  is_critical: boolean;
  is_custom_energy_cost: boolean; // NEW: Added for custom energy cost
  is_backburner: boolean; // FIX: Added missing property
}

export interface NewTask {
  title: string;
  priority: TaskPriority;
  due_date: string;
  description?: string;
  is_critical?: boolean;
  is_backburner?: boolean; // FIX: Added missing property
  energy_cost: number; // NEW: Made energy_cost required
  is_custom_energy_cost?: boolean; // NEW: Added for custom energy cost
}