import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, RotateCcw, ListTodo, Ghost, AlertCircle, Sparkles, Loader2, Lock, Unlock, Zap, Star, Plus } from 'lucide-react'; // Removed Chevron icons, added Plus
import { RetiredTask, NewRetiredTask } from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { getEmojiHue, assignEmoji, parseSinkTaskInput } from '@/lib/scheduler-utils'; // Import parseSinkTaskInput
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import { Badge } from '@/components/ui/badge'; // Import Badge
import { Input } from '@/components/ui/input'; // Import Input
import { useSession } from '@/hooks/use-session'; // Import useSession
import { showError } from '@/utils/toast'; // Import showError
import InfoChip from './InfoChip'; // Import InfoChip
import RetiredTaskDetailSheet from './RetiredTaskDetailSheet'; // Import RetiredTaskDetailSheet

interface AetherSinkProps {
  retiredTasks: RetiredTask[];
  onRezoneTask: (task: RetiredTask) => void;
  onRemoveRetiredTask: (taskId: string) => void;
  onAutoScheduleSink: () => void;
  isLoading: boolean;
  isProcessingCommand: boolean;
  hideTitle?: boolean;
  profileEnergy: number; // NEW: Pass profile energy for critical task status
}

const AetherSink: React.FC<AetherSinkProps> = React.memo(({ retiredTasks, onRezoneTask, onRemoveRetiredTask, onAutoScheduleSink, isLoading, isProcessingCommand, hideTitle = false, profileEnergy }) => {
  const hasUnlockedRetiredTasks = retiredTasks.some(task => !task.is_locked); // Check for unlocked tasks
  const { toggleRetiredTaskLock, addRetiredTask } = useSchedulerTasks('');
  const { user } = useSession(); // Get user for adding tasks
  const [sinkInputValue, setSinkInputValue] = useState('');

  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null); // State for hovered item
  const [isSheetOpen, setIsSheetOpen] = useState(false);
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
    setIsSheetOpen(true);
  };

  // Handle click on the task item itself
  const handleTaskItemClick = (event: React.MouseEvent, retiredTask: RetiredTask) => {
    console.log("AetherSink: Retired task item clicked for task:", retiredTask.name, "Event target:", event.target);
    // Prevent opening the sheet if a child interactive element (like a button) was clicked
    const target = event.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) {
      console.log("AetherSink: Click originated from an interactive child, preventing sheet open.");
      return;
    }
    setSelectedRetiredTask(retiredTask);
    setIsSheetOpen(true);
    console.log("AetherSink: Setting isSheetOpen to true for retired task:", retiredTask.name);
  };

  return (
    <>
      <Card className="animate-pop-in border-dashed border-muted-foreground/30 bg-secondary/10 animate-hover-lift">
        {!hideTitle && (
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xl font-bold flex items-center gap-2 text-muted-foreground">
              <Trash2 className="h-5 w-5" /> The Aether Sink ({retiredTasks.length} Retired Task{retiredTasks.length !== 1 ? 's' : ''})
            </CardTitle>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={onAutoScheduleSink}
                    disabled={!hasUnlockedRetiredTasks || isLoading || isProcessingCommand} // Disabled if no unlocked tasks
                    className="flex items-center gap-1 h-8 px-3 text-sm font-semibold bg-accent text-accent-foreground hover:bg-accent/90"
                    style={(!hasUnlockedRetiredTasks || isLoading || isProcessingCommand) ? { pointerEvents: 'auto' } : undefined}
                  >
                    {isProcessingCommand ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    <span>Auto Schedule</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Automatically re-zone all unlocked retired tasks into your current schedule.</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </CardHeader>
        )}
        
        {/* Content is always open now */}
        <>
          {!hideTitle && <div className="w-full border-t border-dashed border-muted-foreground/30 mt-2" />}
          <CardContent className="space-y-3">
            {/* New: Add Task to Sink Input */}
            <form onSubmit={handleAddSinkTask} className="flex gap-2 w-full pt-2">
              <Input
                type="text"
                placeholder="Add task to sink (e.g., 'Read Book 30', 'Critical Idea !')"
                value={sinkInputValue}
                onChange={(e) => setSinkInputValue(e.target.value)}
                disabled={isProcessingCommand}
                className="flex-grow h-10 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200"
              />
              <Button 
                type="submit" 
                disabled={isProcessingCommand || !sinkInputValue.trim()} 
                className="shrink-0 h-10 bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-200"
              >
                {isProcessingCommand ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                <span className="sr-only">Add to Sink</span>
              </Button>
            </form>
            <p className="text-xs text-muted-foreground">
              Tip: Add duration (e.g., "Task Name 30") and/or mark as critical (e.g., "Important Idea !")
            </p>

            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Loading Aether Sink" />
                <span className="ml-2 text-muted-foreground">Loading Aether Sink...</span>
              </div>
            ) : retiredTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-muted-foreground text-sm space-y-2">
                <Ghost className="h-8 w-8" />
                <p className="text-base font-semibold">Aether Sink is empty!</p>
                <p>No tasks have been retired yet. Complete or manually retire tasks to send them here.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {retiredTasks.map((task) => {
                  const hue = getEmojiHue(task.name);
                  const emoji = assignEmoji(task.name);
                  const ambientBackgroundColor = `hsl(${hue} 50% 35% / 0.3)`;
                  const isLocked = task.is_locked;
                  const isCriticalAwaitingEnergy = task.is_critical && profileEnergy < 80; // ADVANCED LOGIC: Critical Task Protection

                  return (
                    <div 
                      key={task.id} 
                      className={cn(
                        "relative flex items-center justify-between p-2 rounded-md border border-border/50 text-sm transition-all duration-200 ease-in-out cursor-pointer", // Added cursor-pointer
                        isLocked ? "border-primary/70 bg-primary/10" : "",
                        isCriticalAwaitingEnergy && "border-logo-yellow/70 bg-logo-yellow/10" // Visual for awaiting energy
                      )}
                      style={{ backgroundColor: isLocked || isCriticalAwaitingEnergy ? undefined : ambientBackgroundColor }}
                      onMouseEnter={() => setHoveredItemId(task.id)} // Set hovered item
                      onMouseLeave={() => setHoveredItemId(null)} // Clear hovered item
                      onClick={(e) => handleTaskItemClick(e, task)} // NEW: Added onClick handler
                    >
                      <div className="flex flex-col items-start flex-grow min-w-0">
                        <div className="flex items-center gap-1">
                          {task.is_critical && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="relative flex items-center justify-center h-4 w-4 rounded-full bg-logo-yellow text-white shrink-0">
                                  <Star className="h-3 w-3" strokeWidth={2.5} /> {/* Changed to Star icon */}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Critical Task: Must be completed today!</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          <span className="text-base">{emoji}</span>
                          <span className={cn("font-semibold truncate", isLocked ? "text-primary" : "text-foreground")}>{task.name}</span>
                          {task.duration && <span className={cn("text-xs", isLocked ? "text-primary/80" : "text-foreground/80")}>({task.duration} min)</span>}
                          {task.energy_cost !== undefined && task.energy_cost > 0 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className={cn(
                                  "flex items-center gap-1 text-xs font-semibold font-mono",
                                  isLocked ? "text-primary/80" : "text-foreground/80"
                                )}>
                                  {task.energy_cost} <Zap className="h-3 w-3" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Energy Cost</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs italic text-muted-foreground">
                            Originally for {format(new Date(task.original_scheduled_date), 'MMM d, yyyy')}
                          </span>
                          {isCriticalAwaitingEnergy && ( // ADVANCED LOGIC: Critical Task Protection - Status Badge
                            <Badge variant="outline" className="bg-logo-yellow/20 text-logo-yellow border-logo-yellow px-2 py-0.5 text-xs font-semibold">
                              Awaiting ≥ 80⚡ Slot
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-auto shrink-0">
                        {/* Lock/Unlock Button */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent parent onClick from firing
                                toggleRetiredTaskLock({ taskId: task.id, isLocked: !isLocked });
                              }}
                              className={cn(
                                "h-7 w-7 p-0 shrink-0",
                                isProcessingCommand ? "text-muted-foreground/50 cursor-not-allowed" : (isLocked ? "text-primary hover:bg-primary/20" : "text-muted-foreground hover:bg-muted/20")
                              )}
                              style={isProcessingCommand ? { pointerEvents: 'auto' } : undefined}
                            >
                              {isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
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
                                e.stopPropagation(); // Prevent parent onClick from firing
                                onRezoneTask(task);
                              }}
                              disabled={isLocked || isProcessingCommand || isCriticalAwaitingEnergy} // Disable if awaiting energy
                              className={cn(
                                "h-7 w-7 text-primary hover:bg-primary/10",
                                (isLocked || isProcessingCommand || isCriticalAwaitingEnergy) && "text-muted-foreground/50 cursor-not-allowed hover:bg-transparent"
                              )}
                              style={(isLocked || isProcessingCommand || isCriticalAwaitingEnergy) ? { pointerEvents: 'auto' } : undefined}
                            >
                              <RotateCcw className="h-4 w-4" />
                              <span className="sr-only">Rezone</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{isLocked ? "Unlock to Re-zone" : (isCriticalAwaitingEnergy ? "Awaiting ≥ 80⚡ Slot" : "Re-zone to schedule")}</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent parent onClick from firing
                                onRemoveRetiredTask(task.id);
                              }}
                              disabled={isLocked || isProcessingCommand}
                              className={cn(
                                "h-7 w-7 text-destructive hover:bg-destructive/20",
                                (isLocked || isProcessingCommand) && "text-muted-foreground/50 cursor-not-allowed hover:bg-transparent"
                              )}
                              style={(isLocked || isProcessingCommand) ? { pointerEvents: 'auto' } : undefined}
                            >
                              <Trash2 className="h-4 w-4" />
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
                          e.stopPropagation(); // Prevent parent onClick from firing
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
        </>
      </Card>
      <RetiredTaskDetailSheet
        task={selectedRetiredTask}
        open={isSheetOpen}
        onOpenChange={(open) => {
          console.log("AetherSink: Sheet onOpenChange. New state:", open);
          setIsSheetOpen(open);
          if (!open) setSelectedRetiredTask(null);
        }}
      />
    </>
  );
});

export default AetherSink;