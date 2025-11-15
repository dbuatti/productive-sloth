import React, { useState, useEffect, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { SessionContext, UserProfile } from '@/hooks/use-session';
import { dismissToast, showSuccess, showError } from '@/utils/toast';
import { isToday, parseISO, isPast, addMinutes, startOfDay } from 'date-fns';
import { 
  ENERGY_REGEN_AMOUNT, 
  ENERGY_REGEN_INTERVAL_MS, 
  MAX_ENERGY, 
  RECHARGE_BUTTON_AMOUNT, 
  LOW_ENERGY_THRESHOLD, 
  LOW_ENERGY_NOTIFICATION_COOLDOWN_MINUTES,
  DAILY_CHALLENGE_TASKS_REQUIRED
} from '@/lib/constants';

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpLevel, setLevelUpLevel] = useState(0);
  const navigate = useNavigate();

  // Stabilized fetchProfile function
  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, avatar_url, xp, level, daily_streak, last_streak_update, energy, last_daily_reward_claim, last_daily_reward_notification, last_low_energy_notification, tasks_completed_today, enable_daily_challenge_notifications, enable_low_energy_notifications, daily_challenge_target, default_auto_schedule_start_time, default_auto_schedule_end_time')
      .eq('id', userId)
      .single(); // Added .single() for robustness

    if (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
    } else if (data) {
      setProfile(data as UserProfile);
    } else {
      setProfile(null);
    }
  }, []); // No dependencies, as supabase and setProfile are stable

  // Refined refreshProfile function
  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  }, [user?.id, fetchProfile]); // Depends on user.id and stable fetchProfile

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

  // Main useEffect for auth state changes and initial session load
  useEffect(() => {
    const handleAuthChange = async (event: string, currentSession: Session | null) => {
      // Only update session if its access token or user ID has changed
      if (session?.access_token !== currentSession?.access_token || session?.user?.id !== currentSession?.user?.id) {
        setSession(currentSession);
      }

      // Only update user if the ID changes or if the user presence changes
      if (user?.id !== currentSession?.user?.id) {
        setUser(currentSession?.user ?? null);
      }

      if (event === 'SIGNED_IN' && window.location.pathname === '/login') {
        navigate('/');
      } else if (event === 'SIGNED_OUT' && window.location.pathname !== '/login') {
        navigate('/login');
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((event, currentSession) => {
      handleAuthChange(event, currentSession);
    });

    const loadInitialSession = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        // Only update session if its access token or user ID has changed
        if (session?.access_token !== initialSession?.access_token || session?.user?.id !== initialSession?.user?.id) {
          setSession(initialSession);
        }

        // Only update user if the ID changes or if the user presence changes
        if (user?.id !== initialSession?.user?.id) {
          setUser(initialSession?.user ?? null);
        }
        
        if (!initialSession && window.location.pathname !== '/login') {
          navigate('/login');
        } else if (initialSession && window.location.pathname === '/login') {
          navigate('/');
        }
      } catch (error) {
        console.error("Error during initial session load:", error);
        setSession(null);
        setUser(null);
        setProfile(null); // Ensure profile is cleared on error
        if (window.location.pathname !== '/login') {
          navigate('/login');
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialSession();

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate, session, user]); // Added session and user to dependencies for comparison logic

  // Separate useEffect to fetch/refresh profile when user changes
  useEffect(() => {
    if (user?.id) {
      refreshProfile();
    } else {
      setProfile(null); // Clear profile if user logs out
    }
  }, [user?.id, refreshProfile]); // Depends on user.id and stable refreshProfile

  // Energy Regeneration Effect
  useEffect(() => {
    let regenInterval: NodeJS.Timeout;

    if (user && profile && profile.energy < MAX_ENERGY) {
      regenInterval = setInterval(async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('energy')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error("Error fetching energy for regeneration:", error.message);
          return;
        }

        const currentEnergy = data.energy;
        const newEnergy = Math.min(MAX_ENERGY, currentEnergy + ENERGY_REGEN_AMOUNT);

        if (newEnergy !== currentEnergy) {
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ energy: newEnergy, updated_at: new Date().toISOString() })
            .eq('id', user.id);

          if (updateError) {
            console.error("Failed to regenerate energy:", updateError.message);
          } else {
            await refreshProfile();
          }
        }
      }, ENERGY_REGEN_INTERVAL_MS);
    }

    return () => {
      if (regenInterval) clearInterval(regenInterval);
    };
  }, [user, profile, refreshProfile]);

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
      updateProfile
    }}>
      {children}
    </SessionContext.Provider>
  );
};