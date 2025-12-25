"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { format, parseISO, isSameDay } from 'date-fns';
import { ListTodo, Sparkles, Loader2, Settings2 } from 'lucide-react';

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';

// Custom Components
import SchedulerInput from '@/components/SchedulerInput';
import SchedulerDisplay from '@/components/SchedulerDisplay';
import SchedulerDashboardPanel from '@/components/SchedulerDashboardPanel';
import NowFocusCard from '@/components/NowFocusCard';
import CalendarStrip from '@/components/CalendarStrip';
import AetherSink from '@/components/AetherSink';
import DailyVibeRecapCard from '@/components/DailyVibeRecapCard';
import SchedulerContextBar from '@/components/SchedulerContextBar';
import SchedulerActionCenter from '@/components/SchedulerActionCenter';
import SchedulerSegmentedControl from '@/components/SchedulerSegmentedControl';
import ImmersiveFocusMode from '@/components/ImmersiveFocusMode';

// Hooks & Utils
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import { useSession } from '@/hooks/use-session';
import { useIsMobile } from '@/hooks/use-mobile';
import { DBScheduledTask } from '@/types/scheduler';

interface SchedulerPageProps {
  view: 'schedule' | 'sink' | 'recap';
}

const SchedulerPage: React.FC<SchedulerPageProps> = ({ view }) => {
  const { 
    user, profile, rechargeEnergy, T_current, 
    activeItemToday, nextItemToday, startRegenPodState 
  } = useSession();
  
  const isMobile = useIsMobile();
  const scheduleContainerRef = useRef<HTMLDivElement>(null);
  
  // State
  const [selectedDay, setSelectedDay] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFocusModeActive, setIsFocusModeActive] = useState(false);
  const [showWorkdayDialog, setShowWorkdayDialog] = useState(false);

  // Scheduler Hook
  const { 
    dbScheduledTasks, isLoading: isTasksLoading, retiredTasks,
    datesWithTasks, isLoadingDatesWithTasks, isLoadingRetiredTasks,
    sortBy, setSortBy, retiredSortBy, setRetiredSortBy,
    aetherDump, aetherDumpMega, compactScheduledTasks,
    randomizeBreaks, rezoneTask, removeRetiredTask
  } = useSchedulerTasks(selectedDay, scheduleContainerRef);

  const hasFlexibleTasks = useMemo(() => 
    dbScheduledTasks.some(t => t.is_flexible && !t.is_locked), 
  [dbScheduledTasks]);

  const handleCommand = async (input: string) => {
    // This function should be implemented in your scheduler-utils logic
    console.log("Command received:", input);
  };

  const handleAddTaskClick = () => {
    // Logic to open detailed add modal
  };

  const renderScheduleCore = () => (
    <div className="space-y-6">
      {/* 1. Dashboard Info (Desktop) */}
      <div className="hidden lg:block">
        <SchedulerContextBar T_current={T_current} />
      </div>

      {/* 2. Command Input */}
      <Card className="p-4 shadow-md animate-hover-lift bg-card/50 backdrop-blur-sm border-primary/10">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <ListTodo className="h-6 w-6 text-primary" /> Quick Add
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <SchedulerInput 
            onCommand={async (val) => { 
              setIsProcessing(true); 
              await handleCommand(val); 
              setIsProcessing(false); 
              setInputValue(''); 
            }} 
            isLoading={isProcessing} 
            inputValue={inputValue}
            setInputValue={setInputValue}
            placeholder="Add task (e.g., 'Gym 60')"
            onDetailedInject={handleAddTaskClick}
          />
        </CardContent>
      </Card>

      {/* 3. Action Center (Desktop) */}
      <div className="hidden lg:block animate-slide-in-up">
        <SchedulerActionCenter 
          isProcessingCommand={isProcessing}
          dbScheduledTasks={dbScheduledTasks}
          retiredTasksCount={retiredTasks.length}
          sortBy={sortBy}
          onAutoSchedule={async () => {}}
          onCompactSchedule={async () => {}}
          onRandomizeBreaks={async () => {}}
          onZoneFocus={async () => {}}
          onRechargeEnergy={async () => rechargeEnergy()}
          onQuickBreak={async () => {}}
          onQuickScheduleBlock={async () => {}}
          onSortFlexibleTasks={async (s) => setSortBy(s)}
          onAetherDump={async () => aetherDump()}
          onAetherDumpMega={async () => aetherDumpMega()}
          onRefreshSchedule={() => {}}
          onOpenWorkdayWindowDialog={() => setShowWorkdayDialog(true)}
          onStartRegenPod={() => {}}
          hasFlexibleTasksOnCurrentDay={hasFlexibleTasks}
        />
      </div>

      {/* 4. Timeline Display */}
      <Card className="animate-pop-in border-white/10 shadow-xl overflow-hidden">
        <CardHeader className="bg-secondary/10">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-logo-yellow" /> 
            Timeline for {format(parseISO(selectedDay), 'EEEE, MMM d')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 bg-background/20">
          {isTasksLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>
          ) : (
            <SchedulerDisplay 
              schedule={null} // Replace with your calculated schedule logic
              T_current={T_current} 
              onRemoveTask={() => {}}
              onRetireTask={() => {}}
              onCompleteTask={() => {}}
              activeItemId={activeItemToday?.id || null} 
              selectedDayString={selectedDay} 
              onAddTaskClick={handleAddTaskClick}
              onScrollToItem={() => {}}
              isProcessingCommand={isProcessing}
              onFreeTimeClick={() => {}}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-24 px-4 sm:px-6">
      <SchedulerDashboardPanel 
        scheduleSummary={null} 
        onAetherDump={aetherDump}
        isProcessingCommand={isProcessing}
        hasFlexibleTasks={hasFlexibleTasks}
        onRefreshSchedule={() => {}}
      />

      <Card className="p-4 space-y-4 shadow-xl glass-card">
        <CalendarStrip 
          selectedDay={selectedDay} 
          setSelectedDay={setSelectedDay} 
          datesWithTasks={datesWithTasks} 
          isLoadingDatesWithTasks={isLoadingDatesWithTasks}
        />
        <SchedulerSegmentedControl currentView={view} />
      </Card>

      <div className="animate-slide-in-up">
        {view === 'schedule' && renderScheduleCore()}
        {view === 'sink' && (
          <AetherSink 
            retiredTasks={retiredTasks} onRezoneTask={rezoneTask} 
            onRemoveRetiredTask={removeRetiredTask} isLoading={isLoadingRetiredTasks} 
            isProcessingCommand={isProcessing} profileEnergy={profile?.energy || 0}
            retiredSortBy={retiredSortBy} setRetiredSortBy={setRetiredSortBy}
            onAutoScheduleSink={() => {}}
          />
        )}
        {view === 'recap' && (
          <DailyVibeRecapCard 
            tasksCompletedToday={0} xpEarnedToday={0} 
            selectedDayString={selectedDay} completedScheduledTasks={[]}
            totalActiveTimeMinutes={0} totalBreakTimeMinutes={0}
            scheduleSummary={null} profileEnergy={profile?.energy || 0}
            criticalTasksCompletedToday={0}
          />
        )}
      </div>

      {/* Floating Mobile Controls */}
      {isMobile && view === 'schedule' && (
        <Drawer>
          <DrawerTrigger asChild>
            <Button size="icon" className="fixed bottom-24 right-4 h-14 w-14 rounded-full shadow-2xl bg-primary animate-bounce-subtle">
              <Settings2 className="h-6 w-6" />
            </Button>
          </DrawerTrigger>
          <DrawerContent className="bg-background/95 backdrop-blur-xl">
            <div className="p-6 space-y-6">
              <SchedulerContextBar T_current={T_current} />
              <SchedulerActionCenter 
                isProcessingCommand={isProcessing} dbScheduledTasks={dbScheduledTasks}
                retiredTasksCount={retiredTasks.length} sortBy={sortBy}
                onAutoSchedule={async () => {}} onCompactSchedule={async () => {}}
                onRandomizeBreaks={async () => {}} onZoneFocus={async () => {}}
                onRechargeEnergy={async () => rechargeEnergy()} onQuickBreak={async () => {}}
                onQuickScheduleBlock={async () => {}} onSortFlexibleTasks={async (s) => setSortBy(s)}
                onAetherDump={async () => aetherDump()} onAetherDumpMega={async () => aetherDumpMega()}
                onRefreshSchedule={() => {}} onOpenWorkdayWindowDialog={() => setShowWorkdayDialog(true)}
                onStartRegenPod={() => {}} hasFlexibleTasksOnCurrentDay={hasFlexibleTasks}
              />
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );
};

export default SchedulerPage;