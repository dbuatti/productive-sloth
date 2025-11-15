import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, parseISO, setHours, setMinutes, isBefore, addDays } from "date-fns";
import { X, Save, Loader2, Zap, Lock, Unlock } from "lucide-react";

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
import { DBScheduledTask } from "@/types/scheduler"; // Import DBScheduledTask
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks'; // Use useSchedulerTasks
import { showSuccess, showError } from "@/utils/toast";
import { Switch } from '@/components/ui/switch';
import { calculateEnergyCost, setTimeOnDate } from '@/lib/scheduler-utils'; // Import utility functions

const formSchema = z.object({
  name: z.string().min(1, { message: "Name is required." }).max(255),
  start_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
  end_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
  break_duration: z.coerce.number().min(0).optional().nullable(),
  is_critical: z.boolean().default(false),
  is_flexible: z.boolean().default(true),
  is_locked: z.boolean().default(false),
  energy_cost: z.coerce.number().min(0).default(0), // Make energy_cost editable but with recalculation
});

type ScheduledTaskDetailFormValues = z.infer<typeof formSchema>;

interface ScheduledTaskDetailSheetProps {
  task: DBScheduledTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDayString: string; // Needed for time calculations
}

const ScheduledTaskDetailSheet: React.FC<ScheduledTaskDetailSheetProps> = ({
  task,
  open,
  onOpenChange,
  selectedDayString,
}) => {
  const { updateScheduledTaskDetails } = useSchedulerTasks(selectedDayString); // Use new mutation
  const [calculatedEnergyCost, setCalculatedEnergyCost] = useState(0);

  const form = useForm<ScheduledTaskDetailFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      start_time: "09:00",
      end_time: "10:00",
      break_duration: 0,
      is_critical: false,
      is_flexible: true,
      is_locked: false,
      energy_cost: 0,
    },
  });

  // Effect to update form values when task prop changes
  useEffect(() => {
    if (task) {
      const startTime = task.start_time ? format(parseISO(task.start_time), 'HH:mm') : '09:00';
      const endTime = task.end_time ? format(parseISO(task.end_time), 'HH:mm') : '10:00';
      form.reset({
        name: task.name,
        start_time: startTime,
        end_time: endTime,
        break_duration: task.break_duration ?? 0,
        is_critical: task.is_critical,
        is_flexible: task.is_flexible,
        is_locked: task.is_locked,
        energy_cost: task.energy_cost,
      });
      setCalculatedEnergyCost(task.energy_cost);
    }
  }, [task, form]);

  // Effect to recalculate energy cost when duration or criticality changes
  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      if (name === 'start_time' || name === 'end_time' || name === 'is_critical') {
        const startTimeStr = value.start_time;
        const endTimeStr = value.end_time;
        const isCritical = value.is_critical;

        if (startTimeStr && endTimeStr) {
          const selectedDayDate = parseISO(selectedDayString);
          let startTime = setTimeOnDate(selectedDayDate, startTimeStr);
          let endTime = setTimeOnDate(selectedDayDate, endTimeStr);

          if (isBefore(endTime, startTime)) {
            endTime = addDays(endTime, 1);
          }
          const duration = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
          const newEnergyCost = calculateEnergyCost(duration, isCritical ?? false);
          setCalculatedEnergyCost(newEnergyCost);
          form.setValue('energy_cost', newEnergyCost, { shouldValidate: true });
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form, selectedDayString]);


  const handleSubmit = async (values: ScheduledTaskDetailFormValues) => {
    if (!task) return;

    const selectedDayDate = parseISO(selectedDayString);
    let startTime = setTimeOnDate(selectedDayDate, values.start_time);
    let endTime = setTimeOnDate(selectedDayDate, values.end_time);

    if (isBefore(endTime, startTime)) {
      endTime = addDays(endTime, 1);
    }

    try {
      await updateScheduledTaskDetails({
        id: task.id,
        name: values.name,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        break_duration: values.break_duration === 0 ? null : values.break_duration,
        is_critical: values.is_critical,
        is_flexible: values.is_flexible,
        is_locked: values.is_locked,
        energy_cost: values.energy_cost, // Use the calculated/updated energy cost
      });
      showSuccess("Scheduled task updated successfully!");
      onOpenChange(false);
    } catch (error) {
      showError("Failed to save scheduled task.");
      console.error("Failed to save scheduled task:", error);
    }
  };

  const isSubmitting = form.formState.isSubmitting;
  const isValid = form.formState.isValid;

  if (!task) return null;

  const lastUpdatedDate = task.updated_at ? parseISO(task.updated_at) : null;
  const formattedLastUpdated = lastUpdatedDate && !isNaN(lastUpdatedDate.getTime()) 
    ? format(lastUpdatedDate, 'MMM d, yyyy HH:mm') 
    : 'N/A';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-6 space-y-6 animate-slide-in-right">
        <SheetHeader className="border-b pb-4">
          <SheetTitle className="text-2xl font-bold flex items-center justify-between">
            Scheduled Task Details
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

              {/* Start Time & End Time */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="start_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="end_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Break Duration */}
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
                      Break duration associated with this task.
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

              {/* Is Flexible Switch */}
              <FormField
                control={form.control}
                name="is_flexible"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Flexible Task</FormLabel>
                      <FormDescription>
                        Can the scheduler automatically move this task?
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
                      <FormLabel>Locked Task</FormLabel>
                      <FormDescription>
                        Prevent the scheduler from moving or removing this task.
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

              {/* Energy Cost (Read-only, updated by logic) */}
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                  <FormLabel>Energy Cost</FormLabel>
                  <FormDescription>
                    Energy consumed upon completion (recalculated based on duration/criticality).
                  </FormDescription>
                </div>
                <div className="flex items-center gap-1 text-lg font-bold text-logo-yellow">
                  <Zap className="h-5 w-5" />
                  <span>{calculatedEnergyCost}</span>
                </div>
                <Input type="hidden" {...form.register('energy_cost')} /> {/* Hidden input to keep value in form state */}
              </FormItem>
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

export default ScheduledTaskDetailSheet;