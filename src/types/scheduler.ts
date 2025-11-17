export type TaskPriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type TaskStatusFilter = 'ALL' | 'ACTIVE' | 'COMPLETED';
export type TemporalFilter = 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS';
export type SortBy = 'PRIORITY_HIGH_TO_LOW' | 'PRIORITY_LOW_TO_HIGH' | 'TIME_EARLIEST_TO_LATEST' | 'TIME_LATEST_TO_EARLIEST' | 'EMOJI';

// Type for sorting AetherSink tasks
export type AetherSinkSortBy =
  'NAME_ASC' | 'NAME_DESC' |
  'DURATION_ASC' | 'DURATION_DESC' |
  'CRITICAL_FIRST' | 'CRITICAL_LAST' |
  'LOCKED_FIRST' | 'LOCKED_LAST' |
  'ENERGY_ASC' | 'ENERGY_DESC' |
  'RETIRED_AT_NEWEST' | 'RETIRED_AT_OLDEST' |
  'COMPLETED_FIRST' | 'COMPLETED_LAST' |
  'EMOJI';

// --- Scheduler Types ---

export interface RawTaskInput {
  name: string;
  duration: number; // in minutes
  breakDuration?: number; // in minutes
  isCritical?: boolean;
  isFlexible: boolean; // Now explicitly required for RawTaskInput
  energyCost: number;
}

// Supabase-specific types for FixedAppointments and CurrentSchedule
// They share a common structure for scheduled items
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
  is_flexible: boolean; // Will be FALSE for FixedAppointments, TRUE for CurrentSchedule
  is_locked: boolean;
  energy_cost: number;
  is_completed: boolean;
  is_custom_energy_cost: boolean;
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
}

// Type for AetherSink tasks (formerly RetiredTask)
export interface AetherSinkTask {
  id: string;
  user_id: string;
  name: string;
  duration: number | null;
  break_duration: number | null;
  original_scheduled_date: string;
  retired_at: string; // Timestamp when it was moved to the sink (used as created_at for general tasks)
  is_critical: boolean;
  is_locked: boolean;
  energy_cost: number;
  is_completed: boolean;
  is_custom_energy_cost: boolean;
}

export interface NewAetherSinkTask {
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
}

// Helper type for unification (used in auto-balance)
export interface UnifiedTask {
  id: string;
  name: string;
  duration: number;
  break_duration: number | null;
  is_critical: boolean;
  is_flexible: boolean;
  energy_cost: number;
  source: 'FixedAppointments' | 'CurrentSchedule' | 'AetherSink'; // Updated sources
  originalId: string;
  is_custom_energy_cost: boolean;
  created_at: string;
}

// Payload for the atomic auto-balance mutation
export interface AutoBalancePayload {
  fixedAppointmentIdsToDelete: string[]; // NEW: For FixedAppointments
  currentScheduleIdsToDelete: string[]; // NEW: For CurrentSchedule
  aetherSinkIdsToDelete: string[]; // NEW: For AetherSink
  tasksToInsertIntoFixedAppointments: NewDBScheduledTask[]; // NEW: For FixedAppointments
  tasksToInsertIntoCurrentSchedule: NewDBScheduledTask[]; // NEW: For CurrentSchedule
  tasksToKeepInAetherSink: NewAetherSinkTask[]; // NEW: For AetherSink
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
  originalSourceTable: 'FixedAppointments' | 'CurrentSchedule'; // NEW: Track original source table
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
  duration: number; // in minutes
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
  dbTasks: DBScheduledTask[]; // Combined tasks from FixedAppointments and CurrentSchedule
}

export type DisplayItem = ScheduledItem | TimeMarker | FreeTimeItem | CurrentTimeMarker;

// NEW: TimeBlock interface for scheduler utility functions
export interface TimeBlock {
  start: Date;
  end: Date;
  duration: number; // in minutes
}

// NEW: CompletedTask interface for the new CompletedTasks table
export interface CompletedTask {
  id: string;
  user_id: string;
  task_name: string;
  original_id: string | null;
  duration_scheduled: number | null;
  duration_used: number | null;
  completed_at: string;
  xp_earned: number;
  energy_cost: number;
  is_critical: boolean;
  original_source: 'FixedAppointments' | 'CurrentSchedule' | 'AetherSink';
  original_scheduled_date: string | null;
  created_at: string;
}