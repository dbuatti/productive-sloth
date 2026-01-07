import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, parseISO } from "date-fns";
import { X, Save, Loader2, Zap, Lock, Unlock, Home, Laptop, Globe, Music } from "lucide-react";

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
import { Switch } from '@/components/ui/switch';
import { RetiredTask, TaskEnvironment } from "@/types/scheduler";
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import { showSuccess, showError } from "@/utils/toast";
import { calculateEnergyCost } from '@/lib/scheduler-utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEnvironments } from '@/hooks/use-environments'; // Import useEnvironments

const formSchema = z.object({
  name: z.string().min(1, { message: "Name is required." }).max(255),
  duration: z.coerce.number().min(1, "Duration must be at least 1 minute.").optional().nullable(),
  break_duration: z.coerce.number().min(0).optional().nullable(),
  is_critical: z.boolean().default(false),
  is_backburner: z.boolean().default(false),
  is_locked: z.boolean().default(false),
  is_completed: z.boolean().default(false),
  energy_cost: z.coerce.number().min(0).default(0),
  is_custom_energy_cost: z.boolean().default(false),
  task_environment: z.enum(['home', 'laptop', 'away', 'piano', 'laptop_piano']).default('laptop'),
});

type RetiredTaskDetailFormValues = z.infer<typeof formSchema>;

interface RetiredTaskDetailSheetProps {
  task: RetiredTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const getEnvironmentIconComponent = (iconName: string) => {
  switch (iconName) {
    case 'Home': return Home;
    case 'Laptop': return Laptop;
    case 'Globe': return Globe;
    case 'Music': return Music;
    default: return Home; // Fallback
  }
};

const RetiredTaskDetailSheet: React.FC<RetiredTaskDetailSheetProps> = ({
  task,
  open,
  onOpenChange,
}) => {
  const { updateRetiredTaskDetails, completeRetiredTask, updateRetiredTaskStatus } = useSchedulerTasks('');
  const { environments, isLoading: isLoadingEnvironments } = useEnvironments(); // Fetch environments
  const [calculatedEnergyCost, setCalculatedEnergyCost] = useState(0);

  const form = useForm<RetiredTaskDetailFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      duration: 30,
      break_duration: 0,
      is_critical: false,
      is_backburner: false,
      is_locked: false,
      is_completed: false,
      energy_cost: 0,
      is_custom_energy_cost: false,
      task_environment: 'laptop',
    },
  });

  useEffect(() => {
    if (task) {
      form.reset({
        name: task.name,
        duration: task.duration ?? 30,
        break_duration: task.break_duration ?? 0,
        is_critical: task.is_critical,
        is_backburner: task.is_backburner,
        is_locked: task.is_locked,
        is_completed: task.is_completed,
        energy_cost: task.energy_cost,
        is_custom_energy_cost: task.is_custom_energy_cost,
        task_environment: task.task_environment,
      });
      if (!task.is_custom_energy_cost) {
        setCalculatedEnergyCost(calculateEnergyCost(task.duration || 30, task.is_critical, task.is_backburner));
      } else {
        setCalculatedEnergyCost(task.energy_cost);
      }
    }
  }, [task, form]);

  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (!value.is_custom_energy_cost && (name === 'duration' || name === 'is_critical' || name === 'is_backburner')) {
        const duration = value.duration ?? 0;
        const isCritical = value.is_critical;
        const isBackburner = value.is_backburner;
        const newEnergyCost = calculateEnergyCost(duration, isCritical ?? false, isBackburner ?? false);
        setCalculatedEnergyCost(newEnergyCost);
        form.setValue('energy_cost', newEnergyCost, { shouldValidate: true });
      } else if (name === 'is_custom_energy_cost' && !value.is_custom_energy_cost) {
        const duration = form.getValues('duration') ?? 0;
        const isCritical = form.getValues('is_critical');
        const isBackburner = form.getValues('is_backburner');
        const newEnergyCost = calculateEnergyCost(duration, isCritical ?? false, isBackburner ?? false);
        setCalculatedEnergyCost(newEnergyCost);
        form.setValue('energy_cost', newEnergyCost, { shouldValidate: true });
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const handleSubmit = async (values: RetiredTaskDetailFormValues) => {
    if (!task) return;

    try {
      if (values.is_completed !== task.is_completed) {
        if (values.is_completed) {
          await completeRetiredTask(task);
        } else {
          await updateRetiredTaskStatus({ taskId: task.id, isCompleted: false });
        }
      }

      await updateRetiredTaskDetails({
        id: task.id,
        name: values.name,
        duration: values.duration === 0 ? null : values.duration,
        break_duration: values.break_duration === 0 ? null : values.break_duration,
        is_critical: values.is_critical,
        is_backburner: values.is_backburner,
        is_locked: values.is_locked,
        energy_cost: values.energy_cost,
        is_custom_energy_cost: values.is_custom_energy_cost,
        task_environment: values.task_environment,
      });
      showSuccess("Retired task updated successfully!");
      onOpenChange(false);
    } catch (error) {
      showError("Failed to save retired task.");
      // console.error("Failed to save retired task:", error);
    }
  };

  const isSubmitting = form.formState.isSubmitting;
  const isValid = form.formState.isValid;
  const isCustomEnergyCostEnabled = form.watch('is_custom_energy_cost');
  const isCritical = form.watch('is_critical');
  const isBackburner = form.watch('is_backburner');

  if (!task) return null;

  const formattedRetiredAt = task.retired_at ? format(parseISO(task.retired_at), 'MMM d, yyyy HH:mm') : 'N/A';
  const formattedOriginalDate = task.original_scheduled_date ? format(parseISO(task.original_scheduled_date), 'MMM d, yyyy') : 'N/A';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-80 flex flex-col p-6 space-y-6 animate-slide-in-right">
        <SheetHeader className="border-b pb-4">
          <SheetTitle className="text-2xl font-bold flex items-center justify-between">
            Retired Task Details
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-5 w-5" />
            </Button>
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            Retired: {formattedRetiredAt} | Original Date: {formattedOriginalDate}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col h-full space-y-6">
            
            <div className="flex-grow overflow-y-auto space-y-6 pb-8">
              {/* Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Task Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Task name" {...field} className="text-lg font-semibold" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Duration & Break Duration */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration (min)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} min="1" />
                      </FormControl>
                      <FormDescription>
                        Estimated time to complete.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="break_duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Break Duration (min)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} min="0" />
                      </FormControl>
                      <FormDescription>
                        Break associated with this task.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Task Environment */}
              <FormField
                control={form.control}
                name="task_environment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Task Environment</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingEnvironments}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select environment" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {environments.map(env => {
                          const IconComponent = getEnvironmentIconComponent(env.icon);
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

              {/* Is Critical Switch */}
              <FormField
                control={form.control}
                name="is_critical"
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
                          if (checked) form.setValue('is_backburner', false);
                        }}
                        disabled={task.is_locked}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Is Backburner Switch */}
              <FormField
                control={form.control}
                name="is_backburner"
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
                          if (checked) form.setValue('is_critical', false);
                        }}
                        disabled={isCritical || task.is_locked}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Is Locked Switch */}
              <FormField
                control={form.control}
                name="is_locked"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Locked Task</FormLabel>
                      <FormDescription>
                        Prevent re-zoning or deletion from Aether Sink.
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

              {/* Is Completed Switch */}
              <FormField
                control={form.control}
                name="is_completed"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Completed</FormLabel>
                      <FormDescription>
                        Mark this task as completed.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={task.is_locked}
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

export default RetiredTaskDetailSheet;