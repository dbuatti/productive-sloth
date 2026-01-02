"use client";

import * as React from "react";
import { Check, ChevronDown, X, Filter, Zap } from "lucide-react";
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
import { useEnvironmentContext, environmentOptions } from "@/hooks/use-environment-context";

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
      return (
        <div className="flex items-center gap-2 text-muted-foreground/50 italic font-medium text-[10px] uppercase tracking-widest">
          <Zap className="h-3 w-3" /> All Zones
        </div>
      );
    }

    if (selectedOptions.length > 2) {
      return (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 font-bold text-[10px] uppercase tracking-tighter">
            {selectedOptions.length} Zones
          </Badge>
          <div 
            className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-colors cursor-pointer"
            onClick={handleClearAll}
          >
            <X className="h-3 w-3" />
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-wrap gap-1.5">
        {selectedOptions.map(option => (
          <Badge 
            key={option.value} 
            variant="outline" 
            className="bg-background/50 border-primary/20 text-primary font-bold text-[10px] uppercase tracking-tight flex items-center gap-1 py-0.5 px-2"
          >
            <option.icon className="h-2.5 w-2.5" />
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
          variant="glass"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between h-10 px-3 border-white/5 shadow-sm transition-all duration-300 rounded-lg",
            open && "border-primary/40 ring-1 ring-primary/20"
          )}
        >
          <div className="flex items-center gap-2 truncate max-w-[calc(100%-24px)]">
            <Filter className={cn("h-3.5 w-3.5 transition-colors", selectedOptions.length > 0 ? "text-primary" : "text-muted-foreground/30")} />
            {renderSelectedBadges()}
          </div>
          <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-300 opacity-30", open && "rotate-180 opacity-100 text-primary")} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0 glass-card border-white/10 shadow-2xl animate-pop-in" sideOffset={8}>
        <Command className="bg-transparent">
          <CommandList className="scrollbar-none">
            <CommandGroup className="p-2">
              <div className="px-2 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
                Environment Filter
              </div>
              {environmentOptions.map((option) => {
                const isSelected = selectedEnvironments.includes(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => toggleEnvironmentSelection(option.value)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 mb-1",
                      "hover:bg-primary/10 data-[selected='true']:bg-primary/5",
                      isSelected && "text-primary font-bold"
                    )}
                  >
                    <div className={cn(
                      "flex items-center justify-center h-5 w-5 rounded border transition-all duration-300",
                      isSelected ? "bg-primary border-primary shadow-[0_0_8px_hsl(var(--primary))]" : "border-white/10 bg-white/5"
                    )}>
                      {isSelected && <Check className="h-3 w-3 text-background stroke-[4px]" />}
                    </div>
                    <option.icon className={cn("h-4 w-4 transition-colors", isSelected ? "text-primary" : "text-muted-foreground/50")} />
                    <span className="text-sm tracking-tight">{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default EnvironmentMultiSelect;