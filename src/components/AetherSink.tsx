import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Trash2, RotateCcw, Ghost, Sparkles, Loader2, Lock, Unlock, 
  Zap, Star, Plus, CheckCircle, ArrowDownWideNarrow, SortAsc, 
  SortDesc, Clock, CalendarDays, Smile, Database, Home, Laptop, 
  Globe, Music 
} from 'lucide-react';
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
import InfoChip from './InfoChip';
import RetiredTaskDetailDialog from './RetiredTaskDetailDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

const getEnvironmentIcon = (environment: TaskEnvironment) => {
  switch (environment) {
    case 'home': return <Home className="h-4 w-4 text-logo-green" />;
    case 'laptop': return <Laptop className="h-4 w-4 text-primary" />;
    case 'away': return <Globe className="h-4 w-4 text-logo-orange" />;
    case 'piano': return <Music className="h-4 w-4 text-accent" />;
    case 'laptop_piano':
      return (
        <div className="relative">
          <Laptop className="h-4 w-4 text-primary" />
          <Music className="h-2 w-2 absolute -bottom-0.5 -right-0.5 text-accent" />
        </div>
      );
    default: return null;
  }
};

const ForwardRefBadge = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof Badge>>((props, ref) => (
  <div ref={ref} className={props.className}>
    <Badge {...props} className="pointer-events-none" />
  </div>
));
ForwardRefBadge.displayName = 'ForwardRefBadge';

interface AetherSinkProps {
  retiredTasks: RetiredTask[];
  onRezoneTask: (task: RetiredTask) => void;
  onRemoveRetiredTask: (taskId: string, taskName: string) => void;
  onAutoScheduleSink: () => void;
  isLoading: boolean;
  isProcessingCommand: boolean;
  hideTitle?: boolean;
  profileEnergy: number;
  retiredSortBy: RetiredTaskSortBy;
  setRetiredSortBy: (sortBy: RetiredTaskSortBy) => void;
}

const AetherSink: React.FC<AetherSinkProps> = React.memo(({ 
  retiredTasks, onRezoneTask, onRemoveRetiredTask, onAutoScheduleSink, 
  isLoading, isProcessingCommand, hideTitle = false, 
  retiredSortBy, setRetiredSortBy 
}) => {
  const { user, profile } = useSession();
  const { 
    toggleRetiredTaskLock, addRetiredTask, completeRetiredTask, 
    updateRetiredTaskStatus, triggerAetherSinkBackup 
  } = useSchedulerTasks('');

  const [sinkInputValue, setSinkInputValue] = useState('');
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRetiredTask, setSelectedRetiredTask] = useState<RetiredTask | null>(null);

  const hasUnlockedRetiredTasks = useMemo(() => retiredTasks.some(task => !task.is_locked), [retiredTasks]);

  const handleAddSinkTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return showError("You must be logged in.");
    if (!sinkInputValue.trim()) return showError("Task name cannot be empty.");

    const parsedTask = parseSinkTaskInput(sinkInputValue, user.id);
    if (parsedTask) {
      await addRetiredTask(parsedTask);
      setSinkInputValue('');
    } else {
      showError("Invalid task format. Use 'Task Name [Duration] [!] [-]'.");
    }
  };

  const handleAction = useCallback((e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
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

  const SortItem = ({ type, label, icon: Icon }: { type: RetiredTaskSortBy, label: string, icon: any }) => (
    <DropdownMenuItem 
      onClick={() => setRetiredSortBy(type)} 
      className={cn("cursor-pointer", retiredSortBy === type && 'bg-accent text-accent-foreground')}
    >
      <Icon className="mr-2 h-4 w-4" /> {label}
    </DropdownMenuItem>
  );

  return (
    <>
      <Card className="animate-pop-in border-dashed border-muted-foreground/30 bg-secondary/5 transition-all duration-300 hover:shadow-md">
        <CardHeader className={cn("pb-2 flex flex-row items-center justify-between px-4", hideTitle ? "pt-4" : "pt-6")}>
          <CardTitle className="text-xl font-bold flex items-center gap-2 text-muted-foreground/80">
            <Trash2 className="h-5 w-5" /> 
            {!hideTitle && <span className="hidden sm:inline">The Aether Sink</span>}
            {!hideTitle && <span className="sm:hidden">Sink</span>}
            <span className="text-sm font-medium opacity-70">({retiredTasks.length})</span>
          </CardTitle>
          
          <div className="flex items-center gap-2">
            {profile?.enable_aethersink_backup && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" size="icon" 
                    onClick={handleManualAetherSinkBackup} 
                    disabled={isProcessingCommand}
                    className="h-9 w-9 text-primary hover:bg-primary/10"
                  >
                    {isProcessingCommand ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Manual Backup</TooltipContent>
              </Tooltip>
            )}

            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" disabled={retiredTasks.length === 0} className="h-9 w-9">
                      <ArrowDownWideNarrow className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Sort Tasks</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Sort Options</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <SortItem type="RETIRED_AT_NEWEST" label="Retired (Newest)" icon={CalendarDays} />
                <SortItem type="RETIRED_AT_OLDEST" label="Retired (Oldest)" icon={CalendarDays} />
                <DropdownMenuSeparator />
                <SortItem type="NAME_ASC" label="Name (A-Z)" icon={SortAsc} />
                <SortItem type="NAME_DESC" label="Name (Z-A)" icon={SortDesc} />
                <DropdownMenuSeparator />
                <SortItem type="DURATION_DESC" label="Duration (Longest)" icon={Clock} />
                <SortItem type="DURATION_ASC" label="Duration (Shortest)" icon={Clock} />
                <DropdownMenuSeparator />
                <SortItem type="ENERGY_DESC" label="Energy (Highest)" icon={Zap} />
                <SortItem type="ENERGY_ASC" label="Energy (Lowest)" icon={Zap} />
                <DropdownMenuSeparator />
                <SortItem type="EMOJI" label="Emoji" icon={Smile} />
              </DropdownMenuContent>
            </DropdownMenu>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary" size="sm"
                  onClick={onAutoScheduleSink}
                  disabled={!hasUnlockedRetiredTasks || isLoading || isProcessingCommand}
                  className="flex items-center gap-1 h-9 px-3 font-semibold bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  {isProcessingCommand ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  <span className="hidden sm:inline">Auto Schedule</span>
                  <span className="sm:hidden">Auto</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Re-zone all unlocked tasks</TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          <form onSubmit={handleAddSinkTask} className="flex gap-2">
            <Input
              placeholder="Task name [duration] [!] [-]"
              value={sinkInputValue}
              onChange={(e) => setSinkInputValue(e.target.value)}
              disabled={isProcessingCommand}
              className="flex-grow h-11 focus-visible:ring-primary"
            />
            <Button type="submit" disabled={isProcessingCommand || !sinkInputValue.trim()} className="h-11 w-11">
              {isProcessingCommand ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </form>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 opacity-60">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Synchronizing Aether...</p>
            </div>
          ) : retiredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
              <div className="bg-secondary/20 p-4 rounded-full"><Ghost className="h-10 w-10 text-muted-foreground/40" /></div>
              <div className="space-y-1">
                <p className="text-lg font-bold text-muted-foreground">The Sink is Empty</p>
                <p className="text-sm text-muted-foreground/60 max-w-[240px]">Retired tasks will manifest here for future re-zoning.</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-2">
              {retiredTasks.map((task) => {
                const hue = getEmojiHue(task.name);
                const emoji = assignEmoji(task.name);
                const accentColor = `hsl(${hue} 70% 50%)`;
                const { is_locked: isLocked, is_backburner: isBackburner, is_completed: isCompleted } = task;

                return (
                  <div 
                    key={task.id} 
                    onMouseEnter={() => setHoveredItemId(task.id)}
                    onMouseLeave={() => setHoveredItemId(null)}
                    onClick={() => { setSelectedRetiredTask(task); setIsDialogOpen(true); }}
                    className={cn(
                      "group relative flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-xl border transition-all duration-200 cursor-pointer",
                      "bg-card hover:bg-secondary/40",
                      isLocked ? "border-primary/30 bg-primary/5" : "border-transparent",
                      isBackburner && !isLocked && "opacity-75 grayscale-[0.2]",
                      isCompleted && "opacity-40 grayscale"
                    )}
                    style={{ borderLeft: isLocked ? '4px solid hsl(var(--primary))' : `4px solid ${accentColor}` }}
                  >
                    <div className="flex items-center gap-3 flex-grow min-w-0">
                      <Button 
                        variant="ghost" size="icon" 
                        onClick={(e) => handleAction(e, () => handleToggleComplete(task))}
                        disabled={isLocked || isProcessingCommand}
                        className={cn("h-8 w-8 shrink-0", isCompleted ? "text-logo-green" : "text-muted-foreground/40")}
                      >
                        <CheckCircle className={cn("h-5 w-5 transition-transform", !isCompleted && "group-hover:scale-110")} />
                      </Button>

                      <div className="min-w-0 flex-grow">
                        <div className="flex items-center gap-2 mb-0.5">
                          {task.is_critical && <Star className="h-3.5 w-3.5 fill-logo-yellow text-logo-yellow shrink-0" />}
                          {isBackburner && <Badge variant="outline" className="h-4 px-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Orbit</Badge>}
                          <span className="text-lg shrink-0">{emoji}</span>
                          <span className={cn("font-bold truncate text-sm sm:text-base", isCompleted && "line-through")}>
                            {task.name}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-3 text-xs text-muted-foreground/70 font-medium">
                          <span className="flex items-center gap-1">{getEnvironmentIcon(task.task_environment)}</span>
                          {task.duration && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {task.duration}m</span>}
                          {task.energy_cost > 0 && <span className="flex items-center gap-1 text-primary/80">{task.energy_cost}<Zap className="h-3 w-3 fill-current" /></span>}
                          <span className="hidden xs:inline opacity-40">|</span>
                          <span className="text-[10px] uppercase opacity-60">{format(new Date(task.retired_at), 'MMM d')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 mt-3 sm:mt-0 ml-auto bg-background/50 sm:bg-transparent p-1 sm:p-0 rounded-lg">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" size="icon" 
                            onClick={(e) => handleAction(e, () => toggleRetiredTaskLock({ taskId: task.id, isLocked: !isLocked }))}
                            className={cn("h-8 w-8", isLocked ? "text-primary bg-primary/10" : "text-muted-foreground/40")}
                          >
                            {isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{isLocked ? "Unlock" : "Lock"}</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" size="icon" 
                            onClick={(e) => handleAction(e, () => onRezoneTask(task))}
                            disabled={isLocked || isCompleted}
                            className="h-8 w-8 text-primary/60 hover:text-primary hover:bg-primary/10"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Re-zone</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" size="icon" 
                            onClick={(e) => handleAction(e, () => onRemoveRetiredTask(task.id, task.name))}
                            disabled={isLocked}
                            className="h-8 w-8 text-destructive/40 hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Purge</TooltipContent>
                      </Tooltip>
                    </div>

                    <InfoChip 
                      onClick={(e) => handleAction(e, () => { setSelectedRetiredTask(task); setIsDialogOpen(true); })}
                      isHovered={hoveredItemId === task.id} 
                    />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

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