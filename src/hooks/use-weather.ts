import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { showError } from '@/utils/toast';

interface WeatherData {
  temperature: number;
  feelsLike: number;
  minTemperature: number;
  maxTemperature: number;
  description: string;
  icon: string; // OpenWeatherMap icon code
  city: string;
  country: string;
  rainVolumeLastHour?: number; // Rain volume for the last 1 hour (mm)
}

interface UseWeatherOptions {
  lat?: number;
  lon?: number;
  city?: string;
  enabled?: boolean;
}

// Supabase Project ID and URL are needed to invoke the Edge Function
const SUPABASE_PROJECT_ID = "yfgapigmiyclgryqdgne";
const SUPABASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co`;

export const useWeather = ({ lat, lon, city, enabled = true }: UseWeatherOptions) => {
  const [locationError, setLocationError] = useState<string | null>(null);

  const fetchWeatherData = async (): Promise<WeatherData> => {
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
      throw new Error(errorData.error || 'Failed to fetch weather data via Edge Function');
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

  const { data, isLoading, error } = useQuery<WeatherData, Error>({
    queryKey: ['weather', lat, lon, city],
    queryFn: fetchWeatherData,
    enabled: enabled && (!!lat && !!lon || !!city), // Only enable if coordinates or city are provided
    staleTime: 5 * 60 * 1000, // 5 minutes stale time
    gcTime: 10 * 60 * 1000, // 10 minutes garbage collection time
  });

  useEffect(() => {
    if (error) {
      showError(`Weather fetch error: ${error.message}`);
    }
  }, [error]);

  // Handle geolocation if no explicit lat/lon/city is provided
  useEffect(() => {
    if (enabled && !lat && !lon && !city) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            // For now, we'll rely on the user explicitly passing lat/lon or city
            // or the default city in the WeatherWidget.
            // If you want to use geolocation, you'd need to update state here
            // that the useWeather hook depends on (e.g., by having lat/lon as state
            // in SchedulerPage and passing it down).
            console.log("Geolocation obtained, but not automatically used by useWeather hook. Pass lat/lon or city explicitly.");
          },
          (geoError) => {
            setLocationError(`Geolocation error: ${geoError.message}. Defaulting to Melbourne.`);
            showError(`Geolocation error: ${geoError.message}. Defaulting to Melbourne.`);
          },
          { enableHighAccuracy: false, timeout: 5000, maximumAge: 0 }
        );
      } else {
        setLocationError("Geolocation is not supported by your browser. Defaulting to Melbourne.");
        showError("Geolocation is not supported by your browser. Defaulting to Melbourne.");
      }
    }
  }, [enabled, lat, lon, city]);

  return {
    weather: data,
    isLoading,
    error: error || (locationError ? new Error(locationError) : null),
  };
};