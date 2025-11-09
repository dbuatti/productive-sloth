import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Zap, Coffee, ListTodo, Flag, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatTime, formatDayMonth } from '@/lib/scheduler-utils';
import { ScheduledItem } from '@/types/scheduler';
import { intervalToDuration, formatDuration, isPast, isToday } from 'date-fns';

interface NowFocusCardProps {
  activeItem: ScheduledItem | null;
  nextItem: ScheduledItem | null;
  T_current: Date;
}

const NowFocusCard: React.FC<NowFocusCardProps> = ({ activeItem, nextItem, T_current }) => {
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

  useEffect(() => {
    if (!activeItem) {
      setTimeRemaining(null);
      return;
    }

    const updateRemaining = () => {
      const duration = intervalToDuration({ start: T_current, end: activeItem.endTime });
      const formatted = formatDuration(duration, {
        format: ['hours', 'minutes', 'seconds'],
        delimiter: ' ',
        zero: false,
        locale: {
          formatDistance: (token, count) => {
            if (token === 'xSeconds') return `${count}s`;
            if (token === 'xMinutes') return `${count}m`;
            if (token === 'xHours') return `${count}h`;
            return `${count}${token.charAt(0)}`;
          },
        },
      });
      setTimeRemaining(formatted || '0s');
    };

    updateRemaining(); // Initial update
    const interval = setInterval(updateRemaining, 1000); // Update every second

    return () => clearInterval(interval);
  }, [activeItem, T_current]);

  if (!activeItem) {
    return (
      <Card className="animate-pop-in border-dashed border-primary/50 bg-secondary/10 text-center p-6 flex flex-col items-center justify-center space-y-3">
        <Clock className="h-8 w-8 text-muted-foreground animate-pulse" />
        <CardTitle className="text-xl font-bold text-muted-foreground">No Active Task</CardTitle>
        <p className="text-sm text-muted-foreground">Your schedule is clear, or tasks start later.</p>
      </Card>
    );
  }

  const isBreak = activeItem.type === 'break';
  const statusIcon = isBreak ? <Coffee className="h-8 w-8 text-logo-orange animate-pulse" /> : <Zap className="h-8 w-8 text-primary animate-pulse" />;
  const cardBorderColor = isBreak ? 'border-logo-orange/50' : 'border-primary/50';
  const cardBgColor = isBreak ? 'bg-logo-orange/10' : 'bg-primary/10';
  const textColor = isBreak ? 'text-logo-orange' : 'text-primary';

  return (
    <Card className={cn("animate-pop-in border-2", cardBorderColor, cardBgColor)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
          {statusIcon} NOW FOCUS
        </CardTitle>
        <span className="text-sm text-muted-foreground">
          {isToday(activeItem.startTime) ? 'Today' : formatDayMonth(activeItem.startTime)}
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col items-center text-center">
          <p className={cn("text-4xl font-extrabold font-mono leading-tight", textColor)}>
            {activeItem.emoji} {activeItem.name}
          </p>
          <p className="text-lg text-muted-foreground mt-1">
            ({activeItem.duration} min)
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex flex-col items-center">
            <p className="text-muted-foreground">Time Remaining:</p>
            <p className={cn("text-2xl font-bold font-mono", textColor)}>
              {timeRemaining}
            </p>
          </div>
          <div className="flex flex-col items-center">
            <p className="text-muted-foreground">Finishes At:</p>
            <p className="text-2xl font-bold font-mono text-foreground">
              {formatTime(activeItem.endTime)}
            </p>
          </div>
        </div>

        {nextItem && (
          <div className="text-center text-muted-foreground italic mt-4">
            Next up: {nextItem.emoji} {nextItem.name} ({nextItem.duration} min)
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default NowFocusCard;