import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DBScheduledTask } from '@/types/scheduler';
import { useSession } from './use-session';
import { format, parseISO, addMinutes, isBefore, addDays, startOfDay, differenceInMinutes, max, min, isEqual, isAfter, addHours, subDays } from 'date-fns'; // Added subDays import
import { setTimeOnDate } from '@/lib/scheduler-utils';

export const useWeeklySchedulerTasks = (centerDateString: string) => {
  const { user, profile } = useSession();
  const userId = user?.id;

  const { data: weeklyTasks, isLoading } = useQuery<Record<string, DBScheduledTask[]>>({
    queryKey: ['weeklySchedulerTasks', userId, centerDateString, profile?.id],
    queryFn: async () => {
      if (!userId || !profile) return {};
      console.log(`[useWeeklySchedulerTasks] Fetching weekly tasks for user: ${userId}, centerDate: ${centerDateString}`);

      const centerDate = parseISO(centerDateString);
      const startDate = subDays(startOfDay(centerDate), 7); // Fetch 7 days in the past
      const endDate = addDays(startDate, 30); // Fetch 30 days total (7 past + today + 22 future)
      console.log(`[useWeeklySchedulerTasks] Fetch window: ${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}`);

      // 1. Fetch actual scheduled tasks
      const { data: scheduledData, error: scheduledError } = await supabase
        .from('scheduled_tasks')
        .select('*')
        .eq('user_id', userId)
        .gte('scheduled_date', format(startDate, 'yyyy-MM-dd'))
        .lte('scheduled_date', format(endDate, 'yyyy-MM-dd'));

      if (scheduledError) {
        console.error("[useWeeklySchedulerTasks] Error fetching scheduled tasks:", scheduledError);
        throw scheduledError;
      }
      console.log(`[useWeeklySchedulerTasks] Fetched ${scheduledData.length} scheduled tasks.`);

      const tasksByDay: Record<string, DBScheduledTask[]> = {};
      
      // Initialize days for the full 30-day window
      for (let i = 0; i <= differenceInMinutes(endDate, startDate) / (24 * 60); i++) {
        const day = addDays(startDate, i);
        const dayKey = format(day, 'yyyy-MM-dd');
        tasksByDay[dayKey] = [];
      }

      // Populate with real tasks
      (scheduledData || []).forEach(task => {
        const dayKey = task.scheduled_date;
        if (!tasksByDay[dayKey]) tasksByDay[dayKey] = [];
        tasksByDay[dayKey].push(task);
      });
      console.log("[useWeeklySchedulerTasks] Populated tasks into daily buckets.");

      // 2. Generate Static Anchors (Meals/Reflections) for the window
      const staticAnchors: DBScheduledTask[] = [];
      
      const addStaticConstraint = (name: string, timeStr: string | null, duration: number | null, date: Date) => {
        const effectiveDuration = (duration !== null && duration !== undefined && !isNaN(duration)) ? duration : 15;
        if (!timeStr || effectiveDuration <= 0) return;

        let anchorStart = setTimeOnDate(date, timeStr);
        let anchorEnd = addMinutes(anchorStart, effectiveDuration);
        if (isBefore(anchorEnd, anchorStart)) anchorEnd = addDays(anchorEnd, 1);

        // Workday window (using profile defaults or fallbacks)
        const workdayStart = profile.default_auto_schedule_start_time ? setTimeOnDate(date, profile.default_auto_schedule_start_time) : startOfDay(date);
        let workdayEnd = profile.default_auto_schedule_end_time ? setTimeOnDate(startOfDay(date), profile.default_auto_schedule_end_time) : addHours(startOfDay(date), 17);
        if (isBefore(workdayEnd, workdayStart)) workdayEnd = addDays(workdayEnd, 1);

        // Check overlap
        const overlaps = (isBefore(anchorEnd, workdayEnd) || isEqual(anchorEnd, workdayEnd)) && 
                         (isAfter(anchorStart, workdayStart) || isEqual(anchorStart, workdayStart));
        
        if (overlaps) {
          const intersectionStart = max([anchorStart, workdayStart]);
          const intersectionEnd = min([anchorEnd, workdayEnd]);
          const finalDuration = differenceInMinutes(intersectionEnd, intersectionStart);

          if (finalDuration > 0) {
            const dateKey = format(date, 'yyyy-MM-dd');
            const isMealTask = ['breakfast', 'lunch', 'dinner'].includes(name.toLowerCase());
            
            staticAnchors.push({
              id: `${isMealTask ? 'meal' : 'reflection'}-${name.toLowerCase().replace(/\s/g, '-')}-${dateKey}-${format(intersectionStart, 'HHmm')}`,
              user_id: userId,
              name: name,
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
              task_environment: 'home',
              source_calendar_id: null,
              is_backburner: false,
              is_work: false, // Static anchors are not work
              is_break: isMealTask, // NEW: Add is_break flag
            });
          }
        }
      };

      // Generate anchors for the full window
      for (let i = 0; i <= differenceInMinutes(endDate, startDate) / (24 * 60); i++) {
        const day = addDays(startDate, i);
        addStaticConstraint('Breakfast', profile.breakfast_time, profile.breakfast_duration_minutes, day);
        addStaticConstraint('Lunch', profile.lunch_time, profile.lunch_duration_minutes, day);
        addStaticConstraint('Dinner', profile.dinner_time, profile.dinner_duration_minutes, day);

        if (profile.reflection_count > 0 && profile.reflection_times) {
          for (let r = 0; r < profile.reflection_count; r++) {
            const rTime = profile.reflection_times[r];
            const rDur = profile.reflection_durations?.[r];
            addStaticConstraint(`Reflection Point ${r + 1}`, rTime, rDur, day);
          }
        }
      }
      console.log(`[useWeeklySchedulerTasks] Generated ${staticAnchors.length} static anchor tasks.`);

      // Merge anchors into tasksByDay
      staticAnchors.forEach(anchor => {
        if (!tasksByDay[anchor.scheduled_date]) tasksByDay[anchor.scheduled_date] = [];
        tasksByDay[anchor.scheduled_date].push(anchor);
      });
      console.log("[useWeeklySchedulerTasks] Merged static anchors into daily tasks.");

      return tasksByDay;
    },
    enabled: !!userId && !!profile && !!centerDateString,
  });

  return { weeklyTasks, isLoading, profileSettings: profile };
};