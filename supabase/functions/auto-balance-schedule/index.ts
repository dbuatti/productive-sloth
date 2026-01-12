// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// @ts-ignore
import * as jose from "https://esm.sh/jose@5.2.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AutoBalancePayload {
  scheduledTaskIdsToDelete: string[];
  retiredTaskIdsToDelete: string[];
  tasksToInsert: any[] | null | undefined;
  tasksToKeepInSink: any[] | null | undefined;
  selectedDate: string;
}

const sanitizeScheduledTask = (task: any, userId: string): any => {
    const sanitized: any = {
        user_id: userId,
        name: task.name || 'Untitled Task',
        break_duration: task.break_duration || null,
        start_time: task.start_time || null,
        end_time: task.end_time || null,
        scheduled_date: task.scheduled_date,
        is_critical: task.is_critical ?? false,
        is_flexible: task.is_flexible ?? true,
        is_locked: task.is_locked ?? false,
        energy_cost: task.energy_cost ?? 0,
        is_completed: task.is_completed ?? false,
        is_custom_energy_cost: task.is_custom_energy_cost ?? false,
        task_environment: task.task_environment || 'laptop',
        source_calendar_id: task.source_calendar_id || null,
        is_backburner: task.is_backburner ?? false,
        is_work: task.is_work ?? false,
        is_break: task.is_break ?? false,
    };

    // Only include 'id' if it's explicitly provided and not undefined
    if (task.id !== undefined) {
        sanitized.id = task.id;
    }
    
    return sanitized;
};

serve(async (req) => {
  const functionName = "[auto-balance-schedule]";
  if (req.method === 'OPTIONS') {
    console.log(`${functionName} OPTIONS request received.`);
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log(`${functionName} Request received.`);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error(`${functionName} Auth Error: Missing Authorization header`);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const token = authHeader.replace('Bearer ', '');
    // @ts-ignore
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    // @ts-ignore
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL) {
      console.error(`${functionName} Configuration Error: SUPABASE_URL is not set.`);
      return new Response(JSON.stringify({ error: 'Configuration Error: SUPABASE_URL is not set.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      console.error(`${functionName} Configuration Error: SUPABASE_SERVICE_ROLE_KEY is not set.`);
      return new Response(JSON.stringify({ error: 'Configuration Error: SUPABASE_SERVICE_ROLE_KEY is not set.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const JWKS = jose.createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`));
    const { payload } = await jose.jwtVerify(token, JWKS, { algorithms: ['ES256'] });
    const userId = payload.sub;

    if (!userId) {
      console.error(`${functionName} Auth Error: Invalid JWT payload - missing user ID (sub).`);
      throw new Error('Invalid JWT payload');
    }

    const { scheduledTaskIdsToDelete, retiredTaskIdsToDelete, tasksToInsert: rawTasksToInsert, tasksToKeepInSink: rawTasksToKeepInSink, selectedDate }: AutoBalancePayload = await req.json();
    
    const tasksToInsert = Array.isArray(rawTasksToInsert) ? rawTasksToInsert : [];
    const tasksToKeepInSink = Array.isArray(rawTasksToKeepInSink) ? rawTasksToKeepInSink : [];

    console.log(`${functionName} Processing for User ${userId}. Selected Date: ${selectedDate}`);
    console.log(`${functionName} Tasks to Insert (count: ${tasksToInsert.length}):`, tasksToInsert.map(t => ({ id: t.id, name: t.name })));
    console.log(`${functionName} Tasks to Keep in Sink (count: ${tasksToKeepInSink.length}):`, tasksToKeepInSink.map(t => ({ id: t.id, name: t.name })));
    console.log(`${functionName} Scheduled Task IDs to Delete (count: ${scheduledTaskIdsToDelete.length}):`, scheduledTaskIdsToDelete);
    console.log(`${functionName} Retired Task IDs to Delete (count: ${retiredTaskIdsToDelete.length}):`, retiredTaskIdsToDelete);

    const supabaseClient = createClient(SUPABASE_URL ?? '', SUPABASE_SERVICE_ROLE_KEY ?? '');

    // 1. Delete old records from both tables
    if (scheduledTaskIdsToDelete.length > 0) {
      console.log(`${functionName} Deleting ${scheduledTaskIdsToDelete.length} scheduled tasks.`);
      const { error } = await supabaseClient.from('scheduled_tasks').delete().in('id', scheduledTaskIdsToDelete).eq('user_id', userId);
      if (error) {
        console.error(`${functionName} Error deleting scheduled tasks:`, error.message);
        throw error;
      }
    }
    if (retiredTaskIdsToDelete.length > 0) {
      console.log(`${functionName} Deleting ${retiredTaskIdsToDelete.length} retired tasks.`);
      const { error } = await supabaseClient.from('aethersink').delete().in('id', retiredTaskIdsToDelete).eq('user_id', userId);
      if (error) {
        console.error(`${functionName} Error deleting retired tasks:`, error.message);
        throw error;
      }
    }

    // 2. Insert placed tasks into schedule
    if (tasksToInsert.length > 0) {
      console.log(`${functionName} Upserting ${tasksToInsert.length} tasks into scheduled_tasks.`);
      const sanitized = tasksToInsert.map(t => sanitizeScheduledTask(t, userId));
      const { error } = await supabaseClient.from('scheduled_tasks').upsert(sanitized, { onConflict: 'id' });
      if (error) {
        console.error(`${functionName} Error upserting scheduled tasks:`, error.message);
        throw error;
      }
    }

    // 3. Re-insert/Upsert unplaced tasks back into the Sink
    if (tasksToKeepInSink.length > 0) {
      console.log(`${functionName} Upserting ${tasksToKeepInSink.length} tasks back into aethersink.`);
      const sanitizedSink = tasksToKeepInSink.map(t => ({
        ...t,
        user_id: userId,
        retired_at: new Date().toISOString(),
        is_locked: t.is_locked ?? false,
        is_completed: t.is_completed ?? false,
        task_environment: t.task_environment || 'laptop'
      }));
      
      // Use upsert to prevent unique constraint failures
      const { error } = await supabaseClient.from('aethersink').upsert(sanitizedSink, { onConflict: 'user_id, name, original_scheduled_date' });
      if (error) {
        console.error(`${functionName} Re-insertion error:`, error.message);
        throw error;
      }
    }

    return new Response(JSON.stringify({ success: true, tasksPlaced: tasksToInsert.length, tasksReturnedToSink: tasksToKeepInSink.length }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error(`${functionName} Execution Error:`, error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});