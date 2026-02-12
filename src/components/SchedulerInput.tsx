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
  placeholder = "e.g., 'Vocal Coaching 30 W' or '!Report 45'",
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

  const handleClear = () => {
    setInputValue('');
  };

  return (
    <div className="flex w-full items-center space-x-2">
      <div className="relative flex-grow group">
        <Input
          type="text"
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          className={cn(
            "h-11 bg-background/40 font-medium placeholder:font-normal placeholder:opacity-60 text-sm rounded-xl border-none pr-10 transition-all",
            inputValue && "bg-background/60 ring-1 ring-primary/20"
          )}
          aria-label="Quick add task input"
        />
        {inputValue && !isLoading && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-secondary/80 transition-all"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={onQuickBreak}
            disabled={isLoading}
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0 rounded-xl text-logo-orange border-logo-orange/20 hover:bg-logo-orange/10 transition-all active:scale-95"
            aria-label="Add a quick 15-minute break"
          >
            <Coffee className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Quick Break (15 min)</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={onDetailedInject}
            disabled={isLoading}
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0 rounded-xl transition-all active:scale-95"
            aria-label="Open detailed task creation dialog"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlignLeft className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Detailed Injection</TooltipContent>
      </Tooltip>
    </div>
  );
});

SchedulerInput.displayName = 'SchedulerInput';

export default SchedulerInput;