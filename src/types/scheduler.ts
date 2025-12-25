import { DateRange } from 'react-day-picker';

// Existing types (assuming they are already here, just ensuring export and additions)

export type TaskPriority = 'critical' | 'neutral' | 'backburner';
export type TaskEnvironment = 'home' | 'laptop' | 'away' | 'piano' | 'laptop_piano';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  billing_address?: any;
  payment_method?: any;
  energy: number;
  last_energy_recharge: string | null;
  default_auto_schedule_start_time: string | null;
  default_auto_schedule_end_time: string | null;
  is_in_regen_pod: boolean;
  regen_pod_start_time: string | null;
  regen_pod_duration_minutes: number;
  // Add any other profile fields as needed
}

export interface DBScheduledTask {
  id: string;
  user_id: string;
  name: string;
  start_time: string | null;
  end_time: string | null;
  break_duration: number | null;
  scheduled_date: string;
  is_critical: boolean;
  is_flexible: boolean;
  is_locked: boolean;
  is_completed: boolean;
  energy_cost: number;
  is_custom_energy_cost: boolean;
  task_environment: TaskEnvironment;
  is_backburner: boolean;
  created_at: string;
  updated_at: string; // Added
  source_calendar_id: string | null; // Added
}

export interface RetiredTask {
  id: string;
  user_id: string;
  name: string;
  duration: number | null;
  break_duration: number | null;
  original_scheduled_date: string | null;
  is_critical: boolean;
  is_locked: boolean;
  is_completed: boolean;
  energy_cost: number;
  is_custom_energy_cost: boolean;
  task_environment: TaskEnvironment;
  is_backburner: boolean;
  retired_at: string;
  created_at: string; // Added for sorting consistency if needed, though retired_at is primary
}

export interface CompletedTaskLogEntry {
  id: string;
  name: string;
  is_completed: boolean;
  energy_cost: number;
  duration: number; // Added
  completed_at: string;
}

export interface ScheduledItem {
  id: string;
  name: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  breakDuration?: number; // Added
  isCritical: boolean;
  isFlexible: boolean;
  isLocked: boolean;
  isCompleted: boolean;
  energyCost: number;
  taskEnvironment: TaskEnvironment;
  isBackburner: boolean;
  emoji: string;
  type: 'task' | 'break' | 'time-off' | 'meal' | 'calendar-event';
  description?: string; // For breaks or calendar events
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
}

export interface CurrentTimeMarker {
  id: string;
  type: 'current-time';
  time: Date;
}

export type DisplayItem = ScheduledItem | TimeMarker | FreeTimeItem | CurrentTimeMarker;

export interface FormattedSchedule {
  items: ScheduledItem[];
  dbTasks: DBScheduledTask[]; // Raw DB tasks for reference
  summary: {
    totalTasks: number;
    activeTime: { hours: number; minutes: number };
    breakTime: number;
    freeTime: { hours: number; minutes: number };
    extendsPastMidnight: boolean;
    midnightRolloverMessage: string;
    criticalTasksRemaining: number;
    totalEnergyCost: number;
  };
}

export interface NewDBScheduledTask {
  id?: string; // Optional for new tasks, required for updates
  user_id: string;
  name: string;
  start_time: string | null;
  end_time: string | null;
  break_duration: number | null;
  scheduled_date: string;
  is_critical: boolean;
  is_flexible: boolean;
  is_locked: boolean;
  is_completed?: boolean; // Optional, defaults to false
  energy_cost: number;
  is_custom_energy_cost: boolean;
  task_environment: TaskEnvironment;
  is_backburner: boolean;
  created_at?: string; // Optional, defaults to now
  updated_at?: string; // Optional, defaults to now
  source_calendar_id?: string | null; // Optional
}

export interface NewRetiredTask {
  user_id: string;
  name: string;
  duration: number | null;
  break_duration: number | null;
  original_scheduled_date: string | null;
  is_critical: boolean;
  is_locked: boolean;
  is_completed?: boolean;
  energy_cost: number;
  is_custom_energy_cost: boolean;
  task_environment: TaskEnvironment;
  is_backburner: boolean;
  retired_at?: string; // Optional, defaults to now
  created_at?: string; // Optional, defaults to now
}

export interface TimeBlock {
  start: Date;
  end: Date;
  duration: number; // in minutes
}

export type SortBy = 'TIME_EARLIEST_TO_LATEST' | 'TIME_LATEST_TO_EARLIEST' | 'PRIORITY_HIGH_TO_LOW' | 'PRIORITY_LOW_TO_HIGH' | 'NAME_ASC' | 'NAME_DESC' | 'EMOJI';

export type RetiredTaskSortBy = 'OLDEST_FIRST' | 'NEWEST_FIRST' | 'DURATION_SHORTEST_FIRST' | 'DURATION_LONGEST_FIRST' | 'PRIORITY_HIGH_TO_LOW' | 'PRIORITY_LOW_TO_HIGH' | 'NAME_ASC' | 'NAME_DESC'; // Added

export interface AutoBalancePayload {
  scheduledTaskIdsToDelete: string[];
  retiredTaskIdsToDelete: string[];
  tasksToInsert: NewDBScheduledTask[];
  tasksToKeepInSink: NewRetiredTask[];
  selectedDate: string;
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
  originalId: string; // The ID from its original table (scheduled_tasks or retired_tasks)
  is_custom_energy_cost: boolean;
  created_at: string;
  task_environment: TaskEnvironment;
}