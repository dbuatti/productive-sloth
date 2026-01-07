// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// @ts-ignore
import * as jose from "https://esm.sh/jose@5.2.4"; // Import jose as a namespace

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Define the payload structure for the Edge Function
interface AutoBalancePayload {
  scheduledTaskIdsToDelete: string[];
  retiredTaskIdsToDelete: string[];
  tasksToInsert: any[]; // Tasks to be inserted/updated
  tasksToKeepInSink: any[]; // Tasks to be re-inserted into sink
  selectedDate: string;
}

// Helper function to ensure required fields have defaults and handles 'id' correctly for upsert
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
    };

    // CRITICAL FIX: Only include ID if it is explicitly provided AND truthy (for updates).
    // If it's falsy (null/undefined), we rely on the database default for new insertions.
    if (task.id) {
        sanitized.id = task.id;
    }
    
    return sanitized;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const functionName = "[auto-balance-schedule]";

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // --- JWT Verification ---
    // @ts-ignore
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    if (!SUPABASE_URL) {
      return new Response(JSON.stringify({ error: 'Configuration Error: SUPABASE_URL is not set.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const JWKS = jose.createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`));
    
    let payload;
    try {
      const { payload: verifiedPayload } = await jose.jwtVerify(token, JWKS, {
        algorithms: ['ES256'],
      });
      payload = verifiedPayload;
    } catch (jwtError: any) {
      return new Response(JSON.stringify({ error: `Unauthorized: Invalid JWT token - ${jwtError.message}` }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const userId = payload.sub;

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid JWT payload' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { scheduledTaskIdsToDelete, retiredTaskIdsToDelete, tasksToInsert, tasksToKeepInSink, selectedDate }: AutoBalancePayload = await req.json();

    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Delete scheduled tasks
    if (scheduledTaskIdsToDelete.length > 0) {
      const { error } = await supabaseClient
        .from('scheduled_tasks')
        .delete()
        .in('id', scheduledTaskIdsToDelete)
        .eq('user_id', userId)
        .eq('scheduled_date', selectedDate);
      if (error) throw new Error(`Failed to delete old scheduled tasks: ${error.message}`);
    }

    // 2. Delete retired tasks
    if (retiredTaskIdsToDelete.length > 0) {
      const { error } = await supabaseClient
        .from('aethersink')
        .delete()
        .in('id', retiredTaskIdsToDelete)
        .eq('user_id', userId);
      if (error) throw new Error(`Failed to delete old retired tasks: ${error.message}`);
    }

    // 3. Insert/Update new scheduled tasks
    if (tasksToInsert.length > 0) {
      const tasksToInsertWithUserId = tasksToInsert.map(task => sanitizeScheduledTask(task, userId));
      
      const tasksToUpdate = tasksToInsertWithUserId.filter(t => t.id);
      const tasksToInsertNew = tasksToInsertWithUserId.filter(t => !t.id);

      // 3a. Update existing tasks (where ID is present)
      if (tasksToUpdate.length > 0) {
        const { error } = await supabaseClient
          .from('scheduled_tasks')
          .upsert(tasksToUpdate, { onConflict: 'id' }); 
        if (error) throw new Error(`Failed to update existing scheduled tasks: ${error.message}`);
      }

      // 3b. Insert new tasks (where ID is missing)
      if (tasksToInsertNew.length > 0) {
        // CRITICAL: Use insert() for new tasks to allow DB to generate UUID
        const { error } = await supabaseClient
          .from('scheduled_tasks')
          .insert(tasksToInsertNew); 
        if (error) throw new Error(`Failed to insert new scheduled tasks: ${error.message}`);
      }
    }

    // 4. Insert tasks back into the sink (those that couldn't be placed)
    if (tasksToKeepInSink.length > 0) {
      const tasksToKeepInSinkWithUserId = tasksToKeepInSink.map(task => ({ 
        ...task, 
        user_id: userId, 
        retired_at: new Date().toISOString(),
        // Ensure required fields for aethersink are present
        name: task.name || 'Untitled Retired Task',
        duration: task.duration || null,
        break_duration: task.break_duration || null,
        original_scheduled_date: task.original_scheduled_date || selectedDate,
        is_critical: task.is_critical ?? false,
        is_locked: task.is_locked ?? false,
        energy_cost: task.energy_cost ?? 0,
        is_completed: task.is_completed ?? false,
        is_custom_energy_cost: task.is_custom_energy_cost ?? false,
        task_environment: task.task_environment || 'laptop',
        is_backburner: task.is_backburner ?? false,
      }));
      
      const { error } = await supabaseClient
        .from('aethersink')
        .insert(tasksToKeepInSinkWithUserId);
      if (error) throw new Error(`Failed to re-insert unscheduled tasks into sink: ${error.message}`);
    }

    return new Response(JSON.stringify({ tasksPlaced: tasksToInsert.length, tasksKeptInSink: tasksToKeepInSink.length }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});