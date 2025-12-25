"use client";

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { formatDateTime } from '@/lib/scheduler-utils';
import { Clock } from 'lucide-react';
import WeatherWidget from './WeatherWidget';
import EnvironmentMultiSelect from './EnvironmentMultiSelect';

interface SchedulerContextBarProps {
  T_current: Date;
}

const SchedulerContextBar: React.FC<SchedulerContextBarProps> = ({ T_current }) => {
  return (
    <Card className="glass-card p-2 animate-pop-in border-white/10 shadow-2xl overflow-hidden bg-background/40 backdrop-blur-md">
      <CardContent className="p-0">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
          
          {/* Time Module */}
          <div className="flex items-center gap-3 px-4 h-11 rounded-xl bg-primary/5 border border-primary/10 shrink-0">
            <div className="relative">
              <Clock className="h-4 w-4 text-primary" />
              <div className="absolute inset-0 bg-primary/20 blur-md rounded-full animate-pulse" />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 leading-none mb-1">
                Current Time
              </span>
              <span className="text-xs font-black font-mono text-foreground leading-none">
                {formatDateTime(T_current)}
              </span>
            </div>
          </div>

          {/* Environment Filter */}
          <div className="flex-1 min-w-0">
            <EnvironmentMultiSelect />
          </div>

          {/* Weather Module */}
          <div className="lg:w-64 shrink-0">
            <WeatherWidget />
          </div>

        </div>
      </CardContent>
    </Card>
  );
};

export default SchedulerContextBar;