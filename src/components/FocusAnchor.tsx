"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { intervalToDuration, formatDuration, isBefore } from 'date-fns';
import { useSession } from '@/hooks/use-session';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Clock, Zap, Coffee } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile'; // Import useIsMobile

const FocusAnchor: React.FC = () => {
  const { activeItemToday, T_current } = useSession(); 
  
  // Use local T_current for anchor timing if SessionProvider doesn't expose it (it does now, but keeping the local timer for robustness if needed)
  const [localT_current, setLocalT_current] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => {
      setLocalT_current(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile(); // Check if mobile
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

  const updateRemaining = useCallback(() => {
    if (!activeItemToday || isBefore(activeItemToday.endTime, localT_current)) {
      setTimeRemaining('0s');
      return;
    }
    const duration = intervalToDuration({ start: localT_current, end: activeItemToday.endTime });
    const formatted = formatDuration(duration, {
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
    });
    setTimeRemaining(formatted || '0s');
  }, [activeItemToday, localT_current]);

  useEffect(() => {
    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [updateRemaining]);

  // Hide if on scheduler page OR if on mobile
  if (!activeItemToday || location.pathname === '/scheduler' || isMobile) {
    return null;
  }

  const isBreak = activeItemToday.type === 'break';
  const isTimeOff = activeItemToday.type === 'time-off';
  const icon = isBreak ? <Coffee className="h-4 w-4" /> : <Zap className="h-4 w-4" />;
  const bgColor = isBreak ? 'bg-logo-orange/20' : 'bg-primary/20';
  const textColor = isBreak ? 'text-logo-orange' : 'text-primary';
  const borderColor = isBreak ? 'border-logo-orange/50' : 'border-primary/50';

  const truncatedName = activeItemToday.name.length > 20 
    ? activeItemToday.name.substring(0, 17) + '...' 
    : activeItemToday.name;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          onClick={() => navigate('/scheduler')}
          className={cn(
            "fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-full shadow-lg transition-all duration-300 ease-in-out",
            "border-2",
            bgColor,
            borderColor,
            textColor,
            "hover:scale-105 hover:shadow-xl hover:shadow-primary/20",
            "animate-pop-in animate-pulse-glow-subtle"
          )}
        >
          {icon}
          <span className="font-semibold text-sm">{truncatedName}</span>
          <span className="font-mono text-xs">{timeRemaining}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left" className="z-[60]">
        <p>Currently active: {activeItemToday.name}</p>
        <p>Time remaining: {timeRemaining}</p>
        <p className="text-xs text-muted-foreground mt-1">Click to go to Scheduler</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default FocusAnchor;