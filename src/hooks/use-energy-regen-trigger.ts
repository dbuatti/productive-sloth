import { useEffect, useRef, useCallback } from 'react';
import { useSession } from './use-session';
import { parseISO, differenceInMinutes } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';

const REGEN_COOLDOWN_MINUTES = 5;

export const useEnergyRegenTrigger = () => {
  const { user, profile, refreshProfile } = useSession();
  const isTriggeringRef = useRef(false);

  const triggerRegen = useCallback(async () => {
    if (!user || !profile || isTriggeringRef.current) {
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
  }, [user, profile, refreshProfile]); // Dependencies for triggerRegen

  useEffect(() => {
    if (!user || !profile) {
      return;
    }

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
  }, [user, profile, triggerRegen]); // Dependencies for useEffect
};