import React, { useState, useMemo, useEffect } from 'react';
import { format, isSameDay, startOfDay, endOfDay, parseISO, addDays, subDays, setHours, setMinutes } from 'date-fns'; // Added setHours, setMinutes
import { Calendar as CalendarIcon, Plus, Settings, ListOrdered, LayoutDashboard, BarChart3, Archive, Sun, Moon, Laptop, ChevronLeft, ChevronRight, RefreshCcw, Zap, Home, Music, Globe, Briefcase, Coffee, Loader2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useSession } from '@/hooks/use-session';
import { useTasks } from '@/hooks/use-tasks';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import { useProfile } from '@/hooks/use-profile'; // Assuming this hook exists
import { useEnergy } from '@/hooks/use-energy'; // Assuming this hook exists
import { useEnvironments } from '@/hooks/use-environments';
import { useTheme } from 'next-themes';
import { TaskPriority, Task } from '@/types'; // Added Task import
import { DBScheduledTask, NewDBScheduledTask, RetiredTask, TaskEnvironment } from '@/types/scheduler';
import { calculateEnergyCost } from '@/lib/scheduler-utils'; // Removed setTimeOnDate
import { DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION } from '@/lib/constants';
import { showSuccess, showError } from '@/utils/toast';
import CreateTaskDialog from '@/components/CreateTaskDialog';
import ScheduledTaskDetailDialog from '@/components/ScheduledTaskDetailDialog';
import TaskDetailSheetForTasks from '@/components/TaskDetailSheetForTasks';
import RetiredTaskDetailDialog from '@/components/RetiredTaskDetailDialog';
import SchedulerDashboardPanel from '@/components/SchedulerDashboardPanel';
import EnvironmentOrderSettings from '@/components/EnvironmentOrderSettings';
import EnvironmentManager from '@/components/EnvironmentManager';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import SinkKanbanBoard from '@/components/SinkKanbanBoard';
import AetherSink from '@/components/AetherSink'; // Assuming AetherSink is imported from here

type GroupingOption = 'environment' | 'priority' | 'status';

