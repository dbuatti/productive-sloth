"use client";

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EnergyDeficitWarningProps {
  currentEnergy: number;
}

const EnergyDeficitWarning: React.FC<EnergyDeficitWarningProps> = ({ currentEnergy }) => {
  if (currentEnergy >= 0) {
    return null;
  }

  return (
    <div className={cn( // Replaced Card with div
      "w-full border-none bg-destructive/10 text-destructive animate-pop-in animate-pulse-glow rounded-xl shadow-sm", // Removed border-destructive/70, adjusted styling
      "flex items-center justify-center p-3 text-sm font-semibold"
    )}>
      <div className="p-0 flex items-center gap-2"> {/* Replaced CardContent with div */}
        <AlertTriangle className="h-5 w-5" />
        <span>
          ⚠️ <span className="font-bold">Energy Deficit:</span> You are running on reserve ({currentEnergy}⚡). Recovery is critical.
        </span>
      </div>
    </div>
  );
};

export default EnergyDeficitWarning;