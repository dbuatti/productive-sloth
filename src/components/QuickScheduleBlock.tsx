"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Feather, Anchor } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface QuickScheduleBlockProps {
  duration: number;
  onScheduleBlock: (duration: number, sortPreference: 'longestFirst' | 'shortestFirst') => void;
  isProcessingCommand: boolean;
}

const QuickScheduleBlock: React.FC<QuickScheduleBlockProps> = ({
  duration,
  onScheduleBlock,
  isProcessingCommand,
}) => {
  return (
    <div className="relative flex items-center justify-between h-12 rounded-full border border-input bg-background hover:bg-secondary/50 transition-all shadow-sm hover:shadow-md">
      {/* Left Button: Shortest First */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onScheduleBlock(duration, 'shortestFirst')}
            disabled={isProcessingCommand}
            className="h-full flex-1 rounded-full rounded-r-none text-primary hover:bg-primary/10"
          >
            <Feather className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Schedule {duration} min (Shortest First)</p>
        </TooltipContent>
      </Tooltip>

      {/* Center Duration Label */}
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center text-sm font-extrabold text-primary-foreground border-2 border-card shadow-sm">
          {duration}
        </div>
      </div>

      {/* Right Button: Longest First */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onScheduleBlock(duration, 'longestFirst')}
            disabled={isProcessingCommand}
            className="h-full flex-1 rounded-full rounded-l-none text-primary hover:bg-primary/10"
          >
            <Anchor className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Schedule {duration} min (Longest First)</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
};

export default QuickScheduleBlock;