import React, { useState, useEffect } from 'react';
import { useSession } from '@/hooks/use-session';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Gift, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNowStrict, isToday, isPast, parseISO } from 'date-fns';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const DAILY_REWARD_XP = 25;
const DAILY_REWARD_ENERGY = 10;

const DailyRewardCard: React.FC = () => {
  const { profile, claimDailyReward } = useSession();
  const [canClaim, setCanClaim] = useState(false);
  const [timeUntilNextClaim, setTimeUntilNextClaim] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.last_daily_reward_claim) {
      const lastClaimDate = parseISO(profile.last_daily_reward_claim);
      if (!isToday(lastClaimDate)) {
        setCanClaim(true);
        setTimeUntilNextClaim(null);
      } else {
        setCanClaim(false);
        // Calculate time until next day (midnight)
        const now = new Date();
        const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const diff = tomorrow.getTime() - now.getTime();
        
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
      }
    } else {
      setCanClaim(true); // No previous claim, so can claim
      setTimeUntilNextClaim(null);
    }
  }, [profile?.last_daily_reward_claim]);

  if (!profile) {
    return null;
  }

  const handleClaim = () => {
    if (canClaim) {
      claimDailyReward(DAILY_REWARD_XP, DAILY_REWARD_ENERGY);
      setCanClaim(false); // Optimistically set to false
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Gift className="h-4 w-4 text-purple-500" />
          Daily Reward
        </CardTitle>
        <div className="text-3xl font-bold text-purple-500">
          {canClaim ? 'Ready!' : 'Claimed'}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-2">
          Claim <span className="font-semibold text-foreground">+{DAILY_REWARD_XP} XP</span> and <span className="font-semibold text-foreground">+{DAILY_REWARD_ENERGY} Energy</span> once per day!
        </p>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              onClick={handleClaim} 
              disabled={!canClaim} 
              className="w-full flex items-center gap-2"
            >
              {canClaim ? (
                <>
                  <Gift className="h-4 w-4" />
                  Claim Reward
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Claimed {timeUntilNextClaim && `(Next in ${timeUntilNextClaim})`}
                </>
              )}
            </Button>
          </TooltipTrigger>
          {!canClaim && timeUntilNextClaim && (
            <TooltipContent>
              <p>Next daily reward available in {timeUntilNextClaim}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </CardContent>
    </Card>
  );
};

export default DailyRewardCard;