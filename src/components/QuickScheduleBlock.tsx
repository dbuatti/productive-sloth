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
    <div className="relative flex items-center justify-between h-14 rounded-full border border-input bg-background animate-hover-lift shadow-lg"> {/* Increased height to h-14 */}
      {/* Left Button: Shortest First */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onScheduleBlock(duration, 'shortestFirst')}
            disabled={isProcessingCommand}
            className="h-full flex-1 rounded-full rounded-r-none text-primary hover:bg-primary/10" // Changed w-14 to flex-1
          >
            <Feather className="h-5 w-5" /> {/* Increased icon size */}
            <span className="sr-only">Schedule {duration} min (Shortest Tasks First)</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Schedule {duration} min (Shortest Tasks First)</p>
        </TooltipContent>
      </Tooltip>

      {/* Center Duration Label */}
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 z-10">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="h-14 w-14 rounded-full bg-primary flex items-center justify-center text-xl font-extrabold text-primary-foreground border-2 border-card shadow-xl transition-all duration-200 hover:scale-[1.05]"> {/* Increased height and width to h-14 w-14 */}
              {duration}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Quick Schedule Block: {duration} minutes</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Right Button: Longest First */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onScheduleBlock(duration, 'longestFirst')}
            disabled={isProcessingCommand}
            className="h-full flex-1 rounded-full rounded-l-none text-primary hover:bg-primary/10" // Changed w-14 to flex-1
          >
            <Anchor className="h-5 w-5" /> {/* Increased icon size */}
            <span className="sr-only">Schedule {duration} min (Longest Tasks First)</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Schedule {duration} min (Longest Tasks First)</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
};

export default QuickScheduleBlock;