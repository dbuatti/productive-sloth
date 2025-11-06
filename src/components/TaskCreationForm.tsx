import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TaskPriority, NewTask } from '@/types';
import { useTasks } from '@/hooks/use-tasks';
import { Plus } from 'lucide-react';
import DatePicker from './DatePicker';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';

// 1. Define Schema
const TaskCreationSchema = z.object({
  title: z.string().min(1, { message: "Task title cannot be empty." }).max(255),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  dueDate: z.date({ required_error: "Due date is required." }),
});

type TaskCreationFormValues = z.infer<typeof TaskCreationSchema>;

const TaskCreationForm: React.FC = () => {
  const { addTask } = useTasks();
  
  // 2. Initialize useForm
  const form = useForm<TaskCreationFormValues>({
    resolver: zodResolver(TaskCreationSchema),
    defaultValues: {
      title: '',
      priority: 'MEDIUM',
      dueDate: new Date(), // Default to today
    },
    mode: 'onChange', // Enable validation on change
  });

  // 3. Handle Submission
  const onSubmit = (values: TaskCreationFormValues) => {
    const { title, priority, dueDate } = values;

    const newTask: NewTask = {
      title: title.trim(),
      priority: priority,
      metadata_xp: priority === 'HIGH' ? 20 : priority === 'MEDIUM' ? 10 : 5, // Assign XP based on priority
      due_date: dueDate.toISOString(),
    };

    addTask(newTask);
    
    // Reset title, but retain the priority and dueDate for batch entry
    form.reset({
      title: '',
      priority: values.priority, 
      dueDate: values.dueDate, 
    });
  };

  const isSubmitting = form.formState.isSubmitting;
  const isValid = form.formState.isValid;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col sm:flex-row gap-2">
        
        {/* Title Input */}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem className="flex-grow min-w-[150px]">
              <FormControl>
                <Input
                  placeholder="Add a new task..."
                  {...field}
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
            <FormItem className="w-full sm:w-[120px] shrink-0">
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
            <FormItem className="shrink-0">
              <FormControl>
                <DatePicker 
                  date={field.value} 
                  setDate={field.onChange} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Submit Button */}
        <Button 
          type="submit" 
          disabled={isSubmitting || !isValid} 
          className="shrink-0 w-full sm:w-auto"
        >
          <Plus className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Add</span>
        </Button>
      </form>
    </Form>
  );
};

export default TaskCreationForm;