import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Clock, CheckCircle, Trash2 } from 'lucide-react';

interface SchedulerSegmentedControlProps {
  currentView: 'schedule' | 'sink' | 'recap';
}

const SchedulerSegmentedControl: React.FC<SchedulerSegmentedControlProps> = ({ currentView }) => {
  const navigate = useNavigate();

  const handleViewChange = (newView: string) => {
    navigate(`/${newView}`);
  };

  const viewOptions = [
    { value: 'schedule', label: 'Schedule', icon: Clock },
    { value: 'recap', label: 'Recap', icon: CheckCircle },
    { value: 'sink', label: 'Sink', icon: Trash2 },
  ];

  return (
    <Tabs value={currentView} onValueChange={handleViewChange} className="w-full animate-slide-in-up">
      <TabsList className="grid w-full grid-cols-3 h-11 p-1 bg-muted rounded-lg shadow-lg">
        {viewOptions.map(option => (
          <TabsTrigger 
            key={option.value}
            value={option.value}
            className={cn(
              "h-9 px-4 py-2 text-base font-semibold rounded-md transition-colors duration-200",
              "text-muted-foreground hover:bg-muted/50",
              "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md",
              "flex items-center gap-2"
            )}
          >
            <option.icon className="h-5 w-5" />
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
};

export default SchedulerSegmentedControl;