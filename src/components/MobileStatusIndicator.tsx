import React, { useEffect, useState, useCallback } from 'react';
import { intervalToDuration, formatDuration, isBefore } from 'date-fns';
import { useSession } from '@/hooks/use-session';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Zap, Coffee, Clock } from 'lucide-react';

// Define Duration interface based on date-fns structure to resolve TS2304
interface Duration {
  years?: number;
  months?: number;
  weeks?: number;
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
}

const formatTimeRemaining = (duration: Duration): string => {
  return formatDuration(duration, {
    format: ['hours', 'minutes', 'seconds'],
    delimiter: ' ',
    zero: false,
    locale: {
      formatDistance: (token, count) => {
        if (token === 'xSeconds') return `${count}s`;
        if (token === 'xMinutes') return `${count}m`;
        if (token === 'xHours') return `${count}h`;
        return `${count}${token.charAt(0)}`;
      },
    },
  }) || '0s';
};

const MobileStatusIndicator: React.FC = () => {
  const { activeItemToday } = useSession();
  const navigate = useNavigate();
  
  // Local timer for high-frequency UI updates
  const [T_current, setT_current] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => {
      setT_current(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

  const updateRemaining = useCallback(() => {
    if (!activeItemToday || isBefore(activeItemToday.endTime, T_current)) {
      setTimeRemaining('0s');
      return;
    }
    const duration = intervalToDuration({ start: T_current, end: activeItemToday.endTime });
    setTimeRemaining(formatTimeRemaining(duration));
  }, [activeItemToday, T_current]);

  useEffect(() => {
    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [updateRemaining]);

  if (!activeItemToday) {
    return null;
  }

  const isBreak = activeItemToday.type === 'break';
  const isTimeOff = activeItemToday.type === 'time-off';
  const icon = isBreak ? <Coffee className="h-4 w-4 shrink-0" /> : <Zap className="h-4 w-4 shrink-0" />;
  const bgColor = isBreak ? 'bg-logo-orange/20' : 'bg-primary/20';
  const textColor = isBreak ? 'text-logo-orange' : 'text-primary';
  
  // Truncate name for mobile visibility
  const truncatedName = activeItemToday.name.length > 20 
    ? activeItemToday.name.substring(0, 17) + '...' 
    : activeItemToday.name;

  return (
    <div 
      className={cn(
        "fixed bottom-16 left-0 right-0 z-40 h-10 flex items-center justify-between px-4 shadow-lg transition-all duration-300 ease-in-out cursor-pointer",
        "border-t border-border/50",
        bgColor,
        "lg:hidden animate-slide-in-up" // Only visible on mobile
      )}
      onClick={() => navigate('/scheduler')}
    >
      <div className="flex items-center gap-2 text-sm font-semibold truncate min-w-0 max-w-[60%]">
        {icon}
        <span className={cn("truncate", textColor)}>{truncatedName}</span>
      </div>
      <div className="flex items-center gap-1 text-sm font-mono font-bold shrink-0">
        <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className={textColor}>{timeRemaining}</span>
      </div>
    </div>
  );
};

export default MobileStatusIndicator;