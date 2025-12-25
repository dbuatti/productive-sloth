"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel 
} from '@/components/ui/dropdown-menu';
import { 
  Zap, Shuffle, ChevronsUp, RefreshCcw, Globe, Loader2, 
  ArrowDownWideNarrow, ArrowUpWideNarrow, Clock, Star, 
  Database, Trash2, ListTodo, 
  BatteryCharging, Target, Cpu, Coffee
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import QuickScheduleBlock from './QuickScheduleBlock';
import { DBScheduledTask, SortBy } from '@/types/scheduler';

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
    { value: 'TIME_EARLIEST_TO_LATEST', label: 'Chronological', icon: Clock },
    { value: 'PRIORITY_HIGH_TO_LOW', label: 'Criticality', icon: Star },
    { value: 'EMOJI', label: 'Vibe (Emoji)', icon: ListTodo },
    { value: 'NAME_ASC', label: 'Alphabetical', icon: ArrowUpWideNarrow },
  ];

  const ActionButton = ({ icon: Icon, label, onClick, disabled, colorClass, tooltip }: any) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="glass"
          onClick={onClick}
          disabled={disabled || isProcessingCommand}
          className={cn(
            "h-10 w-full flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all duration-300",
            colorClass,
            (disabled || isProcessingCommand) && "opacity-30 cursor-not-allowed grayscale"
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="hidden md:inline">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent className="glass-card font-bold border-white/10">{tooltip}</TooltipContent>
    </Tooltip>
  );

  return (
    <Card glass className="animate-pop-in border-white/10 shadow-2xl overflow-hidden">
      <CardContent className="p-4 space-y-6">
        
        {/* 1. PRIMARY COMMAND ROW */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4 pb-4 border-b border-white/5">
          <div className="flex flex-col gap-1 w-full lg:w-auto">
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-primary/50 ml-1">Core Engine</span>
            <Button
              onClick={onAutoSchedule}
              disabled={isProcessingCommand}
              variant="aether"
              className="w-full lg:w-auto h-12 px-8 text-xs font-black uppercase tracking-[0.2em] gap-3 active:scale-95 shadow-lg shadow-primary/20"
            >
              {isProcessingCommand ? <Loader2 className="h-5 w-5 animate-spin" /> : <Cpu className="h-5 w-5" />}
              Sync Timeline
            </Button>
          </div>

          <div className="flex flex-col gap-1 w-full lg:w-auto">
             <span className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/50 ml-1">Mass Injection</span>
            <div className="flex items-center gap-3 bg-background/40 p-1.5 rounded-xl border border-white/5 h-12">
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
        </div>

        {/* 2. OPERATIONAL GRID */}
        <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                <ActionButton 
                  icon={ChevronsUp} label="Compact" colorClass="text-primary" tooltip="Compact: Snap flexible tasks to eliminate gaps"
                  onClick={onCompactSchedule} disabled={!hasUnlockedFlexibleTasks}
                />
                <ActionButton 
                  icon={Shuffle} label="Shuffle" colorClass="text-logo-orange" tooltip="Shuffle: Randomize rest periods for better flow"
                  onClick={onRandomizeBreaks} disabled={!hasUnlockedBreaks}
                />
                <ActionButton 
                  icon={Target} label="Focus" colorClass="text-accent" tooltip="Focus: Pull prioritized tasks from Aether Sink"
                  onClick={onZoneFocus} disabled={retiredTasksCount === 0}
                />
                
                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button variant="glass" disabled={isProcessingCommand} className="h-10 w-full text-[10px] font-black uppercase tracking-widest gap-2 hover:bg-white/5">
                          <ArrowDownWideNarrow className="h-4 w-4 text-muted-foreground" />
                          <span className="hidden md:inline">Balance</span>
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent className="glass-card">Balance: Re-sort flexible objectives</TooltipContent>
                    <DropdownMenuContent align="end" className="glass-card min-w-48 border-white/10 bg-background/95 backdrop-blur-xl">
                      <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest opacity-50 px-3 py-2">Sort Parameters</DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-white/5" />
                      {sortOptions.map(opt => (
                        <DropdownMenuItem key={opt.value} onClick={() => onSortFlexibleTasks(opt.value)} className="gap-3 font-bold text-[10px] uppercase py-2.5 px-3 focus:bg-primary/20">
                          <opt.icon className="h-4 w-4 text-primary/70" /> {opt.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </Tooltip>
                </DropdownMenu>

                <ActionButton 
                  icon={Clock} label="Window" colorClass="text-muted-foreground" tooltip="Window: Adjust operating window"
                  onClick={onOpenWorkdayWindowDialog}
                />
            </div>

            {/* 3. BIO-SYSTEMS & PURGE GRID */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                <ActionButton 
                  icon={Zap} label="Recharge" colorClass="text-logo-green" tooltip="Pulse: Immediate +25 Bio-Energy"
                  onClick={onRechargeEnergy}
                />
                <ActionButton 
                  icon={Coffee} label="Quick Rest" colorClass="text-logo-orange" tooltip="Buffer: Inject 15m Flow Break"
                  onClick={onQuickBreak}
                />
                <ActionButton 
                  icon={BatteryCharging} label="Regen Pod" colorClass="text-primary" tooltip="Deep Recovery: High-rate energy regen"
                  onClick={onStartRegenPod}
                />

                {/* THE PURGE DROPDOWN - Fixed Icon Spacing */}
                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button variant="glass" disabled={isProcessingCommand} className="h-10 w-full text-[10px] font-black uppercase tracking-widest text-destructive hover:bg-destructive/10 gap-2 border-destructive/20">
                          <Trash2 className="h-4 w-4" />
                          <span className="hidden md:inline">Purge</span>
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent className="glass-card border-destructive/20">System Purge: Delete data</TooltipContent>
                    <DropdownMenuContent align="end" className="glass-card border-destructive/20 bg-background/95 backdrop-blur-xl min-w-56">
                      <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-destructive/50 px-3 py-2">Destructive Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-destructive/10" />
                      
                      {/* Fixed spacing: Feather (Clear Today) */}
                      <DropdownMenuItem onClick={onAetherDump} className="text-destructive font-black text-[10px] uppercase gap-4 py-3 px-4 focus:bg-destructive/10 cursor-pointer">
                        <RefreshCcw className="h-4 w-4 shrink-0" /> 
                        <span className="tracking-tighter">Clear Current Timeline</span>
                      </DropdownMenuItem>

                      {/* Fixed spacing: Anchor (Wipe All) */}
                      <DropdownMenuItem onClick={onAetherDumpMega} className="text-destructive font-black text-[10px] uppercase gap-4 py-3 px-4 focus:bg-destructive/20 cursor-pointer">
                        <Globe className="h-4 w-4 shrink-0" /> 
                        <span className="tracking-tighter">Global Database Wipe</span>
                      </DropdownMenuItem>

                    </DropdownMenuContent>
                  </Tooltip>
                </DropdownMenu>

                <ActionButton 
                  icon={Database} label="Sync" colorClass="text-muted-foreground" tooltip="Data Sync: Refresh local items"
                  onClick={onRefreshSchedule}
                />
            </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SchedulerActionCenter;