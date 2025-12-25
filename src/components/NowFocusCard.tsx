"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, Coffee, Clock, Layout, ChevronRight, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatTime, formatDayMonth } from '@/lib/scheduler-utils';
import { ScheduledItem } from '@/types/scheduler';
import { intervalToDuration, isToday } from 'date-fns';
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
      const duration = intervalToDuration({ 
        start: T_current, 
        end: activeItem.endTime > T_current ? activeItem.endTime : T_current 
      });
      
      const h = duration.hours || 0;
      const m = duration.minutes || 0;
      const s = duration.seconds || 0;

      // HUD style formatting: 00h 00m 00s
      const formatted = `${h > 0 ? h + 'h ' : ''}${m}m ${s}s`;
      setTimeRemaining(formatted);
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [activeItem, T_current]);

  if (!activeItem) {
    return (
      <Card className="animate-pop-in border-2 border-dashed border-border/40 bg-secondary/5 text-center py-12 flex flex-col items-center justify-center space-y-4 group transition-all duration-500 hover:border-primary/40">
        <div className="p-4 rounded-full bg-secondary/20 group-hover:scale-110 transition-transform duration-500">
          <Layout className="h-10 w-10 text-muted-foreground/20" />
        </div>
        <div className="space-y-1">
          <CardTitle className="text-xl font-black uppercase tracking-tighter text-muted-foreground/60">Flow State Idle</CardTitle>
          <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.2em] font-black">Awaiting Temporal Objective</p>
        </div>
      </Card>
    );
  }

  const isBreak = activeItem.type === 'break' || activeItem.type === 'meal';
  const accentHsl = isBreak ? 'var(--logo-orange)' : 'var(--primary)';
  const accentClass = isBreak ? 'text-logo-orange' : 'text-primary';

  return (
    <Card 
      className={cn(
        "relative overflow-hidden group cursor-pointer border-2 transition-all duration-500",
        "animate-pop-in shadow-2xl hover:shadow-[0_0_40px_rgba(var(--primary),0.15)]",
        isBreak ? "border-logo-orange/30 bg-logo-orange/[0.02]" : "border-primary/30 bg-primary/[0.02]"
      )}
      onClick={onEnterFocusMode}
    >
      {/* Aetheric Breathing Aura */}
      <div 
        className="absolute -top-24 -right-24 h-64 w-64 rounded-full blur-[100px] opacity-20 animate-pulse transition-opacity group-hover:opacity-40"
        style={{ backgroundColor: `hsl(${accentHsl})` }}
      />

      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 relative z-10 border-b border-white/5 bg-background/40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-lg bg-background/50 shadow-inner", accentClass)}>
            {isBreak ? <Coffee className="h-5 w-5 animate-bounce" /> : <Target className="h-5 w-5 animate-spin-slow" />}
          </div>
          <CardTitle className="text-[11px] font-black tracking-[0.2em] text-foreground uppercase opacity-80">
            Active Focus
          </CardTitle>
        </div>
        <Badge variant="outline" className="text-[10px] font-black tracking-widest bg-primary/10 border-primary/20 text-primary uppercase animate-pulse">
           Live
        </Badge>
      </CardHeader>

      <CardContent className="pt-8 pb-6 space-y-8 relative z-10">
        {/* Main Header Display */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="text-6xl mb-2 transition-all duration-700 group-hover:scale-125 group-hover:rotate-6 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
            {activeItem.emoji}
          </div>
          <h2 className={cn("text-4xl font-black uppercase tracking-tighter leading-none transition-colors", accentClass)}>
            {activeItem.name}
          </h2>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/50 border border-white/5 text-muted-foreground text-[10px] font-black uppercase tracking-widest">
            <Clock className="h-3.5 w-3.5" />
            {activeItem.duration} Minute Sync
          </div>
        </div>

        {/* HUD Data Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col items-center p-5 rounded-2xl bg-background/40 border border-white/5 backdrop-blur-sm group-hover:border-primary/20 transition-all duration-500">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 mb-2">Remaining</span>
            <span className={cn("text-2xl font-black font-mono tracking-tighter tabular-nums", accentClass)}>
              {timeRemaining}
            </span>
          </div>
          <div className="flex flex-col items-center p-5 rounded-2xl bg-background/40 border border-white/5 backdrop-blur-sm group-hover:border-primary/20 transition-all duration-500">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 mb-2">Sync End</span>
            <span className="text-2xl font-black font-mono tracking-tighter text-foreground/90">
              {formatTime(activeItem.endTime)}
            </span>
          </div>
        </div>

        {/* Progression Hint */}
        {nextItem ? (
          <div className="flex items-center justify-between p-4 rounded-2xl bg-secondary/30 border border-white/5 group-hover:bg-secondary/50 transition-all duration-300">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-1">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                <div className="h-1.5 w-1.5 rounded-full bg-primary/40" />
              </div>
              <span className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">
                Up Next
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-foreground uppercase tracking-tight">
                {nextItem.emoji} {nextItem.name}
              </span>
              <ChevronRight className="h-4 w-4 text-primary" />
            </div>
          </div>
        ) : (
          <div className="text-center py-2">
            <span className="text-[9px] font-black text-muted-foreground/30 uppercase tracking-[0.3em]">
              Final Objective for Today
            </span>
          </div>
        )}
      </CardContent>

      {/* Progress Underlay */}
      <div className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent w-full opacity-50" />
    </Card>
  );
});

NowFocusCard.displayName = 'NowFocusCard';

export default NowFocusCard;