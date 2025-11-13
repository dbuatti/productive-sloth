// ...
    if (isViewingToday && !hasMorningFixRunToday) {
      const tasksToRetire = dbScheduledTasks.filter(task => {
        if (!task.start_time || !task.end_time) return false;
        if (task.is_locked) return false; // Excludes locked tasks
        if (!task.is_flexible) return false; // Excludes non-flexible tasks (fixed appointments)
        // The task must pass both of the above conditions to proceed
        // ... (time-based conditions follow)
        return isBefore(taskEndTime, workdayStart) && isAfter(now, workdayStart);
      });
// ...