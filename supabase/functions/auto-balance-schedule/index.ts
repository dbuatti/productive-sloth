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
  tasksToInsert: any[] | null | undefined; // Allow null/undefined from JSON parsing
  tasksToKeepInSink: any[] | null | undefined; // Allow null/undefined from JSON parsing
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
        is_work: task.is_work ?? false,
        is_break: task.is_break ?? false,
    };

    // CRITICAL FIX: Only include ID if it is explicitly provided AND truthy (for updates).
    // If it's falsy (null/undefined), we rely on the database default for new insertions.
    if (task.id) {
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
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // @ts-ignore
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    if (!SUPABASE_URL) {
      console.error(`${functionName} Configuration Error: SUPABASE_URL is not set.`);
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
      console.log(`${functionName} JWT verified successfully for user: ${payload.sub}`);
    } catch (jwtError: any) {
      console.error(`${functionName} JWT Verification Error: ${jwtError.message}`);
      return new Response(JSON.stringify({ error: `Unauthorized: Invalid JWT token - ${jwtError.message}` }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const userId = payload.sub;

    if (!userId) {
      console.error(`${functionName} Auth Error: Invalid JWT payload - missing user ID (sub).`);
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid JWT payload' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { scheduledTaskIdsToDelete, retiredTaskIdsToDelete, tasksToInsert: rawTasksToInsert, tasksToKeepInSink: rawTasksToKeepInSink, selectedDate }: AutoBalancePayload = await req.json();
    console.log(`${functionName} Received payload: scheduledTaskIdsToDelete=${scheduledTaskIdsToDelete.length}, retiredTaskIdsToDelete=${retiredTaskIdsToDelete.length}, tasksToInsert=${rawTasksToInsert?.length}, tasksToKeepInSink=${rawTasksToKeepInSink?.length}, selectedDate=${selectedDate}`);

    // Ensure tasksToInsert and tasksToKeepInSink are always arrays
    const tasksToInsert = Array.isArray(rawTasksToInsert) ? rawTasksToInsert : [];
    const tasksToKeepInSink = Array.isArray(rawTasksToKeepInSink) ? rawTasksToKeepInSink : [];

    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Delete scheduled tasks
    if (scheduledTaskIdsToDelete.length > 0) {
      console.log(`${functionName} Deleting scheduled tasks:`, scheduledTaskIdsToDelete);
      const { error } = await supabaseClient
        .from('scheduled_tasks')
        .delete()
        .in('id', scheduledTaskIdsToDelete)
        .eq('user_id', userId)
        .eq('scheduled_date', selectedDate);
      if (error) {
        console.error(`${functionName} Failed to delete old scheduled tasks: ${error.message}`);
        throw new Error(`Failed to delete old scheduled tasks: ${error.message}`);
      }
      console.log(`${functionName} Scheduled tasks deleted successfully.`);
    }

    // 2. Delete retired tasks
    if (retiredTaskIdsToDelete.length > 0) {
      console.log(`${functionName} Deleting retired tasks:`, retiredTaskIdsToDelete);
      const { error } = await supabaseClient
        .from('aethersink')
        .delete()
        .in('id', retiredTaskIdsToDelete)
        .eq('user_id', userId);
      if (error) {
        console.error(`${functionName} Failed to delete old retired tasks: ${error.message}`);
        throw new Error(`Failed to delete old retired tasks: ${error.message}`);
      }
      console.log(`${functionName} Retired tasks deleted successfully.`);
    }

    // 3. Insert/Update new scheduled tasks
    if (tasksToInsert.length > 0) {
      const tasksToInsertWithUserId = tasksToInsert.map(task => sanitizeScheduledTask(task, userId));
      
      const tasksToUpdate = tasksToInsertWithUserId.filter(t => t.id);
      const tasksToInsertNew = tasksToInsertWithUserId.filter(t => !t.id);

      // 3a. Update existing tasks (where ID is present)
      if (tasksToUpdate.length > 0) {
        console.log(`${functionName} Updating existing scheduled tasks: ${tasksToUpdate.length}`);
        const { error } = await supabaseClient
          .from('scheduled_tasks')
          .upsert(tasksToUpdate, { onConflict: 'id' }); 
        if (error) {
          console.error(`${functionName} Failed to update existing scheduled tasks: ${error.message}`);
          throw new Error(`Failed to update existing scheduled tasks: ${error.message}`);
        }
        console.log(`${functionName} Existing scheduled tasks updated successfully.`);
      }

      // 3b. Insert new tasks (where ID is missing)
      if (tasksToInsertNew.length > 0) {
        console.log(`${functionName} Inserting new scheduled tasks: ${tasksToInsertNew.length}`);
        const { error } = await supabaseClient
          .from('scheduled_tasks')
          .insert(tasksToInsertNew); 
        if (error) {
          console.error(`${functionName} Failed to insert new scheduled tasks: ${error.message}`);
          throw new Error(`Failed to insert new scheduled tasks: ${error.message}`);
        }
        console.log(`${functionName} New scheduled tasks inserted successfully.`);
      }
    }

    // 4. Insert tasks back into the sink (those that couldn't be placed)
    if (tasksToKeepInSink.length > 0) {
      console.log(`${functionName} Re-inserting tasks into sink: ${tasksToKeepInSink.length}`);
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
        is_work: task.is_work ?? false,
        is_break: task.is_break ?? false,
      }));
      
      const { error } = await supabaseClient
        .from('aethersink')
        .insert(tasksToKeepInSinkWithUserId);
      if (error) {
        console.error(`${functionName} Failed to re-insert unscheduled tasks into sink: ${error.message}`);
        throw new Error(`Failed to re-insert unscheduled tasks into sink: ${error.message}`);
      }
      console.log(`${functionName} Unscheduled tasks re-inserted into sink successfully.`);
    }

    return new Response(JSON.stringify({ tasksPlaced: tasksToInsert.length, tasksKeptInSink: tasksToKeepInSink.length }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error(`${functionName} Edge Function error: ${error.message}`, error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});