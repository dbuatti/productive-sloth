if (task.is_completed) {
  const completionDate = startOfDay(parseISO(task.retired_at));
  const key = format(completionDate, 'yyyy-MM-dd');