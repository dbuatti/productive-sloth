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

  // Normalization that handles emojis and complex symbols
  const normalize = (s: string) => {
    if (!s) return '';
    return s.toLowerCase()
      .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // Remove emojis
      .replace(/[^a-z0-9]/g, '');            // Remove special characters
  };

  const groupedTasks = useMemo(() => {
    const groups: Record<string, RetiredTask[]> = {};
    
    // 1. Initialize core groups for Priority and Type views
    if (groupBy === 'priority') {
      ['critical', 'standard', 'backburner'].forEach(k => groups[k] = []);
    } else if (groupBy === 'type') {
      ['work', 'not-work', 'breaks'].forEach(k => groups[k] = []);
    }

    // 2. Assign tasks to groups with smart environment matching
    retiredTasks.forEach(task => {
      let key = 'standard';
      
      if (groupBy === 'environment') {
        const rawValue = task.task_environment || 'laptop';
        const normValue = normalize(rawValue);
        
        // Logic to match legacy tags (like 'laptop_piano') to current environments
        const matchingEnv = environments.find(e => {
          const eValueNorm = normalize(e.value);
          const eLabelNorm = normalize(e.label);
          
          return (
            e.value === rawValue ||               // Exact match (e.g. "kinesiology")
            eValueNorm === normValue ||           // Case/symbol insensitive match
            eLabelNorm === normValue ||           // Match against label (e.g. "recordingproduction" matches "Recording/Production")
            normValue.includes(eValueNorm) ||     // Partial match (e.g. "laptop_piano" includes "laptop")
            eValueNorm.includes(normValue)
          );
        });

        key = matchingEnv ? matchingEnv.value : rawValue;

      } else if (groupBy === 'priority') {
        key = task.is_critical ? 'critical' : (task.is_backburner ? 'backburner' : 'standard');
      } else {
        key = task.is_break ? 'breaks' : (task.is_work ? 'work' : 'not-work');
      }
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(task);
    });

    // 3. Clean up empty columns in environment view
    if (groupBy === 'environment') {
      Object.keys(groups).forEach(key => {
        if (groups[key].length === 0) delete groups[key];
      });
      
      // Starter columns if totally empty
      if (retiredTasks.length === 0) {
        environments.slice(0, 3).forEach(env => groups[env.value] = []);
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