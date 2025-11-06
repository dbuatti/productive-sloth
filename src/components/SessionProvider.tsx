import React, { useState, useEffect, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom'; // Corrected import syntax
import { SessionContext, UserProfile } from '@/hooks/use-session';
import { dismissToast, showSuccess, showError } from '@/utils/toast'; // Import showSuccess and showError
import { isToday, parseISO, isPast, addMinutes, startOfDay } from 'date-fns';
import { 
  ENERGY_REGEN_AMOUNT, 
  ENERGY_REGEN_INTERVAL_MS, 
  MAX_ENERGY, 
  RECHARGE_BUTTON_AMOUNT, 
  LOW_ENERGY_THRESHOLD, 
  LOW_ENERGY_NOTIFICATION_COOLDOWN_MINUTES,
  // DAILY_CHALLENGE_TASKS_REQUIRED // Removed static constant
} from '@/lib/constants'; // Import constants

// Retry constants
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 200;

// Helper to call the Edge Function using invoke
const generateDailyChallenge = async () => {
  // Note: supabase.functions.invoke automatically handles the Authorization header
  const { data, error } = await supabase.functions.invoke('generate-daily-challenge', {
    method: 'POST',
    body: {}, // Empty body as the function doesn't require input data
  });
  
  if (error) {
    throw new Error(error.message || 'Failed to send a request to the Edge Function');
  }
  return data;
};


export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Keep true initially
  const [showLevelUp, setShowLevelUp] = useState(false); // New state for level up celebration
  const [levelUpLevel, setLevelUpLevel] = useState(0); // New state for the level achieved
  const navigate = useNavigate();

  const fetchProfile = useCallback(async (userId: string) => {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, avatar_url, xp, level, daily_streak, last_streak_update, energy, last_daily_reward_claim, last_daily_reward_notification, last_low_energy_notification, tasks_completed_today, daily_challenge_target, enable_daily_challenge_notifications, enable_low_energy_notifications') // Select new dynamic target column
          .eq('id', userId);

        if (error) {
          throw new Error(error.message);
        } else if (data && data.length > 0) {
          setProfile(data[0] as UserProfile);
          return; // Success
        } else {
          setProfile(null);
          return; // No profile found, but no error
        }
      } catch (error) {
        console.error(`Error fetching profile (Attempt ${attempt}/${MAX_RETRIES}):`, error);
        if (attempt === MAX_RETRIES) {
          setProfile(null);
          // Do not re-throw here, let the outer loadSessionAndProfile handle the final failure state
          return; 
        }
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      }
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
      showError("You have already claimed your daily challenge reward today!");
      return;
    }

    // Use dynamic target
    if (profile.tasks_completed_today < profile.daily_challenge_target) {
      showError(`Complete ${profile.daily_challenge_target} tasks to claim your daily challenge reward!`);
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

  // Effect to handle authentication state changes and initial load
  useEffect(() => {
    const handleAuthChange = async (event: string, currentSession: Session | null) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      
      // Skip heavy lifting (profile fetch, challenge generation) on INITIAL_SESSION
      // as loadSessionAndProfile handles it immediately after.
      if (currentSession?.user && event !== 'INITIAL_SESSION') { 
        await fetchProfile(currentSession.user.id);
        
        // Call Edge Function to ensure daily challenge target is set/reset
        try {
          await generateDailyChallenge();
          await refreshProfile(); // Refresh again to get the potentially new target/tasks_completed_today=0
        } catch (e) {
          console.error(`Failed to generate daily challenge (${event}):`, e);
        }

      } else if (!currentSession?.user) {
        setProfile(null);
      }

      if (event === 'SIGNED_IN' && window.location.pathname === '/login') {
        navigate('/');
      } else if (event === 'SIGNED_OUT' && window.location.pathname !== '/login') {
        navigate('/login');
      }
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
          // 1. Perform initial profile fetch (now with retry logic)
          await fetchProfile(initialSession.user.id);
          
          // 2. Introduce a delay before calling the Edge Function
          await new Promise(resolve => setTimeout(resolve, 500)); 

          // 3. Call Edge Function on initial load
          if (initialSession.access_token) {
            try {
              await generateDailyChallenge();
              // No immediate profile refresh here
            } catch (e) {
              console.error("Failed to generate initial daily challenge:", e);
            }
          }

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
  }, [navigate, fetchProfile, refreshProfile]);

// ... (Energy Regeneration Effect and Daily Reset Effect remain the same)

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

  // Daily Reset for tasks_completed_today and Daily Reward Notification
  useEffect(() => {
    if (!user || !profile) return;

    const now = new Date();
    const today = startOfDay(now);

    // Daily Reward Notification (now Dynamic Daily Challenge Notification)
    const lastRewardClaim = profile.last_daily_reward_claim ? parseISO(profile.last_daily_reward_claim) : null;
    const lastRewardNotification = profile.last_daily_reward_notification ? parseISO(profile.last_daily_reward_notification) : null;

    const canNotifyDailyChallenge = 
      profile.enable_daily_challenge_notifications && // Check user preference
      (!lastRewardClaim || !isToday(lastRewardClaim)) && // Challenge not claimed today
      (!lastRewardNotification || !isToday(lastRewardNotification)); // Not notified today

    if (canNotifyDailyChallenge) {
      showSuccess(`Your daily challenge is ready! Complete ${profile.daily_challenge_target} tasks to claim your reward! 🎉`);
      supabase.from('profiles').update({ last_daily_reward_notification: now.toISOString() }).eq('id', user.id).then(({ error }) => {
        if (error) console.error("Failed to update last_daily_reward_notification:", error.message);
        else refreshProfile(); // Refresh to update local profile state
      });
    }

    // Low Energy Notification
    const lastLowEnergyNotification = profile.last_low_energy_notification ? parseISO(profile.last_low_energy_notification) : null;
    const canNotifyLowEnergy = 
      profile.enable_low_energy_notifications && // Check user preference
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
      claimDailyReward,
      updateNotificationPreferences
    }}>
      {children}
    </SessionContext.Provider>
  );
};