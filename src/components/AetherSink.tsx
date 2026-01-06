import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, RotateCcw, Ghost, Sparkles, Loader2, Lock, Unlock, Zap, Star, Plus, CheckCircle, ArrowDownWideNarrow, SortAsc, SortDesc, Clock, CalendarDays, Smile, Database, Home, Laptop, Globe, Music, LayoutDashboard, List } from 'lucide-react';
import { RetiredTask, RetiredTaskSortBy, TaskEnvironment } from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { getEmojiHue, assignEmoji, parseSinkTaskInput, getEnvironmentIconComponent } from '@/lib/scheduler-utils'; // Import getEnvironmentIconComponent
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useSession } from '@/hooks/use-session';
import { showError } from '@/utils/toast';
import RetiredTaskDetailDialog from './RetiredTaskDetailDialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel, } from '@/components/ui/dropdown-menu';
import { useSinkView, SinkViewMode, GroupingOption } from '@/hooks/use-sink-view';
import SinkKanbanBoard from './SinkKanbanBoard';
import { UserProfile } from '@/hooks/use-session';
import { Button } from '@/components/ui/button';
import { useEnvironments } from '@/hooks/use-environments'; // NEW: Import useEnvironments

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
  const { environments, isLoading: isLoadingEnvironments } = useEnvironments(); // NEW: Use environments hook
  const { toggleRetiredTaskLock, addRetiredTask, completeRetiredTask, updateRetiredTaskStatus, triggerAetherSinkBackup, updateRetiredTaskDetails } = useSchedulerTasks('');
  
  // --- View Management ---
  const { viewMode, groupBy, setViewMode, setGroupBy } = useSinkView();
  // ----------------------------

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRetiredTask, setSelectedRetiredTask] = useState<RetiredTask | null>(null);
  const [localInput, setLocalInput] = useState(''); // NEW: State for quick add input

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

  // NEW: Quick add handler for list view
  const handleQuickAddToList = useCallback(async (input: string) => {
    if (!user) return showError("User context missing.");
    if (!input.trim()) return;

    const parsedTask = parseSinkTaskInput(input, user.id);
    if (!parsedTask) {
      return showError("Invalid task format. Use 'Name [dur] [!] [-]'.");
    }

    await addRetiredTask(parsedTask);
    setLocalInput(''); // Clear input after adding
  }, [user, addRetiredTask]);

  const SortItem = ({ type, label, icon: Icon }: { type: RetiredTaskSortBy, label: string, icon: any }) => (
    <DropdownMenuItem 
      onClick={() => setRetiredSortBy(type)} 
      className={cn("cursor-pointer font-bold text-xs uppercase tracking-widest", retiredSortBy === type && 'bg-primary/10 text-primary')}
    >
      <Icon className="mr-2 h-4 w-4" />
      {label}
    </DropdownMenuItem>
  );

  const ViewToggle = () => (
    <div className="flex bg-secondary/50 rounded-lg p-1 border border-white/5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant={viewMode === 'list' ? 'default' : 'ghost'} 
            size="icon" 
            className={cn("h-8 w-8 rounded-md", viewMode === 'list' && "shadow-sm")}
            onClick={() => setViewMode('list')}
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
          >
            <LayoutDashboard className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Kanban View</TooltipContent>
      </Tooltip>
    </div>
  );

  // Get environment options for grouping
  const environmentOptions = useMemo(() => {
    return environments.map(env => ({
      value: env.value,
      label: env.label,
      icon: getEnvironmentIconComponent(env.icon), // Use the utility to get the component
    }));
  }, [environments]);

  return (
    <>
      <div className="p-4 bg-card rounded-xl shadow-sm w-full">
        <div className={cn("pb-4 flex flex-row items-center justify-between")}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary/50">
              <Trash2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
              <span>Aether Sink</span>
              <span className="ml-2 opacity-30 text-xs">[{retiredTasks.length}]</span>
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {/* View Toggle */}
            <ViewToggle />
            
            {/* Grouping Dropdown (Only for Kanban) */}
            {viewMode === 'kanban' && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-10 px-3 text-xs font-bold uppercase tracking-widest"
                  >
                    Group: {groupBy === 'environment' ? 'Env' : 'Priority'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="glass-card min-w-32 border-white/10 bg-background/95 backdrop-blur-xl">
                  <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest opacity-50 px-3 py-2">Group By</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setGroupBy('environment')} className="font-bold text-xs uppercase py-2 px-3">Environment</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setGroupBy('priority')} className="font-bold text-xs uppercase py-2 px-3">Priority</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            {/* Backup & Sort (Only for List View) */}
            {viewMode === 'list' && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="glass" 
                      size="icon" 
                      onClick={handleManualAetherSinkBackup}
                      disabled={isProcessingCommand}
                      className="h-10 w-10 text-primary"
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
                          className="h-10 w-10"
                        >
                          <ArrowDownWideNarrow className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Sort Terminal</TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align="end" className="glass-card min-w-48 border-white/10 bg-background/95 backdrop-blur-xl">
                    <DropdownMenuLabel className="text-[10px] uppercase font-black tracking-[0.2em] opacity-50 mb-1">Sorting Logic</DropdownMenuLabel>
                    <SortItem type="RETIRED_AT_NEWEST" label="Retired (Newest)" icon={CalendarDays} />
                    <SortItem type="RETIRED_AT_OLDEST" label="Retired (Oldest)" icon={CalendarDays} />
                    <DropdownMenuSeparator className="my-2 bg-white/5" />
                    <SortItem type="DURATION_DESC" label="Duration (Long)" icon={Clock} />
                    <SortItem type="DURATION_ASC" label="Duration (Short)" icon={Clock} />
                    <DropdownMenuSeparator className="my-2 bg-white/5" />
                    <SortItem type="ENERGY_DESC" label="Energy (High)" icon={Zap} />
                    <SortItem type="ENERGY_ASC" label="Energy (Low)" icon={Zap} />
                    <DropdownMenuSeparator className="my-2 bg-white/5" />
                    <SortItem type="NAME_ASC" label="Name (A-Z)" icon={SortAsc} />
                    <SortItem type="EMOJI" label="Vibe (Emoji)" icon={Smile} />
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
                  className="h-10 px-4 font-black uppercase tracking-widest text-[10px]"
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
          {/* Input Form (Now enabled for List View) */}
          {viewMode === 'list' && (
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleQuickAddToList(localInput);
              }} 
              className="flex gap-2"
            >
              <Input 
                placeholder="Inject objective: Name [dur] [!] [-]..." 
                value={localInput} 
                onChange={(e) => setLocalInput(e.target.value)}
                disabled={isProcessingCommand}
                className="flex-grow h-12 bg-background/40 font-bold placeholder:font-medium placeholder:opacity-30"
              />
              <Button 
                type="submit" 
                disabled={!localInput.trim() || isProcessingCommand}
                className="h-12 w-12 rounded-xl"
              >
                {isProcessingCommand ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
              </Button>
            </form>
          )}
          
          {/* Loading State */}
          {isLoading || isLoadingEnvironments ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary opacity-40" />
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/50">Synchronizing Sink...</p>
            </div>
          ) : retiredTasks.length === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-12 text-center gap-4 border-2 border-dashed border-white/5 rounded-2xl bg-secondary/10">
              <Ghost className="h-12 w-12 text-muted-foreground/20" />
              <div className="space-y-1">
                <p className="text-sm font-black uppercase tracking-tighter text-muted-foreground/60">Aether Sink Vacant</p>
                <p className="text-[10px] font-bold text-muted-foreground/30 uppercase tracking-widest max-w-[200px]">Objectives will manifest here upon retirement.</p>
              </div>
            </div>
          ) : (
            /* View Content Toggle */
            viewMode === 'list' ? (
              <div className="grid gap-2 pr-2 scrollbar-none max-h-[600px] overflow-y-auto custom-scrollbar">
                {retiredTasks.map((task) => {
                  const hue = getEmojiHue(task.name);
                  const emoji = assignEmoji(task.name);
                  const accentColor = `hsl(${hue} 70% 50%)`;
                  const { is_locked: isLocked, is_backburner: isBackburner, is_completed: isCompleted } = task;
                  
                  const IconComponent = getEnvironmentIconComponent(environments.find(env => env.value === task.task_environment)?.icon || 'Home'); // FIX: Get the component
                  
                  return (
                    <div 
                      key={task.id}
                      onClick={() => handleOpenDetailDialog(task)} // Click to open details
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
                          className={cn(
                            "h-9 w-9 shrink-0 rounded-full",
                            isCompleted ? "text-logo-green bg-logo-green/10" : "bg-secondary/50 text-muted-foreground/30 hover:bg-logo-green/10 hover:text-logo-green"
                          )}
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
                            <span className="text-xl shrink-0 group-hover:scale-125 transition-transform duration-500">{emoji}</span>
                            <span className={cn("font-black uppercase tracking-tighter truncate text-sm sm:text-base", isCompleted && "line-through")}>
                              {task.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
                            <span className="flex items-center gap-1.5">
                              <IconComponent className="h-3 w-3 opacity-70" /> {/* FIX: Render the component */}
                              <span className="opacity-40">{environments.find(env => env.value === task.task_environment)?.label || task.task_environment}</span>
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
                            >
                              {isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
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
                onOpenDetailDialog={handleOpenDetailDialog} // Pass the handler down
              />
            )
          )}
        </div>
      </div>
      
      <RetiredTaskDetailDialog 
        task={selectedRetiredTask} 
        open={isDialogOpen} 
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setSelectedRetiredTask(null);
        }} 
      />
    </>
  );
});

AetherSink.displayName = 'AetherSink';

export default AetherSink;