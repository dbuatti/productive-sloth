"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { format, addDays, isToday, parseISO, subDays, startOfDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

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
  isLoadingDatesWithTasks,
}) => {
  // Increase range to 180 days (90 past, 90 future) for an "endless" feel
  const daysToDisplay = 180;
  const [displayedWindowStart] = useState<Date>(() => {
    return subDays(startOfDay(new Date()), 90);
  });

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Center the selected day on mount and when selectedDay changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      const selectedDayElement = scrollContainerRef.current.querySelector(
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
  }, [selectedDay]);

  const days = useMemo(() => {
    return Array.from({ length: daysToDisplay }).map((_, i) => {
      const day = addDays(displayedWindowStart, i);
      const formattedDay = format(day, 'yyyy-MM-dd');
      const isSelected = formattedDay === selectedDay;
      const hasTasks = datesWithTasks.includes(formattedDay);
      const isCurrentDay = isToday(day);

      return (
        <button
          key={formattedDay}
          onClick={() => setSelectedDay(formattedDay)}
          className={cn(
            "flex flex-col items-center justify-center min-w-[48px] h-16 rounded-2xl transition-all duration-300 relative shrink-0",
            isSelected 
              ? "bg-primary text-primary-foreground shadow-lg scale-105 z-10" 
              : "hover:bg-secondary/80 text-muted-foreground hover:text-foreground",
            !isSelected && isCurrentDay && "text-primary font-black ring-2 ring-primary/20"
          )}
          data-date={formattedDay}
        >
          <span className={cn(
            "text-[10px] uppercase font-black tracking-tighter mb-0.5 opacity-60",
            isSelected && "opacity-100"
          )}>
            {format(day, 'EEE')}
          </span>
          <span className="text-base font-bold">
            {format(day, 'd')}
          </span>
          
          {hasTasks && !isSelected && (
            <div className="absolute bottom-2 h-1.5 w-1.5 rounded-full bg-primary/40 animate-pulse" />
          )}
        </button>
      );
    });
  }, [displayedWindowStart, selectedDay, datesWithTasks]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -300 : 300;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="relative flex items-center w-full group">
      {/* Left Navigation Button */}
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={() => scroll('left')} 
        className="absolute left-0 z-20 h-12 w-8 bg-background/80 backdrop-blur-sm border-r border-border/50 rounded-r-xl opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {/* Scrollable Container */}
      <div 
        ref={scrollContainerRef}
        className={cn(
          "flex-1 flex overflow-x-auto scrollbar-none gap-2 py-2 px-4 select-none",
          "snap-x snap-mandatory scroll-smooth"
        )}
      >
        {isLoadingDatesWithTasks ? (
          <div className="flex items-center justify-center w-full h-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary/30" />
          </div>
        ) : (
          <div className="flex gap-2 flex-nowrap">
            {days}
          </div>
        )}
      </div>

      {/* Right Navigation Button */}
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={() => scroll('right')} 
        className="absolute right-0 z-20 h-12 w-8 bg-background/80 backdrop-blur-sm border-l border-border/50 rounded-l-xl opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
});

CalendarStrip.displayName = 'CalendarStrip';
export default CalendarStrip;