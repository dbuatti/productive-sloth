"use client";

import React from 'react';
import { useSession } from '@/hooks/use-session';
import { useTasks } from '@/hooks/use-tasks';
import { CustomProgress } from './CustomProgress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Sparkles, Zap, Trophy, BatteryCharging, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isToday, parseISO } from 'date-fns';
import { 
  MAX_ENERGY, 
  RECHARGE_BUTTON_AMOUNT, 
} from '@/lib/constants';
import { calculateLevelInfo, cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile'; 

const ProgressBarHeader: React.FC = () => {
  const { profile, rechargeEnergy } = useSession();
  const isMobile = useIsMobile(); 

  if (!profile) {
    return null;
  }

  const { level, xpTowardsNextLevel, xpNeededForNextLevel, progressPercentage: xpProgress } = calculateLevelInfo(profile.xp);

  const energyPercentage = (profile.energy / MAX_ENERGY) * 100;
  const isEnergyFull = profile.energy >= MAX_ENERGY;
  const isEnergyDeficit = profile.energy < 0;

  const dailyChallengeProgress = (profile.tasks_completed_today / profile.daily_challenge_target) * 100;
  const hasClaimedDailyChallengeToday = profile.last_daily_reward_claim ? isToday(parseISO(profile.last_daily_reward_claim)) : false;

  return (
    <div className={cn(
      "sticky z-20 border-b glass-header py-3 top-16"
    )}>
      <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-4 px-6">
        
        {/* XP Status - Lvl X */}
        <div className="flex items-center gap-3 w-full sm:w-1/3 group">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-logo-yellow/20 text-logo-yellow shadow-sm group-hover:scale-110 transition-transform">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex flex-col flex-grow gap-1">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-0.5">
              <span>Lvl {level} Experience</span>
              <span className="font-mono">{xpTowardsNextLevel}/{xpNeededForNextLevel}</span>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="status-bar-track group-hover:border-primary/30 transition-colors">
                  <CustomProgress 
                    value={xpProgress} 
                    className="h-full bg-transparent"
                    indicatorClassName="bg-gradient-to-r from-primary/80 to-primary animate-pulse-glow shadow-[0_0_8px_rgba(var(--primary),0.4)]"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{xpNeededForNextLevel - xpTowardsNextLevel} XP to Level {level + 1}!</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Energy Status */}
        <div className="flex items-center gap-3 w-full sm:w-1/3 group">
          <div className={cn(
            "flex items-center justify-center h-8 w-8 rounded-lg shadow-sm group-hover:scale-110 transition-transform",
            isEnergyDeficit ? "bg-destructive/20 text-destructive" : "bg-logo-green/20 text-logo-green"
          )}>
            {isEnergyDeficit ? <AlertTriangle className="h-4 w-4 animate-pulse" /> : <Zap className="h-4 w-4" />}
          </div>
          <div className="flex flex-col flex-grow gap-1">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-0.5">
              <span>Energy Potential</span>
              <span className={cn("font-mono", isEnergyDeficit && "text-destructive")}>{profile.energy}/{MAX_ENERGY}⚡</span>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="status-bar-track group-hover:border-logo-green/30 transition-colors">
                  <CustomProgress 
                    value={isEnergyDeficit ? 0 : energyPercentage}
                    className="h-full bg-transparent"
                    indicatorClassName={cn(
                      "transition-all duration-700",
                      isEnergyDeficit ? "bg-destructive" : "bg-gradient-to-r from-logo-green/80 to-logo-green shadow-[0_0_8px_rgba(var(--logo-green),0.4)]"
                    )}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-2 p-1">
                  <p>Energy: {profile.energy} / {MAX_ENERGY}</p>
                  {isEnergyDeficit && <p className="text-destructive font-bold">⚠️ EXHAUSTED: In Deficit!</p>}
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={() => rechargeEnergy(RECHARGE_BUTTON_AMOUNT)} 
                    disabled={isEnergyFull}
                    className="w-full h-7 text-[10px] uppercase font-bold tracking-widest bg-primary/10 hover:bg-primary/20 text-primary border-none"
                  >
                    <BatteryCharging className="h-3 w-3 mr-1" />
                    Pulse Recharge
                  </Button>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Daily Challenge Status */}
        <div className="flex items-center gap-3 w-full sm:w-1/3 group">
          <div className={cn(
            "flex items-center justify-center h-8 w-8 rounded-lg shadow-sm group-hover:scale-110 transition-transform",
            hasClaimedDailyChallengeToday ? "bg-logo-green/20 text-logo-green" : "bg-accent/20 text-accent"
          )}>
            <Trophy className="h-4 w-4" />
          </div>
          <div className="flex flex-col flex-grow gap-1">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-0.5">
              <span>Daily Quest</span>
              <span className="font-mono">{profile.tasks_completed_today}/{profile.daily_challenge_target}</span>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="status-bar-track group-hover:border-accent/30 transition-colors">
                  <CustomProgress 
                    value={dailyChallengeProgress} 
                    className="h-full bg-transparent"
                    indicatorClassName={cn(
                      "bg-gradient-to-r from-accent/80 to-accent shadow-[0_0_8px_rgba(var(--accent),0.4)]",
                      hasClaimedDailyChallengeToday && "from-logo-green to-logo-green"
                    )}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{hasClaimedDailyChallengeToday ? 'Quest Reward Claimed!' : `${profile.tasks_completed_today} / ${profile.daily_challenge_target} tasks for daily bonus`}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgressBarHeader;