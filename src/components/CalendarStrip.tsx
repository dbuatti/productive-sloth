import React from 'react';
import { format, addDays, isSameDay, isToday, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CalendarStripProps {
  selectedDay: Date;
  setSelectedDay: (date: Date) => void;
  datesWithTasks: string[]; // Array of 'YYYY-MM-DD' strings for days with tasks
}

const CalendarStrip: React.FC<CalendarStripProps> = ({ selectedDay, setSelectedDay, datesWithTasks }) => {
  const daysToDisplay = 7; // Show 7 days: 3 before, current, 3 after
  const today = new Date();
  const startDay = addDays(selectedDay, -Math.floor(daysToDisplay / 2));

  const days = Array.from({ length: daysToDisplay }).map((_, i) => {
    const day = addDays(startDay, i);
    const formattedDay = format(day, 'yyyy-MM-dd');
    const hasTasks = datesWithTasks.includes(formattedDay);

    return (
      <Button
        key={formattedDay}
        variant="ghost"
        onClick={() => setSelectedDay(day)}
        className={cn(
          "flex flex-col items-center justify-center h-16 w-14 p-1 rounded-lg transition-all duration-200 relative",
          "text-muted-foreground hover:bg-secondary/50",
          isSameDay(day, selectedDay) && "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md", // Highlight selected day
          isToday(day) && !isSameDay(day, selectedDay) && "border border-primary/50", // Subtle border for today if not selected
          hasTasks && "after:content-[''] after:absolute after:bottom-1 after:w-1.5 after:h-1.5 after:rounded-full after:bg-logo-yellow" // Indicator for days with tasks
        )}
      >
        <span className="text-xs font-semibold">{format(day, 'EEE')}</span> {/* Day of week (Mon, Tue) */}
        <span className="text-lg font-bold">{format(day, 'd')}</span> {/* Day number (1, 2) */}
      </Button>
    );
  });

  return (
    <div className="flex justify-center items-center space-x-2 overflow-x-auto py-2 animate-slide-in-up">
      {days}
    </div>
  );
};

export default CalendarStrip;