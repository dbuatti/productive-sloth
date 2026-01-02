import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Plus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface SchedulerInputProps {
  onCommand: (input: string) => Promise<void>;
  isLoading: boolean;
  inputValue: string;
  setInputValue: (value: string) => void;
  placeholder?: string;
  onDetailedInject: () => void;
}

const SchedulerInput: React.FC<SchedulerInputProps> = React.memo(({
  onCommand,
  isLoading,
  inputValue,
  setInputValue,
  placeholder = "e.g., 'Gym 60' or '!Report 45'",
  onDetailedInject,
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
        className="flex-grow h-12 bg-background/40 font-medium placeholder:font-normal placeholder:opacity-40 text-sm"
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={onDetailedInject}
            disabled={isLoading}
            variant="outline"
            size="icon"
            className="h-12 w-12 shrink-0 rounded-full"
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Detailed Injection</TooltipContent>
      </Tooltip>
    </div>
  );
});

SchedulerInput.displayName = 'SchedulerInput';

export default SchedulerInput;