"use client";

import React, { useState, useMemo } from 'react';
import { format, addDays, isToday, parseISO, addWeeks, subDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CalendarCheck, ChevronLeft, ChevronRight, Loader2, Zap } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface CalendarStripProps {
  selectedDay: string; 
  setSelectedDay: (dateString: string) => void; 
  datesWithTasks: string[]; 
  isLoadingDatesWithTasks: boolean; 
}

const CalendarStrip: React.FC<CalendarStripProps> = React.memo(({ 
  selectedDay, 
  setSelectedDay, 
  datesWithTasks, 
  isLoadingDatesWithTasks 
}) => {
  const daysToDisplay = 7;
  const [weekOffset, setWeekOffset] = useState(0);

  const currentWeekStart = useMemo(() => {
    const today = new Date();
    // Start of the current week (Sunday)
    const startOfWeek = subDays(today, today.getDay()); 
    return addWeeks(startOfWeek, weekOffset);
  }, [weekOffset]);

  const handleGoToToday = () => {
    setSelectedDay(format(new Date(), 'yyyy-MM-dd'));
    setWeekOffset(0);
  };

  const days = Array.from({ length: daysToDisplay }).map((_, i) => {
    const day = addDays(currentWeekStart, i);
    const formattedDay = format(day, 'yyyy-MM-dd');
    const isSelected = formattedDay === selectedDay;
    const hasTasks = datesWithTasks.includes(formattedDay);
    const isCurrentDay = isToday(day);

    return (
      <Button
        key={formattedDay}
        variant="ghost"
        onClick={() => setSelectedDay(formattedDay)}
        className={cn(
          "flex flex-col items-center justify-center h-20 w-14 shrink-0 rounded-xl transition-all duration-300 ease-aether-out relative",
          "text-muted-foreground hover:text-primary hover:bg-primary/5",
          isSelected && "glass-card text-primary border-primary/50 shadow-[0_0_20px_rgba(var(--primary),0.15)] scale-110 z-10",
          !isSelected && isCurrentDay && "border border-primary/20 bg-primary/[0.02]"
        )}
      >
        <span className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">
          {format(day, 'EEE')}
        </span>
        <span className="text-lg font-black tracking-tighter">
          {format(day, 'd')}
        </span>
        
        {hasTasks && (
          <div className={cn(
            "absolute bottom-2 h-1 w-1 rounded-full shadow-[0_0_8px_rgba(var(--logo-yellow),0.8)]",
            isSelected ? "bg-primary" : "bg-logo-yellow"
          )} />
        )}

        {isCurrentDay && !isSelected && (
          <div className="absolute top-1 right-1 h-1 w-1 rounded-full bg-primary animate-pulse" />
        )}
      </Button>
    );
  });

  return (
    <div className="flex items-center justify-between w-full mx-auto gap-2 bg-secondary/5 p-2 rounded-2xl border border-white/5 backdrop-blur-sm"> {/* Removed max-w-5xl */}
      
      {/* Navigation Controls Left */}
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setWeekOffset(prev => prev - 1)}
              className="h-12 w-10 text-muted-foreground hover:text-primary transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Previous Week</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isToday(parseISO(selectedDay)) ? "aether" : "outline"}
              size="icon"
              onClick={handleGoToToday}
              className="h-12 w-12 rounded-xl transition-all duration-500"
            >
              {isToday(parseISO(selectedDay)) ? <Zap className="h-5 w-5 fill-current" /> : <CalendarCheck className="h-5 w-5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Jump to Present</TooltipContent>
        </Tooltip>
      </div>

      {/* Main Timeline Strip */}
      <div className="flex-1 flex justify-center gap-1 sm:gap-4 overflow-hidden py-2">
        {isLoadingDatesWithTasks ? (
          <div className="flex items-center justify-center h-20 w-full animate-pulse">
            <Loader2 className="h-6 w-6 animate-spin text-primary opacity-40" />
          </div>
        ) : (
          <div className="flex items-center gap-1 sm:gap-2 animate-pop-in">
            {days}
          </div>
        )}
      </div>

      {/* Navigation Controls Right */}
      <div className="flex items-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setWeekOffset(prev => prev + 1)}
              className="h-12 w-10 text-muted-foreground hover:text-primary transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Next Week</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
});

CalendarStrip.displayName = 'CalendarStrip';

export default CalendarStrip;