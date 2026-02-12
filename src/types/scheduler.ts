export type TaskPriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type TaskStatusFilter = 'ALL' | 'ACTIVE' | 'COMPLETED';
export type TemporalFilter = 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS';
export type SortBy = 'PRIORITY_HIGH_TO_LOW' | 'PRIORITY_LOW_TO_HIGH' | 'TIME_EARLIEST_TO_LATEST' | 'TIME_LATEST_TO_EARLIEST' | 'EMOJI' | 'NAME_ASC' | 'NAME_DESC' | 'ENVIRONMENT_RATIO';

export type TaskEnvironment = string;

export type RetiredTaskSortBy = 
  'NAME_ASC' | 'NAME_DESC' |
  'DURATION_ASC' | 'DURATION_DESC' |
  'CRITICAL_FIRST' | 'CRITICAL_LAST' |
  'LOCKED_FIRST' | 'LOCKED_LAST' |
  'ENERGY_ASC' | 'ENERGY_DESC' |
  'RETIRED_AT_NEWEST' | 'RETIRED_AT_OLDEST' |
  'COMPLETED_FIRST' | 'COMPLETED_LAST' |
  'EMOJI';

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
}

export interface DBScheduledTask {
  id: string;
  user_id: string;
  name: string;
  break_duration: number | null;
  start_time: string | null;
  end_time: string | null;
  scheduled_date: string;
  created_at: string;
  updated_at: string;
  is_critical: boolean;
  is_flexible: boolean;
  is_locked: boolean;
  energy_cost: number;
  is_completed: boolean;
  is_custom_energy_cost: boolean;
  task_environment: TaskEnvironment;
  source_calendar_id: string | null;
  is_backburner: boolean;
  is_work: boolean;
  is_break: boolean;
}

export interface NewDBScheduledTask {
  id?: string;
  name: string;
  break_duration?: number;
  start_time?: string;
  end_time?: string;
  scheduled_date: string;
  is_critical?: boolean;
  is_flexible?: boolean;
  is_locked?: boolean;
  energy_cost: number;
  is_completed?: boolean;
  is_custom_energy_cost?: boolean;
  task_environment?: TaskEnvironment;
  source_calendar_id?: string | null;
  is_backburner?: boolean;
  is_work?: boolean;
  is_break?: boolean;
}

export interface RetiredTask {
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
  task_environment: TaskEnvironment;
  is_backburner: boolean;
  is_work: boolean;
  is_break: boolean;
}

export interface NewRetiredTask {
  user_id: string;
  name: string;
  duration: number | null;
  break_duration: number | null;
  original_scheduled_date: string;
  is_critical?: boolean;
  is_locked?: boolean;
  energy_cost: number;
  is_completed?: boolean;
  is_custom_energy_cost?: boolean;
  task_environment?: TaskEnvironment;
  is_backburner?: boolean;
  is_work?: boolean;
  is_break?: boolean;
}

export interface UnifiedTask {
  id: string;
  name: string;
  duration: number;
  break_duration: number | null;
  is_critical: boolean;
  is_flexible: boolean;
  is_backburner: boolean;
  energy_cost: number;
  source: 'scheduled' | 'retired';
  originalId: string;
  is_custom_energy_cost: boolean;
  created_at: string;
  task_environment: TaskEnvironment;
  is_work: boolean;
  is_break: boolean;
}

export interface AutoBalancePayload {
  scheduledTaskIdsToDelete: string[];
  retiredTaskIdsToDelete: string[];
  tasksToInsert: NewDBScheduledTask[];
  tasksToKeepInSink: NewRetiredTask[];
  selectedDate: string;
}

export type ScheduledItemType = 'task' | 'break' | 'time-off' | 'meal' | 'calendar-event';

export interface ScheduledItem {
  id: string;
  type: ScheduledItemType;
  name: string;
  duration: number;
  startTime: Date;
  endTime: Date;
  emoji: string;
  description?: string;
  isTimedEvent: boolean;
  color?: string;
  isCritical?: boolean;
  isFlexible?: boolean;
  isLocked?: boolean;
  energyCost: number;
  isCompleted: boolean;
  isCustomEnergyCost: boolean;
  taskEnvironment: TaskEnvironment;
  sourceCalendarId: string | null;
  isBackburner: boolean;
  isWork: boolean;
  isBreak: boolean;
}

export interface CompletedTaskLogEntry {
  id: string;
  user_id: string;
  name: string;
  effective_duration_minutes: number;
  break_duration: number | null;
  start_time: string | null;
  end_time: string | null;
  scheduled_date: string;
  created_at: string;
  updated_at: string;
  is_critical: boolean;
  is_flexible: boolean;
  is_locked: boolean;
  energy_cost: number;
  is_completed: boolean;
  is_custom_energy_cost: boolean;
  task_environment: TaskEnvironment;
  original_source: 'scheduled_tasks' | 'aethersink' | 'tasks';
  is_work: boolean;
  is_break: boolean;
  completed_at: string;
  xp_earned: number;
  priority: TaskPriority;
}

export interface ScheduleSummary {
  totalTasks: number;
  activeTime: { hours: number; minutes: number };
  breakTime: number;
  sessionEnd: Date;
  extendsPastMidnight: boolean;
  midnightRolloverMessage: string | null;
  unscheduledCount: number;
  criticalTasksRemaining: number;
  isBlocked: boolean;
}

export interface TimeMarker {
  id: string;
  type: 'marker';
  time: Date;
  label: string;
}

export interface FreeTimeItem {
  id: string;
  type: 'free-time';
  startTime: Date;
  endTime: Date;
  duration: number;
  message: string;
  suggestedTask?: RetiredTask | null;
}

export interface CurrentTimeMarker {
  id: string;
  type: 'current-time';
  time: Date;
}

export interface FormattedSchedule {
  items: ScheduledItem[];
  summary: ScheduleSummary;
  dbTasks: DBScheduledTask[];
}

export type DisplayItem = ScheduledItem | TimeMarker | FreeTimeItem | CurrentTimeMarker;

export interface TimeBlock {
  start: Date;
  end: Date;
  duration: number;
}