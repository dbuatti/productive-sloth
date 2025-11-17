const groupedTasks = PRIORITY_ORDER.reduce((acc, priority) => {
  if (priority === 'HIGH') {
    acc[priority] = tasks.filter(task => task.is_critical);
  } else {
    acc[priority] = tasks.filter(task => !task.is_critical);
  }
  return acc;
}, {} as Record<TaskPriority, typeof tasks>);