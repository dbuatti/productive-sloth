"use client";

import React, { useMemo } from 'react';
import { DndContext, DragEndEvent, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RetiredTask, TaskEnvironment } from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { 
  getEmojiHue, 
  assignEmoji, 
} from '@/lib/scheduler-utils';
import { 
  Home, Laptop, Globe, Music, 
  Star, Zap, Lock, Unlock, 
  Trash2, RotateCcw, Info,
  AlertCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { motion, AnimatePresence } from 'framer-motion';

// --- Grouping Configuration ---
const GROUPING_CONFIG = {
  environment: {
    title: 'Environment',
    options: ['home', 'laptop', 'away', 'piano', 'laptop_piano'] as TaskEnvironment[],
    getLabel: (value: string) => {
      const labels: Record<string, string> = {
        home: '🏠 At Home', laptop: '💻 Laptop/Desk', away: '🗺️ Away/Errands', 
        piano: '🎹 Piano', laptop_piano: '💻 + 🎹 Production'
      };
      return labels[value] || value;
    },
    getIcon: (value: string) => {
      const icons: Record<string, React.ElementType> = {
        home: Home, laptop: Laptop, away: Globe, piano: Music, laptop_piano: Laptop
      };
      const Icon = icons[value] || Laptop;
      return <Icon className="h-4 w-4" />;
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
};

// --- Sortable Card Component ---
interface SortableCardProps {
  task: RetiredTask;
  onRemove: (id: string, name: string) => void;
  onRezone: (task: RetiredTask) => void;
  onToggleComplete: (task: RetiredTask) => void;
}

const SortableCard: React.FC<SortableCardProps> = ({ task, onRemove, onRezone, onToggleComplete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const hue = getEmojiHue(task.name);
  const emoji = assignEmoji(task.name);
  const accentColor = `hsl(${hue} 70% 50%)`;

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="opacity-30 bg-primary/10 border-2 border-dashed border-primary rounded-xl h-32"
      />
    );
  }

  return (
    <motion.div
      ref={setNodeRef}
      layout // Framer Motion layout animation
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={cn(
        "group relative p-3 rounded-xl border bg-card/40 backdrop-blur-sm hover:bg-card/60 transition-all cursor-grab active:cursor-grabbing",
        "hover:border-primary/40 hover:shadow-lg",
        task.is_locked && "border-primary/30 bg-primary/[0.03]",
        task.is_completed && "opacity-50 grayscale",
        `border-l-[4px]`,
        // --- NEW: Lift State Classes ---
        isDragging && "z-50 scale-[1.05] rotate-2 shadow-2xl shadow-primary/30 ring-2 ring-primary/50"
        // -------------------------------
      )}
      style={{ 
        borderColor: `transparent`, // Reset border color to use border-l-[4px] instead
        borderLeftColor: accentColor, // Apply color only to the left side
        ...style // Re-apply DnD transform style
      }}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl shrink-0">{emoji}</span>
          <span className={cn("font-bold text-sm truncate", task.is_completed && "line-through")}>
            {task.name}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 p-0" onClick={() => onToggleComplete(task)}>
                <Zap className={cn("h-3.5 w-3.5", task.is_completed ? "text-logo-green fill-current" : "text-muted-foreground")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle Completion</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 p-0" onClick={() => onRezone(task)}>
                <RotateCcw className="h-3.5 w-3.5 text-primary" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Re-zone to Schedule</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 p-0 hover:text-destructive" onClick={() => onRemove(task.id, task.name)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Purge</TooltipContent>
          </Tooltip>
        </div>
      </div>
      
      <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground/70">
        {task.is_locked && <Lock className="h-3 w-3 text-primary" />}
        {task.is_critical && <Star className="h-3 w-3 text-logo-yellow fill-current" />}
        {task.is_backburner && <Badge variant="outline" className="px-1 h-4 text-[9px] font-black uppercase">Orbit</Badge>}
        <span className="flex items-center gap-1">
          {task.energy_cost > 0 ? `${task.energy_cost}⚡` : '0⚡'}
        </span>
        {task.duration && <span>{task.duration}m</span>}
      </div>
    </motion.div>
  );
};

// --- Kanban Column Component (Droppable) ---
interface KanbanColumnProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  tasks: RetiredTask[];
  totalEnergy: number;
  onRemove: (id: string, name: string) => void;
  onRezone: (task: RetiredTask) => void;
  onToggleComplete: (task: RetiredTask) => void;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({ id, title, icon, tasks, totalEnergy, onRemove, onRezone, onToggleComplete }) => {
  const { setNodeRef, isOver } = useDroppable({ id });

  // --- NEW: Receiver State Classes ---
  const receiverClasses = isOver 
    ? "bg-primary/10 border-primary/50 shadow-inner shadow-primary/10" 
    : "bg-background/60 border-white/10";

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col h-full flex-1 min-w-[300px] max-w-[400px] flex-shrink-0 rounded-2xl transition-all duration-300",
        receiverClasses
      )}
    >
      <Card className="bg-transparent border-none shadow-none flex flex-col h-full overflow-hidden">
        <CardHeader className="p-3 border-b border-white/5 bg-background/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {icon}
              <CardTitle className="text-xs font-black uppercase tracking-widest">
                {title}
              </CardTitle>
            </div>
            <Badge variant="secondary" className="text-[9px] font-mono font-bold">
              {tasks.length} | {totalEnergy}⚡
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-2 flex-1 overflow-y-auto custom-scrollbar min-h-[100px]">
          <SortableContext id={id} items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2 min-h-[50px]">
              <AnimatePresence>
                {tasks.map((task) => (
                  <SortableCard
                    key={task.id}
                    task={task}
                    onRemove={onRemove}
                    onRezone={onRezone}
                    onToggleComplete={onToggleComplete}
                  />
                ))}
              </AnimatePresence>
            </div>
          </SortableContext>
        </CardContent>
      </Card>
    </div>
  );
};


