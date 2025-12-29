import { useEffect, useState } from 'react'; // Changed useRef to useState
import { useSession } from './use-session';
import { parseISO, differenceInMinutes } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';

const REGEN_COOLDOWN_MINUTES = 5; // Only trigger if last regen was more than 5 minutes ago

export const useEnergyRegenTrigger = () => {
  const { user, profile, refreshProfile } = useSession();
  const [isTriggering, setIsTriggering] = useState(false); // Changed to state

  useEffect(() => {
    // If already triggering, or no user/profile, exit immediately.
    if (!user || !profile || isTriggering) { // Check state variable
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
      setIsTriggering(true); // Set state to true
      // console.log(`[EnergyRegen] Triggering server-side energy regeneration for user ${user.id}.`);
      
      const triggerRegen = async () => {
        try {
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
          // console.log("[EnergyRegen] Energy regeneration complete and profile refreshed.");

        } catch (e: any) {
          // console.error("[EnergyRegen] Failed to trigger energy regeneration:", e.message);
        } finally {
          setIsTriggering(false); // Set state to false
        }
      };

      triggerRegen();
    }
  }, [user, profile, refreshProfile, isTriggering]); // Add isTriggering to dependencies
};