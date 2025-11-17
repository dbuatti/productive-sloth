import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Sparkles, CheckCircle } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { useTasks } from '@/hooks/use-tasks';
import { isToday, parseISO } from 'date-fns';
import { cn, calculateLevelInfo } from '@/lib/utils';

const ProgressOverviewCard: React.FC = () => {
  const { profile } = useSession();
  const { allTasks } = useTasks();

  const { completedTasksToday } = useMemo(() => {
    const tasksCompletedToday = allTasks.filter(task => 
      task.is_completed && isToday(parseISO(task.created_at))
    );
    return {
      completedTasksToday: tasksCompletedToday.length,
    };
  }, [allTasks]);

  if (!profile) {
    return null;
  }

  const { level, xpTowardsNextLevel, xpNeededForNextLevel } = calculateLevelInfo(profile.xp);

  return (
    <Card className="relative w-full transition-all duration-200 ease-in-out hover:scale-[1.005] animate-pop-in animate-hover-lift">
      <div className={cn(
        "absolute top-4 right-4 z-10",
        "bg-background px-3 py-1 rounded-md",
        "text-base font-extrabold font-mono flex items-center gap-1 text-primary" /* Changed text-lg to text-base */
      )}>
        <Sparkles className="h-5 w-5 animate-bounce" />
        Lvl {level}
      </div>

      <CardHeader className="flex flex-col sm:flex-row items-center sm:justify-between space-y-2 sm:space-y-0 pt-8 pb-2 pr-24">
        <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground"> {/* Changed text-xl to text-lg */}
          <Trophy className="h-6 w-6 text-logo-yellow" />
          Your Progress
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="p-5 rounded-md bg-card border border-dashed border-border/50 flex flex-col justify-center items-center text-center">
            <p className="text-base text-foreground mb-1">Total XP</p>
            <p className="text-5xl font-extrabold font-mono text-primary mb-2 leading-none animate-pop-in">{profile.xp}</p> {/* Changed text-6xl to text-5xl */}
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground font-mono">{xpNeededForNextLevel - xpTowardsNextLevel}</span> XP to next level!
            </p>
          </div>

          <div className="border-t border-dashed border-border/50 sm:border-t-0 sm:border-l p-5 rounded-md bg-card border border-dashed border-border/50 flex flex-col justify-center items-center text-center">
            <div className="text-lg font-bold flex items-center gap-2 text-foreground"> {/* Changed text-xl to text-lg */}
              <CheckCircle className="h-6 w-6 text-primary" />
              Today's Summary
            </div>
            <p className="text-5xl font-extrabold font-mono text-primary mb-2 leading-none animate-pop-in"> {/* Changed text-6xl to text-5xl */}
              {profile.tasks_completed_today} Tasks
            </p>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-4 w-4 text-logo-yellow" />
              Earned <span className="font-bold text-foreground font-mono">+{profile.xp - (profile.xp - (profile.tasks_completed_today * 10))} XP</span> today!
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProgressOverviewCard;