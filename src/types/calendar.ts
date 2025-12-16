import { DBScheduledTask } from "./scheduler";

// Represents a calendar available on the user's iCloud account
export interface AvailableCalendar {
  id: string; // External ID from iCloud
  name: string;
  color: string; // Hex color
}

// Represents a calendar the user has selected to sync (stored in DB)
export interface UserCalendar {
  id: string; // Internal DB ID
  user_id: string;
  calendar_id: string; // External ID
  calendar_name: string;
  is_enabled: boolean;
  last_synced_at: string | null;
}

// Represents an event fetched from iCloud (mock structure)
export interface ICloudEvent {
  id: string; // External event ID
  calendar_id: string;
  title: string;
  start_time: string; // ISO string
  end_time: string; // ISO string
  is_all_day: boolean;
  location: string | null;
  description: string | null;
}

// Represents the structure of an event to be inserted into scheduled_tasks
export type SyncedScheduledTask = Omit<DBScheduledTask, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'break_duration' | 'is_custom_energy_cost' | 'task_environment'> & {
    id?: string; // Optional ID for upsert
    source_calendar_id: string;
};