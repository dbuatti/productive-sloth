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

      // Format for desktop: "16m 48s", for mobile: "16m 48s" (same for now, but can be adjusted)
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
        isMobile ? "py-2" : "p-6" // Conditional padding: more for desktop
      )}
      onClick={onEnterFocusMode}
    >
      <CardHeader className={cn(
        "flex flex-row items-center justify-between space-y-0 pb-2",
        isMobile ? "px-4 pt-3" : "px-0 pt-0 mb-8" // Conditional padding: no padding for desktop header
      )}>
        <div className="flex items-center gap-2">
          {/* Desktop: "ACTIVE FOCUS" label */}
          {!isMobile && (
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">
              <div className="p-1 rounded-full bg-primary/10 border border-primary/20">
                <Target className="h-3 w-3 text-primary" />
              </div>
              Active Focus
            </div>
          )}
          {/* Mobile: Icon and "Active Focus" label */}
          {isMobile && (
            <>
              <div className={cn("p-1.5 rounded-md bg-background/50 shadow-inner", accentClass)}>
                {isBreak ? <Coffee className="h-3.5 w-3.5 animate-bounce" /> : <Target className="h-3.5 w-3.5 animate-spin-slow" />}
              </div>
              <CardTitle className={cn(
                "font-black tracking-[0.2em] text-foreground/60 uppercase",
                "text-[9px]"
              )}>
                Active Focus
              </CardTitle>
            </>
          )}
        </div>
        {/* "LIVE" badge for desktop, pulse for mobile */}
        {!isMobile ? (
          <div className="h-6 px-3 flex items-center rounded-full bg-live-progress/20 border border-live-progress/50 text-live-progress text-[10px] font-black uppercase tracking-widest animate-pulse-glow-subtle">
            Live
          </div>
        ) : (
          <div className="h-1.5 w-1.5 rounded-full bg-live-progress animate-pulse" />
        )}
      </CardHeader>

      <CardContent className={cn(
        "pt-2 pb-3 space-y-2",
        isMobile ? "px-4" : "px-0" // Conditional padding
      )}>
        {/* Main Task Display */}
        <div className="flex flex-col items-center justify-center space-y-2 mb-8">
          <span className={cn(
            "font-black uppercase tracking-tighter text-foreground",
            isMobile ? "text-xl" : "text-5xl" // Larger for desktop
          )}>
            {activeItem.emoji} {activeItem.name}
          </span>
          <span className={cn(
            "font-bold text-muted-foreground/60 uppercase tracking-widest flex items-center gap-2",
            isMobile ? "text-[9px]" : "text-sm" // Larger for desktop
          )}>
            <Clock className={cn(isMobile ? "h-3 w-3" : "h-4 w-4")} />
            {activeItem.duration} Minute Sync
          </span>
        </div>

        {/* Time Remaining & Sync End - Desktop Only */}
        {!isMobile && (
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="flex flex-col items-center justify-center p-6 rounded-xl bg-background/40 border border-white/5 shadow-inner">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/40 mb-2">Remaining</span>
              <span className={cn("text-4xl font-black font-mono tracking-tighter", accentClass)}>
                {timeRemaining}
              </span>
            </div>
            <div className="flex flex-col items-center justify-center p-6 rounded-xl bg-background/40 border border-white/5 shadow-inner">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/40 mb-2">Sync End</span>
              <span className="text-4xl font-black font-mono tracking-tighter text-foreground">
                {formatTime(activeItem.endTime)}
              </span>
            </div>
          </div>
        )}

        {/* Next Up Section */}
        {nextItem && (
          <div className={cn(
            "flex items-center justify-between text-muted-foreground/60 pt-1 border-t border-white/5",
            isMobile ? "text-[9px] px-0" : "text-sm px-0 pt-4" // Conditional padding
          )}>
            <span className={cn(isMobile ? "text-[9px]" : "text-[10px] font-black uppercase tracking-widest")}>Up Next</span>
            <div className="flex items-center gap-1 max-w-[70%]">
              <span className={cn("truncate", isMobile ? "text-xs" : "text-sm font-bold text-foreground/80")}>{nextItem.emoji} {nextItem.name}</span>
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