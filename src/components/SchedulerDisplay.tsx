"use client";

import React from 'react';
import { DBScheduledTask, FormattedSchedule } from '@/types/scheduler';
import { cn } from '@/lib/utils';

// THE FIX: Component must have its own interface, NOT SchedulerPageProps
interface SchedulerDisplayProps {
  schedule: FormattedSchedule | null;
  T_current: Date;
  onRemoveTask: (taskId: string, name: string, index: number) => void;
  onRetireTask: (task: DBScheduledTask) => void;
  onCompleteTask: (task: DBScheduledTask, index?: number) => void;
  activeItemId: string | null;
  selectedDayString: string;
  onAddTaskClick: () => void;
  onScrollToItem: (id: string) => void;
  isProcessingCommand: boolean;
  onFreeTimeClick: (start: Date, end: Date) => void;
}

const SchedulerDisplay: React.FC<SchedulerDisplayProps> = React.memo(({
  schedule,
  T_current,
  onCompleteTask,
  // ... other props
}) => {
  // CORRECTED: Local logic only. 
  // Do NOT try to call handleCommand or SchedulerContextBar here.
  return (
    <div className="relative min-h-[400px]">
      {/* Timeline rendering logic goes here */}
      <div className="text-muted-foreground text-center py-10">
        Temporal Timeline Initialized...
      </div>
    </div>
  );
});

SchedulerDisplay.displayName = 'SchedulerDisplay';
export default SchedulerDisplay;