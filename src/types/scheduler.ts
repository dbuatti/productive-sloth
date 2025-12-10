export type TaskPriority = 'low' | 'medium' | 'high';
export type SortBy = 
  | 'TIME_EARLIEST_TO_LATEST'
  | 'TIME_LATEST_TO_EARLIEST'
  | 'PRIORITY_HIGH_TO_LOW'
  | 'PRIORITY_LOW_TO_HIGH'
  | 'NAME_ASC'
  | 'NAME_DESC'
  | 'EMOJI'
  | 'CREATED_AT'
  | 'DURATION_ASC'
  | 'DURATION_DESC'
  | 'CRITICAL_FIRST'
  | 'CRITICAL_LAST'
  | 'LOCKED_FIRST'
  | 'LOCKED_LAST'
  | 'ENERGY_ASC'
  | 'ENERGY_DESC'
  | 'RETIRED_AT_OLDEST'
  | 'RETIRED_AT_NEWEST'
  | 'COMPLETED_FIRST'
  | 'COMPLETED_LAST';

export type RetiredTaskSortBy = SortBy;
export type TaskEnvironment = 'home' | 'laptop' | 'globe' | 'music' | 'away';

export interface ScheduleSummary {
  totalTasks: number;
  completedCount: number;
  criticalCount: number;
  totalDuration: number;
  scheduledCount: number;
  unscheduledCount: number;
  energyCost: number;
  breakTime: number;
  startTime: string | null;
  endTime: string | null;
  activeTime: {
    hours: number;
    minutes: number;
  };
  sessionEnd: string;
  criticalTasksRemaining: number;
}

export interface ScheduledItem {
  id: string;
  name: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  breakDuration: number;
  isCritical: boolean;
  isLocked: boolean;
  isFlexible: boolean;
  energyCost: number;
  taskEnvironment: TaskEnvironment;
  type?: 'task' | 'break' | 'time-off';
}

export interface FormattedSchedule {
  items: ScheduledItem[];
  summary: ScheduleSummary;
  dbTasks: DBScheduledTask[];
}

export interface DBScheduledTask {
  id: string;
  user_id?: string;
  name: string;
  start_time?: string;
  end_time?: string;
  break_duration?: number;
  scheduled_date: string;
  is_critical: boolean;
  is_flexible: boolean;
  is_locked: boolean;
  energy_cost: number;
  is_completed: boolean;
  is_custom_energy_cost: boolean;
  task_environment: TaskEnvironment;
  created_at?: string;
  updated_at?: string;
}

export interface RetiredTask {
  id: string;
  user_id: string;
  name: string;
  duration?: number;
  break_duration?: number;
  retired_at: string;
  is_critical: boolean;
  is_locked: boolean;
  energy_cost: number;
  is_completed: boolean;
  is_custom_energy_cost: boolean;
  task_environment: TaskEnvironment;
  original_scheduled_date?: string;
}

export interface NewRetiredTask {
  user_id: string;
  name: string;
  duration?: number | null;
  break_duration?: number | null;
  original_scheduled_date: string;
  is_critical: boolean;
  is_locked: boolean;
  energy_cost: number;
  is_completed: boolean;
  is_custom_energy_cost: boolean;
  task_environment: TaskEnvironment;
}

export interface NewDBScheduledTask {
  id?: string;
  name: string;
  start_time?: string;
  end_time?: string;
  break_duration?: number | null;
  scheduled_date: string;
  is_critical: boolean;
  is_flexible: boolean;
  is_locked: boolean;
  energy_cost: number;
  is_completed?: boolean;
  is_custom_energy_cost: boolean;
  task_environment: TaskEnvironment;
}

export interface RawTaskInput {
  name: string;
  duration?: number;
  breakDuration?: number;
  startTime?: Date;
  endTime?: Date;
  isCritical: boolean;
  isFlexible: boolean;
  energyCost: number;
  shouldSink?: boolean;
}

export interface TimeMarker {
  time: Date;
  label: string;
}

export interface DisplayItem {
  id: string;
  name: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  breakDuration: number;
  isCritical: boolean;
  isLocked: boolean;
  isFlexible: boolean;
  energyCost: number;
  taskEnvironment: TaskEnvironment;
}

export interface TimeBlock {
  start: Date;
  end: Date;
  duration: number;
}

export interface UnifiedTask {
  id: string;
  name: string;
  duration: number;
  break_duration?: number;
  is_critical: boolean;
  is_flexible: boolean;
  energy_cost: number;
  source: 'scheduled' | 'retired';
  originalId: string;
  is_custom_energy_cost: boolean;
  created_at: string;
  task_environment: TaskEnvironment;
}

export interface AutoBalancePayload {
  scheduledTaskIdsToDelete: string[];
  retiredTaskIdsToDelete: string[];
  tasksToInsert: NewDBScheduledTask[];
  tasksToKeepInSink: NewRetiredTask[];
  selectedDate: string;
}

export interface CompletedTaskLogEntry {
  id: string;
  user_id?: string;
  task_name: string;
  original_id?: string;
  duration_scheduled?: number;
  duration_used?: number;
  completed_at: string;
  xp_earned: number;
  energy_cost: number;
  is_critical: boolean;
  original_source: string;
  original_scheduled_date?: string;
  created_at?: string;
  effective_duration_minutes: number;
  name: string;
  is_completed: boolean;
}