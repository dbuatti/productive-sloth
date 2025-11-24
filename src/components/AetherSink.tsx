import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, RotateCcw, ListTodo, Ghost, AlertCircle, Sparkles, Loader2, Lock, Unlock, Zap, Star, Plus, CheckCircle, ArrowDownWideNarrow, SortAsc, SortDesc, Clock, Flame, Scale, CalendarDays, Smile, Database, Home, Laptop, Globe, Music } from 'lucide-react'; // NEW: Added Database icon, Home, Laptop, Globe, Music
import { RetiredTask, NewRetiredTask, RetiredTaskSortBy, TaskEnvironment } from '@/types/scheduler';
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
    case 'home':
      return <Home className="h-4 w-4 text-logo-green" />;
    case 'laptop':
      return <Laptop className="h-4 w-4 text-primary" />;
    case 'away':
      return <Globe className="h-4 w-4 text-logo-orange" />;
    case 'piano':
      return <Music className="h-4 w-4 text-accent" />;
    case 'laptop_piano':
      return (
        <div className="relative">
          <Laptop className="h-4 w-4 text-primary" />
          <Music className="h-2.5 w-2.5 absolute -bottom-0.5 -right-0.5 text-accent" />
        </div>
      );
    default:
      return null;
  }
};

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

const AetherSink: React.FC<AetherSinkProps> = React.memo(({ retiredTasks, onRezoneTask, onRemoveRetiredTask, onAutoScheduleSink, isLoading, isProcessingCommand, hideTitle = false, profileEnergy, retiredSortBy, setRetiredSortBy }) => {
  const hasUnlockedRetiredTasks = retiredTasks.some(task => !task.is_locked);
  const { toggleRetiredTaskLock, addRetiredTask, completeRetiredTask, updateRetiredTaskStatus, triggerAetherSinkBackup } = useSchedulerTasks(''); // NEW: Destructure triggerAetherSinkBackup
  const { user, profile } = useSession(); // NEW: Get profile to check enable_aethersink_backup
  const [sinkInputValue, setSinkInputValue] = useState('');

  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRetiredTask, setSelectedRetiredTask] = useState<RetiredTask | null>(null);

  const handleAddSinkTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showError("You must be logged in to add tasks to the Aether Sink.");
      return;
    }
    if (!sinkInputValue.trim()) {
      showError("Task name cannot be empty.");
      return;
    }

    const parsedTask = parseSinkTaskInput(sinkInputValue, user.id);

    if (parsedTask) {
      await addRetiredTask(parsedTask);
      setSinkInputValue('');
    } else {
      showError("Invalid task format. Use 'Task Name [Duration] [!]'.");
    }
  };

  const handleInfoChipClick = (retiredTask: RetiredTask) => {
    console.log("AetherSink: InfoChip clicked for retired task:", retiredTask.name);
    setSelectedRetiredTask(retiredTask);
    setIsDialogOpen(true);
  };

  const handleTaskItemClick = (event: React.MouseEvent, retiredTask: RetiredTask) => {
    console.log("AetherSink: Retired task item clicked for task:", retiredTask.name, "Event target:", event.target);
    const target = event.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) {
      console.log("AetherSink: Click originated from an interactive child, preventing dialog open.");
      return;
    }
    setSelectedRetiredTask(retiredTask);
    setIsDialogOpen(true);
    console.log("AetherSink: Setting isDialogOpen to true for retired task:", retiredTask.name);
  };

  const handleToggleComplete = async (task: RetiredTask) => {
    if (task.is_locked) {
      showError(`Cannot change completion status of locked task "${task.name}". Unlock it first.`);
      return;
    }
    // Removed the energy check here to allow deficit
    if (task.is_completed) {
      await updateRetiredTaskStatus({ taskId: task.id, isCompleted: false });
    } else {
      await completeRetiredTask(task);
    }
  };

  // NEW: Handle manual Aether Sink backup
  const handleManualAetherSinkBackup = async () => {
    if (!user || !profile) {
      showError("You must be logged in and your profile loaded to create a backup.");
      return;
    }
    if (!profile.enable_aethersink_backup) {
      showError("Daily Aether Sink backup is disabled in settings. Please enable it to use this feature.");
      return;
    }
    await triggerAetherSinkBackup();
  };

  return (
    <>
      <Card className="animate-pop-in border-dashed border-muted-foreground/30 bg-secondary/10 animate-hover-lift">
        <CardHeader className={cn("pb-2 flex flex-row items-center justify-between px-4", hideTitle ? "pt-4" : "pt-6")}>
          <CardTitle className="text-xl font-bold flex items-center gap-2 text-muted-foreground">
            <Trash2 className="h-5 w-5" /> 
            {!hideTitle && <span className="hidden sm:inline">The Aether Sink</span>}
            {!hideTitle && <span className="sm:hidden">Sink</span>}
            <span className={cn(hideTitle ? "text-xl" : "text-base")}>({retiredTasks.length})</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* NEW: Backup Now Button */}
            {profile?.enable_aethersink_backup && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={handleManualAetherSinkBackup} 
                    disabled={isProcessingCommand}
                    className={cn(
                      "h-9 w-9 text-primary hover:bg-primary/10 transition-all duration-200", // Increased size
                      isProcessingCommand && "text-muted-foreground/50 cursor-not-allowed"
                    )}
                    style={isProcessingCommand ? { pointerEvents: 'auto' } : undefined}
                  >
                    {isProcessingCommand ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                    <span className="sr-only">Backup Now</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Create an immediate backup of your Aether Sink</p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* Sort Button for Aether Sink */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      disabled={isProcessingCommand || retiredTasks.length === 0}
                      className={cn(
                        "h-9 w-9 text-muted-foreground hover:bg-muted/10 transition-all duration-200", // Increased size
                        (isProcessingCommand || retiredTasks.length === 0) && "text-muted-foreground/50 cursor-not-allowed"
                      )}
                      style={(isProcessingCommand || retiredTasks.length === 0) ? { pointerEvents: 'auto' } : undefined}
                    >
                      {isProcessingCommand ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownWideNarrow className="h-4 w-4" />}
                      <span className="sr-only">Sort Aether Sink</span>
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Sort Aether Sink Tasks</p>
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Sort By</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setRetiredSortBy('RETIRED_AT_NEWEST')} className={cn(retiredSortBy === 'RETIRED_AT_NEWEST' && 'bg-accent text-accent-foreground')}>
                  <CalendarDays className="mr-2 h-4 w-4" /> Retired Date (Newest)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setRetiredSortBy('RETIRED_AT_OLDEST')} className={cn(retiredSortBy === 'RETIRED_AT_OLDEST' && 'bg-accent text-accent-foreground')}>
                  <CalendarDays className="mr-2 h-4 w-4" /> Retired Date (Oldest)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setRetiredSortBy('NAME_ASC')} className={cn(retiredSortBy === 'NAME_ASC' && 'bg-accent text-accent-foreground')}>
                  <SortAsc className="mr-2 h-4 w-4" /> Name (A-Z)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setRetiredSortBy('NAME_DESC')} className={cn(retiredSortBy === 'NAME_DESC' && 'bg-accent text-accent-foreground')}>
                  <SortDesc className="mr-2 h-4 w-4" /> Name (Z-A)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setRetiredSortBy('DURATION_DESC')} className={cn(retiredSortBy === 'DURATION_DESC' && 'bg-accent text-accent-foreground')}>
                  <Clock className="mr-2 h-4 w-4" /> Duration (Longest)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setRetiredSortBy('DURATION_ASC')} className={cn(retiredSortBy === 'DURATION_ASC' && 'bg-accent text-accent-foreground')}>
                  <Clock className="mr-2 h-4 w-4" /> Duration (Shortest)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setRetiredSortBy('CRITICAL_FIRST')} className={cn(retiredSortBy === 'CRITICAL_FIRST' && 'bg-accent text-accent-foreground')}>
                  <Star className="mr-2 h-4 w-4" /> Critical (First)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setRetiredSortBy('CRITICAL_LAST')} className={cn(retiredSortBy === 'CRITICAL_LAST' && 'bg-accent text-accent-foreground')}>
                  <Star className="mr-2 h-4 w-4" /> Critical (Last)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setRetiredSortBy('LOCKED_FIRST')} className={cn(retiredSortBy === 'LOCKED_FIRST' && 'bg-accent text-accent-foreground')}>
                  <Lock className="mr-2 h-4 w-4" /> Locked (First)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setRetiredSortBy('LOCKED_LAST')} className={cn(retiredSortBy === 'LOCKED_LAST' && 'bg-accent text-accent-foreground')}>
                  <Unlock className="mr-2 h-4 w-4" /> Locked (Last)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setRetiredSortBy('ENERGY_DESC')} className={cn(retiredSortBy === 'ENERGY_DESC' && 'bg-accent text-accent-foreground')}>
                  <Zap className="mr-2 h-4 w-4" /> Energy (Highest)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setRetiredSortBy('ENERGY_ASC')} className={cn(retiredSortBy === 'ENERGY_ASC' && 'bg-accent text-accent-foreground')}>
                  <Zap className="mr-2 h-4 w-4" /> Energy (Lowest)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setRetiredSortBy('COMPLETED_FIRST')} className={cn(retiredSortBy === 'COMPLETED_FIRST' && 'bg-accent text-accent-foreground')}>
                  <CheckCircle className="mr-2 h-4 w-4" /> Completed (First)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setRetiredSortBy('COMPLETED_LAST')} className={cn(retiredSortBy === 'COMPLETED_LAST' && 'bg-accent text-accent-foreground')}>
                  <CheckCircle className="mr-2 h-4 w-4" /> Completed (Last)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setRetiredSortBy('EMOJI')} className={cn(retiredSortBy === 'EMOJI' && 'bg-accent text-accent-foreground')}>
                  <Smile className="mr-2 h-4 w-4" /> Emoji
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Auto Schedule Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onAutoScheduleSink}
                  disabled={!hasUnlockedRetiredTasks || isLoading || isProcessingCommand}
                  className="flex items-center gap-1 h-9 px-3 text-base font-semibold bg-accent text-accent-foreground hover:bg-accent/90" // Increased size and font
                  style={(!hasUnlockedRetiredTasks || isLoading || isProcessingCommand) ? { pointerEvents: 'auto' } : undefined}
                >
                  {isProcessingCommand ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">Auto Schedule</span>
                  <span className="sm:hidden">Auto</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Automatically re-zone all unlocked retired tasks into your current schedule.</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
        
        <div className={cn(hideTitle ? "pt-0" : "pt-2")}>
          {!hideTitle && <div className="w-full border-t border-dashed border-muted-foreground/30 mt-2" />}
          <CardContent className="p-4 space-y-4"> {/* Standardized padding to p-4 */}
            <form onSubmit={handleAddSinkTask} className="flex gap-2 w-full pt-2">
              <Input
                type="text"
                placeholder="Add task to sink (e.g., 'Read Book 30', 'Critical Idea !')"
                value={sinkInputValue}
                onChange={(e) => setSinkInputValue(e.target.value)}
                disabled={isProcessingCommand}
                className="flex-grow h-11 text-base focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200" // Increased size and font
              />
              <Button 
                type="submit" 
                disabled={isProcessingCommand || !sinkInputValue.trim()} 
                className="shrink-0 h-11 w-11 bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-200" // Increased size
              >
                {isProcessingCommand ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                <span className="sr-only">Add to Sink</span>
              </Button>
            </form>
            <p className="text-sm text-muted-foreground"> {/* Increased font size */}
              Tip: Add duration (e.g., "Task Name 30") and/or mark as critical (e.g., "Important Idea !")
            </p>

            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Loading Aether Sink" />
                <span className="ml-2 text-muted-foreground">Loading Aether Sink...</span>
              </div>
            ) : retiredTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-muted-foreground text-base space-y-2"> {/* Increased font size */}
                <Ghost className="h-8 w-8" />
                <p className="text-lg font-semibold">Aether Sink is empty!</p> {/* Increased font size */}
                <p>No tasks have been retired yet. Complete or manually retire tasks to send them here.</p>
              </div>
            ) : (
              <div className="space-y-3"> {/* Increased spacing */}
                {retiredTasks.map((task) => {
                  const hue = getEmojiHue(task.name);
                  const emoji = assignEmoji(task.name);
                  const ambientBackgroundColor = `hsl(${hue} 50% 35% / 0.3)`;
                  const isLocked = task.is_locked;

                  return (
                    <div 
                      key={task.id} 
                      className={cn(
                        "relative flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-md border border-border/50 text-base transition-all duration-200 ease-in-out cursor-pointer", // Increased padding to p-4
                        isLocked ? "border-primary/70 bg-primary/10" : "",
                        task.is_completed && "opacity-50 line-through"
                      )}
                      style={{ backgroundColor: isLocked ? undefined : ambientBackgroundColor }}
                      onMouseEnter={() => setHoveredItemId(task.id)}
                      onMouseLeave={() => setHoveredItemId(null)}
                      onClick={(e) => handleTaskItemClick(e, task)}
                    >
                      <div className="flex items-center space-x-3 flex-grow min-w-0 w-full sm:w-auto">
                        {/* Completion Button */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleComplete(task);
                              }}
                              disabled={isLocked || isProcessingCommand}
                              className={cn(
                                "h-8 w-8 p-0 shrink-0", // Increased size
                                (isLocked || isProcessingCommand) ? "text-muted-foreground/50 cursor-not-allowed" : "text-logo-green hover:bg-logo-green/20"
                              )}
                              style={(isLocked || isProcessingCommand) ? { pointerEvents: 'auto' } : undefined}
                            >
                              <CheckCircle className="h-5 w-5" /> {/* Increased icon size */}
                              <span className="sr-only">{task.is_completed ? "Mark as Incomplete" : "Mark as Complete"}</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {isLocked ? (
                              <p>Unlock to Change Completion Status</p>
                            ) : (
                              <p>{task.is_completed ? "Mark as Incomplete" : "Mark as Complete"}</p>
                            )}
                          </TooltipContent>
                        </Tooltip>

                        <div
                          className={`flex flex-col items-start min-w-0 flex-grow`}
                        >
                          <div className="flex items-center gap-2 w-full">
                            {task.is_critical && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="relative flex items-center justify-center h-4 w-4 rounded-full bg-logo-yellow text-white shrink-0">
                                    <Star className="h-3 w-3" strokeWidth={2.5} />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Critical Task: Must be completed today!</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            <span className="text-xl">{emoji}</span> {/* Increased emoji size */}
                            <span className={cn("font-semibold truncate text-lg", isLocked ? "text-primary" : "text-foreground")}>{task.name}</span> {/* Increased font size to text-lg */}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap"> {/* Increased spacing and font size */}
                            {/* Environment Icon */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="h-5 w-5 flex items-center justify-center shrink-0">
                                        {getEnvironmentIcon(task.task_environment)}
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Environment: {task.task_environment.charAt(0).toUpperCase() + task.task_environment.slice(1)}</p>
                                </TooltipContent>
                            </Tooltip>
                            
                            {task.duration && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className={cn("flex items-center gap-1 text-sm font-mono", isLocked ? "text-primary/80" : "text-foreground/80")}>
                                    <Clock className="h-4 w-4" /> {task.duration} min
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Scheduled Duration</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            
                            {task.energy_cost !== undefined && task.energy_cost > 0 && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className={cn(
                                    "flex items-center gap-1 text-sm font-semibold font-mono", // Increased font size
                                    isLocked ? "text-primary/80" : "text-foreground/80"
                                  )}>
                                    {task.energy_cost} <Zap className="h-4 w-4" /> {/* Increased icon size */}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Energy Cost</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            <span className="text-sm italic text-muted-foreground"> {/* Increased font size */}
                              Retired: {format(new Date(task.retired_at), 'MMM d, yyyy')}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Action Buttons Group (Right side, stacks below on mobile) */}
                      <div className="flex items-center gap-1 ml-auto shrink-0 mt-2 sm:mt-0">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRetiredTaskLock({ taskId: task.id, isLocked: !isLocked });
                              }}
                              disabled={isProcessingCommand}
                              className={cn(
                                "h-8 w-8 p-0 shrink-0", // Increased size
                                isProcessingCommand ? "text-muted-foreground/50 cursor-not-allowed" : (isLocked ? "text-primary hover:bg-primary/20" : "text-muted-foreground hover:bg-muted/20")
                              )}
                              style={isProcessingCommand ? { pointerEvents: 'auto' } : undefined}
                            >
                              {isLocked ? <Lock className="h-5 w-5" /> : <Unlock className="h-5 w-5" />} {/* Increased icon size */}
                              <span className="sr-only">{isLocked ? "Unlock task" : "Lock task"}</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{isLocked ? "Unlock Task" : "Lock Task"}</p>
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="secondary"
                              size="icon" 
                              onClick={(e) => {
                                e.stopPropagation();
                                onRezoneTask(task);
                              }}
                              disabled={isLocked || isProcessingCommand || task.is_completed}
                              className={cn(
                                "h-8 w-8 text-primary hover:bg-primary/10", // Increased size
                                (isLocked || isProcessingCommand || task.is_completed) && "text-muted-foreground/50 cursor-not-allowed hover:bg-transparent"
                              )}
                              style={(isLocked || isProcessingCommand || task.is_completed) ? { pointerEvents: 'auto' } : undefined}
                            >
                              <RotateCcw className="h-5 w-5" /> {/* Increased icon size */}
                              <span className="sr-only">Rezone</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{isLocked ? "Unlock to Re-zone" : (task.is_completed ? "Task Completed" : "Re-zone to schedule")}</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemoveRetiredTask(task.id, task.name);
                              }}
                              disabled={isLocked || isProcessingCommand}
                              className={cn(
                                "h-8 w-8 text-destructive hover:bg-destructive/20", // Increased size
                                (isLocked || isProcessingCommand) && "text-muted-foreground/50 cursor-not-allowed hover:bg-transparent"
                              )}
                              style={(isLocked || isProcessingCommand) ? { pointerEvents: 'auto' } : undefined}
                            >
                              <Trash2 className="h-5 w-5" /> {/* Increased icon size */}
                              <span className="sr-only">Delete</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{isLocked ? "Unlock to Delete" : "Permanently delete"}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <InfoChip 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInfoChipClick(task);
                        }}
                        isHovered={hoveredItemId === task.id} 
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </div>
      </Card>
      <RetiredTaskDetailDialog
        task={selectedRetiredTask}
        open={isDialogOpen}
        onOpenChange={(open) => {
          console.log("AetherSink: Dialog onOpenChange. New state:", open);
          setIsDialogOpen(open);
          if (!open) setSelectedRetiredTask(null);
        }}
      />
    </>
  );
});

export default AetherSink;