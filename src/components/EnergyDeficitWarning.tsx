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
    <Card className={cn(
      "w-full border-none bg-destructive/10 text-destructive animate-pop-in animate-pulse-glow rounded-xl shadow-sm",
      "flex items-center justify-center p-3 text-sm font-semibold"
    )}>
      <CardContent className="p-0 flex items-center gap-2">
        <AlertTriangle className="h-5 w-5" />
        <span>
          ⚠️ <span className="font-bold">Energy Deficit:</span> You are running on reserve ({currentEnergy}⚡). Recovery is critical.
        </span>
      </CardContent>
    </Card>
  );
};

export default EnergyDeficitWarning;