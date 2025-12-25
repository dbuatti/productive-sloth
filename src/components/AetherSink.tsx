import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RetiredTask, RetiredTaskSortBy } from '@/types/scheduler';
import { Archive, Trash, Lock, Unlock, Zap, Utensils, Star, Home, Laptop, Globe, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { getEnvironmentIcon } from '@/lib/scheduler-utils'; // Assuming this utility exists

interface AetherSinkProps {
  retiredTasks: RetiredTask[];
  isLoading: boolean;
  onRezoneTask: (retiredTask: RetiredTask) => Promise<void>;
  onPermanentDeleteRetiredTask: (taskId: string, taskName: string) => void; // Added this prop
  retiredSortBy: RetiredTaskSortBy;
  setRetiredSortBy: React.Dispatch<React.SetStateAction<RetiredTaskSortBy>>;
  isProcessingCommand: boolean;
}

const AetherSink: React.FC<AetherSinkProps> = ({
  retiredTasks,
  isLoading,
  onRezoneTask,
  onPermanentDeleteRetiredTask,
  retiredSortBy,
  setRetiredSortBy,
  isProcessingCommand,
}) => {
  if (isLoading) {
    return (
      <Card className="animate-pop-in animate-hover-lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Archive className="h-5 w-5 text-muted-foreground" /> Aether Sink
          </CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground">Loading Aether Sink...</CardContent>
      </Card>
    );
  }

  if (retiredTasks.length === 0) {
    return (
      <Card className="animate-pop-in animate-hover-lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Archive className="h-5 w-5 text-muted-foreground" /> Aether Sink
          </CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground">Your Aether Sink is empty. No retired tasks.</CardContent>
      </Card>
    );
  }

  const sortedRetiredTasks = [...retiredTasks].sort((a, b) => {
    switch (retiredSortBy) {
      case 'OLDEST_FIRST':
        return new Date(a.retired_at || a.created_at).getTime() - new Date(b.retired_at || b.created_at).getTime();
      case 'NEWEST_FIRST':
        return new Date(b.retired_at || b.created_at).getTime() - new Date(a.retired_at || a.created_at).getTime();
      case 'DURATION_SHORTEST_FIRST':
        return (a.duration || 0) - (b.duration || 0);
      case 'DURATION_LONGEST_FIRST':
        return (b.duration || 0) - (a.duration || 0);
      case 'PRIORITY_HIGH_TO_LOW':
        return (b.energy_cost || 0) - (a.energy_cost || 0);
      case 'PRIORITY_LOW_TO_HIGH':
        return (a.energy_cost || 0) - (b.energy_cost || 0);
      case 'NAME_ASC':
        return a.name.localeCompare(b.name);
      case 'NAME_DESC':
        return b.name.localeCompare(a.name);
      default:
        return 0;
    }
  });

  return (
    <Card className="animate-pop-in animate-hover-lift">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Archive className="h-5 w-5 text-logo-orange" /> Aether Sink
        </CardTitle>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="ml-auto">
              Sort by: {retiredSortBy.replace(/_/g, ' ').toLowerCase()}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setRetiredSortBy('NEWEST_FIRST')}>Newest First</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setRetiredSortBy('OLDEST_FIRST')}>Oldest First</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setRetiredSortBy('DURATION_SHORTEST_FIRST')}>Duration (Shortest)</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setRetiredSortBy('DURATION_LONGEST_FIRST')}>Duration (Longest)</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setRetiredSortBy('PRIORITY_HIGH_TO_LOW')}>Priority (High to Low)</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setRetiredSortBy('PRIORITY_LOW_TO_HIGH')}>Priority (Low to High)</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setRetiredSortBy('NAME_ASC')}>Name (A-Z)</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setRetiredSortBy('NAME_DESC')}>Name (Z-A)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="space-y-3">
        {sortedRetiredTasks.map((task) => (
          <div
            key={task.id}
            className={cn(
              "flex items-center justify-between p-3 rounded-lg border shadow-sm transition-all duration-200 ease-in-out",
              "bg-secondary/50 hover:bg-secondary/70 hover:border-primary/50",
              task.is_locked && "border-primary/70 bg-primary/10",
              isProcessingCommand && "opacity-70 cursor-not-allowed"
            )}
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-grow">
              <span className={cn(
                "font-semibold text-base",
                task.is_locked ? "text-primary" : "text-foreground"
              )}>
                {task.name}
              </span>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {task.duration && <span>({task.duration} min)</span>}
                {task.is_critical && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Star className="h-4 w-4 text-logo-yellow" />
                    </TooltipTrigger>
                    <TooltipContent>Critical Task</TooltipContent>
                  </Tooltip>
                )}
                {task.energy_cost !== undefined && task.energy_cost !== 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={cn(
                        "flex items-center gap-1 font-semibold font-mono text-xs px-1 py-0.5 rounded-sm",
                        task.energy_cost < 0 ? "text-logo-green bg-logo-green/30" : "text-logo-yellow bg-logo-yellow/30"
                      )}>
                        {task.energy_cost > 0 ? task.energy_cost : `+${Math.abs(task.energy_cost)}`}
                        {task.energy_cost > 0 ? <Zap className="h-3 w-3" /> : <Utensils className="h-3 w-3" />}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{task.energy_cost > 0 ? "Energy Cost" : "Energy Gain (Meal)"}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                {task.task_environment && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="h-4 w-4 flex items-center justify-center shrink-0">
                        {getEnvironmentIcon(task.task_environment)}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Environment: {task.task_environment.charAt(0).toUpperCase() + task.task_environment.slice(1)}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 ml-auto shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRezoneTask(task)}
                    disabled={isProcessingCommand || task.is_locked}
                    className={cn(
                      "h-7 w-7 p-0",
                      (isProcessingCommand || task.is_locked) ? "text-muted-foreground/50 cursor-not-allowed" : "text-primary hover:bg-primary/20"
                    )}
                  >
                    <Archive className="h-4 w-4" />
                    <span className="sr-only">Rezone task</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{task.is_locked ? "Unlock to Rezone" : "Rezone to Schedule"}</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onPermanentDeleteRetiredTask(task.id, task.name)}
                    disabled={isProcessingCommand}
                    className={cn(
                      "h-7 w-7 p-0",
                      isProcessingCommand ? "text-muted-foreground/50 cursor-not-allowed" : "text-red-500 hover:bg-red-500/20"
                    )}
                  >
                    <Trash className="h-4 w-4" />
                    <span className="sr-only">Delete permanently</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Permanently delete from Aether Sink</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default AetherSink;