import React, { useEffect } from 'react';
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
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSession } from '@/hooks/use-session';
import { showSuccess, showError } from '@/utils/toast';
import { Loader2 } from 'lucide-react';

const workdayWindowSchema = z.object({
  default_auto_schedule_start_time: z.preprocess(
    (val) => (val === "" ? null : val),
    z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)").nullable()
  ),
  default_auto_schedule_end_time: z.preprocess(
    (val) => (val === "" ? null : val),
    z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)").nullable()
  ),
});

type WorkdayWindowFormValues = z.infer<typeof workdayWindowSchema>;

interface WorkdayWindowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const WorkdayWindowDialog: React.FC<WorkdayWindowDialogProps> = ({ open, onOpenChange }) => {
  const { profile, isLoading: isSessionLoading, updateProfile } = useSession();

  const form = useForm<WorkdayWindowFormValues>({
    resolver: zodResolver(workdayWindowSchema),
    defaultValues: {
      default_auto_schedule_start_time: '09:00',
      default_auto_schedule_end_time: '17:00',
    },
    mode: 'onChange',
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        default_auto_schedule_start_time: profile.default_auto_schedule_start_time || '',
        default_auto_schedule_end_time: profile.default_auto_schedule_end_time || '',
      });
    }
  }, [profile, form]);

  const onSubmit = async (values: WorkdayWindowFormValues) => {
    try {
      await updateProfile({
        default_auto_schedule_start_time: values.default_auto_schedule_start_time,
        default_auto_schedule_end_time: values.default_auto_schedule_end_time,
      });
      showSuccess("Workday window updated successfully!");
      onOpenChange(false);
    } catch (error: any) {
      showError(`Failed to update workday window: ${error.message}`);
      console.error("Workday window update error:", error);
    }
  };

  const isSubmitting = form.formState.isSubmitting;
  const isValid = form.formState.isValid;

  if (isSessionLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Adjust Workday Window</DialogTitle>
          <DialogDescription>
            Set the default start and end times for your auto-scheduler.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="default_auto_schedule_start_time"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between">
                  <div className="space-y-0.5">
                    <FormLabel>Default Workday Start Time</FormLabel>
                    <FormDescription className="text-sm text-muted-foreground">
                      The time the auto-scheduler should start filling your flexible tasks.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Input type="time" className="w-auto" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="default_auto_schedule_end_time"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between">
                  <div className="space-y-0.5">
                        <FormLabel>Default Workday End Time</FormLabel>
                        <FormDescription className="text-sm text-muted-foreground">
                          The latest time the auto-scheduler should place flexible tasks.
                        </FormDescription>
                      </div>
                  <FormControl>
                    <Input type="time" className="w-auto" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting || !isValid}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default WorkdayWindowDialog;