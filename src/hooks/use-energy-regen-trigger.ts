import { useEffect, useState, useRef } from 'react';
import { useSession } from './use-session';
import { parseISO, differenceInMinutes } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';

const REGEN_COOLDOWN_MINUTES = 5; // Only trigger if last regen was more than 5 minutes ago

export const useEnergyRegenTrigger = () => {
  const { user, profile, refreshProfile } = useSession();
  const isTriggeringRef = useRef(false); // Use ref to prevent re-triggering effect on state change

  useEffect(() => {
    // If no user/profile, or if a trigger is already in progress, exit.
    if (!user || !profile || isTriggeringRef.current) {
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
      isTriggeringRef.current = true; // Set ref to true
      
      const triggerRegen = async () => {
        try {
          const { error } = await supabase.functions.invoke('trigger-energy-regen', {
            method: 'POST',
            body: {},
          });

          if (error) {
            throw new Error(error.message);
          }
          
          await new Promise(resolve => setTimeout(resolve, 2000)); 
          await refreshProfile();

        } catch (e: any) {
          // console.error("[EnergyRegen] Failed to trigger energy regeneration:", e.message);
        } finally {
          isTriggeringRef.current = false; // Reset ref to false
        }
      };

      triggerRegen();
    }
  }, [user, profile, refreshProfile]); // Removed isTriggering from dependencies
};