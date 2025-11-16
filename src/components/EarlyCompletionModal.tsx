"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Coffee, Rocket } from 'lucide-react';
import { formatDuration, intervalToDuration } from 'date-fns';
import { cn } from '@/lib/utils';

interface EarlyCompletionModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  taskName: string;
  remainingDurationMinutes: number;
  onTakeBreak: () => void;
  onStartNextTask: () => void;
  isProcessingCommand: boolean;
  hasNextTask: boolean;
}

const EarlyCompletionModal: React.FC<EarlyCompletionModalProps> = ({
  isOpen,
  onOpenChange,
  taskName,
  remainingDurationMinutes,
  onTakeBreak,
  onStartNextTask,
  isProcessingCommand,
  hasNextTask,
}) => {
  const remainingDurationFormatted = React.useMemo(() => {
    if (remainingDurationMinutes <= 0) return '0 minutes';
    const duration = intervalToDuration({ start: 0, end: remainingDurationMinutes * 60 * 1000 });
    return formatDuration(duration, {
      format: ['hours', 'minutes'],
      delimiter: ' ',
      zero: false,
      locale: {
        formatDistance: (token, count) => {
          if (token === 'xMinutes') return `${count} minutes`;
          if (token === 'xHours') return `${count} hours`;
          return `${count}${token.charAt(0)}`;
        },
      },
    }) || '0 minutes';
  }, [remainingDurationMinutes]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md animate-pop-in">
        <DialogHeader>
          <DialogTitle className="text-3xl font-bold text-primary text-center">
            🎉 Task Completed Early!
          </DialogTitle>
          <DialogDescription className="text-center text-lg mt-2 text-foreground">
            You finished "<span className="font-semibold text-primary">{taskName}</span>" with{' '}
            <span className="font-bold text-logo-green">{remainingDurationFormatted}</span> of scheduled time remaining.
            What would you like to do with this time?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4">
          <Button
            onClick={onTakeBreak}
            disabled={isProcessingCommand}
            className={cn(
              "w-full flex items-center gap-2 bg-logo-orange hover:bg-logo-orange/90 text-primary-foreground transition-all duration-200",
              isProcessingCommand && "opacity-70 cursor-not-allowed"
            )}
          >
            <Coffee className="h-5 w-5" />
            Take a Break
          </Button>
          <Button
            onClick={onStartNextTask}
            disabled={isProcessingCommand || !hasNextTask}
            className={cn(
              "w-full flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-200",
              (isProcessingCommand || !hasNextTask) && "opacity-70 cursor-not-allowed"
            )}
          >
            <Rocket className="h-5 w-5" />
            Start Next Task Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EarlyCompletionModal;