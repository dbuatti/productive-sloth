// Inside SchedulerPage.tsx

const calculatedSchedule = useMemo(() => {
  if (!profile || !dbScheduledTasks) return null;
  
  // This utility handles the placement logic, gaps, and time-block calculation
  return calculateSchedule(
    dbScheduledTasks, 
    selectedDay, 
    workdayStartTime, 
    workdayEndTime,
    profile.is_in_regen_pod,
    profile.regen_pod_start_time ? parseISO(profile.regen_pod_start_time) : null,
    regenPodDurationMinutes,
    T_current
  );
}, [dbScheduledTasks, selectedDay, workdayStartTime, workdayEndTime, profile, regenPodDurationMinutes, T_current]);

// Ensure the render block passes this calculatedSchedule:
<SchedulerDisplay 
  schedule={currentSchedule} // Pass the calculated result here
  T_current={T_current} 
  onRemoveTask={handlePermanentDeleteScheduledTask}
  onRetireTask={(task) => handleSchedulerAction('skip', task)}
  onCompleteTask={(task, index) => handleSchedulerAction('complete', task, false, 0, index)}
  activeItemId={activeItemToday?.id || null} 
  selectedDayString={selectedDay} 
  onAddTaskClick={handleAddTaskClick}
  onScrollToItem={handleScrollToItem}
  isProcessingCommand={isProcessingCommand}
  onFreeTimeClick={handleFreeTimeClick}
/>