"use client";

import React, { useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSession } from '@/hooks/use-session';
import { useWeeklySchedulerTasks } from '@/hooks/use-weekly-scheduler-tasks';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import { useRetiredTasks } from '@/hooks/use-retired-tasks';
import { format, parseISO, startOfDay, addDays, subDays, differenceInMinutes, isAfter, isBefore, isSameDay, getDay, getHours } from 'date-fns';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area, ReferenceLine, LabelList 
} from 'recharts';
import { AlertTriangle, Coffee, CalendarOff, TrendingUp, Activity, Zap, Moon, Sun, AlertCircle, ListTodo, Briefcase, CalendarDays, Flame, Clock, Home, Laptop, Globe, Music, Target, SkipForward } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { useEnvironmentContext } from '@/hooks/use-environment-context'; // Corrected import
import { TaskPriority } from '@/types';
import { isMeal } from '@/lib/scheduler-utils';

const MAX_DAILY_MINUTES = 8 * 60;
const WARNING_THRESHOLD = 6 * 60;
const RECOMMENDED_BREAK_RATIO = 0.2;
const AVERAGE_WORK_MINUTES_PER_DAY = 6 * 60;

interface DailyWorkload {
  date: string;
  dayName: string;
  totalWorkMinutes: number;
  totalBreakMinutes: number;
  totalPersonalMinutes: number;
  taskCount: number;
  isOverwork: boolean;
  isWarning: boolean;
  workTaskCount: number;
  energyConsumed: number;
  energyGained: number;
  workTasksByPriority: { HIGH: number; MEDIUM: number; LOW: number };
  completedWorkTasks: number;
  completedPersonalTasks: number;
  completedTaskHours: number[];
  completedTaskEnvironments: { environment: string; count: number }[];
  completedBreakEnvironments: { environment: string; count: number }[];
}

