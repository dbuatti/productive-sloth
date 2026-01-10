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
import { useEnvironmentContext } from '@/hooks/use-environment-context';
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
  
  const { environmentOptions } = useEnvironmentContext();

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
      environment: environmentOptions.find(o => o.value === envVal)?.label || envVal, minutes
    })).sort((a, b) => b.minutes - a.minutes);
  }, [weeklyTasks, environmentOptions]);

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
    return { environment: environmentOptions.find(o => o.value === bestEnv)?.label || bestEnv, tasksCompleted: maxCount };
  }, [last7DaysData, environmentOptions]);

  const mostEffectiveBreakEnvironment = useMemo(() => {
    if (!last7DaysData) return null;
    const envCounts = new Map<string, number>();
    last7DaysData.forEach(day => day.completedBreakEnvironments.forEach(env => envCounts.set(env.environment, (envCounts.get(env.environment) || 0) + env.count)));
    let bestEnv = '';
    let maxCount = 0;
    envCounts.forEach((count, env) => { if (count > maxCount) { maxCount = count; bestEnv = env; } });
    if (!bestEnv) return null;
    return { environment: environmentOptions.find(o => o.value === bestEnv)?.label || bestEnv, breaksCompleted: maxCount };
  }, [last7DaysData, environmentOptions]);

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
            <div className={cn("text-2xl font-bold", burnoutRisk === 'High' ? 'text-destructive' : burnoutRisk === 'Medium' ? 'text-logo-orange' : 'text-logo-green')}>
              {burnoutRisk}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Based on recent workload</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 p-4">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-lg font-bold">Daily Workload (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={last7DaysData || []} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="dayName" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" label={{ value: 'Minutes', angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }}
                  formatter={(value: number, name: string) => [`${value} min`, name === 'totalWorkMinutes' ? 'Work' : 'Break']}
                />
                <Legend />
                <ReferenceLine y={MAX_DAILY_MINUTES} stroke="hsl(var(--destructive))" strokeDasharray="3 3" label={{ value: 'Limit', position: 'top', fill: 'hsl(var(--destructive))' }} />
                <ReferenceLine y={WARNING_THRESHOLD} stroke="hsl(var(--logo-orange))" strokeDasharray="3 3" label={{ value: 'Warning', position: 'top', fill: 'hsl(var(--logo-orange))' }} />
                <Bar dataKey="totalWorkMinutes" stackId="a" fill="hsl(var(--primary))" name="Work" />
                <Bar dataKey="totalBreakMinutes" stackId="a" fill="hsl(var(--logo-orange))" name="Break" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="p-4">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-lg font-bold">Work vs. Personal Time</CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-[300px] flex items-center justify-center">
            {workPersonalDistribution && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={workPersonalDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {workPersonalDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[entry.name as keyof typeof PIE_COLORS] || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }}
                    formatter={(value: number, name: string) => [`${value} min`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="p-4">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-lg font-bold">Daily Energy Balance (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyEnergyBalanceData || []} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorEnergy" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--logo-green))" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0.8}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="dayName" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" label={{ value: 'Net Energy', angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }}
                  formatter={(value: number) => [`${value}⚡`, 'Net Energy']}
                />
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                <Area 
                  type="monotone" 
                  dataKey="netEnergy"
                  stroke="hsl(var(--primary))" 
                  fillOpacity={1} 
                  fill="url(#colorEnergy)" 
                  name="Net Energy"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="p-4">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-lg font-bold">Workload by Priority</CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-[300px] flex items-center justify-center">
            {workloadByPriorityData && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={workloadByPriorityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {workloadByPriorityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[entry.name as keyof typeof PIE_COLORS] || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }}
                    formatter={(value: number, name: string) => [`${value} tasks`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <Card className="p-4">
          <CardHeader className="p-0 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Flexible Tasks in Queue</CardTitle>
            <ListTodo className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-2xl font-bold text-foreground">
              {totalFlexibleTaskMinutes} min
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              ~{daysWorthOfTasks} days of work
            </div>
          </CardContent>
        </Card>

        <Card className="p-4">
          <CardHeader className="p-0 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Peak Productivity</CardTitle>
            <Clock className="h-4 w-4 text-logo-yellow" />
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-2xl font-bold text-foreground">
              {peakProductivityTime ? `${peakProductivityTime.hour}:00 (${peakProductivityTime.period})` : 'N/A'}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {peakProductivityTime ? `${peakProductivityTime.tasksCompleted} tasks completed` : 'No data'}
            </div>
          </CardContent>
        </Card>

        <Card className="p-4">
          <CardHeader className="p-0 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Most Effective Work Zone</CardTitle>
            <Briefcase className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-2xl font-bold text-foreground">
              {mostEffectiveWorkEnvironment?.environment || 'N/A'}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {mostEffectiveWorkEnvironment ? `${mostEffectiveWorkEnvironment.tasksCompleted} tasks completed` : 'No data'}
            </div>
          </CardContent>
        </Card>

        <Card className="p-4">
          <CardHeader className="p-0 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Most Effective Break Zone</CardTitle>
            <Coffee className="h-4 w-4 text-logo-orange" />
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-2xl font-bold text-foreground">
              {mostEffectiveBreakEnvironment?.environment || 'N/A'}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {mostEffectiveBreakEnvironment ? `${mostEffectiveBreakEnvironment.breaksCompleted} breaks taken` : 'No data'}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="p-4">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-primary" /> AI Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="space-y-3">
              {recommendations.map((rec, index) => (
                <li key={index} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30 border border-white/5">
                  <span className="text-primary mt-1">•</span>
                  <span className="text-sm text-foreground">{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/20">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-primary">
              <Moon className="h-5 w-5" /> Recommended Day Off
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  checked={skipWeekends}
                  onCheckedChange={setSkipWeekends}
                  id="skip-weekends"
                />
                <label htmlFor="skip-weekends" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Skip Weekends
                </label>
              </div>
              {suggestedDayOff && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleSkipDayOffSuggestion}
                  className="text-muted-foreground hover:text-primary"
                >
                  <SkipForward className="h-4 w-4 mr-1" /> Skip Suggestion
                </Button>
              )}
            </div>
            {suggestedDayOff ? (
              <>
                <p className="text-sm text-foreground">
                  Based on your upcoming workload, we recommend scheduling a day off on <span className="font-bold text-primary">{format(parseISO(suggestedDayOff), 'EEEE, MMMM do')}</span>.
                </p>
                <Button onClick={() => {
                  navigate('/settings');
                }}>
                  Block This Day
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Keep scheduling tasks to get a personalized day-off recommendation.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WellnessPage;