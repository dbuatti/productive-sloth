import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Plus, Loader2, ListTodo, Command as CommandIcon } from 'lucide-react'; // Import icons
import { cn } from '@/lib/utils';
import { useTasks } from '@/hooks/use-tasks'; // Import useTasks
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'; // Import Popover

interface SchedulerInputProps {
  onCommand: (command: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  inputValue: string;
  setInputValue: (value: string) => void;
}

const SchedulerInput: React.FC<SchedulerInputProps> = ({ onCommand, isLoading = false, placeholder = "Enter task or command...", inputValue, setInputValue }) => {
  const { allTasks } = useTasks(); // Get all tasks for suggestions
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const commonCommands = useMemo(() => [
    { type: 'command', name: 'clear', description: 'Clear all scheduled tasks' },
    { type: 'command', name: 'remove', description: 'Remove a task by name or index' },
    { type: 'command', name: 'inject', description: 'Inject a task with specific details' },
  ], []);

  const suggestions = useMemo(() => {
    if (!inputValue) return [];

    const lowerInput = inputValue.toLowerCase();
    const filteredSuggestions: { type: 'task' | 'command', name: string, description?: string }[] = [];

    // Add command suggestions
    commonCommands.forEach(cmd => {
      if (cmd.name.toLowerCase().startsWith(lowerInput)) {
        filteredSuggestions.push(cmd);
      }
    });

    // Add task title suggestions from My Tasks
    allTasks.forEach(task => {
      if (task.title.toLowerCase().includes(lowerInput) && !filteredSuggestions.some(s => s.name === task.title)) {
        filteredSuggestions.push({ type: 'task', name: task.title, description: `Task: ${task.title}` });
      }
    });

    return filteredSuggestions.slice(0, 5); // Limit to 5 suggestions
  }, [inputValue, allTasks, commonCommands]);

  useEffect(() => {
    if (suggestions.length > 0 && inputValue) {
      setShowSuggestions(true);
      setSelectedIndex(-1); // Reset selection when suggestions change
    } else {
      setShowSuggestions(false);
    }
  }, [suggestions, inputValue]);

  const handleSelectSuggestion = (suggestion: { type: 'task' | 'command', name: string }) => {
    if (suggestion.type === 'command' && suggestion.name === 'clear') {
      onCommand(suggestion.name); // Execute clear command directly
    } else if (suggestion.type === 'command' && suggestion.name === 'remove') {
      setInputValue('remove '); // Pre-fill for remove command
    } else if (suggestion.type === 'command' && suggestion.name === 'inject') {
      setInputValue('inject '); // Pre-fill for inject command
    } else {
      setInputValue(suggestion.name);
    }
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      if (selectedIndex !== -1 && suggestions[selectedIndex]) {
        handleSelectSuggestion(suggestions[selectedIndex]);
      } else {
        onCommand(inputValue.trim());
        setInputValue(''); // Clear input after successful command
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions) {
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

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full animate-slide-in-up relative">
      <Popover open={showSuggestions} onOpenChange={setShowSuggestions}>
        <PopoverTrigger asChild>
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
        </PopoverTrigger>
        {showSuggestions && (
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 z-50">
            <ul className="max-h-60 overflow-y-auto">
              {suggestions.map((suggestion, index) => (
                <li
                  key={suggestion.name}
                  className={cn(
                    "flex items-center gap-2 p-2 cursor-pointer hover:bg-accent hover:text-accent-foreground",
                    selectedIndex === index && "bg-accent text-accent-foreground"
                  )}
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