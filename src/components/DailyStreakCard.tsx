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
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Flame className="h-4 w-4 text-muted-foreground" />
          Daily Streak
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center pt-0 p-4 border rounded-md">
        <div className="text-5xl font-extrabold text-primary leading-none">
          {profile.daily_streak}
        </div>
        <p className="text-base font-semibold text-muted-foreground mt-1">
          Day{profile.daily_streak !== 1 ? 's' : ''}
        </p>
        <Tooltip>
          <TooltipTrigger asChild>
            <p className="text-xs text-muted-foreground mt-2 cursor-help">
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