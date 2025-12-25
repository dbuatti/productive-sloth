import React, { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/hooks/use-session';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import { DBScheduledTask, TaskEnvironment } from '@/types/scheduler';
import { isMeal, compactScheduleLogic } from '@/lib/scheduler-utils';
import { showSuccess, showError } from '@/utils/toast';
import { differenceInMinutes, parseISO, isAfter, addMinutes } from 'date-fns';
import EnergyFeedbackSlider from '@/components/EnergyFeedbackSlider';
import { analyzeEnergyPatterns } from '@/lib/learning-engine';

const SchedulerPage = () => {
  // Mock state and variables for context
  const [showEnergyFeedback, setShowEnergyFeedback] = useState(false);
  const [feedbackTask, setFeedbackTask] = useState<DBScheduledTask | null>(null);
  const [feedbackPredictedDrain, setFeedbackPredictedDrain] = useState(0);
  const [isFeedbackProcessing, setIsFeedbackProcessing] = useState(false);
  const [selectedDay, setSelectedDay] = useState('2023-10-27'); // Example date
  const scheduleContainerRef = useRef(null);
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { submitEnergyFeedback, updateScheduledTaskStatus, completeScheduledTaskMutation, compactScheduledTasks, triggerEnergyRegen } = useSchedulerTasks(selectedDay, scheduleContainerRef);

  // Mock variables for the completion logic
  const selectedDayAsDate = new Date();
  const workdayStartTime = new Date();
  const workdayEndTime = new Date();
  const T_current = new Date();
  const sortBy = 'PRIORITY_HIGH_TO_LOW';
  const formattedSelectedDay = '2023-10-27';
  const activeItemToday = null;
  const nextItemToday = null;
  const isCurrentlyActive = false;
  const setIsFocusModeActive = (val: boolean) => {};

  const handleSchedulerAction = useCallback(async (
    action: 'complete' | 'skip' | 'takeBreak' | 'startNext' | 'justFinish' | 'exitFocus',
    task: DBScheduledTask,
    isEarlyCompletion: boolean = false,
    remainingDurationMinutes: number = 0,
    index: number | null = null
  ) => {
    if (action === 'complete') {
      const isMealTask = isMeal(task.name);
      const isBreakTask = task.name.toLowerCase() === 'break';
      
      if (!isMealTask && !isBreakTask && !isEarlyCompletion) {
        setFeedbackTask(task);
        setFeedbackPredictedDrain(task.energy_cost);
        setShowEnergyFeedback(true);
        return;
      }

      const isFixedOrTimed = !task.is_flexible || isMealTask || task.name.toLowerCase() === 'time off';

      if (isFixedOrTimed) {
        await updateScheduledTaskStatus({ taskId: task.id, isCompleted: true });
        showSuccess(`Task "${task.name}" completed!`);
      } else {
        await completeScheduledTaskMutation(task);
        if (task.is_flexible) {
          const latestDbScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', user?.id, formattedSelectedDay, sortBy]) || [];
          const compactedTasks = compactScheduleLogic(
              latestDbScheduledTasks,
              selectedDayAsDate,
              workdayStartTime,
              workdayEndTime,
              T_current
          );
          const tasksToUpdate = compactedTasks.filter(t => t.start_time && t.end_time);
          if (tasksToUpdate.length > 0) {
              await compactScheduledTasks({ tasksToUpdate });
              showSuccess(`Task "${task.name}" completed! Schedule compacted.`);
          } else {
              showSuccess(`Task "${task.name}" completed! No flexible tasks to compact.`);
          }
        } else {
          showSuccess(`Task "${task.name}" completed!`);
        }
      }
      
      if (task.name.toLowerCase() === 'break' || isMealTask) {
        await triggerEnergyRegen();
      }

      if (isCurrentlyActive) {
          if (!nextItemToday || isAfter(nextItemToday.startTime, addMinutes(T_current, 5))) {
            setIsFocusModeActive(false);
          }
      }
    }
  }, [/* dependencies */]);

  const handleFeedbackSubmit = async (reportedDrain: number) => {
    if (!feedbackTask) return;
    setIsFeedbackProcessing(true);

    try {
      await submitEnergyFeedback({
        taskName: feedbackTask.name,
        predictedDrain: feedbackPredictedDrain,
        reportedDrain: reportedDrain,
        originalSource: 'scheduled_tasks',
        taskDuration: feedbackTask.start_time && feedbackTask.end_time 
          ? differenceInMinutes(parseISO(feedbackTask.end_time), parseISO(feedbackTask.start_time))
          : null,
        taskEnvironment: feedbackTask.task_environment,
      });

      const isFixedOrTimed = !feedbackTask.is_flexible;
      if (isFixedOrTimed) {
        await updateScheduledTaskStatus({ taskId: feedbackTask.id, isCompleted: true });
      } else {
        await completeScheduledTaskMutation(feedbackTask);
        if (feedbackTask.is_flexible) {
          const latestDbScheduledTasks = queryClient.getQueryData<DBScheduledTask[]>(['scheduledTasks', user?.id, formattedSelectedDay, sortBy]) || [];
          const compactedTasks = compactScheduleLogic(
              latestDbScheduledTasks,
              selectedDayAsDate,
              workdayStartTime,
              workdayEndTime,
              T_current
          );
          const tasksToUpdate = compactedTasks.filter(t => t.start_time && t.end_time);
          if (tasksToUpdate.length > 0) {
              await compactScheduledTasks({ tasksToUpdate });
          }
        }
      }

      if (user?.id) {
        const patternTip = await analyzeEnergyPatterns(user.id);
        if (patternTip) {
          setTimeout(() => showSuccess(`Learning Tip: ${patternTip}`), 1500);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['completedTasksForSelectedDayList', user?.id, formattedSelectedDay] });

      if (activeItemToday && feedbackTask.id === activeItemToday.id) {
        if (!nextItemToday || isAfter(nextItemToday.startTime, addMinutes(T_current, 5))) {
          setIsFocusModeActive(false);
        }
      }

      showSuccess(`Task "${feedbackTask.name}" completed! Feedback recorded.`);

    } catch (error: any) {
      showError(`Failed to complete task and submit feedback: ${error.message}`);
      console.error("Feedback submission and completion error:", error);
    } finally {
      setIsFeedbackProcessing(false);
      setFeedbackTask(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* ... other components ... */}
      <EnergyFeedbackSlider
        isOpen={showEnergyFeedback}
        onClose={() => {
          setShowEnergyFeedback(false);
          setFeedbackTask(null);
        }}
        onSubmit={handleFeedbackSubmit}
        taskName={feedbackTask?.name || ''}
        predictedDrain={feedbackPredictedDrain}
        isProcessing={isFeedbackProcessing}
      />
    </div>
  );
};

export default SchedulerPage;