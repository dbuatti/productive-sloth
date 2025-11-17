const completeAetherSinkTaskMutation = useMutation({
  mutationFn: async ({taskToComplete, durationUsed}: {taskToComplete: AetherSinkTask, durationUsed: number}) => {