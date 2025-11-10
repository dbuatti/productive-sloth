import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, RotateCcw, ListTodo, Ghost } from 'lucide-react'; // Import RotateCcw icon, added Ghost
import { RetiredTask } from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { getEmojiHue, assignEmoji } from '@/lib/scheduler-utils'; // Import getEmojiHue and assignEmoji
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'; // Import Tooltip components

interface AetherSinkProps {
  retiredTasks: RetiredTask[];
  onRezoneTask: (task: RetiredTask) => void;
  onRemoveRetiredTask: (taskId: string) => void; // For permanent deletion from sink
  isLoading: boolean;
}

const AetherSink: React.FC<AetherSinkProps> = ({ retiredTasks, onRezoneTask, onRemoveRetiredTask, isLoading }) => {
  return (
    <Card className="animate-pop-in border-dashed border-muted-foreground/30 bg-secondary/10 animate-hover-lift">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-bold flex items-center gap-2 text-muted-foreground">
          <Trash2 className="h-5 w-5" /> The Aether Sink ({retiredTasks.length} Retired Task{retiredTasks.length !== 1 ? 's' : ''})
        </CardTitle>
        <div className="w-full border-t border-dashed border-muted-foreground/30 mt-2" />
      </CardHeader>
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
};

export default AetherSink;