export type TaskPriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type TaskStatusFilter = 'ALL' | 'ACTIVE' | 'COMPLETED';
export type TemporalFilter = 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS';
export type SortBy = 'PRIORITY_HIGH_TO_LOW' | 'PRIORITY_LOW_TO_HIGH' | 'TIME_EARLIEST_TO_LATEST' | 'TIME_LATEST_TO_EARLIEST' | 'EMOJI';

// NEW: Task Environment Type
export type TaskEnvironment = 'home' | 'laptop' | 'away';

// NEW: Type for sorting retired tasks
export type RetiredTaskSortBy = 
  'NAME_ASC' | 'NAME_DESC' |
  'DURATION_ASC' | 'DURATION_DESC' |
  'CRITICAL_FIRST' | 'CRITICAL_LAST' |
  'LOCKED_FIRST' | 'LOCKED_LAST' |
  'ENERGY_ASC' | 'ENERGY_DESC' |
  'RETIRED_AT_NEWEST' | 'RETIRED_AT_OLDEST' |
  'COMPLETED_FIRST' | 'COMPLETED_LAST' |
  'EMOJI' | 'ENVIRONMENT_HOME_FIRST' | 'ENVIRONMENT_LAPTOP_FIRST' | 'ENVIRONMENT_AWAY_FIRST';

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
}

export interface NewTask {
  title: string;
  priority: TaskPriority;
  metadata_xp: number;
  energy_cost: number;
  due_date: string;
  description?: string;
  is_critical?: boolean;
}

// --- Scheduler Types ---

export interface RawTaskInput {
  name: string;
  duration: number;
  breakDuration?: number;
  isCritical?: boolean;
  isFlexible?: boolean;
  taskEnvironment?: TaskEnvironment; // NEW: Environment support
  energyCost: number;
}

// Supabase-specific types for scheduled tasks
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
  task_environment: TaskEnvironment; // NEW: Environment field
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
  task_environment?: TaskEnvironment; // NEW: Environment support
}

// New types for retired tasks (Aether Sink)
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
  task_environment: TaskEnvironment; // NEW: Environment field
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
  task_environment?: TaskEnvironment; // NEW: Environment support
}

// Helper type for unification
export interface UnifiedTask {
  id: string;
  name: string;
  duration: number;
  break_duration: number | null;
  is_critical: boolean;
  is_flexible: boolean;
  energy_cost: number;
  source: 'scheduled' | 'retired';
  originalId: string;
  is_custom_energy_cost: boolean;
  created_at: string;
  task_environment: TaskEnvironment; // NEW: Environment support
}

// NEW: Payload for the atomic auto-balance mutation
export interface AutoBalancePayload {
  scheduledTaskIdsToDelete: string[];
  retiredTaskIdsToDelete: string[];
  tasksToInsert: NewDBScheduledTask[];
  tasksToKeepInSink: NewRetiredTask[];
  selectedDate: string;
}

export type ScheduledItemType = 'task' | 'break' | 'time-off';

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
  taskEnvironment?: TaskEnvironment; // NEW: Environment support
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
}

// New type for fixed time markers
export interface TimeMarker {
  id: string;
  type: 'marker';
  time: Date;
  label: string;
}

// New type for free time blocks
export interface FreeTimeItem {
  id: string;
  type: 'free-time';
  startTime: Date;
  endTime: Date;
  duration: number;
  message: string;
}

// New type for current time marker
export interface CurrentTimeMarker {
  id: string;
  type: 'current-time';
  time: Date;
}

// Define FormattedSchedule here
export interface FormattedSchedule {
  items: ScheduledItem[];
  summary: ScheduleSummary;
  dbTasks: DBScheduledTask[];
}

export type DisplayItem = ScheduledItem | TimeMarker | FreeTimeItem | CurrentTimeMarker;

// NEW: TimeBlock interface for scheduler utility functions
export interface TimeBlock {
  start: Date;
  end: Date;
  duration: number;
}