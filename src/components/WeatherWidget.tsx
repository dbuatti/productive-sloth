"use client";

import React from 'react';
import { useWeather } from '@/hooks/use-weather';
import { Thermometer, Loader2, Droplet } from 'lucide-react'; 
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import WeatherIcon from './WeatherIcon'; // NEW: Import WeatherIcon

const WeatherWidget: React.FC = () => {
  const { weather, isLoading, error } = useWeather({ city: "Melbourne, AU" }); 

  if (isLoading || error || !weather) {
    return <div className="h-11 w-full bg-secondary/10 rounded-xl animate-pulse" />;
  }

  return (
    <div className="h-11 flex items-center justify-between px-4 rounded-xl bg-background/40 border border-white/5 transition-all hover:border-primary/30">
      <div className="flex items-center gap-3">
        <WeatherIcon iconCode={weather.icon} /> {/* Use the new WeatherIcon component */}
        <div className="flex flex-col">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 leading-none mb-1">
            Atmosphere
          </span>
          <div className="flex items-baseline gap-1 leading-none">
            <span className="text-sm font-black font-mono text-foreground">
              {Math.round(weather.temperature)}°C
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 opacity-60">
              <Thermometer className="h-3 w-3 text-logo-orange" />
              <span className="text-[10px] font-bold font-mono">{Math.round(weather.maxTemperature)}°</span>
            </div >
          </TooltipTrigger>
          <TooltipContent className="glass-card">High for today</TooltipContent>
        </Tooltip>
        {weather.rainVolumeLastHour !== undefined && weather.rainVolumeLastHour > 0 && (
          <div className="flex items-center gap-1 text-primary animate-pulse">
            <Droplet className="h-3 w-3" />
            <span className="text-[10px] font-bold font-mono">{weather.rainVolumeLastHour}mm</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default WeatherWidget;