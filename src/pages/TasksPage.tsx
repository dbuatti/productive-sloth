import React from 'react';
import { TemporalFilterTabs } from '@/components/TemporalFilterTabs';
import TaskCreationForm from '@/components/TaskCreationForm';
import TaskControlBar from '@/components/TaskControlBar';
import { Loader2, ClipboardList } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { Card } from '@/components/ui/card';
import { Accordion } from '@/components/ui/accordion';

const TasksPage: React.FC = () => {
  const { isLoading: isSessionLoading, user } = useSession();

  if (isSessionLoading) {
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
    <div className="container mx-auto p-4 max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold text-foreground animate-slide-in-up">My Tasks</h1>

      <Card className="p-4 space-y-4 animate-slide-in-up animate-hover-lift">
        <TemporalFilterTabs currentFilter="TODAY" setFilter={() => {}} />
        <TaskCreationForm />
        <TaskControlBar 
          statusFilter="ALL" 
          setStatusFilter={() => {}}
          sortBy="PRIORITY_HIGH_TO_LOW" 
          setSortBy={() => {}}
        />
      </Card>

      <Card className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center space-y-4 animate-slide-in-up animate-hover-lift">
        <ClipboardList className="h-12 w-12 text-muted-foreground" />
        <p className="text-base font-semibold">No tasks found!</p>
        <p>Start by adding a new task above to get organized.</p>
      </Card>
    </div>
  );
};

export default TasksPage;