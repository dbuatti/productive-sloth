import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSession } from '@/hooks/use-session';
import { useWeeklySchedulerTasks } from '@/hooks/use-weekly-scheduler-tasks';
import { format, parseISO, startOfDay, addDays, subDays, differenceInMinutes, isAfter, isBefore, isSameDay, getDay } from 'date-fns';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area, ReferenceLine, LabelList 
} from 'recharts';
import { AlertTriangle, Coffee, CalendarOff, TrendingUp, Activity, Zap, Moon, Sun, AlertCircle, ListTodo, Briefcase, CalendarDays, Flame } from 'lucide-react'; // Added Flame icon
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch'; // Import Switch
import { environmentOptions } from '@/hooks/use-environment-context'; // NEW: Import environmentOptions
import { TaskPriority } from '@/types'; // NEW: Import TaskPriority

// --- Constants for Analysis ---
const MAX_DAILY_MINUTES = 8 * 60; // 8 hours of work
const WARNING_THRESHOLD = 6 * 60; // 6 hours
const RECOMMENDED_BREAK_RATIO = 0.2; // 20% of time should be breaks

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
  energyConsumed: number; // NEW
  energyGained: number;   // NEW
  workTasksByPriority: { HIGH: number; MEDIUM: number; LOW: number }; // NEW
}

interface WorkloadDistribution {
  name: string;
  value: number;
}

