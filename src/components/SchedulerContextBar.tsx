import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { formatDateTime } from '@/lib/scheduler-utils';
import { Clock, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import WeatherWidget from './WeatherWidget';
import EnvironmentMultiSelect from './EnvironmentMultiSelect';

interface SchedulerContextBarProps {
  T_current: Date;
}

const SchedulerContextBar: React.FC<SchedulerContextBarProps> = ({ T_current }) => {
  return (
    <Card glass className="p-2 animate-pop-in border-white/10 shadow-2xl overflow-hidden">
      <CardContent className="p-0">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
          
          {/* Module 1: Chrono-Sync (Time) */}
          <div className="flex items-center gap-3 px-4 h-11 rounded-xl bg-primary/5 border border-primary/10 shrink-0">
            <div className="relative">
              <Clock className="h-4 w-4 text-primary" />
              <div className="absolute inset-0 bg-primary/20 blur-md rounded-full animate-pulse" />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 leading-none mb-1">
                Temporal Sync
              </span>
              <span className="text-xs font-black font-mono text-foreground leading-none">
                {formatDateTime(T_current)}
              </span>
            </div>
          </div>

          {/* Module 2: Frequency Filter (Environment Select) */}
          <div className="flex-1 min-w-0">
            {/* Note: Ensure EnvironmentMultiSelect trigger button is h-11 */}
            <EnvironmentMultiSelect />
          </div>

          {/* Module 3: Atmospheric Sensor (Weather) */}
          <div className="lg:w-64 shrink-0">
            <WeatherWidget />
          </div>

          {/* Module 4: Live Status Indicator */}
          <div className="hidden xl:flex items-center px-4 h-11 rounded-xl bg-secondary/20 border border-white/5 opacity-40">
            <Radio className="h-3 w-3 text-logo-green mr-2 animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-[0.2em] whitespace-nowrap">
              Aether Link Active
            </span>
          </div>

        </div>
      </CardContent>
    </Card>
  );
};

export default SchedulerContextBar;