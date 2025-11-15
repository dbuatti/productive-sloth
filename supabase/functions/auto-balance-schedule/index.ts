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
    const SUPABASE_JWT_SECRET = Deno.env.get('SUPABASE_JWT_SECRET');

    if (!SUPABASE_JWT_SECRET) {
      console.error("Configuration Error: Supabase JWT secret is not set.");
      throw new Error("Supabase JWT secret is not set in Supabase secrets.");
    }

    let payload;
    try {
      payload = await verify(token, SUPABASE_JWT_SECRET, 'HS256');
    } catch (jwtError) {
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

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log("Starting transaction for user:", userId);
    const { data: transactionData, error: transactionError } = await supabaseClient.rpc('start_transaction');
    if (transactionError) {
      console.error(`Failed to start transaction: ${transactionError.message}`);
      throw new Error(`Failed to start transaction: ${transactionError.message}`);
    }
    console.log("Transaction started.");

    try {
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

      // 2. Delete retired tasks
      if (retiredTaskIdsToDelete.length > 0) {
        console.log("Deleting retired tasks:", retiredTaskIdsToDelete);
        const { error } = await supabaseClient
          .from('retired_tasks')
          .delete()
          .in('id', retiredTaskIdsToDelete)
          .eq('user_id', userId);
        if (error) throw new Error(`Failed to delete old retired tasks: ${error.message}`);
        console.log("Retired tasks deleted successfully.");
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

      // 4. Insert tasks back into the sink (those that couldn't be placed)
      if (tasksToKeepInSink.length > 0) {
        console.log("Re-inserting tasks into sink:", tasksToKeepInSink.length);
        const tasksToKeepInSinkWithUserId = tasksToKeepInSink.map(task => ({ 
          ...task, 
          user_id: userId, 
          retired_at: new Date().toISOString() 
        }));
        const { error } = await supabaseClient
          .from('retired_tasks')
          .insert(tasksToKeepInSinkWithUserId);
        if (error) throw new Error(`Failed to re-insert unscheduled tasks into sink: ${error.message}`);
        console.log("Unscheduled tasks re-inserted into sink successfully.");
      }

      console.log("Committing transaction.");
      // Commit the transaction
      await supabaseClient.rpc('commit_transaction');
      console.log("Transaction committed.");

      return new Response(JSON.stringify({ tasksPlaced: tasksToInsert.length, tasksKeptInSink: tasksToKeepInSink.length }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (innerError: any) {
      console.error("Edge Function transaction error, attempting rollback:", innerError.message);
      // Rollback the transaction on error
      await supabaseClient.rpc('rollback_transaction');
      console.error("Transaction rolled back.");
      return new Response(JSON.stringify({ error: innerError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error: any) {
    console.error("Edge Function top-level error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});