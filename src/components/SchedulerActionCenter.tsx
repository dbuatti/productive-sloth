import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlusCircle, Sparkles, Archive, RefreshCcw, Coffee, Zap, ListTodo, Clock, CalendarDays, ChevronDown } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { SortBy } from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface SchedulerActionCenterProps {
  inputValue: string; // Added this prop
  setInputValue: React.Dispatch<React.SetStateAction<string>>; // Added this prop
  handleCommand: (input: string) => Promise<void>;
  isProcessingCommand: boolean;
  onAddTaskClick: () => void;
  onQuickBreakClick: () => Promise<void>;
  onAutoScheduleDay: () => Promise<void>;
  onZoneFocus: () => Promise<void>;
  onCompactSchedule: () => Promise<void>;
  onRandomizeBreaks: () => Promise<void>;
  onAetherDump: () => Promise<void>;
  onAetherDumpMega: () => Promise<void>;
  onAddTimeOffClick: () => void;
  onRefreshSchedule: () => void;
  sortBy: SortBy;
  setSortBy: (sortBy: SortBy) => Promise<void>;
  isMobile: boolean;
}

const SchedulerActionCenter: React.FC<SchedulerActionCenterProps> = ({
  inputValue,
  setInputValue,
  handleCommand,
  isProcessingCommand,
  onAddTaskClick,
  onQuickBreakClick,
  onAutoScheduleDay,
  onZoneFocus,
  onCompactSchedule,
  onRandomizeBreaks,
  onAetherDump,
  onAetherDumpMega,
  onAddTimeOffClick,
  onRefreshSchedule,
  sortBy,
  setSortBy,
  isMobile,
}) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isProcessingCommand) {
      handleCommand(inputValue);
    }
  };

  const renderDesktopActions = () => (
    <div className="flex flex-wrap items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={onAddTaskClick}
            disabled={isProcessingCommand}
            className="flex items-center gap-1"
          >
            <PlusCircle className="h-4 w-4" /> Add Task
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Add a new task to your schedule.</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={onQuickBreakClick}
            disabled={isProcessingCommand}
            className="flex items-center gap-1"
          >
            <Coffee className="h-4 w-4" /> Quick Break
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Inject a 15-minute break into your schedule.</p>
        </TooltipContent>
      </Tooltip>

      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={isProcessingCommand}
                className="flex items-center gap-1"
              >
                <Sparkles className="h-4 w-4 text-logo-yellow" /> Auto-Schedule <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Automate your schedule with AI.</p>
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onAutoScheduleDay} disabled={isProcessingCommand}>
            Auto-Schedule Day (All Flexible)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onZoneFocus} disabled={isProcessingCommand}>
            Zone Focus (Current Environment)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onCompactSchedule} disabled={isProcessingCommand}>
            Compact Schedule
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onRandomizeBreaks} disabled={isProcessingCommand}>
            Randomize Breaks
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onAetherDump} disabled={isProcessingCommand}>
            Aether Dump (Flexible to Sink)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onAetherDumpMega} disabled={isProcessingCommand}>
            Aether Dump Mega (All to Sink)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={isProcessingCommand}
                className="flex items-center gap-1"
              >
                <ListTodo className="h-4 w-4" /> Sort By <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Change how flexible tasks are sorted.</p>
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setSortBy('TIME_EARLIEST_TO_LATEST')} disabled={isProcessingCommand}>
            Duration (Shortest First)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setSortBy('TIME_LATEST_TO_EARLIEST')} disabled={isProcessingCommand}>
            Duration (Longest First)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setSortBy('PRIORITY_HIGH_TO_LOW')} disabled={isProcessingCommand}>
            Priority (High to Low)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setSortBy('PRIORITY_LOW_TO_HIGH')} disabled={isProcessingCommand}>
            Priority (Low to High)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setSortBy('NAME_ASC')} disabled={isProcessingCommand}>
            Name (A-Z)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setSortBy('NAME_DESC')} disabled={isProcessingCommand}>
            Name (Z-A)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setSortBy('EMOJI')} disabled={isProcessingCommand}>
            Emoji Hue
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefreshSchedule}
            disabled={isProcessingCommand}
          >
            <RefreshCcw className="h-4 w-4" />
            <span className="sr-only">Refresh Schedule</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Refresh Schedule Data</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );

  const renderMobileActions = () => (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onAddTaskClick}
          disabled={isProcessingCommand}
          className="flex items-center gap-1"
        >
          <PlusCircle className="h-4 w-4" /> Add Task
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onQuickBreakClick}
          disabled={isProcessingCommand}
          className="flex items-center gap-1"
        >
          <Coffee className="h-4 w-4" /> Quick Break
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={isProcessingCommand}
              className="flex items-center gap-1"
            >
              <Sparkles className="h-4 w-4 text-logo-yellow" /> Auto-Schedule <ChevronDown className="ml-1 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onAutoScheduleDay} disabled={isProcessingCommand}>
              Auto-Schedule Day (All Flexible)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onZoneFocus} disabled={isProcessingCommand}>
              Zone Focus (Current Environment)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCompactSchedule} disabled={isProcessingCommand}>
              Compact Schedule
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRandomizeBreaks} disabled={isProcessingCommand}>
              Randomize Breaks
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onAetherDump} disabled={isProcessingCommand}>
              Aether Dump (Flexible to Sink)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onAetherDumpMega} disabled={isProcessingCommand}>
              Aether Dump Mega (All to Sink)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={isProcessingCommand}
              className="flex items-center gap-1"
            >
              <ListTodo className="h-4 w-4" /> Sort By <ChevronDown className="ml-1 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setSortBy('TIME_EARLIEST_TO_LATEST')} disabled={isProcessingCommand}>
              Duration (Shortest First)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortBy('TIME_LATEST_TO_EARLIEST')} disabled={isProcessingCommand}>
              Duration (Longest First)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortBy('PRIORITY_HIGH_TO_LOW')} disabled={isProcessingCommand}>
              Priority (High to Low)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortBy('PRIORITY_LOW_TO_HIGH')} disabled={isProcessingCommand}>
              Priority (Low to High)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortBy('NAME_ASC')} disabled={isProcessingCommand}>
              Name (A-Z)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortBy('NAME_DESC')} disabled={isProcessingCommand}>
              Name (Z-A)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortBy('EMOJI')} disabled={isProcessingCommand}>
              Emoji Hue
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 p-4 bg-background rounded-lg shadow-sm border mb-4">
      <form onSubmit={handleInputSubmit} className="flex gap-2">
        <Input
          type="text"
          placeholder="Add task (e.g., 'Task 30m', 'Task 9am-10am') or command (e.g., 'clear', 'aether dump')"
          value={inputValue}
          onChange={handleInputChange}
          disabled={isProcessingCommand}
          className="flex-grow"
        />
        <Button type="submit" disabled={isProcessingCommand}>
          {isProcessingCommand ? 'Processing...' : 'Go'}
        </Button>
      </form>

      {isMobile ? renderMobileActions() : renderDesktopActions()}
    </div>
  );
};

export default SchedulerActionCenter;