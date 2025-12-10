import React, { useEffect, useRef } from 'react';
import { FormattedSchedule, ScheduledItem, DBScheduledTask } from '@/types/scheduler';
import { Card, CardContent } from '@/components/ui/card';
import { format, parseISO, isSameDay, isBefore, isAfter } from 'date-fns';
import { Clock, Lock, Zap, Coffee, Utensils, Dumbbell, Briefcase, Calendar, Home, Plane, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { isMeal } from '@/lib/scheduler-utils';
import { Separator } from '@/components/ui/separator';

interface SchedulerDisplayProps {
  schedule: FormattedSchedule | null;
  T_current: Date;
  onRemoveTask: (taskId: string, taskName: string, index: number) => void;
  onRetireTask: (task: DBScheduledTask) => void;
  onCompleteTask: (task: DBScheduledTask, index: number) => void;
  activeItemId: string | null;
  selectedDayString: string;
  onAddTaskClick: () => void;
  onScrollToItem: (itemId: string) => void;
  isProcessingCommand: boolean;
}

const SchedulerDisplay: React.FC<SchedulerDisplayProps> = ({
  schedule,
  T_current,
  onRemoveTask,
  onRetireTask,
  onCompleteTask,
  activeItemId,
  selectedDayString,
  onAddTaskClick,
  onScrollToItem,
  isProcessingCommand
}) => {
  const selectedDayAsDate = parseISO(selectedDayString);
  const isViewingToday = isSameDay(selectedDayAsDate, T_current);
  const isViewingPast = isBefore(selectedDayAsDate, T_current);
  const isViewingFuture = isAfter(selectedDayAsDate, T_current);

  const getItemIcon = (itemName: string, isCritical: boolean) => {
    const lowerName = itemName.toLowerCase();
    
    if (isMeal(itemName)) return <Utensils className="h-4 w-4" />;
    if (lowerName.includes('break') || lowerName.includes('rest')) return <Coffee className="h-4 w-4" />;
    if (lowerName.includes('gym') || lowerName.includes('workout') || lowerName.includes('exercise')) return <Dumbbell className="h-4 w-4" />;
    if (lowerName.includes('meeting') || lowerName.includes('work') || lowerName.includes('project')) return <Briefcase className="h-4 w-4" />;
    if (lowerName.includes('appointment') || lowerName.includes('doctor')) return <Calendar className="h-4 w-4" />;
    if (lowerName.includes('home') || lowerName.includes('house')) return <Home className="h-4 w-4" />;
    if (lowerName.includes('travel') || lowerName.includes('flight')) return <Plane className="h-4 w-4" />;
    if (lowerName.includes('sleep') || lowerName.includes('night')) return <Moon className="h-4 w-4" />;
    if (lowerName.includes('morning') || lowerName.includes('sun')) return <Sun className="h-4 w-4" />;
    
    return isCritical ? <Zap className="h-4 w-4" /> : <Clock className="h-4 w-4" />;
  };

  const getItemColorClasses = (item: ScheduledItem) => {
    if (item.isCompleted) {
      return 'bg-muted text-muted-foreground border-border';
    }
    
    if (item.isCritical) {
      return 'bg-destructive/10 text-destructive border-destructive hover:bg-destructive/20';
    }
    
    if (item.name.toLowerCase().includes('break') || isMeal(item.name)) {
      return 'bg-logo-green/10 text-logo-green border-logo-green hover:bg-logo-green/20';
    }
    
    return 'bg-primary/5 text-primary border-primary hover:bg-primary/10';
  };

  const getItemTimeIndicator = (item: ScheduledItem) => {
    const isSelectedDayToday = isSameDay(selectedDayAsDate, T_current);
    const isItemInPast = isBefore(item.endTime, T_current) && isSelectedDayToday;
    const isItemActive = item.id === activeItemId;
    
    if (isItemInPast && !item.isCompleted) {
      return (
        <div className="absolute -top-2 -right-2 flex items-center justify-center h-6 w-6 rounded-full bg-destructive text-white text-xs font-bold">
          !
        </div>
      );
    }
    
    if (isItemActive) {
      return (
        <div className="absolute -top-2 -right-2 flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold animate-pulse">
          ●
        </div>
      );
    }
    
    return null;
  };

  const renderTimeSlot = (item: ScheduledItem, index: number) => {
    const dbTask = schedule?.dbTasks.find(t => t.id === item.id);
    if (!dbTask) return null;

    const isSelectedDayToday = isSameDay(selectedDayAsDate, T_current);
    const isItemInPast = isBefore(item.endTime, T_current) && isSelectedDayToday;
    const isItemActive = item.id === activeItemId;
    const isItemCompleted = item.isCompleted;

    return (
      <div 
        key={item.id}
        id={`scheduled-item-${item.id}`}
        className={cn(
          "relative p-4 rounded-lg border transition-all duration-200 animate-hover-lift",
          "flex flex-col sm:flex-row sm:items-center justify-between gap-3",
          getItemColorClasses(item),
          isItemActive && "ring-2 ring-primary ring-offset-2",
          isProcessingCommand && "opacity-70 pointer-events-none"
        )}
      >
        {getItemTimeIndicator(item)}
        
        <div className="flex items-start gap-3 min-w-0 flex-grow">
          <div className="mt-0.5 text-primary">
            {getItemIcon(item.name, item.isCritical)}
          </div>
          
          <div className="min-w-0 flex-grow">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={cn(
                "font-semibold text-base truncate",
                isItemCompleted && "line-through opacity-70"
              )}>
                {item.name}
              </h3>
              
              {item.isLocked && (
                <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
              
              {item.isCritical && !isItemCompleted && (
                <div className="flex items-center gap-1 bg-destructive/20 text-destructive text-xs px-2 py-0.5 rounded-full font-medium">
                  <Zap className="h-3 w-3" />
                  Critical
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {format(item.startTime, 'h:mm a')} - {format(item.endTime, 'h:mm a')}
              </span>
              
              {item.duration > 0 && (
                <span>
                  {item.duration} min
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex gap-2 flex-shrink-0">
          {!isItemCompleted && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onCompleteTask(dbTask, index)}
              disabled={isProcessingCommand}
              className="h-8 px-3"
            >
              Complete
            </Button>
          )}
          
          {!isItemCompleted && !isItemInPast && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRetireTask(dbTask)}
              disabled={isProcessingCommand || item.isLocked}
              className="h-8 px-3"
            >
              Skip
            </Button>
          )}
          
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onRemoveTask(item.id, item.name, index)}
            disabled={isProcessingCommand || item.isLocked}
            className="h-8 px-3"
          >
            Remove
          </Button>
        </div>
      </div>
    );
  };

  if (!schedule) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No schedule data available.</p>
        <Button 
          onClick={onAddTaskClick} 
          className="mt-4"
          disabled={isProcessingCommand}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Your First Task
        </Button>
      </div>
    );
  }

  if (schedule.items.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Clock className="h-12 w-12 text-primary" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Your schedule is empty</h3>
        <p className="text-muted-foreground mb-6">
          {isViewingToday 
            ? "Add tasks to get started with your day!" 
            : isViewingPast 
              ? "No tasks were scheduled for this day." 
              : "Plan your upcoming day by adding tasks."}
        </p>
        <Button 
          onClick={onAddTaskClick} 
          className="animate-hover-lift"
          disabled={isProcessingCommand}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Task
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-primary">{schedule.summary.totalTasks}</div>
          <div className="text-sm text-muted-foreground">Total Tasks</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-logo-green">{schedule.summary.completedCount}</div>
          <div className="text-sm text-muted-foreground">Completed</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-destructive">{schedule.summary.criticalCount}</div>
          <div className="text-sm text-muted-foreground">Critical</div>
        </Card>
      </div>
      
      <Separator className="my-6" />
      
      <div className="space-y-4">
        {schedule.items.map((item, index) => (
          <React.Fragment key={item.id}>
            {renderTimeSlot(item, index)}
          </React.Fragment>
        ))}
      </div>
      
      <div className="pt-6 text-center">
        <Button 
          onClick={onAddTaskClick} 
          variant="outline" 
          className="animate-hover-lift"
          disabled={isProcessingCommand}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Another Task
        </Button>
      </div>
    </div>
  );
};

export default SchedulerDisplay;