// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// @ts-ignore
import * as jose from "https://esm.sh/jose@5.2.4"; // Import jose as a namespace
// @ts-ignore
import * as dateFns from 'https://esm.sh/date-fns@2.30.0'; // Import as namespace

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Constants for energy regeneration (mirroring client-side for consistency)
const MAX_ENERGY = 100; 
const REGEN_POD_RATE_PER_MINUTE = 1; // +1 Energy per minute

interface PodExitPayload {
    startTime: string;
    endTime: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const now = new Date(); 

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

    const { startTime, endTime }: PodExitPayload = await req.json();

    const podStart = dateFns.parseISO(startTime);
    const podEnd = dateFns.parseISO(endTime);
    
    // Calculate actual duration spent in the pod
    const durationMinutes = dateFns.differenceInMinutes(podEnd, podStart);
    
    if (durationMinutes <= 0) {
        return new Response(JSON.stringify({ energyGained: 0, durationMinutes: 0, message: "Pod exited immediately." }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // Calculate energy gain
    const energyGained = Math.floor(durationMinutes * REGEN_POD_RATE_PER_MINUTE);

    // Use Service Role Key for profile update
    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Fetch current profile data
    const { data: profileData, error: profileFetchError } = await supabaseClient
        .from('profiles')
        .select('energy')
        .eq('id', userId)
        .single();

    if (profileFetchError || !profileData) {
        console.error("Error fetching profile:", profileFetchError?.message);
        throw new Error("Failed to fetch user profile.");
    }

    const currentEnergy = profileData.energy ?? 0;
    const newEnergy = Math.min(currentEnergy + energyGained, MAX_ENERGY);

    // 2. Update profile energy
    const { error: profileUpdateError } = await supabaseClient
      .from('profiles')
      .update({ 
          energy: newEnergy, 
          updated_at: now.toISOString(),
          last_energy_regen_at: now.toISOString(), // Update regen timestamp
      })
      .eq('id', userId);

    if (profileUpdateError) {
      console.error("Error updating profile energy:", profileUpdateError.message);
      throw new Error("Failed to update profile energy.");
    }

    return new Response(JSON.stringify({ energyGained, durationMinutes }), {
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