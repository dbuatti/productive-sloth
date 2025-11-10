import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Plus, Loader2, ListTodo, Command as CommandIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTasks } from '@/hooks/use-tasks';
// import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'; // Temporarily removed

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

  // Computed value for showing suggestions
  const shouldShowSuggestions = inputValue.length > 0 && suggestions.length > 0;

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
    if (shouldShowSuggestions) {
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
    <div className="flex flex-col gap-2 w-full animate-slide-in-up relative">
      <form onSubmit={handleSubmit} className="flex gap-2 w-full">
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading}
          className="flex-grow h-10 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200"
        />
        <Button type="submit" disabled={isLoading} className="shrink-0 h-10 bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-200">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          <span className="sr-only">Send</span>
        </Button>
      </form>

      {shouldShowSuggestions && (
        <div className="absolute top-full left-0 right-0 bg-popover border border-border rounded-md shadow-lg z-50 mt-1">
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
        </div>
      )}
    </div>
  );
};

export default SchedulerInput;