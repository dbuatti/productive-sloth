import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { useRetiredTasks } from '@/hooks/use-retired-tasks'; // NEW: Import useRetiredTasks
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import AetherSink from '@/components/AetherSink';
import { RetiredTask, RetiredTaskSortBy } from '@/types/scheduler';

const AetherSinkPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useSession();
  
  // We need to fetch retired tasks. 
  // Since useSchedulerTasks requires a selectedDate, we pass today's date, 
  // but the AetherSink component only uses the retiredTasks data.
  const todayString = new Date().toISOString().split('T')[0];
  
  const { 
    retiredTasks, 
    isLoadingRetiredTasks, 
    addRetiredTask,
    removeRetiredTask, 
    updateRetiredTaskDetails,
    updateRetiredTaskStatus,
    completeRetiredTask,
    toggleRetiredTaskLock,
    triggerAetherSinkBackup,
    rezoneTask: rezoneRetiredTaskMutation, // Renamed to avoid conflict
    setRetiredSortBy,
    retiredSortBy,
  } = useRetiredTasks(); // Use the new hook for retired tasks

  const {
    addScheduledTask,
    handleAutoScheduleAndSort, // Keep for auto-schedule functionality
    sortBy, // Keep for auto-schedule functionality
  } = useSchedulerTasks(todayString); // Keep for scheduled task actions

  const [isProcessingCommand, setIsProcessingCommand] = useState(false);

  // Handlers specific to the Sink Page
  const handleAutoScheduleSink = useCallback(async () => {
    setIsProcessingCommand(true);
    try {
      // This will now use the handleAutoScheduleAndSort from useSchedulerTasks
      // which will fetch retired tasks internally if needed.
      await handleAutoScheduleAndSort(sortBy, 'sink-only', [], todayString);
    } finally {
      setIsProcessingCommand(false);
    }
  }, [handleAutoScheduleAndSort, sortBy, todayString]);

  const handleRezone = useCallback(async (task: RetiredTask) => {
    setIsProcessingCommand(true);
    try {
      const rezonedTaskData = await rezoneRetiredTaskMutation(task); // Rezone from the retired hook
      if (rezonedTaskData) {
        // Now add it to the scheduled tasks using the scheduled tasks hook
        // We need to find a slot for it first, similar to how quick add works.
        // For simplicity, we'll just add it as a flexible task for now.
        // A more robust solution would involve finding a slot here.
        await addScheduledTask({
          name: rezonedTaskData.name,
          duration: rezonedTaskData.duration || 30, // Default duration if not set
          break_duration: rezonedTaskData.break_duration,
          scheduled_date: todayString, // Rezone to today by default
          is_critical: rezonedTaskData.is_critical,
          is_flexible: true, // Re-zoned tasks are flexible by default
          is_locked: false,
          energy_cost: rezonedTaskData.energy_cost,
          is_completed: false,
          is_custom_energy_cost: rezonedTaskData.is_custom_energy_cost,
          task_environment: rezonedTaskData.task_environment,
          is_backburner: rezonedTaskData.is_backburner,
          is_work: rezonedTaskData.is_work,
          is_break: rezonedTaskData.is_break,
        });
      }
    } finally {
      setIsProcessingCommand(false);
    }
  }, [rezoneRetiredTaskMutation, addScheduledTask, todayString]);

  const handleRemove = useCallback(async (id: string, name: string) => {
    setIsProcessingCommand(true);
    try {
      await removeRetiredTask(id);
    } finally {
      setIsProcessingCommand(false);
    }
  }, [removeRetiredTask]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <p className="text-lg font-semibold mb-4">Please log in to view the Aether Sink.</p>
        <Button onClick={() => navigate('/login')}>Go to Login</Button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Sink Component */}
      <AetherSink 
        retiredTasks={retiredTasks} 
        onRezoneTask={handleRezone} 
        onRemoveRetiredTask={handleRemove} 
        onAutoScheduleSink={handleAutoScheduleSink} 
        isLoading={isLoadingRetiredTasks} 
        isProcessingCommand={isProcessingCommand} 
        profile={profile} // Pass profile for backup check
        retiredSortBy={retiredSortBy} 
        setRetiredSortBy={setRetiredSortBy} 
        addRetiredTask={addRetiredTask}
        toggleRetiredTaskLock={toggleRetiredTaskLock}
        completeRetiredTask={completeRetiredTask}
        updateRetiredTaskStatus={updateRetiredTaskStatus}
        updateRetiredTaskDetails={updateRetiredTaskDetails}
        triggerAetherSinkBackup={triggerAetherSinkBackup}
      />
    </div>
  );
};

export default AetherSinkPage;