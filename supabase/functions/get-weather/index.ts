// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const functionName = "[get-weather]";
  if (req.method === 'OPTIONS') {
    console.log(`${functionName} OPTIONS request received.`);
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { city, lat, lon } = await req.json();
    console.log(`${functionName} Request received for city: ${city}, lat: ${lat}, lon: ${lon}`);
    // @ts-ignore
    const OPENWEATHER_API_KEY = Deno.env.get('OPENWEATHER_API_KEY');

    if (!OPENWEATHER_API_KEY) {
      console.error(`${functionName} OpenWeatherMap API key is not set.`);
      throw new Error("OpenWeatherMap API key is not set in Supabase secrets.");
    }

    let url = `https://api.openweathermap.org/data/2.5/weather?units=metric&appid=${OPENWEATHER_API_KEY}`;

    if (lat && lon) {
      url += `&lat=${lat}&lon=${lon}`;
      console.log(`${functionName} Using coordinates for weather fetch.`);
    } else if (city) {
      url += `&q=${city}`;
      console.log(`${functionName} Using city name for weather fetch.`);
    } else {
      console.error(`${functionName} City or coordinates are required.`);
      return new Response(JSON.stringify({ error: 'City or coordinates are required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log(`${functionName} Fetching weather from URL: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json();
      console.error(`${functionName} Failed to fetch weather data from OpenWeatherMap: ${errorData.message}`);
      throw new Error(errorData.message || 'Failed to fetch weather data from OpenWeatherMap');
    }
    const data = await response.json();
    console.log(`${functionName} Weather data fetched successfully.`);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, // Ensure CORS headers are here
    });

  } catch (error: any) {
    console.error(`${functionName} Edge Function error: ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, // Ensure CORS headers are here
    });
  }
});