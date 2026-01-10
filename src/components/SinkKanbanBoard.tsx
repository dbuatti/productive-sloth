import React, { useState, useMemo, useCallback } from 'react';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import { useTasks } from '@/hooks/use-tasks';
import { useSession } from '@/hooks/use-session';
import { useEnvironments } from '@/hooks/use-environments';
import TaskCard from './TaskCard'; // Corrected import
import { TaskPriority } from '@/types';
import { DBScheduledTask, RetiredTask } from '@/types/scheduler'; // Added RetiredTask import
import { format, isSameDay, parseISO } from 'date-fns';
import { Button } from './ui/button';
import { Plus, Home, Laptop, Globe, Music, Zap, Briefcase, Coffee } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '@/lib/utils';
import CreateTaskDialog from './CreateTaskDialog'; // Corrected import
import TaskDetailSheetForTasks from './TaskDetailSheetForTasks'; // Corrected import
import ScheduledTaskDetailDialog from './ScheduledTaskDetailDialog'; // Corrected import
import RetiredTaskDetailDialog from './RetiredTaskDetailDialog'; // Corrected import
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';

type GroupByOption = 'environment' | 'priority' | 'status';

interface SinkKanbanBoardProps {
  selectedDay: Date;
}

// Define a type for the grouped tasks structure
interface GroupedTask {
  label: string;
  icon?: React.ElementType;
  color?: string;
  tasks: (DBScheduledTask | any | RetiredTask)[]; // Loosened type to accommodate general and retired tasks
}

