export type TaskPriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type TaskStatusFilter = 'ALL' | 'ACTIVE' | 'COMPLETED';
export type TemporalFilter = 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS';
export type SortBy = 'PRIORITY' | 'DUE_DATE';

export interface Task {
  id: string;
  user_id: string;
  title: string;
  is_completed: boolean;
  priority: TaskPriority;
  metadata_xp: number;
  due_date: string; // ISO date string
  created_at: string;
}

export interface NewTask {
  title: string;
  priority: TaskPriority;
  metadata_xp: number;
  due_date: string;
}