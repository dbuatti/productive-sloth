"use client";

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { DndContext, DragEndEvent, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors, DragStartEvent, DragOverEvent } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { RetiredTask, TaskEnvironment } from '@/types/scheduler';
import { 
  Star, Info, AlertCircle, Loader2
} from 'lucide-react'; // Removed Home, Laptop, Globe, Music icons
import KanbanColumn from './KanbanColumn';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import { useSession } from '@/hooks/use-session';
import { showError } from '@/utils/toast';
import { parseSinkTaskInput } from '@/lib/scheduler-utils';
import { useEnvironmentContext } from '@/hooks/use-environment-context'; // NEW: Import useEnvironmentContext
import { getLucideIcon } from '@/lib/icons'; // NEW: Import getLucideIcon

// --- Grouping Configuration ---
const GROUPING_CONFIG = (environmentOptions: { value: string; label: string; icon: React.ElementType; originalEnvId: string; }[]) => ({
  environment: {
    title: 'Environment',
    options: environmentOptions.map(env => env.originalEnvId), // Use originalEnvId as option
    getLabel: (value: string) => {
      const env = environmentOptions.find(opt => opt.originalEnvId === value);
      return env ? env.label : value;
    },
    getIcon: (value: string) => {
      const env = environmentOptions.find(opt => opt.originalEnvId === value);
      const Icon = env ? getLucideIcon(env.icon.displayName || 'Laptop') : null;
      return Icon ? <Icon className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />; // Fallback icon
    }
  },
  priority: {
    title: 'Priority Tier',
    options: ['critical', 'standard', 'backburner'] as const,
    getLabel: (value: string) => {
      const labels: Record<string, string> = {
        critical: '🔥 Critical', standard: '⚪ Standard', backburner: '🔵 Backburner'
      };
      return labels[value] || value;
    },
    getIcon: (value: string) => {
      const icons: Record<string, React.ElementType> = {
        critical: Star, standard: Info, backburner: AlertCircle
      };
      const Icon = icons[value] || Info;
      return <Icon className="h-4 w-4" />;
    }
  }
});

// --- Main Kanban Board Component ---
interface SinkKanbanBoardProps {
  retiredTasks: RetiredTask[];
  groupBy: 'environment' | 'priority';
  onRemoveRetiredTask: (id: string, name: string) => void;
  onRezoneTask: (task: RetiredTask) => void;
  updateRetiredTask: (updates: Partial<RetiredTask> & { id: string }) => Promise<void>;
  onOpenDetailDialog: (task: RetiredTask) => void;
}

const SinkKanbanBoard: React.FC<SinkKanbanBoardProps> = ({
  retiredTasks,
  groupBy,
  onRemoveRetiredTask,
  onRezoneTask,
  updateRetiredTask,
  onOpenDetailDialog,
}) => {
  const { user } = useSession();
  const { addRetiredTask } = useSchedulerTasks('');
  const { environmentOptions, isLoadingEnvironments } = useEnvironmentContext(); // NEW: Get dynamic environments

  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const config = useMemo(() => GROUPING_CONFIG(environmentOptions), [environmentOptions, groupBy]);

  // Group tasks based on the selected grouping option
  const groupedTasks = useMemo(() => {
    const groups: Record<string, RetiredTask[]> = {};
    
    config[groupBy].options.forEach(option => {
      groups[option] = [];
    });

    retiredTasks.forEach(task => {
      let groupKey: string;
      
      if (groupBy === 'environment') {
        groupKey = task.task_environment || (environmentOptions[0]?.originalEnvId || 'laptop'); // Fallback to first available or 'laptop'
      } else {
        if (task.is_critical) groupKey = 'critical';
        else if (task.is_backburner) groupKey = 'backburner';
        else groupKey = 'standard';
      }

      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(task);
    });

    return groups;
  }, [retiredTasks, groupBy, config, environmentOptions]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over?.id as string || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overContainerId = over.data.current?.sortable?.containerId || over.id;

    const activeTask = retiredTasks.find(t => t.id === activeId);
    if (!activeTask) return;

    let updateData: Partial<RetiredTask> = {};

    if (groupBy === 'environment') {
      if ((config.environment.options as readonly string[]).includes(overContainerId)) {
        updateData = { task_environment: overContainerId as TaskEnvironment };
      }
    } else {
      if (overContainerId === 'critical') {
        updateData = { is_critical: true, is_backburner: false };
      } else if (overContainerId === 'backburner') {
        updateData = { is_critical: false, is_backburner: true };
      } else if (overContainerId === 'standard') {
        updateData = { is_critical: false, is_backburner: false };
      }
    }

    if (Object.keys(updateData).length > 0) {
      updateRetiredTask({ id: activeId, ...updateData });
    }
  };
  
  const handleQuickAdd = useCallback(async (input: string, columnId: string) => {
    if (!user) return showError("User context missing.");
    
    const parsedTask = parseSinkTaskInput(input, user.id);
    
    if (!parsedTask) {
      return showError("Invalid task format. Use 'Name [dur] [!] [-]'.");
    }
    
    let finalTask = { ...parsedTask };
    
    if (groupBy === 'environment') {
      finalTask.task_environment = columnId as TaskEnvironment;
    } else {
      if (columnId === 'critical') {
        finalTask.is_critical = true;
        finalTask.is_backburner = false;
      } else if (columnId === 'backburner') {
        finalTask.is_critical = false;
        finalTask.is_backburner = true;
      } else { // standard
        finalTask.is_critical = false;
        finalTask.is_backburner = false;
      }
    }
    
    await addRetiredTask(finalTask);
  }, [user, groupBy, addRetiredTask]);

  const activeTaskHeight = useMemo(() => {
    if (!activeId) return 0;
    const task = retiredTasks.find(t => t.id === activeId);
    return task ? 80 : 0; 
  }, [activeId, retiredTasks]);

  if (isLoadingEnvironments) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading environments...</span>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex w-full gap-6 items-start pb-2 overflow-x-auto custom-scrollbar"> 
        {config[groupBy].options.map((option) => {
          const columnTasks = groupedTasks[option] || [];
          const totalEnergy = columnTasks.reduce((sum, t) => sum + (t.energy_cost || 0), 0);

          return (
            <KanbanColumn
              key={option}
              id={option}
              title={config[groupBy].getLabel(option)}
              icon={config[groupBy].getIcon(option)}
              tasks={columnTasks}
              totalEnergy={totalEnergy}
              onQuickAdd={handleQuickAdd}
              activeTaskHeight={activeTaskHeight}
              activeId={activeId}
              overId={overId}
              onOpenDetailDialog={onOpenDetailDialog}
            />
          );
        })}
      </div>
    </DndContext>
  );
};

export default SinkKanbanBoard;