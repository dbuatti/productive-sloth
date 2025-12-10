import * as React from "react";
import { Check, ChevronDown, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useEnvironmentContext, environmentOptions, EnvironmentOption } from "@/hooks/use-environment-context";
import { TaskEnvironment } from "@/types/scheduler";

const EnvironmentMultiSelect: React.FC = () => {
  const { selectedEnvironments, toggleEnvironmentSelection, setSelectedEnvironments } = useEnvironmentContext();
  const [open, setOpen] = React.useState(false);

  const selectedOptions = React.useMemo(() => {
    return environmentOptions.filter(opt => selectedEnvironments.includes(opt.value));
  }, [selectedEnvironments]);

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEnvironments([]);
  };

  const renderSelectedBadges = () => {
    if (selectedOptions.length === 0) {
      return <span className="text-muted-foreground">Select Environments... (No Filter)</span>;
    }

    if (selectedOptions.length > 2) {
      return (
        <div className="flex items-center gap-1">
          <Badge variant="secondary" className="text-xs">
            {selectedOptions.length} environments selected
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
            onClick={handleClearAll}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      );
    }

    return (
      <div className="flex flex-wrap gap-1">
        {selectedOptions.map(option => (
          <Badge key={option.value} variant="secondary" className="text-xs flex items-center gap-1">
            <option.icon className="h-3 w-3" />
            {option.label}
          </Badge>
        ))}
      </div>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-10 text-left animate-hover-lift"
        >
          <div className="truncate max-w-[calc(100%-20px)]">
            {renderSelectedBadges()}
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandList>
            <CommandGroup>
              {environmentOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  onSelect={() => {
                    toggleEnvironmentSelection(option.value);
                  }}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedEnvironments.includes(option.value) ? "opacity-100 text-primary" : "opacity-0"
                    )}
                  />
                  <option.icon className="mr-2 h-4 w-4" />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default EnvironmentMultiSelect;