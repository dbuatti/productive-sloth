// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Supabase Project ID and URL are needed to invoke the Edge Function
const SUPABASE_PROJECT_ID = "yfgapigmiyclgryqdgne";
const SUPABASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co`;

serve(async (req) => {
  const functionName = "[trigger-energy-regen]";
  if (req.method === 'OPTIONS') {
    console.log(`${functionName} OPTIONS request received.`);
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log(`${functionName} Request received.`);
    // Get environment variables
    // @ts-ignore
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!SUPABASE_SERVICE_ROLE_KEY) {
        console.error(`${functionName} SUPABASE_SERVICE_ROLE_KEY is missing.`);
        throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing.");
    }

    const energyRegenUrl = `${SUPABASE_URL}/functions/v1/energy-regen`;
    console.log(`${functionName} Invoking energy-regen function at: ${energyRegenUrl}`);

    // 1. Invoke the main energy-regen function using fetch and Service Role Key
    const response = await fetch(energyRegenUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, // Authenticate with Service Role Key
        },
        body: JSON.stringify({}), // Empty body as energy-regen doesn't require input
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`${functionName} Error response from energy-regen: Status ${response.status}, Body: ${errorText}`);
        throw new Error(`Energy-regen failed with status ${response.status}: ${errorText}`);
    }
    console.log(`${functionName} Energy regeneration triggered successfully.`);

    return new Response(JSON.stringify({ message: "Energy regeneration triggered successfully." }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error(`${functionName} Edge Function error: ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});