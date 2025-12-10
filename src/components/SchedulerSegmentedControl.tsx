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
    { value: 'scheduler', label: 'Schedule', icon: Clock },
    { value: 'recap', label: 'Recap', icon: CheckCircle },
    { value: 'sink', label: 'Sink', icon: Trash2 },
  ];

  return (
    <Tabs value={currentView === 'schedule' ? 'scheduler' : currentView} onValueChange={handleViewChange} className="w-full animate-slide-in-up">
      {/* Increased height (h-14) and padding (p-1.5) for better touch target */}
      <TabsList className="grid w-full grid-cols-3 h-14 p-1.5 bg-muted rounded-lg shadow-lg">
        {viewOptions.map(option => (
          <TabsTrigger 
            key={option.value}
            value={option.value}
            className={cn(
              // Increased height (h-11) and padding (py-1) for larger hit area
              "h-11 px-2 py-1 text-sm font-semibold rounded-md transition-colors duration-200",
              "text-muted-foreground hover:bg-muted/50",
              // Refined active state: use primary color for background and text
              "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md",
              // Mobile: Stack icon and label vertically
              "flex flex-col items-center justify-center gap-0.5 sm:flex-row sm:gap-2 sm:text-base"
            )}
          >
            {/* Increased icon size (h-5 w-5) */}
            <option.icon className="h-5 w-5 sm:h-5 sm:w-5" />
            <span className="text-xs sm:text-base font-medium">{option.label}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
};

export default SchedulerSegmentedControl;