import React, { useState } from 'react';
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
import CreateTaskDialog from './CreateTaskDialog'; // Import the new dialog component

// 1. Define Schema for Quick Add
const QuickTaskCreationSchema = z.object({
  title: z.string().min(1, { message: "Task title cannot be empty." }).max(255),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  dueDate: z.date({ required_error: "Due date is required." }),
});

type QuickTaskCreationFormValues = z.infer<typeof QuickTaskCreationSchema>;

const TaskCreationForm: React.FC = () => {
  const { addTask } = useTasks();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // 2. Initialize useForm for Quick Add
  const form = useForm<QuickTaskCreationFormValues>({
    resolver: zodResolver(QuickTaskCreationSchema),
    defaultValues: {
      title: '',
      priority: 'MEDIUM',
      dueDate: new Date(), // Default to today
    },
    mode: 'onChange', // Enable validation on change
  });

  // 3. Handle Quick Submission
  const onQuickSubmit = (values: QuickTaskCreationFormValues) => {
    const { title, priority, dueDate } = values;

    const newTask: NewTask = {
      title: title.trim(),
      description: undefined, // No description in quick add
      priority: priority,
      metadata_xp: priority === 'HIGH' ? 20 : priority === 'MEDIUM' ? 10 : 5, // Assign XP based on priority
      energy_cost: priority === 'HIGH' ? 15 : priority === 'MEDIUM' ? 10 : 5, // Assign Energy Cost based on priority
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

  // Function to sync form state to dialog if user opens it
  const handleOpenDialog = () => {
    // We don't need to sync values here, as the dialog form manages its own state
    // but we pass the current quick-add defaults.
    setIsDialogOpen(true);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onQuickSubmit)} className="flex flex-col sm:flex-row gap-2 animate-slide-in-up">
        
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
                  className="h-10 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200"
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
                  <SelectTrigger className="h-10 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200">
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
        
        {/* Detailed Task Dialog Button */}
        <CreateTaskDialog 
          defaultPriority={form.getValues('priority')}
          defaultDueDate={form.getValues('dueDate')}
          onTaskCreated={() => form.reset({ title: '', priority: form.getValues('priority'), dueDate: form.getValues('dueDate') })}
        />

        {/* Quick Add Submit Button */}
        <Button 
          type="submit" 
          disabled={isSubmitting || !isValid} 
          className="shrink-0 w-full sm:w-auto h-10 bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-200"
        >
          <Plus className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Quick Add</span>
        </Button>
      </form>
    </Form>
  );
};

export default TaskCreationForm;