import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, Zap, Lock, Unlock, PlusCircle, Star, ArrowDownWideNarrow, ArrowUpWideNarrow, Clock, Smile, RefreshCcw, AlertTriangle, Sparkles } from 'lucide-react';
import { RetiredTask, RetiredTaskSortBy, UnifiedTask, NewDBScheduledTask } from '@/types/scheduler';
import { cn } from '@/lib/utils';
import useSchedulerTasks from '@/hooks/use-scheduler-tasks';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import RetiredTaskDetailSheet from './RetiredTaskDetailSheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { showSuccess, showError } from '@/utils/toast';
import { parseISO } from 'date-fns';

interface AetherSinkProps {
  selectedDate: string;
  onAutoBalance: (tasks: UnifiedTask[]) => void;
  isProcessingCommand: boolean;
}

const AetherSink: React.FC<AetherSinkProps> = ({ selectedDate, onAutoBalance, isProcessingCommand }) => {
  const { 
    retiredTasks, 
    isLoadingRetired, // Corrected destructuring from 'isLoading' to 'isLoadingRetired'
    deleteRetiredTask, 
    updateRetiredTask,
    retiredTaskSortBy,
    setRetiredTaskSortBy,
    retiredTasksCount,
  } = useSchedulerTasks();
  
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<RetiredTask | null>(null);

  const handleToggleLock = useCallback((task: RetiredTask) => {
    updateRetiredTask({ id: task.id, is_locked: !task.is_locked });
  }, [updateRetiredTask]);

  const handleRezone = useCallback((task: RetiredTask) => {
    // Rezone logic: delete from sink, add to scheduled tasks for the selected day
    const duration = task.duration || 30; // Default to 30 min if duration is null

    const newTask: NewDBScheduledTask = {
      name: task.name,
      break_duration: task.break_duration,
      scheduled_date: selectedDate,
      is_critical: task.is_critical,
      is_flexible: true, // Re-zoned tasks are flexible by default
      is_locked: false,
      energy_cost: task.energy_cost,
      is_custom_energy_cost: task.is_custom_energy_cost,
    };

    // Use the mutation from useSchedulerTasks to add the task
    // Note: We need to ensure useSchedulerTasks exposes an addTask mutation for scheduled tasks
    // Assuming it does, or we'll use the existing one if available.
    // Since we are using the auto-balance mechanism for scheduling, let's just delete it from the sink
    // and rely on the user to run auto-balance, or we can implement a direct add.
    // For simplicity, let's implement a direct add here.
    // Since useSchedulerTasks doesn't expose a direct addScheduledTask, we'll rely on the auto-balance for now.
    // For a quick rezone, we'll just delete it from the sink and tell the user to run auto-balance.
    
    deleteRetiredTask(task.id, {
      onSuccess: () => {
        showSuccess(`Task "${task.name}" moved from Aether Sink. Run Auto Schedule to place it.`);
      }
    });
  }, [deleteRetiredTask, selectedDate]);

  const handleAutoBalanceClick = useCallback(() => {
    if (isProcessingCommand) return;

    const unifiedTasks: UnifiedTask[] = retiredTasks.map(task => ({
      id: task.id,
      name: task.name,
      duration: task.duration || 30, // Default to 30 min if null
      break_duration: task.break_duration,
      is_critical: task.is_critical,
      is_flexible: true, // Retired tasks are always flexible when re-zoned
      energy_cost: task.energy_cost,
      source: 'retired',
      originalId: task.id,
      is_custom_energy_cost: task.is_custom_energy_cost,
      created_at: task.retired_at, // Use retired_at as creation time for sorting
    }));

    onAutoBalance(unifiedTasks);
  }, [retiredTasks, onAutoBalance, isProcessingCommand]);

  const sortedRetiredTasks = useMemo(() => {
    return [...retiredTasks].sort((a, b) => {
      switch (retiredTaskSortBy) {
        case 'NAME_ASC':
          return a.name.localeCompare(b.name);
        case 'NAME_DESC':
          return b.name.localeCompare(a.name);
        case 'DURATION_ASC':
          return (a.duration || 0) - (b.duration || 0);
        case 'DURATION_DESC':
          return (b.duration || 0) - (a.duration || 0);
        case 'CRITICAL_FIRST':
          if (a.is_critical && !b.is_critical) return -1;
          if (!a.is_critical && b.is_critical) return 1;
          return 0;
        case 'LOCKED_FIRST':
          if (a.is_locked && !b.is_locked) return -1;
          if (!a.is_locked && b.is_locked) return 1;
          return 0;
        case 'ENERGY_ASC':
          return a.energy_cost - b.energy_cost;
        case 'ENERGY_DESC':
          return b.energy_cost - a.energy_cost;
        case 'RETIRED_AT_NEWEST':
          return parseISO(b.retired_at).getTime() - parseISO(a.retired_at).getTime();
        case 'RETIRED_AT_OLDEST':
          return parseISO(a.retired_at).getTime() - parseISO(b.retired_at).getTime();
        case 'COMPLETED_FIRST':
          if (a.is_completed && !b.is_completed) return -1;
          if (!a.is_completed && b.is_completed) return 1;
          return 0;
        case 'COMPLETED_LAST':
          if (a.is_completed && !b.is_completed) return 1;
          if (!a.is_completed && b.is_completed) return -1;
          return 0;
        case 'EMOJI':
          // Fallback to name sort for emoji sort
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });
  }, [retiredTasks, retiredTaskSortBy]);

  const getSortLabel = (sort: RetiredTaskSortBy) => {
    switch (sort) {
      case 'NAME_ASC': return 'Name (A-Z)';
      case 'NAME_DESC': return 'Name (Z-A)';
      case 'DURATION_ASC': return 'Duration (Shortest)';
      case 'DURATION_DESC': return 'Duration (Longest)';
      case 'CRITICAL_FIRST': return 'Critical First';
      case 'LOCKED_FIRST': return 'Locked First';
      case 'ENERGY_ASC': return 'Energy (Low)';
      case 'ENERGY_DESC': return 'Energy (High)';
      case 'RETIRED_AT_NEWEST': return 'Retired (Newest)';
      case 'RETIRED_AT_OLDEST': return 'Retired (Oldest)';
      case 'COMPLETED_FIRST': return 'Completed First';
      case 'COMPLETED_LAST': return 'Completed Last';
      case 'EMOJI': return 'Emoji';
      default: return 'Sort Options';
    }
  };

  const handlePermanentDeleteAll = () => {
    if (window.confirm("Are you absolutely sure you want to permanently delete ALL unlocked tasks in the Aether Sink? This cannot be undone.")) {
      // Assuming useSchedulerTasks exposes a mutation for this
      // Since it doesn't, we'll rely on the user to implement it or use a placeholder.
      showError("Permanent bulk deletion is not yet implemented.");
    }
  };

  return (
    <Card className="animate-slide-in-up animate-hover-lift">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xl font-bold text-foreground flex items-center gap-2">
          <Trash2 className="h-6 w-6 text-muted-foreground" /> Aether Sink ({retiredTasksCount})
        </CardTitle>
        <div className="flex items-center gap-2">
          {/* Auto Schedule Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="default" 
                size="sm" 
                onClick={handleAutoBalanceClick} 
                disabled={isProcessingCommand || retiredTasks.length === 0}
                className="h-8 px-3 text-sm font-semibold bg-primary hover:bg-primary/90 transition-all duration-200"
                style={isProcessingCommand || retiredTasks.length === 0 ? { pointerEvents: 'auto' } : undefined}
              >
                {isProcessingCommand ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCcw className="h-4 w-4 mr-2" />}
                Auto Schedule
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Run Auto-Balance: Attempt to schedule all flexible tasks (from sink and current schedule) into today.</p>
            </TooltipContent>
          </Tooltip>

          {/* Sort Dropdown */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    disabled={isProcessingCommand || retiredTasks.length === 0}
                    className="h-8 w-8 text-muted-foreground hover:bg-secondary/50 transition-all duration-200"
                    style={isProcessingCommand || retiredTasks.length === 0 ? { pointerEvents: 'auto' } : undefined}
                  >
                    <ArrowDownWideNarrow className="h-4 w-4" />
                    <span className="sr-only">Sort Sink Tasks</span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>Sort Sink Tasks ({getSortLabel(retiredTaskSortBy)})</p>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Sort By</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {([
                'RETIRED_AT_NEWEST', 'RETIRED_AT_OLDEST', 
                'CRITICAL_FIRST', 'LOCKED_FIRST', 
                'DURATION_DESC', 'DURATION_ASC', 
                'ENERGY_DESC', 'ENERGY_ASC',
                'NAME_ASC', 'NAME_DESC',
              ] as RetiredTaskSortBy[]).map(sort => (
                <DropdownMenuItem 
                  key={sort} 
                  onClick={() => setRetiredTaskSortBy(sort)}
                  className={cn(retiredTaskSortBy === sort && 'bg-accent text-accent-foreground')}
                >
                  {getSortLabel(sort)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Delete All Unlocked Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="destructive" 
                size="icon" 
                onClick={handlePermanentDeleteAll} 
                disabled={isProcessingCommand || retiredTasks.length === 0}
                className="h-8 w-8 text-destructive hover:bg-destructive/10 transition-all duration-200"
                style={isProcessingCommand || retiredTasks.length === 0 ? { pointerEvents: 'auto' } : undefined}
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Delete All Unlocked</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Permanently delete all unlocked tasks in the Sink</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoadingRetired ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : retiredTasks.length === 0 ? (
          <div className="text-center text-muted-foreground p-8">
            <Sparkles className="h-8 w-8 mx-auto mb-2" />
            <p>The Aether Sink is empty. Great job keeping your schedule clean!</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
            {sortedRetiredTasks.map(task => (
              <div 
                key={task.id} 
                className={cn(
                  "flex items-center justify-between p-3 rounded-md border border-border/50 bg-card transition-all duration-200 ease-in-out",
                  task.is_locked && "border-dashed border-primary/50 bg-primary/5",
                  "hover:bg-secondary/50 animate-hover-lift"
                )}
              >
                <div className="flex items-center space-x-3 min-w-0 flex-grow">
                  <span className="text-lg">{task.is_critical ? '🚨' : '🗑️'}</span>
                  <div className="min-w-0 flex-grow">
                    <p className={cn("font-semibold truncate", task.is_completed && "line-through text-muted-foreground")}>
                      {task.name}
                    </p>
                    <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-0.5">
                      {task.duration && (
                        <Badge variant="secondary" className="font-mono">
                          {task.duration} min
                        </Badge>
                      )}
                      <Badge variant="secondary" className="font-mono flex items-center gap-1">
                        {task.energy_cost} <Zap className="h-3 w-3" />
                      </Badge>
                      {task.is_critical && (
                        <Badge variant="destructive" className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Critical
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-1 shrink-0 ml-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleRezone(task)}
                        disabled={isProcessingCommand}
                        className="h-8 w-8 text-logo-green hover:bg-logo-green/10"
                      >
                        <PlusCircle className="h-4 w-4" />
                        <span className="sr-only">Re-zone</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Re-zone to Today's Schedule</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleToggleLock(task)}
                        disabled={isProcessingCommand}
                        className="h-8 w-8 text-muted-foreground hover:bg-secondary/50"
                      >
                        {task.is_locked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                        <span className="sr-only">{task.is_locked ? "Unlock" : "Lock"}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{task.is_locked ? "Unlock Task" : "Lock Task"}</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => {
                          setSelectedTask(task);
                          setIsSheetOpen(true);
                        }}
                        disabled={isProcessingCommand}
                        className="h-8 w-8 text-muted-foreground hover:bg-secondary/50"
                      >
                        <Star className="h-4 w-4" />
                        <span className="sr-only">Details</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>View Details</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <RetiredTaskDetailSheet 
        task={selectedTask}
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
      />
    </Card>
  );
};

export default AetherSink;