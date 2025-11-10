import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';
import { useSession } from '@/hooks/use-session';
import { useTasks } from '@/hooks/use-tasks';
import { Loader2, TrendingUp, CheckCircle, Sparkles } from 'lucide-react';
import { format, parseISO, startOfDay, subDays } from 'date-fns';
import { XP_PER_LEVEL } from '@/lib/constants';

// Helper to generate a date range for the last 7 days
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

  const chartData = useMemo(() => {
    if (!allTasks || !profile) return [];

    const last7Days = generateDateRange(7);
    const dataMap = new Map<string, { date: string, tasksCompleted: number, xpGained: number }>();

    // Initialize map with last 7 days
    last7Days.forEach(date => {
      const key = format(date, 'yyyy-MM-dd');
      dataMap.set(key, { date: format(date, 'MMM d'), tasksCompleted: 0, xpGained: 0 });
    });

    // Populate data from tasks
    allTasks.forEach(task => {
      if (task.is_completed) {
        const completionDate = startOfDay(parseISO(task.created_at));
        const key = format(completionDate, 'yyyy-MM-dd');

        if (dataMap.has(key)) {
          const entry = dataMap.get(key)!;
          entry.tasksCompleted += 1;
          entry.xpGained += task.metadata_xp;
        }
      }
    });

    // Convert map values to array and sort by date
    return Array.from(dataMap.values()).sort((a, b) => {
      const dateA = parseISO(a.date);
      const dateB = parseISO(b.date);
      return dateA.getTime() - dateB.getTime();
    });
  }, [allTasks, profile]);

  if (isSessionLoading || isTasksLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !profile) {
    return null;
  }

  const currentLevel = profile.level;
  const xpToNextLevel = XP_PER_LEVEL - (profile.xp % XP_PER_LEVEL);

  return (
    <div className="container mx-auto p-4 max-w-5xl space-y-8 animate-slide-in-up">
      <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
        <TrendingUp className="h-7 w-7 text-primary" /> Gamification Analytics
      </h1>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="animate-pop-in animate-hover-lift">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Level</CardTitle>
            <Sparkles className="h-4 w-4 text-logo-yellow" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentLevel}</div>
            <p className="text-xs text-muted-foreground">
              {xpToNextLevel} XP to Level {currentLevel + 1}
            </p>
          </CardContent>
        </Card>
        <Card className="animate-pop-in animate-hover-lift" style={{ animationDelay: '0.1s' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total XP</CardTitle>
            <Sparkles className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profile.xp}</div>
            <p className="text-xs text-muted-foreground">
              Lifetime experience points earned
            </p>
          </CardContent>
        </Card>
        <Card className="animate-pop-in animate-hover-lift" style={{ animationDelay: '0.2s' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Streak</CardTitle>
            <CheckCircle className="h-4 w-4 text-logo-green" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profile.daily_streak} Days</div>
            <p className="text-xs text-muted-foreground">
              Consecutive days completing tasks
            </p>
          </CardContent>
        </Card>
      </div>

      {/* XP Gain Trend Chart */}
      <Card className="animate-slide-in-up animate-hover-lift" style={{ animationDelay: '0.3s' }}>
        <CardHeader>
          <CardTitle className="text-xl">XP Gain Trend (Last 7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorXp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--logo-yellow))" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="hsl(var(--logo-yellow))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))', 
                    borderRadius: 'var(--radius)' 
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="xpGained" 
                  stroke="hsl(var(--logo-yellow))" 
                  fillOpacity={1} 
                  fill="url(#colorXp)" 
                  name="XP Gained"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Tasks Completed Chart */}
      <Card className="animate-slide-in-up animate-hover-lift" style={{ animationDelay: '0.4s' }}>
        <CardHeader>
          <CardTitle className="text-xl">Tasks Completed (Last 7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))', 
                    borderRadius: 'var(--radius)' 
                  }}
                />
                <Legend />
                <Bar 
                  dataKey="tasksCompleted" 
                  fill="hsl(var(--primary))" 
                  name="Tasks Completed"
                  radius={[4, 4, 0, 0]} // Rounded corners for bars
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsPage;