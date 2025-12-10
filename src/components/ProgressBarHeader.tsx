import React from 'react';
import { useSession } from '@/hooks/use-session';
import { useTasks } from '@/hooks/use-tasks';
import { CustomProgress } from './CustomProgress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Sparkles, Zap, Trophy, BatteryCharging, AlertTriangle } from 'lucide-react'; // Added AlertTriangle
import { Button } from '@/components/ui/button';
import { isToday, parseISO } from 'date-fns';
import { 
  MAX_ENERGY, 
  RECHARGE_BUTTON_AMOUNT, 
} from '@/lib/constants';
import { calculateLevelInfo, cn } from '@/lib/utils'; // Import cn

const ProgressBarHeader: React.FC = () => {
  const { profile, rechargeEnergy } = useSession();
  const { allTasks } = useTasks();

  if (!profile) {
    return null;
  }

  const { level, xpTowardsNextLevel, xpNeededForNextLevel, progressPercentage: xpProgress } = calculateLevelInfo(profile.xp);

  const energyPercentage = (profile.energy / MAX_ENERGY) * 100;
  const isEnergyFull = profile.energy >= MAX_ENERGY;
  const isEnergyDeficit = profile.energy < 0; // NEW: Check for energy deficit

  const dailyChallengeProgress = (profile.tasks_completed_today / profile.daily_challenge_target) * 100;
  const hasClaimedDailyChallengeToday = profile.last_daily_reward_claim ? isToday(parseISO(profile.last_daily_reward_claim)) : false;

  return (
    <div className="sticky top-16 z-10 border-b bg-background py-2">
      <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-3 px-4">
        {/* XP Progress Bar */}
        <div className="flex items-center gap-2 w-full sm:w-1/3">
          <Sparkles className="h-4 w-4 text-logo-yellow" />
          <Tooltip>
            <TooltipTrigger asChild>
              <CustomProgress 
                value={xpProgress} 
                className="h-2 flex-grow bg-secondary"
                indicatorClassName="bg-primary"
              />
            </TooltipTrigger>
            <TooltipContent>
              <div>
                <p>Level {level}: {xpTowardsNextLevel} / {xpNeededForNextLevel} XP</p>
                <p>{xpNeededForNextLevel - xpTowardsNextLevel} XP to next level!</p>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Energy Progress Bar */}
        <div className="flex items-center gap-2 w-full sm:w-1/3">
          {isEnergyDeficit ? ( // NEW: Conditional icon for deficit
            <AlertTriangle className="h-4 w-4 text-destructive animate-pulse-glow" />
          ) : (
            <Zap className="h-4 w-4 text-logo-yellow" />
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <CustomProgress 
                value={isEnergyDeficit ? 0 : energyPercentage} // Show 0% progress if in deficit
                className="h-2 flex-grow bg-secondary"
                indicatorClassName={cn(
                  "transition-all duration-500",
                  isEnergyDeficit ? "bg-destructive animate-pulse-glow" : "bg-primary" // NEW: Deficit styling
                )}
              />
            </TooltipTrigger>
            <TooltipContent>
              <div>
                <p>Energy: {profile.energy} / {MAX_ENERGY}</p>
                {isEnergyDeficit && ( // NEW: Deficit message in tooltip
                  <p className="text-destructive font-semibold mt-1">
                    ⚠️ Energy Deficit! Recovery is critical.
                  </p>
                )}
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={() => rechargeEnergy(RECHARGE_BUTTON_AMOUNT)} 
                  disabled={isEnergyFull}
                  className="flex items-center gap-1 text-xs font-semibold mt-2 w-full"
                >
                  <BatteryCharging className="h-3 w-3" />
                  Recharge (+{RECHARGE_BUTTON_AMOUNT})
                </Button>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Daily Challenge Progress Bar */}
        <div className="flex items-center gap-2 w-full sm:w-1/3">
          <Trophy className="h-4 w-4 text-accent" />
          <Tooltip>
            <TooltipTrigger asChild>
              <CustomProgress 
                value={dailyChallengeProgress} 
                className="h-2 flex-grow bg-secondary"
                indicatorClassName="bg-accent"
              />
            </TooltipTrigger>
            <TooltipContent>
              {hasClaimedDailyChallengeToday ? (
                <p>Daily Challenge Claimed!</p>
              ) : (
                <p>{profile.tasks_completed_today} / {profile.daily_challenge_target} tasks for daily challenge</p>
              )}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

export default ProgressBarHeader;