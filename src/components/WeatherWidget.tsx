"use client";

import React from 'react';
import { useWeather } from '@/hooks/use-weather';
import { Card } from '@/components/ui/card';
import { 
  CloudSun, Sun, CloudRain, CloudSnow, 
  CloudLightning, Cloud, Thermometer, 
  Loader2, Droplet, MapPin, Wind 
} from 'lucide-react'; 
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// Aetheric Weather Icon Mapping with Luminous States
const getWeatherIcon = (iconCode: string) => {
  const className = "h-6 w-6 transition-all duration-500 group-hover:scale-110";
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
    case '50d': case '50n':
      return <Cloud className={cn(className, "text-muted-foreground/50")} />;
    default:
      return <Cloud className={cn(className, "text-muted-foreground/50")} />;
  }
};

const WeatherWidget: React.FC = () => {
  // Melbourne, Victoria, Australia - Localized Sync
  const { weather, isLoading, error } = useWeather({ city: "Melbourne, AU" }); 

  if (isLoading) {
    return (
      <Card glass className="h-20 flex items-center justify-center border-white/5 bg-secondary/10">
        <Loader2 className="h-4 w-4 animate-spin text-primary opacity-50" />
        <span className="ml-3 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">
          Syncing Atmosphere...
        </span>
      </Card>
    );
  }

  if (error || !weather) {
    return (
      <Card glass className="h-20 flex items-center justify-center border-destructive/20 bg-destructive/5">
        <span className="text-[10px] font-black uppercase tracking-widest text-destructive/70">
          Sensor Offline
        </span>
      </Card>
    );
  }

  return (
    <Card 
      glass 
      className="group relative h-20 p-4 flex items-center justify-between border-white/5 transition-all duration-500 hover:border-primary/30 hover:shadow-[0_0_20px_rgba(var(--primary),0.1)] overflow-hidden"
    >
      {/* Background Accent */}
      <div className="absolute -left-4 -top-4 h-16 w-16 bg-primary/5 blur-3xl rounded-full" />

      <div className="flex items-center gap-4 relative z-10">
        <div className="flex items-center justify-center p-2 rounded-xl bg-background/40 border border-white/5 shadow-inner">
          {getWeatherIcon(weather.icon)}
        </div>
        
        <div className="flex flex-col">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black font-mono tracking-tighter text-foreground">
              {Math.round(weather.temperature)}
            </span>
            <span className="text-xs font-bold text-primary opacity-70">°C</span>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 truncate max-w-[80px]">
            {weather.description}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 relative z-10">
        <div className="flex items-center gap-1.5 text-muted-foreground/40">
          <MapPin className="h-3 w-3" />
          <span className="text-[10px] font-black uppercase tracking-widest">
            {weather.city}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-background/40 border border-white/5 cursor-help">
                <Thermometer className="h-3 w-3 text-logo-orange opacity-60" />
                <span className="text-[10px] font-black font-mono text-foreground/80">
                  {Math.round(weather.maxTemperature)}<span className="opacity-30">/</span>{Math.round(weather.minTemperature)}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="glass-card">
              <p className="text-[10px] font-bold uppercase tracking-widest">Feels like {Math.round(weather.feelsLike)}°C</p>
            </TooltipContent>
          </Tooltip>

          {weather.rainVolumeLastHour !== undefined && weather.rainVolumeLastHour > 0 && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 animate-pulse">
              <Droplet className="h-3 w-3 text-primary" />
              <span className="text-[10px] font-black font-mono text-primary">
                {weather.rainVolumeLastHour}mm
              </span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

export default WeatherWidget;