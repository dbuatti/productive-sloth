import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { format, parseISO, isSameDay, addMinutes, differenceInMinutes, isBefore, isAfter, startOfDay, addHours } from 'date-fns';
import { Loader2, ListTodo, Sparkles, AlertTriangle, Settings2 } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';

import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import { useSession } from '@/hooks/use-session';
import { useEnvironmentContext } from '@/hooks/use-environment-context';
import { useIsMobile } from '@/hooks/use-mobile';
import { showSuccess, showError } from '@/utils/toast';
import { cn } from '@/lib/utils';
import { 
  calculateSchedule, parseTaskInput, setTimeOnDate, 
  compactScheduleLogic, mergeOverlappingTimeBlocks, 
  getFreeTimeBlocks, calculateEnergyCost, isMeal 
} from '@/lib/scheduler-utils';
import { MAX_ENERGY, REGEN_POD_MAX_DURATION_MINUTES, REGEN_POD_RATE_PER_MINUTE, LOW_ENERGY_THRESHOLD } from '@/lib/constants';
import { DBScheduledTask, RetiredTask, SortBy, TaskEnvironment, NewRetiredTask, FormattedSchedule } from '@/types/scheduler';

// Components
import SchedulerInput from '@/components/SchedulerInput';
import SchedulerDisplay from '@/components/SchedulerDisplay';
import SchedulerDashboardPanel from '@/components/SchedulerDashboardPanel';
import NowFocusCard from '@/components/NowFocusCard';
import CalendarStrip from '@/components/CalendarStrip';
import AetherSink from '@/components/AetherSink';
import WorkdayWindowDialog from '@/components/WorkdayWindowDialog';
import ImmersiveFocusMode from '@/components/ImmersiveFocusMode';
import EarlyCompletionModal from '@/components/EarlyCompletionModal';
import DailyVibeRecapCard from '@/components/DailyVibeRecapCard';
import EnergyDeficitConfirmationDialog from '@/components/EnergyDeficitConfirmationDialog';
import EnergyRegenPodModal from '@/components/EnergyRegenPodModal';
import SchedulerSegmentedControl from '@/components/SchedulerSegmentedControl';
import SchedulerContextBar from '@/components/SchedulerContextBar';
import SchedulerActionCenter from '@/components/SchedulerActionCenter';

interface SchedulerPageProps {
  view: 'schedule' | 'sink' | 'recap';
}