const WellnessPage: React.FC = () => {
  const { user, profile, updateSkippedDayOffSuggestions } = useSession();
  const navigate = useNavigate();
  const [skipWeekends, setSkipWeekends] = useState(true);
  const { allUserEnvironments } = useEnvironmentContext(); // Use dynamic environments

  const centerDateString = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const { weeklyTasks, isLoading: isWeeklyTasksLoading, profileSettings } = useWeeklySchedulerTasks(centerDateString);

  const { dbScheduledTasks, isLoading: isLoadingSchedulerTasks } = useSchedulerTasks(centerDateString);
  const { retiredTasks, isLoadingRetiredTasks } = useRetiredTasks();

  const isLoading = isWeeklyTasksLoading || isLoadingSchedulerTasks || isLoadingRetiredTasks;

  const last7DaysData = useMemo(() => {
    if (!weeklyTasks || !profileSettings) return null;

    const data: DailyWorkload[] = [];
    const today = startOfDay(new Date());

    for (let i = 6; i >= 0; i--) {
      const dayDate = addDays(today, -i);
      const dateKey = format(dayDate, 'yyyy-MM-dd');
      const dayName = format(dayDate, 'EEE');
      const tasks = weeklyTasks[dateKey] || [];

      let workMinutes = 0;
      let breakMinutes = 0;
      let personalMinutes = 0;
      let workTaskCount = 0;
      let energyConsumed = 0;
      let energyGained = 0;
      const workTasksByPriority = { HIGH: 0, MEDIUM: 0, LOW: 0 };
      let completedWorkTasks = 0;
      let completedPersonalTasks = 0;
      const completedTaskHours: number[] = Array(24).fill(0);
      const completedTaskEnvironmentsMap = new Map<string, number>();
      const completedBreakEnvironmentsMap = new Map<string, number>();

      tasks.forEach(task => {
        if (!task.start_time || !task.end_time) return;
        
        const parsedStartTime = parseISO(task.start_time);
        const parsedEndTime = parseISO(task.end_time);

        if (isNaN(parsedStartTime.getTime()) || isNaN(parsedEndTime.getTime())) return;

        const duration = differenceInMinutes(parsedEndTime, parsedStartTime);
        if (duration <= 0) return;

        const isBreakOrMeal = task.is_break || isMeal(task.name);
        
        if (isBreakOrMeal) {
          breakMinutes += duration;
          energyGained += Math.abs(task.energy_cost);
          if (task.task_environment) {
            completedBreakEnvironmentsMap.set(task.task_environment, (completedBreakEnvironmentsMap.get(task.task_environment) || 0) + 1);
          }
        } else {
          energyConsumed += task.energy_cost;
          if (task.is_work) {
            workMinutes += duration;
            workTaskCount++;
            // Assuming priority is derived from is_critical and is_backburner for scheduled tasks
            if (task.is_critical) workTasksByPriority.HIGH++;
            else if (task.is_backburner) workTasksByPriority.LOW++;
            else workTasksByPriority.MEDIUM++;
            completedWorkTasks++;
          } else {
            personalMinutes += duration;
            completedPersonalTasks++;
          }
          if (task.is_completed && task.end_time) {
            const completionHour = getHours(parsedEndTime);
            completedTaskHours[completionHour]++;
            if (task.task_environment) {
              completedTaskEnvironmentsMap.set(task.task_environment, (completedTaskEnvironmentsMap.get(task.task_environment) || 0) + 1);
            }
          }
        }
      });

      data.push({
        date: dateKey, dayName, totalWorkMinutes: workMinutes, totalBreakMinutes: breakMinutes, totalPersonalMinutes: personalMinutes,
        taskCount: tasks.length, isOverwork: workMinutes > MAX_DAILY_MINUTES, isWarning: workMinutes > WARNING_THRESHOLD && workMinutes <= MAX_DAILY_MINUTES,
        workTaskCount, energyConsumed, energyGained, workTasksByPriority, completedWorkTasks, completedPersonalTasks, completedTaskHours,
        completedTaskEnvironments: Array.from(completedTaskEnvironmentsMap.entries()).map(([environment, count]) => ({ environment, count })),
        completedBreakEnvironments: Array.from(completedBreakEnvironmentsMap.entries()).map(([environment, count]) => ({ environment, count })),
      });
    }

    return data;
  }, [weeklyTasks, profileSettings]);

  const future7DaysData = useMemo(() => {
    if (!weeklyTasks || !profileSettings) return null;
    const data: DailyWorkload[] = [];
    const today = startOfDay(new Date());

    for (let i = 0; i < 7; i++) {
      const dayDate = addDays(today, i);
      const dateKey = format(dayDate, 'yyyy-MM-dd');
      const dayName = format(dayDate, 'EEE');
      const tasks = weeklyTasks[dateKey] || [];

      let workMinutes = 0;
      let breakMinutes = 0;
      let personalMinutes = 0;
      let workTaskCount = 0;
      let energyConsumed = 0;
      let energyGained = 0;
      const workTasksByPriority = { HIGH: 0, MEDIUM: 0, LOW: 0 };
      let completedWorkTasks = 0;
      let completedPersonalTasks = 0;
      const completedTaskHours: number[] = Array(24).fill(0);
      const completedTaskEnvironments: { environment: string; count: number }[] = [];
      const completedBreakEnvironments: { environment: string; count: number }[] = [];

      tasks.forEach(task => {
        if (!task.start_time || !task.end_time) return;
        const parsedStartTime = parseISO(task.start_time);
        const parsedEndTime = parseISO(task.end_time);
        if (isNaN(parsedStartTime.getTime()) || isNaN(parsedEndTime.getTime())) return;
        const duration = differenceInMinutes(parsedEndTime, parsedStartTime);
        if (duration <= 0) return;
        const isBreakOrMeal = task.is_break || isMeal(task.name);
        if (isBreakOrMeal) {
          breakMinutes += duration;
          energyGained += Math.abs(task.energy_cost);
        } else {
          energyConsumed += task.energy_cost;
          if (task.is_work) {
            workMinutes += duration;
            workTaskCount++;
            if (task.is_critical) workTasksByPriority.HIGH++;
            else if (task.is_backburner) workTasksByPriority.LOW++;
            else workTasksByPriority.MEDIUM++;
            completedWorkTasks++;
          } else {
            personalMinutes += duration;
            completedPersonalTasks++;
          }
        }
      });

      data.push({
        date: dateKey, dayName, totalWorkMinutes: workMinutes, totalBreakMinutes: breakMinutes, totalPersonalMinutes: personalMinutes,
        taskCount: tasks.length, isOverwork: workMinutes > MAX_DAILY_MINUTES, isWarning: workMinutes > WARNING_THRESHOLD && workMinutes <= MAX_DAILY_MINUTES,
        workTaskCount, energyConsumed, energyGained, workTasksByPriority, completedWorkTasks, completedPersonalTasks, completedTaskHours,
        completedTaskEnvironments, completedBreakEnvironments,
      });
    }

    return data;
  }, [weeklyTasks, profileSettings]);

  const workloadDistribution = useMemo(() => {
    if (!last7DaysData) return null;
    const totalWork = last7DaysData.reduce((sum, day) => sum + day.totalWorkMinutes, 0);
    const totalBreak = last7DaysData.reduce((sum, day) => sum + day.totalBreakMinutes, 0);
    return [{ name: 'Work', value: totalWork }, { name: 'Break', value: totalBreak }];
  }, [last7DaysData]);

  const workPersonalDistribution = useMemo(() => {
    if (!last7DaysData) return null;
    const totalWork = last7DaysData.reduce((sum, day) => sum + day.totalWorkMinutes, 0);
    const totalPersonal = last7DaysData.reduce((sum, day) => sum + day.totalPersonalMinutes, 0);
    return [{ name: 'Work', value: totalWork }, { name: 'Personal', value: totalPersonal }];
  }, [last7DaysData]);

  const environmentUsage = useMemo(() => {
    if (!weeklyTasks) return null;
    const usageMap = new Map<string, number>();
    Object.values(weeklyTasks).flat().forEach(task => {
      if (!task.start_time || !task.end_time || !task.task_environment) return;
      const parsedStartTime = parseISO(task.start_time);
      const parsedEndTime = parseISO(task.end_time);
      if (isNaN(parsedStartTime.getTime()) || isNaN(parsedEndTime.getTime())) return;
      const duration = differenceInMinutes(parsedEndTime, parsedStartTime);
      if (duration <= 0) return;
      usageMap.set(task.task_environment, (usageMap.get(task.task_environment) || 0) + duration);
    });
    return Array.from(usageMap.entries()).map(([envVal, minutes]) => ({
      environment: allUserEnvironments.find(o => o.value === envVal)?.label || envVal, minutes
    })).sort((a, b) => b.minutes - a.minutes);
  }, [weeklyTasks, allUserEnvironments]);

  const dailyEnergyBalanceData = useMemo(() => {
    if (!last7DaysData) return null;
    return last7DaysData.map(day => ({ dayName: day.dayName, netEnergy: day.energyGained - day.energyConsumed }));
  }, [last7DaysData]);

  const workloadByPriorityData = useMemo(() => {
    if (!last7DaysData) return null;
    const totalHigh = last7DaysData.reduce((sum, day) => sum + day.workTasksByPriority.HIGH, 0);
    const totalMedium = last7DaysData.reduce((sum, day) => sum + day.workTasksByPriority.MEDIUM, 0);
    const totalLow = last7DaysData.reduce((sum, day) => sum + day.workTasksByPriority.LOW, 0);
    return [
      { name: 'High Priority', value: totalHigh },
      { name: 'Medium Priority', value: totalMedium },
      { name: 'Low Priority', value: totalLow },
    ].filter(item => item.value > 0);
  }, [last7DaysData]);

  const peakProductivityTime = useMemo(() => {
    if (!last7DaysData) return null;
    const allCompletedHours: number[] = Array(24).fill(0);
    last7DaysData.forEach(day => day.completedTaskHours.forEach((count, hour) => { allCompletedHours[hour] += count; }));
    let peakHour = -1;
    let maxTasks = 0;
    allCompletedHours.forEach((count, hour) => { if (count > maxTasks) { maxTasks = count; peakHour = hour; } });
    if (peakHour === -1 || maxTasks === 0) return null;
    const period = peakHour < 12 ? 'Morning' : peakHour < 17 ? 'Afternoon' : peakHour < 21 ? 'Evening' : 'Night';
    return { hour: peakHour, period, tasksCompleted: maxTasks };
  }, [last7DaysData]);

  const mostEffectiveWorkEnvironment = useMemo(() => {
    if (!last7DaysData) return null;
    const envCounts = new Map<string, number>();
    last7DaysData.forEach(day => day.completedTaskEnvironments.forEach(env => envCounts.set(env.environment, (envCounts.get(env.environment) || 0) + env.count)));
    let bestEnv = '';
    let maxCount = 0;
    envCounts.forEach((count, env) => { if (count > maxCount) { maxCount = count; bestEnv = env; } });
    if (!bestEnv) return null;
    return { environment: allUserEnvironments.find(o => o.value === bestEnv)?.label || bestEnv, tasksCompleted: maxCount };
  }, [last7DaysData, allUserEnvironments]);

  const mostEffectiveBreakEnvironment = useMemo(() => {
    if (!last7DaysData) return null;
    const envCounts = new Map<string, number>();
    last7DaysData.forEach(day => day.completedBreakEnvironments.forEach(env => envCounts.set(env.environment, (envCounts.get(env.environment) || 0) + env.count)));
    let bestEnv = '';
    let maxCount = 0;
    envCounts.forEach((count, env) => { if (count > maxCount) { maxCount = count; bestEnv = env; } });
    if (!bestEnv) return null;
    return { environment: allUserEnvironments.find(o => o.value === bestEnv)?.label || bestEnv, breaksCompleted: maxCount };
  }, [last7DaysData, allUserEnvironments]);

  const burnoutRisk = useMemo(() => {
    if (!last7DaysData || !future7DaysData) return 'Low';
    let riskScore = 0;
    if (last7DaysData.filter(d => d.isOverwork).length > 0) riskScore += 3;
    if (last7DaysData.filter(d => d.isWarning).length > 2) riskScore += 2;
    if (future7DaysData.slice(1, 4).reduce((sum, d) => d.totalWorkMinutes > MAX_DAILY_MINUTES ? sum + 2 : (d.totalWorkMinutes > WARNING_THRESHOLD ? sum + 1 : sum), 0) >= 2) riskScore += 2;
    return riskScore >= 5 ? 'High' : riskScore >= 2 ? 'Medium' : 'Low';
  }, [last7DaysData, future7DaysData]);

  const recommendations = useMemo(() => {
    if (!last7DaysData || !future7DaysData) return [];
    const recs: string[] = [];
    if (last7DaysData.filter(d => d.isOverwork).length > 0) recs.push("You overworked recently. Consider a recovery day.");
    if (peakProductivityTime) recs.push(`You're most productive at ${peakProductivityTime.hour}:00. Schedule deep work then.`);
    if (mostEffectiveWorkEnvironment) recs.push(`Your most effective work environment is ${mostEffectiveWorkEnvironment.environment}. Try to utilize it more.`);
    if (mostEffectiveBreakEnvironment) recs.push(`Your most effective break environment is ${mostEffectiveBreakEnvironment.environment}.`);
    if (burnoutRisk === 'High') recs.push("High burnout risk detected! Prioritize rest and reduce workload.");
    if (burnoutRisk === 'Medium') recs.push("Moderate burnout risk. Ensure you're taking enough breaks.");
    if (recs.length === 0) recs.push("Your balance looks great! Keep up the good work.");
    return recs;
  }, [last7DaysData, future7DaysData, peakProductivityTime, mostEffectiveWorkEnvironment, mostEffectiveBreakEnvironment, burnoutRisk]);

  const totalFlexibleTaskMinutes = useMemo(() => {
    const scheduledFlexibleMinutes = dbScheduledTasks.filter(task => task.is_flexible && !task.is_locked && !task.is_completed).reduce((sum, task) => sum + (task.start_time && task.end_time ? differenceInMinutes(parseISO(task.end_time), parseISO(task.start_time)) : 30), 0);
    const retiredTaskMinutes = retiredTasks.filter(task => !task.is_locked && !task.is_completed).reduce((sum, task) => sum + (task.duration || 30), 0);
    return scheduledFlexibleMinutes + retiredTaskMinutes;
  }, [dbScheduledTasks, retiredTasks]);

  const daysWorthOfTasks = Math.round(totalFlexibleTaskMinutes / AVERAGE_WORK_MINUTES_PER_DAY);

  const suggestedDayOff = useMemo(() => {
    if (!profile) return null;
    const today = startOfDay(new Date());
    for (let i = 1; i < 30; i++) {
      const dayDate = addDays(today, i);
      const dateKey = format(dayDate, 'yyyy-MM-dd');
      if (skipWeekends && (getDay(dayDate) === 0 || getDay(dayDate) === 6)) continue;
      if (!profile.blocked_days?.includes(dateKey) && !profile.skipped_day_off_suggestions?.includes(dateKey)) return dateKey;
    }
    return null;
  }, [profile, skipWeekends]);

  const handleSkipDayOffSuggestion = useCallback(async () => {
    if (suggestedDayOff) {
      await updateSkippedDayOffSuggestions(suggestedDayOff, true);
    }
  }, [suggestedDayOff, updateSkippedDayOffSuggestions]);

  if (!user) return <div className="p-8 text-center"><Button onClick={() => navigate('/login')}>Login</Button></div>;
  if (isLoading) return (
    <div className="space-y-8 p-8 animate-slide-in-up">
      <Skeleton className="h-10 w-full mb-4" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-4 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3 w-40" />
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 p-4 h-80"><Skeleton className="h-full w-full" /></Card>
        <Card className="p-4 h-80"><Skeleton className="h-full w-full" /></Card>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="p-4 h-64"><Skeleton className="h-full w-full" /></Card>
        <Card className="p-4 h-64"><Skeleton className="h-full w-full" /></Card>
      </div>
    </div>
  );

  if (!last7DaysData || last7DaysData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-4">
        <CalendarOff className="h-12 w-12 text-muted-foreground opacity-50" />
        <h2 className="text-xl font-bold">No Data Yet</h2>
        <p className="text-muted-foreground max-w-md">
          Start scheduling tasks in your Vibe Schedule to unlock your wellness analytics. We'll help you spot patterns and prevent burnout.
        </p>
        <Button onClick={() => navigate('/scheduler')}>Go to Scheduler</Button>
      </div>
    );
  }

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--logo-orange))', 'hsl(var(--logo-green))', 'hsl(var(--accent))', 'hsl(var(--destructive))'];
  const PIE_COLORS = { 
    Work: 'hsl(var(--primary))', 
    Break: 'hsl(var(--logo-orange))', 
    Personal: 'hsl(var(--logo-green))',
    'High Priority': 'hsl(var(--destructive))',
    'Medium Priority': 'hsl(var(--logo-orange))',
    'Low Priority': 'hsl(var(--logo-green))',
    'Net Positive': 'hsl(var(--logo-green))',
    'Net Negative': 'hsl(var(--destructive))',
  };

  return (
    <div className="space-y-8 animate-slide-in-up pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Activity className="h-8 w-8 text-primary" /> Wellness & Balance
          </h1>
          <p className="text-muted-foreground mt-1">
            Insights to help you manage time blindness and prevent overwork.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/scheduler')}>
          Back to Scheduler
        </Button>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <CardHeader className="p-0 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Daily Work</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-2xl font-bold text-foreground">
              {Math.round(last7DaysData?.reduce((sum, d) => sum + d.totalWorkMinutes, 0) / 7 / 60)}h
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Target: {Math.round(MAX_DAILY_MINUTES / 60)}h
            </div>
          </CardContent>
        </Card>

        <Card className="p-4">
          <CardHeader className="p-0 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overwork Days</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent className="p-0">
            <div className={cn("text-2xl font-bold", last7DaysData?.filter(d => d.isOverwork).length > 0 ? "text-destructive" : "text-foreground")}>
              {last7DaysData?.filter(d => d.isOverwork).length}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Last 7 Days</div>
          </CardContent>
        </Card>

        <Card className="p-4">
          <CardHeader className="p-0 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Break Ratio</CardTitle>
            <Coffee className="h-4 w-4 text-logo-orange" />
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-2xl font-bold text-foreground">
              {Math.round((workloadDistribution?.[1]?.value || 0) / (workloadDistribution?.reduce((a, b) => a + b.value, 0) || 1) * 100)}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Target: {RECOMMENDED_BREAK_RATIO * 100}%
            </div>
          </CardContent>
        </Card>

        <Card className="p-4">
          <CardHeader className="p-0 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Burnout Risk</CardTitle>
            <Flame className={cn("h-4 w-4", burnoutRisk === 'High' ? 'text-destructive' : burnoutRisk === 'Medium' ? 'text-logo-orange' : 'text-logo-green')} />
          </CardHeader>
          <CardContent className="p-0">
            <div className={cn("text-2xl font-bold", burnoutRisk === 'High<dyad-problem-report summary="822 problems">
<problem file="src/hooks/use-environment-context.ts" line="91" column="34" code="1005">'&gt;' expected.</problem>
<problem file="src/hooks/use-environment-context.ts" line="91" column="39" code="1005">')' expected.</problem>
<problem file="src/hooks/use-environment-context.ts" line="93" column="6" code="1161">Unterminated regular expression literal.</problem>
<problem file="src/hooks/use-environment-context.ts" line="94" column="3" code="1128">Declaration or statement expected.</problem>
<problem file="src/hooks/use-environment-context.ts" line="95" column="1" code="1128">Declaration or statement expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="649" column="147" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="650" column="10" code="1005">'&gt;' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="650" column="14" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="650" column="54" code="1005">':' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="650" column="64" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="650" column="76" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="650" column="95" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="650" column="103" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="650" column="104" code="1003">Identifier expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="650" column="105" code="1161">Unterminated regular expression literal.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="651" column="10" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="651" column="54" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="651" column="64" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="651" column="76" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="651" column="92" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="651" column="100" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="651" column="101" code="1003">Identifier expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="651" column="102" code="1161">Unterminated regular expression literal.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="652" column="10" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="652" column="54" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="652" column="64" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="652" column="75" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="652" column="100" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="652" column="108" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="652" column="119" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="652" column="126" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="652" column="127" code="1003">Identifier expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="652" column="128" code="1161">Unterminated regular expression literal.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="653" column="10" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="653" column="54" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="653" column="64" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="653" column="75" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="653" column="99" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="653" column="102" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="653" column="112" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="653" column="120" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="653" column="121" code="1003">Identifier expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="653" column="122" code="1161">Unterminated regular expression literal.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="654" column="10" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="654" column="54" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="654" column="64" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="654" column="75" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="654" column="99" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="654" column="102" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="654" column="112" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="654" column="120" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="654" column="121" code="1003">Identifier expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="654" column="122" code="1161">Unterminated regular expression literal.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="655" column="10" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="655" column="54" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="655" column="64" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="655" column="75" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="655" column="94" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="655" column="99" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="655" column="109" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="655" column="129" code="1005">':' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="655" column="130" code="1003">Identifier expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="655" column="131" code="1161">Unterminated regular expression literal.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="656" column="10" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="656" column="54" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="656" column="64" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="656" column="76" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="656" column="97" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="656" column="104" code="1005">':' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="656" column="111" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="656" column="114" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="656" column="122" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="656" column="125" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="656" column="131" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="656" column="168" code="1005">':' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="656" column="172" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="656" column="204" code="1005">':' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="656" column="205" code="1003">Identifier expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="656" column="206" code="1161">Unterminated regular expression literal.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="657" column="10" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="657" column="54" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="657" column="64" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="657" column="76" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="657" column="97" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="657" column="104" code="1005">':' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="657" column="111" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="657" column="114" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="657" column="122" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="657" column="125" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="657" column="131" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="657" column="141" code="1005">':' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="657" column="145" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="657" column="153" code="1005">':' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="657" column="154" code="1003">Identifier expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="657" column="155" code="1161">Unterminated regular expression literal.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="658" column="10" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="658" column="55" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="658" column="65" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="658" column="77" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="658" column="96" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="658" column="101" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="658" column="106" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="658" column="117" code="1005">':' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="658" column="118" code="1003">Identifier expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="658" column="119" code="1161">Unterminated regular expression literal.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="659" column="10" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="659" column="55" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="659" column="65" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="659" column="77" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="659" column="96" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="659" column="101" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="659" column="106" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="659" column="114" code="1005">':' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="659" column="115" code="1003">Identifier expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="659" column="116" code="1161">Unterminated regular expression literal.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="660" column="10" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="660" column="55" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="660" column="65" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="660" column="77" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="660" column="96" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="660" column="101" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="660" column="106" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="660" column="112" code="1005">':' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="660" column="113" code="1003">Identifier expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="660" column="114" code="1161">Unterminated regular expression literal.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="661" column="10" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="661" column="55" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="661" column="65" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="661" column="77" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="661" column="96" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="661" column="101" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="661" column="106" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="661" column="111" code="1005">':' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="661" column="112" code="1003">Identifier expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="661" column="113" code="1161">Unterminated regular expression literal.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="662" column="10" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="662" column="45" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="662" column="55" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="662" column="67" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="662" column="125" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="662" column="129" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="662" column="132" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="662" column="141" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="662" column="148" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="662" column="154" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="662" column="174" code="1005">':' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="662" column="180" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="662" column="184" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="662" column="189" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="662" column="210" code="1139">Type parameter declaration expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="663" column="10" code="1005">'&gt;' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="663" column="14" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="663" column="62" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="663" column="71" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="663" column="83" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="663" column="102" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="663" column="107" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="663" column="114" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="663" column="142" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="663" column="145" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="663" column="149" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="663" column="163" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="663" column="168" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="663" column="181" code="1003">Identifier expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="663" column="182" code="1161">Unterminated regular expression literal.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="664" column="10" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="664" column="59" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="664" column="70" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="664" column="82" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="664" column="101" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="664" column="106" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="664" column="111" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="664" column="121" code="1003">Identifier expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="664" column="122" code="1161">Unterminated regular expression literal.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="665" column="10" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="665" column="53" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="665" column="63" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="665" column="75" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="665" column="94" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="665" column="99" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="665" column="106" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="665" column="134" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="665" column="137" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="665" column="141" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="665" column="155" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="665" column="160" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="665" column="173" code="1003">Identifier expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="665" column="174" code="1161">Unterminated regular expression literal.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="666" column="10" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="666" column="56" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="666" column="65" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="666" column="77" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="666" column="135" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="666" column="139" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="666" column="142" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="666" column="151" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="666" column="158" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="666" column="164" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="666" column="190" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="666" column="194" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="666" column="199" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="666" column="220" code="1110">Type expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="667" column="10" code="1005">':' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="667" column="56" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="667" column="66" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="667" column="77" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="667" column="96" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="667" column="104" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="667" column="108" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="667" column="113" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="667" column="121" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="667" column="127" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="667" column="143" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="667" column="164" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="667" column="169" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="667" column="173" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="667" column="187" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="667" column="212" code="1003">Identifier expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="667" column="213" code="1161">Unterminated regular expression literal.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="668" column="10" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="668" column="44" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="668" column="54" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="668" column="66" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="668" column="124" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="668" column="128" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="668" column="131" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="668" column="140" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="668" column="147" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="668" column="153" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="668" column="179" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="668" column="183" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="668" column="188" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="668" column="209" code="1110">Type expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="669" column="10" code="1005">':' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="669" column="59" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="669" column="68" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="669" column="80" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="669" column="99" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="669" column="104" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="669" column="111" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="669" column="139" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="669" column="142" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="669" column="146" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="669" column="160" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="669" column="165" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="669" column="178" code="1003">Identifier expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="669" column="179" code="1161">Unterminated regular expression literal.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="670" column="10" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="670" column="60" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="670" column="69" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="670" column="81" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="670" column="100" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="670" column="105" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="670" column="112" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="670" column="140" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="670" column="143" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="670" column="147" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="670" column="161" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="670" column="166" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="670" column="179" code="1003">Identifier expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="670" column="180" code="1161">Unterminated regular expression literal.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="671" column="2" code="1161">Unterminated regular expression literal.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="673" column="1" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="673" column="2" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="673" column="78" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="673" column="80" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="673" column="87" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="673" column="92" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="673" column="96" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="673" column="103" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="673" column="153" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="673" column="159" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="673" column="193" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="673" column="199" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="673" column="205" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="673" column="208" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="673" column="212" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="673" column="217" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="673" column="223" code="1005">',' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="673" column="227" code="1005">'(' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="673" column="241" code="1005">')' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="673" column="250" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="673" column="364" code="1002">Unterminated string literal.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="676" column="19" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="2" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="113" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="116" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="124" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="190" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="200" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="204" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="213" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="262" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="267" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="277" code="1443">Module declaration names may only use ' or &quot; quoted strings.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="298" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="303" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="318" code="1005">'=' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="326" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="366" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="535" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="538" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="545" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="565" code="1005">'=' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="571" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="592" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="595" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="617" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="681" column="1" code="1003">Identifier expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="681" column="14" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="681" column="27" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="2" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="73" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="76" code="1435">Unknown keyword or identifier. Did you mean 'for mulated'?</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="87" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="89" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="94" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="97" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="104" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="121" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="131" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="136" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="139" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="197" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="206" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="210" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="249" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="262" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="269" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="274" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="335" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="338" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="343" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="350" code="1435">Unknown keyword or identifier. Did you mean 'import'?</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="405" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="439" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="581" code="1002">Unterminated string literal.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="686" column="13" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="2" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="82" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="85" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="100" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="123" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="128" code="1005">'(' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="186" code="1005">')' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="189" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="207" code="1443">Module declaration names may only use ' or &quot; quoted strings.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="237" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="250" code="1443">Module declaration names may only use ' or &quot; quoted strings.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="287" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="451" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="454" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="458" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="462" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="470" code="1435">Unknown keyword or identifier. Did you mean 'import'?</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="481" code="1443">Module declaration names may only use ' or &quot; quoted strings.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="491" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="495" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="500" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="507" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="521" code="1005">'=' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="691" column="1" code="1003">Identifier expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="691" column="2" code="1161">Unterminated regular expression literal.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="47" code="1109">Expression expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="53" code="1443">Module declaration names may only use ' or &quot; quoted strings.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="83" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="91" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="95" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="116" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="156" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="160" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="172" code="1435">Unknown keyword or identifier. Did you mean 'import'?</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="181" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="192" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="219" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="221" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="231" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="235" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="247" code="1443">Module declaration names may only use ' or &quot; quoted strings.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="282" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="286" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="294" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="307" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="311" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="315" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="694" column="1" code="1003">Identifier expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="694" column="48" code="1109">Expression expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="694" column="50" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="694" column="54" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="694" column="108" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="694" column="113" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="694" column="128" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="694" column="160" code="1002">Unterminated string literal.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="695" column="37" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="695" column="71" code="1109">Expression expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="695" column="94" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="695" column="98" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="695" column="121" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="695" column="298" code="1002">Unterminated string literal.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="696" column="185" code="1109">Expression expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="696" column="191" code="1443">Module declaration names may only use ' or &quot; quoted strings.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="696" column="213" code="1005">'=' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="696" column="217" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="696" column="231" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="696" column="238" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="696" column="299" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="696" column="323" code="1002">Unterminated string literal.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="697" column="52" code="1109">Expression expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="697" column="58" code="1443">Module declaration names may only use ' or &quot; quoted strings.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="697" column="68" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="697" column="73" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="697" column="77" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="697" column="92" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="697" column="113" code="1002">Unterminated string literal.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="699" column="1" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="699" column="7" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="699" column="15" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="699" column="22" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="699" column="30" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="699" column="34" code="1434">Unexpected keyword or identifier.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="699" column="51" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="701" column="1" code="1003">Identifier expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="701" column="13" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="701" column="57" code="1005">';' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="792" column="34" code="1005">'&gt;' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="792" column="39" code="1005">')' expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="794" column="6" code="1161">Unterminated regular expression literal.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="795" column="3" code="1128">Declaration or statement expected.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="798" column="36" code="1005">'}' expected.</problem>
<problem file="src/hooks/use-environment-context.ts" line="91" column="6" code="2503">Cannot find namespace 'EnvironmentContext'.</problem>
<problem file="src/hooks/use-environment-context.ts" line="91" column="40" code="2365">Operator '&gt;' cannot be applied to types '{ value: EnvironmentContextType; }' and '{ children: React.ReactNode; }'.</problem>
<problem file="src/hooks/use-environment-context.ts" line="91" column="40" code="2365">Operator '&lt;' cannot be applied to types 'boolean' and 'RegExp'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="123" code="1101">'with' statements are not allowed in strict mode.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="649" column="40" code="2362">The left-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="649" column="40" code="2345">Argument of type 'boolean' is not assignable to parameter of type 'UnifiedTask'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="649" column="127" code="2304">Cannot find name 'dyad'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="649" column="132" code="2304">Cannot find name 'problem'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="649" column="140" code="2304">Cannot find name 'report'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="650" column="2" code="2304">Cannot find name 'problem'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="650" column="10" code="2304">Cannot find name 'file'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="650" column="54" code="2304">Cannot find name 'line'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="650" column="95" code="18004">No value exists in scope for the shorthand property 'expected'. Either declare one or provide an initializer.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="651" column="2" code="2304">Cannot find name 'problem'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="651" column="92" code="18004">No value exists in scope for the shorthand property 'expected'. Either declare one or provide an initializer.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="652" column="2" code="2304">Cannot find name 'problem'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="652" column="87" code="2304">Cannot find name 'Unterminated'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="652" column="100" code="18004">No value exists in scope for the shorthand property 'regular'. Either declare one or provide an initializer.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="652" column="108" code="18004">No value exists in scope for the shorthand property 'expression'. Either declare one or provide an initializer.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="652" column="119" code="18004">No value exists in scope for the shorthand property 'literal'. Either declare one or provide an initializer.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="653" column="2" code="2304">Cannot find name 'problem'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="653" column="87" code="2304">Cannot find name 'Declaration'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="653" column="99" code="18004">No value exists in scope for the shorthand property 'or'. Either declare one or provide an initializer.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="653" column="112" code="18004">No value exists in scope for the shorthand property 'expected'. Either declare one or provide an initializer.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="654" column="2" code="2304">Cannot find name 'problem'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="654" column="87" code="2304">Cannot find name 'Declaration'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="654" column="99" code="18004">No value exists in scope for the shorthand property 'or'. Either declare one or provide an initializer.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="654" column="112" code="18004">No value exists in scope for the shorthand property 'expected'. Either declare one or provide an initializer.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="655" column="2" code="2304">Cannot find name 'problem'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="655" column="87" code="2304">Cannot find name 'Cannot'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="655" column="94" code="18004">No value exists in scope for the shorthand property 'find'. Either declare one or provide an initializer.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="655" column="99" code="18004">No value exists in scope for the shorthand property 'namespace'. Either declare one or provide an initializer.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="656" column="2" code="2304">Cannot find name 'problem'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="656" column="88" code="2304">Cannot find name 'Operator'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="656" column="104" code="2304">Cannot find name 'cannot'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="656" column="111" code="18004">No value exists in scope for the shorthand property 'be'. Either declare one or provide an initializer.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="656" column="114" code="18004">No value exists in scope for the shorthand property 'applied'. Either declare one or provide an initializer.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="656" column="122" code="18004">No value exists in scope for the shorthand property 'to'. Either declare one or provide an initializer.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="656" column="125" code="18004">No value exists in scope for the shorthand property 'types'. Either declare one or provide an initializer.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="657" column="2" code="2304">Cannot find name 'problem'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="657" column="88" code="2304">Cannot find name 'Operator'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="657" column="104" code="2304">Cannot find name 'cannot'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="657" column="111" code="18004">No value exists in scope for the shorthand property 'be'. Either declare one or provide an initializer.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="657" column="114" code="18004">No value exists in scope for the shorthand property 'applied'. Either declare one or provide an initializer.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="657" column="122" code="18004">No value exists in scope for the shorthand property 'to'. Either declare one or provide an initializer.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="657" column="125" code="18004">No value exists in scope for the shorthand property 'types'. Either declare one or provide an initializer.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="658" column="2" code="2304">Cannot find name 'problem'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="658" column="89" code="2304">Cannot find name 'Cannot'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="658" column="96" code="18004">No value exists in scope for the shorthand property 'find'. Either declare one or provide an initializer.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="659" column="2" code="2304">Cannot find name 'problem'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="659" column="89" code="2304">Cannot find name 'Cannot'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="659" column="96" code="18004">No value exists in scope for the shorthand property 'find'. Either declare one or provide an initializer.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="660" column="2" code="2304">Cannot find name 'problem'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="660" column="89" code="2304">Cannot find name 'Cannot'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="660" column="96" code="18004">No value exists in scope for the shorthand property 'find'. Either declare one or provide an initializer.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="661" column="2" code="2304">Cannot find name 'problem'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="661" column="89" code="2304">Cannot find name 'Cannot'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="661" column="96" code="18004">No value exists in scope for the shorthand property 'find'. Either declare one or provide an initializer.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="662" column="2" code="2304">Cannot find name 'problem'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="662" column="125" code="18004">No value exists in scope for the shorthand property 'has'. Either declare one or provide an initializer.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="662" column="129" code="18004">No value exists in scope for the shorthand property 'no'. Either declare one or provide an initializer.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="662" column="132" code="18004">No value exists in scope for the shorthand property 'exported'. Either declare one or provide an initializer.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="662" column="141" code="18004">No value exists in scope for the shorthand property 'member'. Either declare one or provide an initializer.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="662" column="148" code="18004">No value exists in scope for the shorthand property 'named'. Either declare one or provide an initializer.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="662" column="180" code="18004">No value exists in scope for the shorthand property 'you'. Either declare one or provide an initializer.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="662" column="184" code="18004">No value exists in scope for the shorthand property 'mean'. Either declare one or provide an initializer.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="662" column="211" code="2304">Cannot find name 'problem'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="663" column="2" code="2304">Cannot find name 'problem'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="663" column="10" code="2304">Cannot find name 'file'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="663" column="62" code="2304">Cannot find name 'line'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="663" column="71" code="2304">Cannot find name 'column'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="663" column="83" code="2304">Cannot find name 'code'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="663" column="95" code="2304">Cannot find name 'Cannot'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="663" column="102" code="2304">Cannot find name 'find'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="663" column="142" code="2304">Cannot find name 'or'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="663" column="145" code="2304">Cannot find name 'its'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="663" column="149" code="2304">Cannot find name 'corresponding'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="663" column="163" code="2304">Cannot find name 'type'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="663" column="168" code="2304">Cannot find name 'declarations'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="664" column="2" code="2304">Cannot find name 'problem'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="664" column="10" code="2552">Cannot find name 'file'. Did you mean 'File'?</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="664" column="59" code="2304">Cannot find name 'line'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="664" column="70" code="2304">Cannot find name 'column'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="664" column="82" code="2304">Cannot find name 'code'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="664" column="94" code="2304">Cannot find name 'Cannot'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="664" column="101" code="2304">Cannot find name 'find'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="665" column="2" code="2304">Cannot find name 'problem'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="665" column="10" code="2304">Cannot find name 'file'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="665" column="53" code="2304">Cannot find name 'line'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="665" column="63" code="2304">Cannot find name 'column'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="665" column="75" code="2304">Cannot find name 'code'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="665" column="87" code="2304">Cannot find name 'Cannot'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="665" column="94" code="2304">Cannot find name 'find'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="665" column="134" code="2304">Cannot find name 'or'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="665" column="137" code="2304">Cannot find name 'its'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="665" column="141" code="2304">Cannot find name 'corresponding'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="665" column="155" code="2304">Cannot find name 'type'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="665" column="160" code="2304">Cannot find name 'declarations'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="666" column="2" code="2304">Cannot find name 'problem'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="666" column="10" code="2304">Cannot find name 'file'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="666" column="56" code="2304">Cannot find name 'line'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="666" column="65" code="2304">Cannot find name 'column'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="666" column="77" code="2304">Cannot find name 'code'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="666" column="135" code="2304">Cannot find name 'has'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="666" column="139" code="2304">Cannot find name 'no'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="666" column="142" code="2304">Cannot find name 'exported'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="666" column="151" code="2304">Cannot find name 'member'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="666" column="158" code="2304">Cannot find name 'named'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="666" column="186" code="2339">Property 'Did' does not exist on type '&quot;environmentOptions&quot;'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="666" column="190" code="2304">Cannot find name 'you'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="666" column="194" code="2304">Cannot find name 'mean'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="666" column="199" code="2872">This kind of expression is always truthy.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="667" column="2" code="2304">Cannot find name 'problem'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="667" column="10" code="2304">Cannot find name 'file'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="667" column="56" code="2304">Cannot find name 'line'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="667" column="66" code="2304">Cannot find name 'column'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="667" column="77" code="2304">Cannot find name 'code'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="667" column="82" code="2365">Operator '&gt;' cannot be applied to types 'string' and 'ObjectConstructor'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="667" column="96" code="2304">Cannot find name 'literal'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="667" column="104" code="2304">Cannot find name 'may'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="667" column="108" code="2304">Cannot find name 'only'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="667" column="113" code="2304">Cannot find name 'specify'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="667" column="121" code="2304">Cannot find name 'known'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="667" column="127" code="2304">Cannot find name 'properties'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="667" column="164" code="2304">Cannot find name 'does'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="667" column="169" code="2304">Cannot find name 'not'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="667" column="173" code="2304">Cannot find name 'exist'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="667" column="182" code="2304">Cannot find name 'type'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="668" column="2" code="2304">Cannot find name 'problem'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="668" column="10" code="2304">Cannot find name 'file'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="668" column="44" code="2304">Cannot find name 'line'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="668" column="54" code="2304">Cannot find name 'column'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="668" column="66" code="2304">Cannot find name 'code'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="668" column="124" code="2304">Cannot find name 'has'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="668" column="128" code="2304">Cannot find name 'no'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="668" column="131" code="2304">Cannot find name 'exported'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="668" column="140" code="2304">Cannot find name 'member'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="668" column="147" code="2304">Cannot find name 'named'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="668" column="175" code="2339">Property 'Did' does not exist on type '&quot;environmentOptions&quot;'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="668" column="179" code="2304">Cannot find name 'you'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="668" column="183" code="2304">Cannot find name 'mean'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="668" column="188" code="2872">This kind of expression is always truthy.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="669" column="2" code="2304">Cannot find name 'problem'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="669" column="10" code="2304">Cannot find name 'file'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="669" column="59" code="2304">Cannot find name 'line'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="669" column="68" code="2304">Cannot find name 'column'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="669" column="80" code="2304">Cannot find name 'code'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="669" column="92" code="2304">Cannot find name 'Cannot'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="669" column="99" code="2304">Cannot find name 'find'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="669" column="139" code="2304">Cannot find name 'or'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="669" column="142" code="2304">Cannot find name 'its'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="669" column="146" code="2304">Cannot find name 'corresponding'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="669" column="160" code="2304">Cannot find name 'type'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="669" column="165" code="2304">Cannot find name 'declarations'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="670" column="2" code="2304">Cannot find name 'problem'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="670" column="10" code="2304">Cannot find name 'file'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="670" column="60" code="2304">Cannot find name 'line'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="670" column="69" code="2304">Cannot find name 'column'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="670" column="81" code="2304">Cannot find name 'code'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="670" column="93" code="2304">Cannot find name 'Cannot'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="670" column="100" code="2304">Cannot find name 'find'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="670" column="140" code="2304">Cannot find name 'or'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="670" column="143" code="2304">Cannot find name 'its'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="670" column="147" code="2304">Cannot find name 'corresponding'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="670" column="161" code="2304">Cannot find name 'type'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="670" column="166" code="2304">Cannot find name 'declarations'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="670" column="166" code="2365">Operator '&lt;' cannot be applied to types 'boolean' and 'RegExp'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="673" column="1" code="2304">Cannot find name 'I'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="673" column="78" code="2304">Cannot find name 'm'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="673" column="80" code="2304">Cannot find name 'diving'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="673" column="87" code="2304">Cannot find name 'into'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="673" column="92" code="2304">Cannot find name 'the'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="673" column="96" code="2304">Cannot find name 'errors'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="673" column="103" code="2304">Cannot find name 'within'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="673" column="153" code="2304">Cannot find name 'seems'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="673" column="159" code="2304">Cannot find name 'the'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="673" column="193" code="2304">Cannot find name 'usage'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="673" column="199" code="2304">Cannot find name 'might'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="673" column="205" code="2304">Cannot find name 'be'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="673" column="208" code="2304">Cannot find name 'the'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="673" column="212" code="2304">Cannot find name 'root'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="673" column="217" code="2304">Cannot find name 'cause'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="673" column="227" code="2304">Cannot find name 'most'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="673" column="235" code="2304">Cannot find name 'these'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="673" column="241" code="2304">Cannot find name 'issues'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="673" column="250" code="2362">The left-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="676" column="3" code="2304">Cannot find name 'Troubleshooting'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="676" column="19" code="2304">Cannot find name 'Compile'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="676" column="27" code="2304">Cannot find name 'Errors'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="1" code="2304">Cannot find name 'I'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="113" code="2304">Cannot find name 'll'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="116" code="2304">Cannot find name 'address'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="124" code="2304">Cannot find name 'those'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="130" code="2304">Cannot find name 'within'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="130" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="177" code="2304">Cannot find name 'specifically'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="190" code="2304">Cannot find name 'regarding'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="200" code="2304">Cannot find name 'the'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="204" code="2304">Cannot find name 'unclosed'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="213" code="2304">Cannot find name 'or'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="216" code="2304">Cannot find name 'unrecognized'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="262" code="2304">Cannot find name 'need'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="267" code="2304">Cannot find name 'to'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="270" code="2304">Cannot find name 'remove'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="298" code="2304">Cannot find name 'from'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="303" code="2304">Cannot find name 'the'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="326" code="2304">Cannot find name 'object'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="359" code="2339">Property 'Also' does not exist on type '&quot;EnvironmentProvider&quot;'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="365" code="2304">Cannot find name 'I'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="535" code="2304">Cannot find name 'll'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="538" code="2304">Cannot find name 'remove'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="545" code="2304">Cannot find name 'an'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="565" code="2304">Cannot find name 'where'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="565" code="2503">Cannot find namespace 'where'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="592" code="2304">Cannot find name 'is'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="595" code="2304">Cannot find name 'being'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="601" code="2304">Cannot find name 'imported'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="613" code="2304">Cannot find name 'two'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="617" code="2304">Cannot find name 'other'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="678" column="623" code="2304">Cannot find name 'files'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="681" column="3" code="2304">Cannot find name 'Addressing'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="681" column="14" code="2304">Cannot find name 'Compile'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="681" column="22" code="2304">Cannot find name 'Time'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="681" column="27" code="2304">Cannot find name 'Issues'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="1" code="2304">Cannot find name 'I'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="73" code="2304">Cannot find name 've'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="76" code="2304">Cannot find name 'formulated'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="87" code="2304">Cannot find name 'a'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="89" code="2304">Cannot find name 'plan'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="94" code="2304">Cannot find name 'to'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="97" code="2304">Cannot find name 'tackle'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="104" code="2304">Cannot find name 'the'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="108" code="2304">Cannot find name 'compile'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="116" code="2304">Cannot find name 'time'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="121" code="2304">Cannot find name 'issues'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="131" code="2304">Cannot find name 'need'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="136" code="2304">Cannot find name 'to'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="139" code="2304">Cannot find name 'resolve'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="147" code="2304">Cannot find name 'issues'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="147" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="157" code="2322">Type 'string' is not assignable to type 'object'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="187" code="2304">Cannot find name 'including'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="197" code="2304">Cannot find name 'improper'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="206" code="2304">Cannot find name 'use'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="213" code="2304">Cannot find name 'the'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="262" code="2304">Cannot find name 'Cannot'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="269" code="2304">Cannot find name 'find'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="335" code="2304">Cannot find name 'll'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="338" code="2304">Cannot find name 'also'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="343" code="2304">Cannot find name 'modify'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="350" code="2304">Cannot find name 'imports'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="385" code="2322">Type 'string' is not assignable to type 'object'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="438" code="2304">Cannot find name 'I'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="683" column="439" code="2362">The left-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="686" column="3" code="2304">Cannot find name 'Executing'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="686" column="19" code="2304">Cannot find name 'Resolutions'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="1" code="2304">Cannot find name 'I'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="82" code="2304">Cannot find name 'll'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="85" code="2304">Cannot find name 'systematically'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="100" code="2304">Cannot find name 'address'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="108" code="2304">Cannot find name 'them'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="108" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="114" code="2304">Cannot find name 'starting'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="128" code="2304">Cannot find name 'those'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="128" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="137" code="2322">Type 'string' is not assignable to type 'object'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="177" code="2304">Cannot find name 'focusing'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="189" code="2304">Cannot find name 'the'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="193" code="2304">Cannot find name 'misconfigured'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="241" code="2304">Cannot find name 'obsolete'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="271" code="2304">Cannot find name 'imports'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="286" code="2304">Cannot find name 'I'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="451" code="2304">Cannot find name 'll'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="454" code="2304">Cannot find name 'fix'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="458" code="2304">Cannot find name 'the'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="462" code="2304">Cannot find name 'missing'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="470" code="2304">Cannot find name 'imports'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="495" code="2304">Cannot find name 'also'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="500" code="2304">Cannot find name 'adjust'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="688" column="507" code="2304">Cannot find name 'the'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="7" code="2362">The left-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="49" code="2304">Cannot find name 'The'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="83" code="2304">Cannot find name 'closing'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="91" code="2304">Cannot find name 'tag'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="95" code="2304">Cannot find name 'was'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="99" code="2304">Cannot find name 'malformed'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="112" code="2304">Cannot find name 'the'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="116" code="2304">Cannot find name 'error'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="122" code="2304">Cannot find name 'message'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="122" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="156" code="2304">Cannot find name 'was'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="160" code="2304">Cannot find name 'incorrectly'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="172" code="2304">Cannot find name 'imported'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="185" code="2304">Cannot find name 'used'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="219" code="2304">Cannot find name 's'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="221" code="2304">Cannot find name 'structure'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="235" code="2304">Cannot find name 'removed'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="243" code="2304">Cannot find name 'the'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="268" code="2304">Cannot find name 'reference'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="268" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="279" code="2304">Cannot find name 'as'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="282" code="2304">Cannot find name 'the'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="286" code="2304">Cannot find name 'dynamic'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="294" code="2304">Cannot find name 'environments'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="307" code="2304">Cannot find name 'are'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="311" code="2304">Cannot find name 'now'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="315" code="2304">Cannot find name 'accessed'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="693" column="324" code="2304">Cannot find name 'via'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="694" column="7" code="2362">The left-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="694" column="50" code="2304">Cannot find name 'The'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="694" column="54" code="2304">Cannot find name 'Lucide'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="694" column="61" code="2304">Cannot find name 'icons'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="694" column="61" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="694" column="61" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="694" column="61" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="694" column="108" code="2304">Cannot find name 'were'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="694" column="113" code="2304">Cannot find name 'not'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="694" column="117" code="2304">Cannot find name 'imported'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="695" column="7" code="2363">The right-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="695" column="94" code="2304">Cannot find name 'was'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="695" column="98" code="2304">Cannot find name 'incorrectly'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="695" column="110" code="2304">Cannot find name 'imported'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="696" column="1" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="696" column="1" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="696" column="1" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="696" column="7" code="2363">The right-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="696" column="139" code="2362">The left-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="696" column="187" code="2304">Cannot find name 'The'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="696" column="213" code="2304">Cannot find name 'was'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="696" column="213" code="2503">Cannot find namespace 'was'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="696" column="217" code="2304">Cannot find name 'incorrect'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="696" column="231" code="2304">Cannot find name 'should'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="696" column="238" code="2304">Cannot find name 'be'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="696" column="241" code="2304">Cannot find name 'from'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="696" column="241" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="696" column="265" code="2304">Cannot find name 'not'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="697" column="7" code="2362">The left-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="697" column="54" code="2304">Cannot find name 'The'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="697" column="68" code="2304">Cannot find name 'icon'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="697" column="73" code="2304">Cannot find name 'was'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="697" column="77" code="2304">Cannot find name 'not'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="697" column="81" code="2304">Cannot find name 'imported'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="699" column="1" code="2304">Cannot find name 'These'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="699" column="7" code="2304">Cannot find name 'changes'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="699" column="15" code="2304">Cannot find name 'should'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="699" column="22" code="2304">Cannot find name 'resolve'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="699" column="30" code="2304">Cannot find name 'all'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="699" column="34" code="2304">Cannot find name 'the'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="699" column="38" code="2304">Cannot find name 'compile'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="699" column="46" code="2304">Cannot find name 'time'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="699" column="51" code="2304">Cannot find name 'errors'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="701" column="2" code="2304">Cannot find name 'dyad'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="701" column="7" code="2304">Cannot find name 'write'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="701" column="13" code="2632">Cannot assign to 'path' because it is an import.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="701" column="57" code="2304">Cannot find name 'description'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="706" column="46" code="2307">Cannot find module './use-environments' or its corresponding type declarations.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="792" column="6" code="2503">Cannot find namespace 'EnvironmentContext'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="792" column="40" code="2365">Operator '&gt;' cannot be applied to types '{ value: EnvironmentContextType; }' and '{ children: React.ReactNode; }'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="792" column="40" code="2365">Operator '&lt;' cannot be applied to types 'boolean' and 'RegExp'.</problem>
<problem file="src/components/BottomNavigationBar.tsx" line="31" column="11" code="2339">Property 'addScheduledTask' does not exist on type 'void'.</problem>
<problem file="src/components/ScheduledTaskDetailDialog.tsx" line="89" column="11" code="2339">Property 'updateScheduledTaskDetails' does not exist on type 'void'.</problem>
<problem file="src/components/SchedulerDisplay.tsx" line="47" column="11" code="2339">Property 'toggleScheduledTaskLock' does not exist on type 'void'.</problem>
<problem file="src/components/CreateTaskDialog.tsx" line="90" column="11" code="2339">Property 'addScheduledTask' does not exist on type 'void'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="62" column="5" code="2339">Property 'dbScheduledTasks' does not exist on type 'void'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="63" column="5" code="2339">Property 'isLoading' does not exist on type 'void'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="64" column="5" code="2339">Property 'addScheduledTask' does not exist on type 'void'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="65" column="5" code="2339">Property 'removeScheduledTask' does not exist on type 'void'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="66" column="5" code="2339">Property 'clearScheduledTasks' does not exist on type 'void'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="67" column="5" code="2339">Property 'datesWithTasks' does not exist on type 'void'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="68" column="5" code="2339">Property 'isLoadingDatesWithTasks' does not exist on type 'void'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="69" column="5" code="2339">Property 'retireTask' does not exist on type 'void'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="70" column="5" code="2339">Property 'compactScheduledTasks' does not exist on type 'void'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="71" column="5" code="2339">Property 'randomizeBreaks' does not exist on type 'void'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="72" column="5" code="2339">Property 'aetherDump' does not exist on type 'void'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="73" column="5" code="2339">Property 'aetherDumpMega' does not exist on type 'void'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="74" column="5" code="2339">Property 'sortBy' does not exist on type 'void'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="75" column="5" code="2339">Property 'setSortBy' does not exist on type 'void'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="76" column="5" code="2339">Property 'completeScheduledTask' does not exist on type 'void'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="77" column="5" code="2339">Property 'handleAutoScheduleAndSort' does not exist on type 'void'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="78" column="5" code="2339">Property 'toggleAllScheduledTasksLock' does not exist on type 'void'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="79" column="5" code="2339">Property 'isLoadingCompletedTasksForSelectedDay' does not exist on type 'void'.</problem>
<problem file="src/components/EnvironmentProvider.tsx" line="5" column="30" code="2724">'&quot;@/hooks/use-environment-context&quot;' has no exported member named 'environmentOptions'. Did you mean 'EnvironmentOption'?</problem>
<problem file="src/components/EnvironmentProvider.tsx" line="46" column="5" code="2353">Object literal may only specify known properties, and 'environmentOptions' does not exist in type 'EnvironmentContextType'.</problem>
<problem file="src/components/WeeklyScheduleGrid.tsx" line="74" column="11" code="2339">Property 'completeScheduledTask' does not exist on type 'void'.</problem>
<problem file="src/pages/WellnessPage.tsx" line="20" column="10" code="2724">'&quot;@/hooks/use-environment-context&quot;' has no exported member named 'environmentOptions'. Did you mean 'EnvironmentOption'?</problem>
<problem file="src/pages/WellnessPage.tsx" line="56" column="11" code="2339">Property 'dbScheduledTasks' does not exist on type 'void'.</problem>
<problem file="src/pages/WellnessPage.tsx" line="56" column="29" code="2339">Property 'isLoading' does not exist on type 'void'.</problem>
<problem file="src/components/RetiredTaskDetailSheet.tsx" line="4" column="25" code="2307">Cannot find module '@hookform/react-hook-form' or its corresponding type declarations.</problem>
<problem file="src/components/SortableTaskCard.tsx" line="55" column="11" code="2339">Property 'addScheduledTask' does not exist on type 'void'.</problem>
<problem file="src/pages/AetherSinkPage.tsx" line="34" column="5" code="2339">Property 'addScheduledTask' does not exist on type 'void'.</problem>
<problem file="src/pages/AetherSinkPage.tsx" line="35" column="5" code="2339">Property 'handleAutoScheduleAndSort' does not exist on type 'void'.</problem>
<problem file="src/pages/AetherSinkPage.tsx" line="36" column="5" code="2339">Property 'sortBy' does not exist on type 'void'.</problem>
<problem file="src/components/TaskDetailSheetForTasks.tsx" line="4" column="25" code="2307">Cannot find module '@hookform/react-hook-form' or its corresponding type declarations.</problem>
</dyad-problem-report>You're encountering a cascade of errors, primarily stemming from two main issues:

1.  **Incorrect `useForm` import**: You're importing `useForm` from `@hookform/react-hook-form` which is incorrect. It should be from `react-hook-form`. This is causing a lot of "Cannot find module" errors.
2.  **`useSchedulerTasks` return type**: The `useSchedulerTasks` hook is currently returning `void` in its type definition, but it's actually intended to return an object with various functions and data. This is causing many "Property 'X' does not exist on type 'void'" errors.

I will fix these issues by:

1.  **Correcting `useForm` imports**: I'll change all instances of `import { useForm } from '@hookform/react-hook-form';` to `import { useForm } from 'react-hook-form';`.
2.  **Updating `useSchedulerTasks` return type**: I'll modify the `useSchedulerTasks` hook to correctly return an object containing all the properties it's supposed to provide.
3.  **Fixing `EnvironmentContext.Provider`**: I'll ensure the `EnvironmentContext.Provider` is correctly closed in `src/hooks/use-environment-context.ts`.
4.  **Removing extraneous code**: I'll remove the problematic, malformed code snippets that appear to be remnants of previous error reports within `src/hooks/use-scheduler-tasks.ts`.

These changes will address all 822 compile-time errors.

<dyad-write path="src/hooks/use-environment-context.ts" description="Correcting the closing tag for EnvironmentContext.Provider.">
"use client";

import { useState, useEffect, useMemo, useContext, createContext } from 'react';
import { TaskEnvironment } from '@/types/scheduler';
import { Environment, useEnvironments } from './use-environments'; // Import Environment and useEnvironments
import { Loader2 } from 'lucide-react'; // Import Loader2 for loading state

export interface EnvironmentOption {
  value: TaskEnvironment;
  label: string;
  icon: string;
}

// Removed hardcoded environmentOptions

export interface EnvironmentContextType {
  selectedEnvironments: TaskEnvironment[];
  toggleEnvironmentSelection: (env: TaskEnvironment) => void;
  setSelectedEnvironments: (envs: TaskEnvironment[]) => void;
  allUserEnvironments: Environment[]; // Now dynamic
  isLoadingEnvironments: boolean; // Add loading state
}

export const EnvironmentContext = createContext<EnvironmentContextType | undefined>(undefined);

export const useEnvironmentContext = () => {
  const context = useContext(EnvironmentContext);
  if (context === undefined) {
    throw new Error('useEnvironmentContext must be used within an EnvironmentProvider');
  }
  return context;
};

// The EnvironmentProvider component
const EnvironmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { environments: allUserEnvironments, isLoading: isLoadingEnvironments } = useEnvironments(); // Fetch environments dynamically

  const [selectedEnvironments, setSelectedEnvironments] = useState<TaskEnvironment[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedEnv = localStorage.getItem('aetherflow-environments');
        if (savedEnv) {
          const parsed = JSON.parse(savedEnv);
          // Basic validation to ensure it's an array of strings
          if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
            return parsed as TaskEnvironment[];
          }
        }
      } catch (e) {
        // console.error("Failed to parse stored environments:", e);
      }
    }
    return []; // Default to NO environment selected
  });

  // Filter out any selected environments that no longer exist in allUserEnvironments
  // This ensures consistency if environments are deleted by the user
  useEffect(() => {
    if (!isLoadingEnvironments && allUserEnvironments.length > 0) {
      const validEnvironmentValues = allUserEnvironments.map(env => env.value);
      setSelectedEnvironments(prev => prev.filter(env => validEnvironmentValues.includes(env)));
    }
  }, [allUserEnvironments, isLoadingEnvironments]);


  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('aetherflow-environments', JSON.stringify(selectedEnvironments));
    }
  }, [selectedEnvironments]);

  const toggleEnvironmentSelection = (env: TaskEnvironment) => {
    setSelectedEnvironments(prev => {
      if (prev.includes(env)) {
        return prev.filter(e => e !== env);
      } else {
        return [...prev, env];
      }
    });
  };

  const value: EnvironmentContextType = {
    selectedEnvironments,
    toggleEnvironmentSelection,
    setSelectedEnvironments,
    allUserEnvironments, // Provide dynamic environments
    isLoadingEnvironments, // Provide loading state
  };

  return (
    <EnvironmentContext.Provider value={value}>
      {children}
    </EnvironmentContext.Provider>
  );
};

export default EnvironmentProvider;