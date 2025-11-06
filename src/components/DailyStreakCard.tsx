import React from 'react';
import { useSession } from '@/hooks/use-session';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Flame } from 'lucide-react';

const DailyStreakCard: React.FC = () => {
  const { profile } = useSession();

  if (!profile) {
    return null; // Don't render if no profile data
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-500" />
          Daily Streak
        </CardTitle>
        <div className="text-3xl font-bold text-orange-500"> {/* Larger text, orange color */}
          {profile.daily_streak} Day{profile.daily_streak !== 1 ? 's' : ''}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          Keep completing tasks to extend your streak!
        </p>
      </CardContent>
    </Card>
  );
};

export default DailyStreakCard;