import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, CheckCircle, Clock, Zap, MessageSquare, Lightbulb, Smile, Coffee } from 'lucide-react';
import { ScheduleSummary, CompletedTaskLogEntry, DBScheduledTask } from '@/types/scheduler'; // FIX: Import DBScheduledTask
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import CompletedTaskLogItem from './CompletedTaskLogItem';
import { isMeal } from '@/lib/scheduler-utils';

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

  const compliment = useMemo(() => {
    if (tasksCompletedToday === 0 && totalActiveTimeMinutes === 0) {
      return "The day is still young! Time to make some magic happen. ✨";
    }
    if (criticalTasksCompletedToday > 0 && criticalTasksCompletedToday === scheduleSummary?.criticalTasksRemaining) {
      return "Great job prioritizing! All critical tasks for the day are complete. ✅";
    }
    if (tasksCompletedToday >= 5) {
      return `Incredible focus today! You crushed ${tasksCompletedToday} tasks and stayed in the flow. 🚀`;
    }
    if (totalActiveTimeMinutes >= 180) { // 3 hours
      return `That's a marathon session! You logged ${totalActiveTimeHours} hours of Active Time. 💪`;
    }
    if (tasksCompletedToday > 0) {
      return `Nice work today! You completed ${tasksCompletedToday} task${tasksCompletedToday !== 1 ? 's' : ''}. Keep that vibe going! 😊`;
    }
    return "You're making progress, one step at a time! Keep it up. ✨";
  }, [tasksCompletedToday, totalActiveTimeMinutes, criticalTasksCompletedToday, scheduleSummary?.criticalTasksRemaining, totalActiveTimeHours]);

  const reflectionPrompts = [
    "What was the biggest win you had today?",
    "Which task gave you the most energy, and why?",
    "What is one small thing you learned that will help your focus tomorrow?",
  ];

  return (
    <Card className="animate-pop-in animate-hover-lift">
      <CardHeader className="px-4 pb-2 pt-4">
        <CardTitle className="text-xl font-bold flex items-center gap-2 text-primary">
          <Sparkles className="h-6 w-6 text-logo-yellow" /> Daily Vibe Recap for {format(new Date(selectedDayString), 'EEEE, MMMM d')}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-6">
        <div className="text-center text-xl font-semibold text-foreground animate-pulse-text">
          "{compliment}"
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="flex flex-col items-center justify-center p-4 bg-card/50 border-primary/20 shadow-md">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-logo-green" /> Tasks Completed
            </CardTitle>
            <CardContent className="p-0 mt-2">
              <p className="text-3xl font-extrabold font-mono text-foreground">{tasksCompletedToday}</p>
            </CardContent>
          </Card>
          <Card className="flex flex-col items-center justify-center p-4 bg-card/50 border-primary/20 shadow-md">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Zap className="h-4 w-4 text-primary" /> XP Earned
            </CardTitle>
            <CardContent className="p-0 mt-2">
              <p className="text-3xl font-extrabold font-mono text-primary">+{xpEarnedToday}</p>
            </CardContent>
          </Card>
          <Card className="flex flex-col items-center justify-center p-4 bg-card/50 border-primary/20 shadow-md">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Clock className="h-4 w-4 text-foreground" /> Active Time
            </CardTitle>
            <CardContent className="p-0 mt-2">
              <p className="text-3xl font-extrabold font-mono text-foreground">
                {totalActiveTimeHours}h {totalActiveTimeMins}m
              </p>
            </CardContent>
          </Card>
          <Card className="flex flex-col items-center justify-center p-4 bg-card/50 border-primary/20 shadow-md">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Coffee className="h-4 w-4 text-logo-orange" /> Break/Meal Time
            </CardTitle>
            <CardContent className="p-0 mt-2">
              <p className="text-3xl font-extrabold font-mono text-logo-orange">{totalBreakTimeMinutes} min</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 pt-4">
          <h3 className="text-xl font-bold flex items-center gap-2 text-foreground">
            <Lightbulb className="h-5 w-5 text-logo-yellow" /> Reflect & Grow
          </h3>
          <ul className="list-disc list-inside space-y-3 text-lg text-muted-foreground">
            {reflectionPrompts.map((prompt, index) => (
              <li key={index} className="flex items-start">
                <Smile className="h-5 w-5 mr-2 mt-1 shrink-0 text-primary" />
                <span>{prompt}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* NEW: Collapsible Completed Task Log */}
        {completedScheduledTasks.length > 0 && (
          <Accordion type="single" collapsible className="w-full pt-4">
            <AccordionItem value="completed-tasks-log" className="border-b-0">
              <AccordionTrigger className="text-lg font-semibold flex items-center gap-2 text-primary hover:no-underline">
                <CheckCircle className="h-6 w-6 text-logo-green" /> View {completedScheduledTasks.length} Completed Task{completedScheduledTasks.length !== 1 ? 's' : ''}
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-3">
                {completedScheduledTasks.map(task => (
                  // Note: CompletedTaskLogEntry is structurally compatible with DBScheduledTask for this component
                  <CompletedTaskLogItem key={task.id} task={task as unknown as DBScheduledTask} />
                ))}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
};

export default DailyVibeRecapCard;