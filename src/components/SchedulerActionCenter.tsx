"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel, 
} from '@/components/ui/dropdown-menu';
import { 
  Zap, Shuffle, ChevronsUp, RefreshCcw, Globe, Loader2, 
  ArrowDownWideNarrow, ArrowUpWideNarrow, Clock, Star, 
  Database, ListTodo, BatteryCharging, Target, Cpu, Coffee, 
  Archive, Repeat, Layers, CalendarDays, ChevronUp, ChevronDown,
  CalendarCheck, HeartPulse, Trash
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import QuickScheduleBlock from './QuickScheduleBlock';
import { DBScheduledTask, SortBy } from '@/types/scheduler';
import { useSession } from '@/hooks/use-session';

interface SchedulerActionCenterProps {
  isProcessingCommand: boolean;
  hasFlexibleTasksOnCurrentDay: boolean;
  dbScheduledTasks: DBScheduledTask[];
  retiredTasksCount: number;
  sortBy: SortBy;
  onRebalanceToday: () => Promise<void>;
  onReshuffleEverything: () => Promise<void>;
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
  navigate: (path: string) => void;
  onGlobalAutoSchedule: () => Promise<void>;
  onClearToday: () => Promise<void>;
}

const DURATION_BUCKETS = [30, 60, 90];

const SchedulerActionCenter: React.FC<SchedulerActionCenterProps> = ({
  isProcessingCommand,
  dbScheduledTasks,
  retiredTasksCount,
  onRebalanceToday,
  onReshuffleEverything,
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
  navigate,
  onGlobalAutoSchedule,
  onClearToday,
}) => {
  const { profile, updateProfile } = useSession();
  const isCollapsed = profile?.is_action_center_collapsed ?? false;

  const handleToggleCollapse = async () => {
    if (profile) {
      await updateProfile({ is_action_center_collapsed: !isCollapsed });
    }
  };

  const hasUnlockedBreaks = dbScheduledTasks.some(task => task.name.toLowerCase() === 'break' && !task.is_locked);
  const hasUnlockedFlexibleTasks = dbScheduledTasks.some(task => task.is_flexible && !task.is_locked);

  const sortOptions: { value: SortBy, label: string, icon: React.ElementType, description: string }[] = [
    { value: 'ENVIRONMENT_RATIO', label: 'Environment Ratio', icon: Repeat, description: "Interleave environments 1:1" },
    { value: 'PRIORITY_HIGH_TO_LOW', label: 'Criticality', icon: Star, description: "Highest priority first" },
    { value: 'TIME_EARLIEST_TO_LATEST', label: 'Chronological', icon: Clock, description: "By scheduled time" },
    { value: 'EMOJI', label: 'Vibe (Emoji)', icon: ListTodo, description: "Grouped by type" },
    { value: 'NAME_ASC', label: 'Alphabetical', icon: ArrowUpWideNarrow, description: "A to Z" },
  ];

  const ActionButton = ({ icon: Icon, label, onClick, disabled, colorClass, tooltip }: any) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          onClick={onClick}
          disabled={disabled || isProcessingCommand}
          className={cn(
            "h-12 w-full flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wide rounded-full transition-all shadow-sm hover:shadow-md",
            colorClass,
            (disabled || isProcessingCommand) && "opacity-40 cursor-not-allowed grayscale"
          )}
          aria-label={label}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span>{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent className="glass-card font-bold border-white/10">{tooltip}</TooltipContent>
    </Tooltip>
  );

  return (
    <Card className="w-full p-4 rounded-xl shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-0">
        <CardTitle className="text-xl font-bold text-foreground flex items-center gap-2">
          <Cpu className="h-6 w-6 text-primary" /> Action Center
        </CardTitle>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleToggleCollapse} 
                className="h-8 w-8 text-muted-foreground hover:bg-secondary/50"
              >
                {isCollapsed ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isCollapsed ? "Expand Actions" : "Collapse Actions"}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>

      <CardContent className="p-3 space-y-4">
        {isCollapsed ? (
          <div className="space-y-3">
            <Button
              onClick={onRebalanceToday}
              disabled={isProcessingCommand || retiredTasksCount === 0}
              variant="aether"
              className="w-full h-12 text-xs font-bold uppercase tracking-wide gap-2 rounded-full shadow-md"
            >
              {isProcessingCommand ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cpu className="h-4 w-4" />}
              Smart Fill
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-primary/50 ml-1 block">Engine</span>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={onRebalanceToday}
                  disabled={isProcessingCommand || retiredTasksCount === 0}
                  variant="aether"
                  className="w-full h-12 text-xs font-bold uppercase tracking-wide gap-2 rounded-full shadow-md"
                >
                  {isProcessingCommand ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cpu className="h-4 w-4" />}
                  Smart Fill
                </Button>
                <Button
                  onClick={onReshuffleEverything}
                  disabled={isProcessingCommand}
                  variant="outline"
                  className="w-full h-12 text-xs font-bold uppercase tracking-wide gap-2 rounded-full text-logo-yellow border-logo-yellow/20 hover:bg-logo-yellow/10 shadow-sm"
                >
                  {isProcessingCommand ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
                  Reshuffle
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {DURATION_BUCKETS.map(duration => (
                  <QuickScheduleBlock
                    key={duration}
                    duration={duration}
                    onScheduleBlock={onQuickScheduleBlock}
                    isProcessingCommand={isProcessingCommand}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/50 ml-1 block">Quick Actions</span>
              <div className="grid grid-cols-2 gap-2">
                <ActionButton icon={ChevronsUp} label="Compact" colorClass="text-primary" tooltip="Snap tasks to eliminate gaps" onClick={onCompactSchedule} disabled={!hasUnlockedFlexibleTasks} />
                <ActionButton icon={Shuffle} label="Shuffle" colorClass="text-logo-orange" tooltip="Randomize breaks" onClick={onRandomizeBreaks} disabled={!hasUnlockedBreaks} />
                <ActionButton icon={Target} label="Focus" colorClass="text-accent" tooltip="Pull from Sink" onClick={onZoneFocus} disabled={retiredTasksCount === 0} />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" disabled={isProcessingCommand} className="h-12 w-full text-xs font-bold uppercase tracking-wide gap-2 rounded-full shadow-sm">
                      <ArrowDownWideNarrow className="h-4 w-4" />
                      Sort
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="glass-card min-w-56 border-white/10 bg-background/95 backdrop-blur-xl">
                    <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest opacity-50 px-3 py-2">Sort Parameters</DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-white/5" />
                    {sortOptions.map(opt => (
                      <DropdownMenuItem key={opt.value} onClick={() => onSortFlexibleTasks(opt.value)} className="gap-3 flex items-center font-bold text-[10px] uppercase py-2.5 px-3 focus:bg-primary/20">
                        <opt.icon className="h-4 w-4 text-primary/70" /> {opt.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <ActionButton icon={Clock} label="Window" colorClass="text-muted-foreground" tooltip="Adjust workday" onClick={onOpenWorkdayWindowDialog} />
              </div>
            </div>

            <div className="space-y-3">
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/50 ml-1 block">Utilities</span>
              <div className="grid grid-cols-2 gap-2">
                <ActionButton icon={Zap} label="Recharge" colorClass="text-logo-green" tooltip="+25 Energy" onClick={onRechargeEnergy} />
                <ActionButton icon={Coffee} label="Break" colorClass="text-logo-orange" tooltip="15m Rest" onClick={onQuickBreak} />
                <ActionButton icon={BatteryCharging} label="Regen Pod" colorClass="text-primary" tooltip="Deep Recovery" onClick={onStartRegenPod} />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" disabled={isProcessingCommand} className="h-12 w-full text-xs font-bold uppercase tracking-wide gap-2 rounded-full text-logo-orange border-logo-orange/20 hover:bg-logo-orange/10 shadow-sm">
                      <Archive className="h-4 w-4" />
                      Flush
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="glass-card border-white/10 bg-background/95 backdrop-blur-xl min-w-[240px]">
                    <DropdownMenuItem onClick={onAetherDump} className="gap-3 font-bold text-[10px] uppercase py-3 px-3 focus:bg-logo-orange/10 cursor-pointer text-logo-orange">
                      <RefreshCcw className="h-4 w-4" /> Dump to Sink
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onClearToday} className="gap-3 font-bold text-[10px] uppercase py-3 px-3 focus:bg-destructive/10 cursor-pointer text-destructive">
                      <Trash className="h-4 w-4" /> Wipe Today
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/5" />
                    <DropdownMenuItem onClick={onAetherDumpMega} className="gap-3 font-bold text-[10px] uppercase py-3 px-3 focus:bg-destructive/10 cursor-pointer text-destructive">
                      <Globe className="h-4 w-4" /> Global Flush
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <ActionButton icon={Database} label="Sync" colorClass="text-muted-foreground" tooltip="Refresh Data" onClick={onRefreshSchedule} />
                <ActionButton icon={CalendarCheck} label="Global Auto" colorClass="text-primary" tooltip="Auto-schedule all flexible tasks" onClick={onGlobalAutoSchedule} disabled={isProcessingCommand} />
              </div>
            </div>

            <div className="pt-2 border-t border-white/5">
              <Button 
                variant="ghost" 
                className="w-full h-12 text-xs font-bold uppercase tracking-wide gap-2 rounded-full hover:bg-primary/5 shadow-sm"
                onClick={() => navigate('/simplified-schedule')}
              >
                <CalendarDays className="h-4 w-4 text-primary" />
                Weekly Vibe View
              </Button>
              <Button 
                variant="ghost" 
                className="w-full h-12 text-xs font-bold uppercase tracking-wide gap-2 rounded-full hover:bg-primary/5 shadow-sm mt-2"
                onClick={() => navigate('/wellness')}
              >
                <HeartPulse className="h-4 w-4 text-primary" />
                Wellness & Balance
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default SchedulerActionCenter;