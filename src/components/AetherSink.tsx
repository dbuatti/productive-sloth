import React, { useState, useCallback } from 'react';
import { RetiredTask, NewRetiredTask, RetiredTaskSortBy } from '@/types/scheduler';
import { Trash2, RotateCcw, Ghost, Plus, CheckCircle, List, LayoutDashboard, Loader2, Star, Briefcase, Coffee, Trash, ArrowUpToLine, Lock, Unlock } from 'lucide-react'; 
import { format, parseISO } from 'date-fns';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import RetiredTaskDetailSheet from './RetiredTaskDetailSheet'; 
import { useSinkView } from '@/hooks/use-sink-view';
import { UserProfile, useSession } from '@/hooks/use-session';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { parseSinkTaskInput, getEmojiHue, assignEmoji } from '@/lib/scheduler-utils';
import { showError, showSuccess } from '@/utils/toast';
import { cn } from '@/lib/utils';
import SinkKanbanBoard from './SinkKanbanBoard';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface AetherSinkProps {
  retiredTasks: RetiredTask[];
  isLoading: boolean;
  onRemoveRetiredTask: (taskId: string, taskName: string) => Promise<void>;
  onRezoneTask: (task: RetiredTask) => Promise<void>;
  onAutoScheduleSink: () => Promise<void>;
  isProcessingCommand: boolean;
  profile: UserProfile | null;
  retiredSortBy: RetiredTaskSortBy;
  setRetiredSortBy: (sortBy: RetiredTaskSortBy) => void;
  addRetiredTask: (newTask: NewRetiredTask) => Promise<RetiredTask>;
  toggleRetiredTaskLock: ({ taskId, isLocked }: { taskId: string; isLocked: boolean }) => Promise<void>;
  completeRetiredTask: (task: RetiredTask) => Promise<void>;
  updateRetiredTaskStatus: ({ taskId, isCompleted }: { taskId: string; isCompleted: boolean }) => Promise<void>;
  updateRetiredTaskDetails: (task: Partial<RetiredTask> & { id: string }) => Promise<RetiredTask | undefined>;
  bulkRemoveRetiredTasks: (ids: string[]) => Promise<void>;
}

const AetherSink: React.FC<AetherSinkProps> = React.memo(({ 
  retiredTasks, onRezoneTask, onRemoveRetiredTask, onAutoScheduleSink, isLoading, isProcessingCommand, profile, addRetiredTask, toggleRetiredTaskLock, completeRetiredTask, updateRetiredTaskStatus, updateRetiredTaskDetails, bulkRemoveRetiredTasks,
}) => {
  const { user } = useSession();
  const { viewMode, groupBy, showEmptyColumns, setViewMode } = useSinkView();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRetiredTask, setSelectedRetiredTask] = useState<RetiredTask | null>(null);
  const [localInput, setLocalInput] = useState('');

  const handleToggleComplete = async (task: RetiredTask) => {
    if (task.is_locked) return showError(`Unlock "${task.name}" first.`);
    task.is_completed ? await updateRetiredTaskStatus({ taskId: task.id, isCompleted: false }) : await completeRetiredTask(task);
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !localInput.trim()) return;
    const parsed = parseSinkTaskInput(localInput, user.id);
    if (!parsed) return showError("Invalid format.");
    await addRetiredTask(parsed);
    setLocalInput('');
  };

  return (
    <div className="w-full space-y-8 animate-pop-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Archive</h1>
          <span className="text-xs font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{retiredTasks.length}</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-secondary p-1 rounded-lg">
            <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('list')} className="h-7 px-3 text-[11px] font-bold uppercase tracking-tight">List</Button>
            <Button variant={viewMode === 'kanban' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('kanban')} className="h-7 px-3 text-[11px] font-bold uppercase tracking-tight">Board</Button>
          </div>
          <Button variant="outline" size="sm" onClick={onAutoScheduleSink} disabled={isProcessingCommand || retiredTasks.length === 0} className="h-9 px-4 text-[11px] font-bold uppercase tracking-tight">Auto Schedule</Button>
        </div>
      </div>

      <div className="space-y-4">
        {viewMode === 'list' && (
          <form onSubmit={handleQuickAdd} className="flex gap-2">
            <Input placeholder="Add to archive..." value={localInput} onChange={(e) => setLocalInput(e.target.value)} className="flex-grow h-10 bg-muted/50 border-none focus-visible:ring-1" />
            <Button type="submit" disabled={!localInput.trim() || isProcessingCommand} size="icon" className="h-10 w-10 rounded-lg"><Plus className="h-5 w-5" /></Button>
          </form>
        )}

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin opacity-20" /></div>
        ) : retiredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border border-dashed rounded-xl bg-muted/20">
            <Ghost className="h-8 w-8 mb-3 opacity-20" />
            <p className="text-sm font-medium">Archive is empty</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {viewMode === 'list' ? (
              <div className="space-y-1">
                {retiredTasks.map((task) => (
                  <motion.div 
                    key={task.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    onClick={() => { setSelectedRetiredTask(task); setIsDialogOpen(true); }}
                    className={cn("group flex items-center justify-between p-3 rounded-xl hover:bg-secondary/50 transition-colors cursor-pointer", task.is_completed && "opacity-40")}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="text-2xl shrink-0">{assignEmoji(task.name)}</span>
                      <div className="min-w-0">
                        <p className={cn("font-semibold text-sm truncate", task.is_completed && "line-through")}>{task.name}</p>
                        <p className="text-[10px] font-medium text-muted-foreground">{task.duration}m • {task.energy_cost}⚡</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              handleToggleComplete(task); 
                            }} 
                            className="h-8 w-8 text-logo-green hover:bg-logo-green/10"
                          >
                            <CheckCircle className={cn("h-4 w-4", task.is_completed ? "fill-current" : "")} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Complete Task</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              toggleRetiredTaskLock({ taskId: task.id, isLocked: !task.is_locked }); 
                            }} 
                            className={cn("h-8 w-8", task.is_locked ? "text-primary" : "text-muted-foreground/30")}
                          >
                            {task.is_locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{task.is_locked ? "Unlock Task" : "Lock Task"}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onRezoneTask(task); }} className="h-8 w-8"><RotateCcw className="h-4 w-4" /></Button>
                        </TooltipTrigger>
                        <TooltipContent>Re-zone to Schedule</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onRemoveRetiredTask(task.id, task.name); }} className="h-8 w-8 text-destructive/60 hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete Task</TooltipContent>
                      </Tooltip>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <SinkKanbanBoard retiredTasks={retiredTasks} groupBy={groupBy} showEmptyColumns={showEmptyColumns} onRemoveRetiredTask={onRemoveRetiredTask} onRezoneTask={onRezoneTask} updateRetiredTask={async (updates) => { await updateRetiredTaskDetails(updates); }} onOpenDetailDialog={(t) => { setSelectedRetiredTask(t); setIsDialogOpen(true); }} />
            )}
          </AnimatePresence>
        )}
      </div>
      
      <RetiredTaskDetailSheet task={selectedRetiredTask} open={isDialogOpen} onOpenChange={setIsDialogOpen} />
    </div>
  );
});

AetherSink.displayName = 'AetherSink';
export default AetherSink;