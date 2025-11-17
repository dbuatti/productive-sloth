"use client";

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import DatePicker from './DatePicker';
import { useSession } from '@/hooks/use-session';
import { MAX_ENERGY, DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION } from '@/lib/constants';

const QuickTaskCreationSchema = z.object({
  name: z.string().min(1, { message: "Task name cannot be empty." }).max(255),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  dueDate: z.date({ required_error: "Due date is required." }),
});

type QuickTaskCreationFormValues = z.infer<typeof QuickTaskCreationSchema>;

const TaskCreationForm: React.FC = () => {
  const { profile } = useSession();
  
  const form = useForm<QuickTaskCreationFormValues>({
    resolver: zodResolver(QuickTaskCreationSchema),
    defaultValues: {
      name: '',
      priority: 'MEDIUM',
      dueDate: new Date(),
    },
    mode: 'onChange',
  });

  const onQuickSubmit = (values: QuickTaskCreationFormValues) => {
    form.reset({
      name: '',
      priority: values.priority, 
      dueDate: values.dueDate, 
    });
  };

  const isSubmitting = form.formState.isSubmitting;
  const isValid = form.formState.isValid;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onQuickSubmit)} className="flex flex-col sm:flex-row gap-2 animate-slide-in-up">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="flex-grow min-w-[150px]">
              <FormControl>
                <Input
                  placeholder="Add a new task... (append ' !' for critical)"
                  {...field}
                  className="h-10 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="priority"
          render={({ field }) => (
            <FormItem className="w-full sm:w-[120px] shrink-0">
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="h-10 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200 animate-hover-lift">
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
        
        <Button 
          type="submit" 
          disabled={isSubmitting || !isValid} 
          className="shrink-0 w-full sm:w-auto h-10 bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-200 animate-hover-lift"
        >
          Add Task
        </Button>
      </form>
    </Form>
  );
};

export default TaskCreationForm;