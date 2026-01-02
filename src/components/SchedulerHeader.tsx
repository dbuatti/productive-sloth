import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { format, isToday, parseISO, addDays, subDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  CalendarDays, ChevronLeft, ChevronRight, Clock, Cpu, Database,
  Filter, Globe, Layers, ListTodo, Loader2, Plus, RefreshCcw,
  Shuffle, Sparkles, Star, Target, Trash2, Zap, Coffee, BatteryCharging,
  ArrowDownWideNarrow, ArrowUpWideNarrow, AlertTriangle, Settings,
  ChevronsUp, Repeat, Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSession } from '@/hooks/use-session';
import { useEnvironmentContext, environmentOptions } from '@/hooks/use-environment-context';
import { ScheduledItem, FormattedSchedule, DBScheduledTask, SortBy, TaskEnvironment } from '@/types/scheduler';
import { useWeather } from '@/hooks/use-weather';
import { formatDateTime } from '@/lib/scheduler-utils'; // Removed getWeatherIcon import
import SchedulerSegmentedControl from './SchedulerSegmentedControl';
import QuickScheduleBlock from './QuickScheduleBlock';
import CreateTaskDialog from './CreateTaskDialog';
import WorkdayWindowDialog from './WorkdayWindowDialog';
import EnergyRegenPodModal from './EnergyRegenPodModal';
import { REGEN_POD_MAX_DURATION_MINUTES } from '@/lib/constants';
import { Badge } from '@/components/ui/badge'; // Import Badge
import WeatherIcon from './WeatherIcon'; // NEW: Import WeatherIcon

interface SchedulerHeaderProps {
  view: 'schedule' | 'sink' | 'recap';
  selectedDay: string;
  setSelectedDay: (dateString: string) => void;
  datesWithTasks: string[];
  isLoadingDatesWithTasks: boolean;
  scheduleSummary: FormattedSchedule['summary'] | null;
  dbScheduledTasks: DBScheduledTask[];
  retiredTasksCount: number;
  isProcessingCommand: boolean;
  inputValue: string;
  setInputValue: (value: string) => void;
  onCommand: (input: string) => Promise<void>;
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
  onStartRegenPodSession: (activityName: string, activityDuration: number) => Promise<void>;
  onExitRegenPodSession: () => Promise<void>;
  regenPodDurationMinutes: number;
}

const DURATION_BUCKETS = [30, 60, 90];

