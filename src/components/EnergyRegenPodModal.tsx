"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { intervalToDuration, formatDuration, addMinutes, differenceInMinutes } from 'date-fns';
import { X, Zap, Loader2, Coffee, Heart, BatteryCharging } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { REGEN_POD_RATE_PER_MINUTE, MAX_ENERGY } from '@/lib/constants'; // Removed REGEN_POD_DURATION_MINUTES
import { useSession } from '@/hooks/use-session';
import { showSuccess, showError } from '@/utils/toast';
import { CustomProgress } from './CustomProgress';

interface EnergyRegenPodModalProps {
  isOpen: boolean;
  onExit: (scheduledTaskId: string, startTime: Date, endTime: Date) => void;
  scheduledTaskId: string;
  onStart: () => void;
  isProcessingCommand: boolean;
  totalDurationMinutes: number; // NEW: Dynamic duration prop
}

const PodState = {
  INITIAL: 'INITIAL',
  RUNNING: 'RUNNING',
  EXITING: 'EXITING',
} as const;

const EnergyRegenPodModal: React.FC<EnergyRegenPodModalProps> = ({
  isOpen,
  onExit,
  scheduledTaskId,
  onStart,
  isProcessingCommand,
  totalDurationMinutes, // Use prop
}) => {
  const { profile, T_current } = useSession();
  const [podState, setPodState] = useState<keyof typeof PodState>('INITIAL');
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);
  const [showOptimizedCue, setShowOptimizedCue] = useState(false);

  const targetEnergyGain = totalDurationMinutes * REGEN_POD_RATE_PER_MINUTE;
  const currentEnergy = profile?.energy ?? 0;
  const maxEnergy = MAX_ENERGY;

  // Calculate current energy gain based on elapsed time
  const calculatedEnergyGain = useMemo(() => {
    return Math.floor(elapsedMinutes * REGEN_POD_RATE_PER_MINUTE);
  }, [elapsedMinutes]);

  // Calculate progress percentage
  const progressPercentage = useMemo(() => {
    // Calculate progress based on the dynamic total duration
    return Math.min(100, (elapsedMinutes / totalDurationMinutes) * 100);
  }, [elapsedMinutes, totalDurationMinutes]);

  // --- Exit Handler (Moved up) ---
  const handleExitPod = useCallback(() => {
    if (podState === 'EXITING' || !startTime) return;
    setPodState('EXITING');
    
    const exitTime = new Date();
    onExit(scheduledTaskId, startTime, exitTime);
  }, [podState, startTime, onExit, scheduledTaskId]);

  // --- Timer and State Management ---
  useEffect(() => {
    if (!isOpen) {
      setPodState('INITIAL');
      setStartTime(null);
      setElapsedMinutes(0);
      setShowOptimizedCue(false);
      return;
    }

    if (podState === 'INITIAL') {
      // Start the pod when the modal opens and state is INITIAL
      setStartTime(new Date());
      setPodState('RUNNING');
      onStart(); // Notify parent to add the scheduled task
    }

    if (podState === 'RUNNING' && startTime) {
      const interval = setInterval(() => {
        const now = new Date();
        const elapsed = differenceInMinutes(now, startTime);
        setElapsedMinutes(elapsed);

        const totalDurationMs = totalDurationMinutes * 60 * 1000;
        const elapsedMs = now.getTime() - startTime.getTime();
        const remainingMs = totalDurationMs - elapsedMs;
        
        if (remainingMs <= 0) {
          // Time's up! Auto-exit.
          handleExitPod();
          return;
        }

        const duration = intervalToDuration({ start: now, end: addMinutes(startTime, totalDurationMinutes) });
        setTimeRemaining(formatDuration(duration, {
          format: ['minutes', 'seconds'],
          delimiter: ' ',
          zero: false,
          locale: {
            formatDistance: (token, count) => {
              if (token === 'xSeconds') return `${count}s`;
              if (token === 'xMinutes') return `${count}m`;
              return `${count}${token.charAt(0)}`;
            },
          },
        }) || '0s');

        // 80% Cue Logic
        if (elapsed >= totalDurationMinutes * 0.8 && !showOptimizedCue) {
          setShowOptimizedCue(true);
          // Play audio cue here if possible (not directly supported in Dyad environment)
          console.log("AUDIO CUE: PING! Recovery Optimized.");
        }

      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isOpen, podState, startTime, totalDurationMinutes, showOptimizedCue, onStart, handleExitPod]);

  if (!isOpen) return null;

  const isRunning = podState === 'RUNNING';
  const isExiting = podState === 'EXITING' || isProcessingCommand;
  const finalEnergy = Math.min(currentEnergy + calculatedEnergyGain, maxEnergy);
  const energyBarFill = Math.min(100, (finalEnergy / maxEnergy) * 100);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-lg p-4 text-foreground animate-fade-in">
      
      {/* Header/Exit Button */}
      <div className="flex justify-end p-4 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleExitPod}
          disabled={isExiting}
          className="h-10 w-10 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200"
        >
          <X className="h-6 w-6" />
          <span className="sr-only">Exit Pod</span>
        </Button>
      </div>

      {/* Main Content: Cauldron Graphic and Stats */}
      <div className="flex flex-col items-center justify-center flex-grow text-center space-y-8 max-w-2xl w-full mx-auto py-8">
        
        <div className="flex items-center gap-4 text-5xl font-extrabold text-primary animate-pulse-glow-subtle">
          <BatteryCharging className="h-12 w-12 text-logo-green" />
          Energy Regen Pod
        </div>

        {/* Cauldron/Tank Graphic */}
        <div className="relative w-48 h-64 border-4 border-primary rounded-b-3xl rounded-t-lg overflow-hidden shadow-2xl bg-card/50">
          {/* Liquid Fill */}
          <div 
            className="absolute bottom-0 left-0 right-0 bg-logo-green/70 transition-all duration-1000 ease-out"
            style={{ height: `${progressPercentage}%` }}
          >
            <div className="absolute inset-0 bg-logo-green/30 animate-pulse-glow-subtle" />
          </div>
          
          {/* Energy Zap Icon */}
          <Zap className={cn(
            "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-16 w-16 text-logo-yellow transition-opacity duration-500",
            isRunning ? "opacity-100 animate-pulse" : "opacity-0"
          )} />

          {/* Progress Text Overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-foreground">
            <p className="text-4xl font-extrabold font-mono text-primary">{Math.round(progressPercentage)}%</p>
            <p className="text-sm text-muted-foreground">Time Elapsed</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 w-full max-w-md">
            <div className="flex flex-col items-center p-3 rounded-lg bg-secondary/50">
                <p className="text-sm text-muted-foreground">Time Left</p>
                <p className="text-2xl font-extrabold font-mono text-primary">{timeRemaining || `${totalDurationMinutes}m`}</p>
            </div>
            <div className="flex flex-col items-center p-3 rounded-lg bg-secondary/50">
                <p className="text-sm text-muted-foreground">Energy Gained</p>
                <p className="text-2xl font-extrabold font-mono text-logo-green">+{calculatedEnergyGain}⚡</p>
            </div>
            <div className="flex flex-col items-center p-3 rounded-lg bg-secondary/50">
                <p className="text-sm text-muted-foreground">Final Energy</p>
                <p className="text-2xl font-extrabold font-mono text-foreground">{finalEnergy} / {maxEnergy}</p>
            </div>
        </div>

        {/* Optimized Cue */}
        {showOptimizedCue && (
          <div className="text-xl font-semibold text-accent flex items-center gap-2 animate-pulse-glow">
            <Heart className="h-6 w-6" /> Recovery Optimized!
          </div>
        )}
      </div>

      {/* Footer/Exit Button */}
      <div className="flex justify-center pb-4 pt-4 shrink-0">
        <Button
          onClick={handleExitPod}
          disabled={isExiting}
          className={cn(
            "h-12 px-8 text-lg font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all duration-200",
            isExiting && "opacity-70 cursor-not-allowed"
          )}
        >
          {isExiting ? (
            <Loader2 className="h-6 w-6 mr-2 animate-spin" />
          ) : (
            <X className="h-6 w-6 mr-2" />
          )}
          Exit Pod
        </Button>
      </div>
    </div>
  );
};

export default EnergyRegenPodModal;