import { TemporalFilter } from '@/types';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface TemporalFilterTabsProps {
  currentFilter: TemporalFilter;
  setFilter: (filter: TemporalFilter) => void;
}

const TemporalFilterTabs: React.FC<TemporalFilterTabsProps> = ({ currentFilter, setFilter }) => {
  return (
    <Tabs value={currentFilter} onValueChange={(value) => setFilter(value as TemporalFilter)} className="w-full">
      <TabsList className="grid w-full grid-cols-3 h-10">
        <TabsTrigger value="TODAY">Today</TabsTrigger>
        <TabsTrigger value="YESTERDAY">Yesterday</TabsTrigger>
        <TabsTrigger value="LAST_7_DAYS">Last 7 Days</TabsTrigger>
      </TabsList>
    </Tabs>
  );
};

export default TemporalFilterTabs;