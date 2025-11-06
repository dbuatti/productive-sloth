import { TaskStatusFilter, SortBy } from '@/types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

const TaskControlBar: React.FC<TaskControlBarProps> = ({ statusFilter, setStatusFilter, sortBy, setSortBy }) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0 sm:space-x-4 p-4 bg-muted/50 rounded-lg">
      
      {/* Status Filters */}
      <div className="flex space-x-2 w-full sm:w-auto justify-center">
        {statusOptions.map(option => (
          <Button
            key={option.value}
            // Use outline variant for all, and apply custom background for active state
            variant="outline"
            onClick={() => setStatusFilter(option.value)}
            className={cn(
              "text-sm px-3 py-1 h-auto",
              statusFilter === option.value 
                ? "bg-accent/80 hover:bg-accent/90 text-foreground border-primary/50" // Active state: subtle background
                : "bg-transparent hover:bg-accent" // Inactive state
            )}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {/* Sort Functionality */}
      <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
        <span className="text-sm text-muted-foreground whitespace-nowrap">Sort by:</span>
        <Select value={sortBy} onValueChange={(value: SortBy) => setSortBy(value)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Sort Option" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PRIORITY">Priority</SelectItem>
            <SelectItem value="DUE_DATE">Due Date</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default TaskControlBar;