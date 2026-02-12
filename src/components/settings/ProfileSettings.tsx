"use client";

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSession } from '@/hooks/use-session';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { User, Loader2 } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';

const profileSchema = z.object({
  first_name: z.string().min(1, "First name is required.").max(50).nullable(),
  last_name: z.string().min(1, "Last name is required.").max(50).nullable(),
  avatar_url: z.string().url("Must be a valid URL.").nullable().or(z.literal('')),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const ProfileSettings: React.FC = () => {
  const { profile, updateProfile } = useSession();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: profile?.first_name || '',
      last_name: profile?.last_name || '',
      avatar_url: profile?.avatar_url || '',
    },
  });

  const onSubmit = async (values: ProfileFormValues) => {
    try {
      await updateProfile({
        ...values,
        avatar_url: values.avatar_url === '' ? null : values.avatar_url,
      });
      showSuccess("Identity Updated.");
    } catch (error: any) {
      showError(`Update failed: ${error.message}`);
    }
  };

  const isSubmitting = form.formState.isSubmitting;

  return (
    <Card className="rounded-xl shadow-sm border-white/5 bg-card/40">
      <CardHeader className="p-4">
        <CardTitle className="flex items-center gap-2 text-lg font-black uppercase tracking-tighter">
          <User className="h-5 w-5 text-primary" /> Profile Identity
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="first_name" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-50">First Name</FormLabel>
                  <FormControl><Input {...field} value={field.value || ''} className="rounded-xl bg-background/50" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="last_name" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-50">Last Name</FormLabel>
                  <FormControl><Input {...field} value={field.value || ''} className="rounded-xl bg-background/50" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="avatar_url" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-50">Avatar URL</FormLabel>
                <FormControl><Input {...field} value={field.value || ''} className="rounded-xl bg-background/50" /></FormControl>
                <FormMessage />
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

export default ProfileSettings;