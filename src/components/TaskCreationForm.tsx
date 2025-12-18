import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TaskPriority, NewTask } from '@/types';
import { useTasks } from '@/hooks/use-tasks';
import { Plus, Sparkles, AlignLeft, Zap, Loader2 } from 'lucide-react'; // FIX: Added AlignLeft, Zap, Loader2
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'; // FIX: Added DialogTrigger
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { calculateEnergyCost } from '@/lib/scheduler-utils'; // Import calculateEnergyCost
import { DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION } from '@/lib/constants'; // Import default duration

const TaskCreationSchema = z.object({
  title: z.string().min(1, { message: "Task title cannot be empty." }).max(255),
  description: z.string().max(1000).optional(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  dueDate: z.date({ required_error: "Due date is required." }),
  isCritical: z.boolean().default(false),
  isBackburner: z.boolean().default(false), // NEW: Backburner flag
  energy_cost: z.coerce.number().min(0).default(0), 
  is_custom_energy_cost: z.boolean().default(false), 
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
      title: '',
      description: '',
      priority: defaultPriority,
      dueDate: defaultDueDate,
      isCritical: false,
      isBackburner: false, // NEW: Default to false
      energy_cost: calculateEnergyCost(DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION, false, false), // NEW: Pass isBackburner=false
      is_custom_energy_cost: false,
    },
    mode: 'onChange',
  });

  // NEW: Effect to update calculated energy cost when isCritical or isBackburner changes
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (!value.is_custom_energy_cost && (name === 'isCritical' || name === 'isBackburner')) {
        const newEnergyCost = calculateEnergyCost(
          DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION, 
          value.isCritical ?? false,
          value.isBackburner ?? false // NEW: Pass backburner status
        );
        setCalculatedEnergyCost(newEnergyCost);
        form.setValue('energy_cost', newEnergyCost, { shouldValidate: true });
      } else if (name === 'is_custom_energy_cost' && !value.is_custom_energy_cost) {
        // If custom energy cost is turned OFF, immediately recalculate and set
        const isCritical = form.getValues('isCritical');
        const isBackburner = form.getValues('isBackburner'); // NEW: Get backburner status
        const newEnergyCost = calculateEnergyCost(
          DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION, 
          isCritical ?? false,
          isBackburner ?? false // NEW: Pass backburner status
        );
        setCalculatedEnergyCost(newEnergyCost);
        form.setValue('energy_cost', newEnergyCost, { shouldValidate: true });
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // NEW: Initialize calculated energy cost on mount
  useEffect(() => {
    const initialIsCritical = form.getValues('isCritical');
    const initialIsBackburner = form.getValues('isBackburner'); // NEW: Get initial backburner status
    const initialEnergyCost = calculateEnergyCost(DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION, initialIsCritical, initialIsBackburner);
    setCalculatedEnergyCost(initialEnergyCost);
    form.setValue('energy_cost', initialEnergyCost);
  }, [form]);


  const onSubmit = (values: TaskCreationFormValues) => {
    // FIX 11-21: Destructure values correctly from the form submission object
    const { title, priority, dueDate, description, isCritical, isBackburner, energy_cost, is_custom_energy_cost } = values;

    const newTask: NewTask = {
      title: title.trim(),
      description: description?.trim() || undefined,
      priority: priority,
      due_date: dueDate.toISOString(),
      is_critical: isCritical,
      is_backburner: isBackburner, // FIX 16: Assuming NewTask type is updated
      energy_cost: is_custom_energy_cost ? energy_cost : calculatedEnergyCost, 
      is_custom_energy_cost: is_custom_energy_cost,
    };

    addTask(newTask, {
      onSuccess: () => {
        onTaskCreated();
        setIsOpen(false);
        form.reset({
          title: '',
          description: '',
          priority: values.priority, 
          dueDate: values.dueDate, 
          isCritical: false,
          isBackburner: false, // NEW: Reset backburner
          energy_cost: calculateEnergyCost(DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION, false, false), // Reset to default calculated
          is_custom_energy_cost: false,
        });
      }
    });
  };

  const isSubmitting = form.formState.isSubmitting;
  const isValid = form.formState.isValid;
  const isCustomEnergyCostEnabled = form.watch('is_custom_energy_cost'); 
  const isCritical = form.watch('isCritical');
  const isBackburner = form.watch('isBackburner');

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {/* FIX 1, 22, 24, 23: Corrected DialogTrigger usage and missing setIsOpen */}
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
                  {/* FIX 2, 3, 25: Corrected JSX structure for Zap and FormControl */}
                  <div className="flex items-center gap-1 text-lg font-bold text-logo-yellow">
                    <Zap className="h-5 w-5" />
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field} 
                        min="0" 
                        className="w-20 text-right font-mono text-lg font-bold border-none focus-visible:ring-0 focus-visible:ring-offset-0"
                        readOnly={!isCustomEnergyCostEnabled} // Read-only if custom not enabled
                        value={isCustomEnergyCostEnabled ? field.value : calculatedEnergyCost} // Display calculated if not custom
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

            {/* FIX 26, 27, 28: Corrected usage of isSubmitting and isValid */}
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