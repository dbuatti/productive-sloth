await updateScheduledTaskDetails({
  id: task.id,
  originalSourceTable: task.is_flexible ? 'CurrentSchedule' : 'FixedAppointments',
  name: values.name,
  start_time: startTime.toISOString(),
  end_time: endTime.toISOString(),
  break_duration: values.break_duration === 0 ? null : values.break_duration,
  is_critical: values.is_critical,
  is_flexible: values.is_flexible,
  is_locked: values.is_locked,
  energy_cost: values.energy_cost,
  is_custom_energy_cost: values.is_custom_energy_cost,
});