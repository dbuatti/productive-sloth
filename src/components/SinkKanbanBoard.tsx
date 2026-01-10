import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/hooks/use-session';
import { TaskEnvironment } from '@/types/scheduler';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Home, Laptop, Globe, Music, Zap, Briefcase, Coffee, Star, Clock, CalendarDays, ListOrdered } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEnvironments } from '@/hooks/use-environments';
import { Environment } from '@/hooks/use-environments'; // Import Environment type
import { TaskPriority } from '@/types';

interface SinkKanbanBoardProps {
  selectedDayString: string;
}

type GroupByOption = 'environment' | 'priority';

const SinkKanbanBoard: React.FC<SinkKanbanBoardProps> = ({ selectedDayString }) => {
  const { user } = useSession();
  const userId = user?.id;
  const { environments, isLoading: isLoadingEnvironments } = useEnvironments();
  const [groupBy, setGroupBy] = useState<GroupByOption>('environment');

  const { data: retiredTasks = [], isLoading: isLoadingRetiredTasks } = useQuery<any[]>({
    queryKey: ['retired_tasks_for_sink', userId, selectedDayString],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('retired_tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('scheduled_date', selectedDayString)
        .order('retired_at', { ascending: false });

      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!userId,
  });

  const groupedTasks = useMemo(() => {
    const groups: Record<string, any[]> = {};

    retiredTasks.forEach(task => {
      let groupKey: string;
      if (groupBy === 'environment') {
        groupKey = task.task_environment || 'unknown';
      } else { // groupBy === 'priority'
        groupKey = task.priority || 'MEDIUM';
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(task);
    });

    return groups;
  }, [retiredTasks, groupBy]);

  const getPriorityBadgeClasses = useCallback((priority: TaskPriority) => {
    switch (priority) {
      case 'HIGH':
        return 'bg-destructive text-destructive-foreground border-destructive';
      case 'MEDIUM':
        return 'bg-logo-orange/20 text-logo-orange border-logo-orange';
      case 'LOW':
        return 'bg-logo-green/20 text-logo-green border-logo-green';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  }, []);

  if (isLoadingRetiredTasks || isLoadingEnvironments) {
    return <div>Loading...</div>;
  }

  if (retiredTasks.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No tasks have been retired for {selectedDayString}.
      </div>
    );
  }

  const sortedGroupKeys = useMemo(() => {
    if (groupBy === 'environment') {
      // Sort environments by custom order if available, otherwise alphabetically
      const customOrder = environments.map(env => env.value);
      return Object.keys(groupedTasks).sort((a, b) => {
        const indexA = customOrder.indexOf(a);
        const indexB = customOrder.indexOf(b);
        if (indexA === -1 && indexB === -1) return a.localeCompare(b); // Both not in custom order, sort alphabetically
        if (indexA === -1) return 1; // A not in custom order, B comes first
        if (indexB === -1) return -1; // B not in custom order, A comes first
        return indexA - indexB; // Sort by custom order
      });
    } else { // groupBy === 'priority'
      const priorityOrder: Record<TaskPriority, number> = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
      return Object.keys(groupedTasks).sort((a, b) => {
        const priorityA = priorityOrder[a as TaskPriority] || 0;
        const priorityB = priorityOrder[b as TaskPriority] || 0;
        return priorityB - priorityA; // Descending priority
      });
    }
  }, [groupedTasks, groupBy, environments]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ListOrdered className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-muted-foreground">Group by:</span>
        <select
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as GroupByOption)}
          className="bg-background border rounded-md px-2 py-1 text-sm"
        >
          <option value="environment">Environment</option>
          <option value="priority">Priority</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedGroupKeys.map(id => {
          const tasksInGroup = groupedTasks[id];
          let label = id;
          let Icon: React.ElementType = Home; // Default icon
          let color = 'hsl(var(--primary))';

          if (groupBy === 'environment') {
            const env = environments.find(e => e.value === id);
            label = env?.label || id;
            Icon = env?.icon || Home; // Directly use env.icon, fallback to Home
            color = env?.color || 'hsl(var(--primary))';
          } else if (groupBy === 'priority') {
            label = `${id} Priority`;
            switch (id as TaskPriority) {
              case 'HIGH': Icon = Star; color = 'hsl(var(--destructive))'; break;
              case 'MEDIUM': Icon = Clock; color = 'hsl(var(--logo-orange))'; break;
              case 'LOW': Icon = CalendarDays; color = 'hsl(var(--logo-green))'; break;
              default: Icon = Home; color = 'hsl(var(--primary))'; break;
            }
          }

          return (
            <Card key={id} className="relative">
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                  <Icon className="h-5 w-5" style={{ color }} />
                  <span>{label} ({tasksInGroup.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {tasksInGroup.map(task => (
                  <div key={task.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm">
                    <span className="font-medium">{task.name}</span>
                    <div className="flex items-center gap-2">
                      {task.is_work && <Badge variant="secondary" className="bg-blue-500/20 text-blue-500 border-blue-500/30">Work</Badge>}
                      {task.is_break && <Badge variant="secondary" className="bg-logo-orange/20 text-logo-orange border-logo-orange/30">Break</Badge>}
                      <Badge variant="outline" className={getPriorityBadgeClasses(task.priority)}>
                        {task.priority}
                      </Badge>
                      <span className="flex items-center gap-1 text-logo-yellow font-semibold">
                        <Zap className="h-3 w-3" /> {task.energy_cost}
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default SinkKanbanBoard;