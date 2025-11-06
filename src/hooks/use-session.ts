import React, { useContext } from 'react';
import { Session, User } from '@supabase/supabase-js';

// Define a type for the user profile
export interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  xp: number; // Added XP
  level: number; // Added Level
  daily_streak: number; // Added daily streak
  last_streak_update: string | null; // Added last streak update timestamp
  energy: number; // Added energy
  last_daily_reward_claim: string | null; // Added last_daily_reward_claim
  last_daily_reward_notification: string | null; // Added last_daily_reward_notification
  last_low_energy_notification: string | null; // Added last_low_energy_notification
  tasks_completed_today: number; // Added tasks_completed_today
}

interface SessionContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null; // Add profile to context
  isLoading: boolean;
  refreshProfile: () => Promise<void>; // Add a function to refresh profile
  rechargeEnergy: (amount?: number) => Promise<void>; // Added rechargeEnergy function
  showLevelUp: boolean; // Added state for level up celebration
  levelUpLevel: number; // Added state for the level achieved
  triggerLevelUp: (level: number) => void; // Added function to trigger level up
  resetLevelUp: () => void; // Added function to reset level up state
  resetDailyStreak: () => Promise<void>; // Added resetDailyStreak function
  claimDailyReward: (xpAmount: number, energyAmount: number) => Promise<void>; // Added claimDailyReward function
}

export const SessionContext = React.createContext<SessionContextType | undefined>(undefined);

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionContextProvider');
  }
  return context;
};