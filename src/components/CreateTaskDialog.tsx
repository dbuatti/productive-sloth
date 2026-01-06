import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TaskPriority, NewTask } from '@/types';
import { useTasks } from '@/hooks/use-tasks';
import { Plus, Loader2, AlignLeft, Zap } from 'lucide-react';
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
import { calculateEnergyCost, setTimeOnDate } from '@/lib/scheduler-utils'; // Import calculateEnergyCost and setTimeOnDate
import { DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION } from '@/lib/constants';
import { useIsMobile } from '@/hooks/use-mobile';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { format, isBefore, addDays, differenceInMinutes } from 'date-fns'; // Import date-fns utilities

const TaskCreationSchema = z.object({
  title: z.string().min(1, { message: "Task title cannot be empty." }).max(255),
  description: z.string().max(1000).optional(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  dueDate: z.date({ required_error: "Due date is required." }),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)").optional(), // NEW: Optional start time
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)").optional(), // NEW: Optional end time
  isCritical: z.boolean().default(false),
  isBackburner: z.boolean().default(false), // NEW: Backburner flag
  energy_cost: z.coerce.number().min(0).default(0), 
  is_custom_energy_cost: z.boolean().default(false), 
});

type TaskCreationFormValues = z.infer<typeof TaskCreationSchema>;

interface CreateTaskDialogProps {
  defaultPriority: TaskPriority;
  defaultDueDate: Date;
  defaultStartTime?: Date; // NEW: Optional default start time
  defaultEndTime?: Date;   // NEW: Optional default end time
  onTaskCreated: () => void;
  isOpen: boolean; // NEW: Control open state from parent
  onOpenChange: (open: boolean) => void; // NEW: Callback for open state
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
      energy_cost: calculateEnergyCost(DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION, false, false),
      is_custom_energy_cost: false,
    },
    mode: 'onChange',
  });

  // Effect to reset form and set default values when dialog opens or defaults change
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
        energy_cost: calculateEnergyCost(DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION, false, false),
        is_custom_energy_cost: false,
      });
    }
  }, [isOpen, defaultPriority, defaultDueDate, defaultStartTime, defaultEndTime, form]);


  // Effect to update calculated energy cost when relevant fields change
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (!value.is_custom_energy_cost && (name === 'isCritical' || name === 'isBackburner' || name === 'startTime' || name === 'endTime')) {
        const isCritical = value.isCritical ?? false;
        const isBackburner = value.isBackburner ?? false;
        let duration = DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION;

        if (value.startTime && value.endTime && value.dueDate) {
          let start = setTimeOnDate(value.dueDate, value.startTime);
          let end = setTimeOnDate(value.dueDate, value.endTime);
          if (isBefore(end, start)) end = addDays(end, 1);
          duration = differenceInMinutes(end, start);
        }
        
        const newEnergyCost = calculateEnergyCost(duration, isCritical, isBackburner);
        setCalculatedEnergyCost(newEnergyCost);
        form.setValue('energy_cost', newEnergyCost, { shouldValidate: true });
      } else if (name === 'is_custom_energy_cost' && !value.is_custom_energy_cost) {
        const isCritical = form.getValues('isCritical');
        const isBackburner = form.getValues('isBackburner');
        let duration = DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION;

        const formValues = form.getValues();
        if (formValues.startTime && formValues.endTime && formValues.dueDate) {
          let start = setTimeOnDate(formValues.dueDate, formValues.startTime);
          let end = setTimeOnDate(formValues.dueDate, formValues.endTime);
          if (isBefore(end, start)) end = addDays(end, 1);
          duration = differenceInMinutes(end, start);
        }

        const newEnergyCost = calculateEnergyCost(duration, isCritical ?? false, isBackburner ?? false);
        setCalculatedEnergyCost(newEnergyCost);
        form.setValue('energy_cost', newEnergyCost, { shouldValidate: true });
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Initialize calculated energy cost on mount
  useEffect(() => {
    const initialIsCritical = form.getValues('isCritical');
    const initialIsBackburner = form.getValues('isBackburner');
    let initialDuration = DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION;

    const formValues = form.getValues();
    if (formValues.startTime && formValues.endTime && formValues.dueDate) {
      let start = setTimeOnDate(formValues.dueDate, formValues.startTime);
      let end = setTimeOnDate(formValues.dueDate, formValues.endTime);
      if (isBefore(end, start)) end = addDays(end, 1);
      initialDuration = differenceInMinutes(end, start);
    }

    const initialEnergyCost = calculateEnergyCost(initialDuration, initialIsCritical, initialIsBackburner);
    setCalculatedEnergyCost(initialEnergyCost);
    form.setValue('energy_cost', initialEnergyCost);
  }, [form]);


  const onSubmit = (values: TaskCreationFormValues) => {
    const { title, priority, dueDate, description, isCritical, isBackburner, energy_cost, is_custom_energy_cost, startTime, endTime } = values;

    const newTask: NewTask = {
      title: title.trim(),
      description: description?.trim() || undefined,
      priority: priority,
      due_date: dueDate.toISOString(),
      is_critical: isCritical,
      is_backburner: isBackburner,
      energy_cost: is_custom_energy_cost ? energy_cost : calculatedEnergyCost, 
      is_custom_energy_cost: is_custom_energy_cost,
    };

    addTask(newTask, {
      onSuccess: () => {
        onTaskCreated();
        onOpenChange(false); // Close dialog
      }
    });
  };

  const isSubmitting = form.formState.isSubmitting;
  const isValid = form.formState.isValid;
  const isCustomEnergyCostEnabled = form.watch('is_custom_energy_cost'); 
  const isCritical = form.watch('isCritical');
  const isBackburner = form.watch('isBackburner');
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
                <Input placeholder="Task title" {...field} />
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
        </div>

        {/* NEW: Optional Time Range Fields */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="startTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Time (Optional)</FormLabel>
                <FormControl>
                  <Input type="time" {...field} value={field.value || ''} />
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
                  <Input type="time" {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Critical Task Switch */}
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
                    if (checked) form.setValue('isBackburner', false); // Critical overrides Backburner
                  }}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Backburner Task Switch */}
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
                    if (checked) form.setValue('isCritical', false); // Backburner overrides Critical
                  }}
                  disabled={isCritical}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Custom Energy Cost Switch */}
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
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Energy Cost Input (conditionally editable) */}
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
                    min="0" 
                    className="w-20 text-right font-mono text-lg font-bold border-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    readOnly={!isCustomEnergyCostEnabled}
                    value={isCustomEnergyCostEnabled ? field.value : calculatedEnergyCost}
                    onChange={(e) => {
                      if (isCustomEnergyCostEnabled) {
                        field.onChange(e);
                      }
                    }}
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
          {/* This trigger is now handled by SchedulerInput or SchedulerDisplay */}
          <Button variant="outline" size="icon" className="hidden">
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
        {/* This trigger is now handled by SchedulerInput or SchedulerDisplay */}
        <Button variant="outline" size="icon" className="hidden">
          <AlignLeft className="h-4 w-4" />
          <span className="sr-only">Add Description</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] animate-pop-in">
        <DialogHeader>
          <DialogTitle>Add Task Details</DialogTitle>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
};

export default CreateTaskDialog;