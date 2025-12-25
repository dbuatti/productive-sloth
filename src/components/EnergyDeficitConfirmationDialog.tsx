"use client";

import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EnergyDeficitConfirmationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  taskName: string;
  taskEnergyCost: number;
  currentEnergy: number;
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
  const newEnergyLevel = currentEnergy - taskEnergyCost;

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md animate-pop-in">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-2xl font-bold text-destructive flex items-center gap-2">
            <AlertTriangle className="h-7 w-7" /> Energy Deficit Warning!
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base text-foreground mt-2">
            You are currently in an energy deficit (<span className="font-bold text-destructive">{currentEnergy}⚡</span>).
            Completing "<span className="font-semibold text-primary">{taskName}</span>" will cost{' '}
            <span className="font-bold text-logo-yellow">{taskEnergyCost}⚡</span>,
            further increasing your deficit to <span className="font-bold text-destructive">{newEnergyLevel}⚡</span>.
          </AlertDialogDescription>
          <AlertDialogDescription className="text-sm text-muted-foreground">
            Are you sure you want to push through and complete this task?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex flex-col sm:flex-row gap-3 pt-4 sm:justify-end">
          <AlertDialogCancel disabled={isProcessingCommand}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isProcessingCommand}
            className={cn(
              "w-full sm:w-auto flex items-center gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground transition-all duration-200",
              isProcessingCommand && "opacity-70 cursor-not-allowed"
            )}
          >
            {isProcessingCommand ? (
              <Zap className="h-5 w-5 animate-pulse" />
            ) : (
              <Zap className="h-5 w-5" />
            )}
            Yes, Push Through!
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default EnergyDeficitConfirmationDialog;