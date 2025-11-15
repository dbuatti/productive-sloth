import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Plus, Loader2, ListTodo, Command as CommandIcon, XCircle, Coffee } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTasks } from '@/hooks/use-tasks';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface Suggestion {
  type: 'command' | 'task';
  name: string;
  description?: string;
}

interface SchedulerInputProps {
  isLoading?: boolean;
  placeholder?: string;
  inputValue: string;
  setInputValue: (value: string) => void;
  onSelectSuggestion: (suggestion: Suggestion) => void; // NEW: Prop to handle suggestion selection
}

const SchedulerInput: React.FC<SchedulerInputProps> = ({ isLoading = false, placeholder = "Enter task or command...", inputValue, setInputValue, onSelectSuggestion }) => {
  const { allTasks } = useTasks();
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPopoverExplicitlyOpen, setIsPopoverExplicitlyOpen] = useState(false);

  const commonCommands = useMemo<Suggestion[]>(() => [
    { type: 'command', name: 'clear', description: 'Clear all scheduled tasks' },
    { type: 'command', name: 'remove', description: 'Remove a task by name or index' },
    { type: 'command', name: 'inject', description: 'Inject a task with specific details' },
    { type: 'command', name: 'time off', description: 'Block out a period as "Time Off"' },
    { type: 'command', name: 'compact', description: 'Compact flexible tasks' },
    { type: 'command', name: 'aether dump', description: 'Dump flexible tasks to Sink' },
    { type: 'command', name: 'aether dump mega', description: 'Dump ALL flexible tasks to Sink' },
  ], []);

  const suggestions = useMemo(() => {
    if (!inputValue) return [];

    const lowerInput = inputValue.toLowerCase();
    const filteredSuggestions: Suggestion[] = [];

    commonCommands.forEach(cmd => {
      if (cmd.name.toLowerCase().startsWith(lowerInput)) {
        filteredSuggestions.push(cmd);
      }
    });

    allTasks.forEach(task => {
      if (task.title.toLowerCase().includes(lowerInput) && !filteredSuggestions.some(s => s.name === task.title)) {
        filteredSuggestions.push({ type: 'task', name: task.title, description: `Task: ${task.title}` });
      }
    });

    return filteredSuggestions.slice(0, 5);
  }, [inputValue, allTasks, commonCommands]);

  const shouldShowSuggestions = inputValue.length > 0 && suggestions.length > 0;

  useEffect(() => {
    if (shouldShowSuggestions) {
      setIsPopoverExplicitlyOpen(true);
    } else {
      setIsPopoverExplicitlyOpen(false);
    }
    setSelectedIndex(-1);
  }, [shouldShowSuggestions]);

  useEffect(() => {
    if (!isLoading && inputValue === '' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [inputValue, isLoading]);


  const handleSelectSuggestion = (suggestion: Suggestion) => {
    onSelectSuggestion(suggestion); // Use the prop to handle selection
    setSelectedIndex(-1);
    setIsPopoverExplicitlyOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (shouldShowSuggestions && isPopoverExplicitlyOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
      } else if (e.key === 'Enter' && selectedIndex !== -1) {
        e.preventDefault();
        handleSelectSuggestion(suggestions[selectedIndex]);
      }
    }
  };

  const handleClearInput = () => {
    setInputValue('');
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col gap-2 w-full animate-slide-in-up relative">
      <div className="relative flex-grow">
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading}
          className="flex-grow h-10 pr-10 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200"
        />
        {inputValue && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClearInput}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 text-muted-foreground hover:text-primary"
          >
            <XCircle className="h-5 w-5" />
            <span className="sr-only">Clear input</span>
          </Button>
        )}
      </div>

      <Popover open={isPopoverExplicitlyOpen} onOpenChange={setIsPopoverExplicitlyOpen}>
        <PopoverTrigger asChild>
          <div className="absolute top-0 left-0 w-full h-10 pointer-events-none" />
        </PopoverTrigger>
        <PopoverContent 
          className="p-0 w-[var(--radix-popover-trigger-width)] mt-1" 
          align="start" 
          sideOffset={5}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <ul className="max-h-60 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <li
                key={suggestion.name}
                className={cn(
                  "flex items-center gap-2 p-2 cursor-pointer hover:bg-accent hover:text-accent-foreground",
                  selectedIndex === index && "bg-accent text-accent-foreground"
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelectSuggestion(suggestion)}
              >
                {suggestion.type === 'command' ? <CommandIcon className="h-4 w-4" /> : <ListTodo className="h-4 w-4" />}
                <span>{suggestion.name}</span>
                {suggestion.description && <span className="text-muted-foreground text-xs ml-auto">{suggestion.description}</span>}
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default SchedulerInput;