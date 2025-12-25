"use client";

import React from 'react';
import { useWeather } from '@/hooks/use-weather';
import { 
  CloudSun, Sun, CloudRain, CloudSnow, 
  CloudLightning, Cloud, Thermometer, 
  Loader2, Droplet, MapPin 
} from 'lucide-react'; 
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const getWeatherIcon = (iconCode: string) => {
  const className = "h-5 w-5 transition-all duration-500";
  switch (iconCode) {
    case '01d': case '01n':
      return <Sun className={cn(className, "text-logo-yellow drop-shadow-[0_0_8px_rgba(var(--logo-yellow),0.5)]")} />;
    case '02d': case '02n': case '03d': case '03n': case '04d': case '04n':
      return <CloudSun className={cn(className, "text-primary/70")} />;
    case '09d': case '09n': case '10d': case '10n':
      return <CloudRain className={cn(className, "text-primary animate-pulse")} />;
    case '11d': case '11n':
      return <CloudLightning className={cn(className, "text-accent drop-shadow-[0_0_8px_rgba(var(--accent),0.5)]")} />;
    case '13d': case '13n':
      return <CloudSnow className={cn(className, "text-blue-300")} />;
    default:
      return <Cloud className={cn(className, "text-muted-foreground/50")} />;
  }
};

const WeatherWidget: React.FC = () => {
  const { weather, isLoading, error } = useWeather({ city: "Melbourne, AU" }); 

  if (isLoading || error || !weather) {
    return (
      <div className="h-11 flex items-center justify-center px-4 rounded-xl bg-secondary/10 border border-white/5 opacity-50">
        <Loader2 className="h-3 w-3 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="group h-11 flex items-center justify-between px-4 rounded-xl bg-background/40 border border-white/5 transition-all duration-300 hover:border-primary/30">
      <div className="flex items-center gap-3">
        {getWeatherIcon(weather.icon)}
        <div className="flex flex-col">
          <div className="flex items-baseline gap-1 leading-none">
            <span className="text-sm font-black font-mono tracking-tighter text-foreground">
              {Math.round(weather.temperature)}°
            </span>
            <span className="text-[10px] font-black uppercase text-muted-foreground/40">{weather.description}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 opacity-60">
              <Thermometer className="h-3 w-3 text-logo-orange" />
              <span className="text-[10px] font-black font-mono">
                {Math.round(weather.maxTemperature)}°
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent className="glass-card">Feels like {Math.round(weather.feelsLike)}°C</TooltipContent>
        </Tooltip>

        {weather.rainVolumeLastHour !== undefined && weather.rainVolumeLastHour > 0 && (
          <div className="flex items-center gap-1 text-primary animate-pulse">
            <Droplet className="h-3 w-3" />
            <span className="text-[10px] font-black font-mono">{weather.rainVolumeLastHour}mm</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default WeatherWidget;