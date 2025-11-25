import React, { useContext } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { ScheduledItem } from '@/types/scheduler'; // Import ScheduledItem

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
  enable_aethersink_backup: boolean; // NEW: Added for Aether Sink backup preference
  last_energy_regen_at: string | null; // NEW: Added for energy regeneration tracking
  is_in_regen_pod: boolean; // NEW: Is user currently in a regen pod session
  regen_pod_start_time: string | null; // NEW: Timestamp when pod started
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
  startRegenPodState: (durationMinutes: number) => Promise<void>; // NEW
  exitRegenPodState: () => Promise<void>; // NEW
  regenPodDurationMinutes: number; // NEW: Duration calculated on start
}

export const SessionContext = React.createContext<SessionContextType | undefined>(undefined);

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionContextProvider');
  }
  return context;
};