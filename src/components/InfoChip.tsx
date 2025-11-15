import React from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface InfoChipProps {
  onClick: () => void;
  isHovered: boolean;
  tooltipContent?: string;
}

const InfoChip: React.FC<InfoChipProps> = ({ onClick, isHovered, tooltipContent = "View/Edit Properties" }) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClick}
          className={cn(
            "absolute bottom-2 right-2 h-6 w-6 rounded-full p-0",
            "bg-secondary/50 text-muted-foreground border border-transparent",
            "transition-all duration-200 ease-in-out",
            isHovered ? "opacity-100 scale-100 bg-primary/10 text-primary border-primary/50 shadow-md" : "opacity-0 scale-90 pointer-events-none"
          )}
        >
          <Info className="h-4 w-4" />
          <span className="sr-only">View/Edit Properties</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltipContent}</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default InfoChip;