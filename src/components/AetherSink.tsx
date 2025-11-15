import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, RotateCcw, ListTodo, Ghost, AlertCircle, Sparkles, Loader2, Lock, Unlock, ChevronDown, ChevronUp, Zap, Star } from 'lucide-react'; // Import Chevron icons, Zap, Star
import { RetiredTask } from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { getEmojiHue, assignEmoji } from '@/lib/scheduler-utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import { Badge } from '@/components/ui/badge'; // Import Badge

interface AetherSinkProps {
  retiredTasks: RetiredTask[];
  onRezoneTask: (task: RetiredTask) => void;
  onRemoveRetiredTask: (taskId: string) => void;
  onAutoScheduleSink: () => void;
  isLoading: boolean;
  isProcessingCommand: boolean;
  isSinkOpen: boolean;
  onToggle: () => void;
  hideTitle?: boolean;
  profileEnergy: number; // NEW: Pass profile energy for critical task status
}

const AetherSink: React.FC<AetherSinkProps> = React.memo(({ retiredTasks, onRezoneTask, onRemoveRetiredTask, onAutoScheduleSink, isLoading, isProcessingCommand, isSinkOpen, onToggle, hideTitle = false, profileEnergy }) => {
  const hasRetiredTasks = retiredTasks.length > 0;
  const { toggleRetiredTaskLock } = useSchedulerTasks('');

  return (
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
                  disabled={!hasRetiredTasks || isLoading || isProcessingCommand || retiredTasks.every(task => task.is_locked)}
                  className="flex items-center gap-1 h-8 px-3 text-sm font-semibold bg-accent text-accent-foreground hover:bg-accent/90"
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
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggle}
                  className="h-8 w-8 text-muted-foreground hover:bg-secondary/50"
                >
                  {isSinkOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  <span className="sr-only">{isSinkOpen ? "Collapse Sink" : "Expand Sink"}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isSinkOpen ? "Collapse Sink" : "Expand Sink"}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>
      )}
      
      {isSinkOpen && (
        <>
          {!hideTitle && <div className="w-full border-t border-dashed border-muted-foreground/30 mt-2" />}
          <CardContent className="space-y-3">
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
                        "flex items-center justify-between p-2 rounded-md border border-border/50 text-sm transition-all duration-200 ease-in-out",
                        isLocked ? "border-primary/70 bg-primary/10" : "",
                        isCriticalAwaitingEnergy && "border-logo-yellow/70 bg-logo-yellow/10" // Visual for awaiting energy
                      )}
                      style={{ backgroundColor: isLocked || isCriticalAwaitingEnergy ? undefined : ambientBackgroundColor }}
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
                              onClick={() => toggleRetiredTaskLock({ taskId: task.id, isLocked: !isLocked })}
                              className={cn(
                                "h-7 w-7 p-0 shrink-0",
                                isLocked ? "text-primary hover:bg-primary/20" : "text-muted-foreground hover:bg-muted/20"
                              )}
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
                              onClick={() => onRezoneTask(task)}
                              disabled={isLocked || isProcessingCommand || isCriticalAwaitingEnergy} // Disable if awaiting energy
                              className={cn(
                                "h-7 w-7 text-primary hover:bg-primary/10",
                                (isLocked || isProcessingCommand || isCriticalAwaitingEnergy) && "text-muted-foreground/50 cursor-not-allowed hover:bg-transparent"
                              )}
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
                              onClick={() => onRemoveRetiredTask(task.id)}
                              disabled={isLocked || isProcessingCommand}
                              className={cn(
                                "h-7 w-7 text-destructive hover:bg-destructive/20",
                                (isLocked || isProcessingCommand) && "text-muted-foreground/50 cursor-not-allowed hover:bg-transparent"
                              )}
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
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </>
      )}
    </Card>
  );
});

export default AetherSink;