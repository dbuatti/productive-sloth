import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Zap, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EnergyDeficitConfirmationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  taskName: string;
  taskEnergyCost: number; // Added this prop
  currentEnergy: number; // Added this prop
  onConfirm: () => void;
  isProcessingCommand: boolean;
}

const EnergyDeficitConfirmationDialog: React.FC<EnergyDeficitConfirmationDialogProps> = ({
  isOpen,
  onOpenChange,
  taskName,
  taskEnergyCost,
  currentEnergy,
  onConfirm,
  isProcessingCommand,
}) => {
  const energyAfterTask = currentEnergy - taskEnergyCost;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-500">
            <AlertCircle className="h-6 w-6" /> Energy Deficit Warning
          </DialogTitle>
          <DialogDescription>
            Completing "{taskName}" will put you further into an energy deficit.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4 text-center">
          <p className="text-lg font-semibold">
            Current Energy: <span className="text-logo-yellow">{currentEnergy}</span>
          </p>
          <p className="text-lg font-semibold">
            Task Energy Cost: <span className="text-red-500">{taskEnergyCost}</span>
          </p>
          <p className="text-xl font-bold">
            Energy After Task: <span className="text-red-500">{energyAfterTask}</span>
          </p>
          <p className="text-muted-foreground">
            Are you sure you want to proceed?
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessingCommand}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isProcessingCommand}
            className={cn(
              "flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white",
              isProcessingCommand && "opacity-50 cursor-not-allowed"
            )}
          >
            <Zap className="h-5 w-5" /> {isProcessingCommand ? "Confirming..." : "Confirm & Complete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EnergyDeficitConfirmationDialog;