import React, { useState, useEffect, useCallback, useMemo, useRef, createContext, useContext } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';
import { showSuccess, showError } from '@/utils/toast';
import { isToday, parseISO, isPast, addMinutes, startOfDay, isBefore, addDays, addHours, differenceInMinutes, format } from 'date-fns';
import { 
  MAX_ENERGY, 
  RECHARGE_BUTTON_AMOUNT, 
  LOW_ENERGY_THRESHOLD, 
  LOW_ENERGY_NOTIFICATION_COOLDOWN_MINUTES,
  DAILY_CHALLENGE_TASKS_REQUIRED,
  REGEN_POD_MAX_DURATION_MINUTES,
} from '@/lib/constants';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DBScheduledTask, ScheduledItem } from '@/types/scheduler';
import { calculateSchedule, setTimeOnDate } from '@/lib/scheduler-utils';
import { useEnvironmentContext } from '@/hooks/use-environment-context';
import { MealAssignment } from '@/hooks/use-meals';

const SUPABASE_PROJECT_ID = "yfgapigmiyclgryqdgne";
const SUPABASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co`;

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
  enable_environment_chunking: boolean;
  enable_macro_spread: boolean;
  reflection_count: number;
  reflection_times: string[];
  reflection_durations: number[];
  week_starts_on: number;
  num_days_visible: number;
  vertical_zoom_index: number;
  is_dashboard_collapsed: boolean;
  is_action_center_collapsed: boolean;
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

export const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionContextProvider');
  }
  return context;
};

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpLevel, setLevelUpLevel] = useState(0);
  const [T_current, setT_current] = useState(new Date());
  const [regenPodDurationMinutes, setRegenPodDurationMinutes] = useState(0);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { selectedEnvironments } = useEnvironmentContext();
  const initialSessionLoadedRef = useRef(false);

  const isLoading = isAuthLoading || isProfileLoading;
  const todayString = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    const interval = setInterval(() => setT_current(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
    setIsProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id, first_name, last_name, avatar_url, xp, level, daily_streak, 
          last_streak_update, energy, last_daily_reward_claim, 
          last_daily_reward_notification, last_low_energy_notification, 
          tasks_completed_today, enable_daily_challenge_notifications, 
          enable_low_energy_notifications, daily_challenge_target, 
          default_auto_schedule_start_time, default_auto_schedule_end_time, 
          enable_delete_hotkeys, enable_aethersink_backup, last_energy_regen_at, 
          is_in_regen_pod, regen_pod_start_time, breakfast_time, lunch_time, 
          dinner_time, breakfast_duration_minutes, lunch_duration_minutes, 
          dinner_duration_minutes, reflection_count, 
          reflection_times, reflection_durations, enable_environment_chunking, 
          enable_macro_spread, week_starts_on, num_days_visible, vertical_zoom_index,
          is_dashboard_collapsed, is_action_center_collapsed
        `)
        .eq('id', userId)
        .single();

      if (error) {
        setProfile(null);
      } else if (data) {
        setProfile(data as UserProfile);
        if (data.is_in_regen_pod && data.regen_pod_start_time) {
            const start = parseISO(data.regen_pod_start_time);
            const elapsed = differenceInMinutes(new Date(), start);
            const remaining = REGEN_POD_MAX_DURATION_MINUTES - elapsed;
            setRegenPodDurationMinutes(Math.max(0, remaining));
        } else {
            setRegenPodDurationMinutes(0);
        }
      }
    } catch (e) {
        setProfile(null);
    } finally {
        setIsProfileLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) await fetchProfile(user.id);
  }, [user?.id, fetchProfile]);

  const rechargeEnergy = useCallback(async (amount: number = RECHARGE_BUTTON_AMOUNT) => {
    if (!user || !profile) return;
    const newEnergy = Math.min(MAX_ENERGY, profile.energy + amount);
    const { error } = await supabase.from('profiles').update({ energy: newEnergy }).eq('id', user.id);
    if (!error) await refreshProfile();
  }, [user, profile, refreshProfile]);

  const triggerLevelUp = useCallback((level: number) => { setShowLevelUp(true); setLevelUpLevel(level); }, []);
  const resetLevelUp = useCallback(() => { setShowLevelUp(false); setLevelUpLevel(0); }, []);

  const resetDailyStreak = useCallback(async () => {
    if (!user) return;
    const { error } = await supabase.from('profiles').update({ daily_streak: 0, last_streak_update: null }).eq('id', user.id);
    if (!error) await refreshProfile();
  }, [user, refreshProfile]);

  const claimDailyReward = useCallback(async (xpAmount: number, energyAmount: number) => {
    if (!user || !profile) return;
    const newXp = profile.xp + xpAmount;
    const newEnergy = Math.min(MAX_ENERGY, profile.energy + energyAmount);
    const { error } = await supabase.from('profiles').update({ 
      xp: newXp, 
      energy: newEnergy, 
      last_daily_reward_claim: new Date().toISOString() 
    }).eq('id', user.id);
    if (!error) {
      await refreshProfile();
      showSuccess("Reward claimed!");
    }
  }, [user, profile, refreshProfile]);

  const updateNotificationPreferences = useCallback(async (preferences: any) => {
    if (!user) return;
    const { error } = await supabase.from('profiles').update(preferences).eq('id', user.id);
    if (!error) await refreshProfile();
  }, [user, refreshProfile]);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!user) return;
    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
    if (!error) await refreshProfile();
  }, [user, refreshProfile]);

  const updateSettings = useCallback(async (updates: Partial<UserProfile>) => {
    if (!user) return;
    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
    if (!error) await refreshProfile();
  }, [user, refreshProfile]);

  const triggerEnergyRegen = useCallback(async () => {
    if (!user) return;
    await supabase.functions.invoke('trigger-energy-regen');
    await refreshProfile();
  }, [user, refreshProfile]);

  const startRegenPodState = useCallback(async (durationMinutes: number) => {
    if (!user) return;
    setRegenPodDurationMinutes(durationMinutes);
    await supabase.from('profiles').update({ is_in_regen_pod: true, regen_pod_start_time: new Date().toISOString() }).eq('id', user.id);
    await refreshProfile();
  }, [user, refreshProfile]);

  const exitRegenPodState = useCallback(async () => {
    if (!user || !profile?.is_in_regen_pod) return;
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/calculate-pod-exit`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ startTime: profile.regen_pod_start_time, endTime: new Date().toISOString() }),
      });
    } finally {
      await supabase.from('profiles').update({ is_in_regen_pod: false, regen_pod_start_time: null }).eq('id', user.id);
      await refreshProfile();
      setRegenPodDurationMinutes(0);
    }
  }, [user, profile, refreshProfile, session?.access_token]);

  useEffect(() => {
    const handleAuthChange = async (event: string, currentSession: Session | null) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (currentSession?.user) {
        await fetchProfile(currentSession.user.id);
        if (location.pathname === '/login') setRedirectPath('/');
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        queryClient.clear();
        setRedirectPath('/login');
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((event, currentSession) => {
      handleAuthChange(event, currentSession);
    });

    const loadInitialSession = async () => {
      if (initialSessionLoadedRef.current) return;
      initialSessionLoadedRef.current = true;
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        if (initialSession?.user) {
          await fetchProfile(initialSession.user.id);
          if (location.pathname === '/login') setRedirectPath('/');
        } else if (location.pathname !== '/login') {
          setRedirectPath('/login');
        }
      } finally {
        setIsAuthLoading(false);
      }
    };

    loadInitialSession();
    return () => authListener.subscription.unsubscribe();
  }, [fetchProfile, queryClient, location.pathname]);

  useEffect(() => {
    if (!isAuthLoading && redirectPath && location.pathname !== redirectPath) {
      navigate(redirectPath, { replace: true });
      setRedirectPath(null);
    }
  }, [redirectPath, navigate, location.pathname, isAuthLoading]);

  const { data: dbScheduledTasksToday = [] } = useQuery<DBScheduledTask[]>({
    queryKey: ['scheduledTasksToday', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase.from('scheduled_tasks').select('*')
        .eq('user_id', user.id).eq('scheduled_date', todayString);
      return data as DBScheduledTask[];
    },
    enabled: !!user?.id && !isAuthLoading,
  });
  
  const { data: mealAssignmentsToday = [] } = useQuery<MealAssignment[]>({
    queryKey: ['mealAssignmentsToday', user?.id, todayString],
    queryFn: async () => {
      if (!user?.id || !todayString) return [];
      const { data, error } = await supabase
        .from('meal_assignments')
        .select('*, meal_idea:meal_ideas(*)')
        .eq('assigned_date', todayString)
        .eq('user_id', user.id);
      if (error) throw error;
      return data as MealAssignment[];
    },
    enabled: !!user?.id && !isAuthLoading,
  });

  const calculatedScheduleToday = useMemo(() => {
    if (!profile) return null;
    const start = profile.default_auto_schedule_start_time ? setTimeOnDate(startOfDay(T_current), profile.default_auto_schedule_start_time) : startOfDay(T_current);
    let end = profile.default_auto_schedule_end_time ? setTimeOnDate(startOfDay(T_current), profile.default_auto_schedule_end_time) : addHours(startOfDay(T_current), 17);
    if (isBefore(end, start)) end = addDays(end, 1);
    return calculateSchedule(
      dbScheduledTasksToday, 
      todayString, 
      start, 
      end, 
      profile.is_in_regen_pod, 
      profile.regen_pod_start_time ? parseISO(profile.regen_pod_start_time) : null, 
      regenPodDurationMinutes, 
      T_current, 
      profile.breakfast_time, 
      profile.lunch_time, 
      profile.dinner_time,
      profile.breakfast_duration_minutes,
      profile.lunch_duration_minutes,
      profile.dinner_duration_minutes,
      profile.reflection_count,
      profile.reflection_times,
      profile.reflection_durations,
      mealAssignmentsToday
    );
  }, [dbScheduledTasksToday, profile, regenPodDurationMinutes, T_current, mealAssignmentsToday, todayString]);

  const activeItemToday = useMemo(() => calculatedScheduleToday?.items.find(i => T_current >= i.startTime && T_current < i.endTime) || null, [calculatedScheduleToday, T_current]);
  const nextItemToday = useMemo(() => calculatedScheduleToday?.items.find(i => i.startTime > T_current) || null, [calculatedScheduleToday, T_current]);

  return (
    <SessionContext.Provider value={{ 
      session, user, profile, isLoading, refreshProfile, rechargeEnergy,
      showLevelUp, levelUpLevel, triggerLevelUp, resetLevelUp,
      resetDailyStreak, claimDailyReward, updateNotificationPreferences,
      updateProfile, updateSettings, triggerEnergyRegen,
      activeItemToday, nextItemToday, T_current,
      startRegenPodState, exitRegenPodState, regenPodDurationMinutes
    }}>
      {!isAuthLoading ? children : null}
    </SessionContext.Provider>
  );
};