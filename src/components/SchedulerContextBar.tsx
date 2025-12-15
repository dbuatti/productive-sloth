import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { formatDateTime } from '@/lib/scheduler-utils';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import WeatherWidget from './WeatherWidget';
import EnvironmentMultiSelect from './EnvironmentMultiSelect';

interface SchedulerContextBarProps {
  T_current: Date;
}

const SchedulerContextBar: React.FC<SchedulerContextBarProps> = ({ T_current }) => {
  return (
    <Card className="p-4 animate-pop-in border-dashed border-muted-foreground/30 bg-secondary/10 animate-hover-lift">
      <CardContent className="p-0 space-y-3">
        <div className="flex items-center justify-between text-sm text-muted-foreground border-b pb-3 mb-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Current Time: <span className="font-semibold text-foreground">{formatDateTime(T_current)}</span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <EnvironmentMultiSelect />
          </div>
          <div className="sm:col-span-1">
            <WeatherWidget />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SchedulerContextBar;