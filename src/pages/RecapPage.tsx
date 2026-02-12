"use client";

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BookOpen, CalendarDays, Loader2, Sparkles, CheckCircle, Zap, Clock, TrendingUp, Trophy } from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

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
      
      return (data || []).map(task => ({
        ...task,
        name: task.task_name,
        effective_duration_minutes: task.duration_used || task.duration_scheduled || 30,
      })) as CompletedTaskLogEntry[];
    },
    enabled: !!user?.id && !!formattedSelectedDate,
  });

  const stats = useMemo(() => {
    const totalXp = completedTasks.reduce((sum, t) => sum + (t.xp_earned || 0), 0);
    const totalEnergy = completedTasks.reduce((sum, t) => sum + (t.energy_cost || 0), 0);
    const totalMinutes = completedTasks.reduce((sum, t) => sum + (t.effective_duration_minutes || 0), 0);
    return { totalXp, totalEnergy, totalMinutes, count: completedTasks.length };
  }, [completedTasks]);

  const currentReflection = useMemo(() => {
    if (!selectedDate || reflections.length === 0) return null;
    return reflections.find(r => isSameDay(parseISO(r.reflection_date), selectedDate));
  }, [selectedDate, reflections]);

  if (isSessionLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-10 animate-pop-in pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-8">
        <div className="flex items-center gap-5">
          <div className="p-4 rounded-[1.5rem] bg-logo-green/10 border border-logo-green/20 shadow-inner">
            <Trophy className="h-8 w-8 text-logo-green" />
          </div>
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tighter">Daily Recap</h1>
            <p className="text-xs font-bold text-muted-foreground/60 uppercase tracking-[0.3em] mt-1">Temporal Achievement Log</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <DatePicker date={selectedDate} setDate={setSelectedDate} placeholder="Select Day" />
          <Button variant="outline" onClick={() => navigate('/scheduler')} className="rounded-xl font-black uppercase tracking-widest text-[10px] h-11 px-6">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Card className="p-6 rounded-[2rem] border-none shadow-xl bg-card/40 backdrop-blur-md">
            <CardHeader className="p-0 pb-6">
              <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Day Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 space-y-6">
              <div className="grid grid-cols-1 gap-4">
                {[
                  { label: "XP Earned", val: `+${stats.totalXp}`, icon: Sparkles, color: "text-primary" },
                  { label: "Objectives", val: stats.count, icon: CheckCircle, color: "text-logo-green" },
                  { label: "Active Time", val: `${stats.totalMinutes}m`, icon: Clock, color: "text-logo-yellow" },
                  { label: "Energy Cost", val: `${stats.totalEnergy}⚡`, icon: Zap, color: "text-logo-orange" }
                ].map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-secondary/20 border border-white/5">
                    <div className="flex items-center gap-3">
                      <s.icon className={cn("h-4 w-4", s.color)} />
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-50">{s.label}</span>
                    </div>
                    <span className="text-lg font-black font-mono tracking-tighter">{s.val}</span>
                  </div>
                ))}
              </div>
              <Button onClick={() => setIsReflectionDialogOpen(true)} className="w-full rounded-2xl font-black uppercase tracking-widest text-[10px] h-12 shadow-lg shadow-primary/20">
                <BookOpen className="h-4 w-4 mr-2" /> {currentReflection ? 'Edit Reflection' : 'Initialize Reflection'}
              </Button>
            </CardContent>
          </Card>

          {currentReflection && (
            <Card className="p-6 rounded-[2rem] border-none shadow-xl bg-logo-green/[0.03] relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-5"><BookOpen className="h-16 w-16" /></div>
              <CardHeader className="p-0 pb-4">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-logo-green/60">Temporal Reflection</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <p className="text-sm font-bold text-foreground/70 leading-relaxed italic">"{currentReflection.notes}"</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-3">
          <Card className="p-8 rounded-[2.5rem] border-none shadow-2xl bg-card/40 backdrop-blur-xl">
            <CardHeader className="p-0 pb-8">
              <CardTitle className="text-2xl font-black uppercase tracking-tighter flex items-center gap-4">
                <CheckCircle className="h-8 w-8 text-logo-green" />
                Achievement Log
              </CardTitle>
              <p className="text-[11px] font-bold text-muted-foreground/40 uppercase tracking-[0.4em]">Synchronized Objectives • {selectedDate ? format(selectedDate, 'MMMM do, yyyy') : '...'}</p>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingTasks ? (
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-3xl" />)}
                </div>
              ) : completedTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 text-center gap-6 border-2 border-dashed border-white/5 rounded-[2.5rem] bg-secondary/5">
                  <Zap className="h-16 w-16 text-muted-foreground/10" />
                  <p className="text-sm font-black text-muted-foreground/30 uppercase tracking-[0.3em]">No objectives recorded for this cycle.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {completedTasks.map((task) => {
                    const hue = getEmojiHue(task.name);
                    return (
                      <div 
                        key={task.id} 
                        className="flex items-center justify-between p-5 rounded-3xl bg-background/40 border border-white/5 transition-all duration-500 hover:bg-background/60 hover:scale-[1.01] hover:shadow-xl"
                        style={{ borderLeft: `6px solid hsl(${hue} 70% 50%)` }}
                      >
                        <div className="flex items-center gap-6 min-w-0">
                          <span className="text-4xl shrink-0 drop-shadow-lg">{assignEmoji(task.name)}</span>
                          <div className="min-w-0 space-y-1">
                            <p className="font-black uppercase tracking-tighter truncate text-lg sm:text-xl">{task.name}</p>
                            <div className="flex items-center gap-4 text-[11px] font-mono font-bold text-muted-foreground/50">
                              <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {format(parseISO(task.completed_at), 'h:mm a')}</span>
                              <span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-logo-yellow" /> {task.energy_cost}⚡</span>
                              <span className="flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5 text-primary" /> {task.effective_duration_minutes}m</span>
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline" className="h-8 px-4 text-[10px] font-black uppercase border-primary/20 text-primary bg-primary/5 rounded-xl">+{task.xp_earned} XP</Badge>
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