// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// @ts-ignore
import * as jose from "https://esm.sh/jose@5.2.4"; // Import jose as a namespace
// @ts-ignore
import * as dateFns from 'https://esm.sh/date-fns@2.30.0'; // Import date-fns as namespace

// @ts-ignore
import { compactScheduleLogic, mergeOverlappingTimeBlocks, getFreeTimeBlocks, isSlotFree, setTimeOnDate, isMeal, calculateEnergyCost } from '../_shared/scheduler-utils.ts'; // Import scheduler utils

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Define the payload structure for the Edge Function
interface AutoBalancePayload {
  scheduledTaskIdsToDelete: string[];
  retiredTaskIdsToDelete: string[];
  tasksToInsert: any[]; // Use 'any' for now, as the structure is complex
  tasksToKeepInSink: any[]; // Use 'any' for now
  selectedDate: string;
  dynamicOccupiedBlocks: { start: string; end: string; duration: number }[]; // NEW: Add dynamic occupied blocks
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("[auto-balance-schedule] Auth Error: Missing Authorization header");
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // --- NEW: Fetch JWKS and verify with ECC P-256 ---
    // @ts-ignore
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    if (!SUPABASE_URL) {
      console.error("[auto-balance-schedule] Configuration Error: SUPABASE_URL is not set.");
      return new Response(JSON.stringify({ error: 'Configuration Error: SUPABASE_URL is not set.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const JWKS = jose.createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`));
    
    let payload;
    try {
      const { payload: verifiedPayload } = await jose.jwtVerify(token, JWKS, {
        algorithms: ['ES256'], // Specify the algorithm for ECC P-256
      });
      payload = verifiedPayload;
    } catch (jwtError: any) {
      console.error("[auto-balance-schedule] JWT Verification Error:", jwtError);
      return new Response(JSON.stringify({ error: `Unauthorized: Invalid JWT token - ${jwtError.message}` }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // --- END NEW: Fetch JWKS and verify with ECC P-256 ---
    
    const userId = payload.sub;

    if (!userId) {
      console.error("[auto-balance-schedule] Auth Error: Invalid JWT payload - missing user ID (sub).");
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid JWT payload' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { scheduledTaskIdsToDelete, retiredTaskIdsToDelete, tasksToInsert, tasksToKeepInSink, selectedDate, dynamicOccupiedBlocks: rawDynamicOccupiedBlocks }: AutoBalancePayload = await req.json(); // NEW: Destructure dynamicOccupiedBlocks

    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Convert rawDynamicOccupiedBlocks to Date objects
    const dynamicOccupiedBlocks = rawDynamicOccupiedBlocks.map(block => ({
      start: dateFns.parseISO(block.start),
      end: dateFns.parseISO(block.end),
      duration: block.duration,
    }));

    // Fetch user profile for workday window
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('default_auto_schedule_start_time, default_auto_schedule_end_time')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error("[auto-balance-schedule] Error fetching profile:", profileError?.message);
      throw new Error("Failed to fetch user profile for workday window.");
    }

    const selectedDayAsDate = dateFns.parseISO(selectedDate);
    const workdayStartTime = profile.default_auto_schedule_start_time 
      ? setTimeOnDate(selectedDayAsDate, profile.default_auto_schedule_start_time) 
      : dateFns.startOfDay(selectedDayAsDate);
    let workdayEndTime = profile.default_auto_schedule_end_time 
      ? setTimeOnDate(dateFns.startOfDay(selectedDayAsDate), profile.default_auto_schedule_end_time) 
      : dateFns.addHours(dateFns.startOfDay(selectedDayAsDate), 17);
    if (dateFns.isBefore(workdayEndTime, workdayStartTime)) {
      workdayEndTime = dateFns.addDays(workdayEndTime, 1);
    }
    const T_current = new Date(); // Current time on the server

    // 1. Delete scheduled tasks
    if (scheduledTaskIdsToDelete.length > 0) {
      console.log("[auto-balance-schedule] Deleting scheduled tasks:", scheduledTaskIdsToDelete);
      const { error } = await supabaseClient
        .from('scheduled_tasks')
        .delete()
        .in('id', scheduledTaskIdsToDelete)
        .eq('user_id', userId)
        .eq('scheduled_date', selectedDate);
      if (error) throw new Error(`[auto-balance-schedule] Failed to delete old scheduled tasks: ${error.message}`);
      console.log("[auto-balance-schedule] Scheduled tasks deleted successfully.");
    }

    // 2. Delete retired tasks
    if (retiredTaskIdsToDelete.length > 0) {
      console.log("[auto-balance-schedule] Deleting retired tasks:", retiredTaskIdsToDelete);
      const { error } = await supabaseClient
        .from('aethersink')
        .delete()
        .in('id', retiredTaskIdsToDelete)
        .eq('user_id', userId);
      if (error) throw new Error(`[auto-balance-schedule] Failed to delete old retired tasks: ${error.message}`);
      console.log("[auto-balance-schedule] Retired tasks deleted successfully.");
    }

    // 3. Insert/Upsert new scheduled tasks
    if (tasksToInsert.length > 0) {
      console.log("[auto-balance-schedule] Inserting/Upserting new scheduled tasks:", tasksToInsert.length);
      const tasksToInsertWithUserId = tasksToInsert.map(task => ({ ...task, user_id: userId }));
      const { error } = await supabaseClient
        .from('scheduled_tasks')
        .upsert(tasksToInsertWithUserId, { onConflict: 'id' }); // Changed to upsert with onConflict
      if (error) throw new Error(`[auto-balance-schedule] Failed to insert/upsert new scheduled tasks: ${error.message}`);
      console.log("[auto-balance-schedule] New scheduled tasks inserted/upserted successfully.");
    }

    // 4. Insert tasks back into the sink (those that couldn't be placed)
    if (tasksToKeepInSink.length > 0) {
      console.log("[auto-balance-schedule] Re-inserting tasks into sink:", tasksToKeepInSink.length);
      const tasksToKeepInSinkWithUserId = tasksToKeepInSink.map(task => ({ 
        ...task, 
        user_id: userId, 
        retired_at: new Date().toISOString() 
      }));
      const { error } = await supabaseClient
        .from('aethersink')
        .insert(tasksToKeepInSinkWithUserId);
      if (error) throw new Error(`[auto-balance-schedule] Failed to re-insert unscheduled tasks into sink: ${error.message}`);
      console.log("[auto-balance-schedule] Unscheduled tasks re-inserted into sink successfully.");
    }

    return new Response(JSON.stringify({ tasksPlaced: tasksToInsert.length, tasksKeptInSink: tasksToKeepInSink.length }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("[auto-balance-schedule] Edge Function error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});