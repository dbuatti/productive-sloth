"use client";

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useSession } from '@/hooks/use-session';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Cpu, Loader2, Clock, Layers, Split } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';

const logicSchema = z.object({
  default_auto_schedule_start_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)").nullable(),
  default_auto_schedule_end_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)").nullable(),
  enable_environment_chunking: z.boolean().default(true),
  enable_macro_spread: z.boolean().default(false),
});

type LogicFormValues = z.infer<typeof logicSchema>;

const LogicSettings: React.FC = () => {
  const { profile, updateProfile } = useSession();

  const form = useForm<LogicFormValues>({
    resolver: zodResolver(logicSchema),
    defaultValues: {
      default_auto_schedule_start_time: profile?.default_auto_schedule_start_time || '09:00',
      default_auto_schedule_end_time: profile?.default_auto_schedule_end_time || '17:00',
      enable_environment_chunking: profile?.enable_environment_chunking ?? true,
      enable_macro_spread: profile?.enable_macro_spread ?? false,
    },
  });

  const onSubmit = async (values: LogicFormValues) => {
    try {
      await updateProfile(values);
      showSuccess("Engine Logic Updated.");
    } catch (error: any) {
      showError(`Update failed: ${error.message}`);
    }
  };

  const isSubmitting = form.formState.isSubmitting;

  return (
    <Card className="rounded-xl shadow-sm border-white/5 bg-card/40">
      <CardHeader className="p-4">
        <CardTitle className="flex items-center gap-2 text-lg font-black uppercase tracking-tighter">
          <Cpu className="h-5 w-5 text-primary" /> Aether Engine Logic
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="default_auto_schedule_start_time" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-50 flex items-center gap-1"><Clock className="h-3 w-3" /> Workday Start</FormLabel>
                  <FormControl><Input type="time" {...field} value={field.value || ''} className="rounded-xl bg-background/50" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="default_auto_schedule_end_time" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-50 flex items-center gap-1"><Clock className="h-3 w-3" /> Workday End</FormLabel>
                  <FormControl><Input type="time" {...field} value={field.value || ''} className="rounded-xl bg-background/50" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="space-y-4">
              <FormField control={form.control} name="enable_environment_chunking" render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-xl border border-white/5 p-4 bg-background/20">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-bold uppercase tracking-tight flex items-center gap-2"><Layers className="h-4 w-4 text-primary" /> Zone Chunking</FormLabel>
                    <FormDescription className="text-[10px] font-medium text-muted-foreground/60">Group tasks by environment to minimize context switching.</FormDescription>
                  </div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />

              <FormField control={form.control} name="enable_macro_spread" render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-xl border border-white/5 p-4 bg-background/20">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-bold uppercase tracking-tight flex items-center gap-2"><Split className="h-4 w-4 text-accent" /> Macro Spread</FormLabel>
                    <FormDescription className="text-[10px] font-medium text-muted-foreground/60">Distribute zone batches across morning and afternoon sessions.</FormDescription>
                  </div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />
            </div>

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

export default LogicSettings;