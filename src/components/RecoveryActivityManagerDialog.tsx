import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useRecoveryActivities, RecoveryActivity, NewRecoveryActivity } from '@/hooks/use-recovery-activities';
import { Loader2, Plus, Edit, Trash2, X, Zap } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const activitySchema = z.object({
  name: z.string().min(1, "Name is required.").max(100),
  duration_minutes: z.coerce.number().min(1, "Duration must be at least 1 minute.").max(60, "Duration cannot exceed 60 minutes."),
});

type ActivityFormValues = z.infer<typeof activitySchema>;

interface RecoveryActivityManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const RecoveryActivityManagerDialog: React.FC<RecoveryActivityManagerDialogProps> = ({ open, onOpenChange }) => {
  const { activities, isLoading, addActivity, updateActivity, deleteActivity } = useRecoveryActivities();
  const [editingActivity, setEditingActivity] = useState<RecoveryActivity | null>(null);

  const form = useForm<ActivityFormValues>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      name: '',
      duration_minutes: 15,
    },
    mode: 'onChange',
  });

  useEffect(() => {
    if (editingActivity) {
      form.reset({
        name: editingActivity.name,
        duration_minutes: editingActivity.duration_minutes,
      });
    } else {
      form.reset({
        name: '',
        duration_minutes: 15,
      });
    }
  }, [editingActivity, form]);

  const onSubmit = (values: ActivityFormValues) => {
    if (editingActivity) {
      updateActivity({
        id: editingActivity.id,
        name: values.name,
        duration_minutes: values.duration_minutes,
      });
      setEditingActivity(null);
    } else {
      addActivity(values as NewRecoveryActivity);
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      deleteActivity(id);
    }
  };

  const isSubmitting = form.formState.isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-logo-green" /> Active Recovery Activities
          </DialogTitle>
          <DialogDescription>
            Manage the list of activities you can select during an Energy Regen Pod session.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-grow overflow-hidden py-4 space-y-4">
          <h3 className="text-lg font-semibold">Current Activities ({activities.length})</h3>
          <ScrollArea className="h-48 border rounded-md p-2">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : activities.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No activities defined yet.</p>
            ) : (
              <div className="space-y-2">
                {activities.map(activity => (
                  <div key={activity.id} className="flex items-center justify-between p-2 bg-secondary/50 rounded-md">
                    <span className="font-medium">{activity.name} ({activity.duration_minutes} min)</span>
                    <div className="flex gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setEditingActivity(activity)}
                            className="h-8 w-8 text-primary hover:bg-primary/10"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDelete(activity.id, activity.name)}
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <h3 className="text-lg font-semibold mt-6">{editingActivity ? `Edit: ${editingActivity.name}` : 'Add New Activity'}</h3>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Activity Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Meditate, Kriya Yoga" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="duration_minutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (minutes, max 60)</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" max="60" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="pt-4">
                {editingActivity && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setEditingActivity(null)}
                    className="flex items-center gap-2"
                  >
                    <X className="h-4 w-4" /> Cancel Edit
                  </Button>
                )}
                <Button type="submit" disabled={isSubmitting} className="flex items-center gap-2">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingActivity ? <Edit className="h-4 w-4" /> : <Plus className="h-4 w-4" />)}
                  {editingActivity ? 'Save Changes' : 'Add Activity'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RecoveryActivityManagerDialog;