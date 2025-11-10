import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Plus, Loader2, ListTodo, Command as CommandIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTasks } from '@/hooks/use-tasks';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface Suggestion {
  type: 'command' | 'task';
  name: string;
  description?: string;
}

interface SchedulerInputProps {
  onCommand: (command: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  inputValue: string;
  setInputValue: (value: string) => void;
}

const SchedulerInput: React.FC<SchedulerInputProps> = ({ onCommand, isLoading = false, placeholder = "Enter task or command...", inputValue, setInputValue }) => {
  const { allTasks } = useTasks();
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const commonCommands = useMemo<Suggestion[]>(() => [
    { type: 'command', name: 'clear', description: 'Clear all scheduled tasks' },
    { type: 'command', name: 'remove', description: 'Remove a task by name or index' },
    { type: 'command', name: 'inject', description: 'Inject a task with specific details' },
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

  // Computed value for popover open state
  const shouldPopoverOpen = inputValue.length > 0 && suggestions.length > 0;

  // Effect to ensure input remains focused when popover opens
  useEffect(() => {
    if (shouldPopoverOpen && inputRef.current && document.activeElement !== inputRef.current) {
      // Use a small timeout to ensure it runs after any potential blur caused by rendering the popover
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 0); 
      return () => clearTimeout(timer);
    }
    // Reset selected index when suggestions change or popover closes
    if (!shouldPopoverOpen) {
      setSelectedIndex(-1);
    }
  }, [shouldPopoverOpen]); // Depend on the computed value

  const handleSelectSuggestion = (suggestion: Suggestion) => {
    if (suggestion.type === 'command' && suggestion.name === 'clear') {
      onCommand(suggestion.name);
    } else if (suggestion.type === 'command' && suggestion.name === 'remove') {
      setInputValue('remove ');
    } else if (suggestion.type === 'command' && suggestion.name === 'inject') {
      setInputValue('inject ');
    } else {
      setInputValue(suggestion.name);
    }
    setSelectedIndex(-1);
    inputRef.current?.focus(); // Explicitly focus after selection
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      if (selectedIndex !== -1 && suggestions[selectedIndex]) {
        handleSelectSuggestion(suggestions[selectedIndex]);
      } else {
        onCommand(inputValue.trim());
        setInputValue('');
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (shouldPopoverOpen) { // Use shouldPopoverOpen here
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
      } else if (e.key === 'Enter' && selectedIndex !== -1) {
        e.preventDefault(); // Prevent form submission
        handleSelectSuggestion(suggestions[selectedIndex]);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full animate-slide-in-up relative">
      <Popover open={shouldPopoverOpen} onOpenChange={(open) => {
        // This onOpenChange handler is primarily for reacting to external close events (like escape key or click outside).
        // The `open={shouldPopoverOpen}` prop already controls the popover's visibility based on input and suggestions.
        // If `shouldPopoverOpen` is true, the popover will remain open regardless of this callback trying to close it.
      }} modal={false}>
        <PopoverTrigger asChild>
          <Input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onMouseDown={(e) => e.preventDefault()} // Keep this to prevent blur on input click
            placeholder={placeholder}
            disabled={isLoading}
            className="flex-grow h-10 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200"
          />
        </PopoverTrigger>
        {shouldPopoverOpen && ( // Render content only if popover is open
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 z-50">
            <ul className="max-h-60 overflow-y-auto">
              {suggestions.map((suggestion, index) => (
                <li
                  key={suggestion.name}
                  className={cn(
                    "flex items-center gap-2 p-2 cursor-pointer hover:bg-accent hover:text-accent-foreground",
                    selectedIndex === index && "bg-accent text-accent-foreground"
                  )}
                  onMouseDown={(e) => e.preventDefault()} // Prevent focus loss on suggestion click
                  onClick={() => handleSelectSuggestion(suggestion)}
                >
                  {suggestion.type === 'command' ? <CommandIcon className="h-4 w-4" /> : <ListTodo className="h-4 w-4" />}
                  <span>{suggestion.name}</span>
                  {suggestion.description && <span className="text-muted-foreground text-xs ml-auto">{suggestion.description}</span>}
                </li>
              ))}
            </ul>
          </PopoverContent>
        )}
      </Popover>
      <Button type="submit" disabled={isLoading} className="shrink-0 h-10 bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-200">
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        <span className="sr-only">Send</span>
      </Button>
    </form>
  );
};

export default SchedulerInput;