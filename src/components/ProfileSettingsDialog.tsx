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
import { Label } from '@/components/ui/label';
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
} from "@/components/ui/alert-dialog";
import ThemeToggle from './ThemeToggle'; // Import ThemeToggle
import { LogOut } from 'lucide-react'; // Import LogOut icon
import { Switch } from '@/components/ui/switch'; // Import Switch component

interface ProfileSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const profileSchema = z.object({
  first_name: z.string().min(1, "First name is required.").max(50, "First name cannot exceed 50 characters.").nullable(),
  last_name: z.string().min(1, "Last name is required.").max(50, "Last name cannot exceed 50 characters.").nullable(),
  avatar_url: z.string().url("Must be a valid URL.").nullable().or(z.literal('')),
  enable_daily_challenge_notifications: z.boolean(), // Added notification preference
  enable_low_energy_notifications: z.boolean(), // Added notification preference
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const MAX_ENERGY = 100;

const ProfileSettingsDialog: React.FC<ProfileSettingsDialogProps> = ({ open, onOpenChange }) => {
  const { user, profile, refreshProfile, rechargeEnergy, resetDailyStreak, updateNotificationPreferences } = useSession();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      avatar_url: '',
      enable_daily_challenge_notifications: true, // Default to true
      enable_low_energy_notifications: true, // Default to true
    },
    mode: 'onChange',
  });

  useEffect(() => {
    if (open && profile) {
      form.reset({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        avatar_url: profile.avatar_url || '',
        enable_daily_challenge_notifications: profile.enable_daily_challenge_notifications,
        enable_low_energy_notifications: profile.enable_low_energy_notifications,
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
          avatar_url: values.avatar_url === '' ? null : values.avatar_url,
          updated_at: new Date().toISOString(),
          // Notification preferences are handled by a separate function
        }, { onConflict: 'id' });

      if (error) {
        throw error;
      }

      await refreshProfile();
      showSuccess("Profile updated successfully!");
      onOpenChange(false);
    } catch (error: any) {
      showError(`Failed to update profile: ${error.message}`);
      console.error("Profile update error:", error);
    }
  };

  const handleResetGameProgress = async () => {
    if (!user) {
      showError("You must be logged in to reset game progress.");
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          xp: 0,
          level: 1,
          daily_streak: 0,
          last_streak_update: null,
          energy: MAX_ENERGY,
          tasks_completed_today: 0,
          last_daily_reward_claim: null,
          last_daily_reward_notification: null,
          last_low_energy_notification: null,
          updated_at: new Date().toISOString(),
          enable_daily_challenge_notifications: true, // Reset to default
          enable_low_energy_notifications: true, // Reset to default
        })
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      // Also delete all tasks associated with the user for a true "fresh start"
      const { error: tasksError } = await supabase
        .from('tasks')
        .delete()
        .eq('user_id', user.id);

      if (tasksError) {
        throw tasksError;
      }

      await refreshProfile();
      showSuccess("Game progress reset successfully! All tasks cleared.");
      onOpenChange(false);
      // Consider a full page refresh or redirect to ensure all states are reset
      window.location.reload(); 
    } catch (error: any) {
      showError(`Failed to reset game progress: ${error.message}`);
      console.error("Reset game progress error:", error);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) {
      showError("You must be logged in to delete your account.");
      return;
    }
    showError("Account deletion is not yet implemented client-side. Please contact support or use the Supabase dashboard.");
    console.warn("Attempted client-side account deletion for user:", user.id);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    onOpenChange(false); // Close dialog after signing out
  };

  const isSubmitting = form.formState.isSubmitting;
  const isValid = form.formState.isValid;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto"> {/* Increased width to sm:max-w-lg and added scrolling */}
        <DialogHeader>
          <DialogTitle>Profile Settings</DialogTitle>
          <DialogDescription>
            Update your personal information and manage your account.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
            {/* Personal Information */}
            <h3 className="text-lg font-semibold">Personal Information</h3>
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

            <DialogFooter className="pt-4">
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting || !isValid}>
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </Form>

        {profile && (
          <>
            <Separator className="my-4" />
            {/* Game Stats */}
            <h3 className="text-lg font-semibold">Game Stats</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>XP</Label>
                <Input value={profile.xp} readOnly />
              </div>
              <div className="space-y-2">
                <Label>Level</Label>
                <Input value={profile.level} readOnly />
              </div>
              <div className="space-y-2">
                <Label>Energy</Label>
                <Input value={profile.energy} readOnly />
              </div>
              <div className="space-y-2">
                <Label>Daily Streak</Label>
                <Input value={profile.daily_streak} readOnly />
              </div>
              <div className="space-y-2 col-span-2"> {/* Make this span two columns */}
                <Label>Tasks Completed Today</Label>
                <Input value={profile.tasks_completed_today} readOnly />
              </div>
            </div>
            <div className="flex justify-end mt-4 space-x-2">
              <Button 
                type="button" 
                onClick={() => rechargeEnergy()} 
                disabled={profile.energy >= MAX_ENERGY}
              >
                Recharge Energy
              </Button>
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

            <Separator className="my-4" />
            {/* App Settings */}
            <h3 className="text-lg font-semibold">App Settings</h3>
            <div className="flex items-center justify-between mb-2">
              <Label>Theme</Label>
              <ThemeToggle />
            </div>
            <FormField
              control={form.control}
              name="enable_daily_challenge_notifications"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Daily Challenge Notifications</FormLabel>
                    <DialogDescription>
                      Receive notifications for your daily challenge status.
                    </DialogDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                        updateNotificationPreferences({ enable_daily_challenge_notifications: checked });
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="enable_low_energy_notifications"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Low Energy Notifications</FormLabel>
                    <DialogDescription>
                      Receive alerts when your energy is low.
                    </DialogDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                        updateNotificationPreferences({ enable_low_energy_notifications: checked });
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <Separator className="my-4" />
            {/* Account Actions Section */}
            <h3 className="text-lg font-semibold">Account Actions</h3>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">Reset Game Progress</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action will reset your XP, Level, Daily Streak, Energy, and delete ALL your tasks. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleResetGameProgress} className="bg-destructive hover:bg-destructive/90">
                    Confirm Reset
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

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

            <Button 
              variant="outline" 
              className="w-full mt-2 flex items-center gap-2" 
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProfileSettingsDialog;