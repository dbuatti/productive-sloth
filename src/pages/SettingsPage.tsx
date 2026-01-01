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
import { useSession, UserProfile } from '@/hooks/use-session';
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import ThemeToggle from '@/components/ThemeToggle';
import { 
  LogOut, User, Gamepad2, Settings, Trash2, Zap, Clock, 
  ExternalLink, Loader2, Keyboard, Database, TrendingUp, 
  BookOpen, ArrowLeft, Utensils, ListOrdered, Sparkles, Anchor,
  Layers, Split, ListTodo
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useTheme } from 'next-themes';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { MAX_ENERGY } from '@/lib/constants';
import { useNavigate } from 'react-router-dom'; 
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { adjustArrayLength } from '@/lib/utils';
import EnvironmentOrderSettings from '@/components/EnvironmentOrderSettings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MealIdeasTab from '@/components/MealIdeasTab'; // NEW IMPORT

const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

const profileSchema = z.object({
  first_name: z.string().min(1, "First name is required.").max(50, "First name cannot exceed 50 characters.").nullable(),
  last_name: z.string().min(1, "Last name is required.").max(50, "Last name cannot exceed 50 characters.").nullable(),
  avatar_url: z.string().url("Must be a valid URL.").nullable().or(z.literal('')),
  default_auto_schedule_start_time: z.string().regex(timeRegex, "Invalid time format (HH:MM)").nullable(),
  default_auto_schedule_end_time: z.string().regex(timeRegex, "Invalid time format (HH:MM)").nullable(),
  breakfast_time: z.string().regex(timeRegex, "Invalid time format (HH:MM)").nullable(),
  lunch_time: z.string().regex(timeRegex, "Invalid time format (HH:MM)").nullable(),
  dinner_time: z.string().regex(timeRegex, "Invalid time format (HH:MM)").nullable(),
  breakfast_duration_minutes: z.coerce.number().min(5, "Min 5 min").max(120, "Max 120 min").nullable(),
  lunch_duration_minutes: z.coerce.number().min(5, "Min 5 min").max(120, "Max 120 min").nullable(),
  dinner_duration_minutes: z.coerce.number().min(5, "Min 5 min").max(120, "Max 120 min").nullable(),
  reflection_count: z.coerce.number().min(1).max(5),
  enable_environment_chunking: z.boolean(),
  enable_macro_spread: z.boolean(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const SettingsPage: React.FC = () => {
  const { user, profile, isLoading: isSessionLoading, refreshProfile, updateNotificationPreferences, updateProfile, updateSettings } = useSession();
  const { setTheme } = useTheme();
  const navigate = useNavigate(); 

  const [dailyChallengeNotifications, setDailyChallengeNotifications] = useState(profile?.enable_daily_challenge_notifications ?? true);
  const [lowEnergyNotifications, setLowEnergyNotifications] = useState(profile?.enable_low_energy_notifications ?? true);
  const [enableDeleteHotkeys, setEnableDeleteHotkeys] = useState(profile?.enable_delete_hotkeys ?? true);
  const [enableAetherSinkBackup, setEnableAetherSinkBackup] = useState(profile?.enable_aethersink_backup ?? true);
  
  const [reflectionTimes, setReflectionTimes] = useState<string[]>([]);
  const [reflectionDurations, setReflectionDurations] = useState<number[]>([]);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      avatar_url: '',
      default_auto_schedule_start_time: '09:00',
      default_auto_schedule_end_time: '17:00',
      breakfast_time: '08:00',
      lunch_time: '12:00',
      dinner_time: '18:00',
      breakfast_duration_minutes: 30,
      lunch_duration_minutes: 45,
      dinner_duration_minutes: 60,
      reflection_count: 1,
      enable_environment_chunking: true,
      enable_macro_spread: false,
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
        breakfast_time: profile.breakfast_time || '08:00',
        lunch_time: profile.lunch_time || '12:00',
        dinner_time: profile.dinner_time || '18:00',
        breakfast_duration_minutes: profile.breakfast_duration_minutes || 30,
        lunch_duration_minutes: profile.lunch_duration_minutes || 45,
        dinner_duration_minutes: profile.dinner_duration_minutes || 60,
        reflection_count: profile.reflection_count || 1,
        enable_environment_chunking: profile.enable_environment_chunking ?? true,
        enable_macro_spread: profile.enable_macro_spread ?? false,
      });
      setDailyChallengeNotifications(profile.enable_daily_challenge_notifications);
      setLowEnergyNotifications(profile.enable_low_energy_notifications);
      setEnableDeleteHotkeys(profile.enable_delete_hotkeys);
      setEnableAetherSinkBackup(profile.enable_aethersink_backup);
      setReflectionTimes(profile.reflection_times || ['12:00']);
      setReflectionDurations(profile.reflection_durations || [15]);
    }
  }, [profile, form]);

  const handleReflectionTimeChange = (index: number, value: string) => {
    const newTimes = [...reflectionTimes];
    newTimes[index] = value;
    setReflectionTimes(newTimes);
  };

  const handleReflectionDurationChange = (index: number, value: number) => {
    const newDurations = [...reflectionDurations];
    newDurations[index] = isNaN(value) ? 15 : value;
    setReflectionDurations(newDurations);
  };

  const onSubmit = async (values: ProfileFormValues) => {
    if (!user) return showError("User required.");
    
    const finalTimes = adjustArrayLength(reflectionTimes.map(t => t || '12:00'), values.reflection_count, '12:00');
    const finalDurations = adjustArrayLength(reflectionDurations.map(d => isNaN(d) ? 15 : d), values.reflection_count, 15);

    try {
      await updateProfile({
        first_name: values.first_name,
        last_name: values.last_name,
        avatar_url: values.avatar_url === '' ? null : values.avatar_url,
        default_auto_schedule_start_time: values.default_auto_schedule_start_time,
        default_auto_schedule_end_time: values.default_auto_schedule_end_time,
        breakfast_time: values.breakfast_time,
        lunch_time: values.lunch_time,
        dinner_time: values.dinner_time,
        breakfast_duration_minutes: values.breakfast_duration_minutes,
        lunch_duration_minutes: values.lunch_duration_minutes,
        dinner_duration_minutes: values.dinner_duration_minutes,
        reflection_count: values.reflection_count,
        reflection_times: finalTimes,
        reflection_durations: finalDurations,
        enable_environment_chunking: values.enable_environment_chunking,
        enable_macro_spread: values.enable_macro_spread,
      });
      showSuccess("Profile updated!");
    } catch (error: any) {
      showError(`Update failed: ${error.message}`);
    }
  };

  const handleToggle = async (key: keyof UserProfile, value: boolean) => {
    try {
      await updateProfile({ [key]: value });
      form.setValue(key as any, value);
    } catch (error) {
        showError("Failed to save preference.");
    }
  };

  const handleResetGameProgress = async () => {
    if (!user) return;
    try {
      await supabase.from('profiles').update({ xp: 0, level: 1, daily_streak: 0, energy: MAX_ENERGY }).eq('id', user.id);
      await refreshProfile();
      showSuccess("Progress reset!");
      window.location.reload();
    } catch (error: any) {
      showError(`Reset failed: ${error.message}`);
    }
  };

  const isSubmitting = form.formState.isSubmitting;
  const isValid = form.formState.isValid;
  const reflectionCount = form.watch('reflection_count');

  if (isSessionLoading) return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user || !profile) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-8 animate-slide-in-up">
      <div className="flex items-center justify-between border-b pb-4">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings className="h-7 w-7 text-primary" /> Settings
        </h1>
        <Button variant="outline" onClick={() => navigate('/scheduler')} className="flex items-center gap-2 h-10 text-base">
          <ArrowLeft className="h-5 w-5" /> Back
        </Button>
      </div>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><User className="h-5 w-5 text-primary" /> Profile</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="first_name" render={({ field }) => (<FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="last_name" render={({ field }) => (<FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <div className="flex justify-end pt-4"><Button type="submit" disabled={isSubmitting || !isValid}>Save Changes</Button></div>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/[0.01]">
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Anchor className="h-5 w-5 text-primary" /> Temporal Anchors</CardTitle></CardHeader>
            <CardContent>
              <Tabs defaultValue="meals">
                <TabsList className="grid w-full grid-cols-3 h-12 p-1 bg-secondary rounded-lg mb-6">
                  <TabsTrigger value="meals" className="text-xs font-black uppercase tracking-widest">Times</TabsTrigger>
                  <TabsTrigger value="ideas" className="text-xs font-black uppercase tracking-widest">Ideas</TabsTrigger>
                  <TabsTrigger value="reflections" className="text-xs font-black uppercase tracking-widest">Reflections</TabsTrigger>
                </TabsList>
                
                <TabsContent value="meals" className="space-y-6">
                    <div className="grid gap-4">
                    {[
                      { label: 'Breakfast', timeKey: 'breakfast_time' as const, durKey: 'breakfast_duration_minutes' as const },
                      { label: 'Lunch', timeKey: 'lunch_time' as const, durKey: 'lunch_duration_minutes' as const },
                      { label: 'Dinner', timeKey: 'dinner_time' as const, durKey: 'dinner_duration_minutes' as const }
                    ].map(({ label, timeKey, durKey }) => (
                      <div key={label} className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg border bg-background/50">
                        <FormField control={form.control} name={timeKey} render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-50">{label} Window Start</FormLabel>
                            <FormControl><Input type="time" {...field} value={field.value || ''} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name={durKey} render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-50">Sync Duration (Min)</FormLabel>
                            <FormControl><Input type="number" {...field} value={field.value || ''} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end"><Button type="submit">Update Times</Button></div>
                </TabsContent>

                <TabsContent value="ideas" className="animate-pop-in">
                  <MealIdeasTab />
                </TabsContent>

                <TabsContent value="reflections" className="space-y-6">
                    <FormField control={form.control} name="reflection_count" render={({ field }) => (<FormItem className="flex items-center justify-between p-4 rounded-lg border bg-background/50"><FormLabel>Frequency</FormLabel><FormControl><Select onValueChange={(val) => { field.onChange(val); }} defaultValue={field.value.toString()}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent>{[1,2,3,4,5].map(n => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}</SelectContent></Select></FormControl></FormItem>)} />
                    <div className="flex justify-end"><Button type="submit">Update Reflections</Button></div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/[0.01]">
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><ListOrdered className="h-5 w-5 text-primary" /> Auto-Balance Logic</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <EnvironmentOrderSettings />
              <div className="pt-4 border-t border-white/5 space-y-4">
                <FormField control={form.control} name="enable_environment_chunking" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm bg-background/50">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2"><Layers className="h-4 w-4 text-primary" /><FormLabel className="text-base font-semibold">Environment Chunking</FormLabel></div>
                      <FormDescription className="text-xs">Group tasks from the same zone together (AA, BB).</FormDescription>
                    </div>
                    <FormControl><Switch checked={field.value} onCheckedChange={(checked) => handleToggle('enable_environment_chunking', checked)} /></FormControl>
                  </FormItem>
                )} />

                <FormField control={form.control} name="enable_macro_spread" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm bg-background/50">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2"><Split className="h-4 w-4 text-primary" /><FormLabel className="text-base font-semibold">Macro-Spread Distribution</FormLabel></div>
                      <FormDescription className="text-xs">Split chunks into morning and afternoon sessions.</FormDescription>
                    </div>
                    <FormControl><Switch checked={field.value} onCheckedChange={(checked) => handleToggle('enable_macro_spread', checked)} /></FormControl>
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive/50 bg-destructive/[0.01]">
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg text-destructive"><Trash2 className="h-5 w-5" /> Danger Zone</CardTitle></CardHeader>
            <CardContent><Button variant="destructive" className="w-full font-black uppercase" onClick={handleResetGameProgress}>Wipe History</Button></CardContent>
          </Card>
        </form>
      </Form>
    </div>
  );
};

export default SettingsPage;