import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Zap, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { REGEN_POD_MAX_DURATION_MINUTES, REGEN_POD_RATE_PER_MINUTE } from '@/lib/constants';

interface EnergyRegenPodModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void; // Added this prop
  calculatedDuration: number;
  onConfirmStart: (duration: number) => Promise<void>;
  isProcessingCommand: boolean;
}

const EnergyRegenPodModal: React.FC<EnergyRegenPodModalProps> = ({
  isOpen,
  onOpenChange,
  calculatedDuration,
  onConfirmStart,
  isProcessingCommand,
}) => {
  const [duration, setDuration] = useState(calculatedDuration);

  useEffect(() => {
    setDuration(calculatedDuration);
  }, [calculatedDuration]);

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value > 0 && value <= REGEN_POD_MAX_DURATION_MINUTES) {
      setDuration(value);
    } else if (e.target.value === '') {
      setDuration(0); // Allow clearing input
    }
  };

  const handleConfirm = () => {
    if (duration > 0 && duration <= REGEN_POD_MAX_DURATION_MINUTES) {
      onConfirmStart(duration);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-logo-green">
            <Zap className="h-6 w-6" /> Activate Energy Regen Pod
          </DialogTitle>
          <DialogDescription>
            Enter the duration you wish to spend in the Energy Regen Pod.
            You will gain {REGEN_POD_RATE_PER_MINUTE} energy per minute.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="podDuration" className="text-right">
              Duration (min)
            </Label>
            <Input
              id="podDuration"
              type="number"
              value={duration}
              onChange={handleDurationChange}
              min={1}
              max={REGEN_POD_MAX_DURATION_MINUTES}
              className="col-span-3"
              disabled={isProcessingCommand}
            />
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Max duration: {REGEN_POD_MAX_DURATION_MINUTES} minutes.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessingCommand}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isProcessingCommand || duration <= 0 || duration > REGEN_POD_MAX_DURATION_MINUTES}
            className={cn(
              "flex items-center gap-2 bg-logo-green hover:bg-logo-green/90 text-white",
              isProcessingCommand && "opacity-50 cursor-not-allowed"
            )}
          >
            <Play className="h-5 w-5" /> {isProcessingCommand ? "Activating..." : "Activate Pod"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EnergyRegenPodModal;