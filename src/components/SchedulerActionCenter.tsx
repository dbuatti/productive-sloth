"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Zap, Shuffle, ChevronsUp, RefreshCcw, Clock, BatteryCharging, Target, Coffee, Archive, Database, Trash
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { DBScheduledTask } from '@/types/scheduler';

interface SchedulerActionCenterProps {
  isProcessingCommand: boolean;
  dbScheduledTasks: DBScheduledTask[];
  retiredTasksCount: number;
  onRebalanceToday: () => Promise<void>;
  onCompactSchedule: () => Promise<void>;
  onRandomizeBreaks: () => Promise<void>;
  onZoneFocus: () => Promise<void>;
  onRechargeEnergy: () => Promise<void>;
  onQuickBreak: () => Promise<void>;
  onAetherDump: () => Promise<void>;
  onClearToday: () => Promise<void>;
  onRefreshSchedule: () => void;
  onStartRegenPod: () => void;
}

const SchedulerActionCenter: React.FC<SchedulerActionCenterProps> = ({
  isProcessingCommand,
  dbScheduledTasks,
  retiredTasksCount,
  onRebalanceToday,
  onCompactSchedule,
  onRandomizeBreaks,
  onZoneFocus,
  onRechargeEnergy,
  onQuickBreak,
  onAetherDump,
  onClearToday,
  onRefreshSchedule,
  onStartRegenPod,
}) => {
  const hasUnlockedBreaks = dbScheduledTasks.some(task => task.name.toLowerCase() === 'break' && !task.is_locked);
  const hasUnlockedFlexibleTasks = dbScheduledTasks.some(task => task.is_flexible && !task.is_locked);

  const ActionButton = ({ icon: Icon, label, onClick, disabled, variant = "outline" }: any) => (
    <Button
      variant={variant}
      onClick={onClick}
      disabled={disabled || isProcessingCommand}
      className="h-10 w-full flex items-center justify-start gap-3 px-4 text-xs font-bold rounded-xl transition-all"
    >
      <Icon className="h-4 w-4 shrink-0 opacity-60" />
      <span>{label}</span>
    </Button>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <Card className="border-none bg-muted/30 rounded-2xl">
        <CardContent className="p-3 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1 mb-2">Planning</p>
          <ActionButton icon={Target} label="Fill Gaps" onClick={onRebalanceToday} disabled={retiredTasksCount === 0} variant="secondary" />
          <ActionButton icon={ChevronsUp} label="Compact" onClick={onCompactSchedule} disabled={!hasUnlockedFlexibleTasks} />
          <ActionButton icon={Shuffle} label="Shuffle Breaks" onClick={onRandomizeBreaks} disabled={!hasUnlockedBreaks} />
        </CardContent>
      </Card>

      <Card className="border-none bg-muted/30 rounded-2xl">
        <CardContent className="p-3 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1 mb-2">Energy</p>
          <ActionButton icon={Zap} label="Recharge" onClick={onRechargeEnergy} />
          <ActionButton icon={Coffee} label="Quick Break" onClick={onQuickBreak} />
          <ActionButton icon={BatteryCharging} label="Regen Pod" onClick={onStartRegenPod} />
        </CardContent>
      </Card>

      <Card className="border-none bg-muted/30 rounded-2xl">
        <CardContent className="p-3 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1 mb-2">System</p>
          <ActionButton icon={Archive} label="Archive All" onClick={onAetherDump} />
          <ActionButton icon={Trash} label="Clear Day" onClick={onClearToday} />
          <ActionButton icon={Database} label="Sync Data" onClick={onRefreshSchedule} />
        </CardContent>
      </Card>
    </div>
  );
};

export default SchedulerActionCenter;