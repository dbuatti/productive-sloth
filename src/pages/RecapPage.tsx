"use client";

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BookOpen, CalendarDays, Loader2, Sparkles, CheckCircle, Zap, Clock } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { useReflections } from '@/hooks/use-reflections';
import DailyReflectionDialog from '@/components/DailyReflectionDialog';
import DatePicker from '@/components/DatePicker';
import { format, parseISO, isSameDay, startOfDay, endOfDay } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CompletedTaskLogEntry } from '@/types/scheduler';
import { assignEmoji, getEmojiHue } from '@/lib/scheduler-utils';
import { cn } from '@/lib/utils';

const RecapPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isLoading: isSessionLoading } = useSession();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isReflectionDialogOpen, setIsReflectionDialogOpen] = useState(false);

  const formattedSelectedDate = useMemo(() => selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '', [selectedDate]);
  const { reflections, isLoading: isLoadingReflections } = useReflections(formattedSelectedDate);

  const { data: completedTasks = [], isLoading: isLoadingTasks } = useQuery<CompletedTaskLogEntry[]>({
    queryKey: ['completedTasksForRecap', user?.id, formattedSelectedDate],
    queryFn: async () => {
      if (!user?.id || !formattedSelectedDate) return [];
      const start = startOfDay(parseISO(formattedSelectedDate)).toISOString();
      const end = endOfDay(parseISO(formattedSelectedDate)).toISOString();
      
      const { data, error } = await supabase
        .from('completedtasks')
        .select('*')
        .eq('user_id', user.id)
        .gte('completed_at', start)
        .lte('completed_at', end);

      if (error) throw error;
      return data as CompletedTaskLogEntry[];
    },
    enabled: !!user?.id && !!formattedSelectedDate,
  });

  const currentReflection = useMemo(() => {
    if (!selectedDate || reflections.length === 0) return null;
    return reflections.find(r => isSameDay(parseISO(r.reflection_date), selectedDate));
  }, [selectedDate, reflections]);

  const handleOpenReflectionDialog = () => {
    if (selectedDate) {
      setIsReflectionDialogOpen(true);
    }
  };

  if (isSessionLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <p className="text-lg font-semibold mb-4">Please log in to view your daily recap.</p>
        <Button onClick={() => navigate('/login')}>Go to Login</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-slide-in-up pb-12">
      <div className="flex items-center justify-between border-b pb-4">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <BookOpen className="h-7 w-7 text-primary" /> Daily Recap
        </h1>
        <Button variant="outline" onClick={() => navigate('/scheduler')} className="flex items-center gap-2 h-10 text-base" aria-label="Back to Scheduler">
          <ArrowLeft className="h-5 w-5" />
          Back
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Card className="p-4 rounded-xl shadow-sm border-white/5 bg-card/40">
            <CardHeader className="px-0 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg font-black uppercase tracking-tighter">
                <CalendarDays className="h-5 w-5 text-primary" />
                Select Day
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 space-y-4">
              <DatePicker
                date={selectedDate}
                setDate={setSelectedDate}
                placeholder="Select a date"
              />
              <Button
                onClick={handleOpenReflectionDialog}
                disabled={!selectedDate || isLoadingReflections}
                className="w-full flex items-center gap-2 rounded-xl font-black uppercase tracking-widest text-[10px] h-11"
              >
                {isLoadingReflections ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {currentReflection ? 'Edit Reflection' : 'Initialize Reflection'}
              </Button>
            </CardContent>
          </Card>

          {currentReflection && (
            <Card className="p-4 rounded-xl shadow-sm border-logo-green/20 bg-logo-green/[0.02]">
              <CardHeader className="px-0 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg font-black uppercase tracking-tighter text-logo-green">
                  <BookOpen className="h-5 w-5" /> Your Reflection
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-48 rounded-xl border border-white/5 p-4 bg-background/40">
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
                    {currentReflection.notes}
                  </p>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2">
          <Card className="p-6 rounded-3xl border-none shadow-xl bg-card/40 backdrop-blur-md">
            <CardHeader className="px-0 pb-6">
              <CardTitle className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
                <CheckCircle className="h-6 w-6 text-logo-green" />
                Achievement Log
              </CardTitle>
              <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">Objectives Synchronized on {selectedDate ? format(selectedDate, 'MMMM do') : '...'}</p>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingTasks ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}
                </div>
              ) : completedTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center gap-4 border-2 border-dashed border-white/5 rounded-3xl bg-secondary/5">
                  <Zap className="h-10 w-10 text-muted-foreground/20" />
                  <p className="text-xs font-bold text-muted-foreground/40 uppercase tracking-widest">No objectives recorded for this day.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {completedTasks.map((task) => {
                    const hue = getEmojiHue(task.task_name);
                    return (
                      <div 
                        key={task.id} 
                        className="flex items-center justify-between p-4 rounded-2xl bg-background/40 border border-white/5 transition-all hover:bg-background/60"
                        style={{ borderLeft: `4px solid hsl(${hue} 70% 50%)` }}
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <span className="text-2xl shrink-0">{assignEmoji(task.task_name)}</span>
                          <div className="min-w-0">
                            <p className="font-black uppercase tracking-tighter truncate text-sm sm:text-base">{task.task_name}</p>
                            <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground/60">
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {format(parseISO(task.completed_at), 'h:mm a')}</span>
                              <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-logo-yellow" /> {task.energy_cost}⚡</span>
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline" className="h-6 px-2 text-[9px] font-black uppercase border-primary/10 text-primary/60">+{task.xp_earned} XP</Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {selectedDate && (
        <DailyReflectionDialog
          open={isReflectionDialogOpen}
          onOpenChange={setIsReflectionDialogOpen}
          reflectionDate={formattedSelectedDate}
        />
      )}
    </div>
  );
};

export default RecapPage;