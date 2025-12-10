import React, { useMemo } from 'react';
import { Sparkles, CheckCircle, Clock, Zap, MessageSquare, Lightbulb, Smile, Coffee } from 'lucide-react';
import { ScheduleSummary, CompletedTaskLogEntry, DBScheduledTask } from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import CompletedTaskLogItem from '@/components/CompletedTaskLogItem';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DailyVibeRecapCardProps {
  scheduleSummary: ScheduleSummary | null;
  tasksCompletedToday: number;
  xpEarnedToday: number;
  profileEnergy: number;
  criticalTasksCompletedToday: number;
  selectedDayString: string;
  completedScheduledTasks: CompletedTaskLogEntry[];
  totalActiveTimeMinutes: number;
  totalBreakTimeMinutes: number;
}

const DailyVibeRecapCard: React.FC<DailyVibeRecapCardProps> = ({
  scheduleSummary,
  tasksCompletedToday,
  xpEarnedToday,
  profileEnergy,
  criticalTasksCompletedToday,
  selectedDayString,
  completedScheduledTasks,
  totalActiveTimeMinutes,
  totalBreakTimeMinutes,
}) => {
  const totalActiveTimeHours = Math.floor(totalActiveTimeMinutes / 60);
  const totalActiveTimeMins = totalActiveTimeMinutes % 60;

  const getDailyVibeMessage = useMemo(() => {
    if (tasksCompletedToday === 0) {
      return "Every day is a new beginning. Start with one small task today! ✨";
    }

    if (criticalTasksCompletedToday > 0 && criticalTasksCompletedToday === (scheduleSummary?.criticalTasksRemaining || 0)) {
      return "Great job prioritizing! All critical tasks for the day are complete. ✅";
    }

    if (tasksCompletedToday >= 5) {
      return "You're on fire today! Keep up the amazing work. 🔥";
    }

    return "You're making progress, one step at a time! Keep it up. ✨";
  }, [tasksCompletedToday, totalActiveTimeMinutes, criticalTasksCompletedToday, scheduleSummary?.criticalTasksRemaining, totalActiveTimeHours]);

  return (
    <div className="space-y-6">
      <Card className="p-6 animate-pop-in bg-primary-wash rounded-lg animate-hover-lift shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <Sparkles className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">Daily Vibe Recap</h2>
        </div>
        <p className="text-muted-foreground mb-6">
          {format(parseISO(selectedDayString), 'EEEE, MMMM d')}
        </p>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{tasksCompletedToday}</div>
            <div className="text-sm text-muted-foreground">Tasks Done</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-logo-green">{xpEarnedToday}</div>
            <div className="text-sm text-muted-foreground">XP Earned</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-logo-yellow">
              {totalActiveTimeHours}h {totalActiveTimeMins}m
            </div>
            <div className="text-sm text-muted-foreground">Active Time</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-destructive">{criticalTasksCompletedToday}</div>
            <div className="text-sm text-muted-foreground">Critical Done</div>
          </Card>
        </div>
        
        <Card className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <div className="flex items-start gap-3">
            <Smile className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-900 mb-1">Your Daily Vibe</h3>
              <p className="text-blue-700">{getDailyVibeMessage}</p>
            </div>
          </div>
        </Card>
      </Card>

      {completedScheduledTasks.length > 0 && (
        <Card className="animate-pop-in animate-hover-lift">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <CheckCircle className="h-5 w-5 text-logo-green" />
              Completed Tasks
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3">
              {completedScheduledTasks.map((task) => (
                <CompletedTaskLogItem 
                  key={task.id} 
                  task={task as unknown as DBScheduledTask} 
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DailyVibeRecapCard;