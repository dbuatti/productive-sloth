"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Coffee, Rocket, Check, Sparkles, Clock, ChevronRight } from 'lucide-react';
import { formatDuration, intervalToDuration } from 'date-fns';
import { cn } from '@/lib/utils';

interface EarlyCompletionModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  taskName: string;
  remainingDurationMinutes: number;
  onTakeBreak: () => void;
  onStartNextTask: () => void;
  onJustFinish: () => void; 
  isProcessingCommand: boolean;
  hasNextTask: boolean;
}

const EarlyCompletionModal: React.FC<EarlyCompletionModalProps> = ({
  isOpen,
  onOpenChange,
  taskName,
  remainingDurationMinutes,
  onTakeBreak,
  onStartNextTask,
  onJustFinish,
  isProcessingCommand,
  hasNextTask,
}) => {
  const remainingDurationFormatted = React.useMemo(() => {
    if (remainingDurationMinutes <= 0) return '00m 00s';
    const duration = intervalToDuration({ start: 0, end: remainingDurationMinutes * 60 * 1000 });
    
    const h = duration.hours || 0;
    const m = duration.minutes || 0;
    
    return `${h > 0 ? h + 'h ' : ''}${m}m`;
  }, [remainingDurationMinutes]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl glass-card border-primary/20 p-0 overflow-hidden shadow-2xl animate-pop-in">
        {/* Luminous Header Accent */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-logo-green via-primary to-accent opacity-60" />

        <div className="p-8">
          <DialogHeader className="mb-8">
            <div className="flex justify-center mb-4">
              <div className="bg-logo-green/10 p-4 rounded-2xl border border-logo-green/20">
                <Sparkles className="h-8 w-8 text-logo-green animate-pulse" />
              </div>
            </div>
            <DialogTitle className="text-3xl font-black tracking-tighter uppercase text-foreground text-center leading-none">
              Temporal Surplus Detected
            </DialogTitle>
            <DialogDescription className="text-center text-muted-foreground font-bold uppercase tracking-widest text-[11px] mt-4">
              Objective <span className="text-foreground">"{taskName}"</span> Synchronized Early
            </DialogDescription>
          </DialogHeader>

          {/* Time Display HUD */}
          <div className="flex flex-col items-center justify-center p-6 rounded-3xl bg-background/40 border border-white/5 shadow-inner mb-8">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/40 mb-2 flex items-center gap-2">
              <Clock className="h-3 w-3" /> Remaining Credit
            </span>
            <span className="text-5xl font-black font-mono tracking-tighter text-logo-green drop-shadow-[0_0_15px_rgba(var(--logo-green),0.3)]">
              {remainingDurationFormatted}
            </span>
          </div>

          <div className="grid gap-3">
            {/* Momentum Action */}
            <Button
              onClick={onStartNextTask}
              disabled={isProcessingCommand || !hasNextTask}
              variant="aether"
              className={cn(
                "h-16 w-full justify-between px-6 text-sm font-black uppercase tracking-widest transition-all group",
                (!hasNextTask || isProcessingCommand) && "opacity-30 grayscale cursor-not-allowed"
              )}
            >
              <div className="flex items-center gap-4">
                <Rocket className="h-5 w-5 group-hover:animate-bounce" />
                <span>Shift Momentum Forward</span>
              </div>
              <ChevronRight className="h-4 w-4 opacity-50" />
            </Button>

            {/* Rest Sync Action */}
            <Button
              onClick={onTakeBreak}
              disabled={isProcessingCommand}
              variant="glass"
              className="h-16 w-full justify-between px-6 text-sm font-black uppercase tracking-widest border-logo-orange/20 text-logo-orange hover:bg-logo-orange/10 transition-all group"
            >
              <div className="flex items-center gap-4">
                <Coffee className="h-5 w-5" />
                <span>Initialize Rest Sync</span>
              </div>
              <ChevronRight className="h-4 w-4 opacity-50" />
            </Button>

            {/* Terminal Close Action */}
            <Button
              onClick={onJustFinish}
              disabled={isProcessingCommand}
              variant="ghost"
              className="h-14 w-full justify-center px-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 hover:text-foreground transition-all"
            >
              <Check className="h-4 w-4 mr-2" />
              Close Temporal Window
            </Button>
          </div>
        </div>

        <div className="bg-primary/5 py-3 px-8 border-t border-white/5">
          <p className="text-[9px] text-center font-bold uppercase tracking-[0.3em] text-muted-foreground/30">
            AetherFlow Temporal Reconciliation Module v2.5
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EarlyCompletionModal;