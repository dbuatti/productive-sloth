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
import { Task, TaskPriority } from "@/types"; // Now refers to AetherSinkTask structure
import DatePicker from "./DatePicker";
import { useTasks } from '@/hooks/use-tasks';
import { showSuccess } from "@/utils/toast";
import { useSession } from '@/hooks/use-session';
import { Switch } from '@/components/ui/switch';
import { calculateEnergyCost } from '@/lib/scheduler-utils';
import { DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION } from '@/lib/constants';

const formSchema = z.object({
  name: z.string().min(1, { message: "Name is required." }).max(255), // Renamed from title to name
  description: z.string().optional(), // AetherSink doesn't have description, but keeping for consistency if needed
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'), // Priority is derived from isCritical for AetherSink
  dueDate: z.date({ required_error: "Original Scheduled Date is required." }), // Renamed from dueDate to original_scheduled_date
  isCritical: z.boolean().default(false),
  energy_cost: z.coerce.number().min(0).default(0),
  is_custom_energy_cost: z.boolean().default(false),
  duration: z.coerce.number().min(1, "Duration must be at least 1 minute.").default(DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION), // Added duration
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
  const [calculatedEnergyCost, setCalculatedEnergyCost] = useState(0);

  const form = useForm<TaskDetailFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "", // Renamed from title to name
      description: "",
      priority: "MEDIUM", // Default, but derived from isCritical
      dueDate: new Date(),
      isCritical: false,
      duration: DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION,
      energy_cost: 0,
      is_custom_energy_cost: false,
    },
  });

  useEffect(() => {
    if (task) {
      form.reset({
        name: task.name, // Renamed from title to name
        description: "", // AetherSink doesn't have description
        priority: task.is_critical ? 'HIGH' : 'MEDIUM', // Derive priority from is_critical
        dueDate: task.original_scheduled_date ? new Date(task.original_scheduled_date) : new Date(), // Use original_scheduled_date
        isCritical: task.is_critical,
        duration: task.duration ?? DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION,
        energy_cost: task.energy_cost,
        is_custom_energy_cost: task.is_custom_energy_cost,
      });
      if (!task.is_custom_energy_cost) {
        setCalculatedEnergyCost(calculateEnergyCost(task.duration || DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION, task.is_critical));
      } else {
        setCalculatedEnergyCost(task.energy_cost);
      }
    }
  }, [task, form]);

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


  const handleSubmit = async (values: TaskDetailFormValues) => {
    if (!task) return;

    // AetherSink tasks don't have a description field
    // Priority is derived from is_critical, so we don't update it directly
    try {
      await updateTask({
        id: task.id,
        name: values.name, // Renamed from title to name
        duration: values.duration,
        original_scheduled_date: values.dueDate.toISOString().split('T')[0], // Use original_scheduled_date
        is_critical: values.isCritical,
        energy_cost: values.is_custom_energy_cost ? values.energy_cost : calculatedEnergyCost,
        is_custom_energy_cost: values.is_custom_energy_cost,
      });
      showSuccess("Task updated successfully!");
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save task:", error);
    }
  };

  const isSubmitting = form.formState.isSubmitting;
  const isValid = form.formState.isValid;
  const isCustomEnergyCostEnabled = form.watch('is_custom_energy_cost');

  if (!task) return null;

  const lastUpdatedDate = task.retired_at ? new Date(task.retired_at) : null; // Use retired_at as updated_at
  const formattedLastUpdated = lastUpdatedDate && !isNaN(lastUpdatedDate.getTime()) 
    ? format(lastUpdatedDate, 'MMM d, yyyy HH:mm') 
    : 'N/A';


  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-80 flex flex-col p-6 space-y-6 animate-slide-in-right">
        <SheetHeader className="border-b pb-4">
          <SheetTitle className="text-2xl font-bold flex items-center justify-between">
            Task Details
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-5 w-5" />
            </Button>
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            Last updated: {formattedLastUpdated}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col h-full space-y-6">
            
            <div className="flex-grow overflow-y-auto space-y-6 pb-8">
              {/* Name */}
              <FormField
                control={form.control}
                name="name" // Renamed from title to name
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Task name" {...field} className="text-lg font-semibold" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description - Removed as AetherSink doesn't have it */}
              {/* Priority - Removed as it's derived from isCritical */}

              {/* Original Scheduled Date */}
              <FormField
                control={form.control}
                name="dueDate" // Renamed from dueDate
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Original Scheduled Date</FormLabel>
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

              {/* Duration */}
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

              {/* Is Critical Switch */}
              <FormField
                control={form.control}
                name="isCritical"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Critical Task</FormLabel>
                      <FormDescription>
                        Mark this task as critical (higher priority).
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

              {/* Energy Cost (Editable if custom, read-only if auto-calculated) */}
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