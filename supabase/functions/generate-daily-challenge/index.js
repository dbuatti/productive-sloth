import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

// Base challenge: 3 tasks. Difficulty increases by 1 task every 5 levels.
const BASE_TARGET = 3;
const DIFFICULTY_INCREASE_LEVEL_INTERVAL = 5;

// Function to calculate the dynamic target
function calculateTarget(level) {
    if (level <= 1) return BASE_TARGET;
    const increase = Math.floor((level - 1) / DIFFICULTY_INCREASE_LEVEL_INTERVAL);
    return BASE_TARGET + increase;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization') } } }
    );

    // 1. Get User ID from JWT
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const userId = user.id;

    // 2. Fetch current profile data (level, last claim date)
    const { data: profileData, error: profileError } = await supabaseClient
      .from('profiles')
      .select('level, last_daily_reward_claim')
      .eq('id', userId)
      .single();

    if (profileError || !profileData) {
      console.error('Error fetching profile:', profileError);
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    const { level, last_daily_reward_claim } = profileData;
    const now = new Date();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD

    // Check if the challenge was claimed today
    const lastClaimDate = last_daily_reward_claim ? new Date(last_daily_reward_claim).toISOString().split('T')[0] : null;
    const hasClaimedToday = lastClaimDate === today;

    // If claimed today, no need to reset or update target, just return current status
    if (hasClaimedToday) {
        return new Response(JSON.stringify({ 
            message: 'Challenge already claimed today.',
            target: profileData.daily_challenge_target
        }), {
            status: 200,
            headers: corsHeaders,
        });
    }

    // 3. Calculate new dynamic target
    const newTarget = calculateTarget(level);

    // 4. Update profile: reset tasks_completed_today and set new dynamic target
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({ 
        daily_challenge_target: newTarget,
        tasks_completed_today: 0, // Reset counter for the new day/challenge
        updated_at: now.toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating profile:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update challenge target' }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify({ 
        message: 'Daily challenge target updated.',
        target: newTarget
    }), {
      status: 200,
      headers: corsHeaders,
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});