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
import ProgressBarHeader from '@/components/ProgressBarHeader'; // Import new component
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import LevelUpCelebration from '@/components/LevelUpCelebration';
import DailyChallengeCard from '@/components/DailyChallengeCard';
import ProgressOverviewCard from '@/components/ProgressOverviewCard';

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
      <ProgressBarHeader /> {/* Render the new progress bar header */}
      <main className="container mx-auto p-4 max-w-3xl space-y-6">
        
        {/* User Stats Dashboard - More balanced and less dense grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left Column: Progress Overview (larger, more detailed) */}
          <ProgressOverviewCard />

          {/* Right Column: Daily Challenge (prominent) */}
          <div className="grid grid-cols-1 gap-4">
            <DailyChallengeCard />
          </div>
        </div>

        {/* Input & Controls Layer - No outer card, rely on main container spacing */}
        <div className="space-y-4"> {/* Reduced space-y here to make this section feel more cohesive */}
          {/* 1. Temporal Filter Tabs */}
          <TemporalFilterTabs 
            currentFilter={temporalFilter} 
            setFilter={setTemporalFilter} 
          />

          {/* 2. Task Creation Component */}
          <TaskCreationForm />

          {/* 3. Control Bar */}
          <TaskControlBar 
            statusFilter={statusFilter} 
            setStatusFilter={setStatusFilter} 
            sortBy={sortBy} 
            setSortBy={setSortBy}
          />
        </div>

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