import { useTasks } from '@/hooks/use-tasks';
import { TaskPriority } from '@/types';
import TemporalFilterTabs from '@/components/TemporalFilterTabs';
import TaskCreationForm from '@/components/TaskCreationForm';
import TaskControlBar from '@/components/TaskControlBar';
import PrioritySection from '@/components/PrioritySection';
import AppFooter from '@/components/AppFooter';
import { Loader2, ClipboardList } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { Card } from '@/components/ui/card';
import LevelUpCelebration from '@/components/LevelUpCelebration';
import { Accordion } from '@/components/ui/accordion';
import DailyChallengeCard from '@/components/DailyChallengeCard';
import React, { useState } from 'react';
import EnergyDeficitConfirmationDialog from '@/components/EnergyDeficitConfirmationDialog';
import { Task } from '@/types';
import { Separator } from '@/components/ui/separator';

const PRIORITY_ORDER: TaskPriority[] = ['HIGH', 'MEDIUM', 'LOW'];

const Dashboard = () => {
  const { isLoading: isSessionLoading, user, profile } = useSession();
  const { tasks, isLoading: isTasksLoading, temporalFilter, setTemporalFilter, statusFilter, setStatusFilter, sortBy, setSortBy, updateTask: updateTaskMutation } = useTasks();
  
  const [showEnergyDeficitConfirmation, setShowEnergyDeficitConfirmation] = useState(false);
  const [taskToCompleteInDeficit, setTaskToCompleteInDeficit] = useState<Task | null>(null);

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

  const handleCompleteTask = async (task: Task) => {
    if (!profile) return;
    
    if (profile.energy < 0) {
      setTaskToCompleteInDeficit(task);
      setShowEnergyDeficitConfirmation(true);
    } else {
      await updateTaskMutation({ id: task.id, is_completed: !task.is_completed });
    }
  };

  const confirmCompleteTaskInDeficit = async () => {
    if (!taskToCompleteInDeficit) return;
    await updateTaskMutation({ id: taskToCompleteInDeficit.id, is_completed: !taskToCompleteInDeficit.is_completed });
    setShowEnergyDeficitConfirmation(false);
    setTaskToCompleteInDeficit(null);
  };

  return (
    <div className="mx-auto max-w-5xl w-full space-y-6 py-4">
      <div className="space-y-6">
        {/* Daily Challenge Card */}
        <DailyChallengeCard />
        
        {/* Input & Controls Layer */}
        <Card className="p-6 space-y-6 animate-slide-in-up animate-hover-lift shadow-lg">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground">Task Management</h2>
            <Separator />
            <TemporalFilterTabs currentFilter={temporalFilter} setFilter={setTemporalFilter} />
            <TaskCreationForm />
            <TaskControlBar 
              statusFilter={statusFilter} 
              setStatusFilter={setStatusFilter} 
              sortBy={sortBy} 
              setSortBy={setSortBy} 
            />
          </div>
        </Card>
        
        {/* Task List Layer (Priority Sections) or Empty State */}
        {hasTasks ? (
          <Accordion type="multiple" className="w-full space-y-4 animate-slide-in-up" defaultValue={PRIORITY_ORDER}>
            {PRIORITY_ORDER.map(priority => (
              <PrioritySection 
                key={priority} 
                priority={priority} 
                tasks={groupedTasks[priority]} 
                onCompleteTask={handleCompleteTask}
              />
            ))}
          </Accordion>
        ) : (
          <Card className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center space-y-6 animate-slide-in-up animate-hover-lift shadow-lg">
            <ClipboardList className="h-16 w-16 text-muted-foreground" />
            <div className="space-y-2">
              <p className="text-2xl font-bold">No tasks found!</p>
              <p className="text-lg">Start by adding a new task above to get organized.</p>
            </div>
          </Card>
        )}
      </div>
      
      <AppFooter />
      <LevelUpCelebration />
      
      {profile && taskToCompleteInDeficit && (
        <EnergyDeficitConfirmationDialog 
          isOpen={showEnergyDeficitConfirmation}
          onOpenChange={(open) => {
            if (!open) {
              setShowEnergyDeficitConfirmation(false);
              setTaskToCompleteInDeficit(null);
            }
          }}
          taskName={taskToCompleteInDeficit.title}
          taskEnergyCost={taskToCompleteInDeficit.energy_cost}
          currentEnergy={profile.energy}
          onConfirm={confirmCompleteTaskInDeficit}
          isProcessingCommand={false}
        />
      )}
    </div>
  );
};

export default Dashboard;