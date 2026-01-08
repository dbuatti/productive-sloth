"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { intervalToDuration, formatDuration, addMinutes, differenceInMinutes, parseISO } from 'date-fns';
import { X, Zap, Loader2, Coffee, Heart, BatteryCharging, ListTodo, Settings, Play, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { REGEN_POD_RATE_PER_MINUTE, MAX_ENERGY } from '@/lib/constants';
import { useSession } from '@/hooks/use-session';
import { showSuccess, showError } from '@/utils/toast';
import { CustomProgress } from './CustomProgress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRecoveryActivities, RecoveryActivity } from '@/hooks/use-recovery-activities';
import RecoveryActivityManagerDialog from './RecoveryActivityManagerDialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useCurrentTime } from './CurrentTimeProvider'; // NEW: Import useCurrentTime

interface EnergyRegenPodModalProps {
  isOpen: boolean;
  onExit: () => void; // MODIFIED: Simplified exit handler (no longer needs scheduledTaskId, startTime, endTime)
  onStart: (activityName: string, activityDuration: number) => void; // MODIFIED: Pass activity details
  isProcessingCommand: boolean;
  totalDurationMinutes: number;
}

const PodState = {
  INITIAL: 'INITIAL', // User selects activity
  RUNNING: 'RUNNING', // Timer is active
  EXITING: 'EXITING', // Processing exit command
} as const;

const EnergyRegenPodModal: React.FC<EnergyRegenPodModalProps> = ({
  isOpen,
  onExit,
  onStart,
  isProcessingCommand,
  totalDurationMinutes,
}) => {
  const { profile, exitRegenPodState } = useSession();
  const { T_current } = useCurrentTime(); // NEW: Get T_current from CurrentTimeProvider
  const { activities, isLoading: isLoadingActivities } = useRecoveryActivities();
  
  const [podState, setPodState] = useState<keyof typeof PodState>('INITIAL');
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);
  const [showOptimizedCue, setShowOptimizedCue] = useState(false);
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  
  // State for Active Recovery selection (ID)
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  
  const selectedActivity = useMemo(() => {
    if (selectedActivityId) {
      return activities.find(a => a.id === selectedActivityId);
    }
    return null;
  }, [activities, selectedActivityId]);

  // Dynamic duration based on selected activity, capped by totalDurationMinutes
  const effectivePodDuration = useMemo(() => {
    if (selectedActivity) {
      return Math.min(selectedActivity.duration_minutes, totalDurationMinutes);
    }
    return totalDurationMinutes;
  }, [selectedActivity, totalDurationMinutes]);

  const calculatedEnergyGain = useMemo(() => {
    return Math.floor(elapsedMinutes * REGEN_POD_RATE_PER_MINUTE);
  }, [elapsedMinutes]);

  const progressPercentage = useMemo(() => {
    return Math.min(100, (elapsedMinutes / effectivePodDuration) * 100);
  }, [elapsedMinutes, effectivePodDuration]);

  const currentEnergy = profile?.energy ?? 0;
  const maxEnergy = MAX_ENERGY;
  const finalEnergy = Math.min(currentEnergy + calculatedEnergyGain, maxEnergy);
  const energyBarFill = Math.min(100, (finalEnergy / maxEnergy) * 100);
  
  // --- Action Handlers ---
  // Moved handleExitPod definition here
  const handleExitPod = useCallback(async () => {
    if (podState === 'EXITING') return;
    setPodState('EXITING');
    
    // Call the session provider's exit logic which handles server calculation and profile reset
    await exitRegenPodState();
    
    // Notify parent component (SchedulerPage) to close the modal
    onExit();
  }, [podState, exitRegenPodState, onExit]);

  // --- Initialization and Cleanup ---
  useEffect(() => {
    if (!isOpen) {
      setPodState('INITIAL');
      setSessionStartTime(null);
      setElapsedMinutes(0);
      setShowOptimizedCue(false);
      setSelectedActivityId(null);
      return;
    }

    // If the modal opens and the profile indicates the pod is already running (e.g., after a refresh)
    if (profile?.is_in_regen_pod && profile.regen_pod_start_time && podState === 'INITIAL') {
        const start = parseISO(profile.regen_pod_start_time);
        setSessionStartTime(start);
        setPodState('RUNNING');
        // Note: We rely on totalDurationMinutes passed from SessionProvider for the cap
    }

    if (podState === 'INITIAL' && activities.length > 0 && !selectedActivityId) {
        // Auto-select the first activity if none is selected
        setSelectedActivityId(activities[0].id);
    }
  }, [isOpen, profile, activities, selectedActivityId, podState]);

  // --- Timer and Running State Management ---
  useEffect(() => {
    if (podState === 'RUNNING' && sessionStartTime) {
      const interval = setInterval(() => {
        const now = T_current; // Use T_current
        const elapsed = differenceInMinutes(now, sessionStartTime);
        setElapsedMinutes(elapsed);

        const totalDurationMs = effectivePodDuration * 60 * 1000;
        const elapsedMs = now.getTime() - sessionStartTime.getTime();
        const remainingMs = totalDurationMs - elapsedMs;
        
        if (remainingMs <= 0) {
          // Time's up! Auto-exit.
          handleExitPod();
          return;
        }

        const duration = intervalToDuration({ start: now, end: addMinutes(sessionStartTime, effectivePodDuration) });
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
        if (elapsed >= effectivePodDuration * 0.8 && !showOptimizedCue) {
          setShowOptimizedCue(true);
          console.log("AUDIO CUE: PING! Recovery Optimized.");
        }

      }, 1000);

      return () => clearInterval(interval);
    }
  }, [podState, sessionStartTime, effectivePodDuration, showOptimizedCue, T_current, handleExitPod]);

  const handleStartPod = () => {
    if (!selectedActivity) {
        showError("Please select a recovery activity to start the Pod.");
        return;
    }
    
    const start = T_current; // Use T_current
    
    // 1. Notify parent to start the session (updates profile state)
    const activityName = selectedActivity.name; 
    onStart(activityName, effectivePodDuration); // Notify parent to update profile state and duration
    
    // 2. Optimistically set internal state to RUNNING immediately for smooth UI transition
    setSessionStartTime(start);
    setPodState('RUNNING');
  };

  const isExiting = podState === 'EXITING' || isProcessingCommand;
  const isRunning = podState === 'RUNNING';
  const podTitle = selectedActivity ? `Active Recovery: ${selectedActivity.name}` : 'Energy Regen Pod Setup';

  return (
    <>
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
          
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-4 text-5xl font-extrabold text-primary animate-pulse-glow-subtle">
              <BatteryCharging className="h-12 w-12 text-logo-green" />
              {podTitle}
            </div>
            <p className="text-lg text-muted-foreground">
                Target Duration: {effectivePodDuration} min (Max Energy: {maxEnergy}⚡)
            </p>
          </div>

          {/* Activity Selection & Management */}
          <div className="flex items-center gap-3 w-full max-w-md">
            <ListTodo className="h-5 w-5 text-primary shrink-0" />
            
            {isRunning ? (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="flex-grow h-11 flex items-center justify-between px-3 rounded-md border bg-secondary/50 text-foreground font-semibold cursor-not-allowed">
                            <div className="flex items-center gap-2">
                                <Lock className="h-4 w-4 text-primary" />
                                {selectedActivity?.name || 'Recovery Activity'} ({effectivePodDuration} min)
                            </div>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Activity is locked while the Pod is running. Exit to change.</p>
                    </TooltipContent>
                </Tooltip>
            ) : (
                <Select 
                    value={selectedActivityId || undefined} 
                    onValueChange={setSelectedActivityId}
                    disabled={isExiting || isLoadingActivities || activities.length === 0}
                >
                    <SelectTrigger className="flex-grow h-11">
                        <SelectValue placeholder="Select Active Recovery Activity" />
                    </SelectTrigger>
                    <SelectContent>
                        {activities.map(activity => (
                        <SelectItem key={activity.id} value={activity.id}>
                            {activity.name} ({activity.duration_minutes} min)
                        </SelectItem>
                        ))}
                        {activities.length === 0 && (
                            <SelectItem value="none" disabled>No activities defined</SelectItem>
                        )}
                    </SelectContent>
                </Select>
            )}
            
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={() => setIsManagerOpen(true)}
                        disabled={isExiting}
                        className="h-11 w-11 shrink-0"
                    >
                        <Settings className="h-5 w-5" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>Manage Activities</TooltipContent>
            </Tooltip>
          </div>

          {/* Conditional Display: Cauldron or Start Button */}
          {isRunning ? (
            <>
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
                        <p className="text-2xl font-extrabold font-mono text-primary">{timeRemaining || `${effectivePodDuration}m`}</p>
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
            </>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-6 py-12">
                <p className="text-lg text-muted-foreground">
                    Select an activity and press start to begin your energy recovery session.
                </p>
                <Button
                    onClick={handleStartPod}
                    disabled={isExiting || !selectedActivity}
                    className={cn(
                        "h-14 px-10 text-xl font-semibold bg-logo-green hover:bg-logo-green/90 transition-all duration-200",
                        isExiting && "opacity-70 cursor-not-allowed"
                    )}
                >
                    {isExiting ? (
                        <Loader2 className="h-6 w-6 mr-2 animate-spin" />
                    ) : (
                        <Play className="h-6 w-6 mr-2" />
                    )}
                    Start Recovery
                </Button>
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
      <RecoveryActivityManagerDialog open={isManagerOpen} onOpenChange={setIsManagerOpen} />
    </>
  );
};

export default EnergyRegenPodModal;