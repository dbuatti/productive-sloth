"use client";

import React from 'react';
import { useWeather } from '@/hooks/use-weather';
import { 
  CloudSun, Sun, CloudRain, CloudSnow, 
  CloudLightning, Cloud, Thermometer, 
  Loader2, Droplet 
} from 'lucide-react'; 
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const getWeatherIcon = (iconCode: string) => {
  const className = "h-4 w-4 transition-all duration-500";
  switch (iconCode) {
    case '01d': case '01n':
      return <Sun className={cn(className, "text-logo-yellow")} />;
    case '02d': case '02n': case '03d': case '03n': case '04d': case '04n':
      return <CloudSun className={cn(className, "text-primary/70")} />;
    case '09d': case '09n': case '10d': case '10n':
      return <CloudRain className={cn(className, "text-primary animate-pulse")} />;
    case '11d': case '11n':
      return <CloudLightning className={cn(className, "text-accent")} />;
    default:
      return <Cloud className={cn(className, "text-muted-foreground/50")} />;
  }
};

const WeatherWidget: React.FC = () => {
  const { weather, isLoading, error } = useWeather({ city: "Melbourne, AU" }); 

  if (isLoading || error || !weather) {
    return <div className="h-10 w-full bg-secondary/10 rounded-lg animate-pulse" />;
  }

  return (
    <div className="h-10 flex items-center justify-between px-3 rounded-lg bg-background/40 border border-white/5 transition-all hover:border-primary/30">
      <div className="flex items-center gap-2">
        {getWeatherIcon(weather.icon)}
        <div className="flex flex-col leading-none">
          <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/50">
            Atmos
          </span>
          <div className="flex items-baseline gap-1 leading-none">
            <span className="text-xs font-bold font-mono text-foreground">
              {Math.round(weather.temperature)}°
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 opacity-60">
              <Thermometer className="h-3 w-3 text-logo-orange" />
              <span className="text-[9px] font-bold font-mono">{Math.round(weather.maxTemperature)}°</span>
            </div>
          </TooltipTrigger>
          <TooltipContent className="glass-card">High for today</TooltipContent>
        </Tooltip>
        {weather.rainVolumeLastHour !== undefined && weather.rainVolumeLastHour > 0 && (
          <div className="flex items-center gap-1 text-primary animate-pulse">
            <Droplet className="h-3 w-3" />
            <span className="text-[9px] font-bold font-mono">{weather.rainVolumeLastHour}mm</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default WeatherWidget;