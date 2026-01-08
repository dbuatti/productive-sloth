import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';
import { SessionContext, UserProfile } from '@/hooks/use-session';
import { showSuccess, showError } from '@/utils/toast';
import { isToday, parseISO, isPast, addMinutes, startOfDay, isBefore, addDays, addHours, differenceInMinutes, format } from 'date-fns';
import { MAX_ENERGY, RECHARGE_BUTTON_AMOUNT, LOW_ENERGY_THRESHOLD, LOW_ENERGY_NOTIFICATION_COOLDOWN_MINUTES, DAILY_CHALLENGE_TASKS_REQUIRED, REGEN_POD_MAX_DURATION_MINUTES, } from '@/lib/constants';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DBScheduledTask, ScheduledItem } from '@/types/scheduler';
import { calculateSchedule, setTimeOnDate } from '@/lib/scheduler-utils';
import { useEnvironmentContext } from '@/hooks/use-environment-context.ts';
import { MealAssignment } from '@/hooks/use-meals';
import isEqual from 'lodash.isequal'; // Import isEqual for deep comparison

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
  const isLoading = isAuthLoading || isProfileLoading;
  const todayString = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    const interval = setInterval(() => setT_current(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Use a ref to hold the latest profile for deep comparison in useCallback
  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const fetchProfile = useCallback(async (userId: string) => {
    setIsProfileLoading(true);
    try {
      let { data: profileData, error: fetchError } = await supabase
        .from('profiles')
        .select(`
          id, first_name, last_name, avatar_url, xp, level, daily_streak, last_streak_update, energy, 
          last_daily_reward_claim, last_daily_reward_notification, last_low_energy_notification, 
          tasks_completed_today, enable_daily_challenge_notifications, enable_low_energy_notifications, 
          daily_challenge_target, default_auto_schedule_start_time, default_auto_schedule_end_time, 
          enable_delete_hotkeys, enable_aethersink_backup, last_energy_regen_at, is_in_regen_pod, 
          regen_pod_start_time, breakfast_time, lunch_time, dinner_time, breakfast_duration_minutes, 
          lunch_duration_minutes, dinner_duration_minutes, custom_environment_order, reflection_count, 
          reflection_times, reflection_durations, enable_environment_chunking, enable_macro_spread, 
          week_starts_on, num_days_visible, vertical_zoom_index, is_dashboard_collapsed, 
          is_action_center_collapsed, blocked_days, updated_at
        `)
        .eq('id', userId)
        .single();

      if (fetchError && fetchError.code === 'PGRST116') { // PGRST116 means no rows found
        console.warn("[SessionProvider] Profile not found for user, attempting to create a new one.");
        const { data: newProfileData, error: insertError } = await supabase
          .from('profiles')
          .insert({ 
            id: userId, 
            first_name: user?.user_metadata?.first_name || null, 
            last_name: user?.user_metadata?.last_name || null 
          })
          .select(`
            id, first_name, last_name, avatar_url, xp, level, daily_streak, last_streak_update, energy, 
            last_daily_reward_claim, last_daily_reward_notification, last_low_energy_notification, 
            tasks_completed_today, enable_daily_challenge_notifications, enable_low_energy_notifications, 
            daily_challenge_target, default_auto_schedule_start_time, default_auto_schedule_end_time, 
            enable_delete_hotkeys, enable_aethersink_backup, last_energy_regen_at, is_in_regen_pod, 
            regen_pod_start_time, breakfast_time, lunch_time, dinner_time, breakfast_duration_minutes, 
            lunch_duration_minutes, dinner_duration_minutes, custom_environment_order, reflection_count, 
            reflection_times, reflection_durations, enable_environment_chunking, enable_macro_spread, 
            week_starts_on, num_days_visible, vertical_zoom_index, is_dashboard_collapsed, 
            is_action_center_collapsed, blocked_days, updated_at
          `)
          .single();
        
        if (insertError) {
          console.error("[SessionProvider] Error creating profile:", insertError.message);
          setProfile(null);
          showError("Failed to create user profile.");
        } else if (newProfileData) {
          setProfile(newProfileData as UserProfile);
          showSuccess("New user profile created!");
        }
      } else if (fetchError) {
        console.error("[SessionProvider] Error fetching profile:", fetchError.message);
        setProfile(null);
        showError("Failed to load user profile.");
      } else if (profileData) {
        // Create a copy of data without 'updated_at' for comparison
        const dataWithoutUpdatedAt = { ...profileData };
        delete dataWithoutUpdatedAt.updated_at;

        const currentProfileWithoutUpdatedAt = profileRef.current ? { ...profileRef.current } : null;
        if (currentProfileWithoutUpdatedAt) delete currentProfileWithoutUpdatedAt.updated_at;

        // Only update profile state if there's a meaningful change (excluding updated_at)
        if (!isEqual(currentProfileWithoutUpdatedAt, dataWithoutUpdatedAt)) {
          setProfile(profileData as UserProfile); // Still set the full profile with updated_at
        }
        if (profileData.is_in_regen_pod && profileData.regen_pod_start_time) {
          const start = parseISO(profileData.regen_pod_start_time);
          const elapsed = differenceInMinutes(new Date(), start);
          const remaining = REGEN_POD_MAX_DURATION_MINUTES - elapsed;
          setRegenPodDurationMinutes(Math.max(0, remaining));
        } else {
          setRegenPodDurationMinutes(0);
        }
      }
    } catch (e: any) {
      console.error("[SessionProvider] Unexpected error in fetchProfile:", e.message);
      setProfile(null);
      showError("An unexpected error occurred while loading profile.");
    } finally {
      setIsProfileLoading(false);
    }
  }, [user]); // Added `user` to dependencies because `user?.user_metadata` is used.

  const refreshProfile = useCallback(async () => {
    if (user?.id) await fetchProfile(user.id);
  }, [user?.id, fetchProfile]);

  const rechargeEnergy = useCallback(async (amount: number = RECHARGE_BUTTON_AMOUNT) => {
    if (!user || !profile) return;
    const newEnergy = Math.min(MAX_ENERGY, profile.energy + amount);
    const { error } = await supabase.from('profiles').update({ energy: newEnergy }).eq('id', user.id);
    if (!error) await refreshProfile();
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
    const { error } = await supabase.from('profiles').update({ daily_streak: 0, last_streak_update: null }).eq('id', user.id);
    if (!error) await refreshProfile();
  }, [user, refreshProfile]);

  const claimDailyReward = useCallback(async (xpAmount: number, energyAmount: number) => {
    if (!user || !profile) return;
    const newXp = profile.xp + xpAmount;
    const newEnergy = Math.min(MAX_ENERGY, profile.energy + energyAmount);
    const { error } = await supabase.from('profiles').update({ xp: newXp, energy: newEnergy, last_daily_reward_claim: new Date().toISOString() }).eq('id', user.id);
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

  const updateBlockedDays = useCallback(async (dateString: string, isBlocked: boolean) => {
    if (!user || !profile) return;
    let newBlockedDays = profile.blocked_days ? [...profile.blocked_days] : [];

    if (isBlocked) {
      if (!newBlockedDays.includes(dateString)) {
        newBlockedDays.push(dateString);
      }
    } else {
      newBlockedDays = newBlockedDays.filter(day => day !== dateString);
    }

    try {
      await supabase.from('profiles').update({ blocked_days: newBlockedDays }).eq('id', user.id);
      await refreshProfile();
      showSuccess(isBlocked ? `Day ${dateString} blocked.` : `Day ${dateString} unblocked.`);
    } catch (error: any) {
      showError(`Failed to update blocked days: ${error.message}`);
    }
  }, [user, profile, refreshProfile]);

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
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          startTime: profile.regen_pod_start_time,
          endTime: new Date().toISOString()
        }),
      });
    } finally {
      await supabase.from('profiles').update({ is_in_regen_pod: false, regen_pod_start_time: null }).eq('id', user.id);
      await refreshProfile();
      setRegenPodDurationMinutes(0);
    }
  }, [user, profile, refreshProfile, session?.access_token]);

  // MODIFIED: Streamlined auth state handling
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log("[SessionProvider] Auth state change event:", event);
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setIsAuthLoading(false); // Auth is no longer loading after the first event

      if (currentSession?.user) {
        await fetchProfile(currentSession.user.id);
        // If we are on the login page and a user signs in, redirect to home
        if (location.pathname === '/login') {
          setRedirectPath('/');
        }
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        queryClient.clear();
        setRedirectPath('/login');
      } else if (event === 'INITIAL_SESSION' && !currentSession?.user && location.pathname !== '/login') {
        // If it's an initial session and no user, and not already on login page, redirect to login
        setRedirectPath('/login');
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [fetchProfile, queryClient, navigate, location.pathname, user]); // Added user to dependencies for fetchProfile

  // Effect to handle redirection
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

  // NEW: Fetch meal assignments for today
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

    const isDayBlocked = profile?.blocked_days?.includes(todayString) ?? false;

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
      mealAssignmentsToday, // PASS MEAL ASSIGNMENTS
      isDayBlocked // Pass isDayBlocked
    );
  }, [dbScheduledTasksToday, profile, regenPodDurationMinutes, T_current, mealAssignmentsToday, todayString]);

  const activeItemToday = useMemo(() => calculatedScheduleToday?.items.find(i => T_current >= i.startTime && T_current < i.endTime) || null, [calculatedScheduleToday, T_current]);

  const nextItemToday = useMemo(() => calculatedScheduleToday?.items.find(i => i.startTime > T_current) || null, [calculatedScheduleToday, T_current]);

  const contextValue = useMemo(() => ({
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
    updateBlockedDays, // NEW: Add updateBlockedDays to context
    triggerEnergyRegen,
    activeItemToday,
    nextItemToday,
    T_current,
    startRegenPodState,
    exitRegenPodState,
    regenPodDurationMinutes
  }), [
    session, user, profile, isLoading, refreshProfile, rechargeEnergy, showLevelUp, levelUpLevel, 
    triggerLevelUp, resetLevelUp, resetDailyStreak, claimDailyReward, updateNotificationPreferences, 
    updateProfile, updateSettings, updateBlockedDays, triggerEnergyRegen, activeItemToday, nextItemToday, T_current, 
    startRegenPodState, exitRegenPodState, regenPodDurationMinutes
  ]);

  return (
    <SessionContext.Provider value={contextValue}>
      {!isAuthLoading ? children : null}
    </SessionContext.Provider>
  );
};