"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, ChevronRight } from 'lucide-react'; 
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
      <Card className="p-6 border-none bg-muted/50 rounded-2xl">
        <Skeleton className="h-12 w-full mb-4" />
        <Skeleton className="h-6 w-1/2" />
      </Card>
    );
  }

  if (!activeItem) {
    return (
      <div className="p-8 text-center border border-dashed rounded-2xl bg-muted/20">
        <p className="text-sm font-medium text-muted-foreground">Nothing active right now.</p>
      </div>
    );
  }

  return (
    <Card 
      className={cn(
        "relative overflow-hidden cursor-pointer border-none bg-primary text-primary-foreground rounded-3xl shadow-xl transition-transform active:scale-[0.98]",
        isMobile ? "p-6" : "p-10"
      )}
      onClick={onEnterFocusMode}
    >
      <CardContent className="p-0 space-y-8">
        <div className="flex flex-col items-center text-center space-y-2">
          <span className="text-6xl mb-2">{activeItem.emoji}</span>
          <h2 className={cn(
            "font-bold leading-tight tracking-tight",
            isMobile ? "text-2xl" : "text-4xl"
          )}>
            {activeItem.name}
          </h2>
        </div>

        <div className="flex justify-center gap-12">
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-widest opacity-50 mb-1">Remaining</p>
            <p className="text-3xl font-bold font-mono">{timeRemaining}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-widest opacity-50 mb-1">Ends At</p>
            <p className="text-3xl font-bold font-mono">{formatTime(activeItem.endTime)}</p>
          </div>
        </div>

        {nextItem && (
          <div className="flex items-center justify-between pt-6 border-t border-white/10 opacity-60">
            <span className="text-[10px] uppercase tracking-widest font-bold">Next</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{nextItem.emoji} {nextItem.name}</span>
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