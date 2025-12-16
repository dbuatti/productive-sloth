import { TaskStatusFilter, SortBy } from '@/types'; // Imported missing types
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface TaskControlBarProps {
  statusFilter: TaskStatusFilter;
  setStatusFilter: (filter: TaskStatusFilter) => void;
  sortBy: SortBy;
  setSortBy: (sort: SortBy) => void;
}

const statusOptions: { label: string, value: TaskStatusFilter }[] = [
  { label: 'All Tasks', value: 'ALL' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Completed', value: 'COMPLETED' },
];

const sortOptions: { label: string, value: SortBy }[] = [
  { label: 'Priority (High to Low)', value: 'PRIORITY_HIGH_TO_LOW' },
  { label: 'Priority (Low to High)', value: 'PRIORITY_LOW_TO_HIGH' },
  { label: 'Due Date (Earliest)', value: 'TIME_EARLIEST_TO_LATEST' },
  { label: 'Due Date (Latest)', value: 'TIME_LATEST_TO_EARLIEST' },
];

const TaskControlBar: React.FC<TaskControlBarProps> = ({ statusFilter, setStatusFilter, sortBy, setSortBy }) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0 sm:space-x-4 animate-slide-in-up"> {/* Added animate-slide-in-up */}
      
      {/* Status Filters (Refactored to Tabs) */}
      <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as TaskStatusFilter)} className="w-full sm:w-auto">
        <TabsList className="grid w-full grid-cols-3 h-9 p-1 bg-muted rounded-md">
          {statusOptions.map(option => (
            <TabsTrigger 
              key={option.value}
              value={option.value}
              className={cn(
                "h-8 px-4 py-2 text-sm font-medium rounded-md", /* Changed rounded-sm to rounded-md for consistency */
                "text-muted-foreground hover:bg-muted/50 transition-colors duration-200", /* Added transition */
                "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md", /* Stronger shadow */
                "animate-hover-lift" // Added animate-hover-lift
              )}
            >
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Sort Functionality */}
      <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
        <span className="text-sm text-muted-foreground whitespace-nowrap">Sort by:</span>
        <Select value={sortBy} onValueChange={(value: SortBy) => setSortBy(value)}>
          <SelectTrigger className="w-[200px] focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200 animate-hover-lift"> {/* Increased width */}
            <SelectValue placeholder="Sort Option" />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default TaskControlBar;