const WellnessPage: React.FC = () => {
  const { user, profile } = useSession();
  const navigate = useNavigate();
  const [skipWeekends, setSkipWeekends] = useState(true);

  // We fetch a 14-day window for meaningful trends
  const centerDateString = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const { weeklyTasks, isLoading, profileSettings } = useWeeklySchedulerTasks(centerDateString);

  // Calculate data for the last 7 days (PAST TRACKING)
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
      let energyConsumed = 0; // NEW
      let energyGained = 0;   // NEW
      const workTasksByPriority = { HIGH: 0, MEDIUM: 0, LOW: 0 }; // NEW

      tasks.forEach(task => {
        if (!task.start_time || !task.end_time) return;
        const duration = differenceInMinutes(parseISO(task.end_time), parseISO(task.start_time));
        if (duration <= 0) return;

        const isBreakOrMeal = task.name.toLowerCase() === 'break' || ['breakfast', 'lunch', 'dinner'].includes(task.name.toLowerCase());
        
        if (isBreakOrMeal) {
          breakMinutes += duration;
          energyGained += Math.abs(task.energy_cost); // Meals/breaks give energy
        } else {
          energyConsumed += task.energy_cost; // Regular tasks consume energy
          if (task.is_work) {
            workMinutes += duration;
            workTaskCount++;
            if (task.is_critical) workTasksByPriority.HIGH++;
            else if (task.is_backburner) workTasksByPriority.LOW++;
            else workTasksByPriority.MEDIUM++;
          } else {
            personalMinutes += duration;
          }
        }
      });

      data.push({
        date: dateKey,
        dayName,
        totalWorkMinutes: workMinutes,
        totalBreakMinutes: breakMinutes,
        totalPersonalMinutes: personalMinutes,
        taskCount: tasks.length,
        isOverwork: workMinutes > MAX_DAILY_MINUTES,
        isWarning: workMinutes > WARNING_THRESHOLD && workMinutes <= MAX_DAILY_MINUTES,
        workTaskCount,
        energyConsumed, // NEW
        energyGained,   // NEW
        workTasksByPriority, // NEW
      });
    }

    return data;
  }, [weeklyTasks, profileSettings]);

  // NEW: Calculate data for the next 7 days (FUTURE OUTLOOK)
  const future7DaysData = useMemo(() => {
    if (!weeklyTasks || !profileSettings) return null;

    const data: DailyWorkload[] = [];
    const today = startOfDay(new Date());

    for (let i = 0; i < 7; i++) { // Next 7 days including today
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

      tasks.forEach(task => {
        if (!task.start_time || !task.end_time) return;
        const duration = differenceInMinutes(parseISO(task.end_time), parseISO(task.start_time));
        if (duration <= 0) return;

        const isBreakOrMeal = task.name.toLowerCase() === 'break' || ['breakfast', 'lunch', 'dinner'].includes(task.name.toLowerCase());

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
          } else {
            personalMinutes += duration;
          }
        }
      });

      data.push({
        date: dateKey,
        dayName,
        totalWorkMinutes: workMinutes,
        totalBreakMinutes: breakMinutes,
        totalPersonalMinutes: personalMinutes,
        taskCount: tasks.length,
        isOverwork: workMinutes > MAX_DAILY_MINUTES,
        isWarning: workMinutes > WARNING_THRESHOLD && workMinutes <= MAX_DAILY_MINUTES,
        workTaskCount,
        energyConsumed,
        energyGained,
        workTasksByPriority,
      });
    }

    return data;
  }, [weeklyTasks, profileSettings]);

  // Calculate workload distribution (work vs. break)
  const workloadDistribution = useMemo(() => {
    if (!last7DaysData) return null;
    const totalWork = last7DaysData.reduce((sum, day) => sum + day.totalWorkMinutes, 0);
    const totalBreak = last7DaysData.reduce((sum, day) => sum + day.totalBreakMinutes, 0);
    return [
      { name: 'Work', value: totalWork },
      { name: 'Break', value: totalBreak },
    ];
  }, [last7DaysData]);

  // NEW: Calculate Work vs. Personal Time Distribution
  const workPersonalDistribution = useMemo(() => {
    if (!last7DaysData) return null;
    const totalWork = last7DaysData.reduce((sum, day) => sum + day.totalWorkMinutes, 0);
    const totalPersonal = last7DaysData.reduce((sum, day) => sum + day.totalPersonalMinutes, 0);
    return [
      { name: 'Work', value: totalWork },
      { name: 'Personal', value: totalPersonal },
    ];
  }, [last7DaysData]);

  // NEW: Calculate Time by Environment
  const environmentUsage = useMemo(() => {
    if (!weeklyTasks) return null;
    const usageMap = new Map<string, number>(); // Map environment value to total minutes

    Object.values(weeklyTasks).flat().forEach(task => {
      if (!task.start_time || !task.end_time || !task.task_environment) return;
      const duration = differenceInMinutes(parseISO(task.end_time), parseISO(task.start_time));
      if (duration <= 0) return;

      const currentDuration = usageMap.get(task.task_environment) || 0;
      usageMap.set(task.task_environment, currentDuration + duration);
    });

    // Convert map to array of objects for Recharts, mapping value to label
    const data = Array.from(usageMap.entries()).map(([environmentValue, minutes]) => {
      const envOption = environmentOptions.find(opt => opt.value === environmentValue);
      return {
        environment: envOption ? envOption.label : environmentValue, // Use label if found, else value
        minutes,
      };
    });

    return data.sort((a, b) => b.minutes - a.minutes);
  }, [weeklyTasks]);

  // NEW: Daily Energy Balance Data
  const dailyEnergyBalanceData = useMemo(() => {
    if (!last7DaysData) return null;
    return last7DaysData.map(day => ({
      dayName: day.dayName,
      netEnergy: day.energyGained - day.energyConsumed,
    }));
  }, [last7DaysData]);

  // NEW: Workload by Priority Data
  const workloadByPriorityData = useMemo(() => {
    if (!last7DaysData) return null;
    const totalHigh = last7DaysData.reduce((sum, day) => sum + day.workTasksByPriority.HIGH, 0);
    const totalMedium = last7DaysData.reduce((sum, day) => sum + day.workTasksByPriority.MEDIUM, 0);
    const totalLow = last7DaysData.reduce((sum, day) => sum + day.workTasksByPriority.LOW, 0);

    return [
      { name: 'High Priority', value: totalHigh },
      { name: 'Medium Priority', value: totalMedium },
      { name: 'Low Priority', value: totalLow },
    ].filter(item => item.value > 0); // Only show priorities with tasks
  }, [last7DaysData]);

  // NEW: Burnout Risk Calculation
  const burnoutRisk = useMemo(() => {
    if (!last7DaysData || !future7DaysData) return 'Low';

    let riskScore = 0;

    // Past workload
    const overworkDays = last7DaysData.filter(d => d.isOverwork).length;
    const warningDays = last7DaysData.filter(d => d.isWarning).length;
    const totalBreakMinutes = last7DaysData.reduce((sum, d) => sum + d.totalBreakMinutes, 0);
    const totalWorkMinutes = last7DaysData.reduce((sum, d) => sum + d.totalWorkMinutes, 0);
    const breakRatio = totalBreakMinutes / (totalWorkMinutes + totalBreakMinutes || 1);

    if (overworkDays > 0) riskScore += 3;
    if (warningDays > 2) riskScore += 2;
    if (breakRatio < RECOMMENDED_BREAK_RATIO && totalWorkMinutes > 0) riskScore += 2;

    // Future workload (next 3 days, excluding today)
    const next3DaysWork = future7DaysData.slice(1, 4).reduce((sum, d) => d.totalWorkMinutes > MAX_DAILY_MINUTES ? sum + 2 : (d.totalWorkMinutes > WARNING_THRESHOLD ? sum + 1 : sum), 0);
    riskScore += next3DaysWork;

    // Energy balance (if consistently negative)
    const negativeEnergyDays = dailyEnergyBalanceData?.filter(d => d.netEnergy < 0).length || 0;
    if (negativeEnergyDays >= 3) riskScore += 1;

    if (riskScore >= 5) return 'High';
    if (riskScore >= 2) return 'Medium';
    return 'Low';
  }, [last7DaysData, future7DaysData, dailyEnergyBalanceData]);


  // Generate recommendations
  const recommendations = useMemo(() => {
    if (!last7DaysData || !future7DaysData || !dailyEnergyBalanceData || !workloadByPriorityData) return [];

    const recs: string[] = [];
    const avgWorkMinutes = last7DaysData.reduce((sum, d) => sum + d.totalWorkMinutes, 0) / 7;
    const overworkDays = last7DaysData.filter(d => d.isOverwork).length;
    const warningDays = last7DaysData.filter(d => d.isWarning).length;
    const totalBreakMinutes = last7DaysData.reduce((sum, d) => sum + d.totalBreakMinutes, 0);
    const totalWorkMinutes = last7DaysData.reduce((sum, d) => sum + d.totalWorkMinutes, 0);
    const breakRatio = totalBreakMinutes / (totalWorkMinutes + totalBreakMinutes || 1);

    // Past workload analysis
    if (avgWorkMinutes > MAX_DAILY_MINUTES) {
      recs.push("Your average daily workload is significantly high. Consider scheduling a full day off soon.");
    } else if (avgWorkMinutes > WARNING_THRESHOLD) {
      recs.push("You're consistently working close to your limit. Try to schedule shorter days or more frequent breaks.");
    }

    if (overworkDays > 0) {
      recs.push(`You overworked on ${overworkDays} day(s) in the last week. This is a clear sign to schedule a recovery day.`);
    }

    if (warningDays > 2) {
      recs.push("Multiple days are in the 'warning zone'. Try to finish work earlier tomorrow.");
    }

    if (breakRatio < RECOMMENDED_BREAK_RATIO && totalWorkMinutes > 0) {
      recs.push("Your break-to-work ratio is low. Try adding a dedicated 15-minute 'do nothing' break between tasks.");
    }

    // Future workload analysis (excluding today's data from future7DaysData for a clearer "upcoming" view)
    const next3DaysWork = future7DaysData.slice(1, 4).reduce((sum, d) => sum + d.totalWorkMinutes, 0);
    const avgNext3DaysWork = next3DaysWork / 3;

    if (avgNext3DaysWork > MAX_DAILY_MINUTES) {
        recs.push("Upcoming workload is extremely high in the next 3 days. Consider re-prioritizing or delegating tasks.");
    } else if (avgNext3DaysWork > WARNING_THRESHOLD) {
        recs.push("Your next few days show a high projected workload. Plan for extra breaks or early finishes.");
    }

    // Energy balance recommendations
    const consistentlyNegativeEnergy = dailyEnergyBalanceData.filter(d => d.netEnergy < 0).length >= 3;
    if (consistentlyNegativeEnergy) {
      recs.push("Your energy balance has been consistently negative. Prioritize recovery activities and breaks.");
    } else if (dailyEnergyBalanceData.some(d => d.netEnergy > 0)) {
      recs.push("Good energy management! Keep balancing tasks with sufficient recovery.");
    }

    // Workload by priority recommendations
    const highPriorityWork = workloadByPriorityData.find(d => d.name === 'High Priority')?.value || 0;
    const totalWorkTasks = workloadByPriorityData.reduce((sum, d) => sum + d.value, 0);
    if (totalWorkTasks > 0 && (highPriorityWork / totalWorkTasks) > 0.5) {
      recs.push("A large portion of your work is high priority. Ensure you're not constantly in 'critical' mode.");
    }

    if (recs.length === 0 && totalWorkMinutes > 0) {
      recs.push("Great balance this week! Consider scheduling a day off to maintain this momentum.");
    } else if (recs.length === 0) {
      recs.push("No recent workload data. Start scheduling tasks to get personalized insights.");
    }

    return recs;
  }, [last7DaysData, future7DaysData, dailyEnergyBalanceData, workloadByPriorityData]);

  // Suggest a day off - FIXED TO LOOK INTO FUTURE
  const suggestedDayOff = useMemo(() => {
    if (!weeklyTasks) return null;
    
    // Look at the next 14 days starting from today
    const today = startOfDay(new Date());
    const futureDays: { date: Date; workMinutes: number }[] = [];
    
    for (let i = 0; i < 14; i++) {
      const dayDate = addDays(today, i);
      
      // NEW: Skip weekends if toggle is enabled
      if (skipWeekends) {
        const dayOfWeek = getDay(dayDate); // 0 = Sunday, 6 = Saturday
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          continue;
        }
      }

      const dateKey = format(dayDate, 'yyyy-MM-dd');
      const tasks = weeklyTasks[dateKey] || [];
      
      let workMinutes = 0;
      tasks.forEach(task => {
        if (!task.start_time || !task.end_time) return;
        const duration = differenceInMinutes(parseISO(task.end_time), parseISO(task.start_time));
        if (duration <= 0) return;
        
        // Only count non-break tasks
        const isBreak = task.name.toLowerCase() === 'break' || ['breakfast', 'lunch', 'dinner'].includes(task.name.toLowerCase());
        if (!isBreak) {
          workMinutes += duration;
        }
      });
      
      futureDays.push({ date: dayDate, workMinutes });
    }
    
    // Find the day with the lowest work time in the next 14 days
    const sortedByLowest = [...futureDays].sort((a, b) => a.workMinutes - b.workMinutes);
    const lowestWorkDay = sortedByLowest[0];
    
    // Only suggest if the lowest day has some work scheduled (otherwise it's already a free day)
    if (lowestWorkDay && lowestWorkDay.workMinutes > 0) {
      return format(lowestWorkDay.date, 'yyyy-MM-dd');
    }
    
    // If all days are empty, suggest tomorrow (respecting weekend toggle)
    let nextDay = addDays(today, 1);
    if (skipWeekends) {
      while (getDay(nextDay) === 0 || getDay(nextDay) === 6) {
        nextDay = addDays(nextDay, 1);
      }
    }
    return format(nextDay, 'yyyy-MM-dd');
  }, [weeklyTasks, skipWeekends]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <p className="text-lg font-semibold mb-4">Please log in to view your wellness analytics.</p>
        <Button onClick={() => navigate('/login')}>Go to Login</Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-8 animate-slide-in-up">
        <Skeleton className="h-8 w-64 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-4 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-3 w-40" />
            </Card>
          ))}
        </div>
        <Card className="p-4 h-64">
          <Skeleton className="h-full w-full" />
        </Card>
      </div>
    );
  }

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

  const COLORS = ['#0ea5e9', '#22c55e', '#eab308', '#f97316', '#ef4444'];
  const PIE_COLORS = {
    Work: 'hsl(var(--primary))',
    Break: 'hsl(var(--logo-orange))',
    Personal: 'hsl(var(--logo-green))',
    'High Priority': 'hsl(var(--destructive))',
    'Medium Priority': 'hsl(var(--logo-orange))',
    'Low Priority': 'hsl(var(--logo-green))',
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
            Insights to help you manage time blindness and prevent overwork. <span className="font-semibold">Note:</span> Analytics track all scheduled activity, not just work tasks.
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
              {Math.round(last7DaysData.reduce((sum, d) => sum + d.totalWorkMinutes, 0) / 7 / 60)}h
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
            <div className={cn("text-2xl font-bold", last7DaysData.filter(d => d.isOverwork).length > 0 ? "text-destructive" : "text-foreground")}>
              {last7DaysData.filter(d => d.isOverwork).length}
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
              {Math.round((workloadDistribution?.find(w => w.name === 'Break')?.value || 0) / (workloadDistribution?.reduce((a, b) => a + b.value, 0) || 1) * 100)}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Target: {RECOMMENDED_BREAK_RATIO * 100}%
            </div>
          </CardContent>
        </Card>

        <Card className="p-4">
          <CardHeader className="p-0 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Work Tasks</CardTitle>
            <Briefcase className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-2xl font-bold text-foreground">
              {last7DaysData.reduce((sum, d) => sum + d.workTaskCount, 0)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Tagged as Work</div>
          </CardContent>
        </Card>
      </div>

      {/* NEW: Burnout Risk Card */}
      <Card className={cn(
        "p-4 border-2",
        burnoutRisk === 'High' && "border-destructive bg-destructive/10 text-destructive animate-pulse-glow",
        burnoutRisk === 'Medium' && "border-logo-orange bg-logo-orange/10 text-logo-orange",
        burnoutRisk === 'Low' && "border-logo-green bg-logo-green/10 text-logo-green"
      )}>
        <CardHeader className="p-0 pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Flame className="h-5 w-5" /> Burnout Risk
          </CardTitle>
          <span className={cn(
            "text-xl font-extrabold",
            burnoutRisk === 'High' && "text-destructive",
            burnoutRisk === 'Medium' && "text-logo-orange",
            burnoutRisk === 'Low' && "text-logo-green"
          )}>
            {burnoutRisk}
          </span>
        </CardHeader>
        <CardContent className="p-0 text-sm">
          {burnoutRisk === 'High' && "Your current scheduling patterns indicate a high risk of burnout. Immediate action is recommended."}
          {burnoutRisk === 'Medium' && "Your workload shows signs of potential imbalance. Monitor closely and consider adjustments."}
          {burnoutRisk === 'Low' && "Your current schedule appears well-balanced. Keep up the great work!"}
        </CardContent>
      </Card>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Workload Chart */}
        <Card className="lg:col-span-2 p-4">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-lg font-bold">Daily Workload (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={last7DaysData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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

        {/* Distribution Pie Chart */}
        <Card className="p-4">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-lg font-bold">Work vs. Break</CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-[300px] flex items-center justify-center">
            {workloadDistribution && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={workloadDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {workloadDistribution.map((entry, index) => (
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

      {/* NEW Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Work vs. Personal Distribution */}
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

        {/* Environment Usage */}
        <Card className="p-4">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-lg font-bold">Time by Environment</CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-[300px]">
            {environmentUsage && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={environmentUsage} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="environment" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" label={{ value: 'Minutes', angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }}
                    formatter={(value: number) => [`${value} min`]}
                  />
                  <Bar dataKey="minutes" fill="hsl(var(--logo-green))" name="Minutes" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* NEW: Daily Energy Balance Chart */}
      <Card className="p-4">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Zap className="h-5 w-5 text-logo-yellow" /> Daily Energy Balance (Last 7 Days)
          </CardTitle>
          <p className="text-muted-foreground mt-1 text-sm">
            Net energy change per day (Energy Gained from breaks/meals - Energy Consumed by tasks).
          </p>
        </CardHeader>
        <CardContent className="p-0 h-[300px]">
          {dailyEnergyBalanceData && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyEnergyBalanceData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="dayName" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" label={{ value: 'Net Energy', angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }}
                  formatter={(value: number) => [`${value}⚡`]}
                />
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                <Bar dataKey="netEnergy" name="Net Energy" fill="hsl(var(--primary))">
                  {
                    dailyEnergyBalanceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.netEnergy >= 0 ? 'hsl(var(--logo-green))' : 'hsl(var(--destructive))'} />
                    ))
                  }
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* NEW: Workload by Priority Chart */}
      <Card className="p-4">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" /> Workload by Priority (Last 7 Days)
          </CardTitle>
          <p className="text-muted-foreground mt-1 text-sm">
            Distribution of your work-tagged tasks by priority level.
          </p>
        </CardHeader>
        <CardContent className="p-0 h-[300px] flex items-center justify-center">
          {workloadByPriorityData && workloadByPriorityData.length > 0 ? (
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
          ) : (
            <div className="text-muted-foreground text-center">No work tasks with priority data.</div>
          )}
        </CardContent>
      </Card>

      {/* Recommendations & Suggestions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recommendations */}
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

        {/* Day Off Suggestion */}
        <Card className="p-4 bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/20">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-primary">
              <Moon className="h-5 w-5" /> Recommended Day Off
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-4">
            {/* NEW: Weekend Skip Toggle */}
            <div className="flex items-center justify-between p-2 rounded-md bg-background/50 border border-white/5">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Skip Weekends</span>
              </div>
              <Switch 
                checked={skipWeekends} 
                onCheckedChange={setSkipWeekends} 
                aria-label="Toggle skipping weekends for day off recommendation"
              />
            </div>

            {suggestedDayOff ? (
              <>
                <p className="text-sm text-foreground">
                  Based on your upcoming workload, we recommend scheduling a day off on <span className="font-bold text-primary">{format(parseISO(suggestedDayOff), 'EEEE, MMMM do')}</span>.
                </p>
                <Button onClick={() => {
                  // Navigate to settings to block the day
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