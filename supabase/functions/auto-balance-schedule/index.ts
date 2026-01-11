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

    if (task.id) {
        sanitized.id = task.id;
    }
    
    return sanitized;
};

serve(async (req) => {
  const functionName = "[auto-balance-schedule]";
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const JWKS = jose.createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`));
    const { payload } = await jose.jwtVerify(token, JWKS, { algorithms: ['ES256'] });
    const userId = payload.sub;

    if (!userId) throw new Error('Invalid JWT payload');

    const { scheduledTaskIdsToDelete, retiredTaskIdsToDelete, tasksToInsert: rawTasksToInsert, tasksToKeepInSink: rawTasksToKeepInSink, selectedDate }: AutoBalancePayload = await req.json();
    
    const tasksToInsert = Array.isArray(rawTasksToInsert) ? rawTasksToInsert : [];
    const tasksToKeepInSink = Array.isArray(rawTasksToKeepInSink) ? rawTasksToKeepInSink : [];

    console.log(`${functionName} Processing for User ${userId}. Placing: ${tasksToInsert.length}, Returning to Sink: ${tasksToKeepInSink.length}`);

    const supabaseClient = createClient(SUPABASE_URL ?? '', SUPABASE_SERVICE_ROLE_KEY ?? '');

    // 1. Delete old records from both tables
    if (scheduledTaskIdsToDelete.length > 0) {
      await supabaseClient.from('scheduled_tasks').delete().in('id', scheduledTaskIdsToDelete).eq('user_id', userId);
    }
    if (retiredTaskIdsToDelete.length > 0) {
      await supabaseClient.from('aethersink').delete().in('id', retiredTaskIdsToDelete).eq('user_id', userId);
    }

    // 2. Insert placed tasks into schedule
    if (tasksToInsert.length > 0) {
      const sanitized = tasksToInsert.map(t => sanitizeScheduledTask(t, userId));
      const { error } = await supabaseClient.from('scheduled_tasks').upsert(sanitized, { onConflict: 'id' });
      if (error) throw error;
    }

    // 3. Re-insert/Upsert unplaced tasks back into the Sink
    if (tasksToKeepInSink.length > 0) {
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