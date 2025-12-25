import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CompletedTaskLogEntry, UserProfile } from '@/types/scheduler';
import { format } from 'date-fns';
import { Sparkles, CheckCircle, XCircle, Clock, Zap, Utensils } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LOW_ENERGY_THRESHOLD } from '@/lib/constants';

interface DailyVibeRecapCardProps {
  selectedDayString: string;
  completedTasks: CompletedTaskLogEntry[]; // Added this prop
  isLoading: boolean;
  profile: UserProfile | null;
  T_current: Date;
}

const DailyVibeRecapCard: React.FC<DailyVibeRecapCardProps> = ({
  selectedDayString,
  completedTasks,
  isLoading,
  profile,
  T_current,
}) => {
  const totalEnergyCost = completedTasks.reduce((sum, task) => sum + (task.energy_cost || 0), 0);
  const totalEnergyGain = completedTasks.reduce((sum, task) => sum + (task.energy_cost < 0 ? Math.abs(task.energy_cost) : 0), 0);
  const finalEnergy = profile?.energy; // Assuming this is the final energy for the day

  const vibeMessage = React.useMemo(() => {
    if (isLoading) return "Calculating your daily vibe...";
    if (!profile) return "Profile not loaded. Cannot calculate daily vibe.";

    const completedCount = completedTasks.filter(t => t.is_completed).length;
    const totalTasks = completedTasks.length;

    if (totalTasks === 0) {
      return "No tasks completed today. Time to plan some action!";
    }

    let message = "";
    if (completedCount === totalTasks) {
      message += "All tasks completed! ";
    } else if (completedCount > 0) {
      message += `${completedCount} of ${totalTasks} tasks completed. `;
    } else {
      message += "No tasks completed yet. ";
    }

    if (finalEnergy !== undefined) {
      if (finalEnergy >= 0) {
        message += `You finished the day with ${finalEnergy} energy. Great job!`;
      } else if (finalEnergy > LOW_ENERGY_THRESHOLD) {
        message += `You finished the day with ${finalEnergy} energy. Consider some rest.`;
      } else {
        message += `You finished the day with ${finalEnergy} energy. Time for deep recovery.`;
      }
    }

    return message;
  }, [isLoading, profile, completedTasks, finalEnergy]);

  return (
    <Card className="animate-pop-in animate-hover-lift">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Sparkles className="h-5 w-5 text-logo-yellow" /> Daily Vibe Recap for {format(new Date(selectedDayString), 'PPP')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-base text-muted-foreground">
        {isLoading ? (
          <p>Loading recap...</p>
        ) : (
          <>
            <p className="font-semibold text-lg">{vibeMessage}</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-logo-green" />
                <span>Tasks Completed: {completedTasks.filter(t => t.is_completed).length}</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                <span>Tasks Missed/Skipped: {completedTasks.filter(t => !t.is_completed).length}</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-logo-yellow" />
                <span>Total Energy Cost: {totalEnergyCost > 0 ? totalEnergyCost : 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <Utensils className="h-5 w-5 text-logo-green" />
                <span>Total Energy Gain: {totalEnergyGain}</span>
              </div>
              <div className="flex items-center gap-2 col-span-2">
                <Clock className="h-5 w-5 text-primary" />
                <span>Final Energy Level: {finalEnergy !== undefined ? finalEnergy : 'N/A'}</span>
              </div>
            </div>
            {completedTasks.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold text-lg mb-2">Completed Tasks:</h3>
                <ul className="space-y-1">
                  {completedTasks.map(task => (
                    <li key={task.id} className="flex items-center gap-2 text-sm">
                      {task.is_completed ? (
                        <CheckCircle className="h-4 w-4 text-logo-green" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span>{task.name} ({task.duration} min) - Energy: {task.energy_cost}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default DailyVibeRecapCard;