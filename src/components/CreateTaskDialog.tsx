import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TaskPriority, NewTask } from '@/types';
import { useTasks } from '@/hooks/use-tasks';
import { Plus, Loader2, AlignLeft } from 'lucide-react';
import DatePicker from './DatePicker';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

// 1. Define Schema
const TaskCreationSchema = z.object({
  title: z.string().min(1, { message: "Task title cannot be empty." }).max(255),
  description: z.string().max(1000).optional(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  dueDate: z.date({ required_error: "Due date is required." }),
});

type TaskCreationFormValues = z.infer<typeof TaskCreationSchema>;

interface CreateTaskDialogProps {
  defaultPriority: TaskPriority;
  defaultDueDate: Date;
  onTaskCreated: () => void;
}

const CreateTaskDialog: React.FC<CreateTaskDialogProps> = ({ defaultPriority, defaultDueDate, onTaskCreated }) => {
  const { addTask } = useTasks();
  const [isOpen, setIsOpen] = React.useState(false);
  
  // 2. Initialize useForm
  const form = useForm<TaskCreationFormValues>({
    resolver: zodResolver(TaskCreationSchema),
    defaultValues: {
      title: '',
      description: '',
      priority: defaultPriority,
      dueDate: defaultDueDate,
    },
    mode: 'onChange',
  });

  // 3. Handle Submission
  const onSubmit = (values: TaskCreationFormValues) => {
    const { title, priority, dueDate, description } = values;

    const newTask: NewTask = {
      title: title.trim(),
      description: description?.trim() || undefined,
      priority: priority,
      metadata_xp: priority === 'HIGH' ? 20 : priority === 'MEDIUM' ? 10 : 5,
      energy_cost: priority === 'HIGH' ? 15 : priority === 'MEDIUM' ? 10 : 5,
      due_date: dueDate.toISOString(),
    };

    addTask(newTask, {
      onSuccess: () => {
        onTaskCreated();
        setIsOpen(false);
        // Reset title and description, but retain priority and dueDate
        form.reset({
          title: '',
          description: '',
          priority: values.priority, 
          dueDate: values.dueDate, 
        });
      }
    });
  };

  const isSubmitting = form.formState.isSubmitting;
  const isValid = form.formState.isValid;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="icon" 
          className="shrink-0 h-10 w-10 text-primary hover:bg-primary/10 transition-all duration-200"
          onClick={() => setIsOpen(true)}
        >
          <AlignLeft className="h-4 w-4" />
          <span className="sr-only">Add Description</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] animate-pop-in">
        <DialogHeader>
          <DialogTitle>Add Task Details</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
            {/* Title Input (Duplicated for validation consistency, but hidden if already in main form) */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Task title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description Textarea */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Add detailed notes or context here..." 
                      {...field} 
                      value={field.value || ''}
                      rows={4}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Priority Select */}
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
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
                </FormItem>
              )}
            />

            {/* Due Date Picker */}
            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Due Date</FormLabel>
                  <FormControl>
                    <DatePicker 
                      date={field.value} 
                      setDate={field.onChange} 
                      placeholder="Pick a date"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button 
              type="submit" 
              disabled={isSubmitting || !isValid} 
              className="w-full flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-200"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create Task
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTaskDialog;