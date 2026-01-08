import { useEffect, useRef, useCallback } from 'react';
import { useSession } from './use-session';
import { parseISO, differenceInMinutes, format } from 'date-fns'; // Import format
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { useCurrentTime } from '@/components/CurrentTimeProvider'; // NEW: Import useCurrentTime

const REGEN_COOLDOWN_MINUTES = 5;

export const useEnergyRegenTrigger = () => {
  const { user, profile, refreshProfile } = useSession();
  const { T_current } = useCurrentTime(); // NEW: Get T_current from CurrentTimeProvider
  const isTriggeringRef = useRef(false);
  const profileRef = useRef(profile); // Keep a ref to the latest profile

  // Update the ref whenever the profile object changes
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const triggerRegen = useCallback(async () => {
    const currentProfile = profileRef.current; // Use the ref to get the latest profile
    if (!user || !currentProfile || isTriggeringRef.current) {
      return;
    }

    isTriggeringRef.current = true; // Set ref to true when starting
    try {
      const { error } = await supabase.functions.invoke('trigger-energy-regen', {
        method: 'POST',
        body: {},
      });

      if (error) {
        throw new Error(error.message);
      }
      
      // Add a small delay to ensure profile refresh has time to propagate
      await new Promise(resolve => setTimeout(resolve, 2000)); 
      await refreshProfile();

    } catch (e: any) {
      // console.error("[EnergyRegen] Failed to trigger energy regeneration:", e.message);
    } finally {
      isTriggeringRef.current = false; // Reset ref to false
    }
  }, [user, refreshProfile]); // Removed 'profile' from dependencies

  useEffect(() => {
    if (!user || !profile) {
      return;
    }

    const lastRegenAt = profile.last_energy_regen_at ? parseISO(profile.last_energy_regen_at) : null;
    const now = T_current; // NEW: Use T_current from CurrentTimeProvider

    let shouldTrigger = false;

    if (!lastRegenAt) {
      shouldTrigger = true;
    } else {
      const minutesSinceLastRegen = differenceInMinutes(now, lastRegenAt);
      if (minutesSinceLastRegen >= REGEN_COOLDOWN_MINUTES) {
        shouldTrigger = true;
      }
    }

    if (shouldTrigger) {
      triggerRegen();
    }
  }, [user, profile?.last_energy_regen_at ? format(parseISO(profile.last_energy_regen_at), 'yyyy-MM-dd HH:mm') : null, triggerRegen, T_current]); // Stabilized dependency to minute precision
};