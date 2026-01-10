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

interface RestorePayload {
  snapshotId: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const functionName = "[restore-aethersink-snapshot]";

  try {
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
    } catch (jwtError: any) {
      console.error(`${functionName} JWT Verification Error:`, jwtError);
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

    const { snapshotId }: RestorePayload = await req.json();

    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Use service role key for direct DB access
    );

    // 1. Fetch the snapshot data
    console.log(`${functionName} Fetching snapshot ${snapshotId} for user ${userId}`);
    const { data: snapshot, error: fetchError } = await supabaseClient
      .from('aethersink_snapshots')
      .select('sink_data')
      .eq('snapshot_id', snapshotId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !snapshot) {
      console.error(`${functionName} Error fetching snapshot:`, fetchError?.message || 'Snapshot not found');
      throw new Error(`Failed to retrieve snapshot: ${fetchError?.message || 'Snapshot not found'}`);
    }

    const tasksToRestore = snapshot.sink_data;
    if (!Array.isArray(tasksToRestore)) {
      console.error(`${functionName} Invalid snapshot data format: sink_data is not an array.`);
      throw new Error('Invalid snapshot data format.');
    }

    // 2. Delete all UNLOCKED tasks from the current aethersink for this user
    console.log(`${functionName} Deleting unlocked tasks from current aethersink for user ${userId}`);
    const { error: deleteError } = await supabaseClient
      .from('aethersink')
      .delete()
      .eq('user_id', userId)
      .eq('is_locked', false); // Only delete unlocked tasks

    if (deleteError) {
      console.error(`${functionName} Error deleting current aethersink tasks:`, deleteError.message);
      throw new Error(`Failed to clear current Aether Sink: ${deleteError.message}`);
    }
    console.log(`${functionName} Unlocked tasks cleared from Aether Sink.`);

    // 3. Insert the tasks from the snapshot
    if (tasksToRestore.length > 0) {
      console.log(`${functionName} Inserting ${tasksToRestore.length} tasks from snapshot into aethersink.`);
      // Ensure user_id is correctly set for each task and other defaults are handled
      const sanitizedTasksToInsert = tasksToRestore.map((task: any) => ({
        ...task,
        user_id: userId,
        retired_at: new Date().toISOString(), // Update retired_at to now
        is_locked: task.is_locked ?? false,
        is_completed: task.is_completed ?? false,
        is_custom_energy_cost: task.is_custom_energy_cost ?? false,
        task_environment: task.task_environment ?? 'laptop',
        is_backburner: task.is_backburner ?? false,
        is_work: task.is_work ?? false,
        is_break: task.is_break ?? false,
        // Ensure 'id' is not passed for new inserts, let DB generate
        id: undefined, 
      }));

      const { error: insertError } = await supabaseClient
        .from('aethersink')
        .insert(sanitizedTasksToInsert);

      if (insertError) {
        console.error(`${functionName} Error inserting tasks from snapshot:`, insertError.message);
        throw new Error(`Failed to restore tasks from snapshot: ${insertError.message}`);
      }
      console.log(`${functionName} Tasks restored successfully.`);
    } else {
      console.log(`${functionName} No tasks in snapshot to restore.`);
    }

    return new Response(JSON.stringify({ message: `Aether Sink restored from snapshot ${snapshotId}.` }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error(`${functionName} Edge Function error:`, error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});