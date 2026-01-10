import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, RotateCcw, Ghost, Sparkles, Loader2, Lock, Unlock, Zap, Star, Plus, CheckCircle, ArrowDownWideNarrow, SortAsc, SortDesc, Clock, CalendarDays, Smile, Database, Home, Laptop, Globe, Music, LayoutDashboard, List, Briefcase, Coffee } from 'lucide-react'; 
import { RetiredTask, RetiredTaskSortBy, TaskEnvironment } from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { getEmojiHue, assignEmoji, parseSinkTaskInput } from '@/lib/scheduler-utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useSession } from '@/hooks/use-session';
import { showError } from '@/utils/toast';
import RetiredTaskDetailSheet from './RetiredTaskDetailSheet'; 
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel, } from '@/components/ui/dropdown-menu';
import { useSinkView, SinkViewMode, GroupingOption } from '@/hooks/use-sink-view';
import SinkKanbanBoard from './SinkKanbanBoard';
import { UserProfile } from '@/hooks/use-session';
import { Button } from '@/components/ui/button';
import { useEnvironments } from '@/hooks/use-environments';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion'; // Import motion for animations

const getEnvironmentIcon = (environment: TaskEnvironment) => {
  const iconClass = "h-3.5 w-3.5 opacity-70";
  switch (environment) {
    case 'home': return <Home className={iconClass} />;
    case 'laptop': return <Laptop className={iconClass} />;
    case 'away': return <Globe className={iconClass} />;
    case 'piano': return <Music className={iconClass} />;
    case 'laptop_piano':
      return (
        <div className="relative">
          <Laptop className={iconClass} />
          <Music className="h-2 w-2 absolute -bottom-0.5 -right-0.5" />
        </div>
      );
    default: return null;
  }
};

const SortItem = ({ type, label, icon: Icon, currentSort, onSelect }: { type: RetiredTaskSortBy, label: string, icon: any, currentSort: RetiredTaskSortBy, onSelect: (s: RetiredTaskSortBy) => void }) => (
  <DropdownMenuItem 
    onClick={() => onSelect(type)} 
    className={cn("cursor-pointer font-bold text-xs uppercase tracking-widest", currentSort === type && 'bg-primary/10 text-primary')}
    aria-label={`Sort by ${label}`}
  >
    <Icon className="mr-2 h-4 w-4" />
    {label}
  </DropdownMenuItem>
);

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
  onRezoneTask: (task: RetiredTask) => void;
  onRemoveRetiredTask: (taskId: string, taskName: string) => void;
  onAutoScheduleSink: () => void;
  isLoading: boolean;
  isProcessingCommand: boolean;
  profile: UserProfile | null;
  retiredSortBy: RetiredTaskSortBy;
  setRetiredSortBy: (sortBy: RetiredTaskSortBy) => void;
}

