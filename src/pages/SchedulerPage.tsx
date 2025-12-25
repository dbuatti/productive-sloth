"use client";

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { ListTodo, Sparkles, Settings2 } from 'lucide-react';

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';

// Custom Dashboard Components
import SchedulerInput from '@/components/SchedulerInput';
import SchedulerDisplay from '@/components/SchedulerDisplay';
import SchedulerContextBar from '@/components/SchedulerContextBar';
import SchedulerActionCenter from '@/components/SchedulerActionCenter';

// Hooks
import { useSession } from '@/hooks/use-session';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import { useIsMobile } from '@/hooks/use-mobile';

const SchedulerPage: React.FC = () => {
  const { T_current, profile, rechargeEnergy } = useSession();
  const isMobile = useIsMobile();
  
  const [selectedDay, setSelectedDay] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const { dbScheduledTasks, retiredTasks, sortBy, setSortBy } = useSchedulerTasks(selectedDay);

  const handleCommand = async (input: string) => {
    // Process input logic here
    console.log("Command:", input);
  };

  const renderScheduleCore = () => (
    <div className="space-y-6">
      {/* 1. Dashboard HUD: Information only (No Logic Props) */}
      <div className="hidden lg:block">
        <SchedulerContextBar T_current={T_current} />
      </div>

      {/* 2. Command Terminal: Logic only (No Time Props) */}
      <Card className="p-4 shadow-md bg-card/40 border-primary/10">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
            <ListTodo className="h-6 w-6 text-primary" /> Command Terminal
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
      
      {/* Action Center */}
      <div className="hidden lg:block">
        <SchedulerActionCenter 
          isProcessingCommand={isProcessing}
          dbScheduledTasks={dbScheduledTasks}
          retiredTasksCount={retiredTasks.length}
          sortBy={sortBy}
          onSortFlexibleTasks={async (s) => setSortBy(s)}
          onRechargeEnergy={async () => rechargeEnergy()}
          hasFlexibleTasksOnCurrentDay={dbScheduledTasks.some(t => t.is_flexible)}
          // ... rest of props as needed
        />
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-24 px-4">
      {renderScheduleCore()}

      {isMobile && (
        <Drawer>
          <DrawerTrigger asChild>
            <Button size="icon" className="fixed bottom-24 right-4 h-14 w-14 rounded-full shadow-2xl bg-primary">
              <Settings2 className="h-6 w-6" />
            </Button>
          </DrawerTrigger>
          <DrawerContent className="bg-background/95 backdrop-blur-xl">
            <div className="p-6 space-y-6">
              {/* Separate Mobile Calls */}
              <SchedulerContextBar T_current={T_current} />
              <div className="border-t border-white/10 pt-4">
                <SchedulerActionCenter 
                   isProcessingCommand={isProcessing}
                   dbScheduledTasks={dbScheduledTasks}
                   retiredTasksCount={retiredTasks.length}
                   sortBy={sortBy}
                   onSortFlexibleTasks={async (s) => setSortBy(s)}
                   onRechargeEnergy={async () => rechargeEnergy()}
                   hasFlexibleTasksOnCurrentDay={true}
                />
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );
};

export default SchedulerPage;