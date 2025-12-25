"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Zap, Activity, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSession } from '@/hooks/use-session';

interface EnergyFeedbackSliderProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reportedDrain: number) => Promise<void>;
  taskName: string;
  predictedDrain: number;
  isProcessing: boolean;
}

const EnergyFeedbackSlider: React.FC<EnergyFeedbackSliderProps> = ({
  isOpen,
  onClose,
  onSubmit,
  taskName,
  predictedDrain,
  isProcessing,
}) => {
  const { profile } = useSession();
  const [reportedDrain, setReportedDrain] = useState<number>(predictedDrain);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset slider when modal opens for a new task
  useEffect(() => {
    if (isOpen) {
      setReportedDrain(predictedDrain);
      setIsSubmitting(false);
    }
  }, [isOpen, predictedDrain]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    await onSubmit(reportedDrain);
    setIsSubmitting(false);
    onClose();
  };

  // Determine slider max value based on predicted drain to allow for variance
  const maxDrain = Math.max(predictedDrain * 2, 50);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md animate-pop-in">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" /> Bio-Feedback
          </DialogTitle>
          <DialogDescription className="text-sm">
            How draining was <span className="font-bold text-foreground">"{taskName}"</span>?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Prediction vs. Report Display */}
          <div className="flex justify-between items-center bg-secondary/50 p-3 rounded-lg border">
            <div className="text-center flex-1">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-1">System Predicted</p>
              <div className="flex items-center justify-center gap-1 text-lg font-bold text-primary">
                {predictedDrain} <Zap className="h-4 w-4 fill-current" />
              </div>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-center flex-1">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-1">Your Report</p>
              <div className={cn(
                "flex items-center justify-center gap-1 text-lg font-bold transition-colors duration-300",
                reportedDrain > predictedDrain ? "text-destructive" : "text-logo-green"
              )}>
                {reportedDrain} <Zap className="h-4 w-4 fill-current" />
              </div>
            </div>
          </div>

          {/* The Slider */}
          <div className="space-y-4">
            <div className="flex justify-between text-xs font-bold text-muted-foreground">
              <span>Low</span>
              <span>High</span>
            </div>
            <Slider
              defaultValue={[predictedDrain]}
              max={maxDrain}
              step={1}
              onValueChange={(value) => setReportedDrain(value[0])}
              className={cn(
                "cursor-pointer",
                reportedDrain > predictedDrain ? "[&_.range-thumb]:bg-destructive [&_.range-track]:bg-destructive/20" : 
                "[&_.range-thumb]:bg-logo-green [&_.range-track]:bg-logo-green/20"
              )}
            />
            <p className="text-center text-sm text-muted-foreground">
              {reportedDrain > predictedDrain
                ? "Tougher than expected. The system will adjust."
                : reportedDrain < predictedDrain
                ? "Easier than expected. Great job!"
                : "Matches prediction."}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={isSubmitting || isProcessing}
          >
            Skip
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={isSubmitting || isProcessing}
            className="flex items-center gap-2"
          >
            {isSubmitting || isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Activity className="h-4 w-4" />
            )}
            Submit Feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EnergyFeedbackSlider;