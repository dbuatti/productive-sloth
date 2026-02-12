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
import { AlertTriangle, Coffee, CalendarOff, TrendingUp, Activity, Zap, Moon, Sun, AlertCircle, ListTodo, Briefcase, CalendarDays, Flame, Clock, Home, Laptop, Globe, Music, Target, SkipForward, ShieldAlert } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { useEnvironmentContext } from '@/hooks/use-environment-context';
import { TaskPriority } from '@/types';
import { isMeal } from '@/lib/scheduler-utils';
import { showSuccess } from '@/utils/toast';

const MAX_DAILY_MINUTES = 8 * 60;
const WARNING_THRESHOLD = 6 * 60;
const RECOMMENDED_BREAK_RATIO = 0.2;

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

  const burnoutRisk = useMemo(() => {
    if (!last7DaysData || !future7DaysData) return 'Low';
    let riskScore = 0;
    if (last7DaysData.filter(d => d.isOverwork).length > 0) riskScore += 3;
    if (last7DaysData.filter(d => d.isWarning).length > 2) riskScore += 2;
    if (future7DaysData.slice(1, 4).reduce((sum, d) => d.totalWorkMinutes > MAX_DAILY_MINUTES ? sum + 2 : (d.totalWorkMinutes > WARNING_THRESHOLD ? sum + 1 : sum), 0) >= 2) riskScore += 2;
    return riskScore >= 5 ? 'High' : riskScore >= 2 ? 'Medium' : 'Low';
  }, [last7DaysData, future7DaysData]);

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

  const recommendations = useMemo(() => {
    if (!last7DaysData || !future7DaysData) return [];
    const recs: string[] = [];
    if (last7DaysData.filter(d => d.isOverwork).length > 0) recs.push("You overworked recently. Consider a recovery day.");
    if (peakProductivityTime) recs.push(`You're most productive at ${peakProductivityTime.hour}:00. Schedule deep work then.`);
    if (mostEffectiveWorkEnvironment) recs.push(`Your most effective work environment is ${mostEffectiveWorkEnvironment.environment}. Try to utilize it more.`);
    if (burnoutRisk === 'High') recs.push("High burnout risk detected! Prioritize rest and reduce workload.");
    if (burnoutRisk === 'Medium') recs.push("Moderate burnout risk. Ensure you're taking enough breaks.");
    if (recs.length === 0) recs.push("Your balance looks great! Keep up the good work.");
    return recs;
  }, [last7DaysData, future7DaysData, peakProductivityTime, mostEffectiveWorkEnvironment, burnoutRisk]);

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
    if (!suggestedDayOff) return;
    await updateSkippedDayOffSuggestions(suggestedDayOff, true);
    showSuccess("Suggestion skipped. We'll find another day.");
  }, [suggestedDayOff, updateSkippedDayOffSuggestions]);

  if (!user) return <div className="p-8 text-center"><Button onClick={() => navigate('/login')}>Login</Button></div>;
  if (isLoading) return <div className="p-8 space-y-8"><Skeleton className="h-10 w-full" /><div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div></div>;

  const PIE_COLORS = { 
    Work: 'hsl(var(--primary))', 
    Break: 'hsl(var(--logo-orange))', 
    Personal: 'hsl(var(--logo-green))',
  };

  return (
    <div className="space-y-8 animate-slide-in-up pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-3">
            <Activity className="h-8 w-8 text-primary" /> Wellness & Balance
          </h1>
          <p className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest mt-1">Temporal Health Matrix • Burnout Prevention</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/scheduler')} className="rounded-xl font-black uppercase tracking-widest text-[10px]">Back to Scheduler</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className={cn(
          "p-4 rounded-2xl border-none shadow-lg transition-all duration-500",
          burnoutRisk === 'High' ? "bg-destructive/10 ring-1 ring-destructive/30" : (burnoutRisk === 'Medium' ? "bg-logo-orange/10 ring-1 ring-logo-orange/30" : "bg-card/40")
        )}>
          <CardHeader className="p-0 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Burnout Risk</CardTitle>
            <ShieldAlert className={cn("h-4 w-4", burnoutRisk === 'High' ? 'text-destructive animate-pulse' : burnoutRisk === 'Medium' ? 'text-logo-orange' : 'text-logo-green')} />
          </CardHeader>
          <CardContent className="p-0">
            <div className={cn("text-3xl font-black uppercase tracking-tighter", burnoutRisk === 'High' ? "text-destructive" : burnoutRisk === 'Medium' ? "text-logo-orange" : "text-logo-green")}>
              {burnoutRisk}
            </div>
            <p className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest mt-1">Based on 14-day projection</p>
          </CardContent>
        </Card>

        <Card className="p-4 bg-card/40 rounded-2xl border-none shadow-lg">
          <CardHeader className="p-0 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Avg. Daily Work</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-3xl font-black font-mono tracking-tighter">
              {Math.round(last7DaysData?.reduce((sum, d) => sum + d.totalWorkMinutes, 0) / 7 / 60)}h
            </div>
            <p className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest mt-1">Target: {Math.round(MAX_DAILY_MINUTES / 60)}h</p>
          </CardContent>
        </Card>

        <Card className="p-4 bg-card/40 rounded-2xl border-none shadow-lg">
          <CardHeader className="p-0 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Break Ratio</CardTitle>
            <Coffee className="h-4 w-4 text-logo-orange" />
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-3xl font-black font-mono tracking-tighter">
              {Math.round((workloadDistribution?.[1]?.value || 0) / (workloadDistribution?.reduce((a, b) => a + b.value, 0) || 1) * 100)}%
            </div>
            <p className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest mt-1">Target: {RECOMMENDED_BREAK_RATIO * 100}%</p>
          </CardContent>
        </Card>

        <Card className="p-4 bg-card/40 rounded-2xl border-none shadow-lg">
          <CardHeader className="p-0 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Peak Focus</CardTitle>
            <Clock className="h-4 w-4 text-logo-yellow" />
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-3xl font-black uppercase tracking-tighter">
              {peakProductivityTime ? `${peakProductivityTime.hour}:00` : 'N/A'}
            </div>
            <p className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest mt-1">{peakProductivityTime?.period || 'No data'}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 p-6 bg-card/40 rounded-3xl border-none shadow-xl">
          <CardHeader className="p-0 pb-6">
            <CardTitle className="text-lg font-black uppercase tracking-tighter text-foreground/70">Workload Projection (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={last7DaysData || []} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="dayName" stroke="hsl(var(--muted-foreground))" axisLine={false} tickLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: 'none', borderRadius: '1rem', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="totalWorkMinutes" stackId="a" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Work" />
                <Bar dataKey="totalBreakMinutes" stackId="a" fill="hsl(var(--logo-orange))" radius={[4, 4, 0, 0]} name="Break" />
                <ReferenceLine y={MAX_DAILY_MINUTES} stroke="hsl(var(--destructive))" strokeDasharray="5 5" label={{ value: 'Limit', position: 'top', fill: 'hsl(var(--destructive))', fontSize: 10, fontWeight: 'bold' }} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="p-6 bg-card/40 rounded-3xl border-none shadow-xl">
          <CardHeader className="p-0 pb-6">
            <CardTitle className="text-lg font-black uppercase tracking-tighter text-foreground/70">Time Allocation</CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-[300px] flex items-center justify-center">
            {workPersonalDistribution && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={workPersonalDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={8} dataKey="value" stroke="none">
                    {workPersonalDistribution.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[entry.name as keyof typeof PIE_COLORS]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="p-6 bg-card/40 rounded-3xl border-none shadow-xl">
          <CardHeader className="p-0 pb-6">
            <CardTitle className="text-lg font-black uppercase tracking-tighter text-foreground/70 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-primary" /> AI Wellness Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="space-y-3">
              {recommendations.map((rec, index) => (
                <li key={index} className="flex items-start gap-4 p-4 rounded-2xl bg-secondary/20 border border-white/5 transition-all hover:bg-secondary/30">
                  <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <span className="text-sm font-bold text-foreground/80 leading-relaxed">{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="p-6 bg-secondary/10 rounded-3xl border-none shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10"><Moon className="h-24 w-24" /></div>
          <CardHeader className="p-0 pb-6">
            <CardTitle className="text-lg font-black uppercase tracking-tighter text-primary flex items-center gap-2">
              <Moon className="h-5 w-5" /> Recommended Recovery Day
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-6 relative z-10">
            {suggestedDayOff ? (
              <>
                <p className="text-sm font-bold text-foreground/70 leading-relaxed">
                  Based on your upcoming workload density, we recommend scheduling a full recovery day on <span className="text-primary font-black">{format(parseISO(suggestedDayOff), 'EEEE, MMMM do')}</span>.
                </p>
                <div className="flex items-center gap-4">
                  <Button onClick={() => navigate('/settings')} className="rounded-xl font-black uppercase tracking-widest text-[10px] h-10 px-6">Block This Day</Button>
                  <Button variant="ghost" size="sm" onClick={handleSkipDayOffSuggestion} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 hover:text-primary">Skip Suggestion</Button>
                </div>
              </>
            ) : (
              <p className="text-sm font-bold text-muted-foreground/40 uppercase tracking-widest">Timeline optimized. No recovery days required.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WellnessPage;