import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { 
  ScheduledItem, FormattedSchedule, DisplayItem, TimeMarker, 
  FreeTimeItem, DBScheduledTask, TaskEnvironment 
} from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { formatTime, getEmojiHue } from '@/lib/scheduler-utils';
import { Button } from '@/components/ui/button';
import { 
  Trash2, Archive, Lock, Unlock, Clock, Zap, 
  CheckCircle2, Star, Home, Laptop, Globe, Music, 
  Info, ChevronDown, Target 
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { format, differenceInMinutes, isSameDay, parseISO, min, max, isPast, addMinutes } from 'date-fns';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import ScheduledTaskDetailDialog from './ScheduledTaskDetailDialog';

interface SchedulerDisplayProps {
  schedule: FormattedSchedule | null;
  T_current: Date;
  onRemoveTask: (taskId: string, taskName: string, index: number) => void;
  onRetireTask: (task: DBScheduledTask) => void;
  onCompleteTask: (task: DBScheduledTask, index?: number) => void;
  activeItemId: string | null;
  selectedDayString: string;
  onAddTaskClick: () => void;
  onScrollToItem: (itemId: string) => void;
  isProcessingCommand: boolean;
  onFreeTimeClick: (startTime: Date, endTime: Date) => void;
}

const MINUTE_HEIGHT = 2.5;

const getEnvironmentIcon = (environment: TaskEnvironment) => {
  const iconClass = "h-3.5 w-3.5 opacity-70";
  switch (environment) {
    case 'home': return <Home className={iconClass} />;
    case 'laptop': return <Laptop className={iconClass} />;
    case 'away': return <Globe className={iconClass} />;
    case 'piano': return <Music className={iconClass} />;
    default: return null;
  }
};

const SchedulerDisplay: React.FC<SchedulerDisplayProps> = React.memo(({
  schedule,
  T_current,
  onRemoveTask,
  onRetireTask,
  onCompleteTask,
  activeItemId,
  selectedDayString,
  onFreeTimeClick,
  onScrollToItem
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { toggleScheduledTaskLock } = useSchedulerTasks(selectedDayString, null);
  const [selectedTask, setSelectedTask] = useState<DBScheduledTask | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showSyncButton, setShowSyncButton] = useState(false);

  // ... rest of the component logic
  return (
    <div className="relative">
      {/* ... content ... */}
      <ScheduledTaskDetailDialog
        task={selectedTask}
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setSelectedTask(null);
        }}
        selectedDayString={selectedDayString}
      />
    </div>
  );
});

SchedulerDisplay.displayName = 'SchedulerDisplay';
export default SchedulerDisplay;