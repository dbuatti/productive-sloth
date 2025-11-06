import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { Separator } from '@/components/ui/separator';

interface ProfileSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const profileSchema = z.object({
  first_name: z.string().min(1, "First name is required.").max(50, "First name cannot exceed 50 characters.").nullable(),
  last_name: z.string().min(1, "Last name is required.").max(50, "Last name cannot exceed 50 characters.").nullable(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const ProfileSettingsDialog: React.FC<ProfileSettingsDialogProps> = ({ open, onOpenChange }) => {
  const { user, profile, refreshProfile } = useSession();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
    },
    mode: 'onChange',
  });

  useEffect(() => {
    if (open && profile) {
      form.reset({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
      });
    }
  }, [open, profile, form]);

  const onSubmit = async (values: ProfileFormValues) => {
    if (!user) {
      showError("You must be logged in to update your profile.");
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          first_name: values.first_name,
          last_name: values.last_name,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' }); // Use upsert to insert if not exists, update if exists

      if (error) {
        throw error;
      }

      await refreshProfile(); // Refresh the session context with new profile data
      showSuccess("Profile updated successfully!");
      onOpenChange(false);
    } catch (error: any) {
      showError(`Failed to update profile: ${error.message}`);
      console.error("Profile update error:", error);
    }
  };

  const isSubmitting = form.formState.isSubmitting;
  const isValid = form.formState.isValid;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Profile Settings</DialogTitle>
          <DialogDescription>
            Update your personal information.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
            <FormField
              control={form.control}
              name="first_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="last_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Doe" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {profile && (
              <>
                <Separator className="my-2" />
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">XP</Label>
                  <Input className="col-span-3" value={profile.xp} readOnly />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Level</Label>
                  <Input className="col-span-3" value={profile.level} readOnly />
                </div>
              </>
            )}

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting || !isValid}>
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileSettingsDialog;