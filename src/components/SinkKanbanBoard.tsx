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
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import { useSession } from '@/hooks/use-session';
import { showError } from '@/utils/toast';
import { parseSinkTaskInput } from '@/lib/scheduler-utils';
import { useEnvironments } from '@/hooks/use-environments';

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
  const { environments, isLoading } = useEnvironments();
  const { addRetiredTask } = useSchedulerTasks('');
  
  const [activeTask, setActiveTask] = useState<RetiredTask | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const groupedTasks = useMemo(() => {
    const groups: Record<string, RetiredTask[]> = {};
    if (groupBy === 'environment') environments.forEach(env => groups[env.value] = []);
    else if (groupBy === 'priority') ['critical', 'standard', 'backburner'].forEach(k => groups[k] = []);
    else ['work', 'not-work', 'breaks'].forEach(k => groups[k] = []);

    retiredTasks.forEach(task => {
      let key = 'standard';
      if (groupBy === 'environment') key = task.task_environment || 'laptop';
      else if (groupBy === 'priority') key = task.is_critical ? 'critical' : (task.is_backburner ? 'backburner' : 'standard');
      else key = task.is_break ? 'breaks' : (task.is_work ? 'work' : 'not-work');
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(task);
    });
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
    if (groupBy === 'environment' && environments.some(e => e.value === overContainerId)) update = { task_environment: overContainerId as TaskEnvironment };
    else if (groupBy === 'priority') {
      if (overContainerId === 'critical') update = { is_critical: true, is_backburner: false };
      else if (overContainerId === 'backburner') update = { is_critical: false, is_backburner: true };
      else update = { is_critical: false, is_backburner: false };
    } else if (groupBy === 'type') {
      if (overContainerId === 'work') update = { is_work: true, is_break: false };
      else if (overContainerId === 'not-work') update = { is_work: false, is_break: false };
      else if (overContainerId === 'breaks') update = { is_break: true, is_work: false };
    }
    
    if (Object.keys(update).length > 0) updateRetiredTask({ id: task.id, ...update });
  };

  const handleQuickAdd = useCallback(async (input: string, columnId: string) => {
    if (!user) return showError("User missing.");
    const parsed = parseSinkTaskInput(input, user.id);
    if (!parsed) return showError("Invalid format: 'Name [dur] [!] [-] [W] [B]'");
    
    if (groupBy === 'environment') parsed.task_environment = columnId;
    else if (groupBy === 'priority') {
      parsed.is_critical = columnId === 'critical';
      parsed.is_backburner = columnId === 'backburner';
    } else if (groupBy === 'type') {
      parsed.is_work = columnId === 'work';
      parsed.is_break = columnId === 'breaks';
    }
    await addRetiredTask(parsed);
  }, [user, groupBy, addRetiredTask]);

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
      <div className="flex w-full gap-6 items-start pb-4 overflow-x-auto custom-scrollbar">
        {Object.entries(groupedTasks).map(([id, tasks]) => {
          let label = id;
          let Icon = Info;
          if (groupBy === 'environment') {
            const env = environments.find(e => e.value === id);
            label = env?.label || id;
            Icon = env?.icon === 'Home' ? Home : env?.icon === 'Laptop' ? Laptop : env?.icon === 'Globe' ? Globe : Music;
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