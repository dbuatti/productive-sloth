import React, { useState, useEffect } from 'react';
import { useSession } from '@/hooks/use-session';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, CheckCircle2, Loader2 } from 'lucide-react';
import { formatDistanceToNowStrict, isToday, isPast, parseISO } from 'date-fns';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress'; // Use standard Progress

const DAILY_CHALLENGE_XP = 50;
const DAILY_CHALLENGE_ENERGY = 20;
const DAILY_CHALLENGE_TASKS_REQUIRED = 3;

const DailyChallengeCard: React.FC = () => {
  const { profile, claimDailyReward } = useSession();
  const [canClaim, setCanClaim] = useState(false);
  const [timeUntilNextClaim, setTimeUntilNextClaim] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);

  useEffect(() => {
    if (!profile) return;

    const lastClaimDate = profile.last_daily_reward_claim ? parseISO(profile.last_daily_reward_claim) : null;
    const hasClaimedToday = lastClaimDate && isToday(lastClaimDate);
    const hasCompletedTasks = profile.tasks_completed_today >= DAILY_CHALLENGE_TASKS_REQUIRED;

    if (!hasClaimedToday && hasCompletedTasks) {
      setCanClaim(true);
      setTimeUntilNextClaim(null);
    } else if (hasClaimedToday) {
      setCanClaim(false);
      // Calculate time until next day (midnight)
      const now = new Date();
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      
      const updateTimer = () => {
        const remaining = tomorrow.getTime() - new Date().getTime();
        if (remaining <= 0) {
          setCanClaim(true);
          setTimeUntilNextClaim(null);
          return;
        }
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
        setTimeUntilNextClaim(`${hours}h ${minutes}m ${seconds}s`);
      };

      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    } else {
      setCanClaim(false);
      setTimeUntilNextClaim(null); // No timer if not claimed and tasks not completed
    }
  }, [profile]);

  if (!profile) {
    return null;
  }

  const handleClaim = async () => {
    if (canClaim) {
      setIsClaiming(true);
      await claimDailyReward(DAILY_CHALLENGE_XP, DAILY_CHALLENGE_ENERGY);
      setIsClaiming(false);
      setCanClaim(false); // Optimistically set to false after claiming
    }
  };

  const progressPercentage = (profile.tasks_completed_today / DAILY_CHALLENGE_TASKS_REQUIRED) * 100;
  const isChallengeComplete = profile.tasks_completed_today >= DAILY_CHALLENGE_TASKS_REQUIRED;
  const hasClaimedToday = profile.last_daily_reward_claim ? isToday(parseISO(profile.last_daily_reward_claim)) : false;

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Trophy className="h-4 w-4 text-muted-foreground" />
          Daily Challenge
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 p-4 border rounded-md">
        <div className="text-3xl font-bold text-primary mb-2 leading-none">
          {hasClaimedToday ? 'Claimed!' : (isChallengeComplete ? 'Ready!' : 'In Progress')}
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Complete <span className="font-semibold text-foreground">{DAILY_CHALLENGE_TASKS_REQUIRED} tasks</span> to earn <span className="font-semibold text-foreground">+{DAILY_CHALLENGE_XP} XP</span> and <span className="font-semibold text-foreground">+{DAILY_CHALLENGE_ENERGY} Energy</span>!
        </p>
        
        <div className="mb-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Progress value={progressPercentage} className="h-2" />
            </TooltipTrigger>
            <TooltipContent>
              <p>{profile.tasks_completed_today} / {DAILY_CHALLENGE_TASKS_REQUIRED} tasks completed</p>
            </TooltipContent>
          </Tooltip>
          <p className="text-xs text-muted-foreground mt-2">
            {profile.tasks_completed_today} / {DAILY_CHALLENGE_TASKS_REQUIRED} tasks completed today.
          </p>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              onClick={handleClaim} 
              disabled={!canClaim || isClaiming} 
              className="w-full flex items-center gap-2 h-9 text-sm font-semibold"
            >
              {isClaiming ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Claiming...
                </>
              ) : hasClaimedToday ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Claimed {timeUntilNextClaim && `(Next in ${timeUntilNextClaim})`}
                </>
              ) : (
                <>
                  <Trophy className="h-4 w-4" />
                  Claim Challenge Reward
                </>
              )}
            </Button>
          </TooltipTrigger>
          {!canClaim && !hasClaimedToday && !isChallengeComplete && (
            <TooltipContent>
              <p>Complete {DAILY_CHALLENGE_TASKS_REQUIRED - profile.tasks_completed_today} more tasks to claim!</p>
            </TooltipContent>
          )}
          {!canClaim && hasClaimedToday && timeUntilNextClaim && (
            <TooltipContent>
              <p>Next daily challenge available in {timeUntilNextClaim}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </CardContent>
    </Card>
  );
};

export default DailyChallengeCard;