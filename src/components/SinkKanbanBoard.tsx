import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { 
  DndContext, 
  DragEndEvent, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  DragStartEvent, 
  DragOverEvent 
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { RetiredTask, TaskEnvironment } from '@/types/scheduler';
import { Home, Laptop, Globe, Music, Star, Info, AlertCircle } from 'lucide-react';
import KanbanColumn from './KanbanColumn';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import { useSession } from '@/hooks/use-session';
import { showError } from '@/utils/toast';
import { parseSinkTaskInput } from '@/lib/scheduler-utils';
import { useEnvironments } from '@/hooks/use-environments'; // NEW: Import useEnvironments hook

const LOG_PREFIX = "[SINK_KANBAN_BOARD]";

// --- Main Kanban Board Component ---
interface SinkKanbanBoardProps {
  retiredTasks: RetiredTask[];
  groupBy: 'environment' | 'priority';
  onRemoveRetiredTask: (id: string, name: string) => void;
  onRezoneTask: (task: RetiredTask) => void;
  updateRetiredTask: (updates: Partial<RetiredTask> & { id: string }) => Promise<void>;
  // NEW: Handlers for opening the detail dialog
  onOpenDetailDialog: (task: RetiredTask) => void;
}

const SinkKanbanBoard: React.FC<SinkKanbanBoardProps> = ({ 
  retiredTasks, 
  groupBy, 
  onRemoveRetiredTask, 
  onRezoneTask, 
  updateRetiredTask,
  onOpenDetailDialog, // Destructure new prop
}) => {
  const { user } = useSession();
  const { environments, isLoading } = useEnvironments(); // NEW: Use environments hook
  const { addRetiredTask } = useSchedulerTasks('');
  
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Use distance constraint (5px) to differentiate click from drag
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Group tasks based on the selected grouping option
  const groupedTasks = useMemo(() => {
    const groups: Record<string, RetiredTask[]> = {};
    
    if (groupBy === 'environment') {
      // Use dynamic environments for grouping
      environments.forEach(env => {
        groups[env.value] = [];
      });
    } else {
      // Use priority groups
      groups['critical'] = [];
      groups['standard'] = [];
      groups['backburner'] = [];
    }

    retiredTasks.forEach(task => {
      let groupKey: string;
      
      if (groupBy === 'environment') {
        groupKey = task.task_environment || 'laptop';
      } else {
        if (task.is_critical) groupKey = 'critical';
        else if (task.is_backburner) groupKey = 'backburner';
        else groupKey = 'standard';
      }
      
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(task);
    });
    
    console.log(`${LOG_PREFIX} Grouped tasks by ${groupBy}:`, groups);
    return groups;
  }, [retiredTasks, groupBy, environments]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    console.log(`${LOG_PREFIX} Drag started for task:`, event.active.id);
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
      // Check if the environment exists in our list
      const validEnvironment = environments.some(env => env.value === overContainerId);
      if (validEnvironment) {
        updateData = { task_environment: overContainerId as TaskEnvironment };
        console.log(`${LOG_PREFIX} Drag end: Moving task ${activeTask.name} to environment ${overContainerId}`);
      }
    } else {
      if (overContainerId === 'critical') {
        updateData = { is_critical: true, is_backburner: false };
        console.log(`${LOG_PREFIX} Drag end: Moving task ${activeTask.name} to critical`);
      } else if (overContainerId === 'backburner') {
        updateData = { is_critical: false, is_backburner: true };
        console.log(`${LOG_PREFIX} Drag end: Moving task ${activeTask.name} to backburner`);
      } else if (overContainerId === 'standard') {
        updateData = { is_critical: false, is_backburner: false };
        console.log(`${LOG_PREFIX} Drag end: Moving task ${activeTask.name} to standard`);
      }
    }
    
    if (Object.keys(updateData).length > 0) {
      updateRetiredTask({ id: activeId, ...updateData });
    }
  };

  const handleQuickAdd = useCallback(async (input: string, columnId: string) => {
    if (!user) return showError("User context missing.");
    
    // 1. Parse the input string (Name [dur] [!] [-])
    const parsedTask = parseSinkTaskInput(input, user.id);
    if (!parsedTask) {
      return showError("Invalid task format. Use 'Name [dur] [!] [-]'.");
    }
    
    // 2. Override environment/priority based on the column ID
    let finalTask = { ...parsedTask };
    
    if (groupBy === 'environment') {
      // Check if the environment exists in our list
      const validEnvironment = environments.some(env => env.value === columnId);
      if (validEnvironment) {
        finalTask.task_environment = columnId as TaskEnvironment;
        console.log(`${LOG_PREFIX} Quick add to environment column: ${columnId}, task:`, finalTask);
      }
    } else {
      if (columnId === 'critical') {
        finalTask.is_critical = true;
        finalTask.is_backburner = false;
        console.log(`${LOG_PREFIX} Quick add to critical column, task:`, finalTask);
      } else if (columnId === 'backburner') {
        finalTask.is_critical = false;
        finalTask.is_backburner = true;
        console.log(`${LOG_PREFIX} Quick add to backburner column, task:`, finalTask);
      } else {
        // standard
        finalTask.is_critical = false;
        finalTask.is_backburner = false;
        console.log(`${LOG_PREFIX} Quick add to standard column, task:`, finalTask);
      }
    }
    
    // 3. Add to retired tasks
    await addRetiredTask(finalTask);
  }, [user, groupBy, environments, addRetiredTask]);

  // Calculate the height of the active task for the drop indicator
  const activeTaskHeight = useMemo(() => {
    if (!activeId) return 0;
    
    // Find the task being dragged
    const task = retiredTasks.find(t => t.id === activeId);
    
    // Approximate card height (based on SortableTaskCard styling)
    return task ? 80 : 0;
  }, [activeId, retiredTasks]);

  // Get environment options for grouping
  const environmentOptions = useMemo(() => {
    return environments.map(env => ({
      value: env.value,
      label: env.label,
      icon: env.icon,
      color: env.color,
    }));
  }, [environments]);

  // Get priority options for grouping
  const priorityOptions = [
    { value: 'critical', label: '🔥 Critical', icon: Star },
    { value: 'standard', label: '⚪ Standard', icon: Info },
    { value: 'backburner', label: '🔵 Backburner', icon: AlertCircle },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
      {/* The Columns Container: flex w-full gap-6 items-start */}
      <div className="flex w-full gap-6 items-start pb-2 overflow-x-auto custom-scrollbar">
        {groupBy === 'environment' ? (
          environmentOptions.map((option) => {
            const columnTasks = groupedTasks[option.value] || [];
            const totalEnergy = columnTasks.reduce((sum, t) => sum + (t.energy_cost || 0), 0);
            
            // Get the icon component
            const IconComponent = option.icon === 'Home' ? Home : 
                                option.icon === 'Laptop' ? Laptop : 
                                option.icon === 'Globe' ? Globe : 
                                option.icon === 'Music' ? Music : Info;
            
            return (
              <KanbanColumn
                key={option.value}
                id={option.value}
                title={option.label}
                icon={<IconComponent className="h-4 w-4" style={{ color: option.color }} />}
                tasks={columnTasks}
                totalEnergy={totalEnergy}
                onQuickAdd={handleQuickAdd}
                activeTaskHeight={activeTaskHeight}
                activeId={activeId}
                overId={overId}
                onOpenDetailDialog={onOpenDetailDialog} // Pass the handler down
              />
            );
          })
        ) : (
          priorityOptions.map((option) => {
            const columnTasks = groupedTasks[option.value] || [];
            const totalEnergy = columnTasks.reduce((sum, t) => sum + (t.energy_cost || 0), 0);
            
            const IconComponent = option.icon;
            
            return (
              <KanbanColumn
                key={option.value}
                id={option.value}
                title={option.label}
                icon={<IconComponent className="h-4 w-4" />}
                tasks={columnTasks}
                totalEnergy={totalEnergy}
                onQuickAdd={handleQuickAdd}
                activeTaskHeight={activeTaskHeight}
                activeId={activeId}
                overId={overId}
                onOpenDetailDialog={onOpenDetailDialog} // Pass the handler down
              />
            );
          })
        )}
      </div>
    </DndContext>
  );
};

export default SinkKanbanBoard;