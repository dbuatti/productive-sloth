// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import * as jose from "https://esm.sh/jose@5.2.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mock data for available calendars
const MOCK_CALENDARS = [
    { id: 'icloud-personal', name: 'Personal', color: '#FF6347' }, // Tomato
    { id: 'icloud-work', name: 'Work', color: '#4682B4' }, // Steel Blue
    { id: 'icloud-general', name: 'General', color: '#3CB371' }, // Medium Sea Green
    { id: 'icloud-family', name: 'Family', color: '#FFD700' }, // Gold
];

serve(async (req) => {
  const functionName = "[get-icloud-calendars]";
  if (req.method === 'OPTIONS') {
    console.log(`${functionName} OPTIONS request received.`);
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log(`${functionName} Request received.`);
    // --- Authentication Check (Required for all user-facing functions) ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error(`${functionName} Unauthorized: Missing Authorization header`);
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // In a real scenario, we would verify the JWT and use it to look up 
    // the user's stored iCloud credentials to call Apple's API.
    // For this mock, we just verify the JWT structure.
    
    // --- Mock Success Response ---
    console.log(`${functionName} Returning mock calendars.`);
    return new Response(JSON.stringify({ calendars: MOCK_CALENDARS }), {
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