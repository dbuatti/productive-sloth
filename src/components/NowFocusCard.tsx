"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, Coffee, Clock, Layout, ChevronRight, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/scheduler-utils';
import { ScheduledItem } from '@/types/scheduler';
import { intervalToDuration } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile'; // Import useIsMobile

interface NowFocusCardProps {
  activeItem: ScheduledItem | null;
  nextItem: ScheduledItem | null;
  T_current: Date;
  onEnterFocusMode: () => void;
}

const NowFocusCard: React.FC<NowFocusCardProps> = React.memo(({ activeItem, nextItem, T_current, onEnterFocusMode }) => {
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);
  const isMobile = useIsMobile(); // Use the hook to detect mobile

  useEffect(() => {
    if (!activeItem) {
      setTimeRemaining(null);
      return;
    }

    const updateRemaining = () => {
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
  }, [activeItem, T_current]);

  if (!activeItem) {
    return (
      <Card className="animate-pop-in border-dashed border-border/40 bg-secondary/5 text-center py-8 flex flex-col items-center justify-center space-y-2 group transition-all duration-500 hover:border-primary/40">
        <div className="p-3 rounded-full bg-secondary/20 group-hover:scale-110 transition-transform duration-500">
          <Layout className="h-6 w-6 text-muted-foreground/20" />
        </div>
        <div className="space-y-0.5">
          <CardTitle className="text-sm font-black uppercase tracking-tighter text-muted-foreground/60">Flow State Idle</CardTitle>
          <p className="text-[9px] text-muted-foreground/40 uppercase tracking-[0.2em] font-black">Awaiting Temporal Objective</p>
        </div>
      </Card>
    );
  }

  const isBreak = activeItem.type === 'break' || activeItem.type === 'meal';
  const accentClass = isBreak ? 'text-logo-orange' : 'text-primary';

  return (
    <Card 
      className={cn(
        "relative overflow-hidden group cursor-pointer border-2 transition-all duration-500 animate-pop-in",
        isBreak ? "border-logo-orange/30 bg-logo-orange/[0.02]" : "border-primary/30 bg-primary/[0.02]",
        isMobile ? "py-2" : "py-4" // Conditional vertical padding
      )}
      onClick={onEnterFocusMode}
    >
      <CardHeader className={cn(
        "flex flex-row items-center justify-between space-y-0 pb-2",
        isMobile ? "px-4 pt-3" : "px-6 pt-4" // Conditional padding
      )}>
        <div className="flex items-center gap-2">
          <div className={cn("p-1.5 rounded-md bg-background/50 shadow-inner", accentClass)}>
            {isBreak ? <Coffee className="h-3.5 w-3.5 animate-bounce" /> : <Target className="h-3.5 w-3.5 animate-spin-slow" />}
          </div>
          <CardTitle className={cn(
            "font-black tracking-[0.2em] text-foreground/60 uppercase",
            isMobile ? "text-[9px]" : "text-xs" // Conditional font size
          )}>
            Active Focus
          </CardTitle>
        </div>
        <div className="h-1.5 w-1.5 rounded-full bg-live-progress animate-pulse" />
      </CardHeader>

      <CardContent className={cn(
        "pt-2 pb-3 space-y-2",
        isMobile ? "px-4" : "px-6" // Conditional padding
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn(isMobile ? "text-xl" : "text-2xl")}>{activeItem.emoji}</span> {/* Conditional emoji size */}
            <span className={cn("font-bold truncate", accentClass, isMobile ? "text-sm" : "text-xl")}> {/* Conditional task name size */}
              {activeItem.name}
            </span>
          </div>
          <div className={cn("flex items-center gap-1 font-mono font-bold text-foreground/70", isMobile ? "text-[10px]" : "text-lg")}> {/* Conditional time remaining size */}
            <Clock className={cn(isMobile ? "h-3 w-3" : "h-4 w-4")} />
            {timeRemaining}
          </div>
        </div>

        {nextItem && (
          <div className={cn(
            "flex items-center justify-between text-muted-foreground/60 pt-1 border-t border-white/5",
            isMobile ? "text-[9px]" : "text-sm" // Conditional next item text size
          )}>
            <span>Up Next</span>
            <div className="flex items-center gap-1 max-w-[70%]">
              <span className="truncate">{nextItem.emoji} {nextItem.name}</span>
              <ChevronRight className={cn(isMobile ? "h-3 w-3" : "h-4 w-4")} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

NowFocusCard.displayName = 'NowFocusCard';

export default NowFocusCard;