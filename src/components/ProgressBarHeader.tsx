import React from 'react';
import { useSession } from '@/hooks/use-session';
import { useTasks } from '@/hooks/use-tasks';
import { CustomProgress } from './CustomProgress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Sparkles, Zap, Trophy, BatteryCharging } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isToday, parseISO } from 'date-fns';
import { 
  XP_PER_LEVEL, 
  MAX_ENERGY, 
  RECHARGE_BUTTON_AMOUNT 
} from '@/lib/constants'; // Removed static constant
import DailyChallengeClaimButton from './DailyChallengeClaimButton'; // Import the claim button

const calculateLevelInfo = (totalXp: number) => {
  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
  const xpForCurrentLevel = (level - 1) * XP_PER_LEVEL;
  const xpTowardsNextLevel = totalXp - xpForCurrentLevel;
  const xpNeededForNextLevel = XP_PER_LEVEL;
  const progressPercentage = (xpTowardsNextLevel / xpNeededForNextLevel) * 100;
  return { level, xpTowardsNextLevel, xpNeededForNextLevel, progressPercentage };
};

const ProgressBarHeader: React.FC = () => {
  const { profile, rechargeEnergy } = useSession();
  const { allTasks } = useTasks();

  if (!profile) {
    return null;
  }

  // XP Progress
  const { level, xpTowardsNextLevel, xpNeededForNextLevel, progressPercentage: xpProgress } = calculateLevelInfo(profile.xp);

  // Energy Progress
  const energyPercentage = (profile.energy / MAX_ENERGY) * 100;
  const isEnergyFull = profile.energy >= MAX_ENERGY;

  // Daily Challenge Progress
  const dailyChallengeTarget = profile.daily_challenge_target; // Use dynamic target
  const hasClaimedDailyChallengeToday = profile.last_daily_reward_claim ? isToday(parseISO(profile.last_daily_reward_claim)) : false;
  const dailyChallengeProgress = (profile.tasks_completed_today / dailyChallengeTarget) * 100;
  const canClaimDailyChallenge = profile.tasks_completed_today >= dailyChallengeTarget && !hasClaimedDailyChallengeToday;

  return (
    <div className="sticky top-16 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-2">
      <div className="container mx-auto max-w-3xl flex flex-col sm:flex-row items-center justify-between gap-3 px-4">
        
        {/* XP Progress Bar */}
        <div className="flex items-center gap-2 w-full sm:w-1/3">
          <Sparkles className="h-4 w-4 text-logo-yellow animate-pulse-glow" />
          <Tooltip>
            <TooltipTrigger asChild>
              <CustomProgress 
                value={xpProgress} 
                className="h-2 flex-grow bg-primary/20"
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
          <Zap className="h-4 w-4 text-logo-yellow animate-pulse-glow" />
          <Tooltip>
            <TooltipTrigger asChild>
              <CustomProgress 
                value={energyPercentage} 
                className="h-2 flex-grow bg-primary/20"
                indicatorClassName="bg-primary"
              />
            </TooltipTrigger>
            <TooltipContent>
              <div>
                <p>Energy: {profile.energy} / {MAX_ENERGY}</p>
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

        {/* Daily Challenge Progress Bar & Claim Button */}
        <div className="flex items-center gap-2 w-full sm:w-1/3">
          {canClaimDailyChallenge ? (
            <DailyChallengeClaimButton />
          ) : (
            <>
              <Trophy className="h-4 w-4 text-accent animate-pulse-glow" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <CustomProgress 
                    value={dailyChallengeProgress} 
                    className="h-2 flex-grow bg-accent/20"
                    indicatorClassName="bg-accent"
                  />
                </TooltipTrigger>
                <TooltipContent>
                  {hasClaimedDailyChallengeToday ? (
                    <p>Daily Challenge Claimed!</p>
                  ) : (
                    <p>{profile.tasks_completed_today} / {dailyChallengeTarget} tasks for daily challenge</p>
                  )}
                </TooltipContent>
              </Tooltip>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProgressBarHeader;