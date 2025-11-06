import React, { useState, useEffect } from 'react';
import { Task, TaskPriority } from '@/types';
import { useTasks } from '@/hooks/use-tasks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface TaskEditDialogProps {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TaskEditDialog: React.FC<TaskEditDialogProps> = ({ task, open, onOpenChange }) => {
  const { updateTask } = useTasks();
  const [title, setTitle] = useState(task.title);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);

  useEffect(() => {
    if (open) {
      setTitle(task.title);
      setPriority(task.priority);
    }
  }, [open, task.title, task.priority]);

  const handleSave = () => {
    if (!title.trim()) return;

    updateTask({
      id: task.id,
      title: title.trim(),
      priority: priority,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>
            Make changes to your task here. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">
              Title
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="priority" className="text-right">
              Priority
            </Label>
            <Select value={priority} onValueChange={(value: TaskPriority) => setPriority(value)}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!title.trim()}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TaskEditDialog;