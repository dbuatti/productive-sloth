import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TaskPriority, NewTask } from '@/types';
import { useTasks } from '@/hooks/use-tasks';
import { Plus, Sparkles } from 'lucide-react';
import DatePicker from './DatePicker';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import CreateTaskDialog from './CreateTaskDialog';
import { useSession } from '@/hooks/use-session';
import { MAX_ENERGY, DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION } from '@/lib/constants';
import { calculateEnergyCost } from '@/lib/scheduler-utils';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const QuickTaskCreationSchema = z.object({
  title: z.string().min(1, { message: "Task title cannot be empty." }).max(255),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  dueDate: z.date({ required_error: "Due date is required." }),
});

type QuickTaskCreationFormValues = z.infer<typeof QuickTaskCreationSchema>;

const getAdaptiveDefaultPriority = (energy: number | undefined): TaskPriority => {
  if (energy === undefined) return 'MEDIUM';
  const energyPercentage = (energy / MAX_ENERGY) * 100;
  if (energyPercentage < 30) {
    return 'LOW';
  } else if (energyPercentage <= 70) {
    return 'MEDIUM';
  } else {
    return 'HIGH';
  }
};

const TaskCreationForm: React.FC = () => {
  const { addTask } = useTasks();
  const { profile } = useSession();
  const defaultPriority = getAdaptiveDefaultPriority(profile?.energy);
  
  const form = useForm<QuickTaskCreationFormValues>({
    resolver: zodResolver(QuickTaskCreationSchema),
    defaultValues: {
      title: '',
      priority: defaultPriority,
      dueDate: new Date(),
    },
    mode: 'onChange',
  });

  React.useEffect(() => {
    const newDefaultPriority = getAdaptiveDefaultPriority(profile?.energy);
    if (form.getValues('priority') !== newDefaultPriority) {
      form.setValue('priority', newDefaultPriority);
    }
  }, [profile?.energy, form]);

  const onQuickSubmit = (values: QuickTaskCreationFormValues) => {
    const { title, priority, dueDate } = values;
    let taskTitle = title.trim();
    let isCritical = false;
    
    if (taskTitle.endsWith(' !')) {
      isCritical = true;
      taskTitle = taskTitle.slice(0, -2).trim();
    }
    
    const energyCost = calculateEnergyCost(DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION, isCritical);
    
    const newTask: NewTask = {
      title: taskTitle,
      description: undefined,
      priority: priority,
      due_date: dueDate.toISOString(),
      is_critical: isCritical,
      energy_cost: energyCost,
      is_custom_energy_cost: false,
    };
    
    addTask(newTask);
    form.reset({
      title: '',
      priority: values.priority,
      dueDate: values.dueDate,
    });
  };

  const isSubmitting = form.formState.isSubmitting;
  const isValid = form.formState.isValid;

  return (
    <Card className="p-4 animate-slide-in-up shadow-md">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onQuickSubmit)} className="flex flex-col sm:flex-row gap-3">
          <div className="flex-grow grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem className="w-full">
                    <FormControl>
                      <Input 
                        placeholder="Add a new task... (append ' !' for critical)" 
                        {...field} 
                        className="h-12 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200 text-base" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-12 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200 animate-hover-lift">
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
                  <FormItem>
                    <FormControl>
                      <DatePicker 
                        date={field.value} 
                        setDate={field.onChange} 
                        placeholder="Due Date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <CreateTaskDialog 
              defaultPriority={form.getValues('priority')} 
              defaultDueDate={form.getValues('dueDate')} 
              onTaskCreated={() => form.reset({ 
                title: '', 
                priority: form.getValues('priority'), 
                dueDate: form.getValues('dueDate') 
              })} 
            />
            
            <Button 
              type="submit" 
              disabled={isSubmitting || !isValid}
              className="shrink-0 h-12 px-6 bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-200 animate-hover-lift flex items-center gap-2"
            >
              <Plus className="h-5 w-5" />
              <span className="hidden sm:inline">Quick Add</span>
            </Button>
          </div>
        </form>
      </Form>
    </Card>
  );
};

export default TaskCreationForm;