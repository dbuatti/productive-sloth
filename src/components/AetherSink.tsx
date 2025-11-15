import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, RotateCcw, ListTodo, Ghost, AlertCircle, Sparkles, Loader2, Lock, Unlock, ChevronDown, ChevronUp } from 'lucide-react'; // Import Chevron icons
import { RetiredTask } from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { getEmojiHue, assignEmoji } from '@/lib/scheduler-utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';

interface AetherSinkProps {
  retiredTasks: RetiredTask[];
  onRezoneTask: (task: RetiredTask) => void;
  onRemoveRetiredTask: (taskId: string) => void; // For permanent deletion from sink
  isLoading: boolean;
  isProcessingCommand: boolean; // To disable button when other commands are running
  // Removed isSinkOpen and onToggle props as visibility is handled by tabs
  // Removed hideTitle prop as the tab provides the title
}

const AetherSink: React.FC<AetherSinkProps> = React.memo(({ retiredTasks, onRezoneTask, onRemoveRetiredTask, isLoading, isProcessingCommand }) => {
  const { toggleRetiredTaskLock } = useSchedulerTasks(''); // Pass empty string as selectedDate is not relevant here

  return (
    <Card className="animate-pop-in border-dashed border-muted-foreground/30 bg-secondary/10 animate-hover-lift">
      {/* Removed CardHeader as the tab provides the title and auto-schedule button is moving */}
      
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

              return (
                <div 
                  key={task.id} 
                  className={cn(
                    "flex items-center justify-between p-2 rounded-md border border-border/50 text-sm transition-all duration-200 ease-in-out",
                    isLocked ? "border-primary/70 bg-primary/10" : ""
                  )}
                  style={{ backgroundColor: isLocked ? undefined : ambientBackgroundColor }}
                >
                  <div className="flex flex-col items-start flex-grow min-w-0">
                    <div className="flex items-center gap-1">
                      {task.is_critical && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="relative flex items-center justify-center h-4 w-4 rounded-full bg-logo-yellow text-white shrink-0">
                              <AlertCircle className="h-3 w-3" strokeWidth={2.5} />
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
                    </div>
                    <span className="text-xs italic text-muted-foreground mt-0.5">
                      Originally for {format(new Date(task.original_scheduled_date), 'MMM d, yyyy')}
                    </span>
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
                          disabled={isLocked || isProcessingCommand}
                          className={cn(
                            "h-7 w-7 text-primary hover:bg-primary/10",
                            (isLocked || isProcessingCommand) && "text-muted-foreground/50 cursor-not-allowed hover:bg-transparent"
                          )}
                        >
                          <RotateCcw className="h-4 w-4" />
                          <span className="sr-only">Rezone</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{isLocked ? "Unlock to Re-zone" : "Re-zone to schedule"}</p>
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
    </Card>
  );
});

export default AetherSink;