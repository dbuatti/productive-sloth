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
}

export const SessionContext = React.createContext<SessionContextType | undefined>(undefined);

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionContextProvider');
  }
  return context;
};