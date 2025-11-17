const newTask: NewTask = {
  name: name.trim(),
  duration: duration,
  break_duration: null,
  original_scheduled_date: format(dueDate, 'yyyy-MM-dd'),
  is_critical: isCritical,
  energy_cost: is_custom_energy_cost ? energy_cost : calculatedEnergyCost,
  is_custom_energy_cost: is_custom_energy_cost,
  is_locked: false,
  is_completed: false,
};