import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { X, Save, Loader2, Zap, Sparkles, BatteryCharging } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Task, TaskPriority } from "@/types";
import DatePicker from "./DatePicker";
import { useTasks } from '@/hooks/use-tasks';
import { showSuccess } from "@/utils/toast";
import { useSession } from '@/hooks/use-session';
import { Switch } from '@/components/ui/switch';
import { calculateEnergyCost } from '@/lib/scheduler-utils'; // NEW: Import calculateEnergyCost
import { DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION } from '@/lib/constants'; // NEW: Import default duration
import { useEnvironmentContext } from '@/hooks/use-environment-context'; // NEW: Import useEnvironmentContext

const formSchema = z.object({
  title: z.string().min(1, { message: "Title is required." }).max(255),
  description: z.string().optional(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
  dueDate: z.date({ required_error: "Due date is required." }), 
  isCritical: z.boolean().default(false),
  isBackburner: z.boolean().default(false), // NEW: Backburner flag
  energy_cost: z.coerce.number().min(0).default(0), // NEW: Add energy_cost to schema
  is_custom_energy_cost: z.boolean().default(false), // NEW: Add custom energy cost flag
  task_environment: z.string().min(1, "Environment is required."), // NEW: Add task_environment
});

type TaskDetailFormValues = z.infer<typeof formSchema>;

interface TaskDetailSheetProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TaskDetailSheet: React.FC<TaskDetailSheetProps> = ({
  task,
  open,
  onOpenChange,
}) => {
  const { updateTask } = useTasks();
  const { profile } = useSession();
  const { environmentOptions } = useEnvironmentContext(); // NEW: Use environmentOptions from context
  const [calculatedEnergyCost, setCalculatedEnergyCost] = useState(0); // NEW: State for calculated energy cost

  const form = useForm<TaskDetailFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "MEDIUM",
      dueDate: new Date(),
      isCritical: false,
      isBackburner: false, // NEW: Default to false
      energy_cost: 0, // Will be set by useEffect
      is_custom_energy_cost: false, // Will be set by useEffect
      task_environment: 'laptop', // NEW: Default environment
    },
  });

  useEffect(() => {
    if (task) {
      form.reset({
        title: task.title,
        description: task.description || "",
        priority: task.priority,
        dueDate: task.due_date ? new Date(task.due_date) : new Date(), 
        isCritical: task.is_critical,
        isBackburner: task.is_backburner, // NEW: Set initial backburner status
        energy_cost: task.energy_cost, // NEW: Set initial energy cost
        is_custom_energy_cost: task.is_custom_energy_cost, // NEW: Set initial custom energy cost flag
        task_environment: task.task_environment || 'laptop', // NEW: Set initial environment
      });
      // NEW: Set initial calculated cost, but only if not custom
      if (!task.is_custom_energy_cost) {
        setCalculatedEnergyCost(calculateEnergyCost(DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION, task.is_critical, task.is_backburner)); // NEW: Pass backburner status
      } else {
        setCalculatedEnergyCost(task.energy_cost); // If custom, display the custom value
      }
    }
  }, [task, form]);

  // NEW: Effect to recalculate energy cost when isCritical or isBackburner changes
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      // Only recalculate if custom energy cost is NOT enabled
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


  const handleSubmit = async (values: TaskDetailFormValues) => {
    if (!task) return;

    const descriptionValue = values.description?.trim() === '' ? null : values.description;

    try {
      await updateTask({
        id: task.id,
        title: values.title,
        description: descriptionValue,
        priority: values.priority,
        due_date: values.dueDate.toISOString(),
        is_critical: values.isCritical,
        is_backburner: values.isBackburner, // NEW: Pass backburner status
        energy_cost: values.is_custom_energy_cost ? values.energy_cost : calculatedEnergyCost, // NEW: Use custom or calculated
        is_custom_energy_cost: values.is_custom_energy_cost, // NEW: Pass custom energy cost flag
        task_environment: values.task_environment, // NEW: Pass environment
      });
      showSuccess("Task updated successfully!");
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save task:", error);
    }
  };

  const isSubmitting = form.formState.isSubmitting;
  const isValid = form.formState.isValid;
  const isCustomEnergyCostEnabled = form.watch('is_custom_energy_cost'); // NEW: Watch the custom energy cost toggle
  const isCritical = form.watch('isCritical');
  const isBackburner = form.watch('isBackburner');

  if (!task) return null;

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'HIGH':
        return 'text-destructive';
      case 'MEDIUM':
        return 'text-logo-orange';
      case 'LOW':
        return 'text-logo-green';
      default:
        return 'text-muted-foreground';
    }
  };
  
  const lastUpdatedDate = task.updated_at ? new Date(task.updated_at) : null;
  const formattedLastUpdated = lastUpdatedDate && !isNaN(lastUpdatedDate.getTime()) 
    ? format(lastUpdatedDate, 'MMM d, yyyy HH:mm') 
    : 'N/A';


  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-80 flex flex-col p-6 space-y-6 animate-slide-in-right">
        <SheetHeader className="border-b pb-4">
          <SheetTitle className="text-2xl font-bold flex items-center justify-between">
            Task Details
            {/* Removed the duplicate close button here */}
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            Last updated: {formattedLastUpdated}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col h-full space-y-6">
            
            <div className="flex-grow overflow-y-auto space-y-6 pb-8">
              {/* Title */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Task title" {...field} className="text-lg font-semibold" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
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

              {/* Priority & Due Date */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className={cn("capitalize", getPriorityColor(field.value as TaskPriority))}>
                            <SelectValue placeholder="Select priority" />
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

              {/* NEW: Task Environment */}
              <FormField
                control={form.control}
                name="task_environment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Task Environment</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select environment" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {environmentOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center gap-2">
                              <option.icon className="h-4 w-4" />
                              {option.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Where this task is typically performed.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Is Critical Switch */}
              <FormField
                control={form.control}
                name="isCritical"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Critical Task (P: High)</FormLabel>
                      <FormDescription>
                        Must be scheduled first.
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

              {/* Is Backburner Switch */}
              <FormField
                control={form.control}
                name="isBackburner"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Backburner Task (P: Low)</FormLabel>
                      <FormDescription>
                        Only scheduled if free time remains.
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

              {/* NEW: Custom Energy Cost Switch */}
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

              {/* NEW: Energy Cost (Editable if custom, read-only if auto-calculated) */}
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
            </div>
              
            {/* Save Button in Footer */}
            <div className="sticky bottom-0 bg-card pt-4 border-t shrink-0">
              <Button 
                type="submit" 
                disabled={isSubmitting || !isValid} 
                className="w-full flex items-center gap-2 bg-primary hover:bg-primary/90"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Changes
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
};

export default TaskDetailSheet;