// --- Main Kanban Board Component ---
interface SinkKanbanBoardProps {
  retiredTasks: RetiredTask[];
  groupBy: 'environment' | 'priority';
  onRemoveRetiredTask: (id: string, name: string) => void;
  onRezoneTask: (task: RetiredTask) => void;
  updateRetiredTask: (updates: Partial<RetiredTask> & { id: string }) => Promise<void>;
}

const SinkKanbanBoard: React.FC<SinkKanbanBoardProps> = ({
  retiredTasks,
  groupBy,
  onRemoveRetiredTask,
  onRezoneTask,
  updateRetiredTask,
}) => {
  console.log(`[SinkKanbanBoard] Rendering with groupBy: ${groupBy}, task count: ${retiredTasks.length}`);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const config = GROUPING_CONFIG[groupBy];

  // Group tasks based on the selected grouping option
  const groupedTasks = useMemo(() => {
    console.log(`[SinkKanbanBoard] Recalculating grouped tasks...`);
    const groups: Record<string, RetiredTask[]> = {};
    
    // Initialize all possible groups to ensure columns are always visible
    config.options.forEach(option => {
      groups[option] = [];
    });

    retiredTasks.forEach(task => {
      let groupKey: string;
      
      if (groupBy === 'environment') {
        groupKey = task.task_environment || 'laptop';
      } else {
        // Priority grouping
        if (task.is_critical) groupKey = 'critical';
        else if (task.is_backburner) groupKey = 'backburner';
        else groupKey = 'standard';
      }

      // Fallback if group key doesn't exist in config
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(task);
    });

    console.log(`[SinkKanbanBoard] Grouped Tasks:`, groups);
    return groups;
  }, [retiredTasks, groupBy, config.options]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    console.log(`[SinkKanbanBoard] DragEnd event triggered:`, { activeId: active?.id, overId: over?.id });

    if (!over) {
      console.log(`[SinkKanbanBoard] Drag ended without a target. Ignoring.`);
      return;
    }

    const activeId = active.id as string;
    
    // CRITICAL FIX: Get the container ID (column ID) instead of the item ID
    const overContainerId = over.data.current?.sortable?.containerId || over.id;
    console.log(`[SinkKanbanBoard] Target Container ID: ${overContainerId}`);


    // Find the task being dragged
    const activeTask = retiredTasks.find(t => t.id === activeId);
    if (!activeTask) {
      console.error(`[SinkKanbanBoard] Could not find task with id: ${activeId}`);
      return;
    }

    // Determine the new value based on the grouping type
    let updateData: Partial<RetiredTask> = {};

    if (groupBy === 'environment') {
      // The overContainerId is the column ID (e.g., 'home', 'laptop')
      if ((config.options as readonly string[]).includes(overContainerId)) {
        updateData = { task_environment: overContainerId as TaskEnvironment };
        console.log(`[SinkKanbanBoard] Environment change detected: ${activeTask.task_environment} -> ${overContainerId}`);
      }
    } else {
      // Priority grouping
      if (overContainerId === 'critical') {
        updateData = { is_critical: true, is_backburner: false };
        console.log(`[SinkKanbanBoard] Priority change detected: -> Critical`);
      } else if (overContainerId === 'backburner') {
        updateData = { is_critical: false, is_backburner: true };
        console.log(`[SinkKanbanBoard] Priority change detected: -> Backburner`);
      } else if (overContainerId === 'standard') {
        updateData = { is_critical: false, is_backburner: false };
        console.log(`[SinkKanbanBoard] Priority change detected: -> Standard`);
      }
    }

    // If we found a valid update, trigger the mutation
    if (Object.keys(updateData).length > 0) {
      console.log(`[SinkKanbanBoard] Triggering updateRetiredTask for ${activeTask.name} with:`, updateData);
      updateRetiredTask({ id: activeId, ...updateData });
    } else {
      console.log(`[SinkKanbanBoard] No valid update data found for drop target: ${overContainerId}`);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragEnd={handleDragEnd}
    >
      {/* Updated grid layout for horizontal scrolling and min-width columns */}
      <div className="flex gap-4 pb-2"> {/* Removed overflow-x-auto here */}
        {config.options.map((option) => {
          const columnTasks = groupedTasks[option] || [];
          const totalEnergy = columnTasks.reduce((sum, t) => sum + (t.energy_cost || 0), 0);

          return (
            <KanbanColumn
              key={option}
              id={option}
              title={config.getLabel(option)}
              icon={config.getIcon(option)}
              tasks={columnTasks}
              totalEnergy={totalEnergy}
              onRemove={onRemoveRetiredTask}
              onRezone={onRezoneTask}
              onToggleComplete={(t) => updateRetiredTask({ id: t.id, is_completed: !t.is_completed })}
            />
          );
        })}
      </div>
    </DndContext>
  );
};

export default SinkKanbanBoard;