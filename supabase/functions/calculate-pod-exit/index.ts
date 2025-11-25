// Removed Deno triple-slash directives and imports (FIX 7-15)
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.42.2';
import { differenceInMinutes } from 'https://esm.sh/date-fns@2.30.0';

// Constants
const REGEN_POD_RATE_PER_MINUTE = 2; // Energy gain per minute inside the pod
const MAX_ENERGY = 100;

// Initialize Supabase client with service role key
// NOTE: When deploying to Supabase Edge Functions, Deno.env.get is correct.
// For local compilation/testing, we assume standard environment access (process.env).
// FIX 10, 11: Using standard environment access for compilation compatibility.
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const { startTime, endTime } = await req.json();

        if (!startTime || !endTime) {
            return new Response(JSON.stringify({ error: 'Missing startTime or endTime in payload' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 1. Authenticate user via JWT from request header
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401 });
        }
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            console.error('Authentication error:', authError?.message);
            return new Response(JSON.stringify({ error: 'Invalid or expired token' }), { status: 401 });
        }

        const userId = user.id;

        // 2. Calculate duration
        const start = new Date(startTime);
        const end = new Date(endTime);
        const durationMinutes = differenceInMinutes(end, start);

        if (durationMinutes <= 0) {
            return new Response(JSON.stringify({ error: 'Pod duration was too short to calculate energy gain.' }), { status: 400 });
        }

        // 3. Calculate energy gain
        const energyGained = durationMinutes * REGEN_POD_RATE_PER_MINUTE;

        // 4. Fetch current profile data
        const { data: profileData, error: fetchError } = await supabase
            .from('profiles')
            .select('energy')
            .eq('id', userId)
            .single();

        if (fetchError || !profileData) {
            console.error('Error fetching profile:', fetchError?.message);
            return new Response(JSON.stringify({ error: 'Failed to fetch user profile.' }), { status: 500 });
        }

        // 5. Update profile with new energy level and record last regen time
        const newEnergy = Math.min(MAX_ENERGY, profileData.energy + energyGained);

        const { error: updateError } = await supabase
            .from('profiles')
            .update({
                energy: newEnergy,
                last_energy_regen_at: end.toISOString(), // Record last regen time
                updated_at: end.toISOString(),
            })
            .eq('id', userId);

        if (updateError) {
            console.error('Error updating profile:', updateError.message);
            return new Response(JSON.stringify({ error: 'Failed to update user profile with new energy.' }), { status: 500 });
        }

        // 6. Return success response
        return new Response(JSON.stringify({
            success: true,
            durationMinutes,
            energyGained,
            newEnergy,
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Edge Function Error:', error);
        return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});