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
import { Home, Laptop, Globe, Music, Star, Info, AlertCircle, Briefcase, Coffee } from 'lucide-react'; // NEW: Import Briefcase and Coffee
import KanbanColumn from './KanbanColumn';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import { useSession } from '@/hooks/use-session';
import { showError } from '@/utils/toast';
import { parseSinkTaskInput } from '@/lib/scheduler-utils';
import { useEnvironments } from '@/hooks/use-environments';

// --- Main Kanban Board Component ---
interface SinkKanbanBoardProps {
  retiredTasks: RetiredTask[];
  groupBy: 'environment' | 'priority' | 'type'; // NEW: Added 'type' grouping
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
  const { environments, isLoading } = useEnvironments();
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
    } else if (groupBy === 'priority') {
      // Use priority groups
      groups['critical'] = [];
      groups['standard'] = [];
      groups['backburner'] = [];
    } else if (groupBy === 'type') { // NEW: Group by type
      groups['work'] = [];
      groups['not-work'] = [];
      groups['breaks'] = [];
    }

    retiredTasks.forEach(task => {
      let groupKey: string;
      
      if (groupBy === 'environment') {
        groupKey = task.task_environment || 'laptop';
      } else if (groupBy === 'priority') {
        if (task.is_critical) groupKey = 'critical';
        else if (task.is_backburner) groupKey = 'backburner';
        else groupKey = 'standard';
      } else if (groupBy === 'type') { // NEW: Grouping logic for 'type'
        if (task.is_break) groupKey = 'breaks';
        else if (task.is_work) groupKey = 'work';
        else groupKey = 'not-work';
      }
      
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(task);
    });
    
    return groups;
  }, [retiredTasks, groupBy, environments]);

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
      // Check if the environment exists in our list
      const validEnvironment = environments.some(env => env.value === overContainerId);
      if (validEnvironment) {
        updateData = { task_environment: overContainerId as TaskEnvironment };
      }
    } else if (groupBy === 'priority') {
      if (overContainerId === 'critical') {
        updateData = { is_critical: true, is_backburner: false, is_break: false }; // NEW: Cannot be break if critical
      } else if (overContainerId === 'backburner') {
        updateData = { is_critical: false, is_backburner: true, is_break: false }; // NEW: Cannot be break if backburner
      } else if (overContainerId === 'standard') {
        updateData = { is_critical: false, is_backburner: false, is_break: false }; // NEW: Default to not break
      }
    } else if (groupBy === 'type') { // NEW: Grouping logic for 'type'
      if (overContainerId === 'work') {
        updateData = { is_work: true, is_break: false };
      } else if (overContainerId === 'not-work') {
        updateData = { is_work: false, is_break: false };
      } else if (overContainerId === 'breaks') {
        updateData = { is_break: true, is_work: false };
      }
    }
    
    if (Object.keys(updateData).length > 0) {
      updateRetiredTask({ id: activeId, ...updateData });
    }
  };

  const handleQuickAdd = useCallback(async (input: string, columnId: string) => {
    if (!user) return showError("User context missing.");
    
    // 1. Parse the input string (Name [dur] [!] [-] [W] [B])
    const parsedTask = parseSinkTaskInput(input, user.id);
    if (!parsedTask) {
      return showError("Invalid task format. Use 'Name [dur] [!] [-] [W] [B]'.");
    }
    
    // 2. Override environment/priority/type based on the column ID
    let finalTask = { ...parsedTask };
    
    if (groupBy === 'environment') {
      // Check if the environment exists in our list
      const validEnvironment = environments.some(env => env.value === columnId);
      if (validEnvironment) {
        finalTask.task_environment = columnId as TaskEnvironment;
      }
    } else if (groupBy === 'priority') {
      if (columnId === 'critical') {
        finalTask.is_critical = true;
        finalTask.is_backburner = false;
        finalTask.is_break = false; // NEW: Cannot be break if critical
      } else if (columnId === 'backburner') {
        finalTask.is_critical = false;
        finalTask.is_backburner = true;
        finalTask.is_break = false; // NEW: Cannot be break if backburner
      } else {
        // standard
        finalTask.is_critical = false;
        finalTask.is_backburner = false;
        finalTask.is_break = false; // NEW: Default to not break
      }
    } else if (groupBy === 'type') { // NEW: Grouping logic for 'type'
      if (columnId === 'work') {
        finalTask.is_work = true;
        finalTask.is_break = false;
      } else if (columnId === 'not-work') {
        finalTask.is_work = false;
        finalTask.is_break = false;
      } else if (columnId === 'breaks') {
        finalTask.is_break = true;
        finalTask.is_work = false;
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

  // NEW: Type options for grouping
  const typeOptions = [
    { value: 'work', label: '💻 Work', icon: Briefcase, color: 'hsl(var(--primary))' },
    { value: 'not-work', label: '✨ Not Work', icon: Star, color: 'hsl(var(--logo-yellow))' },
    { value: 'breaks', label: '☕ Breaks', icon: Coffee, color: 'hsl(var(--logo-orange))' },
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
        ) : groupBy === 'priority' ? (
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
        ) : ( // NEW: Group by type
          typeOptions.map((option) => {
            const columnTasks = groupedTasks[option.value] || [];
            const totalEnergy = columnTasks.reduce((sum, t) => sum + (t.energy_cost || 0), 0);
            
            const IconComponent = option.icon;
            
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
        )}
      </div>
    </DndContext>
  );
};

export default SinkKanbanBoard;