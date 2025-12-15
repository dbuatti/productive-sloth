import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ListTodo, Loader2, ClipboardList, PlusCircle } from 'lucide-react';
import { useTasks } from '@/hooks/use-tasks';
import { TaskStatusFilter, SortBy, Task } from '@/types';
import TaskControlBar from '@/components/TaskControlBar';
import PrioritySection from '@/components/PrioritySection';
import { Accordion } from '@/components/ui/accordion';
import { useSession } from '@/hooks/use-session';
import { showSuccess, showError } from '@/utils/toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import TaskCreationForm from '@/components/TaskCreationForm';

const TasksPage: React.FC = () => {
  const { user, profile, isLoading: isSessionLoading, refreshProfile } = useSession();
  const { tasks, isLoading: isTasksLoading, updateTask, statusFilter, setStatusFilter, sortBy, setSortBy } = useTasks();
  
  const [isProcessingCommand, setIsProcessingCommand] = useState(false);

  const handleCompleteTask = useCallback(async (task: Task) => {
    if (!user || !profile) {
      showError("You must be logged in to complete tasks.");
      return;
    }
    
    setIsProcessingCommand(true);
    try {
      // Toggle completion status
      await updateTask({
        id: task.id,
        is_completed: !task.is_completed,
      });
      
      // If marking as complete, trigger profile refresh to update XP/Energy/Streak
      if (!task.is_completed) {
        await refreshProfile();
        showSuccess(`Task "${task.title}" completed!`);
      } else {
        showSuccess(`Task "${task.title}" marked as incomplete.`);
      }
    } catch (error: any) {
      showError(`Failed to update task status: ${error.message}`);
    } finally {
      setIsProcessingCommand(false);
    }
  }, [user, profile, updateTask, refreshProfile]);

  const groupedTasks = useMemo(() => {
    const groups: Record<string, Task[]> = {
      HIGH: [],
      MEDIUM: [],
      LOW: [],
    };
    tasks.forEach(task => {
      groups[task.priority]?.push(task);
    });
    return groups;
  }, [tasks]);

  if (isSessionLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 text-center text-muted-foreground">
        <h1 className="text-2xl font-bold text-foreground flex items-center justify-center gap-2 animate-slide-in-up">
          <ListTodo className="h-7 w-7 text-primary" /> My Tasks
        </h1>
        <p className="text-base">Please log in to view and manage your tasks.</p>
      </div>
    );
  }

  const hasTasks = tasks.length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-slide-in-up">
      <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
        <ListTodo className="h-7 w-7 text-primary" /> My Tasks
      </h1>

      <TaskCreationForm />

      <TaskControlBar 
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        sortBy={sortBy}
        setSortBy={setSortBy}
      />

      <Card className="animate-pop-in animate-hover-lift">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
            <ClipboardList className="h-5 w-5 text-primary" /> Task Backlog ({tasks.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {isTasksLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : hasTasks ? (
            <Accordion type="multiple" defaultValue={['HIGH', 'MEDIUM', 'LOW']} className="w-full space-y-4">
              {['HIGH', 'MEDIUM', 'LOW'].map(priority => (
                <PrioritySection 
                  key={priority}
                  priority={priority}
                  tasks={groupedTasks[priority as keyof typeof groupedTasks]}
                  onCompleteTask={handleCompleteTask}
                />
              ))}
            </Accordion>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-muted-foreground text-base space-y-3">
              <ClipboardList className="h-10 w-10" />
              <p className="text-lg font-semibold">Your task list is empty!</p>
              <p>Add a new task above to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TasksPage;