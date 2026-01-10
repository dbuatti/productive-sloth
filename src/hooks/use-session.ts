import React, { createContext, useContext } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { ScheduledItem } from '@/types/scheduler';

// Define UserProfile interface here and export it
export interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  xp: number;
  level: number;
  daily_streak: number;
  last_streak_update: string | null;
  energy: number;
  last_daily_reward_claim: string | null;
  last_daily_reward_notification: string | null;
  last_low_energy_notification: string | null;
  tasks_completed_today: number;
  enable_daily_challenge_notifications: boolean;
  enable_low_energy_notifications: boolean;
  daily_challenge_target: number;
  default_auto_schedule_start_time: string | null;
  default_auto_schedule_end_time: string | null;
  enable_delete_hotkeys: boolean;
  enable_aethersink_backup: boolean;
  last_energy_regen_at: string | null;
  is_in_regen_pod: boolean;
  regen_pod_start_time: string | null;
  breakfast_time: string | null;
  lunch_time: string | null;
  dinner_time: string | null;
  breakfast_duration_minutes: number | null;
  lunch_duration_minutes: number | null;
  dinner_duration_minutes: number | null;
  custom_environment_order: string[] | null;
  reflection_count: number | null;
  reflection_times: string[] | null;
  reflection_durations: number[] | null;
  enable_environment_chunking: boolean | null;
  enable_macro_spread: boolean | null;
  week_starts_on: number | null;
  num_days_visible: number | null;
  vertical_zoom_index: number | null;
  is_dashboard_collapsed: boolean | null;
  is_action_center_collapsed: boolean | null;
  blocked_days: string[] | null;
  updated_at: string | null;
  neurodivergent_mode: boolean | null;
  skipped_day_off_suggestions: string[] | null;
  timezone: string;
}

// Define the shape of the context value
interface SessionContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
  rechargeEnergy: (amount?: number) => Promise<void>;
  showLevelUp: boolean;
  levelUpLevel: number;
  triggerLevelUp: (level: number) => void;
  resetLevelUp: () => void;
  resetDailyStreak: () => Promise<void>;
  claimDailyReward: (xpAmount: number, energyAmount: number) => Promise<void>;
  updateNotificationPreferences: (preferences: any) => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  updateSettings: (updates: Partial<UserProfile>) => Promise<void>;
  updateBlockedDays: (dateString: string, isBlocked: boolean) => Promise<void>;
  updateSkippedDayOffSuggestions: (dateString: string, skip: boolean) => Promise<void>;
  triggerEnergyRegen: () => Promise<void>;
  activeItemToday: ScheduledItem | null;
  nextItemToday: ScheduledItem | null;
  startRegenPodState: (activityName: string, durationMinutes: number) => Promise<void>;
  exitRegenPodState: () => Promise<void>;
  regenPodDurationMinutes: number;
}

// Create the context and export it
export const SessionContext = createContext<SessionContextType | undefined>(undefined);

// Create the useSession hook and export it
export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};