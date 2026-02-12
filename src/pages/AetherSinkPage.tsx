import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { useRetiredTasks } from '@/hooks/use-retired-tasks';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import AetherSink from '@/components/AetherSink';
import { RetiredTask, RetiredTaskSortBy } from '@/types/scheduler';
import { addMinutes, format } from 'date-fns';

const AetherSinkPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useSession();
  
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
    rezoneTask: rezoneRetiredTaskMutation,
    setRetiredSortBy,
    retiredSortBy,
    bulkRemoveRetiredTasks,
  } = useRetiredTasks();

  const {
    addScheduledTask,
    handleAutoScheduleAndSort,
    sortBy,
  } = useSchedulerTasks(todayString);

  const [isProcessingCommand, setIsProcessingCommand] = useState(false);

  const handleAutoScheduleSink = useCallback(async () => {
    setIsProcessingCommand(true);
    try {
      await handleAutoScheduleAndSort(sortBy, 'sink-only', [], todayString);
    } finally {
      setIsProcessingCommand(false);
    }
  }, [handleAutoScheduleAndSort, sortBy, todayString]);

  const handleRezone = useCallback(async (task: RetiredTask) => {
    setIsProcessingCommand(true);
    try {
      const rezonedTaskData = await rezoneRetiredTaskMutation(task);
      if (rezonedTaskData) {
        const duration = rezonedTaskData.duration || 30;
        const now = new Date();
        const startTime = now;
        const endTime = addMinutes(startTime, duration);

        await addScheduledTask({
          name: rezonedTaskData.name,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          break_duration: rezonedTaskData.break_duration,
          scheduled_date: format(startTime, 'yyyy-MM-dd'),
          is_critical: rezonedTaskData.is_critical,
          is_flexible: true,
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
  }, [rezoneRetiredTaskMutation, addScheduledTask]);

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
      <AetherSink 
        retiredTasks={retiredTasks} 
        onRezoneTask={handleRezone} 
        onRemoveRetiredTask={handleRemove} 
        onAutoScheduleSink={handleAutoScheduleSink} 
        isLoading={isLoadingRetiredTasks} 
        isProcessingCommand={isProcessingCommand} 
        profile={profile}
        retiredSortBy={retiredSortBy} 
        setRetiredSortBy={setRetiredSortBy} 
        addRetiredTask={addRetiredTask}
        toggleRetiredTaskLock={toggleRetiredTaskLock}
        completeRetiredTask={completeRetiredTask}
        updateRetiredTaskStatus={updateRetiredTaskStatus}
        updateRetiredTaskDetails={updateRetiredTaskDetails}
        triggerAetherSinkBackup={triggerAetherSinkBackup}
        bulkRemoveRetiredTasks={bulkRemoveRetiredTasks}
      />
    </div>
  );
};

export default AetherSinkPage;