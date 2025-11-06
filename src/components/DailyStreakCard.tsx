import React from 'react';
import { useSession } from '@/hooks/use-session';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Flame } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const DailyStreakCard: React.FC = () => {
  const { profile } = useSession();

  if (!profile) {
    return null; // Don't render if no profile data
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-bold flex items-center gap-2 text-[hsl(var(--logo-orange))]"> {/* Using logo-orange */}
          <Flame className="h-5 w-5" />
          Daily Streak
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center pt-0">
        <div className="text-6xl font-extrabold text-[hsl(var(--logo-orange))] leading-none"> {/* Using logo-orange */}
          {profile.daily_streak}
        </div>
        <p className="text-lg font-semibold text-muted-foreground mt-1">
          Day{profile.daily_streak !== 1 ? 's' : ''}
        </p>
        <Tooltip>
          <TooltipTrigger asChild>
            <p className="text-xs text-muted-foreground mt-3 cursor-help">
              Keep completing tasks to extend your streak!
            </p>
          </TooltipTrigger>
          <TooltipContent>
            <p>Your current daily task completion streak.</p>
          </TooltipContent>
        </Tooltip>
      </CardContent>
    </Card>
  );
};

export default DailyStreakCard;