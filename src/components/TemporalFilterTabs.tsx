import { TemporalFilter } from '@/types';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface TemporalFilterTabsProps {
  currentFilter: TemporalFilter;
  setFilter: (filter: TemporalFilter) => void;
}

const TemporalFilterTabs: React.FC<TemporalFilterTabsProps> = ({ currentFilter, setFilter }) => {
  return (
    <Tabs value={currentFilter} onValueChange={(value) => setFilter(value as TemporalFilter)} className="w-full">
      {/* Standardized TabsList styling: h-9, bg-muted, rounded-md */}
      <TabsList className="grid w-full grid-cols-3 h-9 p-1 bg-muted rounded-md">
        <TabsTrigger 
          value="TODAY" 
          className={cn(
            "data-[state=active]:bg-background data-[state=active]:text-foreground", // Removed data-[state=active]:shadow-sm
            "text-sm font-medium" // Added font-medium for emphasis
          )}
        >
          Today
        </TabsTrigger>
        <TabsTrigger 
          value="YESTERDAY"
          className={cn(
            "data-[state=active]:bg-background data-[state=active]:text-foreground", // Removed data-[state=active]:shadow-sm
            "text-sm font-medium" // Added font-medium for emphasis
          )}
        >
          Yesterday
        </TabsTrigger>
        <TabsTrigger 
          value="LAST_7_DAYS"
          className={cn(
            "data-[state=active]:bg-background data-[state=active]:text-foreground", // Removed data-[state=active]:shadow-sm
            "text-sm font-medium" // Added font-medium for emphasis
          )}
        >
          Last 7 Days
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
};

export default TemporalFilterTabs;