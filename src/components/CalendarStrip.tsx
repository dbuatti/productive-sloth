import React from 'react';
import { format, isSameDay, addDays, subDays, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface CalendarStripProps {
  selectedDay: string;
  setSelectedDay: (date: string) => void;
  datesWithTasks: string[];
  isProcessingCommand: boolean; // Added this prop
}

const CalendarStrip: React.FC<CalendarStripProps> = ({ selectedDay, setSelectedDay, datesWithTasks, isProcessingCommand }) => {
  const today = new Date();
  const selectedDate = parseISO(selectedDay);

  const days = React.useMemo(() => {
    const start = subDays(selectedDate, 3);
    return Array.from({ length: 7 }).map((_, i) => addDays(start, i));
  }, [selectedDate]);

  const handleDayClick = (day: Date) => {
    if (!isProcessingCommand) {
      setSelectedDay(format(day, 'yyyy-MM-dd'));
    }
  };

  const handlePrevDay = () => {
    if (!isProcessingCommand) {
      setSelectedDay(format(subDays(selectedDate, 1), 'yyyy-MM-dd'));
    }
  };

  const handleNextDay = () => {
    if (!isProcessingCommand) {
      setSelectedDay(format(addDays(selectedDate, 1), 'yyyy-MM-dd'));
    }
  };

  const handleTodayClick = () => {
    if (!isProcessingCommand) {
      setSelectedDay(format(today, 'yyyy-MM-dd'));
    }
  };

  return (
    <div className="flex items-center justify-between p-2 bg-background border-b">
      <Button variant="ghost" size="icon" onClick={handlePrevDay} disabled={isProcessingCommand}>
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <div className="flex gap-1">
        {days.map((day) => {
          const dayString = format(day, 'yyyy-MM-dd');
          const isSelected = isSameDay(day, selectedDate);
          const isToday = isSameDay(day, today);
          const hasTasks = datesWithTasks.includes(dayString);

          return (
            <Tooltip key={dayString}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "flex flex-col h-auto w-14 py-1 px-0 text-xs",
                    isSelected && "bg-primary text-primary-foreground hover:bg-primary/90",
                    isToday && !isSelected && "border border-primary/50 text-primary",
                    isProcessingCommand && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={() => handleDayClick(day)}
                  disabled={isProcessingCommand}
                >
                  <span className="font-bold text-sm">{format(day, 'EEE')}</span>
                  <span className="text-lg leading-none">{format(day, 'd')}</span>
                  {hasTasks && (
                    <span className={cn(
                      "h-1 w-1 rounded-full mt-1",
                      isSelected ? "bg-primary-foreground" : "bg-logo-green"
                    )} />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{format(day, 'PPP')}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      <Button variant="ghost" size="icon" onClick={handleNextDay} disabled={isProcessingCommand}>
        <ChevronRight className="h-5 w-5" />
      </Button>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={handleTodayClick} disabled={isProcessingCommand}>
            <CalendarDays className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Go to Today</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
};

export default CalendarStrip;