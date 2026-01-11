import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';
import { SessionContext, UserProfile } from '@/hooks/use-session';
import { showSuccess, showError } from '@/utils/toast';
import { isToday, parseISO, isPast, addMinutes, startOfDay, isBefore, addDays, addHours, differenceInMinutes, format } from 'date-fns';
import { MAX_ENERGY, RECHARGE_BUTTON_AMOUNT, LOW_ENERGY_THRESHOLD, LOW_ENERGY_NOTIFICATION_COOLDOWN_MINUTES, DAILY_CHALLENGE_TASKS_REQUIRED, REGEN_POD_MAX_DURATION_MINUTES, } from '@/lib/constants';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DBScheduledTask, ScheduledItem, CompletedTaskLogEntry } from '@/types/scheduler';
import { calculateSchedule, setTimeOnDate } from '@/lib/scheduler-utils';
import { MealAssignment } from '@/hooks/use-meals';
import isEqual from 'lodash.isequal';

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
  const [regenPodDurationMinutes, setRegenPodDurationMinutes] = useState(0);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const initialSessionLoadedRef = useRef(false);
  const isLoading = isAuthLoading || isProfileLoading;
  const todayString = format(new Date(), 'yyyy-MM-dd');

  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  // NEW: Local state for derived active items, updated only if content changes
  const [activeItemToday, setActiveItemToday] = useState<ScheduledItem | null>(null);
  const [nextItemToday, setNextItemToday] = useState<ScheduledItem | null>(null);


  const fetchProfile = useCallback(async (userId: string) => {
    setIsProfileLoading(true);
    console.log(`[SessionProvider] Fetching profile for user: ${userId}`);
    try {
      const { data, error } = await supabase
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
          is_action_center_collapsed, blocked_days, updated_at, neurodivergent_mode, skipped_day_off_suggestions,
          timezone
        `)
        .eq('id', userId)
        .single();

      if (error) {
        console.error("[SessionProvider] fetchProfile error:", error);
        setProfile(null);
      } else if (data) {
        const profileDataWithDefaultTimezone = { ...data, timezone: data.timezone || 'UTC' };
        // Remove 'updated_at' from comparison as it changes frequently and shouldn't trigger a full profile re-render
        const dataWithoutUpdatedAt = { ...profileDataWithDefaultTimezone };
        delete dataWithoutUpdatedAt.updated_at;

        const currentProfileWithoutUpdatedAt = profileRef.current ? { ...profileRef.current } : null;
        if (currentProfileWithoutUpdatedAt) delete currentProfileWithoutUpdatedAt.updated_at;

        // CRITICAL FIX: Use lodash isEqual for deep comparison to prevent unnecessary state updates
        if (!isEqual(currentProfileWithoutUpdatedAt, dataWithoutUpdatedAt)) {
          console.log("[SessionProvider] Profile data changed, updating state.");
          setProfile(profileDataWithDefaultTimezone as UserProfile);
        } else {
           console.log("[SessionProvider] Profile data unchanged, skipping update.");
        }
        
        if (profileDataWithDefaultTimezone.is_in_regen_pod && profileDataWithDefaultTimezone.regen_pod_start_time) {
          const start = parseISO(profileDataWithDefaultTimezone.regen_pod_start_time);
          const elapsed = differenceInMinutes(new Date(), start);
          const remaining = REGEN_POD_MAX_DURATION_MINUTES - elapsed;
          setRegenPodDurationMinutes(Math.max(0, remaining));
        } else {
          setRegenPodDurationMinutes(0);
        }
      }
    } catch (e) {
      console.error("[SessionProvider] fetchProfile Exception:", e);
      setProfile(null);
    } finally {
      setIsProfileLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      console.log("[SessionProvider] Refreshing profile...");
      await fetchProfile(user.id);
    }
  }, [user?.id, fetchProfile]);

  const rechargeEnergy = useCallback(async (amount: number = RECHARGE_BUTTON_AMOUNT) => {
    if (!user || !profile) return;
    console.log(`[SessionProvider] Recharging energy by ${amount}. Current: ${profile.energy}`);
    const newEnergy = Math.min(MAX_ENERGY, profile.energy + amount);
    const { error } = await supabase.from('profiles').update({ energy: newEnergy }).eq('id', user.id);
    if (!error) {
      console.log(`[SessionProvider] Energy recharged to: ${newEnergy}.`);
      await refreshProfile();
    } else {
      console.error("[SessionProvider] Error recharging energy:", error);
    }
  }, [user, profile, refreshProfile]);

  const triggerLevelUp = useCallback((level: number) => {
    console.log(`[SessionProvider] Triggering Level Up to: ${level}`);
    setShowLevelUp(true);
    setLevelUpLevel(level);
  }, []);

  const resetLevelUp = useCallback(() => {
    console.log("[SessionProvider] Resetting Level Up state.");
    setShowLevelUp(false);
    setLevelUpLevel(0);
  }, []);

  const resetDailyStreak = useCallback(async () => {
    if (!user) return;
    console.log("[SessionProvider] Resetting daily streak.");
    const { error } = await supabase.from('profiles').update({ daily_streak: 0, last_streak_update: null }).eq('id', user.id);
    if (!error) {
      console.log("[SessionProvider] Daily streak reset successfully.");
      await refreshProfile();
    } else {
      console.error("[SessionProvider] Error resetting daily streak:", error);
    }
  }, [user, refreshProfile]);

  const claimDailyReward = useCallback(async (xpAmount: number, energyAmount: number) => {
    if (!user || !profile) return;
    console.log(`[SessionProvider] Claiming daily reward: +${xpAmount} XP, +${energyAmount} Energy.`);
    const newXp = profile.xp + xpAmount;
    const newEnergy = Math.min(MAX_ENERGY, profile.energy + energyAmount);
    const { error } = await supabase.from('profiles').update({ xp: newXp, energy: newEnergy, last_daily_reward_claim: new Date().toISOString() }).eq('id', user.id);
    if (!error) {
      console.log("[SessionProvider] Daily reward claimed successfully.");
      await refreshProfile();
      showSuccess("Reward claimed!");
    } else {
      console.error("[SessionProvider] Error claiming daily reward:", error);
    }
  }, [user, profile, refreshProfile]);

  const updateNotificationPreferences = useCallback(async (preferences: any) => {
    if (!user) return;
    console.log("[SessionProvider] Updating notification preferences:", preferences);
    const { error } = await supabase.from('profiles').update(preferences).eq('id', user.id);
    if (!error) {
      console.log("[SessionProvider] Notification preferences updated.");
      await refreshProfile();
    } else {
      console.error("[SessionProvider] Error updating notification preferences:", error);
    }
  }, [user, refreshProfile]);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!user) return;
    console.log("[SessionProvider] Updating profile:", updates);
    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
    if (!error) {
      console.log("[SessionProvider] Profile updated successfully.");
      await refreshProfile();
    } else {
      console.error("[SessionProvider] Error updating profile:", error);
    }
  }, [user, refreshProfile]);

  const updateSettings = useCallback(async (updates: Partial<UserProfile>) => {
    if (!user) return;
    console.log("[SessionProvider] Updating settings:", updates);
    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
    if (!error) {
      console.log("[SessionProvider] Settings updated successfully.");
      await refreshProfile();
    } else {
      console.error("[SessionProvider] Error updating settings:", error);
    }
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

    console.log(`[SessionProvider] ${isBlocked ? 'Blocking' : 'Unblocking'} day: ${dateString}. New blocked days:`, newBlockedDays);
    try {
      await supabase.from('profiles').update({ blocked_days: newBlockedDays }).eq('id', user.id);
      await refreshProfile();
      showSuccess(isBlocked ? `Day ${dateString} blocked.` : `Day ${dateString} unblocked.`);
    } catch (error: any) {
      console.error("[SessionProvider] Failed to update blocked days:", error);
      showError(`Failed to update blocked days: ${error.message}`);
    }
  }, [user, profile, refreshProfile]);

  const updateSkippedDayOffSuggestions = useCallback(async (dateString: string, skip: boolean) => {
    if (!user || !profile) return;
    let newSkippedSuggestions = profile.skipped_day_off_suggestions ? [...profile.skipped_day_off_suggestions] : [];

    if (skip) {
      if (!newSkippedSuggestions.includes(dateString)) {
        newSkippedSuggestions.push(dateString);
      }
    } else {
      newSkippedSuggestions = newSkippedSuggestions.filter(day => day !== dateString);
    }

    console.log(`[SessionProvider] ${skip ? 'Skipping' : 'Unskipping'} day off suggestion: ${dateString}. New skipped suggestions:`, newSkippedSuggestions);
    try {
      await supabase.from('profiles').update({ skipped_day_off_suggestions: newSkippedSuggestions }).eq('id', user.id);
      await refreshProfile();
      showSuccess(skip ? `Day ${dateString} skipped for suggestion.` : `Day ${dateString} unskipped.`);
    } catch (error: any) {
      console.error("[SessionProvider] Failed to update skipped suggestions:", error);
      showError(`Failed to update skipped suggestions: ${error.message}`);
    }
  }, [user, profile, refreshProfile]);

  const triggerEnergyRegen = useCallback(async () => {
    if (!user) return;
    console.log("[SessionProvider] Triggering energy regeneration via Edge Function.");
    try {
      const { error } = await supabase.functions.invoke('trigger-energy-regen');
      if (error) {
        throw new Error(error.message);
      }
      console.log("[SessionProvider] Energy regeneration triggered successfully.");
      await refreshProfile();
    } catch (e: any) {
      console.error("[SessionProvider] Failed to trigger energy regeneration:", e.message);
    }
  }, [user, refreshProfile]);

  const startRegenPodState = useCallback(async (activityName: string, durationMinutes: number) => {
    if (!user) return;
    console.log(`[SessionProvider] Starting Regen Pod for activity: ${activityName}, duration: ${durationMinutes} min.`);
    setRegenPodDurationMinutes(durationMinutes);
    const { error } = await supabase.from('profiles').update({ is_in_regen_pod: true, regen_pod_start_time: new Date().toISOString() }).eq('id', user.id);
    if (!error) {
      console.log("[SessionProvider] Profile updated for Regen Pod start.");
      await refreshProfile();
    } else {
      console.error("[SessionProvider] Error starting Regen Pod state:", error);
    }
  }, [user, refreshProfile]);

  const exitRegenPodState = useCallback(async () => {
    if (!user || !profile?.is_in_regen_pod) return;
    console.log("[SessionProvider] Exiting Regen Pod state.");
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/calculate-pod-exit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          startTime: profile.regen_pod_start_time,
          endTime: new Date().toISOString()
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to calculate pod exit energy.');
      }
      console.log("[SessionProvider] Pod exit calculation successful.");
    } catch (e: any) {
      console.error("[SessionProvider] Failed to calculate pod exit energy:", e.message);
    } finally {
      const { error } = await supabase.from('profiles').update({ is_in_regen_pod: false, regen_pod_start_time: null }).eq('id', user.id);
      if (!error) {
        console.log("[SessionProvider] Profile updated for Regen Pod exit.");
        await refreshProfile();
        setRegenPodDurationMinutes(0);
      } else {
        console.error("[SessionProvider] Error exiting Regen Pod state:", error);
      }
    }
  }, [user, profile, refreshProfile, session?.access_token]);

  const handleAuthChange = useCallback(async (event: string, currentSession: Session | null) => {
    console.log(`[SessionProvider] Auth event: ${event}`);
    setSession(currentSession);
    setUser(currentSession?.user ?? null);
    
    if (currentSession?.user) {
      await fetchProfile(currentSession.user.id);
    } else if (event === 'SIGNED_OUT') {
      console.log("[SessionProvider] User signed out, clearing profile and queries.");
      setProfile(null);
      queryClient.clear();
      setRedirectPath('/login');
    }
  }, [fetchProfile, queryClient]);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, currentSession) => {
      handleAuthChange(event, currentSession);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [handleAuthChange]);

  useEffect(() => {
    const loadInitialSession = async () => {
      if (initialSessionLoadedRef.current) return;
      initialSessionLoadedRef.current = true;
      console.log("[SessionProvider] Loading initial session...");
      
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        
        if (initialSession?.user) {
          await fetchProfile(initialSession.user.id);
        } else if (location.pathname !== '/login') {
          console.log("[SessionProvider] No initial session, redirecting to login.");
          setRedirectPath('/login');
        }
      } finally {
        setIsAuthLoading(false);
        console.log("[SessionProvider] Initial session load complete.");
      }
    };

    loadInitialSession();
  }, [fetchProfile, queryClient, location.pathname]);

  useEffect(() => {
    if (!isAuthLoading && redirectPath && location.pathname !== redirectPath) {
      console.log(`[SessionProvider] Navigating from ${location.pathname} to ${redirectPath}`);
      navigate(redirectPath, { replace: true });
      setRedirectPath(null);
    }
    if (!isAuthLoading && user && location.pathname === '/login') {
      console.log("[SessionProvider] User authenticated, redirecting from login to /.");
      setRedirectPath('/');
    }
  }, [redirectPath, navigate, location.pathname, isAuthLoading, user]);

  const { data: dbScheduledTasksToday = [] } = useQuery<DBScheduledTask[]>({
    queryKey: ['scheduledTasksToday', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      console.log(`[SessionProvider] Fetching scheduled tasks for today (${todayString}) for user: ${user.id}`);
      const { data, error } = await supabase.from('scheduled_tasks').select('*')
        .eq('user_id', user.id).eq('scheduled_date', todayString);
      if (error) {
        console.error("[SessionProvider] Error fetching scheduled tasks for today:", error);
        throw error;
      }
      return data as DBScheduledTask[];
    },
    enabled: !!user?.id && !isAuthLoading,
  });

  const { data: mealAssignmentsToday = [] } = useQuery<MealAssignment[]>({
    queryKey: ['mealAssignmentsToday', user?.id, todayString],
    queryFn: async () => {
      if (!user?.id || !todayString) return [];
      console.log(`[SessionProvider] Fetching meal assignments for today (${todayString}) for user: ${user.id}`);
      const { data, error } = await supabase
        .from('meal_assignments')
        .select('*, meal_idea:meal_ideas(*)')
        .eq('assigned_date', todayString)
        .eq('user_id', user.id);
      if (error) {
        console.error("[SessionProvider] Error fetching meal assignments for today:", error);
        throw error;
      }
      return data;
    },
    enabled: !!user?.id && !isAuthLoading,
  });

  // Memoize the calculation to prevent object reference churn
  const calculatedScheduleToday = useMemo(() => {
    if (!profile) {
      console.log("[SessionProvider] No profile, skipping schedule calculation.");
      return null;
    }
    console.log("[SessionProvider] Calculating schedule for today...");
    const start = profile.default_auto_schedule_start_time ? setTimeOnDate(startOfDay(new Date()), profile.default_auto_schedule_start_time) : startOfDay(new Date());
    let end = profile.default_auto_schedule_end_time ? setTimeOnDate(startOfDay(new Date()), profile.default_auto_schedule_end_time) : addHours(startOfDay(new Date()), 17);
    if (isBefore(end, start)) end = addDays(end, 1);
    
    // We pass a stable T_current (today's start) for structural calculation stability
    return calculateSchedule(
      dbScheduledTasksToday,
      todayString,
      start,
      end,
      profile.is_in_regen_pod,
      profile.regen_pod_start_time ? parseISO(profile.regen_pod_start_time) : null,
      regenPodDurationMinutes,
      start, // Stable T_current for structural calculation
      profile.breakfast_time,
      profile.lunch_time,
      profile.dinner_time,
      profile.breakfast_duration_minutes,
      profile.lunch_duration_minutes,
      profile.dinner_duration_minutes,
      profile.reflection_count,
      profile.reflection_times,
      profile.reflection_durations,
      mealAssignmentsToday,
      profile.blocked_days?.includes(todayString) ?? false
    );
  }, [dbScheduledTasksToday, profile, regenPodDurationMinutes, mealAssignmentsToday, todayString]);

  // NEW: Stabilized derivation of active/next items
  useEffect(() => {
    if (!calculatedScheduleToday) {
      if (activeItemToday !== null) {
        console.log("[SessionProvider] Clearing active/next items (no schedule).");
        setActiveItemToday(null);
      }
      if (nextItemToday !== null) setNextItemToday(null);
      return;
    }

    const now = new Date();
    const newActiveItem = calculatedScheduleToday.items.find(i => now >= i.startTime && now < i.endTime) || null;
    const newNextItem = calculatedScheduleToday.items.find(i => i.startTime > now) || null;

    // Only update state if the content has actually changed
    if (!isEqual(activeItemToday, newActiveItem)) {
      console.log("[SessionProvider] Active item changed:", newActiveItem?.name);
      setActiveItemToday(newActiveItem);
    }
    if (!isEqual(nextItemToday, newNextItem)) {
      console.log("[SessionProvider] Next item changed:", newNextItem?.name);
      setNextItemToday(newNextItem);
    }
  }, [calculatedScheduleToday, activeItemToday, nextItemToday]); // Depend only on the stable calculatedScheduleToday

  const contextValue = useMemo(() => {
    // Only log if we actually have data to prevent spam
    if (profile) {
        console.log("[SessionProvider] Context computed.");
    }
    return {
      session, user, profile, isLoading, refreshProfile, rechargeEnergy, showLevelUp, levelUpLevel, 
      triggerLevelUp, resetLevelUp, resetDailyStreak, claimDailyReward, updateNotificationPreferences, 
      updateProfile, updateSettings, updateBlockedDays, updateSkippedDayOffSuggestions, triggerEnergyRegen, 
      activeItemToday, nextItemToday, startRegenPodState, exitRegenPodState, regenPodDurationMinutes
    };
  }, [
    session, user, profile, isLoading, refreshProfile, rechargeEnergy, showLevelUp, levelUpLevel, 
    triggerLevelUp, resetLevelUp, resetDailyStreak, claimDailyReward, updateNotificationPreferences, 
    updateProfile, updateSettings, updateBlockedDays, updateSkippedDayOffSuggestions, triggerEnergyRegen, 
    activeItemToday, nextItemToday, startRegenPodState, exitRegenPodState, regenPodDurationMinutes
  ]);

  return (
    <SessionContext.Provider value={contextValue}>
      {!isAuthLoading ? children : null}
    </SessionContext.Provider>
  );
};