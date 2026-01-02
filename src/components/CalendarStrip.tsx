"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { format, addDays, isToday, parseISO, subDays } from 'date-fns'; // Removed addWeeks, startOfWeek
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CalendarCheck, ChevronLeft, ChevronRight, Loader2, Zap } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
// Removed Day import as it's not directly used for this centered strip logic

interface CalendarStripProps {
  selectedDay: string; 
  setSelectedDay: (dateString: string) => void; 
  datesWithTasks: string[]; 
  isLoadingDatesWithTasks: boolean; 
  weekStartsOn: number; // Still passed, but not used for this component's display logic
}

const CalendarStrip: React.FC<CalendarStripProps> = React.memo(({ 
  selectedDay, 
  setSelectedDay, 
  datesWithTasks, 
  isLoadingDatesWithTasks,
  weekStartsOn // Destructure but not directly used for display calculation in this component
}) => {
  const daysToDisplay = 7;
  // State to hold the start date of the currently displayed 7-day window
  // Initialized to make 'today' the 4th day (index 3) in the strip
  const [displayedWindowStart, setDisplayedWindowStart] = useState<Date>(() => {
    const today = new Date();
    return subDays(today, Math.floor(daysToDisplay / 2)); // Centers today
  });

  const daysContainerRef = useRef<HTMLDivElement>(null); // Ref for the inner container of days

  // Effect to scroll to the selected day when it changes or when the component mounts
  useEffect(() => {
    if (daysContainerRef.current) {
      const selectedDayElement = daysContainerRef.current.querySelector(
        `[data-date="${selectedDay}"]`
      ) as HTMLElement;

      if (selectedDayElement) {
        // Scroll the selected day into the center of the view
        selectedDayElement.scrollIntoView({
          behavior: 'smooth',
          inline: 'center',
          block: 'nearest' // Ensure it's visible vertically if needed
        });
      }
    }
  }, [selectedDay, daysContainerRef.current, displayedWindowStart]); // Re-run when selectedDay or displayedWindowStart changes

  // Generate the 7 days to display based on displayedWindowStart
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
            "flex flex-col items-center justify-center h-20 w-14 shrink-0 rounded-xl transition-all duration-300 ease-aether-out relative",
            "text-muted-foreground hover:text-primary hover:bg-primary/5",
            isSelected && "glass-card text-primary border-primary/50 shadow-[0_0_20px_rgba(var(--primary),0.15)] scale-110 z-10",
            !isSelected && isCurrentDay && "border border-primary/20 bg-primary/[0.02]"
          )}
          data-date={formattedDay} // Add data attribute for easy selection
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
    setDisplayedWindowStart(subDays(today, Math.floor(daysToDisplay / 2))); // Recenter on today
  };

  return (
    <div className="flex items-center justify-between w-full gap-2 bg-secondary/5 p-2 rounded-2xl border border-white/5 backdrop-blur-sm">
      
      {/* Navigation Controls Left */}
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevPeriod}
              className="h-12 w-10 text-muted-foreground hover:text-primary transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
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
              className="h-12 w-12 rounded-xl transition-all duration-500"
            >
              {isToday(parseISO(selectedDay)) ? <Zap className="h-5 w-5 fill-current" /> : <CalendarCheck className="h-5 w-5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Jump to Present</TooltipContent>
        </Tooltip>
      </div>

      {/* Main Timeline Strip */}
      <div className="flex-1 flex overflow-x-auto py-2 custom-scrollbar touch-pan-x">
        {isLoadingDatesWithTasks ? (
          <div className="flex items-center justify-center h-20 w-full animate-pulse">
            <Loader2 className="h-6 w-6 animate-spin text-primary opacity-40" />
          </div>
        ) : (
          <div ref={daysContainerRef} className="flex items-center gap-2 whitespace-nowrap animate-pop-in">
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
              onClick={handleNextPeriod}
              className="h-12 w-10 text-muted-foreground hover:text-primary transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
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