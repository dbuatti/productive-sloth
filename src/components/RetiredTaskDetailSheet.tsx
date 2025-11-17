import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, parseISO } from "date-fns";
import { X, Save, Loader2, Zap, Trash2, Lock, Unlock, PlusCircle } from "lucide-react";

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
import { Switch } from '@/components/ui/switch';
import { cn } from "@/lib/utils";
import { RetiredTask } from "@/types/scheduler";
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks'; // Fixed: Changed to default import
import { showSuccess, showError } from "@/utils/toast";
import { calculateEnergyCost } from '@/lib/scheduler-utils';
import { DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION } from '@/lib/constants';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const formSchema = z.object({
  name: z.string().min(1, { message: "Name is required." }).max(255),
  duration: z.coerce.number().min(1, "Duration must be at least 1 minute.").nullable(),
  break_duration: z.coerce.number().min(0).nullable(),
  is_critical: z.boolean().default(false),
  is_locked: z.boolean().default(false),
  energy_cost: z.coerce.number().min(0).default(0),
  is_custom_energy_cost: z.boolean().default(false),
});

type RetiredTaskDetailFormValues = z.infer<typeof formSchema>;

interface RetiredTaskDetailSheetProps {
  task: RetiredTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const RetiredTaskDetailSheet: React.FC<RetiredTaskDetailSheetProps> = ({
  task,
  open,
  onOpenChange,
}) => {
  const { updateRetiredTask, deleteRetiredTask } = useSchedulerTasks();
  const [calculatedEnergyCost, setCalculatedEnergyCost] = useState(0);

  const form = useForm<RetiredTaskDetailFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      duration: 30,
      break_duration: 0,
      is_critical: false,
      is_locked: false,
      energy_cost: 0,
      is_custom_energy_cost: false,
    },
  });

  const durationMinutes = form.watch('duration') || DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION;

  useEffect(() => {
    if (task) {
      form.reset({
        name: task.name,
        duration: task.duration || 30,
        break_duration: task.break_duration || 0,
        is_critical: task.is_critical,
        is_locked: task.is_locked,
        energy_cost: task.energy_cost,
        is_custom_energy_cost: task.is_custom_energy_cost,
      });
      
      if (!task.is_custom_energy_cost) {
        setCalculatedEnergyCost(calculateEnergyCost(task.duration || 30, task.is_critical));
      } else {
        setCalculatedEnergyCost(task.energy_cost);
      }
    }
  }, [task, form]);

  // Effect to recalculate energy cost when duration or is_critical changes
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      const currentDuration = value.duration || DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION;
      const currentIsCritical = value.is_critical ?? false;

      if (!value.is_custom_energy_cost && (name === 'duration' || name === 'is_critical')) {
        const newEnergyCost = calculateEnergyCost(currentDuration, currentIsCritical);
        setCalculatedEnergyCost(newEnergyCost);
        form.setValue('energy_cost', newEnergyCost, { shouldValidate: true });
      } else if (name === 'is_custom_energy_cost' && !value.is_custom_energy_cost) {
        const newEnergyCost = calculateEnergyCost(currentDuration, currentIsCritical);
        setCalculatedEnergyCost(newEnergyCost);
        form.setValue('energy_cost', newEnergyCost, { shouldValidate: true });
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);


  const handleSubmit = async (values: RetiredTaskDetailFormValues) => {
    if (!task) return;

    try {
      await updateRetiredTask({
        id: task.id,
        name: values.name,
        duration: values.duration,
        break_duration: values.break_duration,
        is_critical: values.is_critical,
        is_locked: values.is_locked,
        energy_cost: values.is_custom_energy_cost ? values.energy_cost : calculatedEnergyCost,
        is_custom_energy_cost: values.is_custom_energy_cost,
      });
      showSuccess("Aether Sink task updated successfully!");
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save retired task:", error);
      showError("Failed to save retired task.");
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    if (window.confirm(`Are you sure you want to permanently delete the Aether Sink task "${task.name}"?`)) {
      try {
        await deleteRetiredTask(task.id);
        showSuccess("Aether Sink task permanently deleted.");
        onOpenChange(false);
      } catch (error) {
        console.error("Failed to delete retired task:", error);
        showError("Failed to delete retired task.");
      }
    }
  };

  const isSubmitting = form.formState.isSubmitting;
  const isValid = form.formState.isValid;
  const isCustomEnergyCostEnabled = form.watch('is_custom_energy_cost');

  if (!task) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-80 flex flex-col p-6 space-y-6 animate-slide-in-right">
        <SheetHeader className="border-b pb-4">
          <SheetTitle className="text-2xl font-bold flex items-center justify-between">
            Aether Sink Details
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-5 w-5" />
            </Button>
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            Retired at: {format(parseISO(task.retired_at), 'MMM d, yyyy HH:mm')}
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
                    <FormLabel>Name</FormLabel>
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
                        <Input type="number" min="1" placeholder="30" {...field} onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="break_duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Break (min)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" placeholder="0" {...field} onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Is Critical Switch */}
              <FormField
                control={form.control}
                name="is_critical"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Critical Task</FormLabel>
                      <FormDescription>
                        Mark this task as critical.
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

              {/* Is Locked Switch */}
              <FormField
                control={form.control}
                name="is_locked"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Lock Task in Sink</FormLabel>
                      <FormDescription>
                        Prevents accidental re-zoning or deletion.
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

              {/* Energy Cost Controls */}
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
            </div>
              
            {/* Save Button in Footer */}
            <div className="sticky bottom-0 bg-card pt-4 border-t shrink-0">
              <div className="flex justify-between gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      type="button" 
                      variant="destructive" 
                      onClick={handleDelete}
                      disabled={task.is_locked || isSubmitting}
                      className="w-full sm:w-auto flex items-center gap-2"
                      style={task.is_locked ? { pointerEvents: 'auto' } : undefined}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Permanently
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{task.is_locked ? "Unlock to Delete" : "Permanently delete this task"}</p>
                  </TooltipContent>
                </Tooltip>
                <Button 
                  type="submit" 
                  disabled={isSubmitting || !isValid} 
                  className="w-full sm:w-auto flex items-center gap-2 bg-primary hover:bg-primary/90"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Changes
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
};

export default RetiredTaskDetailSheet;