"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { intervalToDuration, formatDuration, isBefore } from 'date-fns';
import { Clock, Coffee, Rocket, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScheduledItem } from '@/types/scheduler';

interface EarlyCompletionModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  activeItem: ScheduledItem;
  nextItem: ScheduledItem | null;
  T_current: Date;
  onTakeBreak: (remainingMinutes: number) => void;
  onStartNextTaskNow: () => void;
  isProcessingCommand: boolean;
}

const EarlyCompletionModal: React.FC<EarlyCompletionModalProps> = ({
  isOpen,
  onOpenChange,
  activeItem,
  nextItem,
  T_current,
  onTakeBreak,
  onStartNextTaskNow,
  isProcessingCommand,
}) => {
  const remainingDuration = intervalToDuration({ start: T_current, end: activeItem.endTime });
  const remainingMinutes = Math.floor((activeItem.endTime.getTime() - T_current.getTime()) / (1000 * 60));

  const formattedRemainingTime = formatDuration(remainingDuration, {
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
  });

  if (!activeItem) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md animate-pop-in">
        <DialogHeader className="text-center">
          <DialogTitle className="text-3xl font-bold text-primary flex items-center justify-center gap-2">
            <Clock className="h-8 w-8" /> Task Completed Early!
          </DialogTitle>
          <DialogDescription className="text-lg mt-4 text-foreground">
            You finished "<span className="font-semibold">{activeItem.name}</span>" with{' '}
            <span className="font-extrabold text-logo-yellow">{formattedRemainingTime}</span> of scheduled time remaining.
            What would you like to do with this time?
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-6">
          <Button
            onClick={() => onTakeBreak(remainingMinutes)}
            disabled={isProcessingCommand}
            className="w-full h-12 text-lg bg-logo-orange hover:bg-logo-orange/90 text-primary-foreground flex items-center gap-2 transition-all duration-200"
          >
            {isProcessingCommand ? <Loader2 className="h-5 w-5 animate-spin" /> : <Coffee className="h-6 w-6" />}
            Take a Break ({remainingMinutes} min)
          </Button>
          <Button
            onClick={onStartNextTaskNow}
            disabled={isProcessingCommand || !nextItem}
            className={cn(
              "w-full h-12 text-lg bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2 transition-all duration-200",
              !nextItem && "opacity-50 cursor-not-allowed"
            )}
            style={!nextItem ? { pointerEvents: 'auto' } : undefined}
          >
            {isProcessingCommand ? <Loader2 className="h-5 w-5 animate-spin" /> : <Rocket className="h-6 w-6" />}
            {nextItem ? `Start "${nextItem.name}" Now` : 'No Next Task Scheduled'}
          </Button>
        </div>
        <DialogFooter className="sm:justify-center">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isProcessingCommand}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EarlyCompletionModal;