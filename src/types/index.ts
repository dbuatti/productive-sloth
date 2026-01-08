import { TaskEnvironment } from "./scheduler";

export type TaskPriority = 'HIGH' | 'MEDIUM' | 'LOW';

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
  is_work: boolean; // NEW: Added
  task_environment?: TaskEnvironment; // Added for consistency
}

export interface NewTask {
  title: string;
  priority: TaskPriority;
  metadata_xp?: number;
  energy_cost: number;
  due_date: string;
  description?: string;
  is_critical?: boolean;
  is_custom_energy_cost?: boolean;
  is_backburner?: boolean;
  is_work?: boolean; // NEW: Added
  task_environment?: TaskEnvironment; // Added
}

export type TaskStatusFilter = 'ALL' | 'ACTIVE' | 'COMPLETED';
export type TemporalFilter = 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS';
export type SortBy = 'PRIORITY_HIGH_TO_LOW' | 'PRIORITY_LOW_TO_HIGH' | 'TIME_EARLIEST_TO_LATEST' | 'TIME_LATEST_TO_EARLIEST' | 'EMOJI' | 'NAME_ASC' | 'NAME_DESC' | 'ENVIRONMENT_RATIO';