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
    // @ts-ignore
    const JWT_SECRET = Deno.env.get('JWT_SECRET'); 

    if (!JWT_SECRET) {
      console.error("Configuration Error: JWT secret is not set.");
      return new Response(JSON.stringify({ error: 'Configuration Error: JWT secret is not set.' }), {
        status: 500, // Changed to 500 as it's a server configuration issue
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Log a masked version of the secret to confirm it's loaded (for debugging only)
    console.log(`JWT_SECRET loaded: ${JWT_SECRET.substring(0, 5)}...${JWT_SECRET.substring(JWT_SECRET.length - 5)}`);

    // Encode the JWT_SECRET string into a Uint8Array
    const secretKey = new TextEncoder().encode(JWT_SECRET);
    
    // Use jose.importJWK to import the symmetric key
    const cryptoKey = await jose.importJWK(
      {
        kty: 'oct', // Octet sequence key type for symmetric keys
        k: jose.base64url.encode(secretKey), // Base64url encode the secret key
      },
      'HS256' // Algorithm used by Supabase for JWTs
    );

    let payload;
    try {
      const { payload: verifiedPayload } = await jose.jwtVerify(token, cryptoKey); // Access jwtVerify from jose namespace
      payload = verifiedPayload;
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

    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Perform operations sequentially. If any step fails, the outer catch block will handle it.
    // This is not a true ACID transaction across multiple tables, but it's a common and robust pattern
    // for serverless functions where full database transactions might be complex or not directly supported.
    
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
        .from('aethersink')
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
        .from('aethersink')
        .insert(tasksToKeepInSinkWithUserId);
      if (error) throw new Error(`Failed to re-insert unscheduled tasks into sink: ${error.message}`);
      console.log("Unscheduled tasks re-inserted into sink successfully.");
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