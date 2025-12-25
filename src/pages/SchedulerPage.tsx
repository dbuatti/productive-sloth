"use client";

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { ListTodo, Sparkles, Loader2, Settings2 } from 'lucide-react';

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';

// Dashboard Components
import SchedulerInput from '@/components/SchedulerInput';
import SchedulerDisplay from '@/components/SchedulerDisplay';
import SchedulerContextBar from '@/components/SchedulerContextBar';
import SchedulerActionCenter from '@/components/SchedulerActionCenter';

// ... other imports (useSchedulerTasks, useSession, etc.)

const SchedulerPage: React.FC<SchedulerPageProps> = ({ view }) => {
  const { user, profile, rechargeEnergy, T_current, activeItemToday, nextItemToday } = useSession();
  const [selectedDay, setSelectedDay] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const { 
    dbScheduledTasks, retiredTasks, sortBy, setSortBy, 
    completeScheduledTask, aetherDump, aetherDumpMega 
  } = useSchedulerTasks(selectedDay);

  const handleCommand = async (input: string) => {
    // Command implementation logic
  };

  const renderScheduleCore = () => (
    <div className="space-y-6">
      {/* 1. Context HUD: Only receives T_current */}
      <div className="hidden lg:block">
        <SchedulerContextBar T_current={T_current} />
      </div>

      {/* 2. Input Logic: Only receives Command Props */}
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

      {/* 3. Action Center */}
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

      {/* 4. Display */}
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
      {/* ... Dashboard Panels, CalendarStrip, etc. */}

      <div className="animate-slide-in-up">
        {view === 'schedule' && renderScheduleCore()}
        {/* ... Sink and Recap views */}
      </div>

      {/* 5. Mobile Drawer Fix */}
      {isMobile && view === 'schedule' && (
        <Drawer>
          <DrawerTrigger asChild>
            <Button size="icon" className="fixed bottom-24 right-4 h-14 w-14 rounded-full shadow-2xl bg-primary">
              <Settings2 className="h-6 w-6" />
            </Button>
          </DrawerTrigger>
          <DrawerContent className="bg-background/95 backdrop-blur-xl">
            <div className="p-6 space-y-6">
              {/* Correct Mobile Call: Use Bar for Time and ActionCenter for buttons */}
              <SchedulerContextBar T_current={T_current} />
              <SchedulerActionCenter 
                 // ... Action Center props as used above
              />
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );
};

export default SchedulerPage;