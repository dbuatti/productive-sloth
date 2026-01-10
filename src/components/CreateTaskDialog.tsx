"use client";

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TaskPriority, NewTask } from '@/types';
import { useTasks } from '@/hooks/use-tasks';
import { Plus, Loader2, AlignLeft, Zap, Home, Laptop, Globe, Music, Briefcase, Coffee } from 'lucide-react';
import DatePicker from './DatePicker';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage,
  FormDescription
} from '@/components/ui/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { calculateEnergyCost, setTimeOnDate } from '@/lib/scheduler-utils';
import { DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION } from '@/lib/constants';
import { useIsMobile } from '@/hooks/use-mobile';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { format, isBefore, addDays, differenceInMinutes } from 'date-fns';
import { useEnvironments } from '@/hooks/use-environments';
import { NewDBScheduledTask, TaskEnvironment } from '@/types/scheduler';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import { getLucideIconComponent } from '@/lib/utils'; // Import getLucideIconComponent

const TaskCreationSchema = z.object({
  title: z.string().min(1, { message: "Task title cannot be empty." }).max(255),
  description: z.string().max(1000).optional(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  dueDate: z.date({ required_error: "Due date is required." }),
  startTime: z.preprocess(
    (val) => (val === "" ? null : val),
    z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)").nullable()
  ).optional(),
  endTime: z.preprocess(
    (val) => (val === "" ? null : val),
    z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)").nullable()
  ).optional(),
  isCritical: z.boolean().default(false),
  isBackburner: z.boolean().default(false),
  energy_cost: z.coerce.number().default(0), // Removed .min(0)
  is_custom_energy_cost: z.boolean().default(false),
  task_environment: z.enum(['home', 'laptop', 'away', 'piano', 'laptop_piano']).default('laptop'),
  is_work: z.boolean().default(false),
  is_break: z.boolean().default(false),
}).refine(data => {
  // If it's a break task and not custom energy cost, allow negative or zero
  if (data.is_break && !data.is_custom_energy_cost) {
    return data.energy_cost <= 0;
  }
  // Otherwise, energy cost must be non-negative
  return data.energy_cost >= 0;
}, {
  message: "Energy cost must be 0 or negative for break tasks, and non-negative for others.",
  path: ["energy_cost"],
});

type TaskCreationFormValues = z.infer<typeof TaskCreationSchema>;

interface CreateTaskDialogProps {
  defaultPriority: TaskPriority;
  defaultDueDate: Date;
  defaultStartTime?: Date;
  defaultEndTime?: Date;
  onTaskCreated: () => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const CreateTaskDialog: React.FC<CreateTaskDialogProps> = ({ 
  defaultPriority, 
  defaultDueDate, 
  defaultStartTime, 
  defaultEndTime, 
  onTaskCreated,
  isOpen,
  onOpenChange,
}) => {
  const { addTask } = useTasks();
  const { addScheduledTask } = useSchedulerTasks(format(defaultDueDate, 'yyyy-MM-dd'));
  const { environments, isLoading: isLoadingEnvironments } = useEnvironments();
  const [calculatedEnergyCost, setCalculatedEnergyCost] = useState(0);
  const isMobile = useIsMobile();
  
  const form = useForm<TaskCreationFormValues>({
    resolver: zodResolver(TaskCreationSchema),
    defaultValues: {
      title: '',
      description: '',
      priority: defaultPriority,
      dueDate: defaultDueDate,
      startTime: defaultStartTime ? format(defaultStartTime, 'HH:mm') : undefined,
      endTime: defaultEndTime ? format(defaultEndTime, 'HH:mm') : undefined,
      isCritical: false,
      isBackburner: false,
      energy_cost: calculateEnergyCost(DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION, false, false, false),
      is_custom_energy_cost: false,
      task_environment: 'laptop',
      is_work: false,
      is_break: false,
    },
    mode: 'onChange',
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({
        title: '',
        description: '',
        priority: defaultPriority,
        dueDate: defaultDueDate,
        startTime: defaultStartTime ? format(defaultStartTime, 'HH:mm') : undefined,
        endTime: defaultEndTime ? format(defaultEndTime, 'HH:mm') : undefined,
        isCritical: false,
        isBackburner: false,
        energy_cost: calculateEnergyCost(DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION, false, false, false),
        is_custom_energy_cost: false,
        task_environment: 'laptop',
        is_work: false,
        is_break: false,
      });
    }
  }, [isOpen, defaultPriority, defaultDueDate, defaultStartTime, defaultEndTime, form]);


  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (!value.is_custom_energy_cost && (name === 'isCritical' || name === 'isBackburner' || name === 'is_break' || name === 'startTime' || name === 'endTime')) {
        const isCritical = value.isCritical ?? false;
        const isBackburner = value.isBackburner ?? false;
        const isBreak = value.is_break ?? false;
        let duration = DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION;

        if (value.startTime && value.endTime && value.dueDate) {
          let start = setTimeOnDate(value.dueDate, value.startTime);
          let end = setTimeOnDate(value.dueDate, value.endTime);
          if (isBefore(end, start)) end = addDays(end, 1);
          duration = differenceInMinutes(end, start);
        }
        
        const newEnergyCost = calculateEnergyCost(duration, isCritical, isBackburner, isBreak);
        setCalculatedEnergyCost(newEnergyCost);
        form.setValue('energy_cost', newEnergyCost, { shouldValidate: true });
      } else if (name === 'is_custom_energy_cost' && !value.is_custom_energy_cost) {
        const isCritical = form.getValues('isCritical');
        const isBackburner = form.getValues('isBackburner');
        const isBreak = form.getValues('is_break');
        let duration = DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION;

        const formValues = form.getValues();
        if (formValues.startTime && formValues.endTime && formValues.dueDate) {
          let start = setTimeOnDate(formValues.dueDate, formValues.startTime);
          let end = setTimeOnDate(formValues.dueDate, formValues.endTime);
          if (isBefore(end, start)) end = addDays(end, 1);
          duration = differenceInMinutes(end, start);
        }

        const newEnergyCost = calculateEnergyCost(duration, isCritical ?? false, isBackburner ?? false, isBreak ?? false);
        setCalculatedEnergyCost(newEnergyCost);
        form.setValue('energy_cost', newEnergyCost, { shouldValidate: true });
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  useEffect(() => {
    const initialIsCritical = form.getValues('isCritical');
    const initialIsBackburner = form.getValues('isBackburner');
    const initialIsBreak = form.getValues('is_break');
    let initialDuration = DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION;

    const formValues = form.getValues();
    if (formValues.startTime && formValues.endTime && formValues.dueDate) {
      let start = setTimeOnDate(formValues.dueDate, formValues.startTime);
      let end = setTimeOnDate(formValues.dueDate, formValues.endTime);
      if (isBefore(end, start)) end = addDays(end, 1);
      initialDuration = differenceInMinutes(end, start);
    }

    const initialEnergyCost = calculateEnergyCost(initialDuration, initialIsCritical, initialIsBackburner, initialIsBreak);
    setCalculatedEnergyCost(initialEnergyCost);
    form.setValue('energy_cost', initialEnergyCost);
  }, [form]);


  const onSubmit = async (values: TaskCreationFormValues) => {
    const { title, priority, dueDate, description, isCritical, isBackburner, energy_cost, is_custom_energy_cost, task_environment, is_work, is_break } = values;

    const scheduledDateString = format(dueDate, 'yyyy-MM-dd');

    if (values.startTime && values.endTime) {
      // This is a scheduled task
      let startTime = setTimeOnDate(dueDate, values.startTime);
      let endTime = setTimeOnDate(dueDate, values.endTime);
      if (isBefore(endTime, startTime)) endTime = addDays(endTime, 1);

      const newScheduledTask: NewDBScheduledTask = {
        name: title.trim(),
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        break_duration: null, // Assuming break_duration is not set via this form for scheduled tasks
        scheduled_date: scheduledDateString,
        is_critical: isCritical,
        is_backburner: isBackburner,
        is_flexible: false,
        is_locked: true,
        energy_cost: is_custom_energy_cost ? energy_cost : calculatedEnergyCost,
        is_custom_energy_cost: is_custom_energy_cost,
        task_environment: task_environment,
        is_work: is_work,
        is_break: is_break,
      };

      await addScheduledTask(newScheduledTask, {
        onSuccess: () => {
          onTaskCreated();
          onOpenChange(false);
        }
      });

    } else {
      // This is a general task
      const newTask: NewTask = {
        title: title.trim(),
        description: description?.trim() || undefined,
        priority: priority,
        due_date: dueDate.toISOString(),
        is_critical: isCritical,
        is_backburner: isBackburner,
        energy_cost: is_custom_energy_cost ? energy_cost : calculatedEnergyCost, 
        is_custom_energy_cost: is_custom_energy_cost,
        task_environment: task_environment,
        is_work: is_work,
        is_break: is_break,
      };

      await addTask(newTask, {
        onSuccess: () => {
          onTaskCreated();
          onOpenChange(false);
        }
      });
    }
  };

  const isSubmitting = form.formState.isSubmitting;
  const isValid = form.formState.isValid;
  const isCustomEnergyCostEnabled = form.watch('is_custom_energy_cost'); 
  const isCritical = form.watch('isCritical');
  const isBackburner = form.watch('isBackburner');
  const isBreak = form.watch('is_break');
  const hasTimeRange = form.watch('startTime') && form.watch('endTime');

  const formContent = (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="Task title" {...field} aria-label="Task Title" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
                  aria-label="Task Description"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Priority</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value} aria-label="Task Priority">
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
                    aria-label="Task Due Date"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="startTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Time (Optional)</FormLabel>
                <FormControl>
                  <Input type="time" {...field} value={field.value || ''} aria-label="Task Start Time" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="endTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>End Time (Optional)</FormLabel>
                <FormControl>
                  <Input type="time" {...field} value={field.value || ''} aria-label="Task End Time" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="task_environment"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Task Environment</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingEnvironments} aria-label="Task Environment">
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select environment" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {environments.map(env => {
                    const IconComponent = getLucideIconComponent(env.icon); // Use the shared utility
                    return (
                      <SelectItem key={env.value} value={env.value}>
                        <div className="flex items-center gap-2">
                          <IconComponent className="h-4 w-4" />
                          {env.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <FormDescription>
                Where this task is typically performed.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isCritical"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <FormLabel>Critical Task</FormLabel>
                <FormDescription>
                  Mark this task as critical (P: High).
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={(checked) => {
                    field.onChange(checked);
                    if (checked) {
                      form.setValue('isBackburner', false);
                      form.setValue('is_break', false);
                    }
                  }}
                  aria-label="Toggle Critical Task"
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isBackburner"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <FormLabel>Backburner Task</FormLabel>
                <FormDescription>
                  Mark this task as low-orbit filler (P: Low).
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={(checked) => {
                    field.onChange(checked);
                    if (checked) {
                      form.setValue('isCritical', false);
                      form.setValue('is_break', false);
                    }
                  }}
                  disabled={isCritical}
                  aria-label="Toggle Backburner Task"
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="is_break"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Coffee className="h-4 w-4 text-logo-orange" />
                  <FormLabel className="text-base font-semibold">Break Task</FormLabel>
                </div>
                <FormDescription className="text-xs">
                  This task is a dedicated break or recovery activity.
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={(checked) => {
                    field.onChange(checked);
                    if (checked) {
                      form.setValue('isCritical', false);
                      form.setValue('isBackburner', false);
                    }
                  }}
                  disabled={isCritical || isBackburner}
                  aria-label="Toggle Break Task"
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="is_work"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-primary" />
                  <FormLabel className="text-base font-semibold">Work Task</FormLabel>
                </div>
                <FormDescription className="text-xs">
                  Tag this task as work for analytics.
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  aria-label="Toggle Work Task"
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="is_custom_energy_cost"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <FormLabel>Custom Energy Cost</FormLabel>
                <FormDescription>
                  Manually set the energy cost instead of automatic calculation.
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  aria-label="Toggle Custom Energy Cost"
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="energy_cost"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <FormLabel>Energy Cost</FormLabel>
                <FormDescription>
                  Energy consumed upon completion.
                </FormDescription>
              </div>
              <div className="flex items-center gap-1 text-lg font-bold text-logo-yellow">
                <Zap className="h-5 w-5" />
                <FormControl>
                  <Input 
                    type="number" 
                    {...field} 
                    min={isBreak || isCustomEnergyCostEnabled ? undefined : "0"} // Allow negative if break or custom
                    className="w-20 text-right font-mono text-lg font-bold border-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    readOnly={!isCustomEnergyCostEnabled}
                    value={isCustomEnergyCostEnabled ? field.value : calculatedEnergyCost}
                    onChange={(e) => {
                      if (isCustomEnergyCostEnabled) {
                        field.onChange(e);
                      }
                    }}
                    aria-label="Energy Cost"
                  />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button 
          type="submit" 
          disabled={isSubmitting || !isValid} 
          className="w-full flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-200"
          aria-label="Create Task"
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
  );

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={onOpenChange}>
        <DrawerTrigger asChild>
          <Button variant="outline" size="icon" className="hidden" aria-label="Open Add Task Details Drawer">
            <AlignLeft className="h-4 w-4" />
            <span className="sr-only">Add Description</span>
          </Button>
        </DrawerTrigger>
        <DrawerContent className="p-4 pb-8">
          <DrawerHeader>
            <DrawerTitle>Add Task Details</DrawerTitle>
          </DrawerHeader>
          {formContent}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="hidden" aria-label="Open Add Task Details Dialog">
          <AlignLeft className="h-4 w-4" />
          <span className="sr-only">Add Description</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto animate-pop-in">
        <DialogHeader>
          <DialogTitle>Add Task Details</DialogTitle>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
};

export default CreateTaskDialog;