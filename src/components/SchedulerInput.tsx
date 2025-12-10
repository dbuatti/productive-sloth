import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Zap, Plus, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';
import { Card } from '@/components/ui/card';

interface SchedulerInputProps {
  onCommand: (input: string) => void;
  isLoading: boolean;
  inputValue: string;
  setInputValue: (value: string) => void;
  placeholder?: string;
  onDetailedInject?: () => void;
  onStartRegenPod?: () => void;
}

const SchedulerInput: React.FC<SchedulerInputProps> = ({
  onCommand,
  isLoading,
  inputValue,
  setInputValue,
  placeholder = "Enter command or task...",
  onDetailedInject,
  onStartRegenPod
}) => {
  const isMobile = useIsMobile();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      onCommand(inputValue.trim());
    }
  };

  const handleQuickAdd = () => {
    if (onDetailedInject) {
      onDetailedInject();
      if (isMobile) setIsDrawerOpen(false);
    }
  };

  const handleRegenPod = () => {
    if (onStartRegenPod) {
      onStartRegenPod();
      if (isMobile) setIsDrawerOpen(false);
    }
  };

  useEffect(() => {
    if (inputRef.current && !isMobile) {
      inputRef.current.focus();
    }
  }, [isMobile]);

  const inputElement = (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full">
      <div className="relative flex-grow">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={placeholder}
          disabled={isLoading}
          className="pr-12 h-12 text-base focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200"
        />
        <Button
          type="submit"
          size="icon"
          disabled={isLoading || !inputValue.trim()}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-200"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );

  if (isMobile) {
    return (
      <Card className="p-4 animate-slide-in-up shadow-md">
        <div className="flex gap-2">
          <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <DrawerTrigger asChild>
              <Button variant="outline" size="icon" className="h-12 w-12 shrink-0">
                <Settings className="h-5 w-5" />
              </Button>
            </DrawerTrigger>
            <DrawerContent className="p-4">
              <div className="space-y-3">
                <Button 
                  onClick={handleQuickAdd} 
                  variant="outline" 
                  className="w-full justify-start h-12"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Detailed Task
                </Button>
                <Button 
                  onClick={handleRegenPod} 
                  variant="outline" 
                  className="w-full justify-start h-12"
                >
                  <Zap className="h-5 w-5 mr-2" />
                  Energy Regen Pod
                </Button>
              </div>
            </DrawerContent>
          </Drawer>
          
          {inputElement}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 animate-slide-in-up shadow-md">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                onClick={handleQuickAdd} 
                variant="outline" 
                size="icon" 
                className="h-12 w-12"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Add Detailed Task</p>
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                onClick={handleRegenPod} 
                variant="outline" 
                size="icon" 
                className="h-12 w-12"
              >
                <Zap className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Energy Regen Pod</p>
            </TooltipContent>
          </Tooltip>
        </div>
        
        <div className="flex-grow">
          {inputElement}
        </div>
      </div>
    </Card>
  );
};

export default SchedulerInput;