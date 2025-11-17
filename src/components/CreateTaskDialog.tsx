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
import { calculateEnergyCost } from '@/lib/scheduler-utils';
import { DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION } from '@/lib/constants';
import { format } from 'date-fns'; // Import format

const TaskCreationSchema = z.object({
  name: z.string().min(1, { message: "Task name cannot be empty." }).max(255), // Renamed from title to name
  description: z.string().max(1000).optional(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  dueDate: z.date({ required_error: "Due date is required." }),
  isCritical: z.boolean().default(false),
  energy_cost: z.coerce.number().min(0).default(0),
  is_custom_energy_cost: z.boolean().default(false),
  duration: z.coerce.number().min(1, "Duration must be at least 1 minute.").default(DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION), // Added duration
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
  const [calculatedEnergyCost, setCalculatedEnergyCost] = useState(0);
  
  const form = useForm<TaskCreationFormValues>({
    resolver: zodResolver(TaskCreationSchema),
    defaultValues: {
      name: '', // Renamed from title to name
      description: '',
      priority: defaultPriority,
      dueDate: defaultDueDate,
      isCritical: false,
      duration: DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION, // Default duration
      energy_cost: calculateEnergyCost(DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION, false),
      is_custom_energy_cost: false,
    },
    mode: 'onChange',
  });

  // Effect to update calculated energy cost when isCritical or duration changes
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (!value.is_custom_energy_cost && (name === 'isCritical' || name === 'duration')) {
        const newEnergyCost = calculateEnergyCost(value.duration ?? DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION, value.isCritical ?? false);
        setCalculatedEnergyCost(newEnergyCost);
        form.setValue('energy_cost', newEnergyCost, { shouldValidate: true });
      } else if (name === 'is_custom_energy_cost' && !value.is_custom_energy_cost) {
        const isCritical = form.getValues('isCritical');
        const duration = form.getValues('duration');
        const newEnergyCost = calculateEnergyCost(duration ?? DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION, isCritical ?? false);
        setCalculatedEnergyCost(newEnergyCost);
        form.setValue('energy_cost', newEnergyCost, { shouldValidate: true });
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Initialize calculated energy cost on mount
  useEffect(() => {
    const initialIsCritical = form.getValues('isCritical');
    const initialDuration = form.getValues('duration');
    const initialEnergyCost = calculateEnergyCost(initialDuration ?? DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION, initialIsCritical);
    setCalculatedEnergyCost(initialEnergyCost);
    form.setValue('energy_cost', initialEnergyCost);
  }, [form]);


  const onSubmit = (values: TaskCreationFormValues) => {
    const { name, priority, dueDate, description, isCritical, energy_cost, is_custom_energy_cost, duration } = values; // Renamed from title to name

    const newTask: NewTask = {
      name: name.trim(), // Renamed from title to name
      description: description?.trim() || undefined,
      duration: duration, // Pass duration
      break_duration: null,
      original_scheduled_date: format(dueDate, 'yyyy-MM-dd'), // Use original_scheduled_date
      is_critical: isCritical,
      energy_cost: is_custom_energy_cost ? energy_cost : calculatedEnergyCost,
      is_custom_energy_cost: is_custom_energy_cost,
      is_locked: false,
      is_completed: false,
    };

    addTask(newTask, {
      onSuccess: () => {
        onTaskCreated();
        setIsOpen(false);
        form.reset({
          name: '', // Renamed from title to name
          description: '',
          priority: values.priority, 
          dueDate: values.dueDate, 
          isCritical: false,
          duration: DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION,
          energy_cost: calculateEnergyCost(DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION, false),
          is_custom_energy_cost: false,
        });
      }
    });
  };

  const isSubmitting = form.formState.isSubmitting;
  const isValid = form.formState.isValid;
  const isCustomEnergyCostEnabled = form.watch('is_custom_energy_cost');

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
            
            <FormField
              control={form.control}
              name="name" // Renamed from title to name
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Task name" {...field} />
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
                  <FormLabel>Original Scheduled Date</FormLabel> {/* Renamed label */}
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

            <FormField
              control={form.control}
              name="duration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estimated Duration (min)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} min="1" />
                  </FormControl>
                  <FormDescription>
                    Estimated time to complete this task.
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
                      Mark this task as critical (must be completed today).
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
      </DialogContent>
    </Dialog>
  );
};

export default CreateTaskDialog;