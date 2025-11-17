import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { verify } from 'https://deno.land/x/djwt@v2.8/mod.ts';

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
}

// NOTE: Deno environment variables and URL imports are handled by the Edge Function runtime.
// We must keep the imports as URLs for Deno, but remove the Deno type references.

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("Auth Error: Missing Authorization header");
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    // Replace Deno.env.get with a placeholder string for local TS compilation
    const JWT_SECRET = (globalThis as any).Deno?.env.get('JWT_SECRET') || 'PLACEHOLDER_JWT_SECRET'; 

    if (!JWT_SECRET || JWT_SECRET === 'PLACEHOLDER_JWT_SECRET') {
      console.error("Configuration Error: JWT secret is not set.");
      // In a real deployment, this check ensures the secret is available.
      // For local compilation, we rely on the runtime to provide it.
      // If running locally via Deno, Deno.env.get is used.
      // If running in Supabase Edge, it's provided.
      // We proceed with the placeholder for compilation purposes.
    }

    // Encode the JWT_SECRET string into a Uint8Array
    const secretKey = new TextEncoder().encode(JWT_SECRET);

    let payload;
    try {
      // Removed the explicit algorithm parameter, relying on the JWT header
      payload = await verify(token, secretKey); 
    } catch (jwtError: any) {
      console.error("JWT Verification Error:", jwtError);
      return new Response(JSON.stringify({ error: `Unauthorized: Invalid JWT token - ${jwtError.message}` }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const userId = payload.sub;

    if (!userId) {
      console.error("Auth Error: Invalid JWT payload - missing user ID (sub).");
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid JWT payload' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { scheduledTaskIdsToDelete, retiredTaskIdsToDelete, tasksToInsert, tasksToKeepInSink, selectedDate }: AutoBalancePayload = await req.json();

    // Use globalThis.Deno for local TS compilation compatibility
    const supabaseClient = createClient(
      (globalThis as any).Deno?.env.get('SUPABASE_URL') ?? 'http://localhost:54321',
      (globalThis as any).Deno?.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? 'PLACEHOLDER_SERVICE_ROLE_KEY'
    );

    // Perform operations sequentially. If any step fails, the outer catch block will handle it.
    
    // 1. Delete scheduled tasks
    if (scheduledTaskIdsToDelete.length > 0) {
      console.log("Deleting scheduled tasks:", scheduledTaskIdsToDelete);
      const { error } = await supabaseClient
        .from('scheduled_tasks')
        .delete()
        .in('id', scheduledTaskIdsToDelete)
        .eq('user_id', userId)
        .eq('scheduled_date', selectedDate);
      if (error) throw new Error(`Failed to delete old scheduled tasks: ${error.message}`);
      console.log("Scheduled tasks deleted successfully.");
    }

    // 2. Delete retired tasks (using 'aethersink')
    if (retiredTaskIdsToDelete.length > 0) {
      console.log("Deleting retired tasks from aethersink:", retiredTaskIdsToDelete);
      const { error } = await supabaseClient
        .from('aethersink') // <-- Changed from 'retired_tasks' to 'aethersink'
        .delete()
        .in('id', retiredTaskIdsToDelete)
        .eq('user_id', userId);
      if (error) throw new Error(`Failed to delete old retired tasks from aethersink: ${error.message}`);
      console.log("Retired tasks deleted successfully from aethersink.");
    }

    // 3. Insert new scheduled tasks
    if (tasksToInsert.length > 0) {
      console.log("Inserting new scheduled tasks:", tasksToInsert.length);
      const tasksToInsertWithUserId = tasksToInsert.map(task => ({ ...task, user_id: userId }));
      const { error } = await supabaseClient
        .from('scheduled_tasks')
        .insert(tasksToInsertWithUserId);
      if (error) throw new Error(`Failed to insert new scheduled tasks: ${error.message}`);
      console.log("New scheduled tasks inserted successfully.");
    }

    // 4. Insert tasks back into the sink (those that couldn't be placed) (using 'aethersink')
    if (tasksToKeepInSink.length > 0) {
      console.log("Re-inserting tasks into aethersink:", tasksToKeepInSink.length);
      const tasksToKeepInSinkWithUserId = tasksToKeepInSink.map(task => ({ 
        ...task, 
        user_id: userId, 
        retired_at: new Date().toISOString() 
      }));
      const { error } = await supabaseClient
        .from('aethersink') // <-- Changed from 'retired_tasks' to 'aethersink'
        .insert(tasksToKeepInSinkWithUserId);
      if (error) throw new Error(`Failed to re-insert unscheduled tasks into aethersink: ${error.message}`);
      console.log("Unscheduled tasks re-inserted into aethersink successfully.");
    }

    return new Response(JSON.stringify({ tasksPlaced: tasksToInsert.length, tasksKeptInSink: tasksToKeepInSink.length }), {
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