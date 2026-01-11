import { useEffect, useRef, useCallback } from 'react';
import { useSession } from './use-session';
import { parseISO, differenceInMinutes, format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

const REGEN_COOLDOWN_MINUTES = 5;
const TRIGGER_THROTTLE_MS = 30000; // Hard 30-second lock to prevent rapid-fire loops

export const useEnergyRegenTrigger = () => {
  const { user, profile, refreshProfile } = useSession();
  const isTriggeringRef = useRef(false);
  const lastTriggerTimeRef = useRef<number>(0);
  
  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const triggerRegen = useCallback(async () => {
    const now = Date.now();
    
    // Hard throttle: Don't even try if we triggered in the last 30 seconds
    if (now - lastTriggerTimeRef.current < TRIGGER_THROTTLE_MS) {
      return;
    }

    const currentProfile = profileRef.current;
    if (!user || !currentProfile || isTriggeringRef.current) return;

    isTriggeringRef.current = true;
    lastTriggerTimeRef.current = now;
    
    console.log("[useEnergyRegenTrigger] Stability Guard Passed. Invoking Edge Function.");
    
    try {
      const { error } = await supabase.functions.invoke('trigger-energy-regen', {
        method: 'POST',
        body: {},
      });

      if (error) throw new Error(error.message);
      
      console.log("[useEnergyRegenTrigger] Success. Profile refresh queued.");
      
      // Delay refresh to allow DB propagation
      setTimeout(async () => {
        await refreshProfile();
        isTriggeringRef.current = false;
      }, 2000);

    } catch (e: any) {
      console.error("[useEnergyRegenTrigger] Failed:", e.message);
      isTriggeringRef.current = false;
    }
  }, [user, refreshProfile]);

  useEffect(() => {
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
  }, [user?.id, profile?.last_energy_regen_at, triggerRegen]); // Stabilized dependencies
};