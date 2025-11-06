import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Sparkles, Zap, Flame, CheckCircle, Loader2 } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { CustomProgress } from './CustomProgress';
import { cn } from '@/lib/utils';
import { MAX_ENERGY, XP_PER_LEVEL, DAILY_CHALLENGE_XP, DAILY_CHALLENGE_ENERGY } from '@/lib/constants';
import DailyChallengeClaimButton from './DailyChallengeClaimButton';

// XP and Leveling Constants
const calculateLevelInfo = (totalXp: number) => {
  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
  const xpForCurrentLevel = (level - 1) * XP_PER_LEVEL;
  const xpTowardsNextLevel = totalXp - xpForCurrentLevel;
  const xpNeededForNextLevel = XP_PER_LEVEL;
  const xpProgress = (xpTowardsNextLevel / xpNeededForNextLevel) * 100;
  return { level, xpTowardsNextLevel, xpNeededForNextLevel, xpProgress };
};

const DailyChallengeCard: React.FC = () => {
  const { profile, isLoading } = useSession();

  if (isLoading || !profile) {
    return (
      <Card className="h-48 flex items-center justify-center animate-pop-in">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </Card>
    );
  }

  const { level, xpTowardsNextLevel, xpNeededForNextLevel, xpProgress } = calculateLevelInfo(profile.xp);
  
  const dailyChallengeTarget = profile.daily_challenge_target || 3;
  const dailyChallengeProgress = Math.min(100, (profile.tasks_completed_today / dailyChallengeTarget) * 100);
  const isChallengeComplete = profile.tasks_completed_today >= dailyChallengeTarget;
  const hasClaimed = profile.last_daily_reward_claim && new Date(profile.last_daily_reward_claim).toDateString() === new Date().toDateString();

  return (
    <Card className="relative w-full transition-all duration-200 ease-in-out hover:scale-[1.005] animate-pop-in overflow-hidden">
      {/* Level Badge */}
      <div className={cn(
        "absolute top-0 right-0 z-10 p-2 rounded-bl-lg",
        "bg-primary text-primary-foreground text-sm font-extrabold font-mono flex items-center gap-1"
      )}>
        <Sparkles className="h-4 w-4" />
        Lvl {level}
      </div>

      <CardHeader className="pb-3">
        <CardTitle className="text-2xl font-bold flex items-center gap-2 text-foreground">
          <Trophy className="h-6 w-6 text-logo-yellow" />
          Daily Flow Challenge
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* XP Progress Bar */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-sm font-medium">
            <span className="flex items-center gap-1 text-logo-yellow">
              <Sparkles className="h-4 w-4" /> XP Progress
            </span>
            <span className="font-mono text-foreground">
              {xpTowardsNextLevel} / {xpNeededForNextLevel} XP
            </span>
          </div>
          <CustomProgress 
            value={xpProgress} 
            className="h-2 bg-primary/20" 
            indicatorClassName="bg-logo-yellow" 
          />
        </div>

        {/* Energy Status */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-sm font-medium">
            <span className="flex items-center gap-1 text-primary">
              <Zap className="h-4 w-4" /> Energy Reserve
            </span>
            <span className={cn("font-mono font-bold", profile.energy < 20 ? 'text-destructive' : 'text-primary')}>
              {profile.energy} / {MAX_ENERGY}
            </span>
          </div>
          <CustomProgress 
            value={(profile.energy / MAX_ENERGY) * 100} 
            className="h-2 bg-primary/20" 
            indicatorClassName={cn(profile.energy < 20 ? 'bg-destructive' : 'bg-primary')}
          />
        </div>

        {/* Daily Challenge Tracker */}
        <div className={cn(
          "p-4 rounded-lg border-2 border-dashed transition-all duration-300",
          isChallengeComplete && !hasClaimed ? "border-accent bg-accent/10 shadow-lg shadow-accent/20 animate-pulse-glow" : "border-border bg-secondary/5"
        )}>
          <div className="flex justify-between items-center mb-2">
            <span className="flex items-center gap-2 text-base font-semibold text-accent">
              <CheckCircle className="h-5 w-5" /> Goal: Complete {dailyChallengeTarget} Tasks
            </span>
            <span className="text-lg font-extrabold font-mono text-accent">
              {profile.tasks_completed_today} / {dailyChallengeTarget}
            </span>
          </div>
          
          <CustomProgress 
            value={dailyChallengeProgress} 
            className="h-3 bg-accent/20" 
            indicatorClassName="bg-accent" 
          />

          <div className="mt-3 flex justify-between items-center">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Flame className="h-3 w-3 text-logo-orange" />
              Streak: <span className="font-bold text-foreground">{profile.daily_streak} Days</span>
            </p>
            
            {/* Claim Button or Status */}
            {hasClaimed ? (
              <span className="text-xs font-semibold text-logo-green flex items-center gap-1">
                <CheckCircle className="h-4 w-4" /> Claimed Today
              </span>
            ) : isChallengeComplete ? (
              <DailyChallengeClaimButton />
            ) : (
              <span className="text-xs text-muted-foreground">
                Reward: +{DAILY_CHALLENGE_XP} XP, +{DAILY_CHALLENGE_ENERGY} Energy
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DailyChallengeCard;