import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Zap } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const isMobile = useIsMobile();

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
        className="flex-grow h-11 bg-background/40 font-medium placeholder:font-normal placeholder:opacity-60 text-sm rounded-xl border-none" // Adjusted height and placeholder opacity, removed border
      />
      {/* On mobile, show a single, prominent action button. On desktop, keep the two separate for clarity. */}
      {isMobile ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={() => inputValue.trim() ? onCommand(inputValue) : onDetailedInject()}
              disabled={isLoading}
              variant="aether"
              className="h-11 w-12 shrink-0 rounded-xl shadow-md shadow-primary/10" // Adjusted height, width, and shadow
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />} {/* Adjusted icon size */}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {inputValue.trim() ? "Quick Add" : "Detailed Injection"}
          </TooltipContent>
        </Tooltip>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={onDetailedInject}
              disabled={isLoading}
              variant="outline"
              size="icon"
              className="h-11 w-11 shrink-0 rounded-xl" // Adjusted height and width, rounded-full to rounded-xl
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {/* Adjusted icon size */}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Detailed Injection</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
});

SchedulerInput.displayName = 'SchedulerInput';

export default SchedulerInput;