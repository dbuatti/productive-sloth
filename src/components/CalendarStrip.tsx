import React, { useState, useMemo } from 'react';
import { format, addDays, isSameDay, isToday, parseISO, subWeeks, addWeeks, subDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CalendarDays, CalendarCheck, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'; // Import Chevron icons, added Loader2

interface CalendarStripProps {
  selectedDay: string; // Changed to string
  setSelectedDay: (dateString: string) => void; // Changed to accept string
  datesWithTasks: string[]; // Array of 'YYYY-MM-DD' strings for days with tasks
  isLoadingDatesWithTasks: boolean; // New prop for loading state
}

const CalendarStrip: React.FC<CalendarStripProps> = React.memo(({ selectedDay, setSelectedDay, datesWithTasks, isLoadingDatesWithTasks }) => {
  const daysToDisplay = 7; // Show 7 days
  const [weekOffset, setWeekOffset] = useState(0); // 0 for current week, -1 for previous, 1 for next

  const currentWeekStart = useMemo(() => {
    const today = new Date();
    const startOfWeek = subDays(today, today.getDay()); // Start of the current week (Sunday)
    return addWeeks(startOfWeek, weekOffset);
  }, [weekOffset]);

  const handleGoToToday = () => {
    setSelectedDay(format(new Date(), 'yyyy-MM-dd'));
    setWeekOffset(0); // Reset week offset to current week
  };

  const handlePreviousWeek = () => {
    setWeekOffset(prev => prev - 1);
  };

  const handleNextWeek = () => {
    setWeekOffset(prev => prev + 1);
  };

  const days = Array.from({ length: daysToDisplay }).map((_, i) => {
    const day = addDays(currentWeekStart, i);
    const formattedDay = format(day, 'yyyy-MM-dd');
    const hasTasks = datesWithTasks.includes(formattedDay);

    return (
      <Button
        key={formattedDay}
        variant="ghost"
        onClick={() => setSelectedDay(formattedDay)} // Pass formattedDay string
        className={cn(
          "flex flex-col items-center justify-center h-16 w-14 p-1 rounded-lg transition-all duration-200 relative",
          "text-muted-foreground hover:bg-secondary/50 hover:scale-105 hover:shadow-md", // Added hover effects
          // Refined selected day styling: softer background, stronger border
          formattedDay === selectedDay && "bg-primary/10 text-primary border-2 border-primary/70 shadow-lg hover:bg-primary/20", 
          isToday(day) && formattedDay !== selectedDay && "border border-primary/50", // Subtle border for today if not selected
          hasTasks && "after:content-[''] after:absolute after:bottom-1 after:w-1.5 after:h-1.5 after:rounded-full after:bg-logo-yellow" // Indicator for days with tasks
        )}
      >
        <span className="text-xs font-semibold">{format(day, 'EEE')}</span> {/* Day of week (Mon, Tue) */}
        <span className="text-base font-bold">{format(day, 'd')}</span> {/* Changed text-lg to text-base */}
      </Button>
    );
  });

  return (
    <div className="flex justify-center items-center space-x-2 overflow-x-auto py-2 animate-slide-in-up">
      {/* Previous Week Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handlePreviousWeek}
        className="h-16 w-10 shrink-0 text-muted-foreground hover:bg-secondary/50 hover:scale-105 hover:shadow-md"
      >
        <ChevronLeft className="h-5 w-5" />
        <span className="sr-only">Previous Week</span>
      </Button>

      {/* "Today" button */}
      <Button
        variant="outline"
        size="icon"
        onClick={handleGoToToday}
        className={cn(
          "flex flex-col items-center justify-center h-16 w-14 p-1 rounded-lg transition-all duration-200 relative",
          "text-muted-foreground hover:bg-secondary/50 hover:scale-105 hover:shadow-md", // Added hover effects
          // Refined selected Today button styling
          isToday(parseISO(selectedDay)) && "bg-primary/10 text-primary border-2 border-primary/70 shadow-lg hover:bg-primary/20" 
        )}
      >
        <CalendarCheck className="h-5 w-5" />
        <span className="text-xs font-semibold mt-1">Today</span>
      </Button>
      {isLoadingDatesWithTasks ? (
        <div className="flex items-center justify-center h-16 w-full">
          <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Loading dates with tasks" />
        </div>
      ) : datesWithTasks.length > 0 || days.length > 0 ? days : (
        <div className="text-center text-muted-foreground flex flex-col items-center justify-center py-4 w-full">
          <CalendarDays className="h-8 w-8 mb-2" />
          <p className="text-sm">No scheduled tasks for this week.</p>
        </div>
      )}

      {/* Next Week Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleNextWeek}
        className="h-16 w-10 shrink-0 text-muted-foreground hover:bg-secondary/50 hover:scale-105 hover:shadow-md"
      >
        <ChevronRight className="h-5 w-5" />
        <span className="sr-only">Next Week</span>
      </Button>
    </div>
  );
});

export default CalendarStrip;