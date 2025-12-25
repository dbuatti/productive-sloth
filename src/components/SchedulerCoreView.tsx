import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ListTodo, Sparkles, Loader2, AlertTriangle, Settings2 } from 'lucide-react';
import SchedulerInput from '@/components/SchedulerInput';
import SchedulerDisplay from '@/components/SchedulerDisplay';
import SchedulerDashboardPanel from '@/components/SchedulerDashboardPanel';
import NowFocusCard from '@/components/NowFocusCard';
import SchedulerContextBar from '@/components/SchedulerContextBar';
import SchedulerActionCenter from '@/components/SchedulerActionCenter';
import { DBScheduledTask, FormattedSchedule, ScheduledItem, SortBy, RetiredTask, TaskEnvironment } from '@/types/scheduler';
import { format as formatFns, parseISO, isSameDay, addMinutes, differenceInMinutes } from 'date-fns';
import { isMeal } from '@/lib/scheduler-utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SchedulerCoreViewProps {
  T_current: Date;
  isProcessingCommand: boolean;
  dbScheduledTasks: DBScheduledTask[];
  retiredTasks: RetiredTask[];
  sortBy: SortBy;
  onAutoScheduleDay: () => Promise<void>;
  onCompactSchedule: () => Promise<void>;
  onRandomizeBreaks: () => Promise<void>;
  onZoneFocus: () => Promise<void>;
  onRechargeEnergy: () => Promise<void>;
  onQuickBreak: () => Promise<void>;
  onQuickScheduleBlock: (duration: number, sortPreference: 'longestFirst' | 'shortestFirst') => Promise<void>;
  onSortFlexibleTasks: (newSortBy: SortBy) => Promise<void>;
  onAetherDump: () => Promise<void>;
  onAetherDumpMega: () => Promise<void>;
  onRefreshSchedule: () => void;
  onOpenWorkdayWindowDialog: () => void;
  onStartRegenPod: () => Promise<void>;
  hasFlexibleTasksOnCurrentDay: boolean;
  activeItemToday: ScheduledItem | null;
  nextItemToday: ScheduledItem | null;
  selectedDay: string;
  currentSchedule: FormattedSchedule | null;
  isSchedulerTasksLoading: boolean;
  onCommand: (input: string) => Promise<void>;
  inputValue: string;
  setInputValue: (value: string) => void;
  onDetailedInject: () => void;
  onRemoveTask: (taskId: string, taskName: string, index: number) => void;
  onRetireTask: (task: DBScheduledTask) => Promise<void>;
  onCompleteTask: (task: DBScheduledTask, index: number) => Promise<void>;
  onScrollToItem: (itemId: string) => void;
  onFreeTimeClick: (startTime: Date, endTime: Date) => void;
  scheduleContainerRef: React.RefObject<HTMLDivElement>;
}

