import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { X, Save, Loader2, CalendarIcon, Zap, Sparkles } from "lucide-react";

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

// Define the schema for editing, matching the TaskEditDialog logic
const formSchema = z.object({
  title: z.string().min(1, { message: "Title is required." }),
  description: z.string().optional(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
  dueDate: z.date({ required_error: "Due date is required." }), 
  // New fields for gamification metadata
  metadata_xp: z.coerce.number().int().min(0, "XP must be a positive number."),
  energy_cost: z.coerce.number().int().min(0, "Energy cost must be a positive number."),
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

  const form = useForm<TaskDetailFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "MEDIUM",
      dueDate: new Date(),
      metadata_xp: 0,
      energy_cost: 0,
    },
  });

  // Reset form when a new task is selected or sheet opens
  useEffect(() => {
    if (task) {
      form.reset({
        title: task.title,
        description: task.description || "",
        priority: task.priority,
        dueDate: task.due_date ? new Date(task.due_date) : new Date(), 
        metadata_xp: task.metadata_xp,
        energy_cost: task.energy_cost,
      });
    }
  }, [task, form]);

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
        metadata_xp: values.metadata_xp, // Include XP
        energy_cost: values.energy_cost, // Include Energy Cost
      });
      showSuccess("Task updated successfully!");
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save task:", error);
      // Error toast is handled inside useTasks if it's a completion/energy issue, 
      // otherwise, the mutation onError handles it.
    }
  };

  const isSubmitting = form.formState.isSubmitting;
  const isValid = form.formState.isValid;

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
  
  // Helper to safely format updated_at
  const lastUpdatedDate = task.updated_at ? new Date(task.updated_at) : null;
  const formattedLastUpdated = lastUpdatedDate && !isNaN(lastUpdatedDate.getTime()) 
    ? format(lastUpdatedDate, 'MMM d, yyyy HH:mm') 
    : 'N/A';


  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-6 space-y-6 animate-slide-in-right">
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

        <div className="flex-grow overflow-y-auto space-y-6">
          {/* Metadata Overview - Now editable fields */}
          <div className="grid grid-cols-2 gap-4 text-sm font-medium">
            <FormField
              control={form.control}
              name="metadata_xp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 text-logo-yellow">
                    <Sparkles className="h-4 w-4" /> XP Reward
                  </FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="XP" 
                      {...field} 
                      onChange={(e) => field.onChange(e.target.value)} // Use onChange to handle string input for z.coerce.number
                      className="font-mono text-foreground"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="energy_cost"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 text-primary">
                    <Zap className="h-4 w-4" /> Energy Cost
                  </FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="Energy" 
                      {...field} 
                      onChange={(e) => field.onChange(e.target.value)} // Use onChange to handle string input for z.coerce.number
                      className="font-mono text-foreground"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              
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
              
              {/* Save Button in Footer */}
              <div className="sticky bottom-0 bg-card pt-4 border-t">
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
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default TaskDetailSheet;