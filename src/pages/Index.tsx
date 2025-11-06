import { useTasks } from '@/hooks/use-tasks';
import { TaskPriority } from '@/types';
import TemporalFilterTabs from '@/components/TemporalFilterTabs';
import TaskCreationForm from '@/components/TaskCreationForm';
import TaskControlBar from '@/components/TaskControlBar';
import PrioritySection from '@/components/PrioritySection';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { Loader2 } from 'lucide-react';
import { useSession } from '@/hooks/use-session';

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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user) {
    // Should be handled by SessionProvider redirecting to /login, but good fallback
    return null; 
  }

  return (
    <div className="container mx-auto p-4 max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold text-center mb-4">Daily Task Manager</h1>
      
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

      {/* 4. Priority Sections */}
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
    </div>
  );
};

export default Index;