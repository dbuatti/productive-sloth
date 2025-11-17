// ... (around line 880)
  const randomizeBreaksMutation = useMutation({
    mutationFn: async ({ selectedDate, workdayStartTime, workdayEndTime, currentDbTasks }: {
// ... (mutationFn remains unchanged)
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

      // Optimistic update: Remove all flexible breaks, they will be re-added on success/settled
      const remainingScheduledTasks = currentDbTasks.filter(task => task.name.toLowerCase() !== 'break' || task.is_locked);
      queryClient.setQueryData<DBScheduledTask[]>(['scheduledTasks', userId, selectedDate, sortBy], remainingScheduledTasks);

      return { previousScheduledTasks, previousScrollTop };
    },
    onSuccess: ({ placedBreaks, failedToPlaceBreaks }) => {
// ...