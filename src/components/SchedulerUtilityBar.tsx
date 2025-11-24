import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, Zap, Shuffle, Settings2, ChevronsUp, Star, ArrowDownWideNarrow, Clock, Smile, Hourglass, Target, Trash2, RefreshCcw, SortAsc, SortDesc } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { RECHARGE_BUTTON_AMOUNT } from '@/lib/constants';
import { DBScheduledTask, SortBy, TaskPriority } from '@/types/scheduler';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger, 
  DropdownMenuSeparator, 
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import QuickScheduleBlock from './QuickScheduleBlock'; // Import QuickScheduleBlock

interface SchedulerUtilityBarProps {
  isProcessingCommand: boolean;
  hasFlexibleTasksOnCurrentDay: boolean;
  dbScheduledTasks: DBScheduledTask[];
  onRechargeEnergy: () => void;
  onRandomizeBreaks: () => void;
  onSortFlexibleTasks: (sortBy: SortBy) => void;
  onOpenWorkdayWindowDialog: () => void;
  sortBy: SortBy;
  onCompactSchedule: () => void;
  onQuickScheduleBlock: (duration: number, sortPreference: 'longestFirst' | 'shortestFirst') => void;
  retiredTasksCount: number;
  onZoneFocus: () => void;
  onAetherDump: () => void; // NEW
  onRefreshSchedule: () => void; // NEW
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
  onCompactSchedule,
  onQuickScheduleBlock,
  retiredTasksCount,
  onZoneFocus,
  onAetherDump, // NEW
  onRefreshSchedule, // NEW
}) => {
  const { profile } = useSession();
  const isEnergyFull = profile?.energy === 100;
  const hasUnlockedBreaks = dbScheduledTasks.some(task => task.name.toLowerCase() === 'break' && !task.is_locked);
  // NEW: Determine if there are any flexible tasks available for sorting (either in schedule or sink)
  const hasSortableFlexibleTasks = hasFlexibleTasksOnCurrentDay || retiredTasksCount > 0;

  const quickBlockDurations = [30, 60, 90, 120];

  return (
    <Card className="animate-pop-in animate-hover-lift">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 gap-3">
        {/* Primary Utility Group (Recharge, Breaks, Compact, Sort, Quick Block) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Energy Recharge Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={onRechargeEnergy} 
                disabled={isProcessingCommand || isEnergyFull}
                className={cn(
                  "h-11 w-11 text-logo-yellow hover:bg-logo-yellow/10 transition-all duration-200", // Increased size
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
                  "h-11 w-11 text-primary hover:bg-primary/10 transition-all duration-200", // Increased size
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

          {/* Compacting Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={onCompactSchedule} 
                disabled={isProcessingCommand || !hasFlexibleTasksOnCurrentDay}
                className={cn(
                  "h-11 w-11 text-primary hover:bg-primary/10 transition-all duration-200", // Increased size
                  !hasFlexibleTasksOnCurrentDay && "text-muted-foreground/50 cursor-not-allowed"
                )}
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
                    disabled={isProcessingCommand || !hasSortableFlexibleTasks}
                    className={cn(
                      "h-11 w-11 text-primary hover:bg-primary/10 transition-all duration-200", // Increased size
                      !hasSortableFlexibleTasks && "text-muted-foreground/50 cursor-not-allowed"
                    )}
                    style={isProcessingCommand || !hasSortableFlexibleTasks ? { pointerEvents: 'auto' } : undefined}
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
              <DropdownMenuLabel>Sort By</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onSortFlexibleTasks('PRIORITY_HIGH_TO_LOW')} className={cn(sortBy === 'PRIORITY_HIGH_TO_LOW' && 'bg-accent text-accent-foreground')}>
                <Star className="mr-2 h-4 w-4 text-logo-yellow" /> Priority (High to Low)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSortFlexibleTasks('PRIORITY_LOW_TO_HIGH')} className={cn(sortBy === 'PRIORITY_LOW_TO_HIGH' && 'bg-accent text-accent-foreground')}>
                <Star className="mr-2 h-4 w-4 text-logo-yellow" /> Priority (Low to High)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onSortFlexibleTasks('NAME_ASC')} className={cn(sortBy === 'NAME_ASC' && 'bg-accent text-accent-foreground')}>
                <SortAsc className="mr-2 h-4 w-4" /> Alphabetical (A to Z)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSortFlexibleTasks('NAME_DESC')} className={cn(sortBy === 'NAME_DESC' && 'bg-accent text-accent-foreground')}>
                <SortDesc className="mr-2 h-4 w-4" /> Alphabetical (Z to A)
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

          {/* Quick Schedule Block Dropdown */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    // Removed onClick={onZoneFocus} as this button is purely a trigger
                    disabled={isProcessingCommand}
                    className="h-11 w-11 text-logo-green hover:bg-logo-green/10 transition-all duration-200" // Increased size
                    style={isProcessingCommand ? { pointerEvents: 'auto' } : undefined}
                  >
                    {isProcessingCommand ? <Loader2 className="h-5 w-5 animate-spin" /> : <Hourglass className="h-5 w-5" />}
                    <span className="sr-only">Quick Schedule Block</span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent className="z-[60]">
                <p>Quick Schedule a Focus Block</p>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent className="p-2 space-y-2 w-max">
              <DropdownMenuLabel className="text-center">Schedule Focus Block</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {quickBlockDurations.map(duration => (
                <QuickScheduleBlock
                  key={duration}
                  duration={duration}
                  onScheduleBlock={onQuickScheduleBlock}
                  isProcessingCommand={isProcessingCommand}
                />
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Secondary Utility Group (Zone Focus, Aether Dump, Refresh, Settings) */}
        <div className="flex items-center gap-2 sm:ml-auto">
          {/* NEW: Aether Dump Button (Moved from Dashboard) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={onAetherDump} 
                disabled={isProcessingCommand || !hasFlexibleTasksOnCurrentDay}
                className="h-11 w-11 text-logo-orange hover:bg-logo-orange/10 transition-all duration-200"
                style={isProcessingCommand || !hasFlexibleTasksOnCurrentDay ? { pointerEvents: 'auto' } : undefined}
              >
                {isProcessingCommand ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trash2 className="h-5 w-5" />}
                <span className="sr-only">Aether Dump</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Move all flexible, unlocked tasks from CURRENT day to Aether Sink</p>
            </TooltipContent>
          </Tooltip>

          {/* Refresh/Reload Button (Moved from Dashboard) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={onRefreshSchedule} 
                disabled={isProcessingCommand}
                className="h-11 w-11 text-muted-foreground hover:bg-muted/10 transition-all duration-200"
                style={isProcessingCommand ? { pointerEvents: 'auto' } : undefined}
              >
                {isProcessingCommand ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCcw className="h-5 w-5" />}
                <span className="sr-only">Refresh Schedule</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Refresh schedule data</p>
            </TooltipContent>
          </Tooltip>

          {/* Zone Focus Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={onZoneFocus} 
                disabled={isProcessingCommand}
                className="h-11 w-11 text-accent hover:bg-accent/10 transition-all duration-200" // Increased size
                style={isProcessingCommand ? { pointerEvents: 'auto' } : undefined}
              >
                {isProcessingCommand ? <Loader2 className="h-5 w-5 animate-spin" /> : <Target className="h-5 w-5" />}
                <span className="sr-only">Zone Focus</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Zone Focus: Auto-schedule tasks matching current environment.</p>
            </TooltipContent>
          </Tooltip>

          {/* Workday Window Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={onOpenWorkdayWindowDialog} 
                disabled={isProcessingCommand}
                className="h-11 w-11 text-muted-foreground hover:bg-muted/10 transition-all duration-200" // Increased size
                style={isProcessingCommand ? { pointerEvents: 'auto' } : undefined}
              >
                {isProcessingCommand ? <Loader2 className="h-5 w-5 animate-spin" /> : <Settings2 className="h-5 w-5" />}
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