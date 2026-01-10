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
import CreateTaskDialog from '@/components/CreateTaskDialog'; // Corrected import
import ScheduledTaskDetailDialog from '@/components/ScheduledTaskDetailDialog'; // Corrected import
import TaskDetailSheetForTasks from '@/components/TaskDetailSheetForTasks'; // Corrected import
import RetiredTaskDetailDialog from '@/components/RetiredTaskDetailDialog'; // Corrected import
import SchedulerDashboardPanel from '@/components/SchedulerDashboardPanel'; // Corrected import
import EnvironmentOrderSettings from '@/components/EnvironmentOrderSettings'; // Corrected import
import EnvironmentManager from '@/components/EnvironmentManager'; // Corrected import
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
import SinkKanbanBoard from '@/components/SinkKanbanBoard'; // Corrected import
import { supabase } from '@/lib/supabase'; // Assuming supabase client is imported from here

type GroupingOption = 'environment' | 'priority' | 'status';

const AetherSink: React.FC = () => {
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
    <TooltipProvider>
      <div className="flex h-screen bg-background text-foreground">
        {/* Sidebar */}
        <aside className="w-16 flex flex-col items-center py-4 border-r bg-card">
          <div className="mb-8">
            <img src="/logo.svg" alt="Aether Sink Logo" className="h-8 w-8" />
          </div>
          <nav className="flex flex-col space-y-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => setActiveTab('dashboard')} className={cn(activeTab === 'dashboard' && 'bg-accent text-accent-foreground')}>
                  <LayoutDashboard className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Dashboard</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => setActiveTab('tasks')} className={cn(activeTab === 'tasks' && 'bg-accent text-accent-foreground')}>
                  <ListOrdered className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Tasks</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => setActiveTab('analytics')} className={cn(activeTab === 'analytics' && 'bg-accent text-accent-foreground')}>
                  <BarChart3 className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Analytics</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => setActiveTab('settings')} className={cn(activeTab === 'settings' && 'bg-accent text-accent-foreground')}>
                  <Settings className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Settings</TooltipContent>
            </Tooltip>
          </nav>
          <div className="mt-auto flex flex-col space-y-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                  {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Toggle Theme</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => supabase.auth.signOut()}>
                  <LogOut className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign Out</TooltipContent>
            </Tooltip>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="flex items-center justify-between p-4 border-b bg-card">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold">Aether Sink</h1>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="icon" onClick={handlePreviousDay} aria-label="Previous Day">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-[180px] justify-start text-left font-normal",
                        !selectedDay && "text-muted-foreground"
                      )}
                      aria-label="Select Date"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDay ? format(selectedDay, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={selectedDay}
                      onSelect={handleDateSelect}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <Button variant="outline" size="icon" onClick={handleNextDay} aria-label="Next Day">
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={handleToday} aria-label="Today">Today</Button>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Zap className="h-5 w-5 text-logo-yellow" />
                <span className="font-semibold">{availableEnergy} / {maxEnergy}</span>
                <Progress value={energyPercentage} className="w-24 [&>*]:bg-logo-yellow" />
              </div>
              <Button onClick={() => handleOpenCreateTaskDialog('MEDIUM', selectedDay)} aria-label="Add New Task">
                <Plus className="mr-2 h-4 w-4" /> Add Task
              </Button>
            </div>
          </header>

          {/* Content Area */}
          <div className="flex-1 overflow-auto p-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                <TabsTrigger value="tasks">Tasks</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>

              <TabsContent value="dashboard" className="flex-1 overflow-y-auto">
                <SchedulerDashboardPanel
                  selectedDay={selectedDay}
                  scheduledTasks={currentDayScheduledTasks}
                  retiredTasks={currentDayRetiredTasks}
                  generalTasks={generalTasks}
                  availableEnergy={availableEnergy}
                  maxEnergy={maxEnergy}
                  onOpenScheduledTaskDetailDialog={handleOpenScheduledTaskDetailDialog}
                  onOpenGeneralTaskDetailSheet={handleOpenGeneralTaskDetailSheet}
                  onOpenRetiredTaskDetailDialog={handleOpenRetiredTaskDetailDialog}
                  onCompleteScheduledTask={handleCompleteScheduledTask}
                  onRemoveScheduledTask={handleRemoveScheduledTask}
                  onRezoneScheduledTask={handleRezoneScheduledTask}
                  onRandomizeBreaks={handleRandomizeBreaks}
                />
              </TabsContent>

              <TabsContent value="tasks" className="flex-1 overflow-y-auto">
                <SinkKanbanBoard 
                  selectedDay={selectedDay}
                />
              </TabsContent>

              <TabsContent value="settings" className="flex-1 overflow-y-auto">
                <div className="space-y-8 max-w-3xl mx-auto py-8">
                  <Card>
                    <CardHeader>
                      <CardTitle>Environment Order</CardTitle>
                      <CardDescription>
                        Customize the priority of your task environments.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <EnvironmentOrderSettings />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Manage Environments</CardTitle>
                      <CardDescription>
                        Add, edit, or delete your custom task environments.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <EnvironmentManager />
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </main>

        {/* Modals/Dialogs */}
        <CreateTaskDialog
          isOpen={isCreateTaskDialogOpen}
          onOpenChange={setIsCreateTaskDialogOpen}
          defaultPriority="MEDIUM"
          defaultDueDate={selectedDay}
          onTaskCreated={() => {}}
        />

        {selectedScheduledTaskForDetail && (
          <ScheduledTaskDetailDialog
            task={selectedScheduledTaskForDetail}
            open={!!selectedScheduledTaskForDetail}
            onOpenChange={(open) => {
              if (!open) setSelectedScheduledTaskForDetail(null);
            }}
            selectedDayString={format(selectedDay, 'yyyy-MM-dd')}
          />
        )}

        {selectedGeneralTaskForDetail && (
          <TaskDetailSheetForTasks
            task={selectedGeneralTaskForDetail}
            open={!!selectedGeneralTaskForDetail}
            onOpenChange={(open) => {
              if (!open) setSelectedGeneralTaskForDetail(null);
            }}
          />
        )}

        {selectedRetiredTaskForDetail && (
          <RetiredTaskDetailDialog
            task={selectedRetiredTaskForDetail}
            open={!!selectedRetiredTaskForDetail}
            onOpenChange={(open) => {
              if (!open) setSelectedRetiredTaskForDetail(null);
            }}
          />
        )}
      </div>
    </TooltipProvider>
  );
};

export default AetherSink;