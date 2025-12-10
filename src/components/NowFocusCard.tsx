import { Zap, Clock, Play, Pause, SkipForward } from 'lucide-react';
import { ScheduledItem as FormattedScheduleItem } from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/scheduler-utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

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
      <Card className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 animate-pop-in">
        <CardContent className="p-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-blue-900">No Active Task</h3>
              <p className="text-sm text-blue-700">You're free right now!</p>
            </div>
            <Zap className="h-8 w-8 text-blue-500" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const timeRemaining = Math.max(0, Math.floor((activeItem.endTime.getTime() - T_current.getTime()) / (1000 * 60)));

  return (
    <Card className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 animate-pop-in">
      <CardContent className="p-0">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-green-900">Now: {activeItem.name}</h3>
              {activeItem.isCritical && <Zap className="h-4 w-4 text-destructive" />}
            </div>
            <div className="flex items-center gap-4 mt-1">
              <div className="flex items-center gap-1 text-sm text-green-700">
                <Clock className="h-4 w-4" />
                <span>{formatTime(activeItem.startTime)} - {formatTime(activeItem.endTime)}</span>
              </div>
              <span className="text-sm font-medium text-green-800">
                {timeRemaining} min left
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              onClick={onEnterFocusMode}
              className="bg-green-600 hover:bg-green-700"
            >
              <Play className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {nextItem && (
          <div className="mt-3 pt-3 border-t border-green-100">
            <p className="text-xs text-green-700">
              Next: <span className="font-medium">{nextItem.name}</span> at {formatTime(nextItem.startTime)}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default NowFocusCard;