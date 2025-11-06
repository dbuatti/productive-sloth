import { useTasks } from '@/hooks/use-tasks';
import { TaskPriority } from '@/types';
import TemporalFilterTabs from '@/components/TemporalFilterTabs';
import TaskCreationForm from '@/components/TaskCreationForm';
import TaskControlBar from '@/components/TaskControlBar';
import PrioritySection from '@/components/PrioritySection';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { Loader2 } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import AppHeader from '@/components/AppHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import UserXPCard from '@/components/UserXPCard';
import DailyStreakCard from '@/components/DailyStreakCard';
import UserEnergyCard from '@/components/UserEnergyCard';
import LevelUpCelebration from '@/components/LevelUpCelebration';
import DailyRewardCard from '@/components/DailyRewardCard';
import DailySummaryCard from '@/components/DailySummaryCard'; // Import DailySummaryCard

const PRIORITY_ORDER: TaskPriority[] = ['HIGH', 'MEDIUM', 'LOW'];

const Index = () => {
  const { isLoading: isSessionLoading, user } = useSession();
  const { 
    tasks, 
    isLoading: isTasksLoading, 
    temporalFilter, 
    setTemporalFilter, 
    statusFilter, 
    setStatusFilter, 
    sortBy, 
    setSortBy 
  } = useTasks();

  const groupedTasks = PRIORITY_ORDER.reduce((acc, priority) => {
    acc[priority] = tasks.filter(task => task.priority === priority);
    return acc;
  }, {} as Record<TaskPriority, typeof tasks>);

  if (isSessionLoading || isTasksLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user) {
    return null; 
  }

  return (
    <>
      <AppHeader />
      <main className="container mx-auto p-4 max-w-3xl space-y-6">
        
        {/* User Stats Cards - More balanced grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"> {/* Adjusted grid for 4 cards */}
          <UserXPCard />
          <DailyStreakCard />
          <UserEnergyCard />
          <DailyRewardCard />
          <DailySummaryCard /> {/* Added DailySummaryCard */}
        </div>

        {/* Input & Controls Layer - Slightly more prominent card */}
        <Card className="p-5 space-y-5 shadow-lg">
          {/* 1. Temporal Filter Tabs */}
          <TemporalFilterTabs 
            currentFilter={temporalFilter} 
            setFilter={setTemporalFilter} 
          />

          <Separator />

          {/* 2. Task Creation Component */}
          <TaskCreationForm />

          <Separator />

          {/* 3. Control Bar */}
          <TaskControlBar 
            statusFilter={statusFilter} 
            setStatusFilter={setStatusFilter} 
            sortBy={sortBy} 
            setSortBy={setSortBy}
          />
        </Card>

        {/* Task List Layer (Priority Sections) */}
        <div className="space-y-4">
          {PRIORITY_ORDER.map(priority => (
            <PrioritySection 
              key={priority}
              priority={priority}
              tasks={groupedTasks[priority]}
            />
          ))}
        </div>
        
        <MadeWithDyad />
      </main>
      <LevelUpCelebration />
    </>
  );
};

export default Index;