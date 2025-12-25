"use client";

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { ListTodo, Sparkles, Loader2, Settings2 } from 'lucide-react';

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';

// Custom Dashboard Components
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

// Hooks & Types
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import { useSession } from '@/hooks/use-session';
import { useIsMobile } from '@/hooks/use-mobile';
import { DBScheduledTask } from '@/types/scheduler';

// FIX: Define the missing Props interface
export interface SchedulerPageProps {
  view: 'schedule' | 'sink' | 'recap';
}

const SchedulerPage: React.FC<SchedulerPageProps> = ({ view }) => {
  // FIX: Restore Hooks
  const { 
    user, profile, rechargeEnergy, T_current, 
    activeItemToday, nextItemToday 
  } = useSession();
  
  const isMobile = useIsMobile();
  const scheduleContainerRef = useRef<HTMLDivElement>(null);
  
  // State
  const [selectedDay, setSelectedDay] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // FIX: Restore Task logic from hook
  const { 
    dbScheduledTasks, isLoading: isTasksLoading, retiredTasks,
    datesWithTasks, isLoadingDatesWithTasks, isLoadingRetiredTasks,
    sortBy, setSortBy, retiredSortBy, setRetiredSortBy,
    aetherDump, aetherDumpMega, completeScheduledTask
  } = useSchedulerTasks(selectedDay, scheduleContainerRef);

  const handleCommand = async (input: string) => {
    console.log("Command processing:", input);
  };

  const renderScheduleCore = () => (
    <div className="space-y-6">
      {/* FIX: SchedulerContextBar only receives T_current */}
      <div className="hidden lg:block">
        <SchedulerContextBar T_current={T_current} />
      </div>

      {/* FIX: SchedulerInput receives the command logic props */}
      <Card className="p-4 shadow-md animate-hover-lift bg-card/50 border-primary/10">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <ListTodo className="h-6 w-6 text-primary" /> Command Input
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
            onDetailedInject={() => {}}
          />
        </CardContent>
      </Card>

      {/* FIX: Restore Action Center props */}
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
          onOpenWorkdayWindowDialog={() => {}}
          onStartRegenPod={() => {}}
          hasFlexibleTasksOnCurrentDay={dbScheduledTasks.some(t => t.is_flexible)}
        />
      </div>

      <Card className="animate-pop-in border-white/10 shadow-xl overflow-hidden">
        <CardContent className="p-4 bg-background/20">
          <SchedulerDisplay 
            schedule={null} 
            T_current={T_current} 
            onRemoveTask={() => {}}
            onRetireTask={() => {}}
            onCompleteTask={(task) => completeScheduledTask(task)}
            activeItemId={activeItemToday?.id || null} 
            selectedDayString={selectedDay} 
            onAddTaskClick={() => {}}
            onScrollToItem={() => {}}
            isProcessingCommand={isProcessing}
            onFreeTimeClick={() => {}}
          />
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-24 px-4">
      <SchedulerDashboardPanel 
        scheduleSummary={null} 
        onAetherDump={aetherDump}
        isProcessingCommand={isProcessing}
        hasFlexibleTasks={true}
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
            retiredTasks={retiredTasks} 
            onRezoneTask={async () => {}} 
            onRemoveRetiredTask={() => {}} 
            isLoading={isLoadingRetiredTasks} 
            isProcessingCommand={isProcessing} 
            profileEnergy={profile?.energy || 0}
            retiredSortBy={retiredSortBy} 
            setRetiredSortBy={setRetiredSortBy}
            onAutoScheduleSink={() => {}}
          />
        )}
      </div>

      {/* FIX: Mobile Controls Drawer */}
      {isMobile && view === 'schedule' && (
        <Drawer>
          <DrawerTrigger asChild>
            <Button size="icon" className="fixed bottom-24 right-4 h-14 w-14 rounded-full shadow-2xl bg-primary">
              <Settings2 className="h-6 w-6" />
            </Button>
          </DrawerTrigger>
          <DrawerContent className="bg-background/95 backdrop-blur-xl">
            <div className="p-6 space-y-6">
              <SchedulerContextBar T_current={T_current} />
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
                 onOpenWorkdayWindowDialog={() => {}}
                 onStartRegenPod={() => {}}
                 hasFlexibleTasksOnCurrentDay={true}
              />
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );
};

export default SchedulerPage;