"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { intervalToDuration, formatDuration, isBefore } from 'date-fns';
import { X, CheckCircle, Archive, Clock, Zap, Coffee, ChevronRight, Target, Briefcase } from 'lucide-react'; // NEW: Import Briefcase icon
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/scheduler-utils';
import { ScheduledItem, DBScheduledTask } from '@/types/scheduler';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ImmersiveFocusModeProps {
  activeItem: ScheduledItem;
  T_current: Date;
  onExit: () => void;
  onAction: (action: 'complete' | 'skip' | 'takeBreak' | 'startNext' | 'exitFocus', task: DBScheduledTask, isEarlyCompletion: boolean, remainingDurationMinutes?: number) => void;
  dbTask: DBScheduledTask | null;
  nextItem: ScheduledItem | null; 
  isProcessingCommand: boolean; 
}

const ImmersiveFocusMode: React.FC<ImmersiveFocusModeProps> = ({
  activeItem,
  T_current,
  onAction,
  dbTask,
  nextItem, 
  isProcessingCommand, 
}) => {
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

  const updateRemaining = useCallback(() => {
    if (!activeItem || isBefore(activeItem.endTime, T_current)) {
      setTimeRemaining('00:00');
      return;
    }
    const duration = intervalToDuration({ start: T_current, end: activeItem.endTime });
    
    // Formatting for a high-density digital display
    const h = duration.hours || 0;
    const m = duration.minutes || 0;
    const s = duration.seconds || 0;

    const formatted = `${h > 0 ? h + 'h ' : ''}${m < 10 && h > 0 ? '0' + m : m}m ${s < 10 ? '0' + s : s}s`;
    setTimeRemaining(formatted);
  }, [activeItem, T_current]);

  useEffect(() => {
    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [updateRemaining]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onAction('exitFocus', dbTask!, false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onAction, dbTask]);

  if (!activeItem || !dbTask) return null;

  const isBreak = activeItem.type === 'break' || activeItem.type === 'meal';
  const accentClass = isBreak ? 'text-logo-orange' : 'text-primary';
  const bgGlow = isBreak ? 'bg-logo-orange/10' : 'bg-primary/10';

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background items-center justify-center overflow-hidden">
      {/* 1. Ambient Breathing Aura */}
      <div className={cn("absolute inset-0 animate-pulse-glow opacity-30 blur-[120px] rounded-full scale-150", bgGlow)} />

      {/* 2. Top Navigation Bar (Minimal) */}
      <div className="absolute top-0 left-0 right-0 p-8 flex justify-between items-center z-10">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="glass"
              size="icon"
              onClick={() => onAction('exitFocus', dbTask, false)}
              className="h-12 w-12 rounded-full border-white/10 hover:border-primary/50 transition-all active:scale-90"
            >
              <X className="h-6 w-6 text-muted-foreground" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Exit Focus (Esc)</TooltipContent>
        </Tooltip>

        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/50">Current Window</span>
          <span className="text-sm font-bold font-mono text-foreground/80">{formatTime(activeItem.startTime)} — {formatTime(activeItem.endTime)}</span>
        </div>
      </div>

      {/* 3. Main Focus HUD */}
      <div className="relative z-10 flex flex-col items-center max-w-4xl w-full px-6 text-center space-y-12">
        
        {/* Objective Header */}
        <div className="space-y-4 animate-pop-in">
          <div className="flex items-center justify-center gap-4">
             <div className={cn("p-3 rounded-2xl bg-background/50 border border-white/10 shadow-2xl", accentClass)}>
                {isBreak ? <Coffee className="h-8 w-8" /> : <Target className="h-8 w-8 animate-spin-slow" />}
             </div>
             <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter text-foreground leading-none">
              {activeItem.emoji} {activeItem.name}
            </h1>
          </div>
          <p className="text-lg font-bold text-muted-foreground/60 uppercase tracking-[0.4em]">
            Sync Duration: {activeItem.duration} Minutes
          </p>
        </div>

        {/* The Chrono-Meter */}
        <div className="relative group">
          <div className={cn("absolute inset-0 blur-3xl opacity-20 group-hover:opacity-40 transition-opacity", isBreak ? "bg-logo-orange" : "bg-primary")} />
          <p className={cn(
            "relative text-8xl md:text-[12rem] font-black font-mono tracking-tighter tabular-nums leading-none select-none",
            accentClass,
            "drop-shadow-[0_0_30px_rgba(var(--primary),0.3)]"
          )}>
            {timeRemaining}
          </p>
        </div>

        {/* Finishing At */}
        <div className="flex items-center gap-4 text-muted-foreground/40 animate-fade-in">
          <div className="h-px w-12 bg-current" />
          <span className="text-xs font-black uppercase tracking-[0.3em]">Estimated Completion: {formatTime(activeItem.endTime)}</span>
          <div className="h-px w-12 bg-current" />
        </div>
      </div>

      {/* 4. Bottom Command Bar */}
      <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center gap-8 z-10">
        
        {/* Next Up Preview */}
        {nextItem && (
          <div className="flex items-center gap-4 px-6 py-3 rounded-full glass-card border-white/5 animate-slide-in-up">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Up Next</span>
            <div className="flex items-center gap-2 text-sm font-bold text-foreground/80">
              <span>{nextItem.emoji} {nextItem.name}</span>
              <ChevronRight className="h-4 w-4 text-primary" />
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex items-center gap-4">
          {!isBreak && !activeItem.isCompleted && (
            <Button
              onClick={() => onAction('complete', dbTask, false)}
              disabled={dbTask.is_locked || isProcessingCommand}
              variant="aether"
              className="h-16 px-10 text-xl font-black uppercase tracking-widest shadow-2xl active:scale-95"
            >
              <CheckCircle className="h-6 w-6 mr-3" />
              Complete
            </Button>
          )}

          <Button
            onClick={() => onAction('skip', dbTask, false)}
            disabled={dbTask.is_locked || isProcessingCommand}
            variant="glass"
            className="h-16 px-8 text-lg font-black uppercase tracking-widest text-destructive hover:bg-destructive/10 border-white/5 active:scale-95"
          >
            <Archive className="h-6 w-6 mr-3" />
            Archive
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ImmersiveFocusMode;