import React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, Trash2, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface SchedulerSegmentedControlProps {
  currentView: 'schedule' | 'sink' | 'recap';
}

const SchedulerSegmentedControl: React.FC<SchedulerSegmentedControlProps> = ({ currentView }) => {
  const navigate = useNavigate();

  const handleValueChange = (value: string) => {
    navigate(`/${value}`);
  };

  const views = [
    { value: 'scheduler', label: 'Vibe Schedule', icon: Clock },
    { value: 'sink', label: 'Aether Sink', icon: Trash2 },
    { value: 'recap', label: 'Daily Recap', icon: CheckCircle },
  ];

  return (
    <Tabs value={currentView} onValueChange={handleValueChange} className="w-full animate-slide-in-up">
      <TabsList className="grid w-full grid-cols-3 h-12 p-1 bg-secondary rounded-lg shadow-lg">
        {views.map(view => (
          <TabsTrigger 
            key={view.value}
            value={view.value}
            className={cn(
              "h-10 px-4 py-2 text-base font-semibold rounded-md transition-all duration-200 flex items-center gap-2",
              "text-muted-foreground hover:bg-muted/50",
              "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md",
              "animate-hover-lift"
            )}
          >
            <view.icon className="h-5 w-5" />
            {view.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
};

export default SchedulerSegmentedControl;