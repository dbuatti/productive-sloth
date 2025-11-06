import React from 'react';
import { useSession } from '@/hooks/use-session';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Trophy, Sparkles } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// XP and Leveling Constants (should ideally be shared or fetched from backend)
const XP_PER_LEVEL = 100; // XP needed to gain one level

const calculateLevelInfo = (totalXp: number) => {
  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
  const xpForCurrentLevel = (level - 1) * XP_PER_LEVEL;
  const xpTowardsNextLevel = totalXp - xpForCurrentLevel;
  const xpNeededForNextLevel = XP_PER_LEVEL;
  const progressPercentage = (xpTowardsNextLevel / xpNeededForNextLevel) * 100;
  return { level, xpTowardsNextLevel, xpNeededForNextLevel, progressPercentage };
};

const UserXPCard: React.FC = () => {
  const { profile } = useSession();

  if (!profile) {
    return null; // Don't render if no profile data
  }

  const { level, xpTowardsNextLevel, xpNeededForNextLevel, progressPercentage } = calculateLevelInfo(profile.xp);

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Trophy className="h-4 w-4 text-yellow-500" />
          Your Progress
        </CardTitle>
        <div className="text-3xl font-bold flex items-center gap-1 text-primary">
          <Sparkles className="h-6 w-6" />
          Level {level}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground mb-2">
          <span className="font-semibold text-foreground">{xpTowardsNextLevel}</span> / {xpNeededForNextLevel} XP
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Progress value={progressPercentage} className="h-2" />
          </TooltipTrigger>
          <TooltipContent>
            <p>{xpTowardsNextLevel} XP towards Level {level + 1}</p>
          </TooltipContent>
        </Tooltip>
        <p className="text-xs text-muted-foreground mt-1">
          <span className="font-semibold text-foreground">{xpNeededForNextLevel - xpTowardsNextLevel}</span> XP to next level!
        </p>
      </CardContent>
    </Card>
  );
};

export default UserXPCard;