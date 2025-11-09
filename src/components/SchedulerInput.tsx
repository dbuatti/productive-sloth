import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SchedulerInputProps {
  onCommand: (command: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  inputValue: string; // Added to make it a controlled component
  setInputValue: (value: string) => void; // Added setter for controlled component
}

const SchedulerInput: React.FC<SchedulerInputProps> = ({ onCommand, isLoading = false, placeholder = "Enter task or command...", inputValue, setInputValue }) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      onCommand(inputValue.trim());
      // Input clearing is now handled by the parent component based on success
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full animate-slide-in-up">
      <Input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder={placeholder}
        disabled={isLoading}
        className="flex-grow h-10 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200"
      />
      <Button type="submit" disabled={isLoading} className="shrink-0 h-10 bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-200">
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        <span className="sr-only">Send</span>
      </Button>
    </form>
  );
};

export default SchedulerInput;