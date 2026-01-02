import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Zap, Shuffle, ChevronsUp, RefreshCcw, Globe, Settings2, ArrowDownWideNarrow, Clock, Star, Database, Trash, CheckCircle, Archive, Lock, Unlock, Coffee, BatteryCharging, Plus, AlignLeft, ArrowLeft, TrendingUp, BookOpen, Flame, Gamepad2, LogOut, Save, CalendarCheck, Feather, Anchor, ListTodo, Utensils, Trash2, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

// Helper component to render a button replica with description
interface ButtonReplicaProps {
  icon: React.ElementType;
  label: string;
  description: string;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | null | undefined;
  className?: string;
  iconClassName?: string;
  size?: 'default' | 'sm' | 'lg' | 'icon' | null | undefined;
  children?: React.ReactNode;
}

const ButtonReplica: React.FC<ButtonReplicaProps> = ({ icon: Icon, label, description, variant = 'outline', className, iconClassName, size = 'icon', children }) => (
  <div className="flex flex-col items-center space-y-2 p-4 border rounded-lg bg-card/50 shadow-sm animate-pop-in">
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant={variant} size={size} className={cn("h-10 w-10", className)}>
          <Icon className={cn("h-5 w-5", iconClassName)} />
          <span className="sr-only">{label}</span>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
    <p className="text-center text-sm font-medium text-foreground">{label}</p>
    <p className="text-center text-xs text-muted-foreground">{description}</p>
  </div>
);

// Explicitly define the type of the buttons array to prevent type widening of 'variant'
const buttons: ButtonReplicaProps[] = [
    // --- Primary Scheduler Actions ---
    { icon: CalendarCheck, label: "Auto Schedule Day", description: "Automatically re-balance and schedule all flexible tasks from the sink and current day.", variant: 'default', className: "bg-logo-green text-primary-foreground h-14 w-full", size: 'default', children: <Star className="h-6 w-6 text-logo-yellow ml-2" /> },
    { icon: Feather, label: "Quick Block (Shortest)", description: "Schedule a block of time (e.g., 15 min), prioritizing the shortest tasks from the Aether Sink.", variant: 'ghost', className: "h-10 w-10 text-primary hover:bg-primary/10" },
    { icon: Anchor, label: "Quick Block (Longest)", description: "Schedule a block of time (e.g., 15 min), prioritizing the longest tasks from the Aether Sink.", variant: 'ghost', className: "h-10 w-10 text-primary hover:bg-primary/10" },
    { icon: ChevronsUp, label: "Compact Schedule", description: "Rearrange unlocked flexible tasks to fill gaps and minimize free time.", variant: 'outline', className: "h-10 w-10 text-primary" },
    { icon: Shuffle, label: "Randomize Breaks", description: "Randomly reposition unlocked break tasks within the schedule.", variant: 'outline', className: "h-10 w-10 text-logo-orange" },
    { icon: Star, label: "Zone Focus", description: "Auto-schedule tasks filtered by selected environments (re-balances schedule).", variant: 'outline', className: "h-10 w-10 text-accent" },
    
    // --- Energy & Utility Actions ---
    { icon: Zap, label: "Recharge Energy", description: "Manually recharge +25 Energy.", variant: 'outline', className: "h-10 w-10 text-logo-green" },
    { icon: Coffee, label: "Quick Break", description: "Schedule a fixed, locked 15-minute break immediately (triggers energy regen).", variant: 'outline', className: "h-10 w-10 text-logo-orange" },
    { icon: BatteryCharging, label: "Regen Pod", description: "Start a dynamic duration recovery session (max 60 min).", variant: 'outline', className: "h-10 w-10 text-primary" },
    { icon: Clock, label: "Workday Window", description: "Adjust default auto-schedule start and end times.", variant: 'outline', className: "h-10 w-10 text-muted-foreground" },
    { icon: ArrowDownWideNarrow, label: "Sort Flexible Tasks", description: "Dropdown to select sorting criteria for flexible tasks (triggers re-balance).", variant: 'outline', className: "h-10 w-10 text-muted-foreground" },
    { icon: Database, label: "Refresh Data", description: "Force refresh all schedule data from the database.", variant: 'outline', className: "h-10 w-10 text-muted-foreground" },
    
    // --- Aether Dump Actions ---
    { icon: RefreshCcw, label: "Aether Dump (Day)", description: "Move all flexible, unlocked tasks from the current day's schedule to the Aether Sink.", variant: 'outline', className: "h-10 w-10 text-destructive" },
    { icon: Globe, label: "Aether Dump Mega", description: "Move all flexible, unlocked tasks from all days to the Aether Sink.", variant: 'outline', className: "h-10 w-10 text-destructive" },
    
    // --- Task Management Actions ---
    { icon: Plus, label: "Quick Add Task", description: "Submit quick task input from the scheduler bar.", variant: 'default', className: "h-11 w-11" },
    { icon: AlignLeft, label: "Detailed Injector", description: "Open dialog to inject a task with specific details (duration, time, criticality).", variant: 'outline', className: "h-11 w-11 text-primary" },
    
    // --- Scheduled Task Controls ---
    { icon: CheckCircle, label: "Complete Task", description: "Mark a scheduled task as complete (earns XP/costs Energy).", variant: 'ghost', className: "h-6 w-6 p-0 text-logo-green" },
    { icon: Archive, label: "Retire Task", description: "Move a scheduled task to the Aether Sink.", variant: 'ghost', className: "h-6 w-6 p-0 text-muted-foreground hover:bg-muted/10" },
    { icon: Trash, label: "Remove Task", description: "Permanently delete a scheduled task from the database.", variant: 'ghost', className: "h-6 w-6 p-0 text-destructive hover:bg-destructive/10" },
    { icon: Lock, label: "Lock Task", description: "Prevent scheduler from moving/removing task.", variant: 'ghost', className: "h-6 w-6 p-0 text-primary hover:bg-primary/10" },
    { icon: Unlock, label: "Unlock Task", description: "Allow scheduler to move/remove task.", variant: 'ghost', className: "h-6 w-6 p-0 text-muted-foreground hover:bg-muted/10" },
    
    // --- Aether Sink Controls ---
    { icon: RotateCcw, label: "Rezone Task", description: "Move a retired task back to the schedule (attempts to place it in the next available slot).", variant: 'secondary', className: "h-8 w-8 text-primary" },
    { icon: Trash2, label: "Delete Retired Task", description: "Permanently delete a retired task from the Aether Sink.", variant: 'ghost', className: "h-8 w-8 text-destructive hover:bg-destructive/10" },
    { icon: Database, label: "Backup Sink Now", description: "Create an immediate snapshot backup of the Aether Sink.", variant: 'outline', className: "h-9 w-9 text-primary" },
    
    // --- Settings & Navigation ---
    { icon: ArrowLeft, label: "Back to Schedule", description: "Navigate back to the main scheduler view.", variant: 'outline', className: "h-10 w-24", size: 'default' },
    { icon: TrendingUp, label: "Analytics & Progress", description: "Navigate to the Analytics page.", variant: 'outline', className: "h-12 w-full", size: 'default' },
    { icon: BookOpen, label: "App Documentation", description: "Navigate to the Documentation page.", variant: 'outline', className: "h-12 w-full", size: 'default' },
    { icon: Settings2, label: "Settings", description: "Open the Settings page.", variant: 'outline', className: "h-10 w-10" },
    { icon: LogOut, label: "Sign Out", description: "Log out of the application.", variant: 'outline', className: "h-10 w-10 text-destructive" },
    { icon: Save, label: "Save Changes", description: "Save profile or form changes.", variant: 'default', className: "h-10 w-24", size: 'default' },
    { icon: Flame, label: "Reset Daily Streak", description: "Reset your daily streak to zero.", variant: 'destructive', className: "h-10 w-24", size: 'default' },
    { icon: Gamepad2, label: "Reset Game Progress", description: "Reset all XP, Level, Energy, and delete all tasks.", variant: 'destructive', className: "h-10 w-24", size: 'default' },
];

const ModelPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-8 animate-slide-in-up">
      <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
        <BookOpen className="h-9 w-9 text-primary" /> App Model & Reference
      </h1>
      <p className="text-base text-muted-foreground">
        A visual guide to all interactive elements and core concepts within AetherFlow.
      </p>

      {/* Section 1: Button Replicas */}
      <div className="p-4 bg-card rounded-xl shadow-sm animate-hover-lift"> {/* Replaced Card with div, adjusted styling */}
        <h2 className="text-xl font-bold flex items-center gap-2 text-primary px-0 pb-4"> {/* Replaced CardHeader/CardTitle with h2, adjusted padding */}
          <ListTodo className="h-6 w-6" /> All Button Replicas
        </h2>
        <div className="p-0"> {/* Replaced CardContent with div */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {buttons.map((btn, index) => (
              <ButtonReplica key={index} {...btn} />
            ))}
          </div>
        </div>
      </div>

      {/* Section 2: Active Task Explanation */}
      <div className="p-4 bg-card rounded-xl shadow-sm animate-hover-lift"> {/* Replaced Card with div, adjusted styling */}
        <h2 className="text-xl font-bold flex items-center gap-2 text-primary px-0 pb-4"> {/* Replaced CardHeader/CardTitle with h2, adjusted padding */}
          <Zap className="h-6 w-6 text-logo-yellow" /> Active Task / Now Focus
        </h2>
        <div className="p-0 space-y-4 text-muted-foreground"> {/* Replaced CardContent with div, adjusted padding */}
          <p>
            The <strong>Active Task</strong> (or <strong>Now Focus</strong>) is the scheduled item whose time slot currently overlaps with the system's current time (<code className="font-mono">T_current</code>). This is the task you should be focusing on right now.
          </p>
          <ul className="list-disc list-inside space-y-2">
            <li>
              <strong>Dynamic Tracking:</strong> The system constantly checks the schedule to identify the active task. If you complete a task early, the next scheduled item immediately becomes the new active task.
            </li>
            <li>
              <strong>Focus Mode:</strong> Clicking the Active Task card (or the floating anchor on desktop) enters <strong>Immersive Focus Mode</strong>, which maximizes the task view and provides dedicated controls for completion, skipping, or taking an early break.
            </li>
            <li>
              <strong>Energy & Breaks:</strong> If the active item is a <span className="font-semibold text-logo-orange">Break</span> (<Coffee className="h-4 w-4 inline align-text-bottom" />) or <span className="font-semibold text-logo-green">Meal</span> (<Utensils className="h-4 w-4 inline align-text-bottom" />), the system automatically applies energy regeneration boosts during that time.
            </li>
            <li>
              <strong>Completion:</strong> Completing a task triggers XP gain and energy cost calculation. If the task is flexible, the schedule is immediately compacted to fill the gap.
            </li>
          </ul>
        </div>
      </div>

      {/* Section 3: Vibe Schedule Explanation */}
      <div className="p-4 bg-card rounded-xl shadow-sm animate-hover-lift"> {/* Replaced Card with div, adjusted styling */}
        <h2 className="text-xl font-bold flex items-center gap-2 text-primary px-0 pb-4"> {/* Replaced CardHeader/CardTitle with h2, adjusted padding */}
          <Clock className="h-6 w-6 text-primary" /> Vibe Schedule
        </h2>
        <div className="p-0 space-y-4 text-muted-foreground"> {/* Replaced CardContent with div, adjusted padding */}
          <p>
            The <strong>Vibe Schedule</strong> is the core time management tool, dynamically organizing your day based on fixed appointments, flexible tasks, and available time slots within your defined Workday Window. It aims to keep you in a state of "flow" by presenting a clear, prioritized timeline.
          </p>
          <ul className="list-disc list-inside space-y-2">
            <li>
              <strong>Fixed Tasks:</strong> Tasks with specific start and end times (e.g., meetings, appointments, or tasks marked <code className="font-mono">fixed</code>). These tasks cannot be moved by the scheduler.
            </li>
            <li>
              <strong>Flexible Tasks:</strong> Tasks with a duration that the scheduler can automatically place into free time slots using commands like <code className="font-mono">Auto Schedule</code> or <code className="font-mono">Compact</code>.
            </li>
            <li>
              <strong>Time Blocks:</strong> The schedule is built from discrete time blocks. The scheduler identifies <span className="font-semibold text-primary">Occupied Blocks</span> (tasks, breaks, time off) and <span className="font-semibold text-logo-green">Free Time Blocks</span> (gaps between occupied blocks). Clicking a Free Time Block allows you to inject a task directly into that slot.
            </li>
            <li>
              <strong>Aether Sink Integration:</strong> Tasks that cannot be placed, are skipped, or are manually retired are sent to the <strong>Aether Sink</strong> (<Trash2 className="h-4 w-4 inline align-text-bottom" />), a holding area from which they can be re-zoned back into the schedule.
            </li>
            <li>
              <strong>Dynamic Placement:</strong> When adding a new duration-based task, the system automatically finds the next available slot after the current time (<code className="font-mono">T_current</code>) or the Workday Start time.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ModelPage;