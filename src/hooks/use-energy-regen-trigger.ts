import { useEffect, useRef, useCallback } from 'react';
import { useSession } from './use-session';
import { parseISO, differenceInMinutes, format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

const REGEN_COOLDOWN_MINUTES = 5;

export const useEnergyRegenTrigger = () => {
  const { user, profile, refreshProfile } = useSession();
  const isTriggeringRef = useRef(false);
  
  // Use a ref for the profile to avoid re-running the trigger logic unnecessarily when the profile object changes
  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const triggerRegen = useCallback(async () => {
    const currentProfile = profileRef.current;
    if (!user || !currentProfile || isTriggeringRef.current) return;

    isTriggeringRef.current = true;
    console.log("[useEnergyRegenTrigger] Triggering energy regeneration via Edge Function.");
    try {
      const { error } = await supabase.functions.invoke('trigger-energy-regen', {
        method: 'POST',
        body: {},
      });

      if (error) throw new Error(error.message);
      
      console.log("[useEnergyRegenTrigger] Energy regeneration Edge Function invoked successfully.");
      
      // Delay refresh slightly to allow database update to propagate
      await new Promise(resolve => setTimeout(resolve, 2000)); 
      await refreshProfile();

    } catch (e: any) {
      console.error("[useEnergyRegenTrigger] Failed to trigger energy regeneration:", e.message);
    } finally {
      isTriggeringRef.current = false;
    }
  }, [user, refreshProfile]);

  useEffect(() => {
    // Don't even try if we don't have the required data
    if (!user || !profile) return;

    const lastRegenAt = profile.last_energy_regen_at ? parseISO(profile.last_energy_regen_at) : null;
    const now = new Date();

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
    // We only react to the last_energy_regen_at timestamp changing at the minute level to avoid excessive triggers
  }, [user, profile?.last_energy_regen_at ? format(parseISO(profile.last_energy_regen_at), 'yyyy-MM-dd HH:mm') : null, triggerRegen]);
};