const SinkKanbanBoard: React.FC<SinkKanbanBoardProps> = ({ selectedDay }) => {
  const { tasks: generalTasks, isLoading: isLoadingGeneralTasks } = useTasks();
  // Corrected destructuring from useSchedulerTasks
  const { dbScheduledTasks, dbRetiredTasks, isLoading: isLoadingScheduledTasks } = useSchedulerTasks(format(selectedDay, 'yyyy-MM-dd'));
  const { environments, isLoading: isLoadingEnvironments } = useEnvironments();
  const { profile } = useSession();

  const [isCreateTaskDialogOpen, setIsCreateTaskDialogOpen] = useState(false);
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<DBScheduledTask | null>(null);
  const [selectedGeneralTaskForDetail, setSelectedGeneralTaskForDetail] = useState<any | null>(null);
  const [selectedRetiredTaskForDetail, setSelectedRetiredTaskForDetail] = useState<RetiredTask | null>(null); // Corrected type
  const [groupBy, setGroupBy] = useState<GroupByOption>('environment');
  const [showCompleted, setShowCompleted] = useState(false);

  const allTasks = useMemo(() => {
    const combined = [
      ...generalTasks.map(task => ({ ...task, type: 'general' })),
      ...dbScheduledTasks.map(task => ({ ...task, type: 'scheduled' })), // Used dbScheduledTasks
      ...dbRetiredTasks.map(task => ({ ...task, type: 'retired' })), // Used dbRetiredTasks
    ];

    return combined.filter(task => {
      if (task.type === 'scheduled') {
        return isSameDay(parseISO(task.scheduled_date), selectedDay);
      }
      if (task.type === 'retired') {
        return isSameDay(parseISO(task.original_scheduled_date), selectedDay);
      }
      return true; // General tasks are always shown
    });
  }, [generalTasks, dbScheduledTasks, dbRetiredTasks, selectedDay]); // Updated dependencies

  const filteredTasks = useMemo(() => {
    return allTasks.filter(task => showCompleted || !task.is_completed);
  }, [allTasks, showCompleted]);

  const groupedTasks = useMemo(() => {
    const groups: Record<string, GroupedTask> = {}; // Corrected type for groups

    filteredTasks.forEach(task => {
      let groupKey: string;
      let groupLabel: string;
      let groupIcon: React.ElementType | undefined;
      let groupColor: string | undefined;

      if (groupBy === 'environment') {
        groupKey = task.task_environment || 'unknown';
        const env = environments.find(e => e.value === groupKey);
        groupLabel = env?.label || 'Unknown Environment';
        groupIcon = env?.icon; // Directly use the React.ElementType
        groupColor = env?.color;
      } else if (groupBy === 'priority') {
        groupKey = task.priority || 'MEDIUM';
        groupLabel = groupKey.charAt(0).toUpperCase() + groupKey.slice(1).toLowerCase();
        groupIcon = Zap; // Example icon for priority
        groupColor = groupKey === 'HIGH' ? '#FF6B6B' : groupKey === 'MEDIUM' ? '#FFB347' : '#4ECDC4';
      } else if (groupBy === 'status') {
        groupKey = task.is_completed ? 'completed' : 'pending';
        groupLabel = task.is_completed ? 'Completed' : 'Pending';
        groupIcon = task.is_completed ? Checkbox : Plus; // Example icons for status
        groupColor = task.is_completed ? '#4ECDC4' : '#FF6B6B';
      } else {
        groupKey = 'all';
        groupLabel = 'All Tasks';
        groupIcon = Plus;
        groupColor = '#FFFFFF';
      }

      if (!groups[groupKey]) {
        groups[groupKey] = { // Initialize as GroupedTask object
          label: groupLabel,
          icon: groupIcon,
          color: groupColor,
          tasks: [],
        };
      }
      groups[groupKey].tasks.push(task);
    });

    // Sort groups by a predefined order if applicable, or alphabetically
    const sortedGroupKeys = Object.keys(groups).sort((a, b) => {
      if (groupBy === 'priority') {
        const priorityOrder: Record<string, number> = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
        return (priorityOrder[b] || 0) - (priorityOrder[a] || 0);
      }
      return groups[a].label.localeCompare(groups[b].label);
    });

    return sortedGroupKeys.map(key => groups[key]);
  }, [filteredTasks, groupBy, environments]);

  const handleOpenCreateTaskDialog = (defaultPriority: TaskPriority, defaultDueDate: Date, defaultStartTime?: Date, defaultEndTime?: Date) => {
    setIsCreateTaskDialogOpen(true);
  };

  const handleTaskCardClick = useCallback((task: any) => {
    if (task.type === 'scheduled') {
      setSelectedTaskForDetail(task);
    } else if (task.type === 'general') {
      setSelectedGeneralTaskForDetail(task);
    } else if (task.type === 'retired') {
      setSelectedRetiredTaskForDetail(task);
    }
  }, []);

  if (isLoadingGeneralTasks || isLoadingScheduledTasks || isLoadingEnvironments) {
    return <div>Loading tasks...</div>;
  }

  return (
    <div className="flex flex-col h-full p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Tasks for {format(selectedDay, 'MMM d, yyyy')}</h2>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="show-completed"
              checked={showCompleted}
              onCheckedChange={(checked: boolean) => setShowCompleted(checked)}
            />
            <Label htmlFor="show-completed">Show Completed</Label>
          </div>
          <Select value={groupBy} onValueChange={(value: GroupByOption) => setGroupBy(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Group by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="environment">Environment</SelectItem>
              <SelectItem value="priority">Priority</SelectItem>
              <SelectItem value="status">Status</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => handleOpenCreateTaskDialog('MEDIUM', selectedDay)}>
            <Plus className="mr-2 h-4 w-4" /> Add Task
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-grow">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-4">
          {groupedTasks.map((group, index) => (
            <div key={index} className="bg-card rounded-lg shadow-md p-4">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2" style={{ color: group.color }}>
                {group.icon && <group.icon className="h-5 w-5" />}
                {group.label} ({group.tasks.length})
              </h3>
              <div className="space-y-3">
                {group.tasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onClick={() => handleTaskCardClick(task)}
                    environmentColor={environments.find(env => env.value === task.task_environment)?.color}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <CreateTaskDialog
        isOpen={isCreateTaskDialogOpen}
        onOpenChange={setIsCreateTaskDialogOpen}
        defaultPriority="MEDIUM"
        defaultDueDate={selectedDay}
        onTaskCreated={() => {}}
      />

      {selectedTaskForDetail && (
        <ScheduledTaskDetailDialog
          task={selectedTaskForDetail}
          open={!!selectedTaskForDetail}
          onOpenChange={(open) => {
            if (!open) setSelectedTaskForDetail(null);
          }}
          selectedDayString={format(selectedDay, 'yyyy-MM-dd')}
        />
      )}

      {selectedGeneralTaskForDetail && (
        <TaskDetailSheetForTasks
          task={selectedGeneralTaskForDetail}
          open={!!selectedGeneralTaskForDetail}
          onOpenChange={(open) => {
            if (!open) setSelectedGeneralTaskForDetail(null);
          }}
        />
      )}

      {selectedRetiredTaskForDetail && (
        <RetiredTaskDetailDialog
          task={selectedRetiredTaskForDetail}
          open={!!selectedRetiredTaskForDetail}
          onOpenChange={(open) => {
            if (!open) setSelectedRetiredTaskForDetail(null);
          }}
        />
      )}
    </div>
  );
};

export default SinkKanbanBoard;