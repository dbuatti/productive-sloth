import { useEffect, useRef } from 'react';
import { useSession } from './use-session';
import { parseISO, differenceInMinutes } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';

// Supabase Project ID is needed to invoke the Edge Function
const SUPABASE_PROJECT_ID = "yfgapigmiyclgryqdgne";
const SUPABASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co`;
const REGEN_COOLDOWN_MINUTES = 5; // Only trigger if last regen was more than 5 minutes ago

export const useEnergyRegenTrigger = () => {
  const { user, profile, refreshProfile } = useSession();
  const isTriggeringRef = useRef(false);

  useEffect(() => {
    if (!user || !profile || isTriggeringRef.current) return;

    const lastRegenAt = profile.last_energy_regen_at ? parseISO(profile.last_energy_regen_at) : null;
    const now = new Date();

    let shouldTrigger = false;

    if (!lastRegenAt) {
      // If last_energy_regen_at is null, trigger immediately
      shouldTrigger = true;
    } else {
      const minutesSinceLastRegen = differenceInMinutes(now, lastRegenAt);
      if (minutesSinceLastRegen >= REGEN_COOLDOWN_MINUTES) {
        shouldTrigger = true;
      }
    }

    if (shouldTrigger) {
      isTriggeringRef.current = true;
      console.log(`[EnergyRegen] Triggering server-side energy regeneration for user ${user.id}.`);
      
      const triggerRegen = async () => {
        try {
          // We call the trigger-energy-regen function which internally calls energy-regen
          const { error } = await supabase.functions.invoke('trigger-energy-regen', {
            method: 'POST',
            body: {},
          });

          if (error) {
            throw new Error(error.message);
          }
          
          // Wait a moment for the asynchronous regeneration to complete on the server
          await new Promise(resolve => setTimeout(resolve, 2000)); 
          
          // Force a profile refresh to get the new energy value
          await refreshProfile();
          console.log("[EnergyRegen] Energy regeneration complete and profile refreshed.");

        } catch (e: any) {
          console.error("[EnergyRegen] Failed to trigger energy regeneration:", e.message);
          // showError("Failed to update energy. Please try refreshing.");
        } finally {
          isTriggeringRef.current = false;
        }
      };

      triggerRegen();
    }
  }, [user, profile, refreshProfile]);
};