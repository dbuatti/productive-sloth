import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { showError } from '@/utils/toast';

interface WeatherData {
  temperature: number;
  feelsLike: number;
  minTemperature: number;
  maxTemperature: number;
  description: string;
  icon: string;
  city: string;
  country: string;
  rainVolumeLastHour?: number;
}

interface UseWeatherOptions {
  lat?: number;
  lon?: number;
  city?: string;
  enabled?: boolean;
}

const SUPABASE_PROJECT_ID = "yfgapigmiyclgryqdgne";
const SUPABASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co`;

export const useWeather = ({ lat, lon, city, enabled = true }: UseWeatherOptions) => {
  const [locationError, setLocationError] = useState<string | null>(null);

  const fetchWeatherData = async (): Promise<WeatherData> => {
    // Hard check for valid parameters before fetching
    if (!city && (!lat || !lon)) {
      throw new Error("Insufficient location data provided for weather fetch.");
    }

    console.log(`[useWeather] Fetching weather data for: ${city || `${lat},${lon}`}`);
    const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/get-weather`;

    const payload = { city, lat, lon };

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch weather data');
    }
    const data = await response.json();

    return {
      temperature: data.main.temp,
      feelsLike: data.main.feels_like,
      minTemperature: data.main.temp_min,
      maxTemperature: data.main.temp_max,
      description: data.weather[0].description,
      icon: data.weather[0].icon,
      city: data.name,
      country: data.sys.country,
      rainVolumeLastHour: data.rain?.['1h'],
    };
  };

  // Only enable the query if we have valid input data
  const hasValidInput = !!city || (typeof lat === 'number' && typeof lon === 'number');

  const { data, isLoading, error } = useQuery<WeatherData, Error>({
    queryKey: ['weather', lat, lon, city],
    queryFn: fetchWeatherData,
    enabled: enabled && hasValidInput,
    staleTime: 10 * 60 * 1000, // 10 minutes stale time to reduce API pressure
    gcTime: 15 * 60 * 1000,
    retry: 1, // Minimize retries on failure
  });

  useEffect(() => {
    if (error && hasValidInput) {
      console.error("[useWeather] Weather fetch error:", error);
      showError(`Weather unavailable: ${error.message}`);
    }
  }, [error, hasValidInput]);

  return {
    weather: data,
    isLoading,
    error: error || (locationError ? new Error(locationError) : null),
  };
};