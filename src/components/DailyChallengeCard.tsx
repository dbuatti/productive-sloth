import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, CheckCircle, Loader2, Zap, Sparkles } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { isToday, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { CustomProgress } from './CustomProgress';
import DailyChallengeClaimButton from './DailyChallengeClaimButton';
import { DAILY_CHALLENGE_XP, DAILY_CHALLENGE_ENERGY } from '@/lib/constants';

const DailyChallengeCard: React.FC = () => {
  const { profile, isLoading } = useSession();

  const challengeStatus = useMemo(() => {
    if (!profile) return {
      isComplete: false,
      hasClaimed: false,
      progress: 0,
      tasksCompleted: 0,
      target: 0,
    };

    const target = profile.daily_challenge_target;
    const tasksCompleted = profile.tasks_completed_today;
    const isComplete = tasksCompleted >= target;
    const progress = Math.min(100, (tasksCompleted / target) * 100);
    
    const lastClaimDate = profile.last_daily_reward_claim ? parseISO(profile.last_daily_reward_claim) : null;
    const hasClaimed = lastClaimDate && isToday(lastClaimDate);

    return {
      isComplete,
      hasClaimed,
      progress,
      tasksCompleted,
      target,
    };
  }, [profile]);

  if (isLoading || !profile) {
    return (
      <div className="p-6 flex items-center justify-center h-32 rounded-xl shadow-sm bg-card"> {/* Replaced Card with div */}
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const { isComplete, hasClaimed, progress, tasksCompleted, target } = challengeStatus;

  const cardClasses = cn(
    "transition-all duration-300 ease-in-out border-none rounded-xl shadow-sm animate-hover-lift", // Removed border-2, adjusted styling
    hasClaimed ? "bg-logo-green/5" : 
    isComplete ? "bg-accent/10 hover:shadow-lg hover:shadow-accent/20" : 
    "bg-card hover:border-primary/50" // Removed border-border
  );

  return (
    <div className={cardClasses}> {/* Replaced Card with div */}
      <div className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4"> {/* Replaced CardHeader with div, adjusted padding */}
        <h2 className="text-lg font-bold flex items-center gap-2"> {/* Replaced CardTitle with h2 */}
          <Trophy className={cn("h-6 w-6", isComplete ? "text-accent" : "text-muted-foreground")} />
          Daily Challenge
        </h2>
        <div className="text-sm font-medium text-muted-foreground">
          Reward: +{DAILY_CHALLENGE_XP} XP, +{DAILY_CHALLENGE_ENERGY} Energy
        </div>
      </div>
      <div className="space-y-4 px-4 pb-4"> {/* Replaced CardContent with div, adjusted padding */}
        <div className="flex items-center justify-between">
          <p className="text-xl font-extrabold font-mono text-foreground"> {/* Changed text-2xl to text-xl */}
            {tasksCompleted} / {target} Tasks
          </p>
          {hasClaimed ? (
            <div className="flex items-center gap-2 text-logo-green font-semibold">
              <CheckCircle className="h-5 w-5" /> Claimed!
            </div>
          ) : isComplete ? (
            <DailyChallengeClaimButton />
          ) : (
            <div className="text-muted-foreground text-sm">
              Keep going!
            </div>
          )}
        </div>
        
        <CustomProgress 
          value={progress} 
          className="h-3 bg-accent/20"
          indicatorClassName={cn(
            "transition-all duration-500",
            isComplete ? "bg-accent" : "bg-primary"
          )}
        />
        
        {isComplete && !hasClaimed && (
          <p className="text-sm text-accent font-semibold flex items-center gap-1 animate-pulse-glow">
            <Sparkles className="h-4 w-4" /> Ready to claim your reward!
          </p>
        )}
      </div>
    </div>
  );
};

export default DailyChallengeCard;