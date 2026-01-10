import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/hooks/use-session';
import { format, startOfWeek, endOfWeek, addDays, isSameDay, parseISO } from 'date-fns';
import { Calendar as CalendarIcon, Plus, Loader2, Trash2, ArrowRightCircle, Settings, ListOrdered } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { showSuccess, showError } from '@/utils/toast';
import { RetiredTask } from '@/types/scheduler';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import { useIsMobile } from '@/hooks/use-mobile';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import RetiredTaskDetailDialog from '@/components/RetiredTaskDetailDialog';
import SinkKanbanBoard from '@/components/SinkKanbanBoard'; // Import SinkKanbanBoard

type GroupingOption = 'environment' | 'priority';

const AetherSink: React.FC = () => {
  const { user } = useSession();
  const userId = user?.id;
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupingOption>('environment');
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedRetiredTask, setSelectedRetiredTask] = useState<RetiredTask | null>(null);

  const formattedSelectedDate = format(selectedDate, 'yyyy-MM-dd');

  const { data: retiredTasks = [], isLoading: isLoadingRetiredTasks } = useQuery<RetiredTask[]>({
    queryKey: ['retired_tasks', userId, formattedSelectedDate],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('retired_tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('scheduled_date', formattedSelectedDate)
        .order('retired_at', { ascending: false });

      if (error) throw new Error(error.message);
      return data as RetiredTask[];
    },
    enabled: !!userId,
  });

  const { removeRetiredTask, rezoneRetiredTask, updateRetiredTask } = useSchedulerTasks(formattedSelectedDate);

  const handleRemoveRetiredTask = async (taskId: string, taskName: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${taskName}" from the sink? This cannot be undone.`)) {
      return;
    }
    try {
      await removeRetiredTask(taskId);
      showSuccess(`Task "${taskName}" permanently removed from sink.`);
      queryClient.invalidateQueries({ queryKey: ['retired_tasks', userId, formattedSelectedDate] });
    } catch (error) {
      showError(`Failed to remove task "${taskName}".`);
      console.error("Error removing retired task:", error);
    }
  };

  const handleRezoneTask = async (task: RetiredTask) => {
    if (!window.confirm(`Are you sure you want to re-zone "${task.name}" back to its original scheduled date (${format(parseISO(task.original_scheduled_date), 'MMM d, yyyy')})?`)) {
      return;
    }
    try {
      await rezoneRetiredTask(task);
      showSuccess(`Task "${task.name}" re-zoned successfully.`);
      queryClient.invalidateQueries({ queryKey: ['retired_tasks', userId, formattedSelectedDate] });
      queryClient.invalidateQueries({ queryKey: ['scheduled_tasks', userId, format(parseISO(task.original_scheduled_date), 'yyyy-MM-dd')] });
    } catch (error) {
      showError(`Failed to re-zone task "${task.name}".`);
      console.error("Error re-zoning retired task:", error);
    }
  };

  const handleOpenDetailDialog = (task: RetiredTask) => {
    setSelectedRetiredTask(task);
    setIsDetailDialogOpen(true);
  };

  const handleDetailDialogClose = () => {
    setIsDetailDialogOpen(false);
    setSelectedRetiredTask(null);
    queryClient.invalidateQueries({ queryKey: ['retired_tasks', userId, formattedSelectedDate] });
  };

  const renderContent = () => {
    if (isLoadingRetiredTasks) {
      return (
        <div className="flex justify-center items-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    if (retiredTasks.length === 0) {
      return (
        <div className="text-center text-muted-foreground py-8">
          No tasks have been retired for {format(selectedDate, 'MMM d, yyyy')}.
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Grouping selector moved to SinkKanbanBoard */}
        <SinkKanbanBoard 
          selectedDayString={formattedSelectedDate}
          // Removed retiredTasks, groupBy, and action props as SinkKanbanBoard now manages them internally
        />
      </div>
    );
  };

  const renderCalendar = () => {
    const today = new Date();
    const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 1 }); // Monday
    const days = Array.from({ length: 7 }).map((_, i) => addDays(startOfCurrentWeek, i));

    return (
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">Aether Sink</h2>
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-[180px] justify-start text-left font-normal",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  if (date) {
                    setSelectedDate(date);
                    setIsCalendarOpen(false);
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex space-x-2 overflow-x-auto pb-2 no-scrollbar">
          {days.map(day => (
            <Button
              key={day.toISOString()}
              variant={isSameDay(day, selectedDate) ? 'default' : 'outline'}
              onClick={() => setSelectedDate(day)}
              className="flex-shrink-0"
            >
              {format(day, 'EEE d')}
            </Button>
          ))}
        </div>
        {renderContent()}
      </div>
    );
  };

  if (isMobile) {
    return (
      <Drawer open={isDetailDialogOpen} onOpenChange={handleDetailDialogClose}>
        <div className="p-4">
          {renderCalendar()}
        </div>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Task Details</DrawerTitle>
          </DrawerHeader>
          {selectedRetiredTask && (
            <RetiredTaskDetailDialog
              task={selectedRetiredTask}
              open={isDetailDialogOpen}
              onOpenChange={handleDetailDialogClose}
            />
          )}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <div className="p-4">
      {renderCalendar()}
      {selectedRetiredTask && (
        <RetiredTaskDetailDialog
          task={selectedRetiredTask}
          open={isDetailDialogOpen}
          onOpenChange={handleDetailDialogClose}
        />
      )}
    </div>
  );
};

export default AetherSink;