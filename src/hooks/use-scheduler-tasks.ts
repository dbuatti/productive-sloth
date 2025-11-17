import { useState, useCallback, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DBScheduledTask, NewDBScheduledTask, RetiredTask, NewRetiredTask, SortBy, RetiredTaskSortBy, AutoBalancePayload, UnifiedTask } from '@/types/scheduler';
import { useSession } from './use-session';
import { showSuccess, showError } from '@/utils/toast';
import { format, parseISO, isSameDay, isBefore, addMinutes, startOfDay, addDays, setHours, setMinutes } from 'date-fns';
import { compactScheduleLogic, getFreeTimeBlocks, mergeOverlappingTimeBlocks, setTimeOnDate } from '@/lib/scheduler-utils';
import { DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION } from '@/lib/constants';

// Define the hook structure (assuming this is the default export)
export const useSchedulerTasks = () => {
  const queryClient = useQueryClient();
  const { user, profile, refreshProfile, T_current, triggerLevelUp } = useSession();
  const userId = user?.id;
  const scrollRef = useRef<HTMLDivElement>(null); // Assuming a ref is used for scrolling

  const [selectedDate, setSelectedDate] = useState(format(T_current, 'yyyy-MM-dd'));
  const [sortBy, setSortBy] = useState<SortBy>('PRIORITY_HIGH_TO_LOW');
  const [retiredTaskSortBy, setRetiredTaskSortBy] = useState<RetiredTaskSortBy>('RETIRED_AT_NEWEST');

  // --- Scheduled Tasks Queries and Mutations ---

  const fetchScheduledTasks = useCallback(async (date: string, currentSortBy: SortBy): Promise<DBScheduledTask[]> => {
    if (!userId) return [];

    let query = supabase
      .from('scheduled_tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('scheduled_date', date);

    // Note: Sorting by start_time is handled in calculateSchedule for display order.
    // Here we primarily fetch the data needed for the day.
    query = query.order('start_time', { ascending: true });

    const { data, error } = await query;

    if (error) throw new Error(error.message);
    return data as DBScheduledTask[];
  }, [userId]);

  const { data: scheduledTasks = [], isLoading: isLoadingScheduled, refetch: refetchScheduledTasks } = useQuery<DBScheduledTask[]>({
    queryKey: ['scheduledTasks', userId, selectedDate, sortBy],
    queryFn: () => fetchScheduledTasks(selectedDate, sortBy),
    enabled: !!userId,
    staleTime: 1000 * 60, // 1 minute
  });

  const updateScheduledTaskMutation = useMutation({
    mutationFn: async (task: Partial<DBScheduledTask> & { id: string }) => {
      if (!userId) throw new Error("User not authenticated.");
      
      const { data, error } = await supabase
        .from('scheduled_tasks')
        .update({ ...task, updated_at: new Date().toISOString() })
        .eq('id', task.id)
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) throw new Error(error.message);
      return data as DBScheduledTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId] });
      queryClient.invalidateQueries({ queryKey: ['scheduleDates', userId] });
    },
    onError: (e) => {
      showError(`Failed to update scheduled task: ${e.message}`);
    }
  });

  const deleteScheduledTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error("User not authenticated.");
      const { error } = await supabase
        .from('scheduled_tasks')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId] });
      queryClient.invalidateQueries({ queryKey: ['scheduleDates', userId] });
    },
    onError: (e) => {
      showError(`Failed to delete scheduled task: ${e.message}`);
    }
  });

  // --- Retired Tasks Queries and Mutations (Aether Sink) ---

  const fetchRetiredTasks = useCallback(async (): Promise<RetiredTask[]> => {
    if (!userId) return [];
    
    const { data, error } = await supabase
      .from('aethersink')
      .select('*')
      .eq('user_id', userId)
      .order('retired_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data as RetiredTask[];
  }, [userId]);

  const { data: retiredTasks = [], isLoading: isLoadingRetired } = useQuery<RetiredTask[]>({
    queryKey: ['retiredTasks', userId],
    queryFn: fetchRetiredTasks,
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const updateRetiredTaskMutation = useMutation({
    mutationFn: async (task: Partial<RetiredTask> & { id: string }) => {
      if (!userId) throw new Error("User not authenticated.");
      
      const { data, error } = await supabase
        .from('aethersink')
        .update({ ...task, retired_at: new Date().toISOString() })
        .eq('id', task.id)
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) throw new Error(error.message);
      return data as RetiredTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId] });
    },
    onError: (e) => {
      showError(`Failed to update retired task: ${e.message}`);
    }
  });

  const deleteRetiredTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error("User not authenticated.");
      const { error } = await supabase
        .from('aethersink')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId] });
    },
    onError: (e) => {
      showError(`Failed to delete retired task: ${e.message}`);
    }
  });

  // --- Schedule Dates Query ---

  const fetchScheduleDates = useCallback(async (): Promise<string[]> => {
    if (!userId) return [];

    // Fetch all scheduled dates for the user
    const { data, error } = await supabase
      .from('scheduled_tasks')
      .select('scheduled_date')
      .eq('user_id', userId)
      .order('scheduled_date', { ascending: true });

    if (error) throw new Error(error.message);

    // Extract unique dates
    const uniqueDates = Array.from(new Set(data.map(item => item.scheduled_date)));
    return uniqueDates;
  }, [userId]);

  const { data: scheduleDates = [], isLoading: isLoadingScheduleDates } = useQuery<string[]>({
    queryKey: ['scheduleDates', userId],
    queryFn: fetchScheduleDates,
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // --- Utility Mutations ---

  const randomizeBreaksMutation = useMutation({
    mutationFn: async ({ selectedDate, workdayStartTime, workdayEndTime, currentDbTasks }: {
      selectedDate: string;
      workdayStartTime: Date;
      workdayEndTime: Date;
      currentDbTasks: DBScheduledTask[];
    }) => {
      if (!userId) throw new Error("User not authenticated.");

      const nonBreakTasks = currentDbTasks.filter(task => task.name.toLowerCase() !== 'break');
      let breakTasksToRandomize = currentDbTasks.filter(task => task.name.toLowerCase() === 'break' && !task.is_locked);

      if (breakTasksToRandomize.length === 0) {
        return { placedBreaks: [], failedToPlaceBreaks: [] };
      }

      // 1. Delete all flexible breaks
      const breakIdsToDelete = breakTasksToRandomize.map(b => b.id);
      if (breakIdsToDelete.length > 0) {
        const { error } = await supabase
          .from('scheduled_tasks')
          .delete()
          .in('id', breakIdsToDelete)
          .eq('user_id', userId);
        if (error) throw new Error(`Failed to delete old breaks: ${error.message}`);
      }

      // 2. Recalculate occupied blocks based on remaining tasks
      const occupiedBlocks = mergeOverlappingTimeBlocks(
        nonBreakTasks
          .filter(task => task.start_time && task.end_time)
          .map(task => {
            const utcStart = parseISO(task.start_time!);
            const utcEnd = parseISO(task.end_time!);

            let localStart = setHours(setMinutes(parseISO(selectedDate), utcStart.getMinutes()), utcStart.getHours());
            let localEnd = setHours(setMinutes(parseISO(selectedDate), utcEnd.getMinutes()), utcEnd.getHours());

            if (isBefore(localEnd, localStart)) {
              localEnd = addDays(localEnd, 1);
            }
            return { start: localStart, end: localEnd, duration: Math.floor((localEnd.getTime() - localStart.getTime()) / (1000 * 60)) };
          })
      );

      // 3. Get free time blocks
      const freeTimeBlocks = getFreeTimeBlocks(occupiedBlocks, workdayStartTime, workdayEndTime);

      // 4. Randomly place breaks
      const placedBreaks: NewDBScheduledTask[] = [];
      const failedToPlaceBreaks: DBScheduledTask[] = [];

      // Shuffle breaks to randomize placement order
      breakTasksToRandomize.sort(() => Math.random() - 0.5);

      for (const breakTask of breakTasksToRandomize) {
        const breakDuration = Math.floor((parseISO(breakTask.end_time!).getTime() - parseISO(breakTask.start_time!).getTime()) / (1000 * 60));
        let placed = false;

        // Find a random free slot large enough for the break
        const suitableBlocks = freeTimeBlocks.filter(block => block.duration >= breakDuration);

        if (suitableBlocks.length > 0) {
          // Select a random suitable block
          const randomBlock = suitableBlocks[Math.floor(Math.random() * suitableBlocks.length)];
          
          // Calculate the maximum possible start time within the block
          const maxStartTime = addMinutes(randomBlock.end, -breakDuration);
          
          // Calculate a random start time within the range [randomBlock.start, maxStartTime]
          const startTimestamp = randomBlock.start.getTime();
          const endTimestamp = maxStartTime.getTime();
          const randomTimestamp = Math.floor(Math.random() * (endTimestamp - startTimestamp + 1)) + startTimestamp;
          
          const proposedStartTime = new Date(randomTimestamp);
          const proposedEndTime = addMinutes(proposedStartTime, breakDuration);

          // Ensure the proposed slot is still free (in case of complex overlaps)
          if (getFreeTimeBlocks(occupiedBlocks, proposedStartTime, proposedEndTime).length > 0) {
            placedBreaks.push({
              name: breakTask.name,
              break_duration: breakTask.break_duration,
              scheduled_date: selectedDate,
              is_critical: breakTask.is_critical,
              is_flexible: breakTask.is_flexible,
              is_locked: breakTask.is_locked,
              energy_cost: breakTask.energy_cost,
              is_custom_energy_cost: breakTask.is_custom_energy_cost,
              start_time: proposedStartTime.toISOString(),
              end_time: proposedEndTime.toISOString(),
            });
            
            // Update occupied blocks for subsequent break placements
            occupiedBlocks.push({ start: proposedStartTime, end: proposedEndTime, duration: breakDuration });
            occupiedBlocks.sort((a, b) => a.start.getTime() - b.start.getTime());
            
            placed = true;
          }
        }

        if (!placed) {
          failedToPlaceBreaks.push(breakTask);
        }
      }

      // 5. Insert newly placed breaks
      if (placedBreaks.length > 0) {
        const { error: insertError } = await supabase
          .from('scheduled_tasks')
          .insert(placedBreaks)
          .eq('user_id', userId);
        if (insertError) throw new Error(`Failed to insert new breaks: ${insertError.message}`);
      }

      return { placedBreaks, failedToPlaceBreaks };
    },
    onMutate: async ({ selectedDate, workdayStartTime, workdayEndTime, currentDbTasks }) => {
      await queryClient.cancelQueries({ queryKey: ['scheduledTasks', userId, selectedDate, sortBy] });
      const previousScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', userId, selectedDate, sortBy]);
      const previousScrollTop = scrollRef?.current?.scrollTop;

      const nonBreakTasks = currentDbTasks.filter(task => task.name.toLowerCase() !== 'break');
      let breakTasksToRandomize = currentDbTasks.filter(task => task.name.toLowerCase() === 'break' && !task.is_locked);

      if (breakTasksToRandomize.length === 0) {
        return { previousScheduledTasks, previousScrollTop };
      }

      // Optimistic update: Remove all flexible breaks
      const remainingScheduledTasks = currentDbTasks.filter(task => task.name.toLowerCase() !== 'break' || task.is_locked);
      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, selectedDate, sortBy], remainingScheduledTasks);

      return { previousScheduledTasks, previousScrollTop };
    },
    onSuccess: ({ placedBreaks, failedToPlaceBreaks }) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId] });
      if (placedBreaks.length > 0) {
        showSuccess(`Successfully randomized and placed ${placedBreaks.length} breaks.`);
      }
      if (failedToPlaceBreaks.length > 0) {
        showError(`${failedToPlaceBreaks.length} breaks could not be placed due to lack of space.`);
      }
    },
    onError: (e, { selectedDate }, context) => {
      showError(`Failed to randomize breaks: ${e.message}`);
      // Rollback to the previous state if available
      if (context?.previousScheduledTasks) {
        queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, selectedDate, sortBy], context.previousScheduledTasks);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId] });
    }
  });

  // --- Exported Hook Values ---

  return {
    scheduledTasks,
    isLoadingScheduled,
    retiredTasks,
    isLoadingRetired,
    scheduleDates,
    isLoadingScheduleDates,
    selectedDate,
    setSelectedDate,
    sortBy,
    setSortBy,
    retiredTaskSortBy,
    setRetiredTaskSortBy,
    refetchScheduledTasks,
    retiredTasksCount: retiredTasks.length,
    scrollRef,

    // Mutations
    updateScheduledTask: updateScheduledTaskMutation.mutate,
    deleteScheduledTask: deleteScheduledTaskMutation.mutate,
    updateRetiredTask: updateRetiredTaskMutation.mutate,
    deleteRetiredTask: deleteRetiredTaskMutation.mutate,
    randomizeBreaks: randomizeBreaksMutation.mutate,
  };
};

export default useSchedulerTasks;