import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Sparkles } from 'lucide-react';
import { useTasks } from '@/hooks/use-tasks';
import { isToday, parseISO } from 'date-fns';

const DailySummaryCard: React.FC = () => {
  const { allTasks } = useTasks();

  const { completedTasksToday, xpGainedToday } = useMemo(() => {
    const today = new Date();
    const tasksCompletedToday = allTasks.filter(task => 
      task.is_completed && isToday(parseISO(task.created_at)) // Assuming created_at is when task was completed for simplicity
    );

    const totalXp = tasksCompletedToday.reduce((sum, task) => sum + task.metadata_xp, 0);

    return {
      completedTasksToday: tasksCompletedToday.length,
      xpGainedToday: totalXp,
    };
  }, [allTasks]);

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-blue-500" />
          Today's Progress
        </CardTitle>
        <div className="text-3xl font-bold text-blue-500">
          {completedTasksToday} Tasks
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-yellow-500" />
          You've earned <span className="font-semibold text-foreground">+{xpGainedToday} XP</span> today!
        </p>
      </CardContent>
    </Card>
  );
};

export default DailySummaryCard;