const AetherSink: React.FC<AetherSinkProps> = React.memo(({ 
  retiredTasks, 
  onRezoneTask, 
  onRemoveRetiredTask, 
  onAutoScheduleSink, 
  isLoading, 
  isProcessingCommand, 
  profile, 
  retiredSortBy, 
  setRetiredSortBy 
}) => {
  const { user } = useSession();
  const { environments, isLoading: isLoadingEnvironments } = useEnvironments();
  const { toggleRetiredTaskLock, addRetiredTask, completeRetiredTask, updateRetiredTaskStatus, triggerAetherSinkBackup, updateRetiredTaskDetails } = useSchedulerTasks('');
  
  const { viewMode, groupBy, setViewMode, setGroupBy } = useSinkView();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRetiredTask, setSelectedRetiredTask] = useState<RetiredTask | null>(null);
  const [localInput, setLocalInput] = useState('');

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

  const handleManualAetherSinkBackup = async () => {
    if (!profile?.enable_aethersink_backup) {
      return showError("Aether Sink backup is disabled in settings.");
    }
    await triggerAetherSinkBackup();
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

  return (
    <motion.div 
      className="w-full space-y-6 pb-8 px-4 md:px-8 lg:px-12" // Adjusted padding for better responsiveness
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
          <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
          
          {viewMode === 'kanban' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-10 px-3 text-xs font-bold uppercase tracking-widest rounded-lg"
                  aria-label="Group Kanban Board"
                >
                  Group: {groupBy === 'environment' ? 'Env' : (groupBy === 'priority' ? 'Priority' : 'Type')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass-card min-w-32 border-white/10 bg-background/95 backdrop-blur-xl">
                <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest opacity-50 px-3 py-2">Group By</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setGroupBy('environment')} className="font-bold text-xs uppercase py-2 px-3" aria-label="Group by Environment">Environment</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setGroupBy('priority')} className="font-bold text-xs uppercase py-2 px-3" aria-label="Group by Priority">Priority</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setGroupBy('type')} className="font-bold text-xs uppercase py-2 px-3" aria-label="Group by Type">Type</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          {viewMode === 'list' && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="glass" 
                    size="icon" 
                    onClick={handleManualAetherSinkBackup}
                    disabled={isProcessingCommand}
                    className="h-10 w-10 text-primary rounded-lg"
                    aria-label="Manual Aether Sink Backup"
                  >
                    {isProcessingCommand ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Manual Backup</TooltipContent>
              </Tooltip>
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="glass" 
                        disabled={retiredTasks.length === 0}
                        className="h-10 w-10 rounded-lg"
                        aria-label="Sort Aether Sink Tasks"
                      >
                        <ArrowDownWideNarrow className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Sort Terminal</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end" className="glass-card min-w-48 border-white/10 bg-background/95 backdrop-blur-xl">
                  <DropdownMenuLabel className="text-[10px] uppercase font-black tracking-[0.2em] opacity-50 mb-1">Sorting Logic</DropdownMenuLabel>
                  <SortItem type="RETIRED_AT_NEWEST" label="Retired (Newest)" icon={CalendarDays} currentSort={retiredSortBy} onSelect={setRetiredSortBy} />
                  <SortItem type="RETIRED_AT_OLDEST" label="Retired (Oldest)" icon={CalendarDays} currentSort={retiredSortBy} onSelect={setRetiredSortBy} />
                  <DropdownMenuSeparator className="my-2 bg-white/5" />
                  <SortItem type="DURATION_DESC" label="Duration (Long)" icon={Clock} currentSort={retiredSortBy} onSelect={setRetiredSortBy} />
                  <SortItem type="DURATION_ASC" label="Duration (Short)" icon={Clock} currentSort={retiredSortBy} onSelect={setRetiredSortBy} />
                  <DropdownMenuSeparator className="my-2 bg-white/5" />
                  <SortItem type="ENERGY_DESC" label="Energy (High)" icon={Zap} currentSort={retiredSortBy} onSelect={setRetiredSortBy} />
                  <SortItem type="ENERGY_ASC" label="Energy (Low)" icon={Zap} currentSort={retiredSortBy} onSelect={setRetiredSortBy} />
                  <DropdownMenuSeparator className="my-2 bg-white/5" />
                  <SortItem type="NAME_ASC" label="Name (A-Z)" icon={SortAsc} currentSort={retiredSortBy} onSelect={setRetiredSortBy} />
                  <SortItem type="EMOJI" label="Vibe (Emoji)" icon={Smile} currentSort={retiredSortBy} onSelect={setRetiredSortBy} />
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="aether" 
                size="sm" 
                onClick={onAutoScheduleSink}
                disabled={!hasUnlockedRetiredTasks || isLoading || isProcessingCommand}
                className="h-10 px-4 font-black uppercase tracking-widest text-[10px] rounded-lg"
                aria-label="Auto Sync all unlocked objectives"
              >
                {isProcessingCommand ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Sparkles className="h-3 w-3 mr-2" />}
                Auto Sync
              </Button>
            </TooltipTrigger>
            <TooltipContent>Re-zone all unlocked objectives</TooltipContent>
          </Tooltip>
        </div>
      </div>
      
      <div className="px-2 pb-2 space-y-6">
        {viewMode === 'list' && (
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleQuickAddToList(localInput);
            }} 
            className="flex gap-2 glass-card p-2 rounded-xl shadow-sm"
          >
            <Input 
              placeholder="Inject objective: Name [dur] [!] [-] [W] [B]..." 
              value={localInput} 
              onChange={(e) => setLocalInput(e.target.value)}
              disabled={isProcessingCommand}
              className="flex-grow h-12 bg-transparent font-bold placeholder:font-medium placeholder:opacity-30 border-none focus-visible:ring-0"
              aria-label="Quick add task to Aether Sink"
            />
            <Button 
              type="submit" 
              disabled={!localInput.trim() || isProcessingCommand}
              className="h-12 w-12 rounded-xl"
              aria-label="Add task to Aether Sink"
            >
              {isProcessingCommand ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
            </Button>
          </form>
        )}
        
        {isLoading || isLoadingEnvironments ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary opacity-40" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/50">Synchronizing Sink...</p>
            <div className="space-y-2 w-full px-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          </div>
        ) : retiredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-4 border-2 border-dashed border-white/5 rounded-2xl bg-secondary/10 animate-pop-in"> {/* Added animate-pop-in */}
            <Ghost className="h-12 w-12 text-muted-foreground/20" />
            <div className="space-y-1">
              <p className="text-sm font-black uppercase tracking-tighter text-muted-foreground/60">Aether Sink Vacant</p>
              <p className="text-[10px] font-bold text-muted-foreground/30 uppercase tracking-widest max-w-[200px]">Objectives will manifest here upon retirement.</p>
            </div>
          </div>
        ) : (
          viewMode === 'list' ? (
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
                    aria-label={`Retired task: ${task.name}`}
                  >
                    <div className="flex items-center gap-4 flex-grow min-w-0">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={(e) => handleAction(e, () => handleToggleComplete(task))}
                        disabled={isLocked || isProcessingCommand}
                        className={cn(
                          "h-9 w-9 shrink-0 rounded-full",
                          isCompleted ? "text-logo-green bg-logo-green/10" : "bg-secondary/50 text-muted-foreground/30 hover:bg-logo-green/10 hover:text-logo-green"
                        )}
                        aria-label={isCompleted ? `Mark "${task.name}" as incomplete` : `Mark "${task.name}" as complete`}
                      >
                        <CheckCircle className={cn("h-5 w-5 transition-transform duration-500", !isCompleted && "group-hover:scale-110")} />
                      </Button>
                      <div className="min-w-0 flex-grow">
                        <div className="flex items-center gap-2 mb-1">
                          {task.is_critical && <Star className="h-3.5 w-3.5 fill-logo-yellow text-logo-yellow shrink-0" />}
                          {isBackburner && (
                            <Badge variant="outline" className="h-4 px-1.5 text-[9px] font-black uppercase tracking-tighter border-muted-foreground/20 text-muted-foreground/60">
                              Orbit
                            </Badge>
                          )}
                          {isWork && (
                            <Badge variant="outline" className="h-4 px-1.5 text-[9px] font-black uppercase tracking-tighter border-primary/20 text-primary/60">
                              Work
                            </Badge>
                          )}
                          {isBreak && (
                            <Badge variant="outline" className="h-4 px-1.5 text-[9px] font-black uppercase tracking-tighter border-logo-orange/20 text-logo-orange/60">
                              Break
                            </Badge>
                          )}
                          <span className="text-xl shrink-0 group-hover:scale-125 transition-transform duration-500">{emoji}</span>
                          <span className={cn("font-black uppercase tracking-tighter truncate text-sm sm:text-base", isCompleted && "line-through")}>
                            {task.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
                          <span className="flex items-center gap-1.5">
                            {getEnvironmentIcon(task.task_environment)}
                            <span className="opacity-40">{task.task_environment}</span>
                          </span>
                          {task.duration && <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> {task.duration}m</span>}
                          {task.energy_cost > 0 && (
                            <span className="flex items-center gap-1.5 text-primary/80">
                              {task.energy_cost}<Zap className="h-3 w-3 fill-current" />
                            </span>
                          )}
                          <span className="hidden xs:inline text-[8px] opacity-20">|</span>
                          <span className="text-[9px] opacity-40">{format(new Date(task.retired_at), 'MMM dd')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 mt-4 sm:mt-0 ml-auto bg-background/50 sm:bg-transparent p-1.5 sm:p-0 rounded-xl">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={(e) => handleAction(e, () => toggleRetiredTaskLock({ taskId: task.id, isLocked: !isLocked }))}
                            className={cn(
                              "h-9 w-9 rounded-lg transition-all",
                              isLocked ? "text-primary bg-primary/10 shadow-[inset_0_0_10px_rgba(var(--primary),0.1)]" : "text-muted-foreground/30"
                            )}
                            aria-label={isLocked ? `Unlock "${task.name}"` : `Lock "${task.name}"`}
                          >
                            {isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4 opacity-50" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{isLocked ? "Secure" : "Accessible"}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={(e) => handleAction(e, () => onRezoneTask(task))}
                            disabled={isLocked || isCompleted}
                            className="h-9 w-9 text-primary/40 hover:text-primary hover:bg-primary/10 rounded-lg"
                            aria-label={`Re-zone "${task.name}" to schedule`}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Re-zone Objective</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={(e) => handleAction(e, () => onRemoveRetiredTask(task.id, task.name))}
                            disabled={isLocked}
                            className="h-9 w-9 text-destructive/30 hover:text-destructive hover:bg-destructive/10 rounded-lg"
                            aria-label={`Purge "${task.name}" from Aether Sink`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Purge from Aether</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <SinkKanbanBoard 
              retiredTasks={retiredTasks} 
              groupBy={groupBy} 
              onRemoveRetiredTask={onRemoveRetiredTask} 
              onRezoneTask={onRezoneTask}
              updateRetiredTask={handleUpdateRetiredTask}
              onOpenDetailDialog={handleOpenDetailDialog}
            />
          )
        )}
      </div>
      
      <RetiredTaskDetailSheet 
        task={selectedRetiredTask} 
        open={isDialogOpen && selectedRetiredTask !== null} 
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setSelectedRetiredTask(null);
        }} 
      />
    </motion.div>
  );
});

AetherSink.displayName = 'AetherSink';

export default AetherSink;