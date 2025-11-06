import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Sparkles, CheckCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSession } from '@/hooks/use-session';
import { useTasks } from '@/hooks/use-tasks';
import { isToday, parseISO } from 'date-fns';
import { Progress } from '@/components/ui/progress'; // Use standard Progress

// XP and Leveling Constants
const XP_PER_LEVEL = 100; // XP needed to gain one level

const calculateLevelInfo = (totalXp: number) => {
  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
  const xpForCurrentLevel = (level - 1) * XP_PER_LEVEL;
  const xpTowardsNextLevel = totalXp - xpForCurrentLevel;
  const xpNeededForNextLevel = XP_PER_LEVEL;
  const progressPercentage = (xpTowardsNextLevel / xpNeededForNextLevel) * 100;
  return { level, xpTowardsNextLevel, xpNeededForNextLevel, progressPercentage };
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

  const { level, xpTowardsNextLevel, xpNeededForNextLevel, progressPercentage } = calculateLevelInfo(profile.xp);

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Trophy className="h-4 w-4 text-muted-foreground" />
          Your Progress
        </CardTitle>
        <div className="text-2xl font-bold flex items-center gap-1 text-primary">
          <Sparkles className="h-5 w-5" />
          Level {level}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* XP Progress Section */}
          <div className="p-4 border rounded-md">
            <div className="text-lg font-semibold mb-2">
              {xpTowardsNextLevel} / {xpNeededForNextLevel} XP
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Progress value={progressPercentage} className="h-2" />
              </TooltipTrigger>
              <TooltipContent>
                <p>{xpTowardsNextLevel} XP towards Level {level + 1}</p>
              </TooltipContent>
            </Tooltip>
            <p className="text-xs text-muted-foreground mt-2">
              {xpNeededForNextLevel - xpTowardsNextLevel} XP to next level!
            </p>
          </div>

          {/* Today's Summary Section */}
          <div className="p-4 border rounded-md">
            <div className="text-lg font-semibold flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-primary" />
              Today's Summary
            </div>
            <p className="text-3xl font-bold text-primary mb-1">
              {completedTasksToday} Tasks
            </p>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-muted-foreground" />
              Earned <span className="font-semibold text-foreground">+{xpGainedToday} XP</span> today!
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProgressOverviewCard;