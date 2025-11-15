import React, { useContext } from 'react';
import { Session, User } from '@supabase/supabase-js';

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
}

export const SessionContext = React.createContext<SessionContextType | undefined>(undefined);

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionContextProvider');
  }
  return context;
};