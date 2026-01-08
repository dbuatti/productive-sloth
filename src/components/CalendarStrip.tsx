"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { format, addDays, isToday, parseISO, subDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CalendarCheck, ChevronLeft, ChevronRight, Loader2, Zap, Ban } from 'lucide-react'; // NEW: Import Ban icon
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface CalendarStripProps {
  selectedDay: string; 
  setSelectedDay: (dateString: string) => void; 
  datesWithTasks: string[]; 
  isLoadingDatesWithTasks: boolean; 
  weekStartsOn: number;
  blockedDays: string[]; // NEW: Add blockedDays prop
}

const CalendarStrip: React.FC<CalendarStripProps> = React.memo(({ 
  selectedDay, 
  setSelectedDay, 
  datesWithTasks, 
  isLoadingDatesWithTasks,
  weekStartsOn,
  blockedDays // Destructure new prop
}) => {
  const daysToDisplay = 14; // Changed from 7 to 14
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
      const isBlocked = blockedDays.includes(formattedDay); // NEW: Check if day is blocked

      return (
        <Button
          key={formattedDay}
          variant="ghost"
          onClick={() => setSelectedDay(formattedDay)}
          className={cn(
            "flex flex-col items-center justify-center h-16 w-11 shrink-0 rounded-xl transition-all duration-300 ease-aether-out relative", // Increased height to h-16
            "text-muted-foreground hover:text-primary hover:bg-primary/5",
            isSelected && "bg-card text-foreground shadow-md scale-105 z-10", // Removed border-primary/50, glass-card
            !isSelected && isCurrentDay && "border border-primary/20 bg-primary/[0.02]", // Kept subtle border for today
            isBlocked && "bg-destructive/10 text-destructive/60 hover:bg-destructive/20 border-destructive/30 cursor-not-allowed" // NEW: Blocked day styling
          )}
          data-date={formattedDay}
          disabled={isBlocked && !isSelected} // Disable clicking blocked days unless it's the currently selected one
        >
          <span className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1"> {/* Adjusted font size */}
            {format(day, 'EEE')}
          </span>
          <span className="text-base font-black tracking-tighter"> {/* Adjusted font size */}
            {format(day, 'd')}
          </span>
          
          {hasTasks && !isBlocked && ( // Only show task indicator if not blocked
            <div className={cn(
              "absolute bottom-0.5 h-1 w-1 rounded-full shadow-[0_0_8px_rgba(var(--logo-yellow),0.8)] mx-auto", // Adjusted bottom and added mx-auto
              "bg-logo-yellow"
            )} />
          )}

          {isCurrentDay && !isSelected && !isBlocked && ( // Only show current day indicator if not blocked
            <div className="absolute top-1 right-1 h-1 w-1 rounded-full bg-primary animate-pulse" />
          )}

          {isBlocked && ( // NEW: Blocked icon
            <Tooltip>
              <TooltipTrigger asChild>
                <Ban className="absolute inset-0 m-auto h-8 w-8 text-destructive/40 opacity-70" />
              </TooltipTrigger>
              <TooltipContent>
                <p>This day is blocked.</p>
              </TooltipContent>
            </Tooltip>
          )}
        </Button>
      );
    });
  }, [displayedWindowStart, selectedDay, datesWithTasks, daysToDisplay, blockedDays]);

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
    <div className="flex items-center justify-between w-full gap-2 bg-secondary/5 p-2 rounded-2xl border-none backdrop-blur-sm"> {/* Removed border */}
      
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

      <div className="flex-1 flex overflow-x-auto py-1 px-2 custom-scrollbar touch-pan-x"> {/* FIX: Increased px-1 to px-2 */}
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