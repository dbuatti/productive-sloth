import { useTasks } from '@/hooks/use-tasks';
import { TaskPriority } from '@/types';
import TemporalFilterTabs from '@/components/TemporalFilterTabs';
import TaskCreationForm from '@/components/TaskCreationForm';
import TaskControlBar from '@/components/TaskControlBar';
import PrioritySection from '@/components/PrioritySection';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { Loader2, ClipboardList } from 'lucide-react'; // Import ClipboardList for empty state
import { useSession } from '@/hooks/use-session';
import AppHeader from '@/components/AppHeader';
import ProgressBarHeader from '@/components/ProgressBarHeader';
import { Card, CardContent } from '@/components/ui/card'; // Import Card and CardContent
import { Separator } from '@/components/ui/separator';
import LevelUpCelebration from '@/components/LevelUpCelebration';
import ProgressOverviewCard from '@/components/ProgressOverviewCard';
import { Accordion } from '@/components/ui/accordion'; // Import Accordion

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

  const hasTasks = tasks.length > 0; // Check if there are any tasks

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
      <ProgressBarHeader />
      <main className="container mx-auto p-4 max-w-3xl space-y-6">
        
        {/* User Stats Dashboard */}
        <div className="grid grid-cols-1 gap-4 animate-slide-in-up"> {/* Added animate-slide-in-up */}
          <ProgressOverviewCard />
        </div>

        {/* Input & Controls Layer - Now wrapped in a Card */}
        <Card className="p-4 space-y-4 animate-slide-in-up"> {/* Added animate-slide-in-up */}
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
        </Card>

        {/* Task List Layer (Priority Sections) or Empty State */}
        {hasTasks ? (
          <Accordion type="multiple" className="w-full space-y-4 animate-slide-in-up"> {/* Added animate-slide-in-up */}
            {PRIORITY_ORDER.map(priority => (
              <PrioritySection 
                key={priority}
                priority={priority}
                tasks={groupedTasks[priority]}
              />
            ))}
          </Accordion>
        ) : (
          <Card className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center space-y-4 animate-slide-in-up"> {/* Added animate-slide-in-up */}
            <ClipboardList className="h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-semibold">No tasks found!</p>
            <p>Start by adding a new task above to get organized.</p>
          </Card>
        )}
        
        <MadeWithDyad />
      </main>
      <LevelUpCelebration />
    </>
  );
};

export default Index;