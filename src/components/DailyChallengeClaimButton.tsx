import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Trophy, Loader2 } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { isToday, parseISO } from 'date-fns';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DAILY_CHALLENGE_XP, DAILY_CHALLENGE_ENERGY } from '@/lib/constants'; // Import constants

const DailyChallengeClaimButton: React.FC = () => {
  const { profile, claimDailyReward } = useSession();
  const [canClaim, setCanClaim] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  useEffect(() => {
    if (!profile) {
      setCanClaim(false);
      return;
    }

    const dailyChallengeTarget = profile.daily_challenge_target || 3; // Fallback to 3 if target is somehow missing
    
    const lastClaimDate = profile.last_daily_reward_claim ? parseISO(profile.last_daily_reward_claim) : null;
    const hasClaimedToday = lastClaimDate && isToday(lastClaimDate);
    const hasCompletedTasks = profile.tasks_completed_today >= dailyChallengeTarget;

    setCanClaim(!hasClaimedToday && hasCompletedTasks);
  }, [profile]);

  const handleClaim = async () => {
    if (canClaim) {
      setIsClaiming(true);
      await claimDailyReward(DAILY_CHALLENGE_XP, DAILY_CHALLENGE_ENERGY);
      setIsClaiming(false);
      setCanClaim(false); // Optimistically set to false after claiming
    }
  };

  if (!profile || !canClaim) {
    return null; // Don't render if not logged in or challenge not ready/claimed
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          onClick={handleClaim}
          disabled={isClaiming}
          className="flex items-center gap-1 h-8 px-3 text-sm font-semibold bg-accent text-accent-foreground hover:bg-accent/90"
        >
          {isClaiming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trophy className="h-4 w-4" />
          )}
          <span>Claim Daily!</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Claim your daily challenge reward: +{DAILY_CHALLENGE_XP} XP, +{DAILY_CHALLENGE_ENERGY} Energy!</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default DailyChallengeClaimButton;