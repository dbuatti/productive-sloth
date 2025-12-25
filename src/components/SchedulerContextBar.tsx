"use client";

import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Zap } from 'lucide-react';

interface SchedulerInputProps {
  onCommand: (val: string) => Promise<void>;
  isLoading: boolean;
  inputValue: string;
  setInputValue: (val: string) => void;
  placeholder: string;
  onDetailedInject: () => void;
}

const SchedulerInput: React.FC<SchedulerInputProps> = ({
  onCommand,
  isLoading,
  inputValue,
  setInputValue,
  placeholder,
  onDetailedInject
}) => {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    await onCommand(inputValue);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="relative flex-grow">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={placeholder}
          disabled={isLoading}
          className="h-12 bg-background/50 border-primary/20 pr-10 font-medium"
        />
        <Zap className="absolute right-3 top-3.5 h-5 w-5 text-primary/20" />
      </div>
      <Button 
        type="submit" 
        disabled={isLoading || !inputValue.trim()} 
        className="h-12 w-12 rounded-xl"
      >
        {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : <Plus className="h-5 w-5" />}
      </Button>
      <Button 
        type="button" 
        variant="outline" 
        onClick={onDetailedInject}
        className="h-12 px-4 border-dashed border-primary/30 text-primary hover:bg-primary/5"
      >
        Detail
      </Button>
    </form>
  );
};

export default SchedulerInput;