const SchedulerCoreView: React.FC<SchedulerCoreViewProps> = ({
  T_current,
  isProcessingCommand,
  dbScheduledTasks,
  retiredTasks,
  sortBy,
  onAutoScheduleDay,
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
  hasFlexibleTasksOnCurrentDay,
  activeItemToday,
  nextItemToday,
  selectedDay,
  currentSchedule,
  isSchedulerTasksLoading,
  onCommand,
  inputValue,
  setInputValue,
  onDetailedInject,
  onRemoveTask,
  onRetireTask,
  onCompleteTask,
  onScrollToItem,
  onFreeTimeClick,
  scheduleContainerRef,
}) => {
  const isMobile = useIsMobile();

  return (
    <>
      {/* Info Panel Card (Desktop Only) */}
      <div className="hidden lg:block">
        <SchedulerContextBar T_current={T_current} />
      </div>

      {/* Schedule Input Card (Now visible on all screens) */}
      <Card className="p-4 animate-slide-in-up shadow-md animate-hover-lift">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
            <ListTodo className="h-6 w-6 text-primary" /> Quick Add
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <SchedulerInput
            onCommand={onCommand}
            isLoading={isProcessingCommand}
            inputValue={inputValue}
            setInputValue={setInputValue}
            placeholder={`Add task (e.g., 'Gym 60', '-Clean desk') or command`}
            onDetailedInject={onDetailedInject}
          />
          <p className="text-sm text-muted-foreground mt-2">
            Examples: "Gym 60", "-Clean desk 30", "Meeting 11am-12pm", 'inject "Project X" 30', 'remove "Gym"', 'clear', 'compact', "Clean the sink 30 sink", "Time Off 2pm-3pm", "Aether Dump", "Aether Dump Mega"
          </p>
        </CardContent>
      </Card>

      {/* Action Center (Desktop Only) */}
      <div className="animate-slide-in-up hidden lg:block">
        <SchedulerActionCenter
          isProcessingCommand={isProcessingCommand}
          dbScheduledTasks={dbScheduledTasks}
          retiredTasksCount={retiredTasks.length}
          sortBy={sortBy}
          onAutoSchedule={onAutoScheduleDay}
          onCompactSchedule={onCompactSchedule}
          onRandomizeBreaks={onRandomizeBreaks}
          onZoneFocus={onZoneFocus}
          onRechargeEnergy={onRechargeEnergy}
          onQuickBreak={onQuickBreak}
          onQuickScheduleBlock={onQuickScheduleBlock}
          onSortFlexibleTasks={onSortFlexibleTasks}
          onAetherDump={onAetherDump}
          onAetherDumpMega={onAetherDumpMega}
          onRefreshSchedule={onRefreshSchedule}
          onOpenWorkdayWindowDialog={onOpenWorkdayWindowDialog}
          onStartRegenPod={onStartRegenPod}
          hasFlexibleTasksOnCurrentDay={hasFlexibleTasksOnCurrentDay}
        />
      </div>

      {/* Now Focus Card (Always visible) */}
      {isSameDay(parseISO(selectedDay), T_current) && (
        <div className="pb-4 animate-slide-in-up">
          <NowFocusCard
            activeItem={activeItemToday}
            nextItem={nextItemToday}
            T_current={T_current}
            onEnterFocusMode={() => { /* Handled by SchedulerPage */ }}
          />
        </div>
      )}

      {currentSchedule?.summary.unscheduledCount > 0 && (
        <Card className="animate-pop-in animate-hover-lift">
          <CardContent className="p-4 text-center text-orange-500 font-semibold flex items-center justify-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            <span>⚠️ {currentSchedule.summary.unscheduledCount} task{currentSchedule.summary.unscheduledCount > 1 ? 's' : ''} fall outside your workday window.</span>
          </CardContent>
        </Card>
      )}

      <Card className="animate-pop-in animate-hover-lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-logo-yellow" /> Your Vibe Schedule for {formatFns(parseISO(selectedDay), 'EEEE, MMMM d')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {isSchedulerTasksLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <SchedulerDisplay
              schedule={currentSchedule}
              T_current={T_current}
              onRemoveTask={onRemoveTask}
              onRetireTask={onRetireTask}
              onCompleteTask={onCompleteTask}
              activeItemId={activeItemToday?.id || null}
              selectedDayString={selectedDay}
              onAddTaskClick={onDetailedInject}
              onScrollToItem={onScrollToItem}
              isProcessingCommand={isProcessingCommand}
              onFreeTimeClick={onFreeTimeClick}
              scheduleContainerRef={scheduleContainerRef}
            />
          )}
        </CardContent>
      </Card>

      {/* Mobile Controls Drawer (Hidden on desktop) */}
      {isMobile && (
          <Drawer>
              <DrawerTrigger asChild>
                  <Button
                      variant="default"
                      size="icon"
                      className={cn(
                          "fixed bottom-28 right-4 z-50 h-14 w-14 rounded-full shadow-xl bg-accent hover:bg-accent/90 transition-all duration-200",
                          isProcessingCommand && "opacity-70 cursor-not-allowed"
                      )}
                      disabled={isProcessingCommand}
                  >
                      <Settings2 className="h-6 w-6" />
                      <span className="sr-only">Open Schedule Controls</span>
                  </Button>
              </DrawerTrigger>
              <DrawerContent className="max-h-[90vh]">
                  <DrawerHeader className="text-left">
                      <DrawerTitle className="flex items-center gap-2 text-xl font-bold">
                          <Settings2 className="h-6 w-6 text-primary" /> Schedule Controls
                      </DrawerTitle>
                  </DrawerHeader>
                  <div className="p-4 overflow-y-auto space-y-4">
                      {/* Mobile Context Bar */}
                      <SchedulerContextBar T_current={T_current} />

                      {/* Mobile Action Center */}
                      <SchedulerActionCenter
                          isProcessingCommand={isProcessingCommand}
                          dbScheduledTasks={dbScheduledTasks}
                          retiredTasksCount={retiredTasks.length}
                          sortBy={sortBy}
                          onAutoSchedule={onAutoScheduleDay}
                          onCompactSchedule={onCompactSchedule}
                          onRandomizeBreaks={onRandomizeBreaks}
                          onZoneFocus={onZoneFocus}
                          onRechargeEnergy={onRechargeEnergy}
                          onQuickBreak={onQuickBreak}
                          onQuickScheduleBlock={onQuickScheduleBlock}
                          onSortFlexibleTasks={onSortFlexibleTasks}
                          onAetherDump={onAetherDump}
                          onAetherDumpMega={onAetherDumpMega}
                          onRefreshSchedule={onRefreshSchedule}
                          onOpenWorkdayWindowDialog={onOpenWorkdayWindowDialog}
                          onStartRegenPod={onStartRegenPod}
                          hasFlexibleTasksOnCurrentDay={hasFlexibleTasksOnCurrentDay}
                      />
                  </div>
              </DrawerContent>
          </Drawer>
      )}
    </>
  );
};

export default SchedulerCoreView;