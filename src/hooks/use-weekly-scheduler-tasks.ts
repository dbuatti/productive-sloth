import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DBScheduledTask } from '@/types/scheduler';
import { useSession } from './use-session';
import { format, startOfWeek, addDays, parseISO, setHours, setMinutes, isBefore, addMinutes, isAfter, differenceInMinutes } from 'date-fns'; // Added isAfter and differenceInMinutes
import { setTimeOnDate, isMeal } from '@/lib/scheduler-utils'; // Import setTimeOnDate and isMeal

interface WeeklyTasks {
  [key: string]: DBScheduledTask[]; // Key is 'yyyy-MM-dd'
}

export const useWeeklySchedulerTasks = (weekStart: Date) => {
  const { user, profile } = useSession(); // Get profile from session
  const userId = user?.id;

  // Ensure weekStart is treated as a local date for formatting
  const formattedWeekStart = format(startOfWeek(weekStart, { weekStartsOn: 0 }), 'yyyy-MM-dd'); // Ensure week starts on Sunday

  const queryKey = ['weeklyScheduledTasks', userId, formattedWeekStart, profile?.breakfast_time, profile?.lunch_time, profile?.dinner_time, profile?.breakfast_duration_minutes, profile?.lunch_duration_minutes, profile?.dinner_duration_minutes]; // Added profile meal times to query key

  const fetchWeeklyTasks = async (): Promise<WeeklyTasks> => {
    if (!userId || !profile) return {};

    // Calculate weekEnd based on the local weekStart
    const weekEnd = addDays(startOfWeek(weekStart, { weekStartsOn: 0 }), 6); // End of the week (Saturday)

    const { data, error } = await supabase
      .from('scheduled_tasks')
      .select('*')
      .eq('user_id', userId)
      .gte('scheduled_date', formattedWeekStart)
      .lte('scheduled_date', format(weekEnd, 'yyyy-MM-dd'))
      .order('start_time', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    const tasksByDay: WeeklyTasks = {};
    for (let i = 0; i < 7; i++) {
      const day = addDays(startOfWeek(weekStart, { weekStartsOn: 0 }), i);
      tasksByDay[format(day, 'yyyy-MM-dd')] = [];
    }

    (data as DBScheduledTask[]).forEach(task => {
      // Ensure task.scheduled_date is parsed as a local date for consistent key generation
      const dateKey = format(parseISO(task.scheduled_date), 'yyyy-MM-dd');
      if (tasksByDay[dateKey]) {
        tasksByDay[dateKey].push(task);
      }
    });

    // Inject meal tasks from profile into each day's schedule
    for (let i = 0; i < 7; i++) {
      const dayDate = addDays(startOfWeek(weekStart, { weekStartsOn: 0 }), i);
      const dateKey = format(dayDate, 'yyyy-MM-dd');

      const addMealTask = (name: string, timeStr: string | null, duration: number | null) => {
        if (timeStr && duration !== null && duration > 0) {
          let mealStart = setTimeOnDate(dayDate, timeStr);
          let mealEnd = addMinutes(mealStart, duration);

          // Ensure meal is within the workday window or overlaps significantly
          const workdayStart = setTimeOnDate(dayDate, profile.default_auto_schedule_start_time || '00:00');
          let workdayEnd = setTimeOnDate(dayDate, profile.default_auto_schedule_end_time || '23:59');
          if (isBefore(workdayEnd, workdayStart)) workdayEnd = addDays(workdayEnd, 1);

          if (isBefore(mealStart, workdayEnd) && isAfter(mealEnd, workdayStart)) {
            // Adjust meal times to fit within workday if they extend beyond it
            const effectiveMealStart = isBefore(mealStart, workdayStart) ? workdayStart : mealStart;
            const effectiveMealEnd = isAfter(mealEnd, workdayEnd) ? workdayEnd : mealEnd;
            const effectiveDuration = differenceInMinutes(effectiveMealEnd, effectiveMealStart);

            if (effectiveDuration > 0) {
              tasksByDay[dateKey].push({
                id: `meal-${name.toLowerCase()}-${dateKey}`, // Unique ID for meal
                user_id: userId,
                name: name,
                break_duration: null,
                start_time: effectiveMealStart.toISOString(),
                end_time: effectiveMealEnd.toISOString(),
                scheduled_date: dateKey,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                is_critical: false,
                is_flexible: false, // Meals are fixed
                is_locked: true,   // Meals are locked
                energy_cost: -10,  // Meals provide energy
                is_completed: false,
                is_custom_energy_cost: false,
                task_environment: 'home', // Default environment for meals
                source_calendar_id: null,
                is_backburner: false,
              });
            }
          }
        }
      };

      addMealTask('Breakfast', profile.breakfast_time, profile.breakfast_duration_minutes);
      addMealTask('Lunch', profile.lunch_time, profile.lunch_duration_minutes);
      addMealTask('Dinner', profile.dinner_time, profile.dinner_duration_minutes);
    }

    // Sort all tasks (including injected meals) by start time for each day
    Object.keys(tasksByDay).forEach(dateKey => {
      tasksByDay[dateKey].sort((a, b) => {
        if (a.start_time && b.start_time) {
          return parseISO(a.start_time).getTime() - parseISO(b.start_time).getTime();
        }
        return 0;
      });
    });

    return tasksByDay;
  };

  const { data: weeklyTasks = {}, isLoading, error } = useQuery<WeeklyTasks, Error>({
    queryKey,
    queryFn: fetchWeeklyTasks,
    enabled: !!userId && !!profile, // Only enable if user and profile are loaded
    staleTime: 5 * 60 * 1000, // 5 minutes stale time
    gcTime: 10 * 60 * 1000, // 10 minutes garbage collection time
  });

  return {
    weeklyTasks,
    isLoading,
    error,
  };
};