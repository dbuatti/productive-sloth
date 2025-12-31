import { format } from 'https://esm.sh/date-fns@2.30.0';

// NEW: TimeBlock interface for scheduler utility functions
export interface TimeBlock {
  start: Date;
  end: Date;
  duration: number; // in minutes
}

// Supabase-specific types for scheduled tasks
export interface DBScheduledTask {
  id: string;
  user_id: string;
  name: string;
  break_duration: number | null;
  start_time: string | null; // New: ISO date string for timed events
  end_time: string | null;   // New: ISO date string for timed events
  scheduled_date: string; // New: Date (YYYY-MM-DD) for which the task is scheduled
  created_at: string;
  updated_at: string; // NEW: Added updated_at
  is_critical: boolean; // NEW: Critical Urgency Flag
  is_flexible: boolean; // NEW: Flag for schedule compaction
  is_locked: boolean; // NEW: Task Immutability Flag
  energy_cost: number; // NEW: Made energyCost required
  is_completed: boolean; // NEW: Added is_completed for scheduled tasks
  is_custom_energy_cost: boolean; // NEW: Flag for custom energy cost
  task_environment: 'home' | 'laptop' | 'away' | 'piano' | 'laptop_piano'; // NEW: Task environment
  source_calendar_id: string | null; // NEW: Source calendar ID for read-only events
  is_backburner: boolean; // NEW: Backburner Urgency Flag
}

export interface NewDBScheduledTask {
  id?: string; // NEW: Added optional ID for upsert operations
  name: string;
  break_duration?: number;
  start_time?: string; // Optional for duration-based tasks
  end_time?: string;   // Optional for duration-based tasks
  scheduled_date: string; // New: Date (YYYY-MM-DD) for which the task is scheduled
  is_critical?: boolean; // NEW: Critical Urgency Flag
  is_flexible?: boolean; // NEW: Flag for schedule compaction
  is_locked?: boolean; // NEW: Task Immutability Flag
  energy_cost: number; // NEW: Made energyCost required
  is_completed?: boolean; // NEW: Added is_completed for new scheduled tasks
  is_custom_energy_cost?: boolean; // NEW: Flag for custom energy cost
  task_environment?: 'home' | 'laptop' | 'away' | 'piano' | 'laptop_piano'; // NEW: Task environment
  source_calendar_id?: string | null; // NEW: Source calendar ID
  is_backburner?: boolean; // NEW: Backburner Urgency Flag
}

// New types for retired tasks (Aether Sink)
export interface RetiredTask {
  id: string;
  user_id: string;
  name: string;
  duration: number | null; // Duration in minutes (retained for re-zoning)
  break_duration: number | null; // Break duration in minutes (retained for re-zoning)
  original_scheduled_date: string; // The date it was originally scheduled for (YYYY-MM-DD)
  retired_at: string; // Timestamp when it was moved to the sink
  is_critical: boolean; // NEW: Critical Urgency Flag
  is_locked: boolean; // NEW: Task Immutability Flag
  energy_cost: number; // NEW: Made energyCost required
  is_completed: boolean; // NEW: Added is_completed
  is_custom_energy_cost: boolean; // NEW: Flag for custom energy cost
  task_environment: 'home' | 'laptop' | 'away' | 'piano' | 'laptop_piano'; // NEW: Task environment
  is_backburner: boolean; // NEW: Backburner Urgency Flag
}

export interface NewRetiredTask {
  user_id: string;
  name: string;
  duration: number | null;
  break_duration: number | null;
  original_scheduled_date: string;
  is_critical?: boolean; // NEW: Critical Urgency Flag
  is_locked?: boolean; // NEW: Task Immutability Flag
  energy_cost: number; // NEW: Made energyCost required
  is_completed?: boolean; // NEW: Added is_completed
  is_custom_energy_cost?: boolean; // NEW: Flag for custom energy cost
  task_environment?: 'home' | 'laptop' | 'away' | 'piano' | 'laptop_piano'; // NEW: Task environment
  is_backburner?: boolean; // NEW: Backburner Urgency Flag
}

// Helper type for unification (moved from SchedulerPage.tsx)
export interface UnifiedTask {
  id: string;
  name: string;
  duration: number;
  break_duration: number | null;
  is_critical: boolean;
  is_flexible: boolean;
  is_backburner: boolean; // NEW: Backburner Urgency Flag
  energy_cost: number;
  source: 'scheduled' | 'retired';
  originalId: string; // ID in the source table
  is_custom_energy_cost: boolean; // NEW: Add custom energy cost flag
  created_at: string; // NEW: Add created_at for age sorting
  task_environment: 'home' | 'laptop' | 'away' | 'piano' | 'laptop_piano'; // NEW: Task environment
}

// NEW: Payload for the atomic auto-balance mutation
export interface AutoBalancePayload {
  scheduledTaskIdsToDelete: string[];
  retiredTaskIdsToDelete: string[];
  tasksToInsert: NewDBScheduledTask[];
  tasksToKeepInSink: NewRetiredTask[];
  selectedDate: string;
  dynamicOccupiedBlocks: { start: string; end: string; duration: number }[]; // Changed to string for serialization over network
}

export type ScheduledItemType = 'task' | 'break' | 'time-off' | 'meal' | 'calendar-event'; // UPDATED: Added 'calendar-event'

export interface ScheduledItem {
  id: string; // Unique ID for React keys
  type: ScheduledItemType;
  name: string; // Task name or "BREAK"
  duration: number; // in minutes (calculated for timed events)
  startTime: Date;
  endTime: Date;
  emoji: string;
  description?: string; // For breaks
  isTimedEvent: boolean; // New: Flag to differentiate
  color?: string; // New: For custom colors (e.g., Tailwind class like 'bg-blue-500')
  isCritical?: boolean; // NEW: Critical Urgency Flag
  isFlexible?: boolean; // NEW: Flag for schedule compaction
  isLocked?: boolean; // NEW: Task Immutability Flag
  energyCost: number; // NEW: Made energyCost required
  isCompleted: boolean; // NEW: Added isCompleted for scheduled items
  isCustomEnergyCost: boolean; // NEW: Flag for custom energy cost
  taskEnvironment: 'home' | 'laptop' | 'away' | 'piano' | 'laptop_piano'; // NEW: Task environment
  sourceCalendarId: string | null; // NEW: Source calendar ID
  isBackburner: boolean; // NEW: Backburner Urgency Flag
}

// NEW: Type for combined completed task log entry for recap metrics
export interface CompletedTaskLogEntry {
  id: string;
  user_id: string;
  name: string;
  effective_duration_minutes: number; // Calculated duration for recap metrics
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
  task_environment: 'home' | 'laptop' | 'away' | 'piano' | 'laptop_piano';
  original_source: 'scheduled_tasks' | 'aethersink' | 'tasks';
}

export interface ScheduleSummary {
  totalTasks: number;
  activeTime: { hours: number; minutes: number };
  breakTime: number; // in minutes
  sessionEnd: Date;
  extendsPastMidnight: boolean;
  midnightRolloverMessage: string | null;
  unscheduledCount: number; // New: Count of tasks that couldn't fit within the workday window
  criticalTasksRemaining: number; // NEW: Count of critical tasks not yet completed
}