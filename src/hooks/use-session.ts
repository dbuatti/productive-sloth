import React, { useContext } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { ScheduledItem, TaskEnvironment } from '@/types/scheduler'; // Import TaskEnvironment

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
  custom_environment_order: TaskEnvironment[] | null; // NEW: Custom order for environment sorting
}

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
  updateNotificationPreferences: (preferences: { enable_daily_challenge_notifications?: boolean; enable_low_energy_notifications?: boolean }) => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  updateSettings: (updates: Partial<UserProfile>) => Promise<void>;
  activeItemToday: ScheduledItem | null;
  nextItemToday: ScheduledItem | null;
  T_current: Date;
  startRegenPodState: (durationMinutes: number) => Promise<void>;
  exitRegenPodState: () => Promise<void>;
  regenPodDurationMinutes: number;
  triggerEnergyRegen: () => Promise<void>;
}

export const SessionContext = React.createContext<SessionContextType | undefined>(undefined);

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionContextProvider');
  }
  return context;
};