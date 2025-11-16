import React, { useEffect } from "react";
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

const formSchema = z.object({
  title: z.string().min(1, { message: "Title is required." }).max(255),
  description: z.string().optional(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
  dueDate: z.date({ required_error: "Due date is required." }), 
  isCritical: z.boolean().default(false),
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

  const form = useForm<TaskDetailFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "MEDIUM",
      dueDate: new Date(),
      isCritical: false,
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
        is_critical: values.isCritical,
      });
      showSuccess("Task updated successfully!");
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save task:", error);
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

              {/* Is Critical Switch */}
              <FormField
                control={form.control}
                name="isCritical"
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