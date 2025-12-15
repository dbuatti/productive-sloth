import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { Zap, Shuffle, ChevronsUp, RefreshCcw, Globe, Settings2, Loader2, ArrowDownWideNarrow, ArrowUpWideNarrow, Clock, Star, Database, Trash2, CalendarCheck, Coffee, ListTodo, BatteryCharging, Feather, Anchor } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import QuickScheduleBlock from './QuickScheduleBlock';
import { DBScheduledTask, SortBy } from '@/types/scheduler';
import { REGEN_POD_MAX_DURATION_MINUTES } from '@/lib/constants';

interface SchedulerActionCenterProps {
  isProcessingCommand: boolean;
  hasFlexibleTasksOnCurrentDay: boolean;
  dbScheduledTasks: DBScheduledTask[];
  retiredTasksCount: number;
  sortBy: SortBy;
  
  onAutoSchedule: () => Promise<void>;
  onCompactSchedule: () => Promise<void>;
  onRandomizeBreaks: () => Promise<void>;
  onZoneFocus: () => Promise<void>;
  onRechargeEnergy: () => Promise<void>;
  onQuickBreak: () => Promise<void>;
  onQuickScheduleBlock: (duration: number, sortPreference: 'longestFirst' | 'shortestFirst') => Promise<void>;
  onSortFlexibleTasks: (sortBy: SortBy) => Promise<void>;
  onAetherDump: () => Promise<void>;
  onAetherDumpMega: () => Promise<void>;
  onRefreshSchedule: () => void;
  onOpenWorkdayWindowDialog: () => void;
  onStartRegenPod: () => void;
}

const DURATION_BUCKETS = [15, 30, 60];

const SchedulerActionCenter: React.FC<SchedulerActionCenterProps> = ({
  isProcessingCommand,
  dbScheduledTasks,
  retiredTasksCount,
  sortBy,
  onAutoSchedule,
  onCompactSchedule,
  onRandomizeBreaks,
  onZoneFocus,
  onRechargeEnergy,
  onQuickBreak,
  onQuickScheduleBlock,
  onSortFlexibleTasks,
  onAetherDump,
  onAetherDumpMega,
  onRefreshSchedule,
  onOpenWorkdayWindowDialog,
  onStartRegenPod,
}) => {
  const hasUnlockedBreaks = dbScheduledTasks.some(task => task.name.toLowerCase() === 'break' && !task.is_locked);
  const hasUnlockedFlexibleTasks = dbScheduledTasks.some(task => task.is_flexible && !task.is_locked);

  const sortOptions: { value: SortBy, label: string, icon: React.ElementType }[] = [
    { value: 'TIME_EARLIEST_TO_LATEST', label: 'Time (Earliest)', icon: ArrowUpWideNarrow },
    { value: 'TIME_LATEST_TO_EARLIEST', label: 'Time (Latest)', icon: ArrowDownWideNarrow },
    { value: 'PRIORITY_HIGH_TO_LOW', label: 'Priority (High)', icon: Star },
    { value: 'PRIORITY_LOW_TO_HIGH', label: 'Priority (Low)', icon: Star },
    { value: 'EMOJI', label: 'Emoji Hue', icon: ListTodo },
    { value: 'NAME_ASC', label: 'Name (A-Z)', icon: ArrowUpWideNarrow },
    { value: 'NAME_DESC', label: 'Name (Z-A)', icon: ArrowDownWideNarrow },
  ];

  const currentSortOption = sortOptions.find(opt => opt.value === sortBy) || { label: 'Sort', icon: ArrowDownWideNarrow };

  return (
    <Card className="p-4 animate-slide-in-up animate-hover-lift">
      <CardContent className="p-0 space-y-4">
        
        {/* 1. Primary Action: Auto Schedule Day (Elevated) */}
        <Button
          onClick={onAutoSchedule}
          disabled={isProcessingCommand}
          className={cn(
            "w-full h-14 text-xl font-bold flex items-center justify-center gap-3 transition-all duration-300 ease-in-out",
            "bg-logo-green text-primary-foreground hover:bg-logo-green/90 shadow-xl hover:shadow-2xl hover:shadow-logo-green/40",
            isProcessingCommand && "opacity-70 cursor-not-allowed"
          )}
          style={isProcessingCommand ? { pointerEvents: 'auto' } : undefined}
        >
          {isProcessingCommand ? (
            <Loader2 className="h-7 w-7 animate-spin" />
          ) : (
            <CalendarCheck className="h-7 w-7" />
          )}
          Auto Schedule Day
          <Star className="h-6 w-6 text-logo-yellow" />
        </Button>

        {/* 2. Quick Blocks & Core Management Actions (Consolidated into a single grid) */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 border-t pt-4 border-border/50">
          
          {/* Quick Block 15 min */}
          <QuickScheduleBlock
            duration={15}
            onScheduleBlock={onQuickScheduleBlock}
            isProcessingCommand={isProcessingCommand}
          />

          {/* Quick Block 30 min */}
          <QuickScheduleBlock
            duration={30}
            onScheduleBlock={onQuickScheduleBlock}
            isProcessingCommand={isProcessingCommand}
          />

          {/* Quick Block 60 min */}
          <QuickScheduleBlock
            duration={60}
            onScheduleBlock={onQuickScheduleBlock}
            isProcessingCommand={isProcessingCommand}
          />

          {/* Compact Schedule */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onCompactSchedule}
                disabled={isProcessingCommand || !hasUnlockedFlexibleTasks}
                className={cn(
                  "h-10 w-full text-primary hover:bg-primary/10 transition-all duration-200",
                  (!hasUnlockedFlexibleTasks || isProcessingCommand) && "opacity-50 cursor-not-allowed"
                )}
                style={(!hasUnlockedFlexibleTasks || isProcessingCommand) ? { pointerEvents: 'auto' } : undefined}
              >
                <ChevronsUp className="h-5 w-5" />
                <span className="sr-only">Compact Schedule</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Compact Schedule (Fill gaps)</p>
            </TooltipContent>
          </Tooltip>

          {/* Randomize Breaks */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onRandomizeBreaks}
                disabled={isProcessingCommand || !hasUnlockedBreaks}
                className={cn(
                  "h-10 w-full text-logo-orange hover:bg-logo-orange/10 transition-all duration-200",
                  (!hasUnlockedBreaks || isProcessingCommand) && "opacity-50 cursor-not-allowed"
                )}
                style={(!hasUnlockedBreaks || isProcessingCommand) ? { pointerEvents: 'auto' } : undefined}
              >
                <Shuffle className="h-5 w-5" />
                <span className="sr-only">Randomize Breaks</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Randomize Unlocked Breaks</p>
            </TooltipContent>
          </Tooltip>

          {/* Zone Focus */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onZoneFocus}
                disabled={isProcessingCommand || retiredTasksCount === 0}
                className={cn(
                  "h-10 w-full text-accent hover:bg-accent/10 transition-all duration-200",
                  (retiredTasksCount === 0 || isProcessingCommand) && "opacity-50 cursor-not-allowed"
                )}
                style={(retiredTasksCount === 0 || isProcessingCommand) ? { pointerEvents: 'auto' } : undefined}
              >
                <Star className="h-5 w-5" />
                <span className="sr-only">Zone Focus</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Zone Focus (Auto-schedule filtered tasks from Sink)</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* 3. Energy & Utility Actions (Grouped) */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 border-t pt-4 border-border/50">
          
          {/* Recharge Energy */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onRechargeEnergy}
                disabled={isProcessingCommand}
                className="h-10 w-full text-logo-green hover:bg-logo-green/10 transition-all duration-200"
              >
                <Zap className="h-5 w-5" />
                <span className="sr-only">Recharge Energy</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Recharge Energy (+25⚡)</p>
            </TooltipContent>
          </Tooltip>

          {/* Quick Break */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onQuickBreak}
                disabled={isProcessingCommand}
                className="h-10 w-full text-logo-orange hover:bg-logo-orange/10 transition-all duration-200"
              >
                <Coffee className="h-5 w-5" />
                <span className="sr-only">Quick Break (15 min)</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Quick Break (15 min, Fixed & Locked)</p>
            </TooltipContent>
          </Tooltip>

          {/* Start Energy Regen Pod */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                type="button" 
                onClick={onStartRegenPod} 
                disabled={isProcessingCommand} 
                variant="outline"
                size="icon"
                className="h-10 w-full text-primary hover:bg-primary/10 transition-all duration-200"
              >
                <BatteryCharging className="h-5 w-5" />
                <span className="sr-only">Start Energy Regen Pod</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Start Energy Regen Pod (Dynamic duration, max {REGEN_POD_MAX_DURATION_MINUTES} min)</p>
            </TooltipContent>
          </Tooltip>

          {/* Sort Flexible Tasks Dropdown */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    className={cn(
                      "h-10 w-full text-muted-foreground hover:bg-muted/10 transition-all duration-200 flex items-center justify-start gap-2",
                      isProcessingCommand && "opacity-50 cursor-not-allowed"
                    )}
                    disabled={isProcessingCommand}
                    style={isProcessingCommand ? { pointerEvents: 'auto' } : undefined}
                  >
                    <currentSortOption.icon className="h-5 w-5 shrink-0" />
                    <span className="truncate text-sm hidden sm:inline">{currentSortOption.label}</span>
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

          {/* Workday Window */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onOpenWorkdayWindowDialog}
                disabled={isProcessingCommand}
                className="h-10 w-full text-muted-foreground hover:bg-muted/10 transition-all duration-200"
              >
                <Clock className="h-5 w-5" />
                <span className="sr-only">Workday Window</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Adjust Workday Window</p>
            </TooltipContent>
          </Tooltip>
          
          {/* Aether Dump Dropdown */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={isProcessingCommand}
                    className={cn(
                      "h-10 w-full text-destructive hover:bg-destructive/10 transition-all duration-200",
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
        </div>
        
        {/* 4. Refresh Data (Standalone for clarity) */}
        <div className="grid grid-cols-1 border-t pt-4 border-border/50">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="h-10 w-full text-muted-foreground hover:bg-muted/10 transition-all duration-200 flex items-center gap-2"
                  onClick={onRefreshSchedule}
                  disabled={isProcessingCommand}
                >
                  <Database className="h-5 w-5" />
                  <span className="text-sm">Refresh Data</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Force refresh all schedule data from the database</p>
              </TooltipContent>
            </Tooltip>
        </div>
      </CardContent>
    </Card>
  );
};

export default SchedulerActionCenter;