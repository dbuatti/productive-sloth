"use client";

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { formatDateTime } from '@/lib/scheduler-utils';
import { Clock } from 'lucide-react';
import WeatherWidget from './WeatherWidget';
import EnvironmentMultiSelect from './EnvironmentMultiSelect';
import { useEnvironments } from '@/hooks/use-environments'; // Import useEnvironments
import { getIconComponent } from '@/context/EnvironmentContext'; // Import from context

interface SchedulerContextBarProps {
  T_current: Date;
}

const SchedulerContextBar: React.FC<SchedulerContextBarProps> = ({ T_current }) => {
  return (
    <div className="w-full"> {/* Removed p-2 animate-pop-in rounded-xl shadow-sm overflow-hidden bg-background/40 backdrop-blur-md */}
      <div className="px-0"> {/* Replaced CardContent with div */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2 px-3">
          
          {/* Time Module - More Compact */}
          <div className="flex items-center gap-2 px-3 h-10 rounded-lg bg-primary/5 border border-primary/10 shrink-0">
            <Clock className="h-3.5 w-3.5 text-primary" />
            <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/50 mr-1">Time</span> {/* Adjusted font size */}
            <span className="text-[10px] font-bold font-mono text-foreground"> {/* Adjusted font size */}
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
      </div>
    </div>
  );
};

export default SchedulerContextBar;