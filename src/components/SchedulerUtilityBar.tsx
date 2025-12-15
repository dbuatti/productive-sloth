import React from 'react';
import { DBScheduledTask, SortBy } from '@/types/scheduler';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { Zap, Shuffle, ChevronsUp, RefreshCcw, Globe, Settings2, Loader2, ArrowDownWideNarrow, ArrowUpWideNarrow, Clock, Anchor, Feather, PlusCircle, MinusCircle, Star, Database, Trash2, CalendarCheck, Coffee } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import QuickScheduleBlock from './QuickScheduleBlock'; // Import QuickScheduleBlock

interface SchedulerUtilityBarProps {
  isProcessingCommand: boolean;
  hasFlexibleTasksOnCurrentDay: boolean;
  dbScheduledTasks: DBScheduledTask[];
  onRechargeEnergy: () => Promise<void>;
  onRandomizeBreaks: () => Promise<void>;
  onSortFlexibleTasks: (sortBy: SortBy) => Promise<void>;
  onOpenWorkdayWindowDialog: () => void;
  sortBy: SortBy;
  onCompactSchedule: () => Promise<void>;
  onQuickScheduleBlock: (duration: number, sortPreference: 'longestFirst' | 'shortestFirst') => Promise<void>;
  retiredTasksCount: number;
  onZoneFocus: () => Promise<void>;
  onAetherDump: () => Promise<void>;
  onRefreshSchedule: () => void;
  onAetherDumpMega: () => Promise<void>;
  onQuickBreak: () => Promise<void>; // NEW PROP
}

const DURATION_BUCKETS = [15, 30, 60];

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
  onAetherDump,
  onRefreshSchedule,
  onAetherDumpMega,
  onQuickBreak,
}) => {
  const hasBreaks = dbScheduledTasks.some(task => task.name.toLowerCase() === 'break');
  const hasUnlockedBreaks = dbScheduledTasks.some(task => task.name.toLowerCase() === 'break' && !task.is_locked);
  const hasUnlockedFlexibleTasks = dbScheduledTasks.some(task => task.is_flexible && !task.is_locked);

  const sortOptions: { value: SortBy, label: string, icon: React.ElementType }[] = [
    { value: 'TIME_EARLIEST_TO_LATEST', label: 'Time (Earliest)', icon: ArrowUpWideNarrow },
    { value: 'TIME_LATEST_TO_EARLIEST', label: 'Time (Latest)', icon: ArrowDownWideNarrow },
    { value: 'PRIORITY_HIGH_TO_LOW', label: 'Priority (High)', icon: Star },
    { value: 'PRIORITY_LOW_TO_HIGH', label: 'Priority (Low)', icon: Star },
    { value: 'EMOJI', label: 'Emoji Hue', icon: PlusCircle },
    { value: 'NAME_ASC', label: 'Name (A-Z)', icon: ArrowUpWideNarrow },
    { value: 'NAME_DESC', label: 'Name (Z-A)', icon: ArrowDownWideNarrow },
  ];

  return (
    <Card className="p-4 animate-slide-in-up animate-hover-lift">
      <div className="flex flex-col gap-4">
        
        {/* Row 1: Quick Actions (Compact, Randomize, Zone Focus, Recharge, Quick Break) */}
        <div className="flex flex-wrap items-center gap-2 border-b pb-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onCompactSchedule}
                disabled={isProcessingCommand || !hasUnlockedFlexibleTasks}
                className={cn(
                  "h-10 w-10 text-primary hover:bg-primary/10 transition-all duration-200",
                  (!hasUnlockedFlexibleTasks || isProcessingCommand) && "opacity-50 cursor-not-allowed"
                )}
                style={(!hasUnlockedFlexibleTasks || isProcessingCommand) ? { pointerEvents: 'auto' } : undefined}
              >
                {isProcessingCommand ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronsUp className="h-5 w-5" />}
                <span className="sr-only">Compact Schedule</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Compact Schedule (Fill gaps with flexible tasks)</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onRandomizeBreaks}
                disabled={isProcessingCommand || !hasUnlockedBreaks}
                className={cn(
                  "h-10 w-10 text-logo-orange hover:bg-logo-orange/10 transition-all duration-200",
                  (!hasUnlockedBreaks || isProcessingCommand) && "opacity-50 cursor-not-allowed"
                )}
                style={(!hasUnlockedBreaks || isProcessingCommand) ? { pointerEvents: 'auto' } : undefined}
              >
                {isProcessingCommand ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shuffle className="h-5 w-5" />}
                <span className="sr-only">Randomize Breaks</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Randomize Unlocked Breaks</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onZoneFocus}
                disabled={isProcessingCommand || retiredTasksCount === 0}
                className={cn(
                  "h-10 w-10 text-accent hover:bg-accent/10 transition-all duration-200",
                  (retiredTasksCount === 0 || isProcessingCommand) && "opacity-50 cursor-not-allowed"
                )}
                style={(retiredTasksCount === 0 || isProcessingCommand) ? { pointerEvents: 'auto' } : undefined}
              >
                {isProcessingCommand ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-5 w-5" />}
                <span className="sr-only">Zone Focus</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Zone Focus (Auto-schedule filtered tasks from Sink)</p>
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onRechargeEnergy}
                disabled={isProcessingCommand}
                className="h-10 w-10 text-logo-green hover:bg-logo-green/10 transition-all duration-200"
              >
                <Zap className="h-5 w-5" />
                <span className="sr-only">Recharge Energy</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Recharge Energy (+25⚡)</p>
            </TooltipContent>
          </Tooltip>

          {/* NEW: Quick Break Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onQuickBreak}
                disabled={isProcessingCommand}
                className="h-10 w-10 text-logo-orange hover:bg-logo-orange/10 transition-all duration-200"
              >
                {isProcessingCommand ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coffee className="h-5 w-5" />}
                <span className="sr-only">Quick Break (15 min)</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Quick Break (15 min, Fixed & Locked)</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Row 2: Quick Schedule Blocks */}
        <div className="flex flex-wrap items-center gap-3 border-b pb-3">
          <span className="text-sm font-semibold text-muted-foreground shrink-0">Quick Block:</span>
          {DURATION_BUCKETS.map(duration => (
            <QuickScheduleBlock
              key={duration}
              duration={duration}
              onScheduleBlock={onQuickScheduleBlock}
              isProcessingCommand={isProcessingCommand}
            />
          ))}
        </div>

        {/* Row 3: Sort, Settings, Dump, Refresh */}
        <div className="flex flex-wrap items-center gap-3">
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    disabled={isProcessingCommand}
                    className={cn(
                      "h-10 w-10 text-muted-foreground hover:bg-muted/10 transition-all duration-200",
                      isProcessingCommand && "opacity-50 cursor-not-allowed"
                    )}
                    style={isProcessingCommand ? { pointerEvents: 'auto' } : undefined}
                  >
                    <ArrowDownWideNarrow className="h-5 w-5" />
                    <span className="sr-only">Sort Flexible Tasks</span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>Sort Flexible Tasks (Re-balances schedule)</p>
              </TooltipContent>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Sort Flexible Tasks By</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {sortOptions.map(option => (
                  <DropdownMenuItem 
                    key={option.value} 
                    onClick={() => onSortFlexibleTasks(option.value)}
                    className={cn(sortBy === option.value && 'bg-accent text-accent-foreground')}
                  >
                    <option.icon className="mr-2 h-4 w-4" /> {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </Tooltip>
          </DropdownMenu>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onOpenWorkdayWindowDialog}
                disabled={isProcessingCommand}
                className="h-10 w-10 text-muted-foreground hover:bg-muted/10 transition-all duration-200"
              >
                <Clock className="h-5 w-5" />
                <span className="sr-only">Workday Window</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Adjust Workday Window</p>
            </TooltipContent>
          </Tooltip>
          
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={isProcessingCommand}
                    className={cn(
                      "h-10 w-10 text-destructive hover:bg-destructive/10 transition-all duration-200",
                      isProcessingCommand && "opacity-50 cursor-not-allowed"
                    )}
                    style={isProcessingCommand ? { pointerEvents: 'auto' } : undefined}
                  >
                    <Trash2 className="h-5 w-5" />
                    <span className="sr-only">Aether Dump</span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>Aether Dump Options</p>
              </TooltipContent>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Aether Dump</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onAetherDump} disabled={isProcessingCommand}>
                  <RefreshCcw className="mr-2 h-4 w-4" /> Aether Dump (Current Day)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onAetherDumpMega} disabled={isProcessingCommand}>
                  <Globe className="mr-2 h-4 w-4" /> Aether Dump Mega (All Days)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </Tooltip>
          </DropdownMenu>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onRefreshSchedule}
                disabled={isProcessingCommand}
                className="h-10 w-10 text-muted-foreground hover:bg-muted/10 transition-all duration-200"
              >
                <Database className="h-5 w-5" />
                <span className="sr-only">Refresh Data</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Refresh Schedule Data</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </Card>
  );
};

export default SchedulerUtilityBar;
export type { SchedulerUtilityBarProps };