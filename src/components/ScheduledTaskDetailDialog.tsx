import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, parseISO } from "date-fns";
import { X, Save, Loader2, Zap, Sparkles, Lock, Unlock, Trash2, CheckCircle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { DBScheduledTask, ScheduledItemType } from "@/types/scheduler";
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import { showSuccess, showError } from "@/utils/toast";
import { Switch } from '@/components/ui/switch';
import { calculateEnergyCost } from '@/lib/scheduler-utils';
import { DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION } from '@/lib/constants';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const formSchema = z.object({
  name: z.string().min(1, { message: "Name is required." }).max(255),
  break_duration: z.coerce.number().min(0).nullable(),
  start_time: z.string().nullable(),
  end_time: z.string().nullable(),
  is_critical: z.boolean().default(false),
  is_flexible: z.boolean().default(true),
  is_locked: z.boolean().default(false),
  energy_cost: z.coerce.number().min(0).default(0),
  is_custom_energy_cost: z.boolean().default(false),
});

type ScheduledTaskDetailFormValues = z.infer<typeof formSchema>;

interface ScheduledTaskDetailDialogProps {
  task: DBScheduledTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleteTask: (task: DBScheduledTask) => void;
  onSkipTask: (task: DBScheduledTask) => void;
}

const ScheduledTaskDetailDialog: React.FC<ScheduledTaskDetailDialogProps> = ({
  task,
  open,
  onOpenChange,
  onCompleteTask,
  onSkipTask,
}) => {
  const { updateScheduledTask, deleteScheduledTask } = useSchedulerTasks();
  const [calculatedEnergyCost, setCalculatedEnergyCost] = useState(0);

  const form = useForm<ScheduledTaskDetailFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      break_duration: 0,
      start_time: null,
      end_time: null,
      is_critical: false,
      is_flexible: true,
      is_locked: false,
      energy_cost: 0,
      is_custom_energy_cost: false,
    },
  });

  const isTimedEvent = !!task?.start_time && !!task?.end_time;
  const durationMinutes = task?.start_time && task?.end_time 
    ? Math.floor((parseISO(task.end_time).getTime() - parseISO(task.start_time).getTime()) / (1000 * 60))
    : DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION;

  useEffect(() => {
    if (task) {
      form.reset({
        name: task.name,
        break_duration: task.break_duration || 0,
        start_time: task.start_time ? format(parseISO(task.start_time), 'HH:mm') : null,
        end_time: task.end_time ? format(parseISO(task.end_time), 'HH:mm') : null,
        is_critical: task.is_critical,
        is_flexible: task.is_flexible,
        is_locked: task.is_locked,
        energy_cost: task.energy_cost,
        is_custom_energy_cost: task.is_custom_energy_cost,
      });
      
      if (!task.is_custom_energy_cost) {
        setCalculatedEnergyCost(calculateEnergyCost(durationMinutes, task.is_critical));
      } else {
        setCalculatedEnergyCost(task.energy_cost);
      }
    }
  }, [task, form, durationMinutes]);

  // Effect to recalculate energy cost when is_critical changes
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (!value.is_custom_energy_cost && name === 'is_critical') {
        const newEnergyCost = calculateEnergyCost(durationMinutes, value.is_critical ?? false);
        setCalculatedEnergyCost(newEnergyCost);
        form.setValue('energy_cost', newEnergyCost, { shouldValidate: true });
      } else if (name === 'is_custom_energy_cost' && !value.is_custom_energy_cost) {
        const isCritical = form.getValues('is_critical');
        const newEnergyCost = calculateEnergyCost(durationMinutes, isCritical ?? false);
        setCalculatedEnergyCost(newEnergyCost);
        form.setValue('energy_cost', newEnergyCost, { shouldValidate: true });
      }
    });
    return () => subscription.unsubscribe();
  }, [form, durationMinutes]);


  const handleSubmit = async (values: ScheduledTaskDetailFormValues) => {
    if (!task) return;

    const isFlexible = !isTimedEvent && values.is_flexible;

    // Reconstruct ISO strings for start/end times, keeping the original date part
    let newStartTimeISO = task.start_time;
    let newEndTimeISO = task.end_time;

    if (isTimedEvent && values.start_time && values.end_time) {
      const originalStartDate = parseISO(task.start_time!);
      const [startHours, startMinutes] = values.start_time.split(':').map(Number);
      const [endHours, endMinutes] = values.end_time.split(':').map(Number);

      let newStart = new Date(originalStartDate);
      newStart.setHours(startHours, startMinutes, 0, 0);
      
      let newEnd = new Date(originalStartDate);
      newEnd.setHours(endHours, endMinutes, 0, 0);

      // Handle rollover if end time is before start time
      if (newEnd <= newStart) {
        newEnd.setDate(newEnd.getDate() + 1);
      }

      newStartTimeISO = newStart.toISOString();
      newEndTimeISO = newEnd.toISOString();
    }

    try {
      await updateScheduledTask({
        id: task.id,
        name: values.name,
        break_duration: values.break_duration,
        start_time: newStartTimeISO,
        end_time: newEndTimeISO,
        is_critical: values.is_critical,
        is_flexible: isFlexible,
        is_locked: values.is_locked,
        energy_cost: values.is_custom_energy_cost ? values.energy_cost : calculatedEnergyCost,
        is_custom_energy_cost: values.is_custom_energy_cost,
      });
      showSuccess("Scheduled task updated successfully!");
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save scheduled task:", error);
      showError("Failed to save scheduled task.");
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    if (window.confirm(`Are you sure you want to delete the scheduled task "${task.name}"?`)) {
      try {
        await deleteScheduledTask(task.id);
        showSuccess("Scheduled task deleted.");
        onOpenChange(false);
      } catch (error) {
        console.error("Failed to delete scheduled task:", error);
        showError("Failed to delete scheduled task.");
      }
    }
  };

  const isSubmitting = form.formState.isSubmitting;
  const isValid = form.formState.isValid;
  const isCustomEnergyCostEnabled = form.watch('is_custom_energy_cost');

  if (!task) return null;

  const isBreak = task.name.toLowerCase() === 'break';
  const isTimeOff = task.name.toLowerCase() === 'time off';
  const itemType: ScheduledItemType = isBreak ? 'break' : (isTimeOff ? 'time-off' : 'task');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] animate-pop-in">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            {itemType === 'task' ? 'Task Details' : (itemType === 'break' ? 'Break Details' : 'Time Off Details')}
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-5 w-5" />
            </Button>
          </DialogTitle>
          <DialogDescription>
            Scheduled for {format(parseISO(task.scheduled_date), 'PPP')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            
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

            {/* Time Inputs (Only for Timed Events) */}
            {isTimedEvent && (
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
            )}

            {/* Break Duration (Only for Tasks/Breaks) */}
            {itemType !== 'time-off' && (
              <FormField
                control={form.control}
                name="break_duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Break Duration (min)</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" placeholder="0" {...field} onChange={e => field.onChange(e.target.value === '' ? null : Number(e.target.value))} />
                    </FormControl>
                    <FormDescription>
                      Scheduled break time immediately following this task.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Is Critical Switch (Only for Tasks) */}
            {itemType === 'task' && (
              <FormField
                control={form.control}
                name="is_critical"
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
            )}

            {/* Is Flexible Switch (Only for Duration-Based Tasks/Breaks) */}
            {!isTimedEvent && (
              <FormField
                control={form.control}
                name="is_flexible"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Flexible Placement</FormLabel>
                      <FormDescription>
                        Allows the auto-scheduler to move this task to fill gaps.
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
            )}

            {/* Is Locked Switch */}
            <FormField
              control={form.control}
              name="is_locked"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Lock Task</FormLabel>
                    <FormDescription>
                      Prevents the scheduler from moving or deleting this task.
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

            {/* Energy Cost Controls (Only for Tasks/Breaks) */}
            {itemType !== 'time-off' && (
              <>
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
              </>
            )}

            <DialogFooter className="flex flex-col sm:flex-row sm:justify-between pt-4 gap-2">
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
                    Delete
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{task.is_locked ? "Unlock to Delete" : "Delete this scheduled item"}</p>
                </TooltipContent>
              </Tooltip>
              
              <div className="flex gap-2 w-full sm:w-auto">
                {itemType === 'task' && !task.is_completed && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => onCompleteTask(task)}
                        disabled={task.is_locked || isSubmitting}
                        className="w-full sm:w-auto flex items-center gap-2 text-logo-green border-logo-green hover:bg-logo-green/10"
                        style={task.is_locked ? { pointerEvents: 'auto' } : undefined}
                      >
                        <CheckCircle className="h-4 w-4" />
                        Complete
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{task.is_locked ? "Unlock to Complete" : "Mark task as completed"}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                {itemType === 'task' && !task.is_completed && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => onSkipTask(task)}
                        disabled={task.is_locked || isSubmitting}
                        className="w-full sm:w-auto flex items-center gap-2 text-logo-orange border-logo-orange hover:bg-logo-orange/10"
                        style={task.is_locked ? { pointerEvents: 'auto' } : undefined}
                      >
                        <Zap className="h-4 w-4" />
                        Skip
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{task.is_locked ? "Unlock to Skip" : "Move task to Aether Sink"}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                <Button 
                  type="submit" 
                  disabled={isSubmitting || !isValid} 
                  className="w-full sm:w-auto flex items-center gap-2 bg-primary hover:bg-primary/90"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4" />}
                  Save
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default ScheduledTaskDetailDialog;