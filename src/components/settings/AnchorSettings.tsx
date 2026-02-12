"use client";

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSession } from '@/hooks/use-session';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { CalendarDays, Loader2, Utensils, Sparkles, Clock } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';

const anchorSchema = z.object({
  breakfast_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)").nullable(),
  breakfast_duration_minutes: z.coerce.number().min(0).nullable(),
  lunch_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)").nullable(),
  lunch_duration_minutes: z.coerce.number().min(0).nullable(),
  dinner_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)").nullable(),
  dinner_duration_minutes: z.coerce.number().min(0).nullable(),
  reflection_count: z.coerce.number().min(0).max(5).default(0),
});

type AnchorFormValues = z.infer<typeof anchorSchema>;

const AnchorSettings: React.FC = () => {
  const { profile, updateProfile } = useSession();

  const form = useForm<AnchorFormValues>({
    resolver: zodResolver(anchorSchema),
    defaultValues: {
      breakfast_time: profile?.breakfast_time || '08:00',
      breakfast_duration_minutes: profile?.breakfast_duration_minutes || 30,
      lunch_time: profile?.lunch_time || '13:00',
      lunch_duration_minutes: profile?.lunch_duration_minutes || 45,
      dinner_time: profile?.dinner_time || '19:00',
      dinner_duration_minutes: profile?.dinner_duration_minutes || 60,
      reflection_count: profile?.reflection_count || 0,
    },
  });

  const onSubmit = async (values: AnchorFormValues) => {
    try {
      await updateProfile(values);
      showSuccess("Temporal Anchors Updated.");
    } catch (error: any) {
      showError(`Update failed: ${error.message}`);
    }
  };

  const isSubmitting = form.formState.isSubmitting;

  const AnchorRow = ({ label, timeName, durName, icon: Icon }: any) => (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end p-4 rounded-xl border border-white/5 bg-background/20">
      <div className="flex items-center gap-2 mb-1 sm:mb-0">
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-sm font-bold uppercase tracking-tight">{label}</span>
      </div>
      <FormField control={form.control} name={timeName} render={({ field }) => (
        <FormItem>
          <FormLabel className="text-[9px] font-black uppercase tracking-widest opacity-40">Target Time</FormLabel>
          <FormControl><Input type="time" {...field} value={field.value || ''} className="h-9 bg-background/50" /></FormControl>
        </FormItem>
      )} />
      <FormField control={form.control} name={durName} render={({ field }) => (
        <FormItem>
          <FormLabel className="text-[9px] font-black uppercase tracking-widest opacity-40">Duration (min)</FormLabel>
          <FormControl><Input type="number" {...field} value={field.value || ''} className="h-9 bg-background/50" /></FormControl>
        </FormItem>
      )} />
    </div>
  );

  return (
    <Card className="rounded-xl shadow-sm border-white/5 bg-card/40">
      <CardHeader className="p-4">
        <CardTitle className="flex items-center gap-2 text-lg font-black uppercase tracking-tighter">
          <CalendarDays className="h-5 w-5 text-primary" /> Temporal Anchors
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <AnchorRow label="Breakfast" timeName="breakfast_time" durName="breakfast_duration_minutes" icon={Utensils} />
            <AnchorRow label="Lunch" timeName="lunch_time" durName="lunch_duration_minutes" icon={Utensils} />
            <AnchorRow label="Dinner" timeName="dinner_time" durName="dinner_duration_minutes" icon={Utensils} />
            
            <FormField control={form.control} name="reflection_count" render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-xl border border-white/5 p-4 bg-background/20">
                <div className="space-y-0.5">
                  <FormLabel className="text-sm font-bold uppercase tracking-tight flex items-center gap-2"><Sparkles className="h-4 w-4 text-logo-yellow" /> Reflection Points</FormLabel>
                  <FormDescription className="text-[10px] font-medium text-muted-foreground/60">Number of daily check-ins to schedule.</FormDescription>
                </div>
                <FormControl><Input type="number" {...field} className="w-20 h-9 bg-background/50 text-center font-bold" /></FormControl>
              </FormItem>
            )} />

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={isSubmitting} className="rounded-xl font-black uppercase tracking-widest text-[10px] h-10 px-6">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Changes
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default AnchorSettings;