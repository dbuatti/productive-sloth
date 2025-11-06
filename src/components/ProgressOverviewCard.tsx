import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Sparkles, CheckCircle } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { useTasks } from '@/hooks/use-tasks';
import { isToday, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

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
    <Card className="relative w-full transition-all duration-200 ease-in-out hover:scale-[1.005]"> {/* Removed pt-16 from here */}
      {/* Level text positioned absolutely */}
      <div className={cn(
        "absolute top-4 right-4 z-10", // Position at top-right, z-index to be above card, top-4 to be just inside
        "bg-background px-3 py-1 rounded-md", // Background to create the 'cut out' effect, smaller padding, rounded
        "text-base font-extrabold font-mono flex items-center gap-1 text-primary" // Smaller font size
      )}>
        <Sparkles className="h-4 w-4 animate-pulse" /> {/* Icon size matching text */}
        Lvl {level}
      </div>

      <CardHeader className="flex flex-col sm:flex-row items-center sm:justify-between space-y-2 sm:space-y-0 pt-8 pb-2 pr-24"> {/* Added pt-8 here to push content down */}
        <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
          <Trophy className="h-5 w-5 text-[hsl(var(--logo-yellow))]" />
          Your Progress
        </CardTitle>
        {/* Removed Level display from here */}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* XP Summary Section */}
          <div className="p-5 rounded-md bg-card border border-dashed border-border/50 flex flex-col justify-center items-center text-center">
            <p className="text-base text-foreground mb-1">Total XP</p>
            <p className="text-5xl font-extrabold font-mono text-primary mb-2 leading-none">{profile.xp}</p>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground font-mono">{xpNeededForNextLevel - xpTowardsNextLevel}</span> XP to next level!
            </p>
          </div>

          {/* Today's Summary Section */}
          <div className="border-t border-dashed border-border/50 sm:border-t-0 sm:border-l p-5 rounded-md bg-card border border-dashed border-border/50 flex flex-col justify-center items-center text-center">
            <div className="text-lg font-bold flex items-center gap-2 mb-2 text-foreground">
              <CheckCircle className="h-5 w-5 text-foreground" />
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