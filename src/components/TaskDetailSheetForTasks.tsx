"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, parseISO } from "date-fns";
import { X, Save, Loader2, Zap, Lock, Unlock, Briefcase } from "lucide-react";

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
import { calculateEnergyCost } from '@/lib/scheduler-utils';
import { DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION } from '@/lib/constants';
import { Badge } from '@/components/ui/badge'; // Added Badge import

const formSchema = z.object({
  title: z.string().min(1, { message: "Title is required." }).max(255),
  description: z.string().max(1000).optional(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
  dueDate: z.date({ required_error: "Due date is required." }), 
  isCritical: z.boolean().default(false),
  isBackburner: z.boolean().default(false),
  energy_cost: z.coerce.number().min(0).default(0),
  is_custom_energy_cost: z.boolean().default(false),
  is_work: z.boolean().default(false), // NEW: Add is_work flag
});

type TaskDetailFormValues = z.infer<typeof formSchema>;

interface TaskDetailSheetForTasksProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TaskDetailSheetForTasks: React.FC<TaskDetailSheetForTasksProps> = ({
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
      title: "",
      description: "",
      priority: "MEDIUM",
      dueDate: new Date(),
      isCritical: false,
      isBackburner: false,
      energy_cost: 0,
      is_custom_energy_cost: false,
      is_work: false, // NEW: Default to false
    },
    mode: 'onChange',
  });

  useEffect(() => {
    if (task) {
      form.reset({
        title: task.title,
        description: task.description || "",
        priority: task.priority,
        dueDate: task.due_date ? new Date(task.due_date) : new Date(),
        isCritical: task.is_critical,
        isBackburner: task.is_backburner,
        energy_cost: task.energy_cost,
        is_custom_energy_cost: task.is_custom_energy_cost,
        is_work: task.is_work || false, // NEW: Reset is_work
      });
      // NEW: Set initial calculated cost
      if (!task.is_custom_energy_cost) {
        setCalculatedEnergyCost(calculateEnergyCost(DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION, task.is_critical, task.is_backburner));
      } else {
        setCalculatedEnergyCost(task.energy_cost);
      }
    }
  }, [task, form]);

  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (!value.is_custom_energy_cost && (name === 'isCritical' || name === 'isBackburner')) {
        const isCritical = value.isCritical ?? false;
        const isBackburner = value.isBackburner ?? false;
        const newEnergyCost = calculateEnergyCost(DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION, isCritical, isBackburner);
        setCalculatedEnergyCost(newEnergyCost);
        form.setValue('energy_cost', newEnergyCost, { shouldValidate: true });
      } else if (name === 'is_custom_energy_cost' && !value.is_custom_energy_cost) {
        const isCritical = form.getValues('isCritical');
        const isBackburner = form.getValues('isBackburner');
        const newEnergyCost = calculateEnergyCost(DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION, isCritical ?? false, isBackburner ?? false);
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
        is_backburner: values.isBackburner,
        energy_cost: values.is_custom_energy_cost ? values.energy_cost : calculatedEnergyCost,
        is_custom_energy_cost: values.is_custom_energy_cost,
        is_work: values.is_work, // NEW: Include is_work flag
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
  const isCritical = form.watch('isCritical');
  const isBackburner = form.watch('isBackburner');

  if (!task) return null;

  const getPriorityBadgeClasses = (priority: Task['priority']) => {
    switch (priority) {
      case 'HIGH':
        return 'bg-destructive text-destructive-foreground border-destructive';
      case 'MEDIUM':
        return 'bg-logo-orange/20 text-logo-orange border-logo-orange';
      case 'LOW':
        return 'bg-logo-green/20 text-logo-green border-logo-green';
      default:
        return 'bg-muted text-muted-foreground border-border';
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
            <Badge 
              variant="outline" 
              className={cn(
                "capitalize px-2.5 py-1 text-xs font-semibold shrink-0",
                getPriorityBadgeClasses(form.watch('priority') || task.priority)
              )}
            >
              {form.watch('priority') || task.priority}
            </Badge>
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
                          <SelectTrigger>
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
                          if (checked) form.setValue('isBackburner', false);
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
                          if (checked) form.setValue('isCritical', false);
                        }}
                        disabled={isCritical}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* NEW: Is Work Switch */}
              <FormField
                control={form.control}
                name="is_work"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-primary" />
                        <FormLabel className="text-base font-semibold">Work Task</FormLabel>
                      </div>
                      <FormDescription className="text-xs">
                        Tag this task as work for analytics.
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

export default TaskDetailSheetForTasks;