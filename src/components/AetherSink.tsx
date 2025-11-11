import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, RotateCcw, ListTodo, Ghost, AlertCircle, Sparkles, Loader2 } from 'lucide-react'; // Import RotateCcw icon, added Ghost, AlertCircle, Sparkles, Loader2
import { RetiredTask } from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { getEmojiHue, assignEmoji } from '@/lib/scheduler-utils'; // Import getEmojiHue and assignEmoji
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'; // Import Tooltip components

interface AetherSinkProps {
  retiredTasks: RetiredTask[];
  onRezoneTask: (task: RetiredTask) => void;
  onRemoveRetiredTask: (taskId: string) => void; // For permanent deletion from sink
  onAutoScheduleSink: () => void; // NEW: Handler for auto-scheduling all sink tasks
  isLoading: boolean;
  isProcessingCommand: boolean; // NEW: To disable button when other commands are running
}

const AetherSink: React.FC<AetherSinkProps> = React.memo(({ retiredTasks, onRezoneTask, onRemoveRetiredTask, onAutoScheduleSink, isLoading, isProcessingCommand }) => {
  const hasRetiredTasks = retiredTasks.length > 0;

  return (
    <Card className="animate-pop-in border-dashed border-muted-foreground/30 bg-secondary/10 animate-hover-lift">
      <CardHeader className="pb-2 flex flex-row items-center justify-between"> {/* Adjusted for button */}
        <CardTitle className="text-xl font-bold flex items-center gap-2 text-muted-foreground">
          <Trash2 className="h-5 w-5" /> The Aether Sink ({retiredTasks.length} Retired Task{retiredTasks.length !== 1 ? 's' : ''})
        </CardTitle>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              size="sm"
              onClick={onAutoScheduleSink}
              disabled={!hasRetiredTasks || isLoading || isProcessingCommand}
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
            <p>Automatically re-zone all retired tasks into your current schedule.</p>
          </TooltipContent>
        </Tooltip>
      </CardHeader>
      <div className="w-full border-t border-dashed border-muted-foreground/30 mt-2" /> {/* Moved separator */}
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <ListTodo className="h-6 w-6 animate-pulse text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading Aether Sink...</span>
          </div>
        ) : retiredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground text-sm space-y-2">
            <Ghost className="h-8 w-8" />
            <p className="text-base font-semibold">Aether Sink is empty!</p>
            <p>No tasks have been retired yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {retiredTasks.map((task) => {
              const hue = getEmojiHue(task.name);
              const emoji = assignEmoji(task.name);
              const ambientBackgroundColor = `hsl(${hue} 50% 35% / 0.3)`;

              return (
                <div 
                  key={task.id} 
                  className="flex items-center justify-between p-2 rounded-md border border-border/50 text-sm transition-all duration-200 ease-in-out"
                  style={{ backgroundColor: ambientBackgroundColor }}
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
                      <span className="font-semibold text-foreground truncate">{task.name}</span>
                      {task.duration && <span className="text-xs text-foreground/80">({task.duration} min)</span>}
                    </div>
                    <span className="text-xs italic text-muted-foreground mt-0.5">
                      Originally for {format(new Date(task.original_scheduled_date), 'MMM d, yyyy')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 ml-auto shrink-0">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="secondary"
                          size="icon" 
                          onClick={() => onRezoneTask(task)}
                          className="h-7 w-7 text-primary hover:bg-primary/10"
                        >
                          <RotateCcw className="h-4 w-4" />
                          <span className="sr-only">Rezone</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Re-zone to schedule</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => onRemoveRetiredTask(task.id)}
                          className="h-7 w-7 text-destructive hover:bg-destructive/20"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Permanently delete</p>
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