import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { differenceInMinutes, format } from 'date-fns';
import { Zap, Clock, Play, Pause, SkipForward } from 'lucide-react';
import { ScheduledItem as FormattedScheduleItem } from '@/types/scheduler';
import { cn } from '@/lib/utils';

interface NowFocusCardProps {
  activeItem: FormattedScheduleItem | null;
  nextItem: FormattedScheduleItem | null;
  T_current: Date;
  onEnterFocusMode: () => void;
}

const NowFocusCard: React.FC<NowFocusCardProps> = ({
  activeItem,
  nextItem,
  T_current,
  onEnterFocusMode
}) => {
  if (!activeItem) {
    return (
      <Card className="animate-slide-in-up animate-hover-lift border-primary/20 bg-primary/5">
        <CardContent className="p-6 text-center">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Zap className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold">No Active Task</h3>
              <p className="text-muted-foreground">
                {nextItem 
                  ? `Next: ${nextItem.name} at ${format(nextItem.startTime, 'h:mm a')}` 
                  : "Schedule tasks to get started!"}
              </p>
            </div>
            {nextItem && (
              <Button 
                onClick={onEnterFocusMode}
                className="animate-hover-lift"
              >
                <Play className="h-4 w-4 mr-2" />
                Start Focus Mode
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalDuration = differenceInMinutes(activeItem.endTime, activeItem.startTime);
  const elapsedMinutes = differenceInMinutes(T_current, activeItem.startTime);
  const progressPercentage = Math.min(100, Math.max(0, (elapsedMinutes / totalDuration) * 100));

  const isCritical = activeItem.isCritical;
  const timeRemaining = differenceInMinutes(activeItem.endTime, T_current);
  const isEndingSoon = timeRemaining <= 5 && timeRemaining > 0;

  return (
    <Card className={cn(
      "animate-slide-in-up animate-hover-lift border-2",
      isCritical ? "border-destructive/50 bg-destructive/5" : "border-primary/20 bg-primary/5",
      isEndingSoon && "animate-pulse"
    )}>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <CardTitle className="flex items-center gap-2 text-lg">
            {isCritical ? (
              <Zap className="h-5 w-5 text-destructive" />
            ) : (
              <Clock className="h-5 w-5 text-primary" />
            )}
            <span className={isCritical ? "text-destructive" : "text-primary"}>
              {isCritical ? "Critical Task" : "Current Task"}
            </span>
          </CardTitle>
          <Button 
            onClick={onEnterFocusMode}
            size="sm"
            className={cn(
              "animate-hover-lift",
              isCritical ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90"
            )}
          >
            <Play className="h-4 w-4 mr-2" />
            Focus
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div>
          <h3 className="text-xl font-bold mb-1">{activeItem.name}</h3>
          <p className="text-muted-foreground text-sm">
            {format(activeItem.startTime, 'h:mm a')} - {format(activeItem.endTime, 'h:mm a')}
            <span className="mx-2">•</span>
            {totalDuration} minutes
          </p>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {elapsedMinutes} min elapsed
            </span>
            <span className={cn(
              "font-medium",
              isEndingSoon ? "text-destructive" : "text-foreground"
            )}>
              {timeRemaining > 0 ? `${timeRemaining} min remaining` : "Time's up!"}
            </span>
          </div>
          
          <Progress 
            value={progressPercentage} 
            className={cn(
              "h-2",
              isCritical ? "bg-destructive/20 [&>div]:bg-destructive" : "[&>div]:bg-primary"
            )} 
          />
        </div>
        
        {nextItem && (
          <div className="pt-3 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Next: <span className="font-medium">{nextItem.name}</span> at {format(nextItem.startTime, 'h:mm a')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default NowFocusCard;