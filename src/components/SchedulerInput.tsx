"use client";

import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, AlignLeft, Coffee, X } from 'lucide-react'; 
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface SchedulerInputProps {
  onCommand: (input: string) => Promise<void>;
  isLoading: boolean;
  inputValue: string;
  setInputValue: (value: string) => void;
  placeholder?: string;
  onDetailedInject: () => void;
  onQuickBreak: () => Promise<void>; 
}

const SchedulerInput: React.FC<SchedulerInputProps> = React.memo(({
  onCommand,
  isLoading,
  inputValue,
  setInputValue,
  placeholder = "Add task (e.g. 'Gym 60' or '!Work 30')",
  onDetailedInject,
  onQuickBreak, 
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim()) {
        onCommand(inputValue);
      }
    }
  };

  return (
    <div className="flex w-full items-center gap-2">
      <div className="relative flex-grow">
        <Input
          type="text"
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          className="h-10 bg-muted/50 border-none rounded-lg text-sm placeholder:text-muted-foreground/50"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin opacity-20" />
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={onQuickBreak} disabled={isLoading} variant="ghost" size="icon" className="h-10 w-10 rounded-lg text-logo-orange/60 hover:text-logo-orange hover:bg-logo-orange/10">
              <Coffee className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Quick Break</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={onDetailedInject} disabled={isLoading} variant="ghost" size="icon" className="h-10 w-10 rounded-lg">
              <AlignLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Detailed Add</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
});

SchedulerInput.displayName = 'SchedulerInput';
export default SchedulerInput;