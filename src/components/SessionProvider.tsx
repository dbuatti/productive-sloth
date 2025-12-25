import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { SessionContext, UserProfile } from '@/hooks/use-session';
import { dismissToast, showSuccess, showError } from '@/utils/toast';
import { isToday, parseISO, isPast, addMinutes, startOfDay, format, isSameDay, isBefore, addDays, addHours, setHours, setMinutes, differenceInMinutes } from 'date-fns';
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
import { useEnvironmentContext, environmentOptions } from '@/hooks/use-environment-context';

// Supabase Project ID and URL are needed to invoke the Edge Function
const SUPABASE_PROJECT_ID = "yfgapigmiyclgryqdgne";
const SUPABASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co`;

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true); // Tracks initial auth load
  const [isProfileLoading, setIsProfileLoading] = useState(false); // Tracks profile fetch
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpLevel, setLevelUpLevel] = useState(0);
  const [T_current, setT_current] = useState(new Date()); // Internal T_current for SessionProvider
  const [regenPodDurationMinutes, setRegenPodDurationMinutes] = useState(0);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { selectedEnvironments } = useEnvironmentContext();

  // Combined loading state
  const isLoading = isAuthLoading || isProfileLoading;

  // Update T_current every second
  useEffect(() => {
    const interval = setInterval(() => {
      setT_current(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Stabilized fetchProfile function
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

  // Refined refreshProfile function
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
      console.error("Failed to recharge energy:", error.message);
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
    if (!user) {
      showError("You must be logged in to reset your daily streak.");
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          daily_streak: 0, 
          last_streak_update: null,
          updated_at: new Date().toISOString() 
        })
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      await refreshProfile();
      showSuccess("Daily streak reset to 0.");
    } catch (error: any) {
      showError(`Failed to reset daily streak: ${error.message}`);
      console.error("Reset daily streak error:", error);
    }
  }, [user, refreshProfile]);

  const claimDailyReward = useCallback(async (xpAmount: number, energyAmount: number) => {
    if (!user || !profile) {
      showError("You must be logged in to claim daily reward.");
      return;
    }

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
        .update({
          xp: newXp,
          energy: newEnergy,
          last_daily_reward_claim: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      await refreshProfile();
      showSuccess(`Daily challenge reward claimed! +${xpAmount} XP, +${energyAmount} Energy!`);
    } catch (error: any) {
      showError(`Failed to claim daily challenge reward: ${error.message}`);
      console.error("Claim daily challenge reward error:", error);
    }
  }, [user, profile, refreshProfile]);

  const updateNotificationPreferences = useCallback(async (preferences: { enable_daily_challenge_notifications?: boolean; enable_low_energy_notifications?: boolean }) => {
    if (!user) {
      showError("You must be logged in to update notification preferences.");
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ ...preferences, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      await refreshProfile();
      showSuccess("Notification preferences updated!");
    } catch (error: any) {
      showError(`Failed to update notification preferences: ${error.message}`);
      console.error("Update notification preferences error:", error);
    }
  }, [user, refreshProfile]);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!user) {
      showError("You must be logged in to update your profile.");
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      await refreshProfile();
      showSuccess("Profile updated successfully!");
    } catch (error: any) {
      showError(`Failed to update profile: ${error.message}`);
      console.error("Update profile error:", error);
    }
  }, [user, refreshProfile]);

  // NEW: Generic update settings function
  const updateSettings = useCallback(async (updates: Partial<UserProfile>) => {
    if (!user) {
      showError("You must be logged in to update settings.");
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      await refreshProfile();
      showSuccess("Settings updated successfully!");
    } catch (error: any) {
      showError(`Failed to update settings: ${error.message}`);
      console.error("Update settings error:", error);
    }
  }, [user, refreshProfile]);

  // NEW: Helper to trigger server-side energy regeneration
  const triggerEnergyRegen = useCallback(async () => {
    if (!user || !session?.access_token) return;
    
    try {
      // Call the trigger-energy-regen function which uses the service role key internally
      const { error } = await supabase.functions.invoke('trigger-energy-regen', {
        method: 'POST',
        body: {},
      });

      if (error) {
        throw new Error(error.message);
      }
      
      // Wait a moment for the asynchronous regeneration to complete on the server
      await new Promise(resolve => setTimeout(resolve, 1000)); 
      
      // Force a profile refresh to get the new energy value
      await refreshProfile();
      console.log("[EnergyRegen] Immediate trigger complete and profile refreshed.");

    } catch (e: any) {
      console.error("[EnergyRegen] Failed to trigger energy regeneration:", e.message);
      // showError("Failed to update energy. Please try refreshing.");
    }
  }, [user, session?.access_token, refreshProfile]);


  // NEW: Start Regen Pod State
  const startRegenPodState = useCallback(async (durationMinutes: number) => {
    if (!user) {
      showError("User not authenticated.");
      return;
    }
    const now = new Date();
    setRegenPodDurationMinutes(durationMinutes);

    const { error } = await supabase
      .from('profiles')
      .update({ 
        is_in_regen_pod: true, 
        regen_pod_start_time: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', user.id);

    if (error) {
      console.error("Failed to start Pod state:", error.message);
      showError("Failed to start Energy Regen Pod.");
      setRegenPodDurationMinutes(0);
    } else {
      await refreshProfile();
    }
  }, [user, refreshProfile]);

  // NEW: Exit Regen Pod State (Triggers server calculation)
  const exitRegenPodState = useCallback(async () => {
    if (!user || !profile || !profile.is_in_regen_pod || !profile.regen_pod_start_time) {
      showError("Pod is not currently active.");
      return;
    }
    
    const podStartTime = parseISO(profile.regen_pod_start_time);
    const podEndTime = new Date();
    const durationMinutes = differenceInMinutes(podEndTime, podStartTime);
    
    if (durationMinutes <= 0) {
        showError("Pod session was too short to register energy gain.");
        // Immediately reset state if duration is zero
        await supabase
            .from('profiles')
            .update({ 
                is_in_regen_pod: false, 
                regen_pod_start_time: null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);
        await refreshProfile();
        return;
    }

    // 1. Call Edge Function to calculate and apply energy gain
    try {
        const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/calculate-pod-exit`;

        const response = await fetch(edgeFunctionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({
                startTime: profile.regen_pod_start_time,
                endTime: podEndTime.toISOString(),
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to process Pod exit via Edge Function');
        }
        
        const data = await response.json();
        showSuccess(`Pod exited. +${data.energyGained}⚡ gained over ${data.durationMinutes} minutes!`);

    } catch (error: any) {
        showError(`Failed to calculate Pod energy: ${error.message}`);
        console.error("Pod exit calculation error:", error);
    } finally {
        // 2. Reset Pod state in profile regardless of calculation success
        const { error: resetError } = await supabase
            .from('profiles')
            .update({ 
                is_in_regen_pod: false, 
                regen_pod_start_time: null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);

        if (resetError) {
            console.error("Failed to reset Pod state:", resetError.message);
            showError("Failed to reset Pod state in database.");
        }
        
        // 3. Force profile refresh
        await refreshProfile();
        setRegenPodDurationMinutes(0);
    }
  }, [user, profile, refreshProfile, session?.access_token]);


  // Main useEffect for auth state changes and initial session load
  useEffect(() => {
    const handleAuthChange = async (event: string, currentSession: Session | null) => {
      const newUserId = currentSession?.user?.id ?? null;
      const oldUserId = user?.id ?? null;

      // Update session and user state
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (newUserId && newUserId !== oldUserId) {
          // If a new user signs in, trigger profile fetch
          await fetchProfile(newUserId);
        }
        if (window.location.pathname === '/login') {
          navigate('/');
        }
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        queryClient.clear(); // Clear all query cache on sign out
        if (window.location.pathname !== '/login') {
          navigate('/login');
        }
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((event, currentSession) => {
      handleAuthChange(event, currentSession);
    });

    const loadInitialSession = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        
        if (initialSession?.user) {
          await fetchProfile(initialSession.user.id);
        } else if (!initialSession && window.location.pathname !== '/login') {
          navigate('/login');
        } else if (initialSession && window.location.pathname === '/login') {
          navigate('/');
        }
      } catch (error) {
        console.error("Error during initial session load:", error);
        setSession(null);
        setUser(null);
        setProfile(null);
        if (window.location.pathname !== '/login') {
          navigate('/login');
        }
      } finally {
        setIsAuthLoading(false);
      }
    };

    loadInitialSession();

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate, fetchProfile, queryClient]);

  // Separate useEffect for profile refresh when user changes (redundant now, but kept for safety)
  useEffect(() => {
    if (user?.id && !profile) {
      // Only fetch if profile is null, otherwise rely on the main auth flow or explicit refresh
      fetchProfile(user.id);
    } else if (!user) {
      setProfile(null); // Clear profile if user logs out
    }
  }, [user?.id, profile, fetchProfile]);

  // Daily Reset for tasks_completed_today and Daily Reward Notification
  useEffect(() => {
    if (!user || !profile) return;

    const now = new Date();
    const today = startOfDay(now);

    const lastRewardClaim = profile.last_daily_reward_claim ? parseISO(profile.last_daily_reward_claim) : null;
    const lastStreakUpdate = profile.last_streak_update ? parseISO(profile.last_streak_update) : null;

    const shouldResetTasksCompletedToday = 
      (!lastRewardClaim || !isToday(lastRewardClaim)) && 
      (!lastStreakUpdate || !isToday(lastStreakUpdate));

    if (shouldResetTasksCompletedToday && profile.tasks_completed_today > 0) {
      supabase.from('profiles').update({ tasks_completed_today: 0 }).eq('id', user.id).then(({ error }) => {
        if (error) console.error("Failed to reset tasks_completed_today:", error.message);
        else refreshProfile();
      });
    }

    const lastRewardNotification = profile.last_daily_reward_notification ? parseISO(profile.last_daily_reward_notification) : null;

    const canNotifyDailyChallenge = 
      profile.enable_daily_challenge_notifications &&
      (!lastRewardClaim || !isToday(lastRewardClaim)) &&
      (!lastRewardNotification || !isToday(lastRewardNotification));

    if (canNotifyDailyChallenge) {
      showSuccess(`Your daily challenge is ready! Complete ${DAILY_CHALLENGE_TASKS_REQUIRED} tasks to claim your reward! 🎉`);
      supabase.from('profiles').update({ last_daily_reward_notification: now.toISOString() }).eq('id', user.id).then(({ error }) => {
        if (error) console.error("Failed to update last_daily_reward_notification:", error.message);
        else refreshProfile();
      });
    }

    const lastLowEnergyNotification = profile.last_low_energy_notification ? parseISO(profile.last_low_energy_notification) : null;
    const canNotifyLowEnergy = 
      profile.enable_low_energy_notifications &&
      profile.energy <= LOW_ENERGY_THRESHOLD && 
      (!lastLowEnergyNotification || isPast(addMinutes(lastLowEnergyNotification, LOW_ENERGY_NOTIFICATION_COOLDOWN_MINUTES)));

    if (canNotifyLowEnergy) {
      showError(`Energy is low (${profile.energy}%)! Recharge to keep completing tasks. ⚡`);
      supabase.from('profiles').update({ last_low_energy_notification: now.toISOString() }).eq('id', user.id).then(({ error }) => {
        if (error) console.error("Failed to update last_low_energy_notification:", error.message);
        else refreshProfile();
      });
    }

  }, [user, profile, refreshProfile]);

  // Fetch scheduled tasks for TODAY to determine active/next items
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
      if (error) {
        console.error('Error fetching scheduled tasks for today:', error);
        throw new Error(error.message);
      }
      return data as DBScheduledTask[];
    },
    enabled: !!user?.id && !!profile, // Only fetch if user and profile are loaded
    staleTime: 1 * 60 * 1000, // 1 minute stale time
    gcTime: 5 * 60 * 1000, // 5 minutes garbage collection time
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

    // If the user has selected environments, we filter the potential next items.
    if (selectedEnvironments.length > 0) {
        const nextMatchingItem = potentialNextItems.find(item => 
            // Match tasks only if their environment is selected
            (item.type === 'task' && selectedEnvironments.includes(item.taskEnvironment)) || 
            // Breaks, Time Off, Meals, and Calendar Events are always considered available, regardless of environment selection
            item.type === 'break' || 
            item.type === 'time-off' ||
            item.type === 'meal' ||
            item.type === 'calendar-event'
        );
        
        if (nextMatchingItem) {
            return nextMatchingItem;
        }
    }

    // Fallback: If no environments are selected, or if no matching item was found, 
    // return the very next scheduled item regardless of environment.
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