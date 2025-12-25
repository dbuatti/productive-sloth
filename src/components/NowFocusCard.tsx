"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, Coffee, Clock, Flag, Layout } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatTime, formatDayMonth } from '@/lib/scheduler-utils';
import { ScheduledItem } from '@/types/scheduler';
import { intervalToDuration, formatDuration, isToday } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface NowFocusCardProps {
  activeItem: ScheduledItem | null;
  nextItem: ScheduledItem | null;
  T_current: Date;
  onEnterFocusMode: () => void;
}

const NowFocusCard: React.FC<NowFocusCardProps> = React.memo(({ activeItem, nextItem, T_current, onEnterFocusMode }) => {
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

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [activeItem, T_current]);

  if (!activeItem) {
    return (
      <Card className="animate-pop-in border-2 border-dashed bg-secondary/10 text-center py-10 flex flex-col items-center justify-center space-y-4 animate-hover-lift">
        <Layout className="h-10 w-10 text-muted-foreground/30" />
        <div className="space-y-1">
          <CardTitle className="text-xl font-bold text-muted-foreground">Flow State Idle</CardTitle>
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Waiting for next objective</p>
        </div>
      </Card>
    );
  }

  const isBreak = activeItem.type === 'break' || activeItem.type === 'meal';
  const statusIcon = isBreak ? <Coffee className="h-6 w-6 text-logo-orange animate-pulse" /> : <Zap className="h-6 w-6 text-primary animate-pulse" />;
  const cardBorderColor = isBreak ? 'border-logo-orange/40' : 'border-primary/40';
  const accentColor = isBreak ? 'text-logo-orange' : 'text-primary';
  const bgColor = isBreak ? 'bg-logo-orange/5' : 'bg-primary/5';

  return (
    <Card 
      className={cn(
        "relative overflow-hidden group cursor-pointer animate-pop-in border-2 animate-hover-lift",
        cardBorderColor, bgColor, "shadow-xl hover:shadow-2xl transition-all duration-500"
      )}
      onClick={onEnterFocusMode}
    >
      {/* Visual Accent Background */}
      <div className={cn(
        "absolute -top-24 -right-24 h-64 w-64 rounded-full blur-[80px] opacity-20 transition-opacity group-hover:opacity-40",
        isBreak ? "bg-logo-orange" : "bg-primary"
      )} />

      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative z-10 border-b border-white/5 bg-background/40 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          {statusIcon}
          <CardTitle className="text-sm font-black tracking-widest text-foreground uppercase">
            Current Objective
          </CardTitle>
        </div>
        <Badge variant="outline" className="text-[10px] font-black tracking-widest bg-background/50 border-white/10 uppercase">
          {isToday(activeItem.startTime) ? 'In Progress' : formatDayMonth(activeItem.startTime)}
        </Badge>
      </CardHeader>

      <CardContent className="pt-6 space-y-6 relative z-10">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="text-5xl mb-1 group-hover:scale-125 transition-transform duration-500 drop-shadow-lg">
            {activeItem.emoji}
          </div>
          <p className={cn("text-3xl font-black uppercase tracking-tight leading-none", accentColor)}>
            {activeItem.name}
          </p>
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-widest">
            <Clock className="h-3 w-3" />
            {activeItem.duration} Minute Session
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px bg-white/5 rounded-2xl overflow-hidden border border-white/5">
          <div className="flex flex-col items-center p-4 bg-background/20 backdrop-blur-sm group-hover:bg-background/40 transition-colors">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">Time Remaining</p>
            <p className={cn("text-3xl font-black font-mono tracking-tighter tabular-nums", accentColor)}>
              {timeRemaining}
            </p>
          </div>
          <div className="flex flex-col items-center p-4 bg-background/20 backdrop-blur-sm group-hover:bg-background/40 transition-colors">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">Finishing At</p>
            <p className="text-3xl font-black font-mono tracking-tighter text-foreground">
              {formatTime(activeItem.endTime)}
            </p>
          </div>
        </div>

        {nextItem && (
          <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-muted/20 border border-white/5 group-hover:bg-muted/40 transition-all">
            <div className="h-2 w-2 rounded-full bg-primary/40 animate-pulse" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Queue: <span className="text-foreground">{nextItem.emoji} {nextItem.name}</span>
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

export default NowFocusCard;