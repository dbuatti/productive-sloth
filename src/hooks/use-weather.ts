import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
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
}

interface UseWeatherOptions {
  lat?: number;
  lon?: number;
  city?: string;
  enabled?: boolean;
}

const OPENWEATHER_API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;

export const useWeather = ({ lat, lon, city, enabled = true }: UseWeatherOptions) => {
  const [locationError, setLocationError] = useState<string | null>(null);

  const fetchWeatherData = async (): Promise<WeatherData> => {
    if (!OPENWEATHER_API_KEY) {
      throw new Error("OpenWeatherMap API key is not set. Please set VITE_OPENWEATHER_API_KEY in your environment variables.");
    }

    let url = `https://api.openweathermap.org/data/2.5/weather?units=metric&appid=${OPENWEATHER_API_KEY}`;

    if (lat && lon) {
      url += `&lat=${lat}&lon=${lon}`;
    } else if (city) {
      url += `&q=${city}`;
    } else {
      // Default to a city if no coordinates or city provided
      url += `&q=London`; // Fallback city
    }

    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to fetch weather data');
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
    };
  };

  const { data, isLoading, error } = useQuery<WeatherData, Error>({
    queryKey: ['weather', lat, lon, city],
    queryFn: fetchWeatherData,
    enabled: enabled && !!OPENWEATHER_API_KEY && (!!lat && !!lon || !!city),
    staleTime: 5 * 60 * 1000, // 5 minutes stale time
    cacheTime: 10 * 60 * 1000, // 10 minutes cache time
    onError: (err) => {
      showError(`Weather fetch error: ${err.message}`);
    },
  });

  // Handle geolocation if no explicit lat/lon/city is provided
  useEffect(() => {
    if (enabled && !lat && !lon && !city) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            // If we get a position, re-run the query with coordinates
            // For simplicity, we'll let the user explicitly pass lat/lon or city
            // or rely on the default city. For now, just log.
            console.log("Geolocation obtained:", position.coords.latitude, position.coords.longitude);
            // If I wanted to use this, I'd need to update the state that useWeather depends on,
            // e.g., by having lat/lon as state in SchedulerPage and passing it down.
            // For now, I'll stick to explicit city or default.
          },
          (geoError) => {
            setLocationError(`Geolocation error: ${geoError.message}. Defaulting to London.`);
            showError(`Geolocation error: ${geoError.message}. Defaulting to London.`);
          },
          { enableHighAccuracy: false, timeout: 5000, maximumAge: 0 }
        );
      } else {
        setLocationError("Geolocation is not supported by your browser. Defaulting to London.");
        showError("Geolocation is not supported by your browser. Defaulting to London.");
      }
    }
  }, [enabled, lat, lon, city]);


  return {
    weather: data,
    isLoading,
    error: error || (locationError ? new Error(locationError) : null),
  };
};