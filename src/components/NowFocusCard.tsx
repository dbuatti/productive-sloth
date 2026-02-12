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
      <Card className="p-8 flex flex-col items-center justify-center space-y-6 rounded-[2rem] shadow-sm animate-pop-in">
        <Skeleton className="h-12 w-12 rounded-full" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-40" />
        <div className="grid grid-cols-2 gap-6 w-full">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      </Card>
    );
  }

  if (!activeItem) {
    return (
      <Card className="p-12 flex flex-col items-center justify-center space-y-4 rounded-[2rem] border-2 border-dashed border-border/40 bg-secondary/5 text-center group transition-all duration-700 hover:border-primary/40">
        <div className="p-5 rounded-full bg-secondary/20 group-hover:scale-110 transition-transform duration-700">
          <Layout className="h-8 w-8 text-muted-foreground/20" />
        </div>
        <CardTitle className="text-lg font-black uppercase tracking-tighter text-muted-foreground/60">Flow State Idle</CardTitle>
        <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.3em] font-black">Awaiting Temporal Objective</p>
      </Card>
    );
  }

  const isBreak = activeItem.type === 'break' || activeItem.type === 'meal';
  const accentClass = isBreak ? 'text-logo-orange' : 'text-primary';

  return (
    <Card 
      className={cn(
        "relative overflow-hidden group cursor-pointer border-2 transition-all duration-700 rounded-[2rem] shadow-2xl animate-pop-in",
        isBreak ? "border-logo-orange/40 bg-logo-orange/[0.03]" : "border-primary/40 bg-primary/[0.03]",
        isMobile ? "py-4" : "p-8"
      )}
      onClick={onEnterFocusMode}
    >
      {/* Ambient Aura */}
      <div className={cn(
        "absolute -top-24 -right-24 w-64 h-64 blur-[100px] opacity-20 rounded-full transition-all duration-1000 group-hover:opacity-40",
        isBreak ? "bg-logo-orange" : "bg-primary"
      )} />

      <CardHeader className={cn(
        "flex flex-row items-center justify-between space-y-0 pb-4",
        isMobile ? "px-6 pt-4" : "px-0 pt-0 mb-10"
      )}>
        <div className="flex items-center gap-3">
          {!isMobile && (
            <div className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.4em] text-muted-foreground/60">
              <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                <Target className="h-4 w-4 text-primary" />
              </div>
              Active Focus
            </div>
          )}
          {isMobile && (
            <>
              <div className={cn("p-2 rounded-xl bg-background/50 shadow-inner", accentClass)}>
                {isBreak ? <Coffee className="h-4 w-4 animate-bounce" /> : <Target className="h-4 w-4 animate-spin-slow" />}
              </div>
              <CardTitle className="font-black tracking-[0.3em] text-foreground/60 uppercase text-[10px]">Active Focus</CardTitle>
            </>
          )}
        </div>
        <div className="h-7 px-4 flex items-center rounded-full bg-live-progress/20 border border-live-progress/50 text-live-progress text-[10px] font-black uppercase tracking-widest animate-pulse-glow-subtle">
          Live
        </div>
      </CardHeader>

      <CardContent className={cn(
        "pt-2 pb-4 space-y-4",
        isMobile ? "px-6" : "px-0"
      )}>
        <div className="flex flex-col items-center justify-center space-y-3 mb-10">
          <span className={cn(
            "font-black uppercase tracking-tighter text-foreground text-center leading-none",
            isMobile ? "text-3xl" : "text-6xl"
          )}>
            {activeItem.emoji} {activeItem.name}
          </span>
          <span className={cn(
            "font-bold text-muted-foreground/60 uppercase tracking-[0.3em] flex items-center gap-3",
            isMobile ? "text-[10px]" : "text-sm"
          )}>
            <Clock className={cn(isMobile ? "h-3.5 w-3.5" : "h-5 w-5")} />
            {activeItem.duration} Minute Sync
          </span>
        </div>

        {!isMobile && (
          <div className="grid grid-cols-2 gap-6 mb-10">
            <Card className="flex flex-col items-center justify-center p-8 bg-background/40 border border-white/5 shadow-inner rounded-3xl">
              <p className="text-[11px] font-black uppercase tracking-[0.4em] text-muted-foreground/40 mb-3">Remaining</p>
              <p className={cn("text-5xl font-black font-mono tracking-tighter", accentClass)}>
                {timeRemaining}
              </p>
            </Card>
            <Card className="flex flex-col items-center justify-center p-8 bg-background/40 border border-white/5 shadow-inner rounded-3xl">
              <p className="text-[11px] font-black uppercase tracking-[0.4em] text-muted-foreground/40 mb-3">Sync End</p>
              <p className="text-5xl font-black font-mono tracking-tighter text-foreground">
                {formatTime(activeItem.endTime)}
              </p>
            </Card>
          </div>
        )}

        {nextItem && (
          <div className={cn(
            "flex items-center justify-between text-muted-foreground/60 pt-6 border-t border-white/5",
            isMobile ? "text-[10px] px-0" : "text-sm px-0"
          )}>
            <span className="text-[11px] font-black uppercase tracking-[0.3em]">Up Next</span>
            <div className="flex items-center gap-2 max-w-[70%]">
              <span className={cn("truncate", isMobile ? "text-sm" : "text-base font-bold text-foreground/80")}>{nextItem.emoji} {nextItem.name}</span>
              <ChevronRight className={cn(isMobile ? "h-4 w-4" : "h-5 w-5")} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

NowFocusCard.displayName = 'NowFocusCard';
export default NowFocusCard;