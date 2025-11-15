import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, Zap, Shuffle, Settings2, Globe, ChevronsUp, Star, ArrowDownWideNarrow, ArrowUpWideNarrow, Clock, Smile } from 'lucide-react'; // Removed Brain icon for Vibe Flow, Added Smile icon
import { useSession } from '@/hooks/use-session';
import { RECHARGE_BUTTON_AMOUNT } from '@/lib/constants';
import { DBScheduledTask, SortBy, TaskPriority } from '@/types/scheduler';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

interface SchedulerUtilityBarProps {
  isProcessingCommand: boolean;
  hasFlexibleTasksOnCurrentDay: boolean;
  dbScheduledTasks: DBScheduledTask[];
  onRechargeEnergy: () => void;
  onRandomizeBreaks: () => void;
  onSortFlexibleTasks: (sortBy: SortBy) => void;
  onOpenWorkdayWindowDialog: () => void;
  sortBy: SortBy;
  onCompactSchedule: () => void; // NEW: Add onCompactSchedule prop
}

const SchedulerUtilityBar: React.FC<SchedulerUtilityBarProps> = ({
  isProcessingCommand,
  hasFlexibleTasksOnCurrentDay,
  dbScheduledTasks,
  onRechargeEnergy,
  onRandomizeBreaks,
  onSortFlexibleTasks,
  onOpenWorkdayWindowDialog,
  sortBy,
  onCompactSchedule, // NEW: Destructure prop
}) => {
  const { profile } = useSession();
  const isEnergyFull = profile?.energy === 100;
  const hasUnlockedBreaks = dbScheduledTasks.some(task => task.name.toLowerCase() === 'break' && !task.is_locked);

  return (
    <Card className="animate-pop-in animate-hover-lift">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          {/* Energy Recharge Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={onRechargeEnergy} 
                disabled={isProcessingCommand || isEnergyFull}
                className={cn(
                  "h-10 w-10 text-logo-yellow hover:bg-logo-yellow/10 transition-all duration-200",
                  isEnergyFull && "text-muted-foreground/50 cursor-not-allowed"
                )}
                style={isProcessingCommand || isEnergyFull ? { pointerEvents: 'auto' } : undefined}
              >
                {isProcessingCommand ? <Loader2 className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5" />}
                <span className="sr-only">Recharge Energy</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isEnergyFull ? "Energy Full!" : `Recharge Energy (+${RECHARGE_BUTTON_AMOUNT})`}</p>
            </TooltipContent>
          </Tooltip>

          {/* Randomize Breaks Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={onRandomizeBreaks}
                disabled={isProcessingCommand || !hasUnlockedBreaks}
                className={cn(
                  "h-10 w-10 text-primary hover:bg-primary/10 transition-all duration-200",
                  !hasUnlockedBreaks && "text-muted-foreground/50 cursor-not-allowed"
                )}
                style={isProcessingCommand || !hasUnlockedBreaks ? { pointerEvents: 'auto' } : undefined}
              >
                {isProcessingCommand ? <Loader2 className="h-5 w-5 animate-spin" /> : <Shuffle className="h-5 w-5" />}
                <span className="sr-only">Randomize Breaks</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Randomly re-allocate unlocked breaks</p>
            </TooltipContent>
          </Tooltip>

          {/* Compacting Button (NEW LOCATION) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={onCompactSchedule} 
                disabled={isProcessingCommand || !hasFlexibleTasksOnCurrentDay}
                className="h-10 w-10 text-primary hover:bg-primary/10 transition-all duration-200"
                style={isProcessingCommand || !hasFlexibleTasksOnCurrentDay ? { pointerEvents: 'auto' } : undefined}
              >
                {isProcessingCommand ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronsUp className="h-5 w-5" />}
                <span className="sr-only">Compact Schedule</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Compact flexible tasks to fill gaps</p>
            </TooltipContent>
          </Tooltip>

          {/* Sort Flexible Tasks Dropdown */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    disabled={isProcessingCommand || !hasFlexibleTasksOnCurrentDay}
                    className={cn(
                      "h-10 w-10 text-primary hover:bg-primary/10 transition-all duration-200",
                      !hasFlexibleTasksOnCurrentDay && "text-muted-foreground/50 cursor-not-allowed"
                    )}
                    style={isProcessingCommand || !hasFlexibleTasksOnCurrentDay ? { pointerEvents: 'auto' } : undefined}
                  >
                    {isProcessingCommand ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowDownWideNarrow className="h-5 w-5" />}
                    <span className="sr-only">Sort Flexible Tasks</span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>Sort flexible tasks</p>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => onSortFlexibleTasks('PRIORITY_HIGH_TO_LOW')} className={cn(sortBy === 'PRIORITY_HIGH_TO_LOW' && 'bg-accent text-accent-foreground')}>
                <Star className="mr-2 h-4 w-4 text-logo-yellow" /> Priority (High to Low)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSortFlexibleTasks('PRIORITY_LOW_TO_HIGH')} className={cn(sortBy === 'PRIORITY_LOW_TO_HIGH' && 'bg-accent text-accent-foreground')}>
                <Star className="mr-2 h-4 w-4 text-logo-yellow" /> Priority (Low to High)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onSortFlexibleTasks('TIME_EARLIEST_TO_LATEST')} className={cn(sortBy === 'TIME_EARLIEST_TO_LATEST' && 'bg-accent text-accent-foreground')}>
                <Clock className="mr-2 h-4 w-4" /> Duration (Shortest First)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSortFlexibleTasks('TIME_LATEST_TO_EARLIEST')} className={cn(sortBy === 'TIME_LATEST_TO_EARLIEST' && 'bg-accent text-accent-foreground')}>
                <Clock className="mr-2 h-4 w-4" /> Duration (Longest First)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onSortFlexibleTasks('EMOJI')} className={cn(sortBy === 'EMOJI' && 'bg-accent text-accent-foreground')}>
                <Smile className="mr-2 h-4 w-4" /> Emoji
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2">
          {/* Workday Window Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={onOpenWorkdayWindowDialog} 
                disabled={isProcessingCommand}
                className="h-10 w-10 text-muted-foreground hover:bg-muted/10 transition-all duration-200"
                style={isProcessingCommand ? { pointerEvents: 'auto' } : undefined}
              >
                <Settings2 className="h-5 w-5" />
                <span className="sr-only">Workday Window Settings</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Adjust Workday Start/End Times</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </Card>
  );
};

export default SchedulerUtilityBar;