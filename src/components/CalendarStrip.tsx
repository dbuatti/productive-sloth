"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { format, addDays, isToday, parseISO, subDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CalendarCheck, ChevronLeft, ChevronRight, Loader2, Zap } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface CalendarStripProps {
  selectedDay: string; 
  setSelectedDay: (dateString: string) => void; 
  datesWithTasks: string[]; 
  isLoadingDatesWithTasks: boolean; 
  weekStartsOn: number;
}

const CalendarStrip: React.FC<CalendarStripProps> = React.memo(({ 
  selectedDay, 
  setSelectedDay, 
  datesWithTasks, 
  isLoadingDatesWithTasks,
  weekStartsOn 
}) => {
  const daysToDisplay = 7;
  const [displayedWindowStart, setDisplayedWindowStart] = useState<Date>(() => {
    const today = new Date();
    return subDays(today, Math.floor(daysToDisplay / 2));
  });

  const daysContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (daysContainerRef.current) {
      const selectedDayElement = daysContainerRef.current.querySelector(
        `[data-date="${selectedDay}"]`
      ) as HTMLElement;

      if (selectedDayElement) {
        selectedDayElement.scrollIntoView({
          behavior: 'smooth',
          inline: 'center',
          block: 'nearest'
        });
      }
    }
  }, [selectedDay, daysContainerRef.current, displayedWindowStart]);

  const days = useMemo(() => {
    return Array.from({ length: daysToDisplay }).map((_, i) => {
      const day = addDays(displayedWindowStart, i);
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
            "flex flex-col items-center justify-center h-14 w-11 shrink-0 rounded-xl transition-all duration-300 ease-aether-out relative", // Adjusted height and width
            "text-muted-foreground hover:text-primary hover:bg-primary/5",
            isSelected && "glass-card text-primary border-primary/50 shadow-[0_0_20px_rgba(var(--primary),0.15)] scale-105 z-10", // FIX: Changed text-primary-foreground to text-primary
            !isSelected && isCurrentDay && "border border-primary/20 bg-primary/[0.02]"
          )}
          data-date={formattedDay}
        >
          <span className="text-[8px] font-black uppercase tracking-widest opacity-60 mb-1"> {/* Adjusted font size */}
            {format(day, 'EEE')}
          </span>
          <span className="text-sm font-black tracking-tighter"> {/* Adjusted font size */}
            {format(day, 'd')}
          </span>
          
          {hasTasks && (
            <div className={cn(
              "absolute bottom-1.5 h-1 w-1 rounded-full shadow-[0_0_8px_rgba(var(--logo-yellow),0.8)]",
              "bg-logo-yellow" // FIX: Keep consistent yellow for task indicator
            )} />
          )}

          {isCurrentDay && !isSelected && (
            <div className="absolute top-1 right-1 h-1 w-1 rounded-full bg-primary animate-pulse" />
          )}
        </Button>
      );
    });
  }, [displayedWindowStart, selectedDay, datesWithTasks, daysToDisplay]);

  const handlePrevPeriod = () => {
    setDisplayedWindowStart(prev => subDays(prev, daysToDisplay));
  };

  const handleNextPeriod = () => {
    setDisplayedWindowStart(prev => addDays(prev, daysToDisplay));
  };

  const handleGoToToday = () => {
    const today = new Date();
    setSelectedDay(format(today, 'yyyy-MM-dd'));
    setDisplayedWindowStart(subDays(today, Math.floor(daysToDisplay / 2)));
  };

  return (
    <div className="flex items-center justify-between w-full gap-2 bg-secondary/5 p-2 rounded-2xl border border-white/5 backdrop-blur-sm">
      
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevPeriod}
              className="h-10 w-8 text-muted-foreground hover:text-primary transition-colors rounded-lg"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Previous {daysToDisplay} Days</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isToday(parseISO(selectedDay)) ? "aether" : "outline"}
              size="icon"
              onClick={handleGoToToday}
              className="h-10 w-10 rounded-lg transition-all duration-500"
            >
              {isToday(parseISO(selectedDay)) ? <Zap className="h-4 w-4 fill-current" /> : <CalendarCheck className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Jump to Present</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex-1 flex overflow-x-auto py-1 custom-scrollbar touch-pan-x">
        {isLoadingDatesWithTasks ? (
          <div className="flex items-center justify-center h-16 w-full animate-pulse">
            <Loader2 className="h-5 w-5 animate-spin text-primary opacity-40" />
          </div>
        ) : (
          <div ref={daysContainerRef} className="flex items-center gap-2 whitespace-nowrap animate-pop-in">
            {days}
          </div>
        )}
      </div>

      <div className="flex items-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextPeriod}
              className="h-10 w-8 text-muted-foreground hover:text-primary transition-colors rounded-lg"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Next {daysToDisplay} Days</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
});

CalendarStrip.displayName = 'CalendarStrip';

export default CalendarStrip;