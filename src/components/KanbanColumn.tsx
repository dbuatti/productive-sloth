import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import SortableTaskCard from './SortableTaskCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RetiredTask } from '@/types/scheduler';

const LOG_PREFIX = "[KANBAN_COLUMN]";

interface KanbanColumnProps {
  id: string; // e.g., 'home', 'laptop'
  title: string;
  icon: React.ReactNode;
  tasks: RetiredTask[];
  totalEnergy: number;
  onQuickAdd: (text: string, columnId: string) => Promise<void>;
  activeTaskHeight?: number;
  activeId: string | null;
  overId: string | null;
  // NEW: Prop for opening the detail dialog
  onOpenDetailDialog: (task: RetiredTask) => void;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({ 
  id, 
  title, 
  icon, 
  tasks, 
  totalEnergy, 
  onQuickAdd, 
  activeTaskHeight = 80, 
  activeId, 
  overId,
  onOpenDetailDialog 
}) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  const [localInput, setLocalInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!localInput.trim()) return;
    setIsSubmitting(true);
    console.log(`${LOG_PREFIX} Quick adding to column ${id}:`, localInput);
    await onQuickAdd(localInput, id);
    setLocalInput('');
    setIsSubmitting(false);
  };

  const isOverColumn = isOver || (overId && tasks.some(t => t.id === overId));
  const receiverClasses = isOverColumn ? "bg-primary/10 ring-1 ring-primary/20" : "bg-transparent";

  const items = tasks.map(t => t.id);
  const activeIndex = activeId ? items.indexOf(activeId) : -1;
  const overIndex = overId ? items.indexOf(overId) : -1;

  let placeholderIndex = -1;
  if (isOverColumn && activeId && activeIndex === -1) {
    placeholderIndex = overIndex === -1 ? items.length : overIndex;
  } else if (isOverColumn && activeId && activeIndex !== -1) {
    placeholderIndex = overIndex;
  }

  return (
    <div 
      ref={setNodeRef} 
      className={cn(
        "flex-1 min-w-[320px] flex flex-col rounded-2xl transition-all duration-200 overflow-x-hidden flex-shrink-0",
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
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3 flex-1">
            {tasks.map((task, index) => {
              const isPlaceholder = activeId === task.id;
              
              if (placeholderIndex === index && !isPlaceholder) {
                return (
                  <div 
                    key="placeholder" 
                    className="w-full rounded-xl bg-primary/10 border-2 border-dashed border-primary/30 flex items-center justify-center text-primary/70 text-sm font-bold uppercase tracking-widest mb-2"
                    style={{ height: activeTaskHeight - 8, margin: '4px 0' }}
                  >
                    Drop Here
                  </div>
                );
              }
              
              return (
                <SortableTaskCard 
                  key={task.id} 
                  task={task} 
                  onOpenDetailDialog={onOpenDetailDialog} // Pass the handler
                />
              );
            })}
            
            {/* Render placeholder at the end if the column is empty or the drop target is the end */}
            {isOverColumn && tasks.length === 0 && (
              <div 
                key="placeholder-empty" 
                className="w-full rounded-xl bg-primary/10 border-2 border-dashed border-primary/30 flex items-center justify-center text-primary/70 text-sm font-bold uppercase tracking-widest"
                style={{ height: activeTaskHeight - 8, margin: '4px 0' }}
              >
                Drop Here
              </div>
            )}
            
            {isOverColumn && tasks.length > 0 && placeholderIndex === tasks.length && (
              <div 
                key="placeholder-end" 
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
              placeholder="Inject objective: Name [dur] [!] [-]..."
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