"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { format, addDays, isToday, parseISO, subDays } from 'date-fns';
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
  const daysToDisplay = 14;
  const [displayedWindowStart, setDisplayedWindowStart] = useState<Date>(() => {
    const today = new Date();
    return subDays(today, 2); // Show 2 days in the past by default
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
            "flex flex-col items-center justify-center min-w-[44px] h-14 rounded-xl transition-all duration-200 relative",
            isSelected ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-secondary text-muted-foreground",
            !isSelected && isCurrentDay && "text-primary font-bold"
          )}
          data-date={formattedDay}
        >
          <span className="text-[10px] uppercase tracking-tighter opacity-60 mb-0.5">
            {format(day, 'EEE')}
          </span>
          <span className="text-sm font-bold">
            {format(day, 'd')}
          </span>
          
          {hasTasks && !isSelected && (
            <div className="absolute bottom-2 h-1 w-1 rounded-full bg-primary/40" />
          )}
        </button>
      );
    });
  }, [displayedWindowStart, selectedDay, datesWithTasks]);

  return (
    <div className="flex items-center gap-2 w-full">
      <Button variant="ghost" size="icon" onClick={() => setDisplayedWindowStart(prev => subDays(prev, 7))} className="h-8 w-8 shrink-0">
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="flex-1 flex overflow-x-auto scrollbar-none gap-1 py-1">
        {isLoadingDatesWithTasks ? (
          <div className="flex items-center justify-center w-full h-14">
            <Loader2 className="h-4 w-4 animate-spin opacity-20" />
          </div>
        ) : (
          <div ref={daysContainerRef} className="flex gap-1">
            {days}
          </div>
        )}
      </div>

      <Button variant="ghost" size="icon" onClick={() => setDisplayedWindowStart(prev => addDays(prev, 7))} className="h-8 w-8 shrink-0">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
});

CalendarStrip.displayName = 'CalendarStrip';
export default CalendarStrip;