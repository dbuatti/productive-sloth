import React from 'react';
import { useWeather } from '@/hooks/use-weather';
import { Card, CardContent } from '@/components/ui/card';
import { CloudSun, Sun, CloudRain, CloudSnow, CloudLightning, Cloud, Thermometer, Loader2, Droplet } from 'lucide-react'; // Import Droplet icon
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// Map OpenWeatherMap icon codes to Lucide icons
const getWeatherIcon = (iconCode: string) => {
  switch (iconCode) {
    case '01d': // clear sky day
    case '01n': // clear sky night
      return <Sun className="h-6 w-6 text-yellow-500" />;
    case '02d': // few clouds day
    case '02n': // few clouds night
    case '03d': // scattered clouds day
    case '03n': // scattered clouds night
    case '04d': // broken clouds day
    case '04n': // broken clouds night
      return <CloudSun className="h-6 w-6 text-gray-400" />;
    case '09d': // shower rain day
    case '09n': // shower rain night
    case '10d': // rain day
    case '10n': // rain night
      return <CloudRain className="h-6 w-6 text-blue-500" />;
    case '11d': // thunderstorm day
    case '11n': // thunderstorm night
      return <CloudLightning className="h-6 w-6 text-gray-600" />;
    case '13d': // snow day
    case '13n': // snow night
      return <CloudSnow className="h-6 w-6 text-blue-300" />;
    case '50d': // mist day
    case '50n': // mist night
      return <Cloud className="h-6 w-6 text-gray-400" />;
    default:
      return <Cloud className="h-6 w-6 text-gray-400" />;
  }
};

const WeatherWidget: React.FC = () => {
  // Fetch weather for Melbourne, Victoria, Australia
  const { weather, isLoading, error } = useWeather({ city: "Melbourne, Victoria, Australia" }); 

  if (isLoading) {
    return (
      <Card className="p-3 flex items-center justify-center h-20 animate-pulse-glow animate-hover-lift">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Loading weather...</span>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-3 flex items-center justify-center h-20 border-destructive/50 bg-destructive/10 animate-hover-lift">
        <span className="text-sm text-destructive">Error: {error.message}</span>
      </Card>
    );
  }

  if (!weather) {
    return null;
  }

  // After this check, 'weather' is guaranteed to be of type WeatherData.
  // Using non-null assertion (!) to explicitly tell TypeScript this.
  return (
    <Card className="p-3 flex items-center justify-between animate-pop-in animate-hover-lift">
      <div className="flex items-center gap-3">
        {getWeatherIcon(weather!.icon)}
        <div className="flex flex-col">
          <span className="text-lg font-bold text-foreground">
            {Math.round(weather!.temperature)}°C
          </span>
          <span className="text-xs text-muted-foreground capitalize">
            {weather!.description}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-end">
        <span className="text-sm font-medium text-foreground">
            {weather!.city}, {weather!.country}
        </span>
        <div className="flex items-center gap-2 mt-1"> {/* Group temp and rain info */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Thermometer className="h-3 w-3" />
                H:{Math.round(weather!.maxTemperature)}° L:{Math.round(weather!.minTemperature)}°
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Feels like {Math.round(weather!.feelsLike)}°C</p>
            </TooltipContent>
          </Tooltip>
          {weather!.rainVolumeLastHour !== undefined && weather!.rainVolumeLastHour > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs text-blue-500 flex items-center gap-1">
                  <Droplet className="h-3 w-3" />
                  {weather!.rainVolumeLastHour}mm (1h)
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Rain volume in the last hour</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </Card>
  );
};

export default WeatherWidget;