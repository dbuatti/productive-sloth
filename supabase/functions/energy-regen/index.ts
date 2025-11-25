// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// @ts-ignore
import * as dateFns from 'https://esm.sh/date-fns@2.30.0'; // Import as namespace

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Constants for energy regeneration (mirroring client-side for consistency)
const MAX_ENERGY = 100; // Ensure this matches your client-side constant
const PASSIVE_ENERGY_REGEN_PER_MINUTE = 1 / 60; // +1 Energy per hour
const BREAK_ENERGY_BOOST_PER_MINUTE = 2 / 60; // +2 Energy per break-hour (additional to passive)
const NIGHT_ENERGY_BOOST_PER_MINUTE = 5 / 60; // +5 Energy per night-hour (additional to passive)

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use the service role key for database access to bypass RLS
    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const now = new Date(); // Current time in UTC

    // 1. Fetch all profiles
    const { data: profiles, error: profilesError } = await supabaseClient
      .from('profiles')
      .select('id, energy, last_energy_regen_at, default_auto_schedule_start_time, default_auto_schedule_end_time');

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError.message);
      throw new Error("Failed to fetch profiles.");
    }

    // 2. Fetch all scheduled tasks for today (UTC) for all users
    // This is a simplified approach. A more robust solution might fetch tasks for a wider window
    // or fetch per user if the total number of tasks is too large.
    const todayStartUTC = dateFns.startOfDay(now);
    const todayEndUTC = dateFns.addDays(todayStartUTC, 1);

    const { data: scheduledTasks, error: tasksError } = await supabaseClient
      .from('scheduled_tasks')
      .select('user_id, name, start_time, end_time')
      .gte('start_time', todayStartUTC.toISOString())
      .lt('end_time', todayEndUTC.toISOString());

    if (tasksError) {
      console.error("Error fetching scheduled tasks:", tasksError.message);
      throw new Error("Failed to fetch scheduled tasks.");
    }

    // Group scheduled tasks by user_id for quick lookup
    const scheduledTasksMap = new Map<string, typeof scheduledTasks>();
    scheduledTasks.forEach(task => {
      if (!scheduledTasksMap.has(task.user_id)) {
        scheduledTasksMap.set(task.user_id, []);
      }
      scheduledTasksMap.get(task.user_id)?.push(task);
    });

    const updates = [];

    // 3. Iterate through each user profile to calculate and apply energy regeneration
    for (const profile of profiles) {
      // Ensure currentEnergy is a number, defaulting to MAX_ENERGY if null/undefined
      const currentEnergy = profile.energy ?? MAX_ENERGY; 
      const userId = profile.id;
      const lastRegenAt = profile.last_energy_regen_at ? dateFns.parseISO(profile.last_energy_regen_at) : now;

      const elapsedMinutes = dateFns.differenceInMinutes(now, lastRegenAt);

      if (elapsedMinutes <= 0 || currentEnergy >= MAX_ENERGY) {
        continue; // No time elapsed or energy is already full
      }

      let totalEnergyGained = 0;
      let currentTimeCursor = lastRegenAt;

      // Simulate minute-by-minute regeneration for accuracy, especially with boosts
      while (currentTimeCursor < now && (currentEnergy + totalEnergyGained) < MAX_ENERGY) {
        const intervalEnd = dateFns.addMinutes(currentTimeCursor, 1);
        const actualIntervalEnd = dateFns.min([intervalEnd, now]);
        const durationInChunk = dateFns.differenceInMinutes(actualIntervalEnd, currentTimeCursor);

        if (durationInChunk <= 0) break;

        let regenForChunk = durationInChunk * PASSIVE_ENERGY_REGEN_PER_MINUTE;

        const userScheduledTasksToday = scheduledTasksMap.get(userId) || [];

        let isDuringBreak = false;
        let isDuringNighttime = false;

        // Check for Scheduled Break
        for (const task of userScheduledTasksToday) {
          if (task.name?.toLowerCase() === 'break' && task.start_time && task.end_time) {
            const taskStart = dateFns.parseISO(task.start_time);
            const taskEnd = dateFns.parseISO(task.end_time);
            if (currentTimeCursor >= taskStart && currentTimeCursor < taskEnd) {
              isDuringBreak = true;
              break;
            }
          }
        }

        // Check for Nighttime Recovery (outside default auto-schedule window)
        if (profile.default_auto_schedule_start_time && profile.default_auto_schedule_end_time) {
          const workdayStart = dateFns.setHours(dateFns.setMinutes(dateFns.startOfDay(currentTimeCursor), parseInt(profile.default_auto_schedule_start_time.split(':')[1])), parseInt(profile.default_auto_schedule_start_time.split(':')[0]));
          let workdayEnd = dateFns.setHours(dateFns.setMinutes(dateFns.startOfDay(currentTimeCursor), parseInt(profile.default_auto_schedule_end_time.split(':')[1])), parseInt(profile.default_auto_schedule_end_time.split(':')[0]));

          // Handle workday end crossing midnight
          if (dateFns.isBefore(workdayEnd, workdayStart)) {
            workdayEnd = dateFns.addDays(workdayEnd, 1);
          }

          if (dateFns.isAfter(currentTimeCursor, workdayEnd) || dateFns.isBefore(currentTimeCursor, workdayStart)) {
            isDuringNighttime = true;
          }
        } else {
          // Fallback to a fixed nighttime window if no default auto-schedule times are set
          // For simplicity, let's define a global UTC nighttime window for this fallback
          const hour = currentTimeCursor.getUTCHours();
          if (hour >= 22 || hour < 6) { // 10 PM UTC to 6 AM UTC
            isDuringNighttime = true;
          }
        }

        if (isDuringBreak) {
          regenForChunk += durationInChunk * BREAK_ENERGY_BOOST_PER_MINUTE;
        }
        if (isDuringNighttime) {
          regenForChunk += durationInChunk * NIGHT_ENERGY_BOOST_PER_MINUTE;
        }

        totalEnergyGained += regenForChunk;
        currentTimeCursor = actualIntervalEnd;
      }

      const newEnergy = Math.min(currentEnergy + totalEnergyGained, MAX_ENERGY);

      if (newEnergy !== currentEnergy) {
        updates.push({
          id: userId,
          energy: Math.round(newEnergy), // Ensure energy is an integer before upserting
          last_energy_regen_at: now.toISOString(),
        });
      }
    }

    // Perform batch update
    if (updates.length > 0) {
      const { error: updateError } = await supabaseClient
        .from('profiles')
        .upsert(updates, { onConflict: 'id' });

      if (updateError) {
        console.error("Error updating profiles energy:", updateError.message);
        throw new Error("Failed to update profiles energy.");
      }
      console.log(`Successfully updated energy for ${updates.length} profiles.`);
    } else {
      console.log("No energy updates needed for any profiles.");
    }

    return new Response(JSON.stringify({ message: `Energy regeneration processed for ${profiles.length} users.` }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("Edge Function error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});