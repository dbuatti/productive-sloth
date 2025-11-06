import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Sparkles, CheckCircle } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { useTasks } from '@/hooks/use-tasks';
import { isToday, parseISO } from 'date-fns';

// XP and Leveling Constants
const XP_PER_LEVEL = 100; // XP needed to gain one level

const calculateLevelInfo = (totalXp: number) => {
  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
  const xpForCurrentLevel = (level - 1) * XP_PER_LEVEL;
  const xpTowardsNextLevel = totalXp - xpForCurrentLevel;
  const xpNeededForNextLevel = XP_PER_LEVEL; // XP needed for the *next* level is always XP_PER_LEVEL
  return { level, xpTowardsNextLevel, xpNeededForNextLevel };
};

const ProgressOverviewCard: React.FC = () => {
  const { profile } = useSession();
  const { allTasks } = useTasks();

  const { completedTasksToday, xpGainedToday } = useMemo(() => {
    const tasksCompletedToday = allTasks.filter(task => 
      task.is_completed && isToday(parseISO(task.created_at))
    );
    const totalXp = tasksCompletedToday.reduce((sum, task) => sum + task.metadata_xp, 0);
    return {
      completedTasksToday: tasksCompletedToday.length,
      xpGainedToday: totalXp,
    };
  }, [allTasks]);

  if (!profile) {
    return null; // Don't render if no profile data
  }

  const { level, xpTowardsNextLevel, xpNeededForNextLevel } = calculateLevelInfo(profile.xp);

  return (
    <Card className="w-full transition-all duration-200 ease-in-out hover:scale-[1.005]">
      <CardHeader className="flex flex-col sm:flex-row items-center sm:justify-between space-y-2 sm:space-y-0 pb-2">
        <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
          <Trophy className="h-5 w-5 text-[hsl(var(--logo-yellow))]" />
          Your Progress
        </CardTitle>
        <div className="text-6xl font-extrabold font-mono flex items-center gap-2 text-primary">
          <Sparkles className="h-8 w-8 animate-pulse" />
          Level {level}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* XP Summary Section */}
          <div className="p-5 rounded-md bg-background border border-dashed border-border/50 flex flex-col justify-center items-center text-center">
            <p className="text-base text-foreground mb-1">Total XP</p>
            <p className="text-5xl font-extrabold font-mono text-primary mb-2 leading-none">{profile.xp}</p>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground font-mono">{xpNeededForNextLevel - xpTowardsNextLevel}</span> XP to next level!
            </p>
          </div>

          {/* Today's Summary Section */}
          <div className="border-t border-dashed border-border/50 sm:border-t-0 sm:border-l p-5 rounded-md bg-background border border-dashed border-border/50 flex flex-col justify-center items-center text-center">
            <div className="text-lg font-bold flex items-center gap-2 mb-2 text-foreground">
              <CheckCircle className="h-5 w-5 text-foreground" /> {/* Changed icon color to foreground */}
              Today's Summary
            </div>
            <p className="text-5xl font-extrabold font-mono text-primary mb-2 leading-none">
              {profile.tasks_completed_today} Tasks
            </p>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-4 w-4 text-[hsl(var(--logo-yellow))]" />
              Earned <span className="font-bold text-foreground font-mono">+{xpGainedToday} XP</span> today!
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProgressOverviewCard;