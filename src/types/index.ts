import { TaskEnvironment, TaskPriority, TaskStatusFilter, TemporalFilter, SortBy } from "./scheduler";

export type { TaskPriority, TaskStatusFilter, TemporalFilter, SortBy };

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
  is_work: boolean;
  is_break: boolean;
  task_environment?: TaskEnvironment;
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
  is_work?: boolean;
  is_break?: boolean;
  task_environment?: TaskEnvironment;
}