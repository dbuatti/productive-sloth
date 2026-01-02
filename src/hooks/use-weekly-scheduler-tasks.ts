import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DBScheduledTask } from '@/types/scheduler';
import { useSession } from './use-session'; // FIX: Added missing import
import { format, startOfWeek, addDays, parseISO, setHours, setMinutes, addMinutes, isBefore, isAfter, differenceInMinutes, min, max, Day } from 'date-fns'; 
import { setTimeOnDate, isMeal } from '@/lib/scheduler-utils'; 

interface WeeklyTasks {
  [key: string]: DBScheduledTask[]; // Key is 'yyyy-MM-dd'
}

export const useWeeklySchedulerTasks = (weekStart: Date) => {
  const { user, profile } = useSession(); 
  const userId = user?.id;

  // Use profile.week_starts_on for startOfWeek option, default to 0 (Sunday)
  const weekStartsOn = (profile?.week_starts_on ?? 0) as Day;
  const formattedWeekStart = format(startOfWeek(weekStart, { weekStartsOn }), 'yyyy-MM-dd'); 

  const queryKey = ['weeklyScheduledTasks', userId, formattedWeekStart, profile?.breakfast_time, profile?.lunch_time, profile?.dinner_time, profile?.breakfast_duration_minutes, profile?.lunch_duration_minutes, profile?.dinner_duration_minutes, profile?.reflection_count, profile?.reflection_times, profile?.reflection_durations, weekStartsOn]; 

  const fetchWeeklyTasks = async (): Promise<WeeklyTasks> => {
    if (!userId || !profile) return {};

    const weekEnd = addDays(startOfWeek(weekStart, { weekStartsOn }), 6); 

    // Fetch meal assignments for the week
    const { data: assignmentsData } = await supabase
      .from('meal_assignments')
      .select('*, meal_idea:meal_ideas(*)')
      .eq('user_id', userId)
      .gte('assigned_date', formattedWeekStart)
      .lte('assigned_date', format(weekEnd, 'yyyy-MM-dd'));

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
      const day = addDays(startOfWeek(weekStart, { weekStartsOn }), i);
      tasksByDay[format(day, 'yyyy-MM-dd')] = [];
    }

    (data as DBScheduledTask[]).forEach(task => {
      const dateKey = format(parseISO(task.scheduled_date), 'yyyy-MM-dd');
      if (tasksByDay[dateKey]) {
        // Inject assigned meal name if it's a generic meal task
        const isMealTask = ['breakfast', 'lunch', 'dinner'].includes(task.name.toLowerCase());
        if (isMealTask) {
          const assignment = assignmentsData?.find(a => a.assigned_date === dateKey && a.meal_type === task.name.toLowerCase());
          if (assignment?.meal_idea?.name) {
            task.name = assignment.meal_idea.name;
          }
        }
        tasksByDay[dateKey].push(task);
      }
    });

    for (let i = 0; i < 7; i++) {
      const dayDate = addDays(startOfWeek(weekStart, { weekStartsOn }), i);
      const dateKey = format(dayDate, 'yyyy-MM-dd');

      const workdayStart = setTimeOnDate(dayDate, profile.default_auto_schedule_start_time || '00:00');
      let workdayEnd = setTimeOnDate(dayDate, profile.default_auto_schedule_end_time || '23:59');
      if (isBefore(workdayEnd, workdayStart)) workdayEnd = addDays(workdayEnd, 1);

      const addStaticTask = (name: string, timeStr: string | null, duration: number | null, isMealTask: boolean = true) => {
        if (timeStr && duration !== null && duration > 0) {
          let anchorStart = setTimeOnDate(dayDate, timeStr);
          let anchorEnd = addMinutes(anchorStart, duration);

          if (isBefore(anchorEnd, anchorStart)) {
            anchorEnd = addDays(anchorEnd, 1);
          }

          const intersectionStart = max([anchorStart, workdayStart]);
          const intersectionEnd = min([anchorEnd, workdayEnd]);

          const effectiveDuration = differenceInMinutes(intersectionEnd, intersectionStart);

          if (effectiveDuration > 0) { 
            let finalName = name;
            if (isMealTask) {
              const assignment = assignmentsData?.find(a => a.assigned_date === dateKey && a.meal_type === name.toLowerCase());
              if (assignment?.meal_idea?.name) {
                finalName = assignment.meal_idea.name;
              }
            }

            tasksByDay[dateKey].push({
              id: `${isMealTask ? 'meal' : 'reflection'}-${name.toLowerCase().replace(/\s/g, '-')}-${dateKey}-${format(intersectionStart, 'HHmm')}`,
              user_id: userId,
              name: finalName,
              break_duration: null,
              start_time: intersectionStart.toISOString(),
              end_time: intersectionEnd.toISOString(),
              scheduled_date: dateKey,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              is_critical: false,
              is_flexible: false, 
              is_locked: true,   
              energy_cost: isMealTask ? -10 : 0,  
              is_completed: false,
              is_custom_energy_cost: false,
              task_environment: isMealTask ? 'home' : 'laptop', 
              source_calendar_id: null,
              is_backburner: false,
            });
          }
        }
      };

      addStaticTask('Breakfast', profile.breakfast_time, profile.breakfast_duration_minutes);
      addStaticTask('Lunch', profile.lunch_time, profile.lunch_duration_minutes);
      addStaticTask('Dinner', profile.dinner_time, profile.dinner_duration_minutes);

      // Inject Reflections
      for (let r = 0; r < (profile.reflection_count || 0); r++) {
        const rTime = profile.reflection_times?.[r];
        const rDur = profile.reflection_durations?.[r];
        if (rTime && rDur) {
          addStaticTask(`Reflection Point ${r + 1}`, rTime, rDur, false);
        }
      }
    }

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
    enabled: !!userId && !!profile, 
    staleTime: 5 * 60 * 1000, 
    gcTime: 10 * 60 * 1000, 
  });

  return {
    weeklyTasks,
    isLoading,
    error,
  };
};