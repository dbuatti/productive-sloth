import { useTasks } from '@/hooks/use-tasks';
import { TaskPriority } from '@/types';
import TemporalFilterTabs from '@/components/TemporalFilterTabs';
import TaskCreationForm from '@/components/TaskCreationForm';
import TaskControlBar from '@/components/TaskControlBar';
import PrioritySection from '@/components/PrioritySection';
import AppFooter from '@/components/AppFooter'; // UPDATED: Import AppFooter
import { Loader2, ClipboardList } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { Card } from '@/components/ui/card';
import LevelUpCelebration from '@/components/LevelUpCelebration';
import { Accordion } from '@/components/ui/accordion';
import DailyChallengeCard from '@/components/DailyChallengeCard';
import React, { useState } from 'react'; // Added useState
import EnergyDeficitConfirmationDialog from '@/components/EnergyDeficitConfirmationDialog'; // NEW: Import EnergyDeficitConfirmationDialog
import { Task } from '@/types'; // Import Task type

const PRIORITY_ORDER: TaskPriority[] = ['HIGH', 'MEDIUM', 'LOW'];

const Dashboard = () => {
  const { isLoading: isSessionLoading, user, profile } = useSession(); // NEW: Get profile
  const { 
    tasks, 
    isLoading: isTasksLoading, 
    temporalFilter, 
    setTemporalFilter, 
    statusFilter, 
    setStatusFilter, 
    sortBy, 
    setSortBy,
    updateTask: updateTaskMutation // NEW: Get updateTask mutation
  } = useTasks();

  // NEW: State for energy deficit confirmation
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

  // NEW: Function to handle task completion, with deficit check
  const handleCompleteTask = async (task: Task) => {
    if (!profile) return;

    if (profile.energy < 0) {
      setTaskToCompleteInDeficit(task);
      setShowEnergyDeficitConfirmation(true);
    } else {
      await updateTaskMutation({ id: task.id, is_completed: !task.is_completed });
    }
  };

  // NEW: Function to confirm completion in deficit
  const confirmCompleteTaskInDeficit = async () => {
    if (!taskToCompleteInDeficit) return;
    await updateTaskMutation({ id: taskToCompleteInDeficit.id, is_completed: !taskToCompleteInDeficit.is_completed });
    setShowEnergyDeficitConfirmation(false);
    setTaskToCompleteInDeficit(null);
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl space-y-6">
      {/* Daily Challenge Card */}
      <div className="grid grid-cols-1 gap-4 animate-slide-in-up">
        <DailyChallengeCard />
      </div>

      {/* Input & Controls Layer - Now wrapped in a Card */}
      <Card className="p-4 space-y-4 animate-slide-in-up animate-hover-lift">
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
              // NEW: Pass handleCompleteTask to TaskItem
              onCompleteTask={handleCompleteTask} 
            />
          ))}
        </Accordion>
      ) : (
        <Card className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center space-y-4 animate-slide-in-up animate-hover-lift">
          <ClipboardList className="h-12 w-12 text-muted-foreground" />
          <p className="text-base font-semibold">No tasks found!</p> {/* Changed text-lg to text-base */}
          <p>Start by adding a new task above to get organized.</p>
        </Card>
      )}
      
      <AppFooter /> {/* UPDATED: Use AppFooter */}
      <LevelUpCelebration />

      {/* NEW: Energy Deficit Confirmation Dialog */}
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
          isProcessingCommand={false} // Assuming no other command is processing for general tasks
        />
      )}
    </div>
  );
};

export default Dashboard;