const SchedulerHeader: React.FC<SchedulerHeaderProps> = ({
  view,
  selectedDay,
  setSelectedDay,
  datesWithTasks,
  isLoadingDatesWithTasks,
  scheduleSummary,
  dbScheduledTasks,
  retiredTasksCount,
  isProcessingCommand,
  inputValue,
  setInputValue,
  onCommand,
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
  onStartRegenPodSession,
  onExitRegenPodSession,
  regenPodDurationMinutes,
}) => {
  const { profile, T_current } = useSession();
  const { selectedEnvironments, toggleEnvironmentSelection, setSelectedEnvironments } = useEnvironmentContext();
  const { weather, isLoading: isWeatherLoading, error: weatherError } = useWeather({ city: "Melbourne, AU" });

  const [showWorkdayWindowDialog, setShowWorkdayWindowDialog] = useState(false);
  const [showDetailedTaskCreation, setShowDetailedTaskCreation] = useState(false);
  const [showRegenPodSetup, setShowRegenPodSetup] = useState(false);

  const isRegenPodRunning = profile?.is_in_regen_pod ?? false;
  useEffect(() => {
    if (isRegenPodRunning) {
      setShowRegenPodSetup(true);
    }
  }, [isRegenPodRunning]);

  const hasFlexibleTasksOnCurrentDay = dbScheduledTasks.some(t => t.is_flexible && !t.is_locked);
  const hasUnlockedBreaks = dbScheduledTasks.some(task => task.name.toLowerCase() === 'break' && !task.is_locked);
  const hasUnlockedFlexibleTasks = dbScheduledTasks.some(task => task.is_flexible && !task.is_locked);

  const sortOptions: { value: SortBy, label: string, icon: React.ElementType, description: string }[] = [
    { value: 'ENVIRONMENT_RATIO', label: 'Environment Ratio', icon: Repeat, description: "Interleave environments 1:1" },
    { value: 'PRIORITY_HIGH_TO_LOW', label: 'Criticality', icon: Star, description: "Highest priority first" },
    { value: 'TIME_EARLIEST_TO_LATEST', label: 'Chronological', icon: Clock, description: "By scheduled time" },
    { value: 'EMOJI', label: 'Vibe (Emoji)', icon: ListTodo, description: "Grouped by type" },
    { value: 'NAME_ASC', label: 'Alphabetical', icon: ArrowUpWideNarrow, description: "A to Z" },
  ];

  const handlePrevDay = () => {
    setSelectedDay(format(subDays(parseISO(selectedDay), 1), 'yyyy-MM-dd'));
  };

  const handleNextDay = () => {
    setSelectedDay(format(addDays(parseISO(selectedDay), 1), 'yyyy-MM-dd'));
  };

  const handleGoToToday = () => {
    setSelectedDay(format(new Date(), 'yyyy-MM-dd'));
  };

  const renderEnvironmentBadges = () => {
    if (selectedEnvironments.length === 0) {
      return (
        <div className="flex items-center gap-1 text-muted-foreground/50 italic font-medium text-xs uppercase tracking-widest">
          <Zap className="h-3 w-3" /> All Zones
        </div>
      );
    }

    if (selectedEnvironments.length > 2) {
      return (
        <div className="flex items-center gap-1">
          <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 font-black text-[10px] uppercase tracking-tighter">
            {selectedEnvironments.length} Zones Active
          </Badge>
        </div>
      );
    }

    return (
      <div className="flex flex-wrap gap-1">
        {environmentOptions.filter(opt => selectedEnvironments.includes(opt.value)).map(option => (
          <Badge
            key={option.value}
            variant="outline"
            className="bg-background/50 border-primary/20 text-primary font-bold text-[10px] uppercase tracking-tight flex items-center gap-1 py-0.5 px-1.5"
          >
            <option.icon className="h-2.5 w-2.5" />
            {option.label.split(' ')[0]}
          </Badge>
        ))}
      </div>
    );
  };

  return (
    <React.Fragment> {/* Wrapped in React.Fragment */}
      <div className="sticky top-0 z-30 w-full bg-background/95 backdrop-blur-lg border-b border-border/50 shadow-lg animate-slide-in-down">
        {/* NEW: Energy Regen Pod Modal */}
        {(showRegenPodSetup || isRegenPodRunning) && (
          <EnergyRegenPodModal
            isOpen={showRegenPodSetup || isRegenPodRunning}
            onExit={onExitRegenPodSession}
            onStart={onStartRegenPodSession}
            isProcessingCommand={isProcessingCommand}
            totalDurationMinutes={isRegenPodRunning ? regenPodDurationMinutes : REGEN_POD_MAX_DURATION_MINUTES}
          />
        )}

        {/* Top Bar: Date Navigation, Tabs, Quick Add */}
        <div className="flex flex-col gap-3 p-4">
          {/* Row 1: Date Navigation & Tabs */}
          <div className="flex items-center justify-between gap-2">
            {/* Date Navigation */}
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={handlePrevDay} className="h-8 w-8">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Previous Day</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={isToday(parseISO(selectedDay)) ? "aether" : "outline"}
                    size="sm"
                    onClick={handleGoToToday}
                    className="h-8 px-3 text-xs font-bold uppercase tracking-widest"
                  >
                    {isToday(parseISO(selectedDay)) ? <Zap className="h-3 w-3 mr-1" /> : <CalendarDays className="h-3 w-3 mr-1" />}
                    {isToday(parseISO(selectedDay)) ? "Today" : format(parseISO(selectedDay), 'MMM d')}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Jump to Today</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={handleNextDay} className="h-8 w-8">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Next Day</TooltipContent>
              </Tooltip>
            </div>

            {/* Segmented Control (Tabs) */}
            <div className="flex-grow max-w-md mx-auto">
              <SchedulerSegmentedControl currentView={view} />
            </div>

            {/* Quick Add Input */}
            <div className="flex items-center gap-2">
              <Input
                type="text"
                placeholder="Quick add: Task 30 [!] [-] [sink]..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (inputValue.trim()) {
                      onCommand(inputValue);
                    }
                  }
                }}
                disabled={isProcessingCommand}
                className="h-9 text-sm font-medium placeholder:opacity-40"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => onCommand(inputValue)}
                    disabled={isProcessingCommand || !inputValue.trim()}
                    variant="default"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                  >
                    {isProcessingCommand ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add Quick Task</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Row 2: Context Bar (Time, Weather, Environment Filter) & Dashboard Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Context Bar */}
            <div className="flex items-center gap-3 p-2 rounded-xl bg-background/40 border border-white/5 shadow-inner">
              <div className="flex items-center gap-2 shrink-0">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-xs font-black font-mono text-foreground">
                  {formatDateTime(T_current)}
                </span>
              </div>
              <div className="h-6 w-px bg-border/50" /> {/* Separator */}
              <div className="flex-grow min-w-0">
                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 w-full justify-start">
                          <Filter className={cn("h-3 w-3", selectedEnvironments.length > 0 ? "text-primary" : "text-muted-foreground/30")} />
                          {renderEnvironmentBadges()}
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Filter by Environment</TooltipContent>
                    <DropdownMenuContent align="start" className="w-[280px] p-0 glass-card border-white/10 shadow-2xl animate-pop-in" sideOffset={8}>
                      <DropdownMenuLabel className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
                        Environment Zones
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-white/5" />
                      {environmentOptions.map((option) => {
                        const isSelected = selectedEnvironments.includes(option.value);
                        return (
                          <DropdownMenuItem
                            key={option.value}
                            onSelect={() => toggleEnvironmentSelection(option.value)}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200",
                              "hover:bg-primary/10 data-[selected='true']:bg-primary/5",
                              isSelected && "text-primary font-bold"
                            )}
                          >
                            <div className={cn(
                              "flex items-center justify-center h-4 w-4 rounded border transition-all duration-300",
                              isSelected ? "bg-primary border-primary shadow-[0_0_8px_hsl(var(--primary))]" : "border-white/10 bg-white/5"
                            )}>
                              {isSelected && <Check className="h-2.5 w-2.5 text-background stroke-[4px]" />}
                            </div>
                            <option.icon className={cn("h-3.5 w-3.5 transition-colors", isSelected ? "text-primary" : "text-muted-foreground/50")} />
                            <span className="text-sm tracking-tight">{option.label}</span>
                          </DropdownMenuItem>
                        );
                      })}
                      <DropdownMenuSeparator className="bg-white/5" />
                      <DropdownMenuItem onSelect={() => setSelectedEnvironments([])} className="px-3 py-2.5 text-xs font-bold uppercase tracking-widest text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Clear All Filters
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </Tooltip>
                </DropdownMenu>
              </div>
              <div className="h-6 w-px bg-border/50 hidden sm:block" /> {/* Separator */}
              <div className="shrink-0 hidden sm:block">
                {isWeatherLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/50" />
                ) : weather ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 text-xs font-black font-mono text-muted-foreground/80">
                        <WeatherIcon iconCode={weather.icon} /> {/* Use WeatherIcon here */}
                        <span>{Math.round(weather.temperature)}°C</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{weather.description} in {weather.city}</p>
                    </TooltipContent>
                  </Tooltip>
                ) : null}
              </div>
            </div>

            {/* Dashboard Summary (Compact) */}
            {scheduleSummary && scheduleSummary.totalTasks > 0 && (
              <div className="flex-1 grid grid-cols-2 gap-3 text-center p-2 rounded-xl bg-background/40 border border-white/5 shadow-inner">
                <div className="flex flex-col items-center justify-center">
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Tasks</span>
                  <span className="text-lg font-black font-mono text-foreground">{scheduleSummary.totalTasks}</span>
                </div>
                <div className="flex flex-col items-center justify-center">
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Active Flow</span>
                  <span className="text-lg font-black font-mono text-primary">
                    {scheduleSummary.activeTime.hours}h {scheduleSummary.activeTime.minutes}m
                  </span>
                </div>
                {scheduleSummary.unscheduledCount > 0 && (
                  <div className="col-span-2 flex items-center justify-center gap-2 text-destructive text-xs font-bold uppercase tracking-widest bg-destructive/10 p-1.5 rounded-md">
                    <AlertTriangle className="h-3 w-3" /> {scheduleSummary.unscheduledCount} Unscheduled
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Row 3: Action Center (Primary & Secondary Actions) */}
          <div className="flex flex-col gap-3">
            {/* Primary Actions */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={onRebalanceToday}
                    disabled={isProcessingCommand || retiredTasksCount === 0}
                    variant="aether"
                    className="h-10 px-4 text-xs font-black uppercase tracking-widest gap-2 active:scale-95 shadow-lg shadow-primary/20"
                  >
                    {isProcessingCommand ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cpu className="h-4 w-4" />}
                    Smart Fill
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="glass-card font-bold border-white/10 max-w-xs">
                  Smart Fill Today: Pulls tasks from the sink into your current free time slots without moving existing items.
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={onReshuffleEverything}
                    disabled={isProcessingCommand}
                    variant="outline"
                    className="h-10 px-4 text-xs font-black uppercase tracking-widest gap-2 active:scale-95 text-logo-yellow border-logo-yellow/20 hover:bg-logo-yellow/10"
                  >
                    {isProcessingCommand ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
                    Global Reshuffle
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="glass-card font-bold border-white/10 max-w-xs">
                  Global Reshuffle: Combines all flexible items (from schedule and sink) and regenerates your entire timeline.
                </TooltipContent>
              </Tooltip>

              {DURATION_BUCKETS.map(duration => (
                <QuickScheduleBlock
                  key={duration}
                  duration={duration}
                  onScheduleBlock={onQuickScheduleBlock}
                  isProcessingCommand={isProcessingCommand}
                />
              ))}
            </div>

            {/* Secondary Actions (Dropdown) */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="glass" className="h-9 w-full text-xs font-black uppercase tracking-widest gap-2 hover:bg-white/5">
                      <Settings className="h-3.5 w-3.5" /> More Actions
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent className="glass-card">Access advanced scheduling tools</TooltipContent>
                <DropdownMenuContent align="end" className="glass-card min-w-56 border-white/10 bg-background/95 backdrop-blur-xl">
                  <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest opacity-50 px-3 py-2">Scheduling Tools</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/5" />

                  <DropdownMenuItem onClick={onCompactSchedule} disabled={!hasUnlockedFlexibleTasks || isProcessingCommand} className="gap-3 font-bold text-[10px] uppercase py-2.5 px-3 focus:bg-primary/20 cursor-pointer">
                    <ChevronsUp className="h-4 w-4 text-primary/70" /> Compact Schedule
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onRandomizeBreaks} disabled={!hasUnlockedBreaks || isProcessingCommand} className="gap-3 font-bold text-[10px] uppercase py-2.5 px-3 focus:bg-logo-orange/20 cursor-pointer">
                    <Shuffle className="h-4 w-4 text-logo-orange/70" /> Randomize Breaks
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onZoneFocus} disabled={retiredTasksCount === 0 || isProcessingCommand} className="gap-3 font-bold text-[10px] uppercase py-2.5 px-3 focus:bg-accent/20 cursor-pointer">
                    <Target className="h-4 w-4 text-accent/70" /> Zone Focus
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowWorkdayWindowDialog(true)} className="gap-3 font-bold text-[10px] uppercase py-2.5 px-3 focus:bg-muted/20 cursor-pointer">
                    <Clock className="h-4 w-4 text-muted-foreground/70" /> Workday Window
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onRefreshSchedule} className="gap-3 font-bold text-[10px] uppercase py-2.5 px-3 focus:bg-muted/20 cursor-pointer">
                    <Database className="h-4 w-4 text-muted-foreground/70" /> Refresh Data
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="bg-white/5" />
                  <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest opacity-50 px-3 py-2">Energy & Recovery</DropdownMenuLabel>
                  <DropdownMenuItem onClick={onRechargeEnergy} disabled={isProcessingCommand} className="gap-3 font-bold text-[10px] uppercase py-2.5 px-3 focus:bg-logo-green/20 cursor-pointer">
                    <Zap className="h-4 w-4 text-logo-green/70" /> Recharge Energy
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onQuickBreak} disabled={isProcessingCommand} className="gap-3 font-bold text-[10px] uppercase py-2.5 px-3 focus:bg-logo-orange/20 cursor-pointer">
                    <Coffee className="h-4 w-4 text-logo-orange/70" /> Quick Break (15 min)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowRegenPodSetup(true)} disabled={isProcessingCommand} className="gap-3 font-bold text-[10px] uppercase py-2.5 px-3 focus:bg-primary/20 cursor-pointer">
                    <BatteryCharging className="h-4 w-4 text-primary/70" /> Regen Pod
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="bg-white/5" />
                  <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest opacity-50 px-3 py-2">Mass Actions</DropdownMenuLabel>
                  <DropdownMenuItem onClick={onAetherDump} disabled={isProcessingCommand} className="gap-3 font-bold text-[10px] uppercase py-2.5 px-3 focus:bg-logo-orange/20 cursor-pointer">
                    <RefreshCcw className="h-4 w-4 text-logo-orange/70" /> Flush Today
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onAetherDumpMega} disabled={isProcessingCommand} className="gap-3 font-bold text-[10px] uppercase py-2.5 px-3 focus:bg-destructive/20 cursor-pointer">
                    <Globe className="h-4 w-4 text-destructive/70" /> Global Flush
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="bg-white/5" />
                  <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest opacity-50 px-3 py-2">Balance Logic</DropdownMenuLabel>
                  {sortOptions.map(opt => (
                    <DropdownMenuItem key={opt.value} onSelect={() => onSortFlexibleTasks(opt.value)} className={cn("gap-3 flex flex-col items-start font-bold text-[10px] uppercase py-3 px-3 focus:bg-primary/20 cursor-pointer", profile?.custom_environment_order?.includes(opt.value as TaskEnvironment) && "bg-primary/10 text-primary")}>
                      <div className="flex items-center gap-2">
                        <opt.icon className="h-4 w-4 text-primary/70" /> {opt.label}
                      </div>
                      <span className="text-[8px] opacity-50 lowercase tracking-normal font-medium italic pl-6">{opt.description}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </Tooltip>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <WorkdayWindowDialog open={showWorkdayWindowDialog} onOpenChange={setShowWorkdayWindowDialog} />
      <CreateTaskDialog
        defaultPriority="MEDIUM"
        defaultDueDate={parseISO(selectedDay)}
        onTaskCreated={() => {
          setShowDetailedTaskCreation(false);
          setInputValue('');
        }}
        open={showDetailedTaskCreation}
        onOpenChange={setShowDetailedTaskCreation}
      />
    </React.Fragment> // Closed React.Fragment
  );
};

export default SchedulerHeader;