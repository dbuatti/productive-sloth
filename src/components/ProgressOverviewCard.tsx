import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Sparkles, CheckCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSession }
from '@/hooks/use-session';
import { useTasks } from '@/hooks/use-tasks';
import { isToday, parseISO } from 'date-fns';
import { CustomProgress } from './CustomProgress'; // Import CustomProgress

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
    <Card className="w-full transition-all duration-200 ease-in-out hover:scale-[1.005]">
      <CardHeader className="flex flex-col sm:flex-row items-center sm:justify-between space-y-2 sm:space-y-0 pb-2">
        <CardTitle className="text-lg font-bold flex items-center gap-2 text-[hsl(var(--logo-yellow))]">
          <Trophy className="h-5 w-5" />
          Your Progress
        </CardTitle>
        <div className="text-6xl font-extrabold font-mono flex items-center gap-2 text-primary"> {/* Increased size, added font-mono */}
          <Sparkles className="h-8 w-8 animate-pulse" />
          Level {level}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* XP Progress Section */}
          <div className="p-5 rounded-md bg-background border border-dashed border-border/50"> {/* Increased padding, added dashed border */}
            <div className="text-base text-muted-foreground mb-2">
              <span className="font-bold text-foreground text-xl font-mono">{xpTowardsNextLevel}</span> / <span className="font-mono">{xpNeededForNextLevel}</span> XP {/* Added font-mono */}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <CustomProgress 
                  value={progressPercentage} 
                  className="h-3 bg-primary/20" 
                  indicatorClassName="bg-primary" 
                />
              </TooltipTrigger>
              <TooltipContent>
                <p>{xpTowardsNextLevel} XP towards Level {level + 1}</p>
              </TooltipContent>
            </Tooltip>
            <p className="text-sm text-muted-foreground mt-2">
              <span className="font-semibold text-foreground font-mono">{xpNeededForNextLevel - xpTowardsNextLevel}</span> XP to next level! {/* Added font-mono */}
            </p>
          </div>

          {/* Today's Summary Section */}
          <div className="border-t sm:border-t-0 sm:border-l border-border pt-6 sm:pt-4 sm:pl-6 p-5 rounded-md bg-background border border-dashed border-border/50"> {/* Increased padding, added dashed border */}
            <div className="text-lg font-bold flex items-center gap-2 mb-2 text-primary">
              <CheckCircle className="h-5 w-5" />
              Today's Summary
            </div>
            <p className="text-5xl font-extrabold font-mono text-primary mb-2"> {/* Increased size, added font-mono */}
              {completedTasksToday} Tasks
            </p>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-4 w-4 text-[hsl(var(--logo-yellow))]" />
              Earned <span className="font-bold text-foreground font-mono">+{xpGainedToday} XP</span> today! {/* Added font-mono */}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProgressOverviewCard;