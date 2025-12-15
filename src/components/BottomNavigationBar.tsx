import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sparkles, Trash2, Plus, CheckCircle, Coffee, ListTodo, Loader2, Clock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import { showError } from '@/utils/toast';
import { addMinutes, format } from 'date-fns';

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  matchPath: string;
}

const navItems: NavItem[] = [
  { to: "/scheduler", icon: Clock, label: "Schedule", matchPath: '/scheduler' },
];

const BottomNavigationBar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { addScheduledTask } = useSchedulerTasks('');
  const [isProcessingCommand, setIsProcessingCommand] = useState(false);

  const handleQuickBreak = async () => {
    setIsProcessingCommand(true);
    try {
      // Logic to add a 15-minute break now (similar to scheduler command 'break 15')
      const now = new Date();
      const breakDuration = 15;
      const breakStartTime = now;
      const breakEndTime = addMinutes(now, breakDuration);
      const scheduledDate = format(now, 'yyyy-MM-dd');

      await addScheduledTask({
        name: 'Quick Break',
        start_time: breakStartTime.toISOString(),
        end_time: breakEndTime.toISOString(),
        break_duration: breakDuration,
        scheduled_date: scheduledDate,
        is_critical: false,
        is_flexible: false, // Quick breaks are fixed/locked for immediate use
        is_locked: true,
        energy_cost: 0,
        is_custom_energy_cost: false,
        task_environment: 'away', // Default environment for breaks
      });
      
      // Navigate to scheduler to see the break
      if (location.pathname !== '/scheduler') {
        navigate('/scheduler');
      }
      
      showError("Quick Break added! Time to recharge. ☕️");
    } catch (error: any) {
      showError(`Failed to add quick break: ${error.message}`);
    } finally {
      setIsProcessingCommand(false);
    }
  };

  const handleQuickAddTask = () => {
    // Navigate to the dashboard where the TaskCreationForm is located
    navigate('/');
    showError("Use the Quick Add bar on the Dashboard to create a new task.");
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 h-16 bg-card border-t border-border shadow-2xl lg:hidden animate-slide-in-up">
      <div className="flex justify-around items-center h-full max-w-md mx-auto">
        
        {/* Left Nav Items (Only Schedule remains) */}
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center h-full w-1/4 text-xs font-medium transition-colors duration-200",
                (isActive || location.pathname.startsWith(item.matchPath)) ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )
            }
          >
            <item.icon className="h-6 w-6 mb-0.5" />
            {item.label}
          </NavLink>
        ))}

        {/* Central FAB/Action Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="default"
              size="icon"
              disabled={isProcessingCommand}
              className={cn(
                "relative -top-4 h-14 w-14 rounded-full shadow-xl bg-primary hover:bg-primary/90 transition-all duration-200",
                isProcessingCommand && "opacity-70 cursor-not-allowed"
              )}
            >
              {isProcessingCommand ? <Loader2 className="h-6 w-6 animate-spin" /> : <Plus className="h-6 w-6" />}
              <span className="sr-only">New Action</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" side="top" className="w-48 p-1 mb-4">
            <DropdownMenuItem onClick={handleQuickBreak} className="cursor-pointer flex items-center gap-2 text-logo-orange">
              <Coffee className="h-4 w-4" /> Quick Break (15 min)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleQuickAddTask} className="cursor-pointer flex items-center gap-2 text-primary">
              <ListTodo className="h-4 w-4" /> Add New Task
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Right Nav Items (Empty) */}
        <div className="w-1/4 h-full" />
      </div>
    </div>
  );
};

export default BottomNavigationBar;