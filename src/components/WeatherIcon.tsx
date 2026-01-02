import React from 'react';
import { CloudSun, Sun, CloudRain, CloudSnow, CloudLightning, Cloud } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WeatherIconProps {
  iconCode: string;
  className?: string;
}

const WeatherIcon: React.FC<WeatherIconProps> = ({ iconCode, className }) => {
  const baseClassName = cn("h-4 w-4 transition-all duration-500", className);

  switch (iconCode) {
    case '01d': case '01n':
      return <Sun className={baseClassName} />;
    case '02d': case '02n': case '03d': case '03n': case '04d': case '04n':
      return <CloudSun className={baseClassName} />;
    case '09d': case '09n': case '10d': case '10n':
      return <CloudRain className={baseClassName} />;
    case '11d': case '11n':
      return <CloudLightning className={baseClassName} />;
    case '13d': case '13n':
      return <CloudSnow className={baseClassName} />;
    default:
      return <Cloud className={baseClassName} />;
  }
};

export default WeatherIcon;