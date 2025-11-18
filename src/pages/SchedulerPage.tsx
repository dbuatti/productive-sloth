// Fix 4: Line ~1078 - Add task_environment to unifiedPool.push for scheduled tasks
unifiedPool.push({
  id: task.id,
  name: task.name,
  duration: duration,
  break_duration: task.break_duration,
  is_critical: task.is_critical,
  is_flexible: true,
  energy_cost: task.energy_cost,
  source: 'scheduled',
  originalId: task.id,
  is_custom_energy_cost: task.is_custom_energy_cost,
  created_at: task.created_at,
  task_environment: task.task_environment, // ADD: Missing field
});

// Fix 5: Line ~1094 - Add task_environment to unifiedPool.push for retired tasks
unifiedPool.push({
  id: task.id,
  name: task.name,
  duration: task.duration || 30,
  break_duration: task.break_duration,
  is_critical: task.is_critical,
  is_flexible: true,
  energy_cost: task.energy_cost,
  source: 'retired',
  originalId: task.id,
  is_custom_energy_cost: task.is_custom_energy_cost,
  created_at: task.retired_at,
  task_environment: task.task_environment, // ADD: Missing field
});

// Fix 6: Line ~1389 - Add task_environment to unifiedPool.push for scheduled tasks (sort)
unifiedPool.push({
  id: task.id,
  name: task.name,
  duration: taskDuration,
  break_duration: task.break_duration,
  is_critical: task.is_critical,
  is_flexible: true,
  energy_cost: task.energy_cost,
  source: 'scheduled',
  originalId: task.id,
  is_custom_energy_cost: task.is_custom_energy_cost,
  created_at: task.created_at,
  task_environment: task.task_environment, // ADD: Missing field
});

// Fix 7: Line ~1405 - Add task_environment to unifiedPool.push for retired tasks (sort)
unifiedPool.push({
  id: task.id,
  name: task.name,
  duration: task.duration || 30,
  break_duration: task.break_duration,
  is_critical: task.is_critical,
  is_flexible: true,
  energy_cost: task.energy_cost,
  source: 'retired',
  originalId: task.id,
  is_custom_energy_cost: task.is_custom_energy_cost,
  created_at: task.retired_at,
  task_environment: task.task_environment, // ADD: Missing field
});