const SchedulerPage: React.FC<SchedulerPageProps> = ({ view }) => {
  const { user, profile, isLoading: isSessionLoading, rechargeEnergy, T_current, activeItemToday, nextItemToday, startRegenPodState, exitRegenPodState, regenPodDurationMinutes, triggerEnergyRegen } = useSession();
  const { selectedEnvironments } = useEnvironmentContext();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();

  const [selectedDay, setSelectedDay] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const scheduleContainerRef = useRef<HTMLDivElement>(null);

  const { 
    dbScheduledTasks, isLoading: isTasksLoading, addScheduledTask, addRetiredTask,
    removeScheduledTask, datesWithTasks, isLoadingDatesWithTasks, retiredTasks,
    isLoadingRetiredTasks, completedTasksForSelectedDayList, retireTask, rezoneTask,
    compactScheduledTasks, randomizeBreaks, sortBy, setSortBy, retiredSortBy, 
    setRetiredSortBy, autoBalanceSchedule, completeScheduledTask: completeMutation,
    updateScheduledTaskDetails, updateScheduledTaskStatus, removeRetiredTask: removeRetiredMutation
  } = useSchedulerTasks(selectedDay, scheduleContainerRef);

  // States
  const [isProcessing, setIsProcessing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [showWorkdayDialog, setShowWorkdayDialog] = useState(false);
  const [showPodModal, setShowPodModal] = useState(false);
  const [podDuration, setPodDuration] = useState(0);

  // Modals
  const [earlyComplete, setEarlyComplete] = useState<{ isOpen: boolean; taskName: string; mins: number; task: DBScheduledTask | null }>({ isOpen: false, taskName: '', mins: 0, task: null });
  const [deficitConfirm, setDeficitConfirm] = useState<{ isOpen: boolean; task: DBScheduledTask | null }>({ isOpen: false, task: null });

  const selectedDayDate = useMemo(() => parseISO(selectedDay), [selectedDay]);

  // Derived Workday Times
  const workdayStart = useMemo(() => profile?.default_auto_schedule_start_time ? setTimeOnDate(selectedDayDate, profile.default_auto_schedule_start_time) : startOfDay(selectedDayDate), [profile, selectedDayDate]);
  const workdayEnd = useMemo(() => {
    let end = profile?.default_auto_schedule_end_time ? setTimeOnDate(selectedDayDate, profile.default_auto_schedule_end_time) : addHours(startOfDay(selectedDayDate), 17);
    return isBefore(end, workdayStart) ? addHours(end, 24) : end;
  }, [profile, selectedDayDate, workdayStart]);

  const currentSchedule = useMemo(() => profile ? calculateSchedule(dbScheduledTasks, selectedDay, workdayStart, workdayEnd, profile.is_in_regen_pod, profile.regen_pod_start_time ? parseISO(profile.regen_pod_start_time) : null, regenPodDurationMinutes, T_current) : null, [dbScheduledTasks, selectedDay, workdayStart, workdayEnd, profile, regenPodDurationMinutes, T_current]);

  // Handlers
  const handleSchedulerAction = useCallback(async (
    action: 'complete' | 'skip' | 'takeBreak' | 'startNext' | 'justFinish' | 'exitFocus',
    task: DBScheduledTask,
    isEarly: boolean = false,
    remainingMins: number = 0
  ) => {
    if (!user || !profile || isProcessing) return;
    setIsProcessing(true);
    try {
      if (action === 'exitFocus') {
        setIsFocusMode(false);
      } else if (action === 'complete') {
        if (profile.energy < 0 && !isMeal(task.name)) {
          setDeficitConfirm({ isOpen: true, task });
          return;
        }
        await completeMutation(task);
        showSuccess("Objective Neutralized.");
      } else if (action === 'skip') {
        await retireTask(task);
        setIsFocusMode(false);
      }
      queryClient.invalidateQueries({ queryKey: ['scheduledTasksToday'] });
    } catch (e: any) {
      showError(e.message);
    } finally {
      setIsProcessing(false);
    }
  }, [user, profile, isProcessing, completeMutation, retireTask, queryClient]);

  const handleRezone = async (task: RetiredTask) => {
    setIsProcessing(true);
    try {
      await rezoneTask(task.id);
      showSuccess("Objective Re-manifested.");
    } finally { setIsProcessing(false); }
  };

  const handleRemoveRetired = async (id: string) => {
    setIsProcessing(true);
    try {
      await removeRetiredMutation(id);
      showSuccess("Data Purged.");
    } finally { setIsProcessing(false); }
  };

  const handleRandomize = async () => {
    setIsProcessing(true);
    try {
      await randomizeBreaks({
        selectedDate: selectedDay,
        workdayStartTime: workdayStart,
        workdayEndTime: workdayEnd,
        currentDbTasks: dbScheduledTasks
      });
    } finally { setIsProcessing(false); }
  };

  const handleStartPod = () => {
    if (profile && profile.energy < MAX_ENERGY) {
      const mins = Math.min(Math.ceil((MAX_ENERGY - profile.energy) / REGEN_POD_RATE_PER_MINUTE), REGEN_POD_MAX_DURATION_MINUTES);
      setPodDuration(mins);
      setShowPodModal(true);
    }
  };

  const renderScheduleCore = () => (
    <>
      <div className="hidden lg:block">
        <SchedulerContextBar T_current={T_current} />
      </div>

      <Card className="p-4 shadow-md animate-hover-lift">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <ListTodo className="h-6 w-6 text-primary" /> Command Input
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <SchedulerInput 
            onCommand={async (val) => { setIsProcessing(true); /* Logic... */ setIsProcessing(false); setInputValue(''); }} 
            isLoading={isProcessing} 
            inputValue={inputValue}
            setInputValue={setInputValue}
            placeholder="Add task (e.g., 'Gym 60')"
            onDetailedInject={() => {}}
          />
        </CardContent>
      </Card>

      <div className="hidden lg:block">
        <SchedulerActionCenter 
          isProcessingCommand={isProcessing}
          dbScheduledTasks={dbScheduledTasks}
          retiredTasksCount={retiredTasks.length}
          sortBy={sortBy}
          onAutoSchedule={async () => {}}
          onCompactSchedule={async () => {}}
          onRandomizeBreaks={handleRandomize}
          onZoneFocus={async () => {}}
          onRechargeEnergy={async () => rechargeEnergy()}
          onQuickBreak={async () => {}}
          onQuickScheduleBlock={async () => {}}
          onSortFlexibleTasks={async (s) => setSortBy(s)}
          onAetherDump={async () => {}}
          onAetherDumpMega={async () => {}}
          onRefreshSchedule={() => {}}
          onOpenWorkdayWindowDialog={() => setShowWorkdayDialog(true)}
          onStartRegenPod={handleStartPod}
          hasFlexibleTasksOnCurrentDay={dbScheduledTasks.some(t => t.is_flexible)}
        />
      </div>

      <Card className="animate-pop-in border-white/10">
        <CardHeader><CardTitle>Timeline Hub</CardTitle></CardHeader>
        <CardContent>
          <SchedulerDisplay 
            schedule={currentSchedule} T_current={T_current} 
            onRemoveTask={() => {}}
            onRetireTask={(task) => handleSchedulerAction('skip', task)}
            onCompleteTask={(task) => handleSchedulerAction('complete', task)}
            activeItemId={activeItemToday?.id || null} 
            selectedDayString={selectedDay} 
            onAddTaskClick={() => {}}
            onScrollToItem={() => {}}
            isProcessingCommand={isProcessing}
            onFreeTimeClick={() => {}}
          />
        </CardContent>
      </Card>
    </>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-24">
      {isFocusMode && activeItemToday && currentSchedule && (
        <ImmersiveFocusMode
          activeItem={activeItemToday}
          T_current={T_current}
          onExit={() => setIsFocusMode(false)}
          onAction={handleSchedulerAction}
          dbTask={dbScheduledTasks.find(t => t.id === activeItemToday.id) || null}
          nextItem={nextItemToday}
          isProcessingCommand={isProcessing}
        />
      )}

      <SchedulerDashboardPanel 
        scheduleSummary={currentSchedule?.summary || null} 
        onAetherDump={async () => {}}
        isProcessingCommand={isProcessing}
        hasFlexibleTasks={true}
        onRefreshSchedule={() => {}}
      />

      <Card className="p-4 shadow-xl">
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
            onRezoneTask={handleRezone} 
            onRemoveRetiredTask={handleRemoveRetired}
            isLoading={isLoadingRetiredTasks} 
            isProcessingCommand={isProcessing} 
            onAutoScheduleSink={() => {}}
            profileEnergy={profile?.energy || 0}
            retiredSortBy={retiredSortBy}
            setRetiredSortBy={setRetiredSortBy}
          />
        )}
        {view === 'recap' && (
          <DailyVibeRecapCard 
            tasksCompletedToday={completedTasksForSelectedDayList?.length || 0} 
            xpEarnedToday={0}
            selectedDayString={selectedDay} 
            completedScheduledTasks={completedTasksForSelectedDayList || []}
            totalActiveTimeMinutes={0} totalBreakTimeMinutes={0} 
            scheduleSummary={null} profileEnergy={0} criticalTasksCompletedToday={0}
          />
        )}
      </div>

      {isMobile && view === 'schedule' && (
        <Drawer>
          <DrawerTrigger asChild>
            <Button className="fixed bottom-24 right-4 h-14 w-14 rounded-full shadow-2xl bg-primary">
              <Settings2 className="h-6 w-6" />
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <div className="p-6 space-y-4">
              <SchedulerContextBar T_current={T_current} />
              <SchedulerActionCenter 
                isProcessingCommand={isProcessing} dbScheduledTasks={dbScheduledTasks}
                retiredTasksCount={retiredTasks.length} sortBy={sortBy}
                onAutoSchedule={async () => {}} onCompactSchedule={async () => {}}
                onRandomizeBreaks={handleRandomize} onZoneFocus={async () => {}}
                onRechargeEnergy={async () => rechargeEnergy()} onQuickBreak={async () => {}}
                onQuickScheduleBlock={async () => {}} onSortFlexibleTasks={async (s) => setSortBy(s)}
                onAetherDump={async () => {}} onAetherDumpMega={async () => {}}
                onRefreshSchedule={() => {}} onOpenWorkdayWindowDialog={() => {}}
                onStartRegenPod={handleStartPod} hasFlexibleTasksOnCurrentDay={true}
              />
            </div>
          </DrawerContent>
        </Drawer>
      )}

      {(profile?.is_in_regen_pod || showPodModal) && (
        <EnergyRegenPodModal
          isOpen={profile?.is_in_regen_pod || showPodModal}
          onExit={async () => { await exitRegenPodState(); setShowPodModal(false); }}
          onStart={async (activity, mins) => { await startRegenPodState(mins); setShowPodModal(false); }}
          isProcessingCommand={isProcessing}
          totalDurationMinutes={profile?.is_in_regen_pod ? regenPodDurationMinutes : podDuration} 
        />
      )}
    </div>
  );
};

export default SchedulerPage;