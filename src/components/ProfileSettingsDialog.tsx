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
import { Label } from '@/components/ui/label'; // Import Label component
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"; // Import AlertDialog components

interface ProfileSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const profileSchema = z.object({
  first_name: z.string().min(1, "First name is required.").max(50, "First name cannot exceed 50 characters.").nullable(),
  last_name: z.string().min(1, "Last name is required.").max(50, "Last name cannot exceed 50 characters.").nullable(),
  avatar_url: z.string().url("Must be a valid URL.").nullable().or(z.literal('')), // Added avatar_url
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const MAX_ENERGY = 100; // Consistent with SessionProvider and useTasks

const ProfileSettingsDialog: React.FC<ProfileSettingsDialogProps> = ({ open, onOpenChange }) => {
  const { user, profile, refreshProfile, rechargeEnergy, resetDailyStreak } = useSession(); // Get resetDailyStreak

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      avatar_url: '', // Default to empty string
    },
    mode: 'onChange',
  });

  useEffect(() => {
    if (open && profile) {
      form.reset({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        avatar_url: profile.avatar_url || '', // Initialize avatar_url
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
          avatar_url: values.avatar_url === '' ? null : values.avatar_url, // Store null if empty string
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

  const handleDeleteAccount = async () => {
    if (!user) {
      showError("You must be logged in to delete your account.");
      return;
    }
    // IMPORTANT: Client-side Supabase SDK does not allow direct user deletion for security reasons.
    // This action typically requires a server-side function (e.g., Supabase Edge Function)
    // that uses the Supabase Admin client with the service_role key.
    // For now, this is a placeholder.
    showError("Account deletion is not yet implemented client-side. Please contact support or use the Supabase dashboard.");
    console.warn("Attempted client-side account deletion for user:", user.id);
    // In a real app, you would invoke an Edge Function here:
    // const { data, error } = await supabase.functions.invoke('delete-user', { body: { userId: user.id } });
    // if (error) showError(`Failed to delete account: ${error.message}`);
    // else { showSuccess("Account deleted successfully."); await supabase.auth.signOut(); }
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
            <FormField
              control={form.control}
              name="avatar_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Avatar URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com/avatar.jpg" {...field} value={field.value || ''} />
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
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Energy</Label>
                  <Input className="col-span-3" value={profile.energy} readOnly />
                </div>
                <div className="flex justify-end mt-2">
                  <Button 
                    type="button" 
                    onClick={() => rechargeEnergy()} 
                    disabled={profile.energy >= MAX_ENERGY}
                  >
                    Recharge Energy
                  </Button>
                </div>

                <Separator className="my-2" />
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Daily Streak</Label>
                  <Input className="col-span-3" value={profile.daily_streak} readOnly />
                </div>
                <div className="flex justify-end mt-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" type="button">
                        Reset Daily Streak
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action will reset your daily streak to 0. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => resetDailyStreak()} className="bg-destructive hover:bg-destructive/90">
                          Reset Streak
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
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

        {/* Account Actions Section */}
        <Separator className="my-4" />
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Account Actions</h3>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full">Delete Account</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete your account and all associated data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive hover:bg-destructive/90">
                  Confirm Deletion
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileSettingsDialog;