import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, RotateCcw, Clock, ListTodo } from 'lucide-react';
import { RetiredTask } from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface AetherSinkProps {
  retiredTasks: RetiredTask[];
  onRezoneTask: (task: RetiredTask) => void;
  onRemoveRetiredTask: (taskId: string) => void; // For permanent deletion from sink
  isLoading: boolean;
}

const AetherSink: React.FC<AetherSinkProps> = ({ retiredTasks, onRezoneTask, onRemoveRetiredTask, isLoading }) => {
  if (retiredTasks.length === 0 && !isLoading) {
    return null; // Don't render if no retired tasks
  }

  return (
    <Card className="animate-pop-in border-dashed border-muted-foreground/30 bg-secondary/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-bold flex items-center gap-2 text-muted-foreground">
          <Trash2 className="h-5 w-5" /> The Aether Sink ({retiredTasks.length} Retired Task{retiredTasks.length !== 1 ? 's' : ''})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <ListTodo className="h-6 w-6 animate-pulse text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading Aether Sink...</span>
          </div>
        ) : (
          <div className="space-y-2">
            {retiredTasks.map((task) => (
              <div 
                key={task.id} 
                className="flex items-center justify-between p-3 rounded-md bg-background border border-border/50 text-sm text-muted-foreground"
              >
                <div className="flex flex-col items-start flex-grow">
                  <span className="font-semibold text-foreground">{task.name}</span>
                  <span className="text-xs italic">
                    Originally for {format(new Date(task.original_scheduled_date), 'MMM d, yyyy')}
                  </span>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => onRezoneTask(task)}
                    className="flex items-center gap-1 text-primary hover:bg-primary/10"
                  >
                    <RotateCcw className="h-3 w-3" /> Rezone
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => onRemoveRetiredTask(task.id)}
                    className="text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AetherSink;