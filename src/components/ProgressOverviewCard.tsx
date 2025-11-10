import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Sparkles, CheckCircle } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { useTasks } from '@/hooks/use-tasks';
import { isToday, parseISO } from 'date-fns';
import { cn, calculateLevelInfo } from '@/lib/utils'; // Import calculateLevelInfo

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
    <Card className="relative w-full transition-all duration-200 ease-in-out hover:scale-[1.005] animate-pop-in animate-hover-lift"> {/* Added animate-hover-lift */}
      {/* Level text positioned absolutely */}
      <div className={cn(
        "absolute top-4 right-4 z-10", // Position at top-right, z-index to be above card, top-4 to be just inside
        "bg-background px-3 py-1 rounded-md", // Background to create the 'cut out' effect, smaller padding, rounded
        "text-lg font-extrabold font-mono flex items-center gap-1 text-primary" /* Removed animate-pulse-glow */
      )}>
        <Sparkles className="h-5 w-5 animate-bounce" /> {/* Icon size matching text, added animate-bounce */}
        Lvl {level}
      </div>

      <CardHeader className="flex flex-col sm:flex-row items-center sm:justify-between space-y-2 sm:space-y-0 pt-8 pb-2 pr-24">
        <CardTitle className="text-xl font-bold flex items-center gap-2 text-foreground"> {/* Larger font */}
          <Trophy className="h-6 w-6 text-logo-yellow" /> {/* Larger icon */}
          Your Progress
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* XP Summary Section */}
          <div className="p-5 rounded-md bg-card border border-dashed border-border/50 flex flex-col justify-center items-center text-center">
            <p className="text-base text-foreground mb-1">Total XP</p>
            <p className="text-6xl font-extrabold font-mono text-primary mb-2 leading-none animate-pop-in">{profile.xp}</p> {/* Larger font, added animate-pop-in */}
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground font-mono">{xpNeededForNextLevel - xpTowardsNextLevel}</span> XP to next level!
            </p>
          </div>

          {/* Today's Summary Section */}
          <div className="border-t border-dashed border-border/50 sm:border-t-0 sm:border-l p-5 rounded-md bg-card border border-dashed border-border/50 flex flex-col justify-center items-center text-center">
            <div className="text-xl font-bold flex items-center gap-2 text-foreground"> {/* Larger font */}
              <CheckCircle className="h-6 w-6 text-primary" /> {/* Larger icon, changed to primary */}
              Today's Summary
            </div>
            <p className="text-6xl font-extrabold font-mono text-primary mb-2 leading-none animate-pop-in"> {/* Larger font, added animate-pop-in */}
              {profile.tasks_completed_today} Tasks
            </p>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-4 w-4 text-logo-yellow" />
              Earned <span className="font-bold text-foreground font-mono">+{xpGainedToday} XP</span> today!
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProgressOverviewCard;