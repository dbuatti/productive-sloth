import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import SortableTaskCard from './SortableTaskCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RetiredTask, TaskEnvironment } from '@/types/scheduler'; // NEW: Import TaskEnvironment
import { useSession } from '@/hooks/use-session';
import { parseSinkTaskInput } from '@/lib/scheduler-utils'; // Corrected import syntax
import { showError } from '@/utils/toast';
import { useRetiredTasks } from '@/hooks/use-retired-tasks'; // NEW: Import useRetiredTasks

interface KanbanColumnProps {
  id: string; // e.g., 'work', 'not-work', 'breaks'
  title: string;
  icon: React.ReactNode;
  tasks: RetiredTask[];
  totalEnergy: number;
  activeTaskHeight?: number;
  activeId: string | null;
  overId: string | null;
  onOpenDetailDialog: (task: RetiredTask) => void;
  onQuickAdd: (input: string, columnId: string) => Promise<void>; // Added onQuickAdd prop
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({ 
  id, 
  title, 
  icon, 
  tasks, 
  totalEnergy, 
  activeTaskHeight = 80, 
  activeId, 
  overId,
  onOpenDetailDialog,
  onQuickAdd // Destructure new prop
}) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  const [localInput, setLocalInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useSession();
  // Removed direct addRetiredTask here, now handled by onQuickAdd prop

  const handleSubmit = async () => {
    if (!localInput.trim()) return;
    if (!user) return showError("User missing.");

    setIsSubmitting(true);
    try {
      await onQuickAdd(localInput, id); // Use the prop to add task
      setLocalInput('');
    } catch (e: any) {
      showError(`Failed to add task: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isOverColumn = isOver || (overId && tasks.some(t => t.id === overId));
  const receiverClasses = isOverColumn ? "bg-primary/10 ring-1 ring-primary/20" : "bg-transparent";

  return (
    <div 
      ref={setNodeRef} 
      className={cn(
        "flex-1 min-w-[320px] flex flex-col rounded-2xl transition-all duration-200 overflow-x-hidden flex-shrink-0 glass-card p-4", /* Added glass-card and padding */
        receiverClasses
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-black uppercase tracking-tighter text-sm opacity-70">
            {title}
            <span className="ml-2 opacity-30 text-xs">[{tasks.length}]</span>
          </h3>
        </div>
        <span className="text-[9px] font-mono font-bold text-muted-foreground/70">{totalEnergy}⚡</span>
      </div>
      
      <div className="flex flex-col gap-3 min-h-[100px] flex-1">
        <SortableContext items={tasks.map(t => t.id)} id={id} strategy={verticalListSortingStrategy}>
          <div className="space-y-3 flex-1">
            {tasks.map((task) => (
              <SortableTaskCard 
                key={task.id} 
                task={task} 
                onOpenDetailDialog={onOpenDetailDialog} 
                isOverTarget={overId === task.id} 
              />
            ))}
            
            {/* NEW: Add a visual indicator for dropping into an empty column or at the end */}
            {isOver && tasks.length === 0 && (
              <div 
                className="w-full rounded-xl bg-primary/10 border-2 border-dashed border-primary/30 flex items-center justify-center text-primary/70 text-sm font-bold uppercase tracking-widest"
                style={{ height: activeTaskHeight - 8, margin: '4px 0' }}
              >
                Drop Here
              </div>
            )}
            {isOver && tasks.length > 0 && !overId && ( // If over the column but not over any specific task, means drop at end
              <div 
                className="w-full rounded-xl bg-primary/10 border-2 border-dashed border-primary/30 flex items-center justify-center text-primary/70 text-sm font-bold uppercase tracking-widest"
                style={{ height: activeTaskHeight - 8, margin: '4px 0' }}
              >
                Drop Here
              </div>
            )}
          </div>
        </SortableContext>
        
        {/* INLINE COLUMN TERMINAL */}
        <div className={cn(
          "relative group transition-all duration-300 rounded-2xl border-2 border-dashed p-1 shrink-0",
          localInput ? "border-primary/40 bg-primary/5" : "border-white/5 bg-white/[0.02] hover:border-white/10"
        )}>
          <div className="flex items-center gap-1">
            <Input 
              value={localInput} 
              onChange={(e) => setLocalInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="Inject objective: Name [dur]..."
              className="border-none bg-transparent focus-visible:ring-0 text-xs font-bold placeholder:opacity-20 h-10 px-3"
            />
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={handleSubmit}
              disabled={!localInput.trim() || isSubmitting}
              className={cn(
                "h-8 w-8 rounded-xl transition-all",
                localInput ? "text-primary opacity-100" : "opacity-20"
              )}
            >
              {isSubmitting ? (
                <div className="h-4 w-4 border-2 border-primary border-t-transparent animate-spin rounded-full" />
              ) : (
                <Plus className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KanbanColumn;