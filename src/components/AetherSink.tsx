import React, { useState, useCallback, useMemo } from 'react';
import { 
  DndContext, DragEndEvent, closestCorners, KeyboardSensor, PointerSensor, 
  useSensor, useSensors, DragStartEvent, DragOverEvent, DragOverlay, defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { RetiredTask, NewRetiredTask, RetiredTaskSortBy, TaskEnvironment } from '@/types/scheduler'; // Added RetiredTaskSortBy, NewRetiredTask
import { Home, Laptop, Globe, Music, Star, Info, Briefcase, Coffee, Loader2, List, LayoutDashboard } from 'lucide-react'; // Added List, LayoutDashboard
import KanbanColumn from './KanbanColumn';
import SortableTaskCard from './SortableTaskCard';
import { useSession } from '@/hooks/use-session';
import { showError, showSuccess } from '@/utils/toast';
import { parseSinkTaskInput, getEmojiHue, assignEmoji } from '@/lib/scheduler-utils'; // Added getEmojiHue, assignEmoji
import { useEnvironments } from '@/hooks/use-environments';
import { useRetiredTasks } from '@/hooks/use-retired-tasks';
import { getLucideIconComponent, cn } from '@/lib/utils';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, RotateCcw, Ghost, Sparkles, Database, Lock, Unlock, Zap, Plus, CheckCircle, ArrowDownWideNarrow, SortAsc, SortDesc, Clock, CalendarDays, Smile, History, RefreshCcw, Eye, EyeOff } from 'lucide-react'; 
import { format } from 'date-fns';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import RetiredTaskDetailSheet from './RetiredTaskDetailSheet'; 
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel, } from '@/components/ui/dropdown-menu';
import { useSinkView, SinkViewMode, GroupingOption } from '@/hooks/use-sink-view';
import { UserProfile } from '@/hooks/use-session';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { useAetherSinkSnapshots } from '@/hooks/use-aether-sink-snapshots';
import {
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from '@/components/ui/alert-dialog';
import SinkKanbanBoard from './SinkKanbanBoard'; // Added SinkKanbanBoard

const ViewToggle = ({ viewMode, setViewMode }: { viewMode: SinkViewMode, setViewMode: (m: SinkViewMode) => void }) => (
  <div className="flex bg-secondary/50 rounded-lg p-1 border border-white/5">
    <Tooltip>
      <TooltipTrigger asChild>
        <Button 
          variant={viewMode === 'list' ? 'default' : 'ghost'} 
          size="icon" 
          className={cn("h-8 w-8 rounded-md", viewMode === 'list' && "shadow-sm")}
          onClick={() => setViewMode('list')}
          aria-label="Switch to List View"
        >
          <List className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>List View</TooltipContent>
    </Tooltip>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button 
          variant={viewMode === 'kanban' ? 'default' : 'ghost'} 
          size="icon" 
          className={cn("h-8 w-8 rounded-md", viewMode === 'kanban' && "shadow-sm")}
          onClick={() => setViewMode('kanban')}
          aria-label="Switch to Kanban View"
        >
          <LayoutDashboard className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Kanban View</TooltipContent>
    </Tooltip>
  </div>
);

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
  retiredTasks, 
  onRezoneTask, 
  onRemoveRetiredTask, 
  onAutoScheduleSink, 
  isLoading,
  isProcessingCommand, 
  setIsProcessingCommand,
  profile, 
  retiredSortBy, 
  setRetiredSortBy,
  addRetiredTask,
  toggleRetiredTaskLock,
  completeRetiredTask,
  updateRetiredTaskStatus,
  updateRetiredTaskDetails,
  triggerAetherSinkBackup,
  bulkRemoveRetiredTasks,
}) => {
  const { user } = useSession();
  const { environments, isLoading: isLoadingEnvironments } = useEnvironments();
  const { snapshots, isLoadingSnapshots, restoreSnapshot, deleteSnapshot } = useAetherSinkSnapshots();
  
  const { viewMode, groupBy, showEmptyColumns, setViewMode, setGroupBy, setShowEmptyColumns } = useSinkView();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRetiredTask, setSelectedRetiredTask] = useState<RetiredTask | null>(null);
  const [localInput, setLocalInput] = useState('');
  const [isRestoreAlertDialogOpen, setIsRestoreAlertDialogOpen] = useState(false);
  const [snapshotToRestore, setSnapshotToRestore] = useState<number | null>(null);

  const hasUnlockedRetiredTasks = useMemo(() => retiredTasks.some(task => !task.is_locked), [retiredTasks]);

  const handleAction = useCallback((e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  }, []);

  const handleOpenDetailDialog = useCallback((task: RetiredTask) => {
    setSelectedRetiredTask(task);
    setIsDialogOpen(true);
  }, []);

  const handleToggleComplete = async (task: RetiredTask) => {
    if (task.is_locked) return showError(`Unlock "${task.name}" first.`);
    task.is_completed 
      ? await updateRetiredTaskStatus({ taskId: task.id, isCompleted: false })
      : await completeRetiredTask(task);
  };

  const handleUpdateRetiredTask = useCallback(async (updates: Partial<RetiredTask> & { id: string }) => {
    try {
      await updateRetiredTaskDetails(updates);
    } catch (error) {
      console.error(`[AetherSink] Update failed for task ${updates.id}:`, error);
      showError("Failed to update task.");
    }
  }, [updateRetiredTaskDetails]);

  const handleQuickAddToList = useCallback(async (input: string) => {
    if (!user) return showError("User context missing.");
    if (!input.trim()) return;

    const parsedTask = parseSinkTaskInput(input, user.id);
    if (!parsedTask) {
      return showError("Invalid task format. Use 'Name [dur] [!] [-] [W] [B]'.");
    }

    await addRetiredTask(parsedTask);
    setLocalInput('');
  }, [user, addRetiredTask]);

  const handleBulkPurge = async () => {
    const unlockedIds = retiredTasks.filter(t => !t.is_locked).map(t => t.id);
    if (unlockedIds.length === 0) return;
    if (window.confirm(`Purge all ${unlockedIds.length} unlocked objectives?`)) {
      await bulkRemoveRetiredTasks(unlockedIds);
    }
  };

  const handleBulkLock = async () => {
    const unlocked = retiredTasks.filter(t => !t.is_locked);
    if (unlocked.length === 0) return;
    setIsProcessingCommand(true);
    try {
      for (const t of unlocked) {
        await toggleRetiredTaskLock({ taskId: t.id, isLocked: true });
      }
      showSuccess(`Locked ${unlocked.length} objectives.`);
    } finally {
      setIsProcessingCommand(false);
    }
  };

  const handleRestoreClick = (snapshotId: number) => {
    setSnapshotToRestore(snapshotId);
    setIsRestoreAlertDialogOpen(true);
  };

  const confirmRestore = async () => {
    if (snapshotToRestore === null) return;
    setIsProcessingCommand(true);
    try {
      await restoreSnapshot(snapshotToRestore);
    } finally {
      setIsProcessingCommand(false);
      setSnapshotToRestore(null);
      setIsRestoreAlertDialogOpen(false);
    }
  };

  return (
    <motion.div 
      className="w-full space-y-6 pb-8 px-4 md:px-8 lg:px-12"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <div className={cn("pb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4")}>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-secondary/50 border border-white/5 shadow-sm">
            <Trash2 className="h-6 w-6 text-muted-foreground" />
          </div>
          <span className="text-2xl font-black uppercase tracking-tighter flex items-center gap-2">
            <span>Aether Sink</span>
            <span className="text-sm font-mono text-muted-foreground opacity-50">[{retiredTasks.length}]</span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 mr-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={handleBulkLock} disabled={!hasUnlockedRetiredTasks || isProcessingCommand} className="h-10 w-10 text-primary">
                  <Lock className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Lock All Unlocked</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={handleBulkPurge} disabled={!hasUnlockedRetiredTasks || isProcessingCommand} className="h-10 w-10 text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Purge All Unlocked</TooltipContent>
            </Tooltip>
          </div>

          <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
          
          {viewMode === 'kanban' && (
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-10 px-3 text-xs font-bold uppercase tracking-widest rounded-lg">
                    Group: {groupBy === 'environment' ? 'Env' : (groupBy === 'priority' ? 'Priority' : 'Type')}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="glass-card min-w-32 border-white/10 bg-background/95 backdrop-blur-xl">
                  <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest opacity-50 px-3 py-2">Group By</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setGroupBy('environment')} className="font-bold text-xs uppercase py-2 px-3">Environment</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setGroupBy('priority')} className="font-bold text-xs uppercase py-2 px-3">Priority</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setGroupBy('type')} className="font-bold text-xs uppercase py-2 px-3">Type</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant={showEmptyColumns ? "aether" : "outline"} size="icon" onClick={() => setShowEmptyColumns(!showEmptyColumns)} className="h-10 w-10 rounded-lg">
                    {showEmptyColumns ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 opacity-50" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{showEmptyColumns ? "Hide Empty" : "Show Empty"}</TooltipContent>
              </Tooltip>
            </div>
          )}
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="aether" size="sm" onClick={onAutoScheduleSink} disabled={!hasUnlockedRetiredTasks || isLoading || isProcessingCommand} className="h-10 px-4 font-black uppercase tracking-widest text-[10px] rounded-lg">
                {isProcessingCommand ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Sparkles className="h-3 w-3 mr-2" />}
                Auto Sync
              </Button>
            </TooltipTrigger>
            <TooltipContent>Re-zone all unlocked objectives</TooltipContent>
          </Tooltip>

          {/* NEW: Manual Backup Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={triggerAetherSinkBackup} disabled={isProcessingCommand} className="h-10 px-4 font-black uppercase tracking-widest text-[10px] rounded-lg">
                {isProcessingCommand ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Database className="h-3 w-3 mr-2" />}
                Backup
              </Button>
            </TooltipTrigger>
            <TooltipContent>Create an immediate snapshot backup of the Aether Sink.</TooltipContent>
          </Tooltip>
        </div>
      </div>
      
      <div className="px-2 pb-2 space-y-6">
        {viewMode === 'list' && (
          <form onSubmit={(e) => { e.preventDefault(); handleQuickAddToList(localInput); }} className="flex gap-2 glass-card p-2 rounded-xl shadow-sm">
            <Input placeholder="Inject objective: Name [dur] [!] [-] [W] [B]..." value={localInput} onChange={(e) => setLocalInput(e.target.value)} disabled={isProcessingCommand} className="flex-grow h-12 bg-transparent font-bold placeholder:font-medium placeholder:opacity-30 border-none focus-visible:ring-0" />
            <Button type="submit" disabled={!localInput.trim() || isProcessingCommand} className="h-12 w-12 rounded-xl">
              {isProcessingCommand ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
            </Button>
          </form>
        )}
        
        {isLoading || isLoadingEnvironments || isLoadingSnapshots ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary opacity-40" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/50">Synchronizing Sink...</p>
            <div className="space-y-2 w-full px-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          </div>
        ) : retiredTasks.length === 0 && snapshots.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-4 border-2 border-dashed border-white/5 rounded-2xl bg-secondary/10 animate-pop-in">
            <Ghost className="h-12 w-12 text-muted-foreground/20" />
            <div className="space-y-1">
              <p className="text-sm font-black uppercase tracking-tighter text-muted-foreground/60">Aether Sink Vacant</p>
              <p className="text-[10px] font-bold text-muted-foreground/30 uppercase tracking-widest max-w-[200px]">Objectives will manifest here upon retirement.</p>
            </div>
          </div>
        ) : (
          <>
            {viewMode === 'list' ? (
              <div className="grid gap-2 pr-2 scrollbar-none max-h-[600px] overflow-y-auto custom-scrollbar">
                {retiredTasks.map((task) => {
                  const hue = getEmojiHue(task.name);
                  const emoji = assignEmoji(task.name);
                  const accentColor = `hsl(${hue} 70% 50%)`;
                  const { is_locked: isLocked, is_backburner: isBackburner, is_completed: isCompleted, is_work: isWork, is_break: isBreak } = task;
                  
                  return (
                    <div 
                      key={task.id}
                      onClick={() => handleOpenDetailDialog(task)}
                      className={cn(
                        "group relative flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-2xl border-none transition-all duration-300 cursor-pointer animate-pop-in",
                        "bg-card/40 hover:bg-secondary/40",
                        isLocked ? "bg-primary/[0.03]" : "border-transparent",
                        isBackburner && !isLocked && "opacity-70",
                        isCompleted && "opacity-40 grayscale"
                      )}
                      style={{ borderLeft: isLocked ? '4px solid hsl(var(--primary))' : `4px solid ${accentColor}` }}
                    >
                      <div className="flex items-center gap-4 flex-grow min-w-0">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={(e) => handleAction(e, () => handleToggleComplete(task))}
                          disabled={isLocked || isProcessingCommand}
                          className={cn("h-9 w-9 shrink-0 rounded-full", isCompleted ? "text-logo-green bg-logo-green/10" : "bg-secondary/50 text-muted-foreground/30 hover:bg-logo-green/10 hover:text-logo-green")}
                        >
                          <CheckCircle className={cn("h-5 w-5 transition-transform duration-500", !isCompleted && "group-hover:scale-110")} />
                        </Button>
                        <div className="min-w-0 flex-grow">
                          <div className="flex items-center gap-2 mb-1">
                            {task.is_critical && <Star className="h-3.5 w-3.5 fill-logo-yellow text-logo-yellow shrink-0" />}
                            {isBackburner && <Badge variant="outline" className="h-4 px-1.5 text-[9px] font-black uppercase tracking-tighter border-muted-foreground/20 text-muted-foreground/60">Orbit</Badge>}
                            {isWork && <Badge variant="outline" className="h-4 px-1.5 text-[9px] font-black uppercase tracking-tighter border-primary/20 text-primary/60">Work</Badge>}
                            {isBreak && <Badge variant="outline" className="h-4 px-1.5 text-[9px] font-black uppercase tracking-tighter border-logo-orange/20 text-logo-orange/60">Break</Badge>}
                            <span className="text-xl shrink-0 group-hover:scale-125 transition-transform duration-500">{emoji}</span>
                            <span className={cn("font-black uppercase tracking-tighter truncate text-sm sm:text-base", isCompleted && "line-through")}>{task.name}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 mt-4 sm:mt-0 ml-auto">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={(e) => handleAction(e, () => toggleRetiredTaskLock({ taskId: task.id, isLocked: !isLocked }))} disabled={isProcessingCommand} className={cn("h-9 w-9 rounded-lg", isLocked ? "text-primary bg-primary/10" : "text-muted-foreground/30")}>
                              {isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4 opacity-50" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Lock</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={(e) => handleAction(e, () => onRezoneTask(task))} disabled={isLocked || isCompleted || isProcessingCommand} className="h-9 w-9 text-primary/40 hover:text-primary rounded-lg">
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Re-zone</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={(e) => handleAction(e, () => onRemoveRetiredTask(task.id, task.name))} disabled={isLocked || isProcessingCommand} className="h-9 w-9 text-destructive/30 hover:text-destructive rounded-lg">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Purge</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <SinkKanbanBoard retiredTasks={retiredTasks} groupBy={groupBy} showEmptyColumns={showEmptyColumns} onRemoveRetiredTask={onRemoveRetiredTask} onRezoneTask={onRezoneTask} updateRetiredTask={handleUpdateRetiredTask} onOpenDetailDialog={handleOpenDetailDialog} />
            )}

            {snapshots.length > 0 && (
              <Card className="p-4 rounded-xl shadow-sm mt-8">
                <CardHeader className="px-0 pb-4"><CardTitle className="text-lg font-bold flex items-center gap-2"><History className="h-5 w-5 text-primary" /> Aether Sink Snapshots</CardTitle></CardHeader>
                <CardContent className="p-0 space-y-3">
                  {snapshots.map((snapshot) => (
                    <div key={snapshot.snapshot_id} className="flex items-center justify-between p-3 rounded-lg border bg-secondary/30">
                      <div className="flex flex-col"><span className="font-medium">Backup: {format(new Date(snapshot.backup_timestamp), 'MMM d, yyyy HH:mm')}</span><span className="text-xs text-muted-foreground">{snapshot.sink_data.length} tasks</span></div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleRestoreClick(snapshot.snapshot_id)} disabled={isProcessingCommand}><RefreshCcw className="h-4 w-4 mr-1" /> Restore</Button>
                        <Button variant="destructive" size="sm" onClick={() => deleteSnapshot(snapshot.snapshot_id)} disabled={isProcessingCommand}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
      
      <RetiredTaskDetailSheet task={selectedRetiredTask} open={isDialogOpen && selectedRetiredTask !== null} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setSelectedRetiredTask(null); }} />

      <AlertDialog open={isRestoreAlertDialogOpen} onOpenChange={setIsRestoreAlertDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Aether Sink Restore</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to restore this snapshot? This will delete all currently UNLOCKED tasks in your Sink.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessingCommand}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRestore} disabled={isProcessingCommand} className="bg-destructive hover:bg-destructive/90">Restore Snapshot</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
});

AetherSink.displayName = 'AetherSink';

export default AetherSink;