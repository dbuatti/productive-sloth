import React, { createContext, useContext, ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DBScheduledTask, ScheduledItem } from '@/types/scheduler';
import { calculateSchedule, setTimeOnDate } from '@/lib/scheduler-utils';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, isSameDay, addMinutes } from 'date-fns';

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  updated_at: string | null;
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
  enable_delete_hotkeys: boolean | null;
  enable_aethersink_backup: boolean;
  last_energy_regen_at: string | null;
  is_in_regen_pod: boolean;
  regen_pod_start_time: string | null;
  journey_start_date: string | null;
  last_active_at: string | null;
  timezone: string | null;
}

interface SessionContextType {
  user: any;
  profile: Profile | null;
  isLoading: boolean;
  session: any;
  T_current: Date;
  activeItemToday: ScheduledItem | null;
  nextItemToday: ScheduledItem | null;
  refreshProfile: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};

interface SessionProviderProps {
  children: ReactNode;
}

export const SessionProvider: React.FC<SessionProviderProps> = ({ children }) => {
  // This is a simplified implementation
  // In a real app, this would integrate with Supabase auth
  
  const T_current = new Date();
  
  return (
    <SessionContext.Provider
      value={{
        user: null,
        profile: null,
        isLoading: false,
        session: null,
        T_current,
        activeItemToday: null,
        nextItemToday: null,
        refreshProfile: async () => {},
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};