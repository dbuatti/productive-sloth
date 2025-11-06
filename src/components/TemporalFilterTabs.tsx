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
      <TabsList className="grid w-full grid-cols-4 h-9 p-1 bg-muted rounded-md"> {/* Changed grid-cols-3 to grid-cols-4 */}
        <TabsTrigger 
          value="ALL" 
          className={cn(
            "h-8 px-2 py-2 text-sm font-medium rounded-sm", 
            "text-muted-foreground hover:bg-muted/50", 
            "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
          )}
        >
          All
        </TabsTrigger>
        <TabsTrigger 
          value="OVERDUE" 
          className={cn(
            "h-8 px-2 py-2 text-sm font-medium rounded-sm", 
            "text-muted-foreground hover:bg-muted/50", 
            "data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground data-[state=active]:shadow-sm" // Highlight overdue in destructive color
          )}
        >
          Overdue
        </TabsTrigger>
        <TabsTrigger 
          value="TODAY" 
          className={cn(
            "h-8 px-2 py-2 text-sm font-medium rounded-sm", 
            "text-muted-foreground hover:bg-muted/50", 
            "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
          )}
        >
          Today
        </TabsTrigger>
        <TabsTrigger 
          value="LAST_7_DAYS"
          className={cn(
            "h-8 px-2 py-2 text-sm font-medium rounded-sm",
            "text-muted-foreground hover:bg-muted/50",
            "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
          )}
        >
          Last 7 Days
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
};

export default TemporalFilterTabs;