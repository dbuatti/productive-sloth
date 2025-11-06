import React, { useEffect } from 'react';
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
import DatePicker from './DatePicker';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';

interface TaskEditDialogProps {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// 1. Define Schema (Shared logic with TaskCreationForm, but defined locally for simplicity)
const TaskEditSchema = z.object({
  title: z.string().min(1, { message: "Task title cannot be empty." }).max(255),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  dueDate: z.date({ required_error: "Due date is required." }),
});

type TaskEditFormValues = z.infer<typeof TaskEditSchema>;

const TaskEditDialog: React.FC<TaskEditDialogProps> = ({ task, open, onOpenChange }) => {
  const { updateTask } = useTasks();

  // 2. Initialize useForm
  const form = useForm<TaskEditFormValues>({
    resolver: zodResolver(TaskEditSchema),
    defaultValues: {
      title: task.title,
      priority: task.priority,
      // Ensure date is initialized as a Date object
      dueDate: new Date(task.due_date), 
    },
    mode: 'onChange',
  });

  // 3. Sync form state when task prop changes or dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        title: task.title,
        priority: task.priority,
        dueDate: new Date(task.due_date),
      });
    }
  }, [open, task, form]);

  // 4. Handle Submission
  const onSubmit = (values: TaskEditFormValues) => {
    const { title, priority, dueDate } = values;

    updateTask({
      id: task.id,
      title: title.trim(),
      priority: priority,
      due_date: dueDate.toISOString(),
    });
    onOpenChange(false);
  };

  const isSubmitting = form.formState.isSubmitting;
  const isValid = form.formState.isValid;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>
            Make changes to your task here. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
            
            {/* Title Input */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="title" className="text-right">Title</Label>
                  <div className="col-span-3">
                    <FormControl>
                      <Input id="title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            {/* Priority Select */}
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="priority" className="text-right">Priority</Label>
                  <div className="col-span-3">
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="HIGH">High</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="LOW">Low</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            {/* Due Date Picker */}
            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="due-date" className="text-right">Due Date</Label>
                  <div className="col-span-3">
                    <FormControl>
                      <DatePicker date={field.value} setDate={field.onChange} placeholder="Select Date" />
                    </FormControl>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting || !isValid}>
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default TaskEditDialog;