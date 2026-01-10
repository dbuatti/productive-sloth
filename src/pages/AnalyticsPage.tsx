import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { useSession } from '@/hooks/use-session';
import { useTasks } from '@/hooks/use-tasks';
import { Loader2, TrendingUp, CheckCircle, Sparkles, Zap, ListTodo, CalendarOff } from 'lucide-react';
import { format, parseISO, startOfDay, subDays, addDays } from 'date-fns';
import { XP_PER_LEVEL } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const generateDateRange = (days: number) => {
  const dates: Date[] = [];
  for (let i = days - 1; i >= 0; i--) {
    dates.push(subDays(startOfDay(new Date()), i));
  }
  return dates;
};

const AnalyticsPage: React.FC = () => {
  const { isLoading: isSessionLoading, user, profile } = useSession();
  const { allTasks, isLoading: isTasksLoading } = useTasks();
  const navigate = useNavigate();

  const chartData = useMemo(() => {
    if (!allTasks || !profile) return [];

    const last7Days = generateDateRange(7);
    const dataMap = new Map<string, { date: string, tasksCompleted: number, xpGained: number, energyConsumed: number, energyGained: number }>();

    last7Days.forEach(date => {
      const key = format(date, 'yyyy-MM-dd');
      dataMap.set(key, { date: format(date, 'MMM d'), tasksCompleted: 0, xpGained: 0, energyConsumed: 0, energyGained: 0 });
    });

    allTasks.forEach(task => {
      if (task.is_completed) {
        const completionDate = startOfDay(parseISO(task.created_at));
        const key = format(completionDate, 'yyyy-MM-dd');

        if (dataMap.has(key)) {
          const entry = dataMap.get(key)!;
          entry.tasksCompleted += 1;
          entry.xpGained += task.metadata_xp;
          if (task.energy_cost > 0) {
            entry.energyConsumed += task.energy_cost;
          } else {
            entry.energyGained += Math.abs(task.energy_cost);
          }
        }
      }
    });

    return Array.from(dataMap.values()).sort((a, b) => {
      const dateA = parseISO(a.date);
      const dateB = parseISO(b.date);
      return dateA.getTime() - dateB.getTime();
    });
  }, [allTasks, profile]);

  const taskPriorityDistribution = useMemo(() => {
    if (!allTasks) return [];
    const priorityCounts = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    allTasks.filter(task => task.is_completed).forEach(task => {
      priorityCounts[task.priority]++;
    });
    return Object.entries(priorityCounts).map(([name, value]) => ({ name, value })).filter(item => item.value > 0);
  }, [allTasks]);

  if (isSessionLoading || isTasksLoading) {
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

  if (!user || !profile) {
    return null;
  }

  if (allTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-4">
        <CalendarOff className="h-12 w-12 text-muted-foreground opacity-50" />
        <h2 className="text-xl font-bold">No Data Yet</h2>
        <p className="text-muted-foreground max-w-md">
          Start completing tasks to unlock your analytics and track your progress!
        </p>
        <Button onClick={() => navigate('/scheduler')}>Go to Scheduler</Button>
      </div>
    );
  }

  const currentLevel = profile.level;
  const xpToNextLevel = XP_PER_LEVEL - (profile.xp % XP_PER_LEVEL);
  const totalCompletedTasks = allTasks.filter(t => t.is_completed).length;
  const totalXpEarned = profile.xp;
  const totalEnergyCost = allTasks.filter(t => t.is_completed && t.energy_cost > 0).reduce((sum, task) => sum + task.energy_cost, 0);
  const totalEnergyGain = allTasks.filter(t => t.is_completed && t.energy_cost < 0).reduce((sum, task) => sum + Math.abs(task.energy_cost), 0);

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--logo-orange))', 'hsl(var(--logo-green))', 'hsl(var(--accent))', 'hsl(var(--destructive))'];
  const PIE_COLORS = { 
    HIGH: 'hsl(var(--destructive))', 
    MEDIUM: 'hsl(var(--logo-orange))', 
    LOW: 'hsl(var(--logo-green))' 
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
            <div className="text-xl font-bold">{currentLevel}</div>
            <p className="text-xs text-muted-foreground">
              {xpToNextLevel} XP to Level {currentLevel + 1}
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
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
              <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
          <CardTitle className="text-lg">Task Priority Distribution</CardTitle>
        </CardHeader>
        <CardContent className="p-0 h-[300px] flex items-center justify-center">
          {taskPriorityDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={taskPriorityDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {taskPriorityDistribution.map((entry, index) => (
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
    </div>
  );
};

export default AnalyticsPage;