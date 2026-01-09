"use client";

import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, AlignLeft, Coffee } from 'lucide-react'; // NEW: Import Coffee icon
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface SchedulerInputProps {
  onCommand: (input: string) => Promise<void>;
  isLoading: boolean;
  inputValue: string;
  setInputValue: (value: string) => void;
  placeholder?: string;
  onDetailedInject: () => void;
  onQuickBreak: () => Promise<void>; // NEW: Add onQuickBreak prop
}

const SchedulerInput: React.FC<SchedulerInputProps> = React.memo(({
  onCommand,
  isLoading,
  inputValue,
  setInputValue,
  placeholder = "e.g., 'Vocal Coaching 30 W' or '!Report 45'",
  onDetailedInject,
  onQuickBreak, // Destructure new prop
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
    <div className="flex w-full items-center space-x-2">
      <Input
        type="text"
        placeholder={placeholder}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isLoading}
        className="flex-grow h-11 bg-background/40 font-medium placeholder:font-normal placeholder:opacity-60 text-sm rounded-xl border-none"
        aria-label="Quick add task input"
      />
      
      {/* NEW: Quick Break Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={onQuickBreak}
            disabled={isLoading}
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0 rounded-xl text-logo-orange border-logo-orange/20 hover:bg-logo-orange/10"
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
            className="h-11 w-11 shrink-0 rounded-xl"
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