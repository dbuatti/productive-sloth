import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  RotateCcw, 
  Trash2, 
  Lock, 
  Unlock, 
  Zap, 
  Clock, 
  Coffee,
  Calendar,
  MapPin
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatTime, getBreakDescription, isMeal } from '@/lib/scheduler-utils';
import { RetiredTask, TaskEnvironment } from "@/types/scheduler";
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';

interface RetiredTaskDetailDialogProps {
  task: RetiredTask;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRezone: (task: RetiredTask) => void;
  onDelete: (taskId: string, taskName: string) => void;
  isProcessingCommand: boolean;
}

const RetiredTaskDetailDialog: React.FC<RetiredTaskDetailDialogProps> = ({
  task,
  open,
  onOpenChange,
  onRezone,
  onDelete,
  isProcessingCommand,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTask, setEditedTask] = useState({
    name: task?.name || '',
    isCritical: task?.is_critical || false,
    isLocked: task?.is_locked || false,
    environment: task?.task_environment || 'laptop',
  });

  const handleSave = () => {
    // Save logic would go here
    setIsEditing(false);
  };

  if (!task) return null;

  const isMealTask = isMeal(task.name);
  const energyCost = task.energy_cost || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {task.name}
            {task.is_critical && <Zap className="h-4 w-4 text-destructive" />}
            {task.is_locked && <Lock className="h-4 w-4 text-muted-foreground" />}
          </DialogTitle>
          <DialogDescription>
            Retired task details and actions
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          {task.duration && (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">{task.duration} min</div>
                  <div className="text-xs text-muted-foreground">Duration</div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <Coffee className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">{energyCost} energy</div>
                  <div className="text-xs text-muted-foreground">Cost</div>
                </div>
              </div>
            </div>
          )}
          
          {task.break_duration && task.break_duration > 0 && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Coffee className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">{getBreakDescription(task.break_duration)}</div>
                <div className="text-xs text-muted-foreground">Break</div>
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium capitalize">{task.task_environment}</div>
              <div className="text-xs text-muted-foreground">Environment</div>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <Label htmlFor="critical" className="flex items-center gap-2">
              <Zap className="<dyad-problem-report summary="97 problems">
<problem file="src/hooks/use-environment-context.ts" line="33" column="17" code="1005">'&gt;' expected.</problem>
<problem file="src/hooks/use-environment-context.ts" line="33" column="26" code="1005">',' expected.</problem>
<problem file="src/hooks/use-environment-context.ts" line="33" column="37" code="1005">':' expected.</problem>
<problem file="src/hooks/use-environment-context.ts" line="34" column="5" code="1005">',' expected.</problem>
<problem file="src/hooks/use-environment-context.ts" line="39" column="19" code="1005">'&gt;' expected.</problem>
<problem file="src/hooks/use-environment-context.ts" line="39" column="28" code="1005">',' expected.</problem>
<problem file="src/hooks/use-environment-context.ts" line="39" column="39" code="1005">':' expected.</problem>
<problem file="src/hooks/use-environment-context.ts" line="40" column="5" code="1005">',' expected.</problem>
<problem file="src/hooks/use-environment-context.ts" line="45" column="18" code="1005">'&gt;' expected.</problem>
<problem file="src/hooks/use-environment-context.ts" line="45" column="27" code="1005">',' expected.</problem>
<problem file="src/hooks/use-environment-context.ts" line="45" column="38" code="1005">':' expected.</problem>
<problem file="src/hooks/use-environment-context.ts" line="46" column="5" code="1005">',' expected.</problem>
<problem file="src/hooks/use-environment-context.ts" line="51" column="18" code="1005">'&gt;' expected.</problem>
<problem file="src/hooks/use-environment-context.ts" line="51" column="27" code="1005">',' expected.</problem>
<problem file="src/hooks/use-environment-context.ts" line="51" column="38" code="1005">':' expected.</problem>
<problem file="src/hooks/use-environment-context.ts" line="52" column="5" code="1005">',' expected.</problem>
<problem file="src/hooks/use-environment-context.ts" line="57" column="18" code="1005">'&gt;' expected.</problem>
<problem file="src/hooks/use-environment-context.ts" line="57" column="27" code="1005">',' expected.</problem>
<problem file="src/hooks/use-environment-context.ts" line="57" column="38" code="1005">':' expected.</problem>
<problem file="src/hooks/use-environment-context.ts" line="58" column="5" code="1005">',' expected.</problem>
<problem file="src/hooks/use-environment-context.ts" line="105" column="34" code="1005">'&gt;' expected.</problem>
<problem file="src/hooks/use-environment-context.ts" line="105" column="39" code="1005">')' expected.</problem>
<problem file="src/hooks/use-environment-context.ts" line="107" column="6" code="1161">Unterminated regular expression literal.</problem>
<problem file="src/hooks/use-environment-context.ts" line="108" column="3" code="1128">Declaration or statement expected.</problem>
<problem file="src/hooks/use-environment-context.ts" line="109" column="1" code="1128">Declaration or statement expected.</problem>
<problem file="src/components/DailyChallengeClaimButton.tsx" line="10" column="20" code="2339">Property 'claimDailyReward' does not exist on type 'UseSessionReturn'.</problem>
<problem file="src/components/ProgressBarHeader.tsx" line="89" column="49" code="2554">Expected 0 arguments, but got 1.</problem>
<problem file="src/components/FocusAnchor.tsx" line="63" column="35" code="2339">Property 'type' does not exist on type 'ScheduledItem'.</problem>
<problem file="src/components/FocusAnchor.tsx" line="64" column="37" code="2339">Property 'type' does not exist on type 'ScheduledItem'.</problem>
<problem file="src/components/BottomNavigationBar.tsx" line="29" column="32" code="2554">Expected 2 arguments, but got 1.</problem>
<problem file="src/components/MobileStatusIndicator.tsx" line="59" column="35" code="2339">Property 'type' does not exist on type 'ScheduledItem'.</problem>
<problem file="src/components/MobileStatusIndicator.tsx" line="60" column="37" code="2339">Property 'type' does not exist on type 'ScheduledItem'.</problem>
<problem file="src/components/LevelUpCelebration.tsx" line="9" column="11" code="2339">Property 'showLevelUp' does not exist on type 'UseSessionReturn'.</problem>
<problem file="src/components/LevelUpCelebration.tsx" line="9" column="24" code="2339">Property 'levelUpLevel' does not exist on type 'UseSessionReturn'.</problem>
<problem file="src/components/LevelUpCelebration.tsx" line="9" column="38" code="2339">Property 'resetLevelUp' does not exist on type 'UseSessionReturn'.</problem>
<problem file="src/pages/SettingsPage.tsx" line="50" column="87" code="2339">Property 'resetDailyStreak' does not exist on type 'UseSessionReturn'.</problem>
<problem file="src/pages/SettingsPage.tsx" line="50" column="105" code="2339">Property 'updateNotificationPreferences' does not exist on type 'UseSessionReturn'.</problem>
<problem file="src/pages/SettingsPage.tsx" line="50" column="136" code="2339">Property 'updateProfile' does not exist on type 'UseSessionReturn'.</problem>
<problem file="src/pages/SettingsPage.tsx" line="50" column="151" code="2339">Property 'updateSettings' does not exist on type 'UseSessionReturn'.</problem>
<problem file="src/hooks/use-environment-context.ts" line="33" column="12" code="2749">'Home' refers to a value, but is being used as a type here. Did you mean 'typeof Home'?</problem>
<problem file="src/hooks/use-environment-context.ts" line="33" column="17" code="2304">Cannot find name 'className'.</problem>
<problem file="src/hooks/use-environment-context.ts" line="33" column="27" code="2353">Object literal may only specify known properties, and '&quot;h-4 w-4&quot;' does not exist in type 'EnvironmentOption'.</problem>
<problem file="src/hooks/use-environment-context.ts" line="39" column="12" code="2749">'Laptop' refers to a value, but is being used as a type here. Did you mean 'typeof Laptop'?</problem>
<problem file="src/hooks/use-environment-context.ts" line="39" column="19" code="2304">Cannot find name 'className'.</problem>
<problem file="src/hooks/use-environment-context.ts" line="39" column="29" code="2353">Object literal may only specify known properties, and '&quot;h-4 w-4&quot;' does not exist in type 'EnvironmentOption'.</problem>
<problem file="src/hooks/use-environment-context.ts" line="45" column="12" code="2749">'Globe' refers to a value, but is being used as a type here. Did you mean 'typeof Globe'?</problem>
<problem file="src/hooks/use-environment-context.ts" line="45" column="18" code="2304">Cannot find name 'className'.</problem>
<problem file="src/hooks/use-environment-context.ts" line="45" column="28" code="2353">Object literal may only specify known properties, and '&quot;h-4 w-4&quot;' does not exist in type 'EnvironmentOption'.</problem>
<problem file="src/hooks/use-environment-context.ts" line="51" column="12" code="2749">'Music' refers to a value, but is being used as a type here. Did you mean 'typeof Music'?</problem>
<problem file="src/hooks/use-environment-context.ts" line="51" column="18" code="2304">Cannot find name 'className'.</problem>
<problem file="src/hooks/use-environment-context.ts" line="51" column="28" code="2353">Object literal may only specify known properties, and '&quot;h-4 w-4&quot;' does not exist in type 'EnvironmentOption'.</problem>
<problem file="src/hooks/use-environment-context.ts" line="57" column="12" code="2749">'Check' refers to a value, but is being used as a type here. Did you mean 'typeof Check'?</problem>
<problem file="src/hooks/use-environment-context.ts" line="57" column="18" code="2304">Cannot find name 'className'.</problem>
<problem file="src/hooks/use-environment-context.ts" line="57" column="28" code="2353">Object literal may only specify known properties, and '&quot;h-4 w-4&quot;' does not exist in type 'EnvironmentOption'.</problem>
<problem file="src/hooks/use-environment-context.ts" line="105" column="6" code="2503">Cannot find namespace 'EnvironmentContext'.</problem>
<problem file="src/hooks/use-environment-context.ts" line="105" column="40" code="2365">Operator '&gt;' cannot be applied to types '{ value: { selectedEnvironments: TaskEnvironment[]; toggleEnvironment: (environment: TaskEnvironment) =&gt; void; clearEnvironments: () =&gt; void; environmentOptions: EnvironmentOption[]; }; }' and '{ children: React.ReactNode; }'.</problem>
<problem file="src/hooks/use-environment-context.ts" line="105" column="40" code="2365">Operator '&lt;' cannot be applied to types 'boolean' and 'RegExp'.</problem>
<problem file="src/components/RetiredTaskDetailDialog.tsx" line="59" column="11" code="2339">Property 'updateRetiredTaskDetails' does not exist on type 'UseSchedulerTasksReturn'.</problem>
<problem file="src/components/RetiredTaskDetailDialog.tsx" line="59" column="37" code="2339">Property 'completeRetiredTask' does not exist on type 'UseSchedulerTasksReturn'.</problem>
<problem file="src/components/RetiredTaskDetailDialog.tsx" line="59" column="58" code="2339">Property 'updateRetiredTaskStatus' does not exist on type 'UseSchedulerTasksReturn'.</problem>
<problem file="src/components/RetiredTaskDetailDialog.tsx" line="59" column="86" code="2554">Expected 2 arguments, but got 1.</problem>
<problem file="src/components/RetiredTaskDetailDialog.tsx" line="89" column="9" code="2322">Type 'TaskEnvironment' is not assignable to type '&quot;home&quot; | &quot;laptop&quot; | &quot;away&quot; | &quot;piano&quot; | &quot;laptop_piano&quot;'.
  Type '&quot;globe&quot;' is not assignable to type '&quot;home&quot; | &quot;laptop&quot; | &quot;away&quot; | &quot;piano&quot; | &quot;laptop_piano&quot;'.</problem>
<problem file="src/components/RetiredTaskDetailDialog.tsx" line="252" column="32" code="2604">JSX element type 'option.icon' does not have any construct or call signatures.</problem>
<problem file="src/components/RetiredTaskDetailDialog.tsx" line="252" column="32" code="2786">'option.icon' cannot be used as a JSX component.
  Its type 'ReactNode' is not a valid JSX element type.
    Type 'number' is not assignable to type 'ElementType'.</problem>
<problem file="src/components/AetherSink.tsx" line="260" column="11" code="2322">Type '{ task: RetiredTask; open: boolean; onOpenChange: Dispatch&lt;SetStateAction&lt;boolean&gt;&gt;; onRezone: (task: RetiredTask) =&gt; void; onDelete: (id: string, name: string) =&gt; void; isProcessingCommand: boolean; }' is not assignable to type 'IntrinsicAttributes &amp; RetiredTaskDetailSheetProps'.
  Property 'onRezone' does not exist on type 'IntrinsicAttributes &amp; RetiredTaskDetailSheetProps'.</problem>
<problem file="src/components/SchedulerUtilityBar.tsx" line="17" column="10" code="2305">Module '&quot;@/lib/constants&quot;' has no exported member 'DURATION_BUCKETS'.</problem>
<problem file="src/components/WorkdayWindowDialog.tsx" line="41" column="49" code="2339">Property 'updateProfile' does not exist on type 'UseSessionReturn'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="702" column="13" code="2304">Cannot find name 'removeRetiredTask'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="713" column="61" code="2304">Cannot find name 'removeRetiredTask'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1165" column="13" code="2304">Cannot find name 'autoBalanceSchedule'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1177" column="134" code="2304">Cannot find name 'autoBalanceSchedule'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1303" column="15" code="2739">Type '{ user_id: string; name: string; duration: number; break_duration: number; original_scheduled_date: string; is_critical: boolean; energy_cost: number; is_custom_energy_cost: false; task_environment: TaskEnvironment; }' is missing the following properties from type 'NewRetiredTask': is_locked, is_completed</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1333" column="36" code="2345">Argument of type '{ name: string; start_time: string; end_time: string; break_duration: number; is_critical: boolean; is_flexible: boolean; scheduled_date: string; energy_cost: number; is_custom_energy_cost: false; task_environment: TaskEnvironment; }' is not assignable to parameter of type 'NewDBScheduledTask'.
  Property 'is_locked' is missing in type '{ name: string; start_time: string; end_time: string; break_duration: number; is_critical: boolean; is_flexible: boolean; scheduled_date: string; energy_cost: number; is_custom_energy_cost: false; task_environment: TaskEnvironment; }' but required in type 'NewDBScheduledTask'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1383" column="34" code="2345">Argument of type '{ name: string; start_time: string; end_time: string; break_duration: number; scheduled_date: string; is_critical: boolean; is_flexible: boolean; energy_cost: number; is_custom_energy_cost: false; task_environment: TaskEnvironment; }' is not assignable to parameter of type 'NewDBScheduledTask'.
  Property 'is_locked' is missing in type '{ name: string; start_time: string; end_time: string; break_duration: number; scheduled_date: string; is_critical: boolean; is_flexible: boolean; energy_cost: number; is_custom_energy_cost: false; task_environment: TaskEnvironment; }' but required in type 'NewDBScheduledTask'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1412" column="45" code="2339">Property 'breakDuration' does not exist on type '{ taskName: string; duration: number; isCritical: boolean; isFlexible: boolean; energyCost: number; startTime?: undefined; endTime?: undefined; } | { taskName: string; startTime: string; endTime: string; isCritical: boolean; isFlexible: boolean; energyCost: number; duration?: undefined; }'.
  Property 'breakDuration' does not exist on type '{ taskName: string; duration: number; isCritical: boolean; isFlexible: boolean; energyCost: number; startTime?: undefined; endTime?: undefined; }'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1428" column="34" code="2345">Argument of type '{ name: string; start_time: string; end_time: string; break_duration: any; scheduled_date: string; is_critical: boolean; is_flexible: boolean; energy_cost: number; is_custom_energy_cost: false; task_environment: TaskEnvironment; }' is not assignable to parameter of type 'NewDBScheduledTask'.
  Property 'is_locked' is missing in type '{ name: string; start_time: string; end_time: string; break_duration: any; scheduled_date: string; is_critical: boolean; is_flexible: boolean; energy_cost: number; is_custom_energy_cost: false; task_environment: TaskEnvironment; }' but required in type 'NewDBScheduledTask'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1463" column="40" code="2339">Property 'breakDuration' does not exist on type '{ taskName: string; duration: number; isCritical: boolean; isFlexible: boolean; energyCost: number; startTime?: undefined; endTime?: undefined; } | { taskName: string; startTime: string; endTime: string; isCritical: boolean; isFlexible: boolean; energyCost: number; duration?: undefined; }'.
  Property 'breakDuration' does not exist on type '{ taskName: string; duration: number; isCritical: boolean; isFlexible: boolean; energyCost: number; startTime?: undefined; endTime?: undefined; }'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1481" column="40" code="2339">Property 'breakDuration' does not exist on type '{ taskName: string; duration: number; isCritical: boolean; isFlexible: boolean; energyCost: number; startTime?: undefined; endTime?: undefined; } | { taskName: string; startTime: string; endTime: string; isCritical: boolean; isFlexible: boolean; energyCost: number; duration?: undefined; }'.
  Property 'breakDuration' does not exist on type '{ taskName: string; duration: number; isCritical: boolean; isFlexible: boolean; energyCost: number; startTime?: undefined; endTime?: undefined; }'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1661" column="30" code="2345">Argument of type '{ name: string; start_time: string; end_time: string; break_duration: number; scheduled_date: string; is_critical: boolean; is_flexible: boolean; energy_cost: number; is_custom_energy_cost: false; task_environment: TaskEnvironment; }' is not assignable to parameter of type 'NewDBScheduledTask'.
  Property 'is_locked' is missing in type '{ name: string; start_time: string; end_time: string; break_duration: number; scheduled_date: string; is_critical: boolean; is_flexible: boolean; energy_cost: number; is_custom_energy_cost: false; task_environment: TaskEnvironment; }' but required in type 'NewDBScheduledTask'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1714" column="32" code="2345">Argument of type '{ name: string; start_time: string; end_time: string; break_duration: number; scheduled_date: string; is_critical: boolean; is_flexible: boolean; energy_cost: number; is_custom_energy_cost: false; task_environment: TaskEnvironment; }' is not assignable to parameter of type 'NewDBScheduledTask'.
  Property 'is_locked' is missing in type '{ name: string; start_time: string; end_time: string; break_duration: number; scheduled_date: string; is_critical: boolean; is_flexible: boolean; energy_cost: number; is_custom_energy_cost: false; task_environment: TaskEnvironment; }' but required in type 'NewDBScheduledTask'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1976" column="19" code="2304">Cannot find name 'updateScheduledTaskStatus'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1979" column="19" code="2304">Cannot find name 'completeScheduledTaskMutation'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2037" column="15" code="2304">Cannot find name 'completeScheduledTaskMutation'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2077" column="15" code="2304">Cannot find name 'completeScheduledTaskMutation'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2116" column="17" code="2304">Cannot find name 'updateScheduledTaskDetails'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2133" column="15" code="2304">Cannot find name 'completeScheduledTaskMutation'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2196" column="5" code="2304">Cannot find name 'completeScheduledTaskMutation'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2198" column="5" code="2304">Cannot find name 'updateScheduledTaskStatus'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2201" column="5" code="2304">Cannot find name 'updateScheduledTaskDetails'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2230" column="15" code="2304">Cannot find name 'updateScheduledTaskStatus'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2233" column="15" code="2304">Cannot find name 'completeScheduledTaskMutation'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2276" column="5" code="2304">Cannot find name 'completeScheduledTaskMutation'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="2287" column="5" code="2304">Cannot find name 'updateScheduledTaskStatus'.</problem>
<problem file="src/pages/DocumentationPage.tsx" line="6" column="10" code="2305">Module '&quot;@/lib/scheduler-utils&quot;' has no exported member 'EMOJI_MAP'.</problem>
<problem file="src/pages/DocumentationPage.tsx" line="6" column="21" code="2305">Module '&quot;@/lib/scheduler-utils&quot;' has no exported member 'EMOJI_HUE_MAP'.</problem>
<problem file="src/components/EnvironmentProvider.tsx" line="5" column="10" code="2724">'&quot;@/hooks/use-environment-context&quot;' has no exported member named 'EnvironmentContext'. Did you mean 'useEnvironmentContext'?</problem>
<problem file="src/components/EnvironmentProvider.tsx" line="5" column="50" code="2724">'&quot;@/hooks/use-environment-context&quot;' has no exported member named 'EnvironmentContextType'. Did you mean 'useEnvironmentContext'?</problem>
</dyad-problem-report>I'll fix these TypeScript errors systematically. Let me start with the environment context hook which has parsing issues:

<dyad-write path="src/hooks/use-environment-context.ts" description="Fixing environment context hook with proper TypeScript syntax">
import { useState, useEffect, useMemo, useContext, createContext, ReactNode } from 'react';
import { Home, Laptop, Globe, Music, Check } from 'lucide-react';
import { TaskEnvironment } from '@/types/scheduler';

export interface EnvironmentOption {
  value: TaskEnvironment;
  label: string;
  icon: React.ReactNode;
  color: string;
}

interface EnvironmentContextType {
  selectedEnvironments: TaskEnvironment[];
  toggleEnvironment: (environment: TaskEnvironment) => void;
  clearEnvironments: () => void;
  environmentOptions: EnvironmentOption[];
}

const EnvironmentContext = createContext<EnvironmentContextType | undefined>(undefined);

export const useEnvironmentContext = () => {
  const context = useContext(EnvironmentContext);
  if (!context) {
    throw new Error('useEnvironmentContext must be used within an EnvironmentProvider');
  }
  return context;
};

export const environmentOptions: EnvironmentOption[] = [
  {
    value: 'home',
    label: 'Home',
    icon: <Home className="h-4 w-4" />,
    color: 'bg-blue-100 text-blue-800',
  },
  {
    value: 'laptop',
    label: 'Laptop',
    icon: <Laptop className="h-4 w-4" />,
    color: 'bg-green-100 text-green-800',
  },
  {
    value: 'globe',
    label: 'Globe',
    icon: <Globe className="h-4 w-4" />,
    color: 'bg-purple-100 text-purple-800',
  },
  {
    value: 'music',
    label: 'Music',
    icon: <Music className="h-4 w-4" />,
    color: 'bg-yellow-100 text-yellow-800',
  },
  {
    value: 'away',
    label: 'Away',
    icon: <Check className="h-4 w-4" />,
    color: 'bg-gray-100 text-gray-800',
  },
];

interface EnvironmentProviderProps {
  children: ReactNode;
}

export const EnvironmentProvider: React.FC<EnvironmentProviderProps> = ({ children }) => {
  const [selectedEnvironments, setSelectedEnvironments] = useState<TaskEnvironment[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('aetherflow-selected-environments');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.every(env => 
            ['home', 'laptop', 'globe', 'music', 'away'].includes(env))) {
            return parsed;
          }
        } catch {
          return ['laptop'];
        }
      }
    }
    return ['laptop'];
  });

  useEffect(() => {
    localStorage.setItem('aetherflow-selected-environments', JSON.stringify(selectedEnvironments));
  }, [selectedEnvironments]);

  const toggleEnvironment = (environment: TaskEnvironment) => {
    setSelectedEnvironments(prev => 
      prev.includes(environment) 
        ? prev.filter(env => env !== environment) 
        : [...prev, environment]
    );
  };

  const clearEnvironments = () => {
    setSelectedEnvironments([]);
  };

  const value = useMemo(() => ({
    selectedEnvironments,
    toggleEnvironment,
    clearEnvironments,
    environmentOptions,
  }), [selectedEnvironments]);

  return (
    <EnvironmentContext.Provider value={value}>
      {children}
    </EnvironmentContext.Provider>
  );
};