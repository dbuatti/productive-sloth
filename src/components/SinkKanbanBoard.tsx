import React, { useMemo, useState, useCallback } from 'react';
import { 
  DndContext, DragEndEvent, closestCorners, KeyboardSensor, PointerSensor, 
  useSensor, useSensors, DragStartEvent, DragOverEvent, DragOverlay, defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { RetiredTask, TaskEnvironment } from '@/types/scheduler';
import { Home, Laptop, Globe, Music, Star, Info, Briefcase, Coffee, Loader2 } from 'lucide-react';
import KanbanColumn from './KanbanColumn';
import SortableTaskCard from './SortableTaskCard';
import { useSession } from '@/hooks/use-session';
import { showError } from '@/utils/toast';
import { parseSinkTaskInput } from '@/lib/scheduler-utils';
import { useEnvironments } from '@/hooks/use-environments';
import { useRetiredTasks } from '@/hooks/use-retired-tasks';
import { getLucideIconComponent, cn } from '@/lib/utils';

interface SinkKanbanBoardProps {
  retiredTasks: RetiredTask[];
  groupBy: 'environment' | 'priority' | 'type';
  onRemoveRetiredTask: (id: string, name: string) => void;
  onRezoneTask: (task: RetiredTask) => void;
  updateRetiredTask: (updates: Partial<RetiredTask> & { id: string }) => Promise<void>;
  onOpenDetailDialog: (task: RetiredTask) => void;
}

const SinkKanbanBoard: React.FC<SinkKanbanBoardProps> = ({ 
  retiredTasks, groupBy, updateRetiredTask, onOpenDetailDialog 
}) => {
  const { user } = useSession();
  const { environments, isLoading: envLoading } = useEnvironments();
  const { addRetiredTask } = useRetiredTasks();
  
  const [activeTask, setActiveTask] = useState<RetiredTask | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Helper to normalize environment strings for matching
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

  const groupedTasks = useMemo(() => {
    const groups: Record<string, RetiredTask[]> = {};
    
    // 1. Initialize core groups for Priority and Type views (always show these)
    if (groupBy === 'priority') {
      ['critical', 'standard', 'backburner'].forEach(k => groups[k] = []);
    } else if (groupBy === 'type') {
      ['work', 'not-work', 'breaks'].forEach(k => groups[k] = []);
    }
    // Note: We don't pre-initialize environment groups anymore to avoid showing empty columns

    // 2. Assign tasks to groups
    retiredTasks.forEach(task => {
      let key = 'standard';
      
      if (groupBy === 'environment') {
        const taskEnvRaw = task.task_environment || 'laptop';
        const taskEnvNorm = normalize(taskEnvRaw);
        
        // Try to find a matching environment in the DB by value or normalized match
        const matchingEnv = environments.find(e => 
          e.value === taskEnvRaw || 
          normalize(e.value) === taskEnvNorm || 
          normalize(e.label) === taskEnvNorm
        );

        // If we found a match in the DB, use its actual value key
        key = matchingEnv ? matchingEnv.value : taskEnvRaw;

      } else if (groupBy === 'priority') {
        key = task.is_critical ? 'critical' : (task.is_backburner ? 'backburner' : 'standard');
      } else {
        key = task.is_break ? 'breaks' : (task.is_work ? 'work' : 'not-work');
      }
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(task);
    });

    // 3. For the environment view, ensure we show defined environments even if empty ONLY IF the user has few environments.
    // Otherwise, we stick to populated columns only to reduce noise.
    if (groupBy === 'environment') {
      // If we have no tasks at all, show the defined environments as empty starters
      if (retiredTasks.length === 0) {
        environments.forEach(env => {
          if (!groups[env.value]) groups[env.value] = [];
        });
      }
    }

    return groups;
  }, [retiredTasks, groupBy, environments]);

  const handleDragStart = (event: DragStartEvent) => {
    const task = retiredTasks.find(t => t.id === event.active.id);
    setActiveTask(task || null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over?.id as string || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    setOverId(null);
    
    if (!over) return;
    
    const overContainerId = over.data.current?.sortable?.containerId || over.id;
    const task = retiredTasks.find(t => t.id === active.id);
    if (!task) return;
    
    let update: Partial<RetiredTask> = {};
    
    if (groupBy === 'environment') {
      update = { task_environment: overContainerId as TaskEnvironment };
    } else if (groupBy === 'priority') {
      if (overContainerId === 'critical') update = { is_critical: true, is_backburner: false, is_break: false };
      else if (overContainerId === 'backburner') update = { is_critical: false, is_backburner: true, is_break: false };
      else update = { is_critical: false, is_backburner: false, is_break: false };
    } else if (groupBy === 'type') {
      if (overContainerId === 'work') update = { is_work: true, is_break: false };
      else if (overContainerId === 'breaks') update = { is_break: true, is_work: false };
      else update = { is_work: false, is_break: false };
    }
    
    if (Object.keys(update).length > 0) {
      updateRetiredTask({ id: task.id, ...update });
    }
  };

  const handleQuickAdd = useCallback(async (input: string, columnId: string) => {
    if (!user) return showError("User missing.");
    const parsed = parseSinkTaskInput(input, user.id);
    if (!parsed) return showError("Invalid format.");
    
    if (groupBy === 'environment') parsed.task_environment = columnId as TaskEnvironment;
    else if (groupBy === 'priority') {
      parsed.is_critical = columnId === 'critical';
      parsed.is_backburner = columnId === 'backburner';
    } else if (groupBy === 'type') {
      parsed.is_work = columnId === 'work';
      parsed.is_break = columnId === 'breaks';
    }
    
    await addRetiredTask(parsed);
  }, [user, groupBy, addRetiredTask]);

  if (envLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
      <div className="flex w-full gap-6 items-start pb-4 overflow-x-auto custom-scrollbar">
        {Object.entries(groupedTasks).map(([id, tasks]) => {
          let label = id;
          let Icon: React.ElementType = Info;

          const env = environments.find(e => e.value === id);
          if (groupBy === 'environment') {
            label = env?.label || id;
            Icon = getLucideIconComponent(env?.icon || 'Info');
          } else if (groupBy === 'priority') {
            label = id === 'critical' ? '🔥 Critical' : id === 'backburner' ? '🔵 Backburner' : '⚪ Standard';
            Icon = id === 'critical' ? Star : Info;
          } else {
            label = id === 'work' ? '💻 Work' : id === 'breaks' ? '☕ Breaks' : '✨ Not Work';
            Icon = id === 'work' ? Briefcase : (id === 'breaks' ? Coffee : Star);
          }

          return (
            <KanbanColumn 
              key={id} 
              id={id} 
              title={label} 
              icon={<Icon className="h-4 w-4" />} 
              tasks={tasks} 
              totalEnergy={tasks.reduce((s, t) => s + (t.energy_cost || 0), 0)} 
              onQuickAdd={handleQuickAdd} 
              activeId={activeTask?.id || null} 
              overId={overId} 
              onOpenDetailDialog={onOpenDetailDialog} 
            />
          );
        })}
      </div>
      <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }) }}>
        {activeTask ? <SortableTaskCard task={activeTask} onOpenDetailDialog={onOpenDetailDialog} /> : null}
      </DragOverlay>
    </DndContext>
  );
};

export default SinkKanbanBoard;