import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import AetherSink from '@/components/AetherSink';
import { RetiredTaskSortBy } from '@/types/scheduler';

const AetherSinkPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useSession();
  
  // We need to fetch retired tasks. 
  // Since useSchedulerTasks requires a selectedDate, we pass today's date, 
  // but the AetherSink component only uses the retiredTasks data.
  const todayString = new Date().toISOString().split('T')[0];
  
  const { 
    retiredTasks, 
    isLoadingRetiredTasks, 
    rezoneTask, 
    removeRetiredTask, 
    handleAutoScheduleAndSort, 
    sortBy, 
    retiredSortBy, 
    setRetiredSortBy,
    addRetiredTask,
    toggleRetiredTaskLock,
    completeRetiredTask,
    updateRetiredTaskStatus,
    updateRetiredTaskDetails,
    triggerAetherSinkBackup
  } = useSchedulerTasks(todayString);

  const [isProcessingCommand, setIsProcessingCommand] = useState(false);

  // Handlers specific to the Sink Page
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
      await rezoneTask(task);
    } finally {
      setIsProcessingCommand(false);
    }
  }, [rezoneTask]);

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
    <div className="w-full max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <Button variant="outline" onClick={() => navigate('/scheduler')} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Scheduler
        </Button>
      </div>

      {/* Sink Component */}
      <AetherSink 
        retiredTasks={retiredTasks} 
        onRezoneTask={handleRezone} 
        onRemoveRetiredTask={handleRemove} 
        onAutoScheduleSink={handleAutoScheduleSink} 
        isLoading={isLoadingRetiredTasks} 
        isProcessingCommand={isProcessingCommand} 
        profile={null} // Profile not needed for basic sink operations here
        retiredSortBy={retiredSortBy} 
        setRetiredSortBy={setRetiredSortBy} 
      />
    </div>
  );
};

export default AetherSinkPage;