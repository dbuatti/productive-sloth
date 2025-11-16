import React from 'react';
import { useTasks } from '@/hooks/use-tasks';
import { TaskPriority } from '@/types';
import TemporalFilterTabs from '@/components/TemporalFilterTabs';
import TaskCreationForm from '@/components/TaskCreationForm';
import TaskControlBar from '@/components/TaskControlBar';
import PrioritySection from '@/components/PrioritySection';
import { Loader2, ClipboardList } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { Card } from '@/components/ui/card';
import { Accordion } from '@/components/ui/accordion';

const PRIORITY_ORDER: TaskPriority[] = ['HIGH', 'MEDIUM', 'LOW'];

const TasksPage: React.FC = () => {
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

  const hasTasks = tasks.length > 0;

  if (isSessionLoading || isTasksLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user) {
    return null; 
  }

  return (
    <div className="container mx-auto p-4 max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold text-foreground animate-slide-in-up">My Tasks</h1>

      <Card className="p-4 space-y-4 animate-slide-in-up animate-hover-lift">
        <TemporalFilterTabs 
          currentFilter={temporalFilter} 
          setFilter={setTemporalFilter} 
        />
        <TaskCreationForm />
        <TaskControlBar 
          statusFilter={statusFilter} 
          setStatusFilter={setStatusFilter} 
          sortBy={sortBy} 
          setSortBy={setSortBy}
        />
      </Card>

      {hasTasks ? (
        <Accordion 
          type="multiple" 
          className="w-full space-y-4 animate-slide-in-up"
          defaultValue={PRIORITY_ORDER}
        >
          {PRIORITY_ORDER.map(priority => (
            <PrioritySection 
              key={priority}
              priority={priority}
              tasks={groupedTasks[priority]}
            />
          ))}
        </Accordion>
      ) : (
        <Card className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center space-y-4 animate-slide-in-up animate-hover-lift">
          <ClipboardList className="h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-semibold">No tasks found!</p>
          <p>Start by adding a new task above to get organized.</p>
        </Card>
      )}
    </div>
  );
};

export default TasksPage;