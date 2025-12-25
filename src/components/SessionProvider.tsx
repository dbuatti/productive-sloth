import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';
import { SessionContext, UserProfile } from '@/hooks/use-session';
import { showSuccess, showError } from '@/utils/toast';
import { isToday, parseISO, isPast, addMinutes, startOfDay, isBefore, addDays, addHours, setHours, setMinutes, differenceInMinutes, format } from 'date-fns';
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

const SUPABASE_PROJECT_ID = "yfgapigmiyclgryqdgne";
const SUPABASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co`;

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

  useEffect(() => {
    const interval = setInterval(() => setT_current(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
    setIsProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url, xp, level, daily_streak, last_streak_update, energy, last_daily_reward_claim, last_daily_reward_notification, last_low_energy_notification, tasks_completed_today, enable_daily_challenge_notifications, enable_low_energy_notifications, daily_challenge_target, default_auto_schedule_start_time, default_auto_schedule_end_time, enable_delete_hotkeys, enable_aethersink_backup, last_energy_regen_at, is_in_regen_pod, regen_pod_start_time')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
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
      } else {
        setProfile(null);
      }
    } catch (e) {
        console.error('Unexpected error during profile fetch:', e);
        setProfile(null);
    } finally {
        setIsProfileLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  }, [user?.id, fetchProfile]);

  const rechargeEnergy = useCallback(async (amount: number = RECHARGE_BUTTON_AMOUNT) => {
    if (!user || !profile) {
      showError("You must be logged in to recharge energy.");
      return;
    }
    const newEnergy = Math.min(MAX_ENERGY, profile.energy + amount);
    if (newEnergy === profile.energy) {
      showSuccess("Energy is already full!");
      return;
    }
    const { error } = await supabase
      .from('profiles')
      .update({ energy: newEnergy, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) {
      showError("Failed to recharge energy.");
    } else {
      await refreshProfile();
      showSuccess(`Energy recharged! +${amount} Energy`);
    }
  }, [user, profile, refreshProfile]);

  const triggerLevelUp = useCallback((level: number) => {
    setShowLevelUp(true);
    setLevelUpLevel(level);
  }, []);

  const resetLevelUp = useCallback(() => {
    setShowLevelUp(false);
    setLevelUpLevel(0);
  }, []);

  const resetDailyStreak = useCallback(async () => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ daily_streak: 0, last_streak_update: null, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      showSuccess("Daily streak reset to 0.");
    } catch (error: any) {
      showError(`Failed to reset daily streak: ${error.message}`);
    }
  }, [user, refreshProfile]);

  const claimDailyReward = useCallback(async (xpAmount: number, energyAmount: number) => {
    if (!user || !profile) return;
    const lastClaimDate = profile.last_daily_reward_claim ? parseISO(profile.last_daily_reward_claim) : null;
    if (lastClaimDate && isToday(lastClaimDate)) {
      showError("You have already claimed your daily challenge reward today!");
      return;
    }
    if (profile.tasks_completed_today < DAILY_CHALLENGE_TASKS_REQUIRED) {
      showError(`Complete ${DAILY_CHALLENGE_TASKS_REQUIRED} tasks to claim your daily challenge reward! 🎉`);
      return;
    }
    try {
      const newXp = profile.xp + xpAmount;
      const newEnergy = Math.min(MAX_ENERGY, profile.energy + energyAmount);
      const { error } = await supabase
        .from('profiles')
        .update({ xp: newXp, energy: newEnergy, last_daily_reward_claim: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      showSuccess(`Daily challenge reward claimed! +${xpAmount} XP, +${energyAmount} Energy!`);
    } catch (error: any) {
      showError(`Failed to claim daily challenge reward: ${error.message}`);
    }
  }, [user, profile, refreshProfile]);

  const updateNotificationPreferences = useCallback(async (preferences: { enable_daily_challenge_notifications?: boolean; enable_low_energy_notifications?: boolean }) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ ...preferences, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      showSuccess("Notification preferences updated!");
    } catch (error: any) {
      showError(`Failed to update notification preferences: ${error.message}`);
    }
  }, [user, refreshProfile]);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      showSuccess("Profile updated successfully!");
    } catch (error: any) {
      showError(`Failed to update profile: ${error.message}`);
    }
  }, [user, refreshProfile]);

  const updateSettings = useCallback(async (updates: Partial<UserProfile>) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      showSuccess("Settings updated successfully!");
    } catch (error: any) {
      showError(`Failed to update settings: ${error.message}`);
    }
  }, [user, refreshProfile]);

  const triggerEnergyRegen = useCallback(async () => {
    if (!user || !session?.access_token) return;
    try {
      const { error } = await supabase.functions.invoke('trigger-energy-regen', { method: 'POST', body: {} });
      if (error) throw new Error(error.message);
      await new Promise(resolve => setTimeout(resolve, 1000));
      await refreshProfile();
    } catch (e: any) {
      console.error("[EnergyRegen] Failed:", e.message);
    }
  }, [user, session?.access_token, refreshProfile]);

  const startRegenPodState = useCallback(async (durationMinutes: number) => {
    if (!user) return;
    const now = new Date();
    setRegenPodDurationMinutes(durationMinutes);
    const { error } = await supabase
      .from('profiles')
      .update({ is_in_regen_pod: true, regen_pod_start_time: now.toISOString(), updated_at: now.toISOString() })
      .eq('id', user.id);
    if (error) {
      setRegenPodDurationMinutes(0);
    } else {
      await refreshProfile();
    }
  }, [user, refreshProfile]);

  const exitRegenPodState = useCallback(async () => {
    if (!user || !profile || !profile.is_in_regen_pod || !profile.regen_pod_start_time) return;
    const podStartTime = parseISO(profile.regen_pod_start_time);
    const podEndTime = new Date();
    const durationMinutes = differenceInMinutes(podEndTime, podStartTime);
    if (durationMinutes <= 0) {
        await supabase.from('profiles').update({ is_in_regen_pod: false, regen_pod_start_time: null, updated_at: new Date().toISOString() }).eq('id', user.id);
        await refreshProfile();
        return;
    }
    try {
        const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/calculate-pod-exit`;
        const response = await fetch(edgeFunctionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
            body: JSON.stringify({ startTime: profile.regen_pod_start_time, endTime: podEndTime.toISOString() }),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to process Pod exit via Edge Function');
        }
        const data = await response.json();
        showSuccess(`Pod exited. +${data.energyGained}⚡ gained over ${data.durationMinutes} minutes!`);
    } catch (error: any) {
        showError(`Failed to calculate Pod energy: ${error.message}`);
    } finally {
        await supabase.from('profiles').update({ is_in_regen_pod: false, regen_pod_start_time: null, updated_at: new Date().toISOString() }).eq('id', user.id);
        await refreshProfile();
        setRegenPodDurationMinutes(0);
    }
  }, [user, profile, refreshProfile, session?.access_token]);

  // Main useEffect for auth state changes and initial session load
  useEffect(() => {
    const handleAuthChange = async (event: string, currentSession: Session | null) => {
      console.log(`[SessionProvider] Auth Event: ${event}`);
      const newUserId = currentSession?.user?.id ?? null;
      const oldUserId = user?.id ?? null;

      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (newUserId && newUserId !== oldUserId) {
          await fetchProfile(newUserId);
        }
        // If there's a session, redirect to '/' if not already there
        if (currentSession && location.pathname !== '/') {
            setRedirectPath('/');
        }
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        queryClient.clear();
        // If there's no session, redirect to '/login' if not already there
        if (!currentSession && location.pathname !== '/login') {
            setRedirectPath('/login');
        }
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
          // If there's an initial session, redirect to '/' if not already there
          if (location.pathname !== '/') {
            setRedirectPath('/');
          }
        } else {
          // If no initial session, redirect to '/login' if not already there
          if (location.pathname !== '/login') {
            setRedirectPath('/login');
          }
        }
      } catch (error) {
        console.error("Error during initial session load:", error);
        // On error, redirect to '/login' if not already there
        if (location.pathname !== '/login') {
          setRedirectPath('/login');
        }
      } finally {
        setIsAuthLoading(false);
      }
    };

    loadInitialSession();

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [fetchProfile, queryClient, location.pathname]); // Added location.pathname to dependencies

  // Dedicated useEffect for handling redirection
  useEffect(() => {
    if (redirectPath && location.pathname !== redirectPath) {
      console.log(`[SessionProvider] Navigating to: ${redirectPath}`);
      navigate(redirectPath, { replace: true });
      setRedirectPath(null); // Clear redirect path after navigation
    }
  }, [redirectPath, navigate, location.pathname]);

  // Separate useEffect for profile refresh when user changes
  useEffect(() => {
    if (user?.id && !profile) {
      fetchProfile(user.id);
    } else if (!user) {
      setProfile(null);
    }
  }, [user?.id, profile, fetchProfile]);

  // Daily Reset Logic
  useEffect(() => {
    if (!user || !profile) return;
    const now = new Date();
    const lastRewardClaim = profile.last_daily_reward_claim ? parseISO(profile.last_daily_reward_claim) : null;
    const lastStreakUpdate = profile.last_streak_update ? parseISO(profile.last_streak_update) : null;
    const shouldResetTasksCompletedToday = (!lastRewardClaim || !isToday(lastRewardClaim)) && (!lastStreakUpdate || !isToday(lastStreakUpdate));
    if (shouldResetTasksCompletedToday && profile.tasks_completed_today > 0) {
      supabase.from('profiles').update({ tasks_completed_today: 0 }).eq('id', user.id).then(({ error }) => {
        if (error) console.error("Failed to reset tasks_completed_today:", error.message);
        else refreshProfile();
      });
    }
    const lastRewardNotification = profile.last_daily_reward_notification ? parseISO(profile.last_daily_reward_notification) : null;
    const canNotifyDailyChallenge = profile.enable_daily_challenge_notifications && (!lastRewardClaim || !isToday(lastRewardClaim)) && (!lastRewardNotification || !isToday(lastRewardNotification));
    if (canNotifyDailyChallenge) {
      showSuccess(`Your daily challenge is ready! Complete ${DAILY_CHALLENGE_TASKS_REQUIRED} tasks to claim your reward! 🎉`);
      supabase.from('profiles').update({ last_daily_reward_notification: now.toISOString() }).eq('id', user.id).then(({ error }) => {
        if (error) console.error("Failed to update last_daily_reward_notification:", error.message);
        else refreshProfile();
      });
    }
    const lastLowEnergyNotification = profile.last_low_energy_notification ? parseISO(profile.last_low_energy_notification) : null;
    const canNotifyLowEnergy = profile.enable_low_energy_notifications && profile.energy <= LOW_ENERGY_THRESHOLD && (!lastLowEnergyNotification || isPast(addMinutes(lastLowEnergyNotification, LOW_ENERGY_NOTIFICATION_COOLDOWN_MINUTES)));
    if (canNotifyLowEnergy) {
      showError(`Energy is low (${profile.energy}%)! Recharge to keep completing tasks. ⚡`);
      supabase.from('profiles').update({ last_low_energy_notification: now.toISOString() }).eq('id', user.id).then(({ error }) => {
        if (error) console.error("Failed to update last_low_energy_notification:", error.message);
        else refreshProfile();
      });
    }
  }, [user, profile, refreshProfile]);

  // Fetch scheduled tasks for TODAY
  const { data: dbScheduledTasksToday = [] } = useQuery<DBScheduledTask[]>({
    queryKey: ['scheduledTasksToday', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const todayString = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('scheduled_tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('scheduled_date', todayString)
        .order('start_time', { ascending: true });
      if (error) throw new Error(error.message);
      return data as DBScheduledTask[];
    },
    enabled: !!user?.id && !!profile,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const workdayStartTimeToday = useMemo(() => profile?.default_auto_schedule_start_time 
    ? setTimeOnDate(startOfDay(T_current), profile.default_auto_schedule_start_time) 
    : startOfDay(T_current), [profile?.default_auto_schedule_start_time, T_current]);
  
  let workdayEndTimeToday = useMemo(() => profile?.default_auto_schedule_end_time 
    ? setTimeOnDate(startOfDay(T_current), profile.default_auto_schedule_end_time) 
    : addHours(startOfDay(T_current), 17), [profile?.default_auto_schedule_end_time, T_current]);

  workdayEndTimeToday = useMemo(() => {
    if (isBefore(workdayEndTimeToday, workdayStartTimeToday)) {
      return addDays(workdayEndTimeToday, 1);
    }
    return workdayEndTimeToday;
  }, [workdayEndTimeToday, workdayStartTimeToday]);

  const calculatedScheduleToday = useMemo(() => {
    if (!profile || !dbScheduledTasksToday) return null;
    const todayString = format(new Date(), 'yyyy-MM-dd');
    return calculateSchedule(
      dbScheduledTasksToday, 
      todayString, 
      workdayStartTimeToday, 
      workdayEndTimeToday,
      profile.is_in_regen_pod,
      profile.regen_pod_start_time ? parseISO(profile.regen_pod_start_time) : null,
      regenPodDurationMinutes,
      T_current
    );
  }, [dbScheduledTasksToday, profile, workdayStartTimeToday, workdayEndTimeToday, regenPodDurationMinutes, T_current]);

  const activeItemToday: ScheduledItem | null = useMemo(() => {
    if (!calculatedScheduleToday) return null;
    for (const item of calculatedScheduleToday.items) {
      if ((item.type === 'task' || item.type === 'break' || item.type === 'time-off' || item.type === 'meal' || item.type === 'calendar-event') && T_current >= item.startTime && T_current < item.endTime) {
        return item;
      }
    }
    return null;
  }, [calculatedScheduleToday, T_current]);

  const nextItemToday: ScheduledItem | null = useMemo(() => {
    if (!calculatedScheduleToday) return null;
    const startIndex = calculatedScheduleToday.items.findIndex(item => item.startTime > T_current);
    if (startIndex === -1) return null;
    const potentialNextItems = calculatedScheduleToday.items.slice(startIndex);
    if (selectedEnvironments.length > 0) {
        const nextMatchingItem = potentialNextItems.find(item => 
            (item.type === 'task' && selectedEnvironments.includes(item.taskEnvironment)) || 
            item.type === 'break' || 
            item.type === 'time-off' ||
            item.type === 'meal' ||
            item.type === 'calendar-event'
        );
        if (nextMatchingItem) return nextMatchingItem;
    }
    const nextAnyItem = potentialNextItems.find(item => item.type === 'task' || item.type === 'break' || item.type === 'time-off' || item.type === 'meal' || item.type === 'calendar-event');
    return nextAnyItem || null;
  }, [calculatedScheduleToday, T_current, selectedEnvironments]);

  return (
    <SessionContext.Provider value={{ 
      session, 
      user, 
      profile, 
      isLoading, 
      refreshProfile, 
      rechargeEnergy,
      showLevelUp,
      levelUpLevel,
      triggerLevelUp,
      resetLevelUp,
      resetDailyStreak,
      claimDailyReward,
      updateNotificationPreferences,
      updateProfile,
      updateSettings,
      activeItemToday,
      nextItemToday,
      T_current,
      startRegenPodState,
      exitRegenPodState,
      regenPodDurationMinutes,
      triggerEnergyRegen,
    }}>
      {children}
    </SessionContext.Provider>
  );
};