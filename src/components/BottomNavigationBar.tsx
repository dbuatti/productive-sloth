import React from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle, Coffee, ListTodo, Archive, CalendarDays, Zap } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import { format, addMinutes } from 'date-fns';
import { showSuccess, showError } from '@/utils/toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useLocation, useNavigate } from 'react-router-dom';
import { useEnvironmentContext } from '@/hooks/use-environment-context';

interface BottomNavigationBarProps {
  onViewChange: (view: 'schedule' | 'sink' | 'recap') => void;
  currentView: 'schedule' | 'sink' | 'recap';
  onAddTaskClick: () => void;
}

const BottomNavigationBar: React.FC<BottomNavigationBarProps> = ({ onViewChange, currentView, onAddTaskClick }) => {
  const { user, T_current, profile } = useSession();
  const { addScheduledTask } = useSchedulerTasks(format(T_current, 'yyyy-MM-dd'), React.useRef(null));
  const { selectedEnvironments } = useEnvironmentContext();
  const environmentForPlacement = selectedEnvironments[0] || 'laptop';
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();

  const handleQuickBreak = async () => {
    if (!user || !profile) {
      showError("Please log in to add a quick break.");
      return;
    }
    try {
      const breakDuration = 15;
      const breakStartTime = T_current;
      const breakEndTime = addMinutes(breakStartTime, breakDuration);
      const scheduledDate = format(T_current, 'yyyy-MM-dd');

      await addScheduledTask({
        user_id: user.id, // Added
        name: 'Quick Break',
        start_time: breakStartTime.toISOString(),
        end_time: breakEndTime.toISOString(),
        break_duration: breakDuration,
        scheduled_date: scheduledDate,
        is_critical: false,
        is_flexible: false,
        is_locked: true,
        energy_cost: 0,
        is_custom_energy_cost: false,
        task_environment: environmentForPlacement,
        is_backburner: false, // Added
      });
      showSuccess("Scheduled a 15-minute Quick Break!");
    } catch (error: any) {
      showError(`Failed to add quick break: ${error.message}`);
      console.error("Quick break error:", error);
    }
  };

  const handleViewChange = (view: 'schedule' | 'sink' | 'recap') => {
    onViewChange(view);
    navigate(location.pathname, { replace: true, state: { view } });
  };

  if (!isMobile) {
    return null; // Render nothing on desktop
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-2 flex justify-around items-center z-40 shadow-lg">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => handleViewChange('schedule')}
        className={cn(currentView === 'schedule' ? 'text-primary' : 'text-muted-foreground')}
      >
        <CalendarDays className="h-6 w-6" />
        <span className="sr-only">Schedule</span>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => handleViewChange('sink')}
        className={cn(currentView === 'sink' ? 'text-primary' : 'text-muted-foreground')}
      >
        <Archive className="h-6 w-6" />
        <span className="sr-only">Aether Sink</span>
      </Button>
      <Button
        variant="default"
        size="icon"
        className="h-12 w-12 rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 -mt-8"
        onClick={onAddTaskClick}
      >
        <PlusCircle className="h-7 w-7" />
        <span className="sr-only">Add Task</span>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleQuickBreak}
        className="text-muted-foreground"
      >
        <Coffee className="h-6 w-6" />
        <span className="sr-only">Quick Break</span>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => handleViewChange('recap')}
        className={cn(currentView === 'recap' ? 'text-primary' : 'text-muted-foreground')}
      >
        <ListTodo className="h-6 w-6" />
        <span className="sr-only">Recap</span>
      </Button>
    </div>
  );
};

export default BottomNavigationBar;