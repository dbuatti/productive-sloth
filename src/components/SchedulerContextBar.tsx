"use client";

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { formatDateTime } from '@/lib/scheduler-utils';
import { Clock } from 'lucide-react';
import WeatherWidget from './WeatherWidget';
import EnvironmentMultiSelect from './EnvironmentMultiSelect';
import { useCurrentTime } from './CurrentTimeProvider'; // NEW: Import useCurrentTime

interface SchedulerContextBarProps {
  // T_current is now obtained from useCurrentTime, no longer a prop
}

const SchedulerContextBar: React.FC<SchedulerContextBarProps> = () => {
  const { T_current } = useCurrentTime(); // NEW: Get T_current from CurrentTimeProvider

  return (
    <Card className="w-full p-2 animate-pop-in rounded-xl shadow-sm overflow-hidden bg-background/40 backdrop-blur-md">
      <CardContent className="px-0 p-0">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2 px-3">
          
          {/* Time Module - More Compact */}
          <div className="flex items-center gap-2 px-3 h-10 rounded-lg bg-primary/5 border border-primary/10 shrink-0">
            <Clock className="h-3.5 w-3.5 text-primary" />
            <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/50 mr-1">Time</span>
            <span className="text-[10px] font-bold font-mono text-foreground">
              {formatDateTime(T_current)}
            </span>
          </div>

          {/* Environment Filter */}
          <div className="flex-1 min-w-0">
            <EnvironmentMultiSelect />
          </div>

          {/* Weather Module */}
          <div className="lg:w-56 shrink-0">
            <WeatherWidget />
          </div>

        </div>
      </CardContent>
    </Card>
  );
};

export default SchedulerContextBar;