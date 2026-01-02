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

  // Define the stat cards data to map over
  const stats = [
    {
      key: 'xp',
      icon: Sparkles,
      label: 'Level',
      value: `Lvl ${level}`,
      subLabel: `${xpTowardsNextLevel} / ${xpNeededForNextLevel}`,
      progress: xpProgress,
      tooltip: `${xpNeededForNextLevel - xpTowardsNextLevel} XP remaining until transcendence to Level ${level + 1}`,
      color: 'logo-yellow',
      isDeficit: false,
      action: null,
    },
    {
      key: 'energy',
      icon: Zap,
      label: 'Energy',
      value: `${profile.energy}⚡`,
      subLabel: isEnergyDeficit ? 'Exhausted' : 'Core',
      progress: isEnergyDeficit ? 100 : energyPercentage,
      tooltip: isEnergyDeficit ? 'System Exhaustion: Recharge required.' : `Reserve: ${profile.energy} / ${MAX_ENERGY}`,
      color: isEnergyDeficit ? 'destructive' : 'logo-green',
      isDeficit: isEnergyDeficit,
      action: () => rechargeEnergy(RECHARGE_BUTTON_AMOUNT),
    },
    {
      key: 'quest',
      icon: Trophy,
      label: 'Quest',
      value: `${profile.tasks_completed_today}/${profile.daily_challenge_target}`,
      subLabel: hasClaimedDailyChallengeToday ? 'Complete' : 'In Progress',
      progress: dailyChallengeProgress,
      tooltip: hasClaimedDailyChallengeToday ? 'Quest Complete: Reward Claimed' : `Sync ${profile.daily_challenge_target - profile.tasks_completed_today} more tasks`,
      color: hasClaimedDailyChallengeToday ? 'logo-green' : 'accent',
      isDeficit: false,
      action: null,
    },
  ];

  return (
    <div className={cn(
      "glass-header border-b py-3 transition-all duration-300 ease-aether-out",
      "w-full z-40"
    )}>
      <div className="w-full px-4 md:px-8">
        {/* Mobile: Scrollable Row, Desktop: Grid */}
        <div className={cn(
          "flex gap-4",
          isMobile ? "overflow-x-auto pb-2 snap-x snap-mandatory" : "grid grid-cols-3"
        )}>
          {stats.map((stat) => {
            const Icon = stat.icon;
            const isActionable = stat.action && !isEnergyFull && !hasClaimedDailyChallengeToday;
            
            return (
              <div 
                key={stat.key}
                className={cn(
                  "flex-shrink-0 flex items-center gap-3 group cursor-help min-w-[260px] snap-center",
                  isMobile ? "w-[85vw]" : "w-auto"
                )}
              >
                <div className={cn(
                  "flex items-center justify-center h-9 w-9 rounded-xl border transition-all duration-300 group-hover:scale-110",
                  stat.isDeficit 
                    ? "bg-destructive/10 text-destructive border-destructive/20 shadow-[0_0_15px_rgba(var(--destructive),0.2)]" 
                    : `bg-${stat.color}/10 text-${stat.color} border-${stat.color}/20 shadow-[0_0_15px_rgba(var(--${stat.color}),0.1)]`
                )}>
                  {stat.isDeficit ? <AlertTriangle className="h-4 w-4 animate-pulse" /> : <Icon className={cn("h-4 w-4", isEnergyFull && stat.key === 'energy' && "fill-current")} />}
                </div>
                <div className="flex flex-col flex-grow gap-1.5 min-w-0">
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 px-0.5">
                    <span className="flex items-center gap-1">{stat.label} {stat.action && <ChevronRight className="h-2 w-2" />}</span>
                    <span className={cn("font-mono", stat.isDeficit && "text-destructive animate-pulse")}>{stat.value}</span>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className={cn(
                        "status-bar-track transition-all duration-300",
                        stat.isDeficit ? "border-destructive/30" : `group-hover:border-${stat.color}/40`
                      )}>
                        <CustomProgress 
                          value={stat.progress}
                          className="h-full bg-transparent"
                          indicatorClassName={cn(
                            "transition-all duration-700",
                            stat.isDeficit 
                              ? "bg-destructive shadow-[0_0_12px_rgba(var(--destructive),0.5)]" 
                              : `bg-gradient-to-r from-${stat.color}/60 to-${stat.color} shadow-[0_0_12px_hsl(var(--${stat.color})/0.4)]`,
                            (stat.key === 'energy' && isEnergyFull) && "animate-pulse-glow"
                          )}
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="glass-card w-56 p-3">
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-semibold">{stat.label} Status</span>
                          <span className="text-xs font-mono">{stat.subLabel}</span>
                        </div>
                        <p className="text-[10px]">{stat.tooltip}</p>
                        {isActionable && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={(e) => { e.stopPropagation(); stat.action!(); }} 
                            className="w-full h-8 text-[10px] uppercase font-black tracking-tighter hover:bg-primary/10 hover:text-primary transition-all"
                          >
                            <BatteryCharging className="h-3 w-3 mr-2" />
                            Initiate Recharge
                          </Button>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ProgressBarHeader;