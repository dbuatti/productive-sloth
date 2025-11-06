import { TaskStatusFilter, SortBy } from '@/types';
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

const TaskControlBar: React.FC<TaskControlBarProps> = ({ statusFilter, setStatusFilter, sortBy, setSortBy }) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0 sm:space-x-4 p-0">
      
      {/* Status Filters (Refactored to Tabs) */}
      <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as TaskStatusFilter)} className="w-full sm:w-auto">
        <TabsList className="grid w-full grid-cols-3 h-9 p-1 bg-background/50 border">
          {statusOptions.map(option => (
            <TabsTrigger 
              key={option.value}
              value={option.value}
              className={cn(
                "text-sm px-3 py-1 h-auto",
                "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
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