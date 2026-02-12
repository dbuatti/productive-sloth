"use client";

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, BookOpen, CheckCircle } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { useReflections, NewReflection, Reflection } from '@/hooks/use-reflections';
import { format, isSameDay, parseISO } from 'date-fns';
import { XP_PER_LEVEL } from '@/lib/constants';

const reflectionSchema = z.object({
  notes: z.string().min(10, "Reflection must be at least 10 characters.").max(1000, "Reflection cannot exceed 1000 characters."),
});

type ReflectionFormValues = z.infer<typeof reflectionSchema>;

interface DailyReflectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reflectionDate: string; // YYYY-MM-DD
}

const DailyReflectionDialog: React.FC<DailyReflectionDialogProps> = ({ open, onOpenChange, reflectionDate }) => {
  const { user, profile, refreshProfile, rechargeEnergy } = useSession();
  const { reflections, isLoading: isLoadingReflections, addReflection, updateReflection } = useReflections(reflectionDate);
  const [currentReflection, setCurrentReflection] = useState<Reflection | null>(null);
  const [xpAwarded, setXpAwarded] = useState(false);

  const form = useForm<ReflectionFormValues>({
    resolver: zodResolver(reflectionSchema),
    defaultValues: {
      notes: '',
    },
    mode: 'onChange',
  });

  useEffect(() => {
    if (open && reflections.length > 0) {
      const existing = reflections.find(r => isSameDay(parseISO(r.reflection_date), parseISO(reflectionDate)));
      if (existing) {
        setCurrentReflection(existing);
        form.reset({ notes: existing.notes });
        setXpAwarded(existing.xp_bonus_awarded);
      } else {
        setCurrentReflection(null);
        form.reset({ notes: '' });
        setXpAwarded(false);
      }
    } else if (open && reflections.length === 0) {
      setCurrentReflection(null);
      form.reset({ notes: '' });
      setXpAwarded(false);
    }
  }, [open, reflections, reflectionDate, form]);

  const onSubmit = async (values: ReflectionFormValues) => {
    if (!user || !profile) return;

    const reflectionXpBonus = 20;

    try {
      if (currentReflection) {
        await updateReflection({
          id: currentReflection.id,
          notes: values.notes,
        });
      } else {
        await addReflection({
          reflection_date: reflectionDate,
          prompt: "What did you learn today?",
          notes: values.notes,
          xp_bonus_awarded: false,
        });
      }

      if (!xpAwarded) {
        await refreshProfile();
        await rechargeEnergy(reflectionXpBonus);
        setXpAwarded(true);
        if (currentReflection) {
          await updateReflection({ id: currentReflection.id, xp_bonus_awarded: true });
        } else {
          const newRef = reflections.find(r => isSameDay(parseISO(r.reflection_date), parseISO(reflectionDate)));
          if (newRef) await updateReflection({ id: newRef.id, xp_bonus_awarded: true });
        }
      }
      onOpenChange(false);
    } catch (error: any) {
      console.error("Reflection submission error:", error);
    }
  };

  const isSubmitting = form.formState.isSubmitting;
  const isValid = form.formState.isValid;

  if (isLoadingReflections) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Loading Reflection</DialogTitle>
            <DialogDescription>Retrieving your temporal insights...</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto animate-pop-in">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
            <BookOpen className="h-6 w-6 text-primary" /> Daily Reflection
          </DialogTitle>
          <DialogDescription>
            Reflect on your day for insights and an XP bonus! ({format(parseISO(reflectionDate), 'PPP')})
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What did you learn or achieve today?</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Write your thoughts here..."
                      rows={8}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              {xpAwarded && (
                <div className="flex items-center gap-2 text-logo-green font-semibold mr-auto">
                  <CheckCircle className="h-5 w-5" /> XP Awarded!
                </div>
              )}
              <Button type="submit" disabled={isSubmitting || !isValid}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                {currentReflection ? 'Update Reflection' : 'Save Reflection'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default DailyReflectionDialog;