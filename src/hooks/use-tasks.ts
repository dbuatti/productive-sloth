const taskToInsert: NewTask = { 
  ...newTask, 
  user_id: userId, 
  energy_cost: energyCost,
  is_custom_energy_cost: newTask.is_custom_energy_cost ?? false,
  original_scheduled_date: newTask.original_scheduled_date ?? format(new Date(), 'yyyy-MM-dd'),
  retired_at: new Date().toISOString(),
  is_locked: newTask.is_locked ?? false,
  is_completed: newTask.is_completed ?? false,
};