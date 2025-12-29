import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DBScheduledTask } from '@/types/scheduler';
import { useSession } from './use-session';
import { format, startOfWeek, addDays } from 'date-fns';

interface WeeklyTasks {
  [key: string]: DBScheduledTask[]; // Key is 'yyyy-MM-dd'
}

export const useWeeklySchedulerTasks = (weekStart: Date) => {
  const { user } = useSession();
  const userId = user?.id;

  const formattedWeekStart = format(startOfWeek(weekStart, { weekStartsOn: 0 }), 'yyyy-MM-dd'); // Ensure week starts on Sunday

  const queryKey = ['weeklyScheduledTasks', userId, formattedWeekStart];

  const fetchWeeklyTasks = async (): Promise<WeeklyTasks> => {
    if (!userId) return {};

    const weekEnd = addDays(startOfWeek(weekStart, { weekStartsOn: 0 }), 6); // End of the week (Saturday)

    const { data, error } = await supabase
      .from('scheduled_tasks')
      .select('*')
      .eq('user_id', userId)
      .gte('scheduled_date', formattedWeekStart)
      .lte('scheduled_date', format(weekEnd, 'yyyy-MM-dd'))
      .order('start_time', { ascending: true });

    if (error) {
      // console.error("Error fetching weekly scheduled tasks:", error.message);
      throw new Error(error.message);
    }

    const tasksByDay: WeeklyTasks = {};
    for (let i = 0; i < 7; i++) {
      const day = addDays(startOfWeek(weekStart, { weekStartsOn: 0 }), i);
      tasksByDay[format(day, 'yyyy-MM-dd')] = [];
    }

    (data as DBScheduledTask[]).forEach(task => {
      const dateKey = format(new Date(task.scheduled_date), 'yyyy-MM-dd');
      if (tasksByDay[dateKey]) {
        tasksByDay[dateKey].push(task);
      }
    });

    return tasksByDay;
  };

  const { data: weeklyTasks = {}, isLoading, error } = useQuery<WeeklyTasks, Error>({
    queryKey,
    queryFn: fetchWeeklyTasks,
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes stale time
    gcTime: 10 * 60 * 1000, // 10 minutes garbage collection time
  });

  return {
    weeklyTasks,
    isLoading,
    error,
  };
};