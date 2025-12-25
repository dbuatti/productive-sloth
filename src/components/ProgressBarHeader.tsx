"use client";

import React from 'react';
import { useSession } from '@/hooks/use-session';
import { CustomProgress } from './CustomProgress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Sparkles, Zap, Trophy, BatteryCharging, AlertTriangle, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isToday, parseISO } from 'date-fns';
import { MAX_ENERGY, RECHARGE_BUTTON_AMOUNT } from '@/lib/constants';
import { calculateLevelInfo, cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile'; 

const ProgressBarHeader: React.FC = () => {
  const { profile, rechargeEnergy } = useSession();
  const isMobile = useIsMobile(); 

  if (!profile) return null;

  const { level, xpTowardsNextLevel, xpNeededForNextLevel, progressPercentage: xpProgress } = calculateLevelInfo(profile.xp);

  const energyPercentage = Math.min(Math.max((profile.energy / MAX_ENERGY) * 100, 0), 100);
  const isEnergyFull = profile.energy >= MAX_ENERGY;
  const isEnergyDeficit = profile.energy < 0;

  const dailyChallengeProgress = Math.min((profile.tasks_completed_today / profile.daily_challenge_target) * 100, 100);
  const hasClaimedDailyChallengeToday = profile.last_daily_reward_claim ? isToday(parseISO(profile.last_daily_reward_claim)) : false;

  return (
    <div className={cn(
      "glass-header border-b py-3 transition-all duration-300 ease-aether-out",
      "w-full z-40" // Ensuring it stacks correctly in MainLayout
    )}>
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-8">
          
          {/* XP Status - Experience HUD */}
          <div className="flex items-center gap-3 group cursor-help">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-logo-yellow/10 text-logo-yellow border border-logo-yellow/20 shadow-[0_0_15px_rgba(var(--logo-yellow),0.1)] group-hover:scale-110 group-hover:bg-logo-yellow/20 transition-all duration-300">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex flex-col flex-grow gap-1.5">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 px-0.5">
                <span className="flex items-center gap-1">Level {level} <ChevronRight className="h-2 w-2" /></span>
                <span className="font-mono text-primary">{xpTowardsNextLevel} / {xpNeededForNextLevel}</span>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="status-bar-track group-hover:border-primary/40 transition-all duration-300">
                    <CustomProgress 
                      value={xpProgress} 
                      className="h-full bg-transparent overflow-hidden"
                      indicatorClassName="bg-gradient-to-r from-primary/60 via-primary to-primary/60 animate-shimmer shadow-[0_0_12px_hsl(var(--primary)/0.4)]"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="glass-card">
                  <p className="font-medium">{xpNeededForNextLevel - xpTowardsNextLevel} XP remaining until transcendence to Level {level + 1}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Energy Status - Resource HUD */}
          <div className="flex items-center gap-3 group cursor-help">
            <div className={cn(
              "flex items-center justify-center h-9 w-9 rounded-xl border transition-all duration-300 group-hover:scale-110",
              isEnergyDeficit 
                ? "bg-destructive/10 text-destructive border-destructive/20 shadow-[0_0_15px_rgba(var(--destructive),0.2)]" 
                : "bg-logo-green/10 text-logo-green border-logo-green/20 shadow-[0_0_15px_rgba(var(--logo-green),0.1)]"
            )}>
              {isEnergyDeficit ? <AlertTriangle className="h-4 w-4 animate-pulse" /> : <Zap className={cn("h-4 w-4", isEnergyFull && "fill-current")} />}
            </div>
            <div className="flex flex-col flex-grow gap-1.5">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 px-0.5">
                <span>Core Energy</span>
                <span className={cn("font-mono", isEnergyDeficit && "text-destructive animate-pulse")}>
                  {profile.energy}⚡
                </span>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={cn(
                    "status-bar-track transition-all duration-300",
                    isEnergyDeficit ? "border-destructive/30" : "group-hover:border-logo-green/40"
                  )}>
                    <CustomProgress 
                      value={isEnergyDeficit ? 100 : energyPercentage}
                      className="h-full bg-transparent"
                      indicatorClassName={cn(
                        "transition-all duration-700",
                        isEnergyDeficit 
                          ? "bg-destructive shadow-[0_0_12px_rgba(var(--destructive),0.5)]" 
                          : "bg-gradient-to-r from-logo-green/60 to-logo-green shadow-[0_0_12px_hsl(var(--logo-green)/0.4)]",
                        isEnergyFull && "animate-pulse-glow"
                      )}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="glass-card w-56 p-3">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold">Reserve Status</span>
                      <span className="text-xs font-mono">{profile.energy} / {MAX_ENERGY}</span>
                    </div>
                    {isEnergyDeficit && (
                      <div className="flex items-center gap-2 p-2 rounded bg-destructive/10 border border-destructive/20">
                        <AlertTriangle className="h-3 w-3 text-destructive" />
                        <p className="text-[10px] text-destructive font-bold uppercase">System Exhaustion</p>
                      </div>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={(e) => { e.stopPropagation(); rechargeEnergy(RECHARGE_BUTTON_AMOUNT); }} 
                      disabled={isEnergyFull}
                      className="w-full h-8 text-[10px] uppercase font-black tracking-tighter hover:bg-primary/10 hover:text-primary transition-all"
                    >
                      <BatteryCharging className="h-3 w-3 mr-2" />
                      Initiate Recharge
                    </Button>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Quest Status - Achievement HUD */}
          <div className="flex items-center gap-3 group cursor-help">
            <div className={cn(
              "flex items-center justify-center h-9 w-9 rounded-xl border transition-all duration-300 group-hover:scale-110",
              hasClaimedDailyChallengeToday 
                ? "bg-logo-green/10 text-logo-green border-logo-green/20" 
                : "bg-accent/10 text-accent border-accent/20 shadow-[0_0_15px_rgba(var(--accent),0.1)]"
            )}>
              <Trophy className={cn("h-4 w-4", hasClaimedDailyChallengeToday && "fill-current")} />
            </div>
            <div className="flex flex-col flex-grow gap-1.5">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 px-0.5">
                <span>Daily Quest</span>
                <span className="font-mono text-accent">{profile.tasks_completed_today} / {profile.daily_challenge_target}</span>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="status-bar-track group-hover:border-accent/40 transition-all duration-300">
                    <CustomProgress 
                      value={dailyChallengeProgress} 
                      className="h-full bg-transparent"
                      indicatorClassName={cn(
                        "bg-gradient-to-r from-accent/60 via-accent to-accent/60 shadow-[0_0_12px_hsl(var(--accent)/0.4)]",
                        hasClaimedDailyChallengeToday && "from-logo-green to-logo-green shadow-[0_0_12px_hsl(var(--logo-green)/0.3)]"
                      )}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="glass-card">
                  <p className="font-medium">
                    {hasClaimedDailyChallengeToday 
                      ? 'Quest Complete: Transcendence Reward Claimed' 
                      : `Sync ${profile.daily_challenge_target - profile.tasks_completed_today} more tasks to unlock daily bonus`}
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ProgressBarHeader;