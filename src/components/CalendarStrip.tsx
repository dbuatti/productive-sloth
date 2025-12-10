import React from 'react';
import { Button } from '@/components/ui/button';
import { format, addDays, subDays, isSameDay, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface CalendarStripProps {
  selectedDay: string;
  setSelectedDay: (day: string) => void;
  datesWithTasks: string[];
  isLoadingDatesWithTasks: boolean;
}

const CalendarStrip: React.FC<CalendarStripProps> = ({
  selectedDay,
  setSelectedDay,
  datesWithTasks,
  isLoadingDatesWithTasks
}) => {
  const selectedDayAsDate = parseISO(selectedDay);
  const today = new Date();
  
  // Generate 7 days (3 before, today, 3 after)
  const days = [];
  for (let i = -3; i <= 3; i++) {
    days.push(addDays(selectedDayAsDate, i));
  }

  const hasTasksOnDate = (date: Date) => {
    if (isLoadingDatesWithTasks) return false;
    return datesWithTasks.some(d => isSameDay(parseISO(d), date));
  };

  const isToday = (date: Date) => isSameDay(date, today);

  return (
    <div className="flex items-center justify-between bg-card rounded-lg p-2 shadow-sm animate-slide-in-up">
      <Button
        variant="outline"
        size="icon"
        onClick={() => setSelectedDay(format(subDays(selectedDayAsDate, 1), 'yyyy-MM-dd'))}
        className="h-9 w-9"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      <div className="flex overflow-x-auto hide-scrollbar flex-grow mx-2">
        <div className="flex space-x-1 min-w-max justify-center">
          {days.map((day) => {
            const isSelected = isSameDay(day, selectedDayAsDate);
            const hasTasks = hasTasksOnDate(day);
            const isCurrentDay = isToday(day);
            
            return (
              <Button
                key={day.toString()}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedDay(format(day, 'yyyy-MM-dd'))}
                className={cn(
                  "flex flex-col h-16 w-14 p-1 rounded-lg transition-all duration-200",
                  isSelected && "ring-2 ring-primary ring-offset-2",
                  isCurrentDay && !isSelected && "border-primary"
                )}
              >
                <span className={cn(
                  "text-xs font-medium",
                  isCurrentDay && "text-primary"
                )}>
                  {format(day, 'EEE')}
                </span>
                <span className={cn(
                  "text-lg font-bold",
                  isCurrentDay && "text-primary"
                )}>
                  {format(day, 'd')}
                </span>
                {hasTasks && (
                  <Badge 
                    variant="secondary" 
                    className={cn(
                      "h-1.5 w-1.5 p-0 rounded-full mt-0.5",
                      isSelected ? "bg-primary-foreground" : "bg-primary"
                    )} 
                  />
                )}
              </Button>
            );
          })}
        </div>
      </div>
      
      <Button
        variant="outline"
        size="icon"
        onClick={() => setSelectedDay(format(addDays(selectedDayAsDate, 1), 'yyyy-MM-dd'))}
        className="h-9 w-9"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default CalendarStrip;