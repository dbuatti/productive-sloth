import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { useSession } from '@/hooks/use-session';
import { useTasks } from '@/hooks/use-tasks';
import { useRetiredTasks } from '@/hooks/use-retired-tasks';
import { useWeeklySchedulerTasks } from '@/hooks/use-weekly-scheduler-tasks';
import { useCompletedTasksAnalytics } from '@/hooks/use-completed-tasks-analytics';
import { Loader2, TrendingUp, CheckCircle, Sparkles, Zap, ListTodo, CalendarOff, Clock, Home, Laptop, Globe, Music, Archive, Star, Briefcase, Coffee } from 'lucide-react';
import { format, parseISO, startOfDay, subDays, addDays, differenceInMinutes } from 'date-fns';
import { XP_PER_LEVEL } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useEnvironmentContext } from '@/hooks/use-environment-context';
import { cn } from '@/lib/utils';

const AnalyticsPage: React.FC = () => {
  const { isLoading: isSessionLoading, user, profile } = useSession();
  const { isLoading: isTasksLoading } = useTasks();
  const { retiredTasks, isLoadingRetiredTasks } = useRetiredTasks();
  const { weeklyTasks, isLoading: isWeeklySchedulerTasksLoading } = useWeeklySchedulerTasks(format(new Date(), 'yyyy-MM-dd'));
  const { 
    dailySummary, 
    priorityDistribution, 
    totalCompletedTasks, 
    totalXpEarned, 
    totalEnergyConsumed, 
    totalEnergyGained, 
    isLoading: isLoadingCompletedTasksAnalytics 
  } = useCompletedTasksAnalytics(7);
  
  const { environmentOptions } = useEnvironmentContext();

  const navigate = useNavigate();

  const isLoading = isSessionLoading || isTasksLoading || isLoadingRetiredTasks || isWeeklySchedulerTasksLoading || isLoadingCompletedTasksAnalytics;

  // --- Future Workload Projection ---
  const futureWorkloadData = useMemo(() => {
    if (!weeklyTasks) return [];
    const dataMap = new Map<string, { date: string, workMinutes: number, breakMinutes: number }>();
    const next7Days = Array.from({ length: 7 }).map((_, i) => addDays(startOfDay(new Date()), i));

    next7Days.forEach(date => {
      const key = format(date, 'yyyy-MM-dd');
      dataMap.set(key, { date: format(date, 'MMM d'), workMinutes: 0, breakMinutes: 0 });
    });

    Object.values(weeklyTasks).flat().forEach(task => {
      if (!task.start_time || !task.end_time || task.is_completed) return;
      const taskDate = startOfDay(parseISO(task.scheduled_date));
      const key = format(taskDate, 'yyyy-MM-dd');

      if (dataMap.has(key)) {
        const entry = dataMap.get(key)!;
        const duration = differenceInMinutes(parseISO(task.end_time), parseISO(task.start_time));
        if (task.is_break) {
          entry.breakMinutes += duration;
        } else {
          entry.workMinutes += duration;
        }
      }
    });

    return Array.from(dataMap.values()).sort((a, b) => {
      const dateA = parseISO(a.date);
      const dateB = parseISO(b.date);
      return dateA.getTime() - dateB.getTime();
    });
  }, [weeklyTasks]);

  // --- Aether Sink Analytics ---
  const sinkPriorityDistribution = useMemo(() => {
    if (!retiredTasks) return [];
    const priorityCounts = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    retiredTasks.forEach(task => {
      if (task.is_critical) priorityCounts.HIGH++;
      else if (task.is_backburner) priorityCounts.LOW++;
      else priorityCounts.MEDIUM++;
    });
    return Object.entries(priorityCounts).map(([name, value]) => ({ name, value })).filter(item => item.value > 0);
  }, [retiredTasks]);

  const sinkEnvironmentDistribution = useMemo(() => {
    if (!retiredTasks) return [];
    const envCounts = new Map<string, number>();
    retiredTasks.forEach(task => {
      const env = task.task_environment || 'laptop';
      envCounts.set(env, (envCounts.get(env) || 0) + 1);
    });
    return Array.from(envCounts.entries()).map(([environment, count]) => ({
      name: environmentOptions.find(o => o.value === environment)?.label || environment,
      value: count,
    })).filter(item => item.value > 0);
  }, [retiredTasks, environmentOptions]);

  const totalSinkTasks = retiredTasks.length;
  const totalSinkDuration = retiredTasks.reduce((sum, task) => sum + (task.duration || 0), 0);
  const avgSinkDuration = totalSinkTasks > 0 ? Math.round(totalSinkDuration / totalSinkTasks) : 0;

  if (!user || !profile) {
    return null;
  }

  if (isLoading && !dailySummary.length && !retiredTasks.length && !Object.keys(weeklyTasks).length) {
    return (
      <div className="space-y-8 animate-slide-in-up p-8">
        <Skeleton className="h-8 w-64 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-4 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-3 w-40" />
            </Card>
          ))}
        </div>
        <Card className="p-4 space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-[300px] w-full" />
        </Card>
        <Card className="p-4 space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-[300px] w-full" />
        </Card>
        <Card className="p-4 space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-[300px] w-full" />
        </Card>
      </div>
    );
  }

  if (totalCompletedTasks === 0 && totalSinkTasks === 0 && futureWorkloadData.every(d => d.workMinutes === 0 && d.breakMinutes === 0)) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-4">
        <CalendarOff className="h-12 w-12 text-muted-foreground opacity-50" />
        <h2 className="text-xl font-bold">No Data Yet</h2>
        <p className="text-muted-foreground max-w-md">
          Start completing tasks, scheduling your day, or adding items to your Aether Sink to unlock your analytics and track your progress!
        </p>
        <Button onClick={() => navigate('/scheduler')}>Go to Scheduler</Button>
      </div>
    );
  }

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--logo-orange))', 'hsl(var(--logo-green))', 'hsl(var(--accent))', 'hsl(var(--destructive))'];
  const PIE_COLORS = { 
    HIGH: 'hsl(var(--destructive))', 
    MEDIUM: 'hsl(var(--logo-orange))', 
    LOW: 'hsl(var(--logo-green))',
    home: 'hsl(var(--logo-green))',
    laptop: 'hsl(var(--primary))',
    away: 'hsl(var(--accent))',
    piano: 'hsl(var(--logo-orange))',
    laptop_piano: 'hsl(var(--logo-yellow))',
  };

  return (
    <div className="space-y-8 animate-slide-in-up pb-12">
      <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
        <TrendingUp className="h-7 w-7 text-primary" /> Gamification Analytics
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-card rounded-xl shadow-sm animate-pop-in animate-hover-lift">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-0">
            <p className="text-sm font-medium">Current Level</p>
            <Sparkles className="h-4 w-4 text-logo-yellow" />
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-xl font-bold">{profile.level}</div>
            <p className="text-xs text-muted-foreground">
              {XP_PER_LEVEL - (profile.xp % XP_PER_LEVEL)} XP to Level {profile.level + 1}
            </p>
          </CardContent>
        </Card>
        <Card className="p-4 bg-card rounded-xl shadow-sm animate-pop-in animate-hover-lift" style={{ animationDelay: '0.1s' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-0">
            <p className="text-sm font-medium">Total XP</p>
            <Sparkles className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-xl font-bold">{totalXpEarned}</div>
            <p className="text-xs text-muted-foreground">
              Lifetime experience points earned
            </p>
          </CardContent>
        </Card>
        <Card className="p-4 bg-card rounded-xl shadow-sm animate-pop-in animate-hover-lift" style={{ animationDelay: '0.2s' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-0">
            <p className="text-sm font-medium">Daily Streak</p>
            <CheckCircle className="h-4 w-4 text-logo-green" />
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-xl font-bold">{profile.daily_streak} Days</div>
            <p className="text-xs text-muted-foreground">
              Consecutive days completing tasks
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="p-4 bg-card rounded-xl shadow-sm animate-slide-in-up animate-hover-lift" style={{ animationDelay: '0.3s' }}>
        <CardHeader className="px-0 pb-4">
          <CardTitle className="text-lg">Tasks Completed Trend (Last 7 Days)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailySummary} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTasks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--logo-yellow))" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="hsl(var(--logo-yellow))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))', 
                    borderRadius: 'var(--radius)' 
                  }}
                  formatter={(value: number) => [`${value} tasks`, 'Completed']}
                />
                <Area 
                  type="monotone" 
                  dataKey="tasksCompleted"
                  stroke="hsl(var(--logo-yellow))" 
                  fillOpacity={1} 
                  fill="url(#colorTasks)" 
                  name="Tasks Completed"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="p-4 bg-card rounded-xl shadow-sm animate-slide-in-up animate-hover-lift" style={{ animationDelay: '0.4s' }}>
        <CardHeader className="px-0 pb-4">
          <CardTitle className="text-lg">XP Gain Trend (Last 7 Days)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailySummary} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))', 
                    borderRadius: 'var(--radius)' 
                  }}
                  formatter={(value: number) => [`${value} XP`, 'XP Gained']}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="xpGained" 
                  stroke="hsl(var(--primary))" 
                  activeDot={{ r: 8 }} 
                  name="XP Gained"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="p-4 bg-card rounded-xl shadow-sm animate-slide-in-up animate-hover-lift" style={{ animationDelay: '0.5s' }}>
        <CardHeader className="px-0 pb-4">
          <CardTitle className="text-lg">Energy Balance (Last 7 Days)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailySummary} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))', 
                    borderRadius: 'var(--radius)' 
                  }}
                  formatter={(value: number, name: string) => [`${value}⚡`, name === 'energyConsumed' ? 'Consumed' : 'Gained']}
                />
                <Legend />
                <Bar dataKey="energyConsumed" fill="hsl(var(--destructive))" name="Energy Consumed" radius={[4, 4, 0, 0]} />
                <Bar dataKey="energyGained" fill="hsl(var(--logo-green))" name="Energy Gained" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="p-4 bg-card rounded-xl shadow-sm animate-slide-in-up animate-hover-lift" style={{ animationDelay: '0.6s' }}>
        <CardHeader className="px-0 pb-4">
          <CardTitle className="text-lg">Task Priority Distribution (Completed)</CardTitle>
        </CardHeader>
        <CardContent className="p-0 h-[300px] flex items-center justify-center">
          {priorityDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={priorityDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {priorityDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[entry.name as keyof typeof PIE_COLORS] || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }}
                  formatter={(value: number, name: string) => [`${value} tasks`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-muted-foreground text-center">No completed tasks with priority data.</div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Workload Projection */}
      <Card className="p-4 bg-card rounded-xl shadow-sm animate-slide-in-up animate-hover-lift" style={{ animationDelay: '0.7s' }}>
        <CardHeader className="px-0 pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" /> Upcoming Workload (Next 7 Days)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {futureWorkloadData.some(d => d.workMinutes > 0 || d.breakMinutes > 0) ? (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={futureWorkloadData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" label={{ value: 'Minutes', angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }}
                    formatter={(value: number, name: string) => [`${value} min`, name === 'workMinutes' ? 'Work' : 'Break']}
                  />
                  <Legend />
                  <Bar dataKey="workMinutes" stackId="a" fill="hsl(var(--primary))" name="Work" />
                  <Bar dataKey="breakMinutes" stackId="a" fill="hsl(var(--logo-orange))" name="Break" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-muted-foreground text-center py-8">No upcoming scheduled tasks.</div>
          )}
        </CardContent>
      </Card>

      {/* Aether Sink Overview */}
      <Card className="p-4 bg-card rounded-xl shadow-sm animate-slide-in-up animate-hover-lift" style={{ animationDelay: '0.8s' }}>
        <CardHeader className="px-0 pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Archive className="h-5 w-5 text-muted-foreground" /> Aether Sink Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {totalSinkTasks > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col items-center justify-center p-4 bg-secondary/50 rounded-xl border border-white/5">
                <p className="text-sm text-muted-foreground">Total Tasks</p>
                <p className="text-2xl font-bold text-foreground">{totalSinkTasks}</p>
              </div>
              <div className="flex flex-col items-center justify-center p-4 bg-secondary/50 rounded-xl border border-white/5">
                <p className="text-sm text-muted-foreground">Total Duration</p>
                <p className="text-2xl font-bold text-foreground">{totalSinkDuration} min</p>
              </div>
              <div className="flex flex-col items-center justify-center p-4 bg-secondary/50 rounded-xl border border-white/5">
                <p className="text-sm text-muted-foreground">Avg. Duration</p>
                <p className="text-2xl font-bold text-foreground">{avgSinkDuration} min</p>
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground text-center py-8">No tasks in Aether Sink.</div>
          )}
        </CardContent>
      </Card>

      {/* Aether Sink Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="p-4 bg-card rounded-xl shadow-sm animate-slide-in-up animate-hover-lift" style={{ animationDelay: '0.9s' }}>
          <CardHeader className="px-0 pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Star className="h-5 w-5 text-logo-yellow" /> Sink Priority Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-[300px] flex items-center justify-center">
            {sinkPriorityDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sinkPriorityDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {sinkPriorityDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[entry.name as keyof typeof PIE_COLORS] || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }}
                    formatter={(value: number, name: string) => [`${value} tasks`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-muted-foreground text-center">No tasks in Sink with priority data.</div>
            )}
          </CardContent>
        </Card>

        <Card className="p-4 bg-card rounded-xl shadow-sm animate-slide-in-up animate-hover-lift" style={{ animationDelay: '1.0s' }}>
          <CardHeader className="px-0 pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Home className="h-5 w-5 text-primary" /> Sink Environment Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-[300px] flex items-center justify-center">
            {sinkEnvironmentDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sinkEnvironmentDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {sinkEnvironmentDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[entry.name as keyof typeof PIE_COLORS] || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }}
                    formatter={(value: number, name: string) => [`${value} tasks`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-muted-foreground text-center">No tasks in Sink with environment data.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AnalyticsPage;