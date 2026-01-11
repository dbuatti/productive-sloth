"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, parseISO, setHours, setMinutes, isBefore, addDays } from "date-fns";
import { X, Save, Loader2, Zap, Lock, Unlock, Home, Laptop, Globe, Music, Briefcase, Coffee, Copy, ArrowRight } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose
} from "@/components/ui/dialog";
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
import { cn, getLucideIconComponent } from '@/lib/utils'; 
import { DBScheduledTask, TaskEnvironment } from "@/types/scheduler";
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import { showSuccess, showError } from "@/utils/toast";
import { Switch } from '@/components/ui/switch';
import { calculateEnergyCost, setTimeOnDate } from '@/lib/scheduler-utils';
import { useEnvironments } from '@/hooks/use-environments';

const formSchema = z.object({
  name: z.string().min(1, { message: "Name is required." }).max(255),
  start_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)").or(z.literal('')).nullable(),
  end_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)").or(z.literal('')).nullable(),
  break_duration: z.preprocess(
    (val) => (val === "" ? null : val),
    z.number().min(0, "Break duration cannot be negative.").nullable()
  ),
  is_critical: z.boolean().default(false),
  is_backburner: z.boolean().default(false),
  is_flexible: z.boolean().default(true),
  is_locked: z.boolean().default(false),
  energy_cost: z.coerce.number().default(0),
  is_custom_energy_cost: z.boolean().default(false),
  task_environment: z.string().default('laptop'),
  is_work: z.boolean().default(false),
  is_break: z.boolean().default(false),
}).refine(data => {
  if (data.is_break && !data.is_custom_energy_cost) {
    return data.energy_cost <= 0;
  }
  return data.energy_cost >= 0;
}, {
  message: "Energy cost must be 0 or negative for break tasks, and non-negative for others.",
  path: ["energy_cost"],
}).refine(data => {
  const hasStartTime = data.start_time !== null && data.start_time !== "";
  const hasEndTime = data.end_time !== null && data.end_time !== "";
  return (hasStartTime && hasEndTime) || (!hasStartTime && !hasEndTime);
}, {
  message: "Both start and end times must be provided or both left empty.",
  path: ["start_time"],
});

type ScheduledTaskDetailFormValues = z.infer<typeof formSchema>;

interface ScheduledTaskDetailDialogProps {
  task: DBScheduledTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDayString: string;
}

const ScheduledTaskDetailDialog: React.FC<ScheduledTaskDetailDialogProps> = ({
  task,
  open,
  onOpenChange,
  selectedDayString,
}) => {
  const { updateScheduledTaskDetails, duplicateScheduledTask, moveTaskToTomorrow } = useSchedulerTasks(selectedDayString);
  const { environments, isLoading: isLoadingEnvironments } = useEnvironments();
  const [calculatedEnergyCost, setCalculatedEnergyCost] = useState(0);

  const form = useForm<ScheduledTaskDetailFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      start_time: "09:00",
      end_time: "10:00",
      break_duration: 0,
      is_critical: false,
      is_backburner: false,
      is_flexible: true,
      is_locked: false,
      energy_cost: 0,
      is_custom_energy_cost: false,
      task_environment: 'laptop',
      is_work: false,
      is_break: false,
    },
  });

  useEffect(() => {
    if (task) {
      const startTime = task.start_time ? format(parseISO(task.start_time), 'HH:mm') : '';
      const endTime = task.end_time ? format(parseISO(task.end_time), 'HH:mm') : '';
      form.reset({
        name: task.name,
        start_time: startTime,
        end_time: endTime,
        break_duration: task.break_duration ?? 0,
        is_critical: task.is_critical,
        is_backburner: task.is_backburner,
        is_flexible: task.is_flexible,
        is_locked: task.is_locked,
        energy_cost: task.energy_cost,
        is_custom_energy_cost: task.is_custom_energy_cost,
        task_environment: task.task_environment,
        is_work: task.is_work || false,
        is_break: task.is_break || false,
      });
      if (!task.is_custom_energy_cost && startTime && endTime) {
        const selectedDayDate = parseISO(selectedDayString);
        let sTime = setTimeOnDate(selectedDayDate, startTime);
        let eTime = setTimeOnDate(selectedDayDate, endTime);
        if (isBefore(eTime, sTime)) eTime = addDays(eTime, 1);
        const duration = Math.floor((eTime.getTime() - sTime.getTime()) / (1000 * 60));
        setCalculatedEnergyCost(calculateEnergyCost(duration, task.is_critical, task.is_backburner, task.is_break));
      } else {
        setCalculatedEnergyCost(task.energy_cost);
      }
    }
  }, [task, form, selectedDayString]);

  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (!value.is_custom_energy_cost && (name === 'start_time' || name === 'end_time' || name === 'is_critical' || name === 'is_backburner' || name === 'is_break')) {
        const startTimeStr = value.start_time;
        const endTimeStr = value.end_time;
        if (startTimeStr && endTimeStr) {
          const selectedDayDate = parseISO(selectedDayString);
          let startTime = setTimeOnDate(selectedDayDate, startTimeStr);
          let endTime = setTimeOnDate(selectedDayDate, endTimeStr);
          if (isBefore(endTime, startTime)) endTime = addDays(endTime, 1);
          const duration = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
          const newEnergyCost = calculateEnergyCost(duration, value.is_critical ?? false, value.is_backburner ?? false, value.is_break ?? false);
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
    const finalStartTimeStr = values.start_time === "" ? null : values.start_time;
    const finalEndTimeStr = values.end_time === "" ? null : values.end_time;
    let finalStartTime: string | null = null;
    let finalEndTime: string | null = null;
    if (finalStartTimeStr && finalEndTimeStr) {
      let startTime = setTimeOnDate(selectedDayDate, finalStartTimeStr);
      let endTime = setTimeOnDate(selectedDayDate, finalEndTimeStr);
      if (isBefore(endTime, startTime)) endTime = addDays(endTime, 1);
      finalStartTime = startTime.toISOString();
      finalEndTime = endTime.toISOString();
    }
    try {
      await updateScheduledTaskDetails({
        id: task.id,
        name: values.name,
        start_time: finalStartTime,
        end_time: finalEndTime,
        break_duration: values.break_duration,
        is_critical: values.is_critical,
        is_backburner: values.is_backburner,
        is_flexible: values.is_flexible,
        is_locked: values.is_locked,
        energy_cost: values.energy_cost,
        is_custom_energy_cost: values.is_custom_energy_cost,
        task_environment: values.task_environment,
        is_work: values.is_work,
        is_break: values.is_break,
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save scheduled task:", error);
    }
  };

  const handleDuplicate = () => {
    if (task) {
      duplicateScheduledTask(task);
      onOpenChange(false);
    }
  };

  const handleMoveToTomorrow = () => {
    if (task) {
      moveTaskToTomorrow(task);
      onOpenChange(false);
    }
  };

  const isSubmitting = form.formState.isSubmitting;
  const isValid = form.formState.isValid;
  const isCustomEnergyCostEnabled = form.watch('is_custom_energy_cost');
  const isCritical = form.watch('is_critical');
  const isBackburner = form.watch('is_backburner');
  const isBreak = form.watch('is_break');

  if (!task) return null;

  const formattedLastUpdated = task.updated_at ? format(parseISO(task.updated_at), 'MMM d, yyyy HH:mm') : 'N/A';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto p-6 animate-pop-in">
        <DialogHeader className="border-b pb-4 mb-6">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold">Scheduled Task Details</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Last updated: {formattedLastUpdated}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col h-full space-y-6">
            
            <div className="flex-grow overflow-y-auto space-y-6 pb-8">
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

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="start_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} value={field.value ?? ''} />
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
                        <Input type="time" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="break_duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Break Duration (min)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} min="0" value={field.value ?? ''} />
                    </FormControl>
                    <FormDescription>
                      Break duration associated with this task.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                          const IconComponent = getLucideIconComponent(env.icon);
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
                  </FormItem>
                )}
              />

              <div className="grid gap-4">
                <FormField
                  control={form.control}
                  name="is_critical"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <FormLabel>Critical Task</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={(c) => { field.onChange(c); if(c){ form.setValue('is_backburner', false); form.setValue('is_break', false); } }} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="is_backburner"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <FormLabel>Backburner Task</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={(c) => { field.onChange(c); if(c){ form.setValue('is_critical', false); form.setValue('is_break', false); } }} disabled={isCritical} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_break"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="flex items-center gap-2">
                        <Coffee className="h-4 w-4 text-logo-orange" />
                        <FormLabel>Break Task</FormLabel>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={(c) => { field.onChange(c); if(c){ form.setValue('is_critical', false); form.setValue('is_backburner', false); } }} disabled={isCritical || isBackburner} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_flexible"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <FormLabel>Flexible Task</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_locked"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <FormLabel>Locked Task</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="pt-4 border-t space-y-4">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/50">Actions</p>
                <div className="grid grid-cols-2 gap-3">
                  <Button type="button" variant="outline" onClick={handleDuplicate} className="flex items-center gap-2">
                    <Copy className="h-4 w-4" /> Duplicate
                  </Button>
                  <Button type="button" variant="outline" onClick={handleMoveToTomorrow} className="flex items-center gap-2">
                    <ArrowRight className="h-4 w-4" /> Punt Tomorrow
                  </Button>
                </div>
              </div>

              <FormField
                control={form.control}
                name="is_custom_energy_cost"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm mt-4">
                    <FormLabel>Custom Energy Cost</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="energy_cost"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <FormLabel>Energy Cost</FormLabel>
                    <div className="flex items-center gap-1 text-lg font-bold text-logo-yellow">
                      <Zap className="h-5 w-5" />
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          className="w-20 text-right font-mono text-lg font-bold border-none focus-visible:ring-0"
                          readOnly={!isCustomEnergyCostEnabled}
                          value={isCustomEnergyCostEnabled ? field.value : calculatedEnergyCost}
                        />
                      </FormControl>
                    </div>
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
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Changes
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default ScheduledTaskDetailDialog;