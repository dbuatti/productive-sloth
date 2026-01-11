import React, { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription, } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSession, UserProfile } from '@/hooks/use-session';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, } from "@/components/ui/alert-dialog";
import ThemeToggle from '@/components/ThemeToggle';
import { LogOut, User, Gamepad2, Settings, Trash2, Zap, Clock, ExternalLink, Loader2, Keyboard, Database, TrendingUp, BookOpen, ArrowLeft, Utensils, ListOrdered, Sparkles, Anchor, Layers, Split, ListTodo, CalendarDays, LayoutDashboard, Cpu, Ban, X, ChevronUp, ChevronDown } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useTheme } from 'next-themes';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { MAX_ENERGY } from '@/lib/constants';
import { useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { adjustArrayLength, cn } from '@/lib/utils';
import EnvironmentOrderSettings from '@/components/EnvironmentOrderSettings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MealIdeasTab from '@/components/MealIdeasTab';
import EnvironmentManager from '@/components/EnvironmentManager';
import DatePicker from '@/components/DatePicker';
import { format, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

const profileSchema = z.object({
  first_name: z.string().min(1, "First name is required.").max(50, "First name cannot exceed 50 characters.").nullable(),
  last_name: z.string().min(1, "Last name is required.").max(50, "Last name cannot exceed 50 characters.").nullable(),
  avatar_url: z.string().url("Must be a valid URL.").nullable().or(z.literal('')),
  default_auto_schedule_start_time: z.preprocess(
    (val) => (val === "" ? null : val),
    z.string().regex(timeRegex, "Invalid time format (HH:MM)").nullable()
  ),
  default_auto_schedule_end_time: z.preprocess(
    (val) => (val === "" ? null : val),
    z.string().regex(timeRegex, "Invalid time format (HH:MM)").nullable()
  ),
  breakfast_time: z.preprocess(
    (val) => (val === "" ? null : val),
    z.string().regex(timeRegex, "Invalid time format (HH:MM)").nullable()
  ),
  lunch_time: z.preprocess(
    (val) => (val === "" ? null : val),
    z.string().regex(timeRegex, "Invalid time format (HH:MM)").nullable()
  ),
  dinner_time: z.preprocess(
    (val) => (val === "" ? null : val),
    z.string().regex(timeRegex, "Invalid time format (HH:MM)").nullable()
  ),
  breakfast_duration_minutes: z.preprocess(
    (val) => (val === "" ? null : val),
    z.coerce.number().min(5, "Min 5 min").max(120, "Max 120 min").nullable()
  ),
  lunch_duration_minutes: z.preprocess(
    (val) => (val === "" ? null : val),
    z.coerce.number().min(5, "Min 5 min").max(120, "Max 120 min").nullable()
  ),
  dinner_duration_minutes: z.preprocess(
    (val) => (val === "" ? null : val),
    z.coerce.number().min(5, "Min 5 min").max(120, "Max 120 min").nullable()
  ),
  reflection_count: z.coerce.number().min(1).max(5),
  enable_environment_chunking: z.boolean(),
  enable_macro_spread: z.boolean(),
  week_starts_on: z.coerce.number().min(0).max(6),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const SettingsPage: React.FC = () => {
  const { user, profile, isLoading: isSessionLoading, refreshProfile, updateProfile, updateBlockedDays } = useSession();
  const navigate = useNavigate();
  
  const [dailyChallengeNotifications, setDailyChallengeNotifications] = useState(profile?.enable_daily_challenge_notifications ?? true);
  const [lowEnergyNotifications, setLowEnergyNotifications] = useState(profile?.enable_low_energy_notifications ?? true);
  const [enableDeleteHotkeys, setEnableDeleteHotkeys] = useState(profile?.enable_delete_hotkeys ?? true);
  const [enableAetherSinkBackup, setEnableAetherSinkBackup] = useState(profile?.enable_aethersink_backup ?? true);
  const [isDashboardCollapsed, setIsDashboardCollapsed] = useState(profile?.is_dashboard_collapsed ?? false);
  const [isActionCenterCollapsed, setIsActionCenterCollapsed] = useState(profile?.is_action_center_collapsed ?? false);
  const [reflectionTimes, setReflectionTimes] = useState<string[]>([]);
  const [reflectionDurations, setReflectionDurations] = useState<number[]>([]);
  const [selectedBlockedDate, setSelectedBlockedDate] = useState<Date | undefined>(undefined);

  // Section Collapsibility State with Local Storage Persistence
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('aetherflow_settings_collapsed');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error("Failed to parse settings collapse state", e);
        }
      }
    }
    return {
      profile: true,
      anchors: true,
      logic: true,
      environments: true,
      preferences: true,
      danger: false
    };
  });

  // Save collapse state whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('aetherflow_settings_collapsed', JSON.stringify(openSections));
    }
  }, [openSections]);

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

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
      week_starts_on: 0,
    },
    mode: 'onChange',
  });

  const initializedProfileRef = useRef<UserProfile | null>(null);

  useEffect(() => {
    if (profile && (!initializedProfileRef.current || initializedProfileRef.current.updated_at !== profile.updated_at)) {
      form.reset({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        avatar_url: profile.avatar_url || '',
        default_auto_schedule_start_time: profile.default_auto_schedule_start_time || '',
        default_auto_schedule_end_time: profile.default_auto_schedule_end_time || '',
        breakfast_time: profile.breakfast_time || '',
        lunch_time: profile.lunch_time || '',
        dinner_time: profile.dinner_time || '',
        breakfast_duration_minutes: profile.breakfast_duration_minutes || undefined,
        lunch_duration_minutes: profile.lunch_duration_minutes || undefined,
        dinner_duration_minutes: profile.dinner_duration_minutes || undefined,
        reflection_count: profile.reflection_count || 1,
        enable_environment_chunking: profile.enable_environment_chunking ?? true,
        enable_macro_spread: profile.enable_macro_spread ?? false,
        week_starts_on: profile.week_starts_on ?? 0,
      });
      setDailyChallengeNotifications(profile.enable_daily_challenge_notifications);
      setLowEnergyNotifications(profile.enable_low_energy_notifications);
      setEnableDeleteHotkeys(profile.enable_delete_hotkeys);
      setEnableAetherSinkBackup(profile.enable_aethersink_backup);
      setIsDashboardCollapsed(profile.is_dashboard_collapsed);
      setIsActionCenterCollapsed(profile.is_action_center_collapsed);
      setReflectionTimes(profile.reflection_times || ['12:00']);
      setReflectionDurations(profile.reflection_durations || [15]);

      initializedProfileRef.current = profile;
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
        week_starts_on: values.week_starts_on,
      });
      showSuccess("Profile updated!");
    } catch (error: any) {
      showError(`Update failed: ${error.message}`);
    }
  };

  const handleToggle = async (key: keyof UserProfile, value: boolean) => {
    try {
      await updateProfile({ [key]: value });
      if (key === 'enable_daily_challenge_notifications') setDailyChallengeNotifications(value);
      if (key === 'enable_low_energy_notifications') setLowEnergyNotifications(value);
      if (key === 'enable_delete_hotkeys') setEnableDeleteHotkeys(value);
      if (key === 'enable_aethersink_backup') setEnableAetherSinkBackup(value);
      if (key === 'is_dashboard_collapsed') setIsDashboardCollapsed(value);
      if (key === 'is_action_center_collapsed') setIsActionCenterCollapsed(value);
    } catch (error) {
      showError("Failed to save preference.");
    }
  };

  const handleResetGameProgress = async () => {
    if (!user) return;
    try {
      await supabase.from('profiles').update({
        xp: 0,
        level: 1,
        daily_streak: 0,
        energy: MAX_ENERGY
      }).eq('id', user.id);
      await refreshProfile();
      showSuccess("Progress reset!");
      window.location.reload();
    } catch (error: any) {
      showError(`Reset failed: ${error.message}`);
    }
  };

  const handleToggleBlockedDay = async () => {
    if (!selectedBlockedDate) {
      showError("Please select a date to block/unblock.");
      return;
    }
    const dateString = format(selectedBlockedDate, 'yyyy-MM-dd');
    const isCurrentlyBlocked = profile?.blocked_days?.includes(dateString);
    await updateBlockedDays(dateString, !isCurrentlyBlocked);
    setSelectedBlockedDate(undefined);
  };

  const isSubmitting = form.formState.isSubmitting;
  const isValid = form.formState.isValid;
  const reflectionCount = form.watch('reflection_count');

  if (isSessionLoading) return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user || !profile) return null;

  return (
    <div className="space-y-8 animate-slide-in-up pb-20">
      <div className="flex items-center justify-between border-b pb-4">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings className="h-7 w-7 text-primary" />
          Settings
        </h1>
        <Button variant="outline" onClick={() => navigate('/scheduler')} className="flex items-center gap-2 h-10 text-base" aria-label="Back to Scheduler">
          <ArrowLeft className="h-5 w-5" />
          Back
        </Button>
      </div>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          
          <Collapsible open={openSections.profile} onOpenChange={() => toggleSection('profile')}>
            <Card className="rounded-xl shadow-sm border-white/5">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-secondary/20 transition-colors p-4">
                  <CardTitle className="flex items-center justify-between text-lg">
                    <div className="flex items-center gap-2">
                      <User className="h-5 w-5 text-primary" />
                      Profile
                    </div>
                    {openSections.profile ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="p-4 pt-0 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="first_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ''} />
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
                            <Input {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={isSubmitting || !isValid}>Save Changes</Button>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
          
          <Collapsible open={openSections.anchors} onOpenChange={() => toggleSection('anchors')}>
            <Card className="rounded-xl shadow-sm border-primary/20 bg-primary/[0.01]">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-primary/[0.03] transition-colors p-4">
                  <CardTitle className="flex items-center justify-between text-lg">
                    <div className="flex items-center gap-2">
                      <Anchor className="h-5 w-5 text-primary" />
                      Temporal Anchors
                    </div>
                    {openSections.anchors ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="p-4 pt-0">
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
                          <Card key={label} className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-background/50 border-white/5">
                            <FormField
                              control={form.control}
                              name={timeKey}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-50">{label} Window Start</FormLabel>
                                  <FormControl>
                                    <Input type="time" {...field} value={field.value || ''} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={durKey}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-50">Sync Duration (Min)</FormLabel>
                                  <FormControl>
                                    <Input type="number" {...field} value={field.value ?? ''} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </Card>
                        ))}
                      </div>
                      <div className="flex justify-end">
                        <Button type="submit">Update Times</Button>
                      </div>
                    </TabsContent>
                    <TabsContent value="ideas" className="animate-pop-in">
                      <MealIdeasTab />
                    </TabsContent>
                    <TabsContent value="reflections" className="space-y-6">
                      <FormField
                        control={form.control}
                        name="reflection_count"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between p-4 rounded-lg border bg-background/50 border-white/5">
                            <FormLabel>Frequency</FormLabel>
                            <FormControl>
                              <Select 
                                onValueChange={(val) => { field.onChange(val); }} 
                                value={field.value.toString()}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {[1,2,3,4,5].map(n => (
                                    <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      {Array.from({ length: reflectionCount }).map((_, index) => (
                        <Card key={index} className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-background/50 border-white/5">
                          <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-50">Reflection {index + 1} Time</FormLabel>
                            <Input 
                              type="time" 
                              value={reflectionTimes[index] || ''} 
                              onChange={(e) => handleReflectionTimeChange(index, e.target.value)} 
                            />
                          </FormItem>
                          <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-50">Duration (Min)</FormLabel>
                            <Input 
                              type="number" 
                              value={reflectionDurations[index] || ''} 
                              onChange={(e) => handleReflectionDurationChange(index, parseInt(e.target.value, 10))} 
                              min="5" 
                              max="60" 
                            />
                          </FormItem>
                        </Card>
                      ))}
                      <div className="flex justify-end">
                        <Button type="submit">Update Reflections</Button>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
          
          <Collapsible open={openSections.logic} onOpenChange={() => toggleSection('logic')}>
            <Card className="rounded-xl shadow-sm border-primary/20 bg-primary/[0.01]">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-primary/[0.03] transition-colors p-4">
                  <CardTitle className="flex items-center justify-between text-lg">
                    <div className="flex items-center gap-2">
                      <ListOrdered className="h-5 w-5 text-primary" />
                      Auto-Balance Logic
                    </div>
                    {openSections.logic ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="p-4 pt-0 space-y-6">
                  <EnvironmentOrderSettings />
                  <div className="pt-4 border-t border-white/5 space-y-4">
                    <FormField
                      control={form.control}
                      name="enable_environment_chunking"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm bg-background/50 border-white/5">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <Layers className="h-4 w-4 text-primary" />
                              <FormLabel className="text-base font-semibold">Environment Chunking</FormLabel>
                            </div>
                            <FormDescription className="text-xs">
                              Group tasks from the same zone together (AA, BB).
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch 
                              checked={field.value} 
                              onCheckedChange={(checked) => {
                                field.onChange(checked);
                                handleToggle('enable_environment_chunking', checked);
                              }} 
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="enable_macro_spread"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm bg-background/50 border-white/5">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <Split className="h-4 w-4 text-primary" />
                              <FormLabel className="text-base font-semibold">Macro-Spread Distribution</FormLabel>
                            </div>
                            <FormDescription className="text-xs">
                              Split chunks into morning and afternoon sessions.
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch 
                              checked={field.value} 
                              onCheckedChange={(checked) => {
                                field.onChange(checked);
                                handleToggle('enable_macro_spread', checked);
                              }} 
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={isSubmitting || !isValid}>Save Changes</Button>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
          
          <Collapsible open={openSections.environments} onOpenChange={() => toggleSection('environments')}>
            <Card className="rounded-xl shadow-sm border-primary/20 bg-primary/[0.01]">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-primary/[0.03] transition-colors p-4">
                  <CardTitle className="flex items-center justify-between text-lg">
                    <div className="flex items-center gap-2">
                      <ListTodo className="h-5 w-5 text-primary" />
                      Spatial Budgeting Dashboard
                    </div>
                    {openSections.environments ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="p-0">
                  <EnvironmentManager />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
          
          <Collapsible open={openSections.preferences} onOpenChange={() => toggleSection('preferences')}>
            <Card className="rounded-xl shadow-sm border-primary/20 bg-primary/[0.01]">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-primary/[0.03] transition-colors p-4">
                  <CardTitle className="flex items-center justify-between text-lg">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-5 w-5 text-primary" />
                      Calendar & View Preferences
                    </div>
                    {openSections.preferences ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="p-4 pt-0 space-y-4">
                  <FormField
                    control={form.control}
                    name="week_starts_on"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm bg-background/50 border-white/5">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base font-semibold">Week Starts On</FormLabel>
                          <FormDescription className="text-xs">
                            Choose which day your weekly schedule view begins.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Select 
                            onValueChange={(value) => field.onChange(parseInt(value, 10))} 
                            value={field.value.toString()}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue placeholder="Select day" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">Sunday</SelectItem>
                              <SelectItem value="1">Monday</SelectItem>
                              <SelectItem value="2">Tuesday</SelectItem>
                              <SelectItem value="3">Wednesday</SelectItem>
                              <SelectItem value="4">Thursday</SelectItem>
                              <SelectItem value="5">Friday</SelectItem>
                              <SelectItem value="6">Saturday</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm bg-background/50 border-white/5">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <LayoutDashboard className="h-4 w-4 text-primary" />
                        <FormLabel className="text-base font-semibold">Dashboard Collapsed</FormLabel>
                      </div>
                    </div>
                    <FormControl>
                      <Switch 
                        checked={isDashboardCollapsed} 
                        onCheckedChange={(checked) => handleToggle('is_dashboard_collapsed', checked)} 
                      />
                    </FormControl>
                  </FormItem>
                  
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm bg-background/50 border-white/5">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Cpu className="h-4 w-4 text-primary" />
                        <FormLabel className="text-base font-semibold">Action Center Collapsed</FormLabel>
                      </div>
                    </div>
                    <FormControl>
                      <Switch 
                        checked={isActionCenterCollapsed} 
                        onCheckedChange={(checked) => handleToggle('is_action_center_collapsed', checked)} 
                      />
                    </FormControl>
                  </FormItem>

                  <Card className="p-4 rounded-xl shadow-sm bg-background/50 border-destructive/20">
                    <CardHeader className="px-0 pb-4 p-0">
                      <CardTitle className="flex items-center gap-2 text-lg text-destructive">
                        <Ban className="h-5 w-5" />
                        Blocked Days
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 space-y-4">
                      <div className="flex items-center gap-2">
                        <DatePicker 
                          date={selectedBlockedDate} 
                          setDate={setSelectedBlockedDate} 
                          placeholder="Select a date"
                        />
                        <Button 
                          onClick={handleToggleBlockedDay} 
                          disabled={!selectedBlockedDate}
                        >
                          {selectedBlockedDate && profile?.blocked_days?.includes(format(selectedBlockedDate, 'yyyy-MM-dd')) ? 'Unblock' : 'Block'}
                        </Button>
                      </div>
                      {profile?.blocked_days && profile.blocked_days.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {profile.blocked_days.sort().map(day => (
                            <Badge key={day} variant="destructive" className="gap-1">
                              {format(parseISO(day), 'MMM d, yyyy')}
                              <X className="h-3 w-3 cursor-pointer" onClick={() => updateBlockedDays(day, false)} />
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  
                  <div className="flex justify-end">
                    <Button type="submit" disabled={isSubmitting || !isValid}>Save Preferences</Button>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
          
          <Collapsible open={openSections.danger} onOpenChange={() => toggleSection('danger')}>
            <Card className="rounded-xl shadow-sm border-destructive/50 bg-destructive/[0.01]">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-destructive/[0.03] transition-colors p-4">
                  <CardTitle className="flex items-center justify-between text-lg text-destructive">
                    <div className="flex items-center gap-2">
                      <Trash2 className="h-5 w-5" />
                      Danger Zone
                    </div>
                    {openSections.danger ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="p-4 pt-0">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="w-full font-black uppercase">
                        Wipe History
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete your progress (XP, level, energy) and all tasks.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleResetGameProgress} className="bg-destructive hover:bg-destructive/90">
                          Continue
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </form>
      </Form>
    </div>
  );
};

export default SettingsPage;