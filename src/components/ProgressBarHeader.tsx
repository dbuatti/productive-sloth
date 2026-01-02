"use client";

import React from 'react';
import { useSession } from '@/hooks/use-session';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Sparkles, Zap, Trophy, BatteryCharging, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isToday, parseISO } from 'date-fns';
import { MAX_ENERGY, RECHARGE_BUTTON_AMOUNT } from '@/lib/constants';
import { calculateLevelInfo, cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile'; 
import ThemeToggle from './ThemeToggle'; // Import ThemeToggle
import ProfileDropdown from './ProfileDropdown'; // Import ProfileDropdown
import { Link } from 'react-router-dom'; // Import Link for logo navigation

const ProgressBarHeader: React.FC = () => {
  const { profile, rechargeEnergy } = useSession();
  const isMobile = useIsMobile(); 

  if (!profile) return null;

  const { level, xpTowardsNextLevel, xpNeededForNextLevel } = calculateLevelInfo(profile.xp);
  const isEnergyFull = profile.energy >= MAX_ENERGY;
  const isEnergyDeficit = profile.energy < 0;
  const hasClaimedDailyChallengeToday = profile.last_daily_reward_claim ? isToday(parseISO(profile.last_daily_reward_claim)) : false;

  const stats = [
    {
      key: 'xp',
      icon: Sparkles,
      label: 'Lvl',
      value: `${level}`,
      subLabel: `${xpTowardsNextLevel}/${xpNeededForNextLevel}`,
      tooltip: `${xpNeededForNextLevel - xpTowardsNextLevel} XP to Level ${level + 1}`,
      color: 'logo-yellow',
      isDeficit: false,
      action: null,
    },
    {
      key: 'energy',
      icon: Zap,
      label: '⚡',
      value: `${profile.energy}`,
      subLabel: isEnergyDeficit ? 'Exhausted' : 'Core',
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
      tooltip: hasClaimedDailyChallengeToday ? 'Quest Complete: Reward Claimed' : `Sync ${profile.daily_challenge_target - profile.tasks_completed_today} more tasks`,
      color: hasClaimedDailyChallengeToday ? 'logo-green' : 'accent',
      isDeficit: false,
      action: null,
    },
  ];

  return (
    <header className={cn(
      "fixed top-0 left-0 right-0 z-50",
      "border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm"
    )}>
      {/* Top Row: Logo, Title, ThemeToggle, ProfileDropdown */}
      <div className="flex items-center justify-between h-16 px-4 md:px-8">
        {/* Left: Logo/Title */}
        <div className="flex items-center">
          <Link 
            to="/" 
            className="flex items-center gap-2 group active:scale-95 transition-transform duration-200"
          >
            <div className="relative">
              <img 
                src="/aetherflow-logo.png" 
                alt="AetherFlow Logo" 
                className="h-9 w-auto drop-shadow-[0_0_8px_rgba(var(--primary),0.3)]"
              />
              <div className="absolute -inset-1 bg-primary/10 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <span className="ml-3 text-xl font-bold text-foreground hidden sm:inline">AetherFlow</span>
          </Link>
        </div>

        {/* Right: ThemeToggle, ProfileDropdown */}
        <div className="flex items-center space-x-3">
          <ThemeToggle />
          <ProfileDropdown />
        </div>
      </div>

      {/* Bottom Row: Progress Bars */}
      <div className="w-full px-4 md:px-8 py-3 border-t border-border/50">
        <div className={cn(
          "flex gap-3",
          isMobile ? "overflow-x-auto pb-1 snap-x snap-mandatory" : "grid grid-cols-3"
        )}>
          {stats.map((stat) => {
            const Icon = stat.icon;
            const isActionable = stat.action && !isEnergyFull && !hasClaimedDailyChallengeToday;
            
            return (
              <div 
                key={stat.key}
                className={cn(
                  "flex-shrink-0 flex items-center gap-2 group cursor-help snap-center rounded-full px-3 py-1.5 border transition-all",
                  isMobile ? "w-auto bg-background/40" : "w-full justify-center bg-background/50",
                  stat.isDeficit ? "border-destructive/20" : "border-white/10 hover:border-primary/20"
                )}
              >
                <div className={cn(
                  "flex items-center justify-center h-6 w-6 rounded-full",
                  stat.isDeficit ? "bg-destructive/10 text-destructive" : `bg-${stat.color}/10 text-${stat.color}`
                )}>
                  {stat.isDeficit ? <AlertTriangle className="h-3 w-3 animate-pulse" /> : <Icon className="h-3 w-3" />}
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase tracking-widest opacity-60">{stat.label}</span>
                  <span className={cn("text-xs font-bold font-mono leading-none", stat.isDeficit && "text-destructive animate-pulse")}>{stat.value}</span>
                </div>
                {/* Subtle Indicator Bar */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="ml-2 flex items-center gap-1">
                       <div className="h-1 w-8 rounded-full bg-secondary/50 overflow-hidden">
                        <div 
                          className={cn("h-full transition-all duration-500", 
                            stat.isDeficit ? "bg-destructive" : `bg-${stat.color}`
                          )} 
                          style={{ 
                            width: stat.key === 'quest' 
                              ? `${(profile.tasks_completed_today / profile.daily_challenge_target) * 100}%`
                              : `${Math.min(Math.max((profile.energy / MAX_ENERGY) * 100, 0), 100)}%`
                          }} 
                        />
                       </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="glass-card p-2.5">
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-xs font-semibold">
                        <span>{stat.label} Status</span>
                        <span className="font-mono">{stat.subLabel}</span>
                      </div>
                      <p className="text-[10px] opacity-80">{stat.tooltip}</p>
                      {isActionable && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={(e) => { e.stopPropagation(); stat.action!(); }} 
                          className="w-full h-7 text-[10px] uppercase font-bold tracking-tighter mt-1"
                        >
                          <BatteryCharging className="h-3 w-3 mr-1.5" />
                          Recharge
                        </Button>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
            );
          })}
        </div>
      </div>
    </header>
  );
};

export default ProgressBarHeader;