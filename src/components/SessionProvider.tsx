import React, { useState, useEffect, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom'; // Corrected import syntax
import { SessionContext, UserProfile } from '@/hooks/use-session';
import { dismissToast, showSuccess, showError } from '@/utils/toast'; // Import showSuccess and showError
import { isToday, parseISO, isPast, addMinutes } from 'date-fns';

const ENERGY_REGEN_AMOUNT = 5; // Amount of energy to regenerate per interval
const ENERGY_REGEN_INTERVAL_MS = 60 * 1000; // Regenerate every 1 minute (adjust as needed)
const MAX_ENERGY = 100; // Max energy for the user (should match useTasks)
const RECHARGE_BUTTON_AMOUNT = 25; // Amount of energy to gain from recharge button
const LOW_ENERGY_THRESHOLD = 20; // Energy level at which to show a notification
const LOW_ENERGY_NOTIFICATION_COOLDOWN_MINUTES = 30; // Cooldown for low energy notifications

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Keep true initially
  const [showLevelUp, setShowLevelUp] = useState(false); // New state for level up celebration
  const [levelUpLevel, setLevelUpLevel] = useState(0); // New state for the level achieved
  const navigate = useNavigate();

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, avatar_url, xp, level, daily_streak, last_streak_update, energy, last_daily_reward_claim, last_daily_reward_notification, last_low_energy_notification') // Select new notification columns
      .eq('id', userId); // Removed .single()

    if (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
    } else if (data && data.length > 0) {
      setProfile(data[0] as UserProfile); // Take the first profile if found
    } else {
      setProfile(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

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
          last_streak_update: null, // Reset last update to ensure next task starts a new streak
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
      showError("You have already claimed your daily reward today!");
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
      showSuccess(`Daily reward claimed! +${xpAmount} XP, +${energyAmount} Energy!`);
    } catch (error: any) {
      showError(`Failed to claim daily reward: ${error.message}`);
      console.error("Claim daily reward error:", error);
    }
  }, [user, profile, refreshProfile]);

  useEffect(() => {
    const handleAuthChange = async (event: string, currentSession: Session | null) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (currentSession?.user) {
        await fetchProfile(currentSession.user.id);
      } else {
        setProfile(null);
      }

      if (event === 'SIGNED_IN' && window.location.pathname === '/login') {
        navigate('/');
      } else if (event === 'SIGNED_OUT' && window.location.pathname !== '/login') {
        navigate('/login');
      }
      // For USER_UPDATED, profile is already refreshed above.
      // For INITIAL_SESSION, the initial load logic below handles navigation.
    };

    // Set up auth listener
    const { data: authListener } = supabase.auth.onAuthStateChange((event, currentSession) => {
      handleAuthChange(event, currentSession);
    });

    // Initial session check and loading state management
    const loadSessionAndProfile = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        if (initialSession?.user) {
          await fetchProfile(initialSession.user.id);
        } else {
          setProfile(null);
        }

        // Handle initial navigation after session and profile are loaded
        if (!initialSession && window.location.pathname !== '/login') {
          navigate('/login');
        } else if (initialSession && window.location.pathname === '/login') {
          navigate('/');
        }

      } catch (error) {
        console.error("Error during initial session load:", error);
        // Even on error, we should stop loading to prevent infinite spinner
        setSession(null);
        setUser(null);
        setProfile(null);
        if (window.location.pathname !== '/login') {
          navigate('/login');
        }
      } finally {
        setIsLoading(false); // Always set to false after initial load attempt
      }
    };

    loadSessionAndProfile();

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate, fetchProfile]); // Removed isLoading and user?.id from dependencies to prevent re-runs

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
            await refreshProfile(); // Refresh local profile state
          }
        }
      }, ENERGY_REGEN_INTERVAL_MS);
    }

    return () => {
      if (regenInterval) clearInterval(regenInterval);
    };
  }, [user, profile, refreshProfile]);

  // Notification Effects
  useEffect(() => {
    if (!user || !profile) return;

    const now = new Date();

    // Daily Reward Notification
    const lastRewardClaim = profile.last_daily_reward_claim ? parseISO(profile.last_daily_reward_claim) : null;
    const lastRewardNotification = profile.last_daily_reward_notification ? parseISO(profile.last_daily_reward_notification) : null;

    const canNotifyDailyReward = 
      (!lastRewardClaim || !isToday(lastRewardClaim)) && // Reward not claimed today
      (!lastRewardNotification || !isToday(lastRewardNotification)); // Not notified today

    if (canNotifyDailyReward) {
      showSuccess("Your daily reward is ready to claim! 🎉");
      supabase.from('profiles').update({ last_daily_reward_notification: now.toISOString() }).eq('id', user.id).then(({ error }) => {
        if (error) console.error("Failed to update last_daily_reward_notification:", error.message);
        else refreshProfile(); // Refresh to update local profile state
      });
    }

    // Low Energy Notification
    const lastLowEnergyNotification = profile.last_low_energy_notification ? parseISO(profile.last_low_energy_notification) : null;
    const canNotifyLowEnergy = 
      profile.energy <= LOW_ENERGY_THRESHOLD && 
      (!lastLowEnergyNotification || isPast(addMinutes(lastLowEnergyNotification, LOW_ENERGY_NOTIFICATION_COOLDOWN_MINUTES)));

    if (canNotifyLowEnergy) {
      showError(`Energy is low (${profile.energy}%)! Recharge to keep completing tasks. ⚡`);
      supabase.from('profiles').update({ last_low_energy_notification: now.toISOString() }).eq('id', user.id).then(({ error }) => {
        if (error) console.error("Failed to update last_low_energy_notification:", error.message);
        else refreshProfile(); // Refresh to update local profile state
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
      claimDailyReward
    }}>
      {children}
    </SessionContext.Provider>
  );
};