"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, parseISO } from "date-fns";
import { X, Save, Loader2, Zap, Lock, Unlock, Home, Laptop, Globe, Music, Briefcase, Coffee, Copy } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { Switch } from '@/components/ui/switch';
import { RetiredTask, TaskEnvironment } from "@/types/scheduler";
import { showSuccess, showError } from "@/utils/toast";
import { calculateEnergyCost } from '@/lib/scheduler-utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEnvironments } from '@/hooks/use-environments';
import { useRetiredTasks } from '@/hooks/use-retired-tasks'; 
import { getLucideIconComponent } from '@/lib/utils'; 

const formSchema = z.object({
  name: z.string().min(1, { message: "Name is required." }).max(255),
  duration: z.preprocess(
    (val) => (val === "" ? null : val),
    z.number().min(1, "Duration must be at least 1 minute.").nullable()
  ),
  break_duration: z.preprocess(
    (val) => (val === "" ? null : val),
    z.number().min(0, "Break duration cannot be negative.").nullable()
  ),
  is_critical: z.boolean().default(false),
  is_backburner: z.boolean().default(false),
  is_completed: z.boolean().default(false),
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
  const { updateRetiredTaskDetails, completeRetiredTask, updateRetiredTaskStatus, addRetiredTask } = useRetiredTasks(); 
  const { environments, isLoading: isLoadingEnvironments } = useEnvironments();
  const [calculatedEnergyCost, setCalculatedEnergyCost] = useState(0);

  const form = useForm<RetiredTaskDetailFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      duration: 30,
      break_duration: 0,
      is_critical: false,
      is_backburner: false,
      is_completed: false,
      energy_cost: 0,
      is_custom_energy_cost: false,
      task_environment: 'laptop',
      is_work: false,
      is_break: false,
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
        is_completed: task.is_completed,
        energy_cost: task.energy_cost,
        is_custom_energy_cost: task.is_custom_energy_cost,
        task_environment: task.task_environment,
        is_work: task.is_work || false,
        is_break: task.is_break || false,
      });
      if (!task.is_custom_energy_cost) {
        setCalculatedEnergyCost(calculateEnergyCost(task.duration ?? 30, task.is_critical, task.is_backburner, task.is_break));
      } else {
        setCalculatedEnergyCost(task.energy_cost);
      }
    }
  }, [task, form]);

  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (!value.is_custom_energy_cost && (name === 'duration' || name === 'is_critical' || name === 'is_backburner' || name === 'is_break')) {
        const newEnergyCost = calculateEnergyCost(value.duration ?? 0, value.is_critical ?? false, value.is_backburner ?? false, value.is_break ?? false);
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
        if (values.is_completed) await completeRetiredTask(task);
        else await updateRetiredTaskStatus({ taskId: task.id, isCompleted: false });
      }
      await updateRetiredTaskDetails({
        id: task.id,
        name: values.name,
        duration: values.duration,
        break_duration: values.break_duration,
        is_critical: values.is_critical,
        is_backburner: values.is_backburner,
        energy_cost: values.energy_cost,
        is_custom_energy_cost: values.is_custom_energy_cost,
        task_environment: values.task_environment,
        is_work: values.is_work,
        is_break: values.is_break,
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save retired task:", error);
    }
  };

  const handleDuplicate = async () => {
    if (task) {
      const { id, retired_at, ...rest } = task;
      await addRetiredTask({
        ...rest,
        name: `${task.name} (Copy)`,
        is_completed: false,
        is_locked: false,
      });
      onOpenChange(false);
    }
  };

  const isSubmitting = form.formState.isSubmitting;
  const isValid = form.formState.isValid;
  const isCustomEnergyCostEnabled = form.watch('is_custom_energy_cost');

  if (!task) return null;

  const formattedRetiredAt = task.retired_at ? format(parseISO(task.retired_at), 'MMM d, yyyy HH:mm') : 'N/A';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto p-6 animate-pop-in">
        <DialogHeader className="border-b pb-4 mb-6">
          <DialogTitle className="text-2xl font-bold">Retired Task Details</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Retired: {formattedRetiredAt}
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
                  name="duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration (min)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} min="1" value={field.value ?? ''} />
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
                      <FormLabel>Break Duration (min)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} min="0" value={field.value ?? ''} />
                      </FormControl>
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
                        <Switch checked={field.value} onCheckedChange={(c) => { field.onChange(c); if(c){ form.setValue('is_critical', false); form.setValue('is_break', false); } }} disabled={form.watch('is_critical')} />
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
                        <Switch checked={field.value} onCheckedChange={(c) => { field.onChange(c); if(c){ form.setValue('is_critical', false); form.setValue('is_backburner', false); } }} disabled={form.watch('is_critical') || form.watch('is_backburner')} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_completed"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <FormLabel>Completed</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_work"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-primary" />
                        <FormLabel>Work Task</FormLabel>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="pt-4 border-t space-y-4">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/50">Actions</p>
                <Button type="button" variant="outline" onClick={handleDuplicate} className="w-full flex items-center justify-center gap-2">
                  <Copy className="h-4 w-4" /> Duplicate Task
                </Button>
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

export default RetiredTaskDetailSheet;