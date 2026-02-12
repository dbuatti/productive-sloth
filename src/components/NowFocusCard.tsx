"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, Coffee, Clock, Layout, ChevronRight, Target } from 'lucide-react'; 
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/scheduler-utils';
import { ScheduledItem } from '@/types/scheduler';
import { intervalToDuration } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';
import { Skeleton } from '@/components/ui/skeleton';

interface NowFocusCardProps {
  activeItem: ScheduledItem | null;
  nextItem: ScheduledItem | null;
  onEnterFocusMode: () => void;
  isLoading: boolean;
}

const NowFocusCard: React.FC<NowFocusCardProps> = React.memo(({ activeItem, nextItem, onEnterFocusMode, isLoading }) => {
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!activeItem) {
      setTimeRemaining(null);
      return;
    }

    const updateRemaining = () => {
      const T_current = new Date();
      const duration = intervalToDuration({ 
        start: T_current, 
        end: activeItem.endTime > T_current ? activeItem.endTime : T_current 
      });
      
      const h = duration.hours || 0;
      const m = duration.minutes || 0;
      const s = duration.seconds || 0;

      const formatted = `${h > 0 ? h + 'h ' : ''}${m}m ${s}s`;
      setTimeRemaining(formatted);
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [activeItem]);

  if (isLoading) {
    return (
      <Card className="p-6 rounded-xl shadow-sm animate-pop-in">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-6 w-12 rounded-full" />
        </div>
        <div className="flex flex-col items-center space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </Card>
    );
  }

  if (!activeItem) {
    return (
      <Card className="p-10 flex flex-col items-center justify-center space-y-3 rounded-xl border border-dashed border-border bg-muted/20 text-center group transition-colors hover:bg-muted/30">
        <Layout className="h-6 w-6 text-muted-foreground/40" />
        <CardTitle className="text-base font-semibold text-muted-foreground">No active task</CardTitle>
        <p className="text-xs text-muted-foreground/60">Your schedule is clear for now.</p>
      </Card>
    );
  }

  const isBreak = activeItem.type === 'break' || activeItem.type === 'meal';

  return (
    <Card 
      className={cn(
        "relative overflow-hidden group cursor-pointer border transition-all duration-200 rounded-xl shadow-sm animate-pop-in",
        isBreak ? "border-logo-orange/20 bg-logo-orange/[0.02]" : "border-primary/20 bg-primary/[0.02]",
        isMobile ? "p-4" : "p-6"
      )}
      onClick={onEnterFocusMode}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 p-0">
        <div className="flex items-center gap-2">
          <div className={cn("p-1.5 rounded-lg", isBreak ? "bg-logo-orange/10 text-logo-orange" : "bg-primary/10 text-primary")}>
            {isBreak ? <Coffee className="h-4 w-4" /> : <Target className="h-4 w-4" />}
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Current Focus</span>
        </div>
        <div className="h-6 px-3 flex items-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider">
          Live
        </div>
      </CardHeader>

      <CardContent className="p-0 space-y-6">
        <div className="flex flex-col items-center justify-center space-y-1">
          <span className={cn(
            "font-bold text-foreground text-center leading-tight",
            isMobile ? "text-2xl" : "text-3xl"
          )}>
            {activeItem.emoji} {activeItem.name}
          </span>
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-2">
            <Clock className="h-3 w-3" />
            {activeItem.duration} minute session
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col items-center justify-center p-4 bg-background border rounded-lg shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Remaining</p>
            <p className={cn("text-2xl font-bold font-mono", isBreak ? "text-logo-orange" : "text-primary")}>
              {timeRemaining}
            </p>
          </div>
          <div className="flex flex-col items-center justify-center p-4 bg-background border rounded-lg shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Ends At</p>
            <p className="text-2xl font-bold font-mono text-foreground">
              {formatTime(activeItem.endTime)}
            </p>
          </div>
        </div>

        {nextItem && (
          <div className="flex items-center justify-between text-muted-foreground pt-4 border-t">
            <span className="text-[10px] font-bold uppercase tracking-wider">Up Next</span>
            <div className="flex items-center gap-2 max-w-[70%]">
              <span className="truncate text-sm font-semibold text-foreground/80">{nextItem.emoji} {nextItem.name}</span>
              <ChevronRight className="h-4 w-4" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

NowFocusCard.displayName = 'NowFocusCard';
export default NowFocusCard;