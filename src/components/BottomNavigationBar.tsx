import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sparkles, Trash2, Plus, CheckCircle, Coffee, ListTodo, Loader2, Clock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import { useSession } from '@/hooks/use-session';
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
  { to: "/sink", icon: Trash2, label: "Sink", matchPath: '/sink' },
  { to: "/recap", icon: CheckCircle, label: "Recap", matchPath: '/recap' },
  { to: "/analytics", icon: Sparkles, label: "Stats", matchPath: '/analytics' },
];

const BottomNavigationBar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { addScheduledTask } = useSchedulerTasks('');
  const { triggerEnergyRegen } = useSession();
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
      
      // NEW: Trigger energy regen immediately upon starting a break
      await triggerEnergyRegen();
      
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
    // Navigate to the scheduler where the TaskCreationForm is located
    navigate('/scheduler');
    showError("Use the Quick Add bar on the Schedule view to create a new task.");
  };

  const renderNavItem = (item: NavItem) => {
    const isActive = location.pathname.startsWith(item.matchPath);
    
    return (
      <NavLink
        key={item.to}
        to={item.to}
        className={({ isActive: isCurrentActive }) =>
          cn(
            "flex flex-col items-center justify-center h-full w-full text-sm font-medium transition-colors duration-200 relative",
            (isCurrentActive || location.pathname.startsWith(item.matchPath)) ? "text-primary" : "text-muted-foreground hover:text-foreground",
            // Active state visual indicator (small bar above icon)
            (isCurrentActive || location.pathname.startsWith(item.matchPath)) && "after:content-[''] after:absolute after:top-0 after:h-0.5 after:w-1/2 after:bg-primary after:rounded-b-full"
          )
        }
      >
        <item.icon className="h-6 w-6 mb-0.5" />
        <span className="text-xs font-semibold">{item.label}</span>
      </NavLink>
    );
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 h-16 bg-card border-t border-border shadow-2xl lg:hidden animate-slide-in-up">
      {/* Use a 5-column grid: Nav1 | Nav2 | FAB | Nav3 | Nav4 */}
      <div className="grid grid-cols-5 items-center h-full max-w-md mx-auto">
        
        {/* Nav Item 1: Schedule */}
        <div className="col-span-1 flex items-center justify-center h-full">
            {renderNavItem(navItems[0])}
        </div>

        {/* Nav Item 2: Sink */}
        <div className="col-span-1 flex items-center justify-center h-full">
            {renderNavItem(navItems[1])}
        </div>

        {/* Central FAB/Action Menu */}
        <div className="col-span-1 flex items-center justify-center h-full relative">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="default"
                size="icon"
                disabled={isProcessingCommand}
                className={cn(
                  // FAB is now larger and slightly overlaps the top edge
                  "relative -top-4 h-16 w-16 rounded-full shadow-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 border-4 border-card",
                  isProcessingCommand && "opacity-70 cursor-not-allowed"
                )}
              >
                {isProcessingCommand ? <Loader2 className="h-7 w-7 animate-spin" /> : <Plus className="h-7 w-7" />}
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
        </div>

        {/* Nav Item 3: Recap */}
        <div className="col-span-1 flex items-center justify-center h-full">
            {renderNavItem(navItems[2])}
        </div>
        
        {/* Nav Item 4: Stats */}
        <div className="col-span-1 flex items-center justify-center h-full">
            {renderNavItem(navItems[3])}
        </div>
      </div>
    </div>
  );
};

export default BottomNavigationBar;