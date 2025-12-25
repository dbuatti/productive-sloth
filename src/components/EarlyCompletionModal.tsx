import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Coffee, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EarlyCompletionModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  taskName: string;
  remainingMinutes: number; // Added this prop
  onTakeBreak: () => void;
  onJustFinish: () => void;
  isProcessingCommand: boolean;
}

const EarlyCompletionModal: React.FC<EarlyCompletionModalProps> = ({
  isOpen,
  onOpenChange,
  taskName,
  remainingMinutes,
  onTakeBreak,
  onJustFinish,
  isProcessingCommand,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Task "{taskName}" Completed Early!</DialogTitle>
          <DialogDescription>
            You finished with {remainingMinutes} minutes to spare. What would you like to do with this time?
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Button
            onClick={onTakeBreak}
            disabled={isProcessingCommand}
            className={cn(
              "flex items-center gap-2 h-11 text-base bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-200",
              isProcessingCommand && "opacity-50 cursor-not-allowed"
            )}
          >
            <Coffee className="h-5 w-5" /> Take a {remainingMinutes}-minute Break
          </Button>
          <Button
            onClick={onJustFinish}
            disabled={isProcessingCommand}
            variant="outline"
            className={cn(
              "flex items-center gap-2 h-11 text-base transition-all duration-200",
              isProcessingCommand && "opacity-50 cursor-not-allowed"
            )}
          >
            <CheckCircle className="h-5 w-5" /> Just Finish Task
          </Button>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isProcessingCommand}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EarlyCompletionModal;