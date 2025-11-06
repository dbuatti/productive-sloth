import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TaskPriority, NewTask } from '@/types';
import { useTasks } from '@/hooks/use-tasks';
import { Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const TaskCreationForm: React.FC = () => {
  const { addTask } = useTasks();
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newTask: NewTask = {
      title: title.trim(),
      priority: priority,
      metadata_xp: priority === 'HIGH' ? 20 : priority === 'MEDIUM' ? 10 : 5,
      due_date: new Date().toISOString(), // Default to today
    };

    addTask(newTask);
    setTitle('');
    setPriority('MEDIUM');
  };

  return (
    <Card>
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <Input
            type="text"
            placeholder="Add a new task..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-grow"
          />
          <Select value={priority} onValueChange={(value: TaskPriority) => setPriority(value)}>
            <SelectTrigger className="w-full sm:w-[120px] shrink-0">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="LOW">Low</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" disabled={!title.trim()} className="shrink-0 w-full sm:w-auto">
            <Plus className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Add</span>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default TaskCreationForm;