import React, { useState } from 'react';
import { RetiredTask, SortBy } from '@/types/scheduler';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ArrowDownWideNarrow, 
  ArrowUpWideNarrow, 
  Shuffle, 
  Sparkles, 
  Zap, 
  Clock, 
  Filter,
  Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { isMeal } from '@/lib/scheduler-utils';

interface AetherSinkProps {
  retiredTasks: RetiredTask[];
  onRezoneTask: (task: RetiredTask) => void;
  onRemoveRetiredTask: (taskId: string, taskName: string) => void;
  onAutoScheduleSink: () => void;
  isLoading: boolean;
  isProcessingCommand: boolean;
  hideTitle?: boolean;
  profileEnergy: number;
  retiredSortBy: SortBy;
  setRetiredSortBy: (sortBy: SortBy) => void;
}

const AetherSink: React.FC<AetherSinkProps> = ({
  retiredTasks,
  onRezoneTask,
  onRemoveRetiredTask,
  onAutoScheduleSink,
  isLoading,
  isProcessingCommand,
  hideTitle = false,
  profileEnergy,
  retiredSortBy,
  setRetiredSortBy
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTasks = retiredTasks.filter(task => 
    task.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    switch (retiredSortBy) {
      case 'TIME_EARLIEST_TO_LATEST':
        return (a.duration || 0) - (b.duration || 0);
      case 'TIME_LATEST_TO_EARLIEST':
        return (b.duration || 0) - (a.duration || 0);
      case 'PRIORITY_HIGH_TO_LOW':
        return (b.energy_cost || 0) - (a.energy_cost || 0);
      case 'PRIORITY_LOW_TO_HIGH':
        return (a.energy_cost || 0) - (b.energy_cost || 0);
      case 'NAME_ASC':
        return a.name.localeCompare(b.name);
      case 'NAME_DESC':
        return b.name.localeCompare(a.name);
      default:
        return new Date(b.retired_at).getTime() - new Date(a.retired_at).getTime();
    }
  });

  const getTaskColorClasses = (task: RetiredTask) => {
    if (task.is_locked) {
      return 'bg-muted text-muted-foreground border-border';
    }
    
    if (task.is_critical) {
      return 'bg-destructive/10 text-destructive border-destructive hover:bg-destructive/20';
    }
    
    if (isMeal(task.name)) {
      return 'bg-logo-green/10 text-logo-green border-logo-green hover:bg-logo-green/20';
    }
    
    return 'bg-primary/5 text-primary border-primary hover:bg-primary/10';
  };

  const handleSortChange = (newSort: SortBy) => {
    setRetiredSortBy(newSort);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Card className="animate-pop-in animate-hover-lift">
      {!hideTitle && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-logo-yellow" />
            Aether Sink
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Tasks stored for later scheduling
          </p>
        </CardHeader>
      )}
      
      <CardContent className="p-6">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-12"
              />
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={onAutoScheduleSink}
                disabled={isProcessingCommand || retiredTasks.length === 0}
                className="h-12 px-4 whitespace-nowrap animate-hover-lift"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Auto-Schedule
              </Button>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button
              variant={retiredSortBy === 'TIME_EARLIEST_TO_LATEST' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSortChange('TIME_EARLIEST_TO_LATEST')}
              className="h-9"
            >
              <ArrowUpWideNarrow className="h-4 w-4 mr-1" />
              Shortest
            </Button>
            
            <Button
              variant={retiredSortBy === 'TIME_LATEST_TO_EARLIEST' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSortChange('TIME_LATEST_TO_EARLIEST')}
              className="h-9"
            >
              <ArrowDownWideNarrow className="h-4 w-4 mr-1" />
              Longest
            </Button>
            
            <Button
              variant={retiredSortBy === 'PRIORITY_HIGH_TO_LOW' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSortChange('PRIORITY_HIGH_TO_LOW')}
              className="h-9"
            >
              <Zap className="h-4 w-4 mr-1" />
              High Energy
            </Button>
            
            <Button
              variant={retiredSortBy === 'PRIORITY_LOW_TO_HIGH' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSortChange('PRIORITY_LOW_TO_HIGH')}
              className="h-9"
            >
              <Zap className="h-4 w-4 mr-1" />
              Low Energy
            </Button>
          </div>
          
          <Separator />
          
          {sortedTasks.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="h-12 w-12 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Aether Sink is empty</h3>
              <p className="text-muted-foreground">
                Tasks you skip or remove from your schedule will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedTasks.map((task) => (
                <Card 
                  key={task.id} 
                  className={cn(
                    "p-4 transition-all duration-200 animate-hover-lift border",
                    getTaskColorClasses(task),
                    isProcessingCommand && "opacity-70 pointer-events-none"
                  )}
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="font-semibold text-base truncate flex-grow">
                        {task.name}
                      </h3>
                      
                      {task.is_locked && (
                        <div className="flex-shrink-0">
                          <Badge variant="secondary" className="text-xs">
                            Locked
                          </Badge>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {task.duration && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {task.duration} min
                        </Badge>
                      )}
                      
                      {task.energy_cost !== undefined && task.energy_cost > 0 && (
                        <Badge 
                          variant="secondary" 
                          className="flex items-center gap-1 bg-logo-yellow/20 text-logo-yellow border-logo-yellow/30"
                        >
                          <Zap className="h-3 w-3" />
                          {task.energy_cost}
                        </Badge>
                      )}
                      
                      {task.is_critical && (
                        <Badge 
                          variant="destructive" 
                          className="flex items-center gap-1"
                        >
                          <Zap className="h-3 w-3" />
                          Critical
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex gap-2 mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onRezoneTask(task)}
                        disabled={isProcessingCommand || task.is_locked}
                        className="flex-grow"
                      >
                        Schedule
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => onRemoveRetiredTask(task.id, task.name)}
                        disabled={isProcessingCommand || task.is_locked}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AetherSink;