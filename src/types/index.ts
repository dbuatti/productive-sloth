export type TaskPriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type TaskStatusFilter = 'ALL' | 'ACTIVE' | 'COMPLETED';
export type TemporalFilter = 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS';
export type SortBy = 'PRIORITY_HIGH_TO_LOW' | 'PRIORITY_LOW_TO_HIGH' | 'TIME_EARLIEST_TO_LATEST' | 'TIME_LATEST_TO_EARLIEST';

// NEW: Import TaskEnvironment from scheduler types
import { TaskEnvironment } from './scheduler';

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
  is_custom_energy_cost: boolean;
  is_backburner: boolean;
  task_environment: TaskEnvironment; // NEW: Added task_environment
}

export interface NewTask {
  title: string;
  priority: TaskPriority;
  due_date: string;
  description?: string;
  is_critical?: boolean;
  is_backburner?: boolean;
  energy_cost: number;
  is_custom_energy_cost?: boolean;
  task_environment?: TaskEnvironment; // NEW: Added task_environment
}