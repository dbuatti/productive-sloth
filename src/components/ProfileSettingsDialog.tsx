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
import ThemeToggle from './ThemeToggle';
import { LogOut, User, Gamepad2, Settings, Trash2, RefreshCcw, Zap, Flame, Bell } from 'lucide-react'; // Import more icons
import { Switch } from '@/components/ui/switch';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'; // Import Card components

interface ProfileSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const profileSchema = z.object({
  first_name: z.string().min(1, "First name is required.").max(50, "First name cannot exceed 50 characters.").nullable(),
  last_name: z.string().min(1, "Last name is required.").max(50, "Last name cannot exceed 50 characters.").nullable(),
  avatar_url: z.string().url("Must be a valid URL.").nullable().or(z.literal('')),
  enable_daily_challenge_notifications: z.boolean(),
  enable_low_energy_notifications: z.boolean(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const MAX_ENERGY = 100;

const ProfileSettingsDialog: React.FC<ProfileSettingsDialogProps> = ({ open, onOpenChange }) => {
  const { user, profile, refreshProfile, rechargeEnergy, resetDailyStreak, updateNotificationPreferences } = useSession();
  const { setTheme } = useTheme();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      avatar_url: '',
      enable_daily_challenge_notifications: true,
      enable_low_energy_notifications: true,
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
          enable_daily_challenge_notifications: true,
          enable_low_energy_notifications: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        throw error;
      }

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
      window.location.reload();
    } catch (error: any) {
      showError(`Failed to reset game progress: ${error.message}`);
      console.error("Reset game progress error:", error);
    }
  };

  const handleResetAppSettings = async () => {
    if (!user) {
      showError("You must be logged in to reset app settings.");
      return;
    }

    try {
      await updateNotificationPreferences({
        enable_daily_challenge_notifications: true,
        enable_low_energy_notifications: true,
      });

      setTheme("system");
      
      form.setValue('enable_daily_challenge_notifications', true);
      form.setValue('enable_low_energy_notifications', true);

      showSuccess("App settings reset to default!");
      await refreshProfile();
    } catch (error: any) {
      showError(`Failed to reset app settings: ${error.message}`);
      console.error("Reset app settings error:", error);
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
    onOpenChange(false);
  };

  const isSubmitting = form.formState.isSubmitting;
  const isValid = form.formState.isValid;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Profile Settings</DialogTitle>
          <DialogDescription>
            Manage your personal information, game progress, and app preferences.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Personal Information Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <User className="h-5 w-5 text-primary" /> Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
              </CardContent>
            </Card>
          </form>
        </Form>

        {profile && (
          <div className="space-y-6 mt-6"> {/* Added mt-6 for spacing after the form */}
            {/* Game Stats Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Gamepad2 className="h-5 w-5 text-logo-yellow" /> Game Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Tasks Completed Today</Label>
                    <Input value={profile.tasks_completed_today} readOnly />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row justify-end gap-2 mt-4">
                  <Button
                    type="button"
                    onClick={() => rechargeEnergy()}
                    disabled={profile.energy >= MAX_ENERGY}
                    className="flex items-center gap-2"
                  >
                    <Zap className="h-4 w-4" /> Recharge Energy
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" type="button" className="flex items-center gap-2">
                        <Flame className="h-4 w-4" /> Reset Daily Streak
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
              </CardContent>
            </Card>

            {/* App Settings Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Settings className="h-5 w-5 text-primary" /> App Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
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
                <div className="flex justify-end mt-4">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" type="button" className="flex items-center gap-2">
                        <RefreshCcw className="h-4 w-4" /> Reset App Settings
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action will reset your theme and notification preferences to their default settings. Your game progress will NOT be affected.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleResetAppSettings}>
                          Confirm Reset
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>

            {/* Account Actions Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Trash2 className="h-5 w-5 text-destructive" /> Account Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full flex items-center gap-2">
                      <Gamepad2 className="h-4 w-4" /> Reset Game Progress
                    </Button>
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
                    <Button variant="destructive" className="w-full flex items-center gap-2">
                      <Trash2 className="h-4 w-4" /> Delete Account
                    </Button>
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
                  className="w-full flex items-center gap-2"
                  onClick={handleSignOut}
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProfileSettingsDialog;