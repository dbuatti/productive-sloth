import React, { useState, useCallback, useMemo } from 'react';
import { RetiredTask, NewRetiredTask, RetiredTaskSortBy } from '@/types/scheduler';
import { Trash2, RotateCcw, Ghost, Sparkles, Database, Lock, Unlock, Zap, Plus, CheckCircle, List, LayoutDashboard, History, RefreshCcw, Eye, EyeOff, Loader2, Star, Briefcase, Coffee } from 'lucide-react'; 
import { format } from 'date-fns';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import RetiredTaskDetailSheet from './RetiredTaskDetailSheet'; 
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel, } from '@/components/ui/dropdown-menu';
import { useSinkView, SinkViewMode } from '@/hooks/use-sink-view';
import { UserProfile, useSession } from '@/hooks/use-session';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { useAetherSinkSnapshots } from '@/hooks/use-aether-sink-snapshots';
import { useEnvironments } from '@/hooks/use-environments';
import { parseSinkTaskInput, getEmojiHue, assignEmoji } from '@/lib/scheduler-utils';
import { showError, showSuccess } from '@/utils/toast';
import { cn } from '@/lib/utils';
import SinkKanbanBoard from './SinkKanbanBoard';

interface AetherSinkProps {
  retiredTasks: RetiredTask[];
  isLoading: boolean;
  onRemoveRetiredTask: (taskId: string, taskName: string) => Promise<void>;
  onRezoneTask: (task: RetiredTask) => Promise<void>;
  onAutoScheduleSink: () => Promise<void>;
  isProcessingCommand: boolean;
  setIsProcessingCommand: React.Dispatch<React.SetStateAction<boolean>>;
  profile: UserProfile | null;
  retiredSortBy: RetiredTaskSortBy;
  setRetiredSortBy: (sortBy: RetiredTaskSortBy) => void;
  addRetiredTask: (newTask: NewRetiredTask) => Promise<RetiredTask>;
  toggleRetiredTaskLock: ({ taskId, isLocked }: { taskId: string; isLocked: boolean }) => Promise<void>;
  completeRetiredTask: (task: RetiredTask) => Promise<void>;
  updateRetiredTaskStatus: ({ taskId, isCompleted }: { taskId: string; isCompleted: boolean }) => Promise<void>;
  updateRetiredTaskDetails: (task: Partial<RetiredTask> & { id: string }) => Promise<RetiredTask | undefined>;
  triggerAetherSinkBackup: () => Promise<void>;
  bulkRemoveRetiredTasks: (ids: string[]) => Promise<void>;
}

const AetherSink: React.FC<AetherSinkProps> = React.memo(({ 
  retiredTasks, onRezoneTask, onRemoveRetiredTask, onAutoScheduleSink, isLoading, isProcessingCommand, profile, retiredSortBy, setRetiredSortBy, addRetiredTask, toggleRetiredTaskLock, completeRetiredTask, updateRetiredTaskStatus, updateRetiredTaskDetails, triggerAetherSinkBackup, bulkRemoveRetiredTasks,
}) => {
  const { user } = useSession();
  const { snapshots, restoreSnapshot, deleteSnapshot } = useAetherSinkSnapshots();
  const { viewMode, groupBy, showEmptyColumns, setViewMode, setGroupBy, setShowEmptyColumns } = useSinkView();
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 shadow-inner">
            <Trash2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter">Aether Sink</h1>
            <p className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest">Temporal Holding Area • {retiredTasks.length} Objectives</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-secondary/40 p-1 rounded-xl border border-white/5">
            <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('list')} className="h-8 rounded-lg gap-2 text-[10px] font-black uppercase tracking-widest"><List className="h-3.5 w-3.5" /> List</Button>
            <Button variant={viewMode === 'kanban' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('kanban')} className="h-8 rounded-lg gap-2 text-[10px] font-black uppercase tracking-widest"><LayoutDashboard className="h-3.5 w-3.5" /> Board</Button>
          </div>
          <Button variant="aether" size="sm" onClick={onAutoScheduleSink} disabled={isProcessingCommand || retiredTasks.length === 0} className="h-10 px-4 font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg shadow-primary/20"><Sparkles className="h-4 w-4 mr-2" /> Auto Sync</Button>
        </div>
      </div>

      <div className="space-y-6">
        {viewMode === 'list' && (
          <form onSubmit={handleQuickAdd} className="flex gap-2 glass-card p-2 rounded-2xl shadow-lg">
            <Input placeholder="Inject objective: Name [dur] [!] [-] [W] [B]..." value={localInput} onChange={(e) => setLocalInput(e.target.value)} className="flex-grow h-12 bg-transparent font-bold placeholder:font-medium placeholder:opacity-30 border-none focus-visible:ring-0" />
            <Button type="submit" disabled={!localInput.trim() || isProcessingCommand} className="h-12 w-12 rounded-xl shadow-md"><Plus className="h-5 w-5" /></Button>
          </form>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-40" /><p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/50">Synchronizing Sink...</p></div>
        ) : retiredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-6 border-2 border-dashed border-white/5 rounded-3xl bg-secondary/5 animate-pop-in">
            <div className="p-6 rounded-full bg-secondary/20"><Ghost className="h-12 w-12 text-muted-foreground/20" /></div>
            <div className="space-y-2">
              <p className="text-lg font-black uppercase tracking-tighter text-muted-foreground/60">Aether Sink Vacant</p>
              <p className="text-xs font-bold text-muted-foreground/30 uppercase tracking-widest max-w-[250px] mx-auto">Objectives will manifest here upon retirement from the timeline.</p>
            </div>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {viewMode === 'list' ? (
              <div className="grid gap-3">
                {retiredTasks.map((task) => {
                  const hue = getEmojiHue(task.name);
                  const accentColor = `hsl(${hue} 70% 50%)`;
                  return (
                    <motion.div 
                      key={task.id} layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                      onClick={() => { setSelectedRetiredTask(task); setIsDialogOpen(true); }}
                      className={cn("group relative flex items-center justify-between p-4 rounded-2xl border-none transition-all duration-300 cursor-pointer bg-card/40 hover:bg-secondary/40 shadow-sm", task.is_locked && "bg-primary/[0.03]", task.is_completed && "opacity-40 grayscale")}
                      style={{ borderLeft: `4px solid ${task.is_locked ? 'hsl(var(--primary))' : accentColor}` }}
                    >
                      <div className="flex items-center gap-4 flex-grow min-w-0">
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleToggleComplete(task); }} className={cn("h-10 w-10 shrink-0 rounded-full", task.is_completed ? "text-logo-green bg-logo-green/10" : "bg-secondary/50 text-muted-foreground/30 hover:text-logo-green")}>
                          <CheckCircle className="h-6 w-6" />
                        </Button>
                        <div className="min-w-0 flex-grow">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-2xl shrink-0 group-hover:scale-125 transition-transform duration-500">{assignEmoji(task.name)}</span>
                            <span className={cn("font-black uppercase tracking-tighter truncate text-base", task.is_completed && "line-through")}>{task.name}</span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground/60">
                            {task.is_critical && <Star className="h-3 w-3 fill-logo-yellow text-logo-yellow" />}
                            {task.is_work && <Briefcase className="h-3 w-3 text-primary" />}
                            {task.is_break && <Coffee className="h-3 w-3 text-logo-orange" />}
                            <span>{task.duration}m</span>
                            <span>{task.energy_cost}⚡</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onRezoneTask(task); }} className="h-9 w-9 text-primary/60 hover:text-primary"><RotateCcw className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onRemoveRetiredTask(task.id, task.name); }} className="h-9 w-9 text-destructive/40 hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </motion.div>
                  );
                })}
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