const AetherSinkPage: React.FC = () => {
  const { user, isLoading: isLoadingSession } = useSession();
  const { profile, updateProfile } = useProfile();
  const { tasks: generalTasks, isLoading: isLoadingGeneralTasks, addTask, updateTask, deleteTask } = useTasks();
  // Corrected destructuring from useSchedulerTasks to include all necessary functions
  const { dbScheduledTasks, retiredTasks, isLoading: isLoadingScheduledTasks, addScheduledTask, updateScheduledTaskDetails, deleteScheduledTask, completeScheduledTask, rezoneScheduledTask, updateRetiredTask, deleteRetiredTask, rezoneRetiredTask, randomizeBreaks } = useSchedulerTasks(format(new Date(), 'yyyy-MM-dd'));
  const { energy, isLoading: isLoadingEnergy, updateEnergy } = useEnergy();
  const { environments, isLoading: isLoadingEnvironments } = useEnvironments();
  const { theme, setTheme } = useTheme();
  const isMobile = useIsMobile();

  const [selectedDay, setSelectedDay] = useState<Date>(startOfDay(new Date()));
  const [isCreateTaskDialogOpen, setIsCreateTaskDialogOpen] = useState(false);
  const [selectedScheduledTaskForDetail, setSelectedScheduledTaskForDetail] = useState<DBScheduledTask | null>(null);
  const [selectedGeneralTaskForDetail, setSelectedGeneralTaskForDetail] = useState<Task | null>(null); // Corrected type
  const [selectedRetiredTaskForDetail, setSelectedRetiredTaskForDetail] = useState<RetiredTask | null>(null);
  const [groupBy, setGroupBy] = useState<GroupingOption>('environment');
  const [activeTab, setActiveTab] = useState('dashboard');

  const currentDayScheduledTasks = useMemo(() => {
    return dbScheduledTasks.filter(task => isSameDay(parseISO(task.scheduled_date), selectedDay));
  }, [dbScheduledTasks, selectedDay]);

  const currentDayRetiredTasks = useMemo(() => {
    return retiredTasks.filter(task => isSameDay(parseISO(task.original_scheduled_date), selectedDay));
  }, [retiredTasks, selectedDay]);

  const availableEnergy = energy?.current_energy ?? 0;
  const maxEnergy = profile?.max_energy ?? 100;

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDay(startOfDay(date));
    }
  };

  const handlePreviousDay = () => {
    setSelectedDay(prev => subDays(prev, 1));
  };

  const handleNextDay = () => {
    setSelectedDay(prev => addDays(prev, 1));
  };

  const handleToday = () => {
    setSelectedDay(startOfDay(new Date()));
  };

  const handleOpenCreateTaskDialog = (defaultPriority: TaskPriority, defaultDueDate: Date, defaultStartTime?: Date, defaultEndTime?: Date) => {
    setIsCreateTaskDialogOpen(true);
  };

  const handleOpenScheduledTaskDetailDialog = (task: DBScheduledTask) => {
    setSelectedScheduledTaskForDetail(task);
  };

  const handleOpenGeneralTaskDetailSheet = (task: Task) => { // Corrected type
    setSelectedGeneralTaskForDetail(task);
  };

  const handleOpenRetiredTaskDetailDialog = (task: RetiredTask) => {
    setSelectedRetiredTaskForDetail(task);
  };

  const handleCompleteScheduledTask = async (task: DBScheduledTask) => {
    try {
      await completeScheduledTask(task);
      showSuccess(`Task "${task.name}" completed!`);
    } catch (error) {
      showError(`Failed to complete task "${task.name}".`);
      console.error("Error completing task:", error);
    }
  };

  const handleRezoneScheduledTask = async (task: DBScheduledTask) => {
    try {
      await rezoneScheduledTask(task);
      showSuccess(`Task "${task.name}" rezoned to general tasks.`);
    } catch (error) {
      showError(`Failed to rezone task "${task.name}".`);
      console.error("Error rezoning task:", error);
    }
  };

  const handleRemoveScheduledTask = async (taskId: string, taskName: string) => {
    try {
      await deleteScheduledTask(taskId);
      showSuccess(`Task "${taskName}" removed.`);
    } catch (error) {
      showError(`Failed to remove task "${taskName}".`);
      console.error("Error removing task:", error);
    }
  };

  const handleRemoveRetiredTask = async (taskId: string, taskName: string) => {
    try {
      await deleteRetiredTask(taskId);
      showSuccess(`Retired task "${taskName}" permanently deleted.`);
    } catch (error) {
      showError(`Failed to delete retired task "${taskName}".`);
      console.error("Error deleting retired task:", error);
    }
  };

  const handleRezoneRetiredTask = async (task: RetiredTask) => {
    try {
      await rezoneRetiredTask(task);
      showSuccess(`Retired task "${task.name}" rezoned to general tasks.`);
    } catch (error) {
      showError(`Failed to rezone retired task "${task.name}".`);
      console.error("Error rezoning retired task:", error);
    }
  };

  const handleRandomizeBreaks = async () => {
    try {
      // Construct Date objects for workday start/end times
      const workdayStartTime = profile?.workday_start_time ? parseISO(profile.workday_start_time) : setHours(setMinutes(selectedDay, 0), 9);
      const workdayEndTime = profile?.workday_end_time ? parseISO(profile.workday_end_time) : setHours(setMinutes(selectedDay, 0), 17);

      await randomizeBreaks({
        selectedDate: format(selectedDay, 'yyyy-MM-dd'),
        workdayStartTime: workdayStartTime,
        workdayEndTime: workdayEndTime,
        currentDbTasks: currentDayScheduledTasks,
      });
      showSuccess("Breaks randomized for the day!");
    } catch (error) {
      showError("Failed to randomize breaks.");
      console.error("Error randomizing breaks:", error);
    }
  };

  const getEnvironmentIconComponent = (iconName: string) => {
    switch (iconName) {
      case 'Home': return Home;
      case 'Laptop': return Laptop;
      case 'Globe': return Globe;
      case 'Music': return Music;
      case 'Briefcase': return Briefcase;
      case 'Coffee': return Coffee;
      default: return Home;
    }
  };

  if (isLoadingSession || isLoadingGeneralTasks || isLoadingScheduledTasks || isLoadingEnergy || isLoadingEnvironments) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <h1 className="text-3xl font-bold mb-4">Welcome to Aether Sink</h1>
        <p className="text-lg text-muted-foreground mb-8">Please sign in to manage your tasks and energy.</p>
        <Button onClick={() => window.location.href = '/signin'}>Sign In</Button>
      </div>
    );
  }

  const energyPercentage = maxEnergy > 0 ? (availableEnergy / maxEnergy) * 100 : 0;

  return (
    <AetherSink />
  );
};

export default AetherSinkPage;