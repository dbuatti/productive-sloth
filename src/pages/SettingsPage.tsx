import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
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
  AlertDialogTrigger, // ADDED: AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import ThemeToggle from '@/components/ThemeToggle';
import { LogOut, User, Gamepad2, Settings, Trash2, RefreshCcw, Zap, Flame, Clock, Code, ExternalLink, Loader2, Keyboard, Database } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useTheme } from 'next-themes';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { MAX_ENERGY } from '@/lib/constants';
import { format, parseISO } from 'date-fns'; // Import date-fns functions

const profileSchema = z.object({
  first_name: z.string().min(1, "First name is required.").max(50, "First name cannot exceed 50 characters.").nullable(),
  last_name: z.string().min(1, "Last name is required.").max(50, "Last name cannot exceed 50 characters.").nullable(),
  avatar_url: z.string().url("Must be a valid URL.").nullable().or(z.literal('')),
  default_auto_schedule_start_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)").nullable(),
  default_auto_schedule_end_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)").nullable(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const SettingsPage: React.FC = () => {
  const { user, profile, isLoading: isSessionLoading, refreshProfile, rechargeEnergy, resetDailyStreak, updateNotificationPreferences, updateProfile, updateSettings } = useSession();
  const { setTheme } = useTheme();

  const [dailyChallengeNotifications, setDailyChallengeNotifications] = useState(profile?.enable_daily_challenge_notifications ?? true);
  const [lowEnergyNotifications, setLowEnergyNotifications] = useState(profile?.enable_low_energy_notifications ?? true);
  const [enableDeleteHotkeys, setEnableDeleteHotkeys] = useState(profile?.enable_delete_hotkeys ?? true);
  const [enableAetherSinkBackup, setEnableAetherSinkBackup] = useState(profile?.enable_aethersink_backup ?? true);


  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      avatar_url: '',
      default_auto_schedule_start_time: '09:00',
      default_auto_schedule_end_time: '17:00',
    },
    mode: 'onChange',
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        avatar_url: profile.avatar_url || '',
        default_auto_schedule_start_time: profile.default_auto_schedule_start_time || '09:00',
        default_auto_schedule_end_time: profile.default_auto_schedule_end_time || '17:00',
      });
      setDailyChallengeNotifications(profile.enable_daily_challenge_notifications);
      setLowEnergyNotifications(profile.enable_low_energy_notifications);
      setEnableDeleteHotkeys(profile.enable_delete_hotkeys);
      setEnableAetherSinkBackup(profile.enable_aethersink_backup);
    }
  }, [profile, form]);

  const onSubmit = async (values: ProfileFormValues) => {
    if (!user) {
      showError("You must be logged in to update your profile.");
      return;
    }

    try {
      await updateProfile({
        first_name: values.first_name,
        last_name: values.last_name,
        avatar_url: values.avatar_url === '' ? null : values.avatar_url,
        default_auto_schedule_start_time: values.default_auto_schedule_start_time,
        default_auto_schedule_end_time: values.default_auto_schedule_end_time,
      });
      showSuccess("Profile updated successfully!");
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
          enable_delete_hotkeys: true,
          enable_aethersink_backup: true,
          default_auto_schedule_start_time: '09:00',
          default_auto_schedule_end_time: '17:00',
          last_energy_regen_at: new Date().toISOString(), // NEW: Reset last_energy_regen_at
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
      await updateSettings({
        enable_daily_challenge_notifications: true,
        enable_low_energy_notifications: true,
        enable_delete_hotkeys: true,
        enable_aethersink_backup: true,
        default_auto_schedule_start_time: '09:00',
        default_auto_schedule_end_time: '17:00',
      });

      setTheme("system");
      
      setDailyChallengeNotifications(true);
      setLowEnergyNotifications(true);
      setEnableDeleteHotkeys(true);
      setEnableAetherSinkBackup(true);

      showSuccess("App settings reset to default!");
    } catch (error: any) {
      showError(`Failed to reset app settings: ${error.message}`);
      console.error("Reset app settings error:", error);
    }
  };

  const handleNotificationChange = async (key: 'enable_daily_challenge_notifications' | 'enable_low_energy_notifications', checked: boolean) => {
    if (key === 'enable_daily_challenge_notifications') {
      setDailyChallengeNotifications(checked);
      await updateNotificationPreferences({ enable_daily_challenge_notifications: checked });
    } else {
      setLowEnergyNotifications(checked);
      await updateNotificationPreferences({ enable_low_energy_notifications: checked });
    }
  };

  const handleDeleteHotkeysChange = async (checked: boolean) => {
    setEnableDeleteHotkeys(checked);
    await updateSettings({ enable_delete_hotkeys: checked });
  };

  const handleAetherSinkBackupChange = async (checked: boolean) => {
    setEnableAetherSinkBackup(checked);
    await updateSettings({ enable_aethersink_backup: checked });
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
  };

  const isSubmitting = form.formState.isSubmitting;
  const isValid = form.formState.isValid;

  if (isSessionLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !profile) {
    return null;
  }

  const lastRegenAt = profile.last_energy_regen_at 
    ? format(parseISO(profile.last_energy_regen_at), 'MMM d, yyyy HH:mm:ss') 
    : 'N/A';

  return (
    <div className="mx-auto max-w-5xl space-y-8 animate-slide-in-up">
      <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
        <Settings className="h-7 w-7 text-primary" /> Settings
      </h1>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Personal Information Card */}
          <Card className="animate-hover-lift">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5 text-primary" /> Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      <FormLabel>Last Name</FormLabel> {/* Corrected: Changed <Label> to <FormLabel> and added closing tag */}
                      <FormControl>
                        <Input placeholder="Doe" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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
              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={isSubmitting || !isValid}>
                  Save Profile Changes
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Game Stats & Actions Card */}
          <Card className="animate-hover-lift">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Gamepad2 className="h-5 w-5 text-logo-yellow" /> Game & Energy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Level</Label>
                  <Input value={profile.level} readOnly className="font-mono" />
                </div>
                <div className="space-y-2">
                  <Label>XP</Label>
                  <Input value={profile.xp} readOnly className="font-mono" />
                </div>
                <div className="space-y-2">
                  <Label>Energy</Label>
                  <Input value={`${profile.energy}/${MAX_ENERGY}`} readOnly className="font-mono" />
                </div>
                <div className="space-y-2">
                  <Label>Daily Streak</Label>
                  <Input value={profile.daily_streak} readOnly className="font-mono" />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-2 mt-4">
                <Button
                  type="button"
                  onClick={() => rechargeEnergy()}
                  disabled={profile.energy >= MAX_ENERGY}
                  className="flex items-center gap-2 bg-primary hover:bg-primary/90"
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

          {/* App Preferences Card */}
          <Card className="animate-hover-lift">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Settings className="h-5 w-5 text-primary" /> Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                <Label>Theme</Label>
                <ThemeToggle />
              </div>
              
              {/* Daily Challenge Notifications (Manual State/Update) */}
              <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                  <Label>Daily Challenge Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications for your daily challenge status.
                  </p>
                </div>
                <Switch
                  checked={dailyChallengeNotifications}
                  onCheckedChange={(checked) => handleNotificationChange('enable_daily_challenge_notifications', checked)}
                />
              </div>

              {/* Low Energy Notifications (Manual State/Update) */}
              <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                  <Label>Low Energy Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive alerts when your energy is low.
                  </p>
                </div>
                <Switch
                  checked={lowEnergyNotifications}
                  onCheckedChange={(checked) => handleNotificationChange('enable_low_energy_notifications', checked)}
                />
              </div>

              {/* Enable Delete Hotkeys */}
              <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <Keyboard className="h-4 w-4" /> Enable Delete Hotkeys
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Allow 'D' or 'Enter' to confirm deletion in modals.
                  </p>
                </div>
                <Switch
                  checked={enableDeleteHotkeys}
                  onCheckedChange={handleDeleteHotkeysChange}
                />
              </div>

              {/* NEW: Enable Aether Sink Backup */}
              <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <Database className="h-4 w-4" /> Enable Daily Aether Sink Backup
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically back up your Aether Sink to Supabase daily.
                  </p>
                </div>
                <Switch
                  checked={enableAetherSinkBackup}
                  onCheckedChange={handleAetherSinkBackupChange}
                />
              </div>

              {/* Default Auto-Schedule Times - MOVED INSIDE FORM */}
              <div className="rounded-lg border p-3 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                  <Clock className="h-4 w-4" /> Auto-Schedule Window
                </div>
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
                        <Input type="time" className="w-auto" {...field} value={field.value || ''} />
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
                    <Input type="time" className="w-auto" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={isSubmitting || !isValid}>
                Save Preferences
              </Button>
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" type="button" className="flex items-center gap-2">
                  <RefreshCcw className="h-4 w-4" /> Reset Preferences
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action will reset your theme and notification preferences to their default settings.
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

      {/* Developer Tools Card */}
      <Card className="animate-hover-lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Code className="h-5 w-5 text-secondary-foreground" /> Developer Tools
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
            <Label>Gemini App Link</Label>
            <a 
              href="https://gemini.google.com/app/208092550e910314" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center gap-1 text-primary hover:underline"
            >
              Open Gemini <ExternalLink className="h-4 w-4" />
            </a>
          </div>
          {/* NEW: Last Energy Regen At */}
          <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
            <Label className="flex items-center gap-2">
              <Zap className="h-4 w-4" /> Last Energy Regen
            </Label>
            <span className="font-mono text-sm text-muted-foreground">{lastRegenAt}</span>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone Card */}
      <Card className="border-destructive/50 animate-hover-lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-destructive">
            <Trash2 className="h-5 w-5" /> Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full flex items-center gap-2">
                <Gamepad2 className="h-4 w-4" /> Reset All Game Progress & Tasks
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
    </form>
  </Form>
</div>