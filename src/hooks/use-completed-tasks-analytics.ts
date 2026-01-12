import React, { useMemo } from 'react'; // ADDED: useMemo import
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from './use-session';
import { CompletedTaskLogEntry, TaskPriority } from '@/types/scheduler';
import { format, parseISO, startOfDay, subDays } from 'date-fns';

interface DailyCompletedSummary {
  date: string; // Formatted as 'MMM d'
  tasksCompleted: number;
  xpGained: number;
  energyConsumed: number;
  energyGained: number;
}

interface PriorityDistribution {
  name: TaskPriority;
  value: number;
}

interface CompletedTasksAnalytics {
  dailySummary: DailyCompletedSummary[];
  priorityDistribution: PriorityDistribution[];
  totalCompletedTasks: number;
  totalXpEarned: number;
  totalEnergyConsumed: number;
  totalEnergyGained: number;
  isLoading: boolean;
}

const generateDateRange = (days: number) => {
  const dates: Date[] = [];
  for (let i = days - 1; i >= 0; i--) {
    dates.push(subDays(startOfDay(new Date()), i));
  }
  return dates;
};

export const useCompletedTasksAnalytics = (daysToLookBack: number = 7): CompletedTasksAnalytics => {
  const { user } = useSession();
  const userId = user?.id;

  const { data: completedTasks = [], isLoading } = useQuery<CompletedTaskLogEntry[]>({
    queryKey: ['completedTasksAnalytics', userId, daysToLookBack],
    queryFn: async () => {
      if (!userId) return [];
      console.log(`[useCompletedTasksAnalytics] Fetching completed tasks for analytics for user: ${userId}, days: ${daysToLookBack}`);

      const endDate = startOfDay(new Date());
      const startDate = subDays(endDate, daysToLookBack - 1); // Include today

      const { data, error } = await supabase
        .from('completedtasks')
        .select('*')
        .eq('user_id', userId)
        .gte('completed_at', startDate.toISOString())
        .lte('completed_at', endDate.toISOString());

      if (error) {
        console.error("[useCompletedTasksAnalytics] Error fetching completed tasks for analytics:", error);
        throw new Error(error.message);
      }
      
      const mappedTasks = (data || []).map(task => ({
        ...task,
        effective_duration_minutes: task.duration_used || task.duration_scheduled || 30,
        name: task.task_name,
        original_source: task.original_source || 'scheduled_tasks',
        // Priority is now directly from the DB
        priority: task.priority as TaskPriority, 
      })) as CompletedTaskLogEntry[];
      console.log(`[useCompletedTasksAnalytics] Fetched ${mappedTasks.length} completed tasks.`);
      return mappedTasks;
    },
    enabled: !!userId,
  });

  const analyticsData = useMemo(() => {
    console.log("[useCompletedTasksAnalytics] Calculating analytics data from completed tasks.");
    const dailySummaryMap = new Map<string, DailyCompletedSummary>();
    const lastNDays = generateDateRange(daysToLookBack);

    lastNDays.forEach(date => {
      const key = format(date, 'yyyy-MM-dd');
      dailySummaryMap.set(key, { date: format(date, 'MMM d'), tasksCompleted: 0, xpGained: 0, energyConsumed: 0, energyGained: 0 });
    });

    let totalCompletedTasks = 0;
    let totalXpEarned = 0;
    let totalEnergyConsumed = 0;
    let totalEnergyGained = 0;
    const priorityCounts = { HIGH: 0, MEDIUM: 0, LOW: 0 };

    completedTasks.forEach(task => {
      const completionDateKey = format(startOfDay(parseISO(task.completed_at)), 'yyyy-MM-dd');

      if (dailySummaryMap.has(completionDateKey)) {
        const entry = dailySummaryMap.get(completionDateKey)!;
        entry.tasksCompleted += 1;
        entry.xpGained += task.xp_earned;
        if (task.energy_cost > 0) {
          entry.energyConsumed += task.energy_cost;
        } else {
          entry.energyGained += Math.abs(task.energy_cost);
        }
      }

      totalCompletedTasks++;
      totalXpEarned += task.xp_earned;
      if (task.energy_cost > 0) {
        totalEnergyConsumed += task.energy_cost;
      } else {
        totalEnergyGained += Math.abs(task.energy_cost);
      }
      
      // Use priority directly from the task
      const taskPriority: TaskPriority = task.priority; 
      priorityCounts[taskPriority]++;
    });

    const dailySummary = Array.from(dailySummaryMap.values()).sort((a, b) => {
      const dateA = parseISO(a.date);
      const dateB = parseISO(b.date);
      return dateA.getTime() - dateB.getTime();
    });

    const priorityDistribution = Object.entries(priorityCounts)
      .map(([name, value]) => ({ name: name as TaskPriority, value }))
      .filter(item => item.value > 0);
    
    console.log("[useCompletedTasksAnalytics] Daily Summary:", dailySummary);
    console.log("[useCompletedTasksAnalytics] Priority Distribution:", priorityDistribution);
    console.log("[useCompletedTasksAnalytics] Totals: Tasks:", totalCompletedTasks, "XP:", totalXpEarned, "Energy Consumed:", totalEnergyConsumed, "Energy Gained:", totalEnergyGained);

    return {
      dailySummary,
      priorityDistribution,
      totalCompletedTasks,
      totalXpEarned,
      totalEnergyConsumed,
      totalEnergyGained,
      isLoading,
    };
  }, [completedTasks, daysToLookBack, isLoading]);

  return analyticsData;
};