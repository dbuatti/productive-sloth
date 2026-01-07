"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, CheckCircle, Clock, Zap, Lightbulb, Smile, Coffee, Target, ChevronRight } from 'lucide-react';
import { ScheduleSummary, CompletedTaskLogEntry, DBScheduledTask } from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import CompletedTaskLogItem from './CompletedTaskLogItem';

interface DailyVibeRecapCardProps {
  scheduleSummary: ScheduleSummary | null;
  tasksCompletedToday: number;
  xpEarnedToday: number;
  profileEnergy: number;
  criticalTasksCompletedToday: number;
  selectedDayString: string;
  completedScheduledTasks: CompletedTaskLogEntry[];
  totalActiveTimeMinutes: number;
  totalBreakTimeMinutes: number;
}

const DailyVibeRecapCard: React.FC<DailyVibeRecapCardProps> = ({
  scheduleSummary,
  tasksCompletedToday,
  xpEarnedToday,
  criticalTasksCompletedToday,
  selectedDayString,
  completedScheduledTasks,
  totalActiveTimeMinutes,
  totalBreakTimeMinutes,
}) => {
  
  const totalActiveTimeHours = Math.floor(totalActiveTimeMinutes / 60);
  const totalActiveTimeMins = totalActiveTimeMinutes % 60;

  const debriefMessage = useMemo(() => {
    if (tasksCompletedToday === 0 && totalActiveTimeMinutes === 0) {
      return "Temporal window initialized. Ready for objective deployment. ✨";
    }
    if (criticalTasksCompletedToday > 0 && criticalTasksCompletedToday === scheduleSummary?.criticalTasksRemaining) {
      return "Strategic Priority Achieved: All critical objectives successfully neutralized. ✅";
    }
    if (tasksCompletedToday >= 5) {
      return `Flow State Peak: ${tasksCompletedToday} objectives synchronized. System efficiency is high. 🚀`;
    }
    if (totalActiveTimeMinutes >= 180) {
      return `High-Endurance Sync: ${totalActiveTimeHours}h ${totalActiveTimeMins}m of active flow detected. 💪`;
    }
    return `System Pulse: ${tasksCompletedToday} task${tasksCompletedToday !== 1 ? 's' : ''} completed. Progressing toward peak vibe. 😊`;
  }, [tasksCompletedToday, totalActiveTimeMinutes, criticalTasksCompletedToday, scheduleSummary?.criticalTasksRemaining, totalActiveTimeHours, totalActiveTimeMins]);

  const reflectionPrompts = [
    "Identify the primary catalyst for today's highest win.",
    "Which objective generated the most energy resonance?",
    "One calibration to optimize focus for the next window?",
  ];

  const StatHUD = ({ label, value, icon: Icon, colorClass, shadowColor }: { label: string, value: string | number, icon: any, colorClass: string, shadowColor: string }) => (
    <Card className={cn("flex flex-col items-center justify-center p-5 border border-white/5 rounded-xl transition-all duration-300 hover:scale-105", shadowColor)}>
      <div className={cn("p-2 rounded-lg bg-background/50 mb-3", colorClass)}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 mb-1">{label}</p>
      <p className="text-2xl font-black font-mono tracking-tighter text-foreground">{value}</p>
    </Card>
  );

  return (
    <Card className="p-4 rounded-xl shadow-sm animate-pop-in overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-accent to-logo-green opacity-50" />
      
      <CardHeader className="px-2 pb-4 pt-8 border-b border-white/5 bg-background/20 backdrop-blur-md p-0">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-primary">
            <Target className="h-3 w-3" /> System Debrief
          </div>
          <CardTitle className="text-2xl font-black tracking-tighter uppercase text-foreground flex items-center gap-3">
            Recap <ChevronRight className="h-5 w-5 opacity-30" /> {format(new Date(selectedDayString), 'MMM d, yyyy')}
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-8">
        {/* Luminous Narrative Message */}
        <Card className="relative p-6 rounded-2xl bg-primary/[0.03] border border-primary/10 overflow-hidden group">
          <div className="absolute -top-12 -right-12 h-24 w-24 bg-primary/10 blur-[40px] rounded-full group-hover:opacity-100 transition-opacity opacity-50" />
          <p className="text-lg font-bold text-foreground leading-relaxed relative z-10 text-center italic">
            "{debriefMessage}"
          </p>
        </Card>

        {/* Data Grid HUD */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatHUD 
            label="Objectives" 
            value={tasksCompletedToday} 
            icon={CheckCircle} 
            colorClass="text-logo-green" 
            shadowColor="hover:shadow-[0_0_20px_rgba(var(--logo-green),0.1)]"
          />
          <StatHUD 
            label="XP Gained" 
            value={`+${xpEarnedToday}`} 
            icon={Zap} 
            colorClass="text-primary" 
            shadowColor="hover:shadow-[0_0_20px_rgba(var(--primary),0.1)]"
          />
          <StatHUD 
            label="Active Flow" 
            value={`${totalActiveTimeHours}h ${totalActiveTimeMins}m`} 
            icon={Clock} 
            colorClass="text-foreground" 
            shadowColor="hover:shadow-[0_0_20px_rgba(255,255,255,0.05)]"
          />
          <StatHUD 
            label="Rest Sync" 
            value={`${totalBreakTimeMinutes}m`} 
            icon={Coffee} 
            colorClass="text-logo-orange" 
            shadowColor="hover:shadow-[0_0_20px_rgba(var(--logo-orange),0.1)]"
          />
        </div>

        {/* Reflection Terminal */}
        <Card className="space-y-4 p-6 rounded-2xl bg-secondary/20 border border-white/5">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2 text-muted-foreground">
            <Lightbulb className="h-4 w-4 text-logo-yellow" /> Cognitive Calibration
          </h3>
          <ul className="space-y-4">
            {reflectionPrompts.map((prompt, index) => (
              <li key={index} className="flex items-center gap-4 group">
                <div className="h-8 w-8 rounded-lg bg-background/50 flex items-center justify-center shrink-0 border border-white/5 group-hover:border-primary/40 transition-colors">
                  <Smile className="h-4 w-4 text-primary opacity-50 group-hover:opacity-100" />
                </div>
                <span className="text-sm font-bold text-muted-foreground group-hover:text-foreground transition-colors leading-tight">
                  {prompt}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        {/* Collapsible History Log */}
        {completedScheduledTasks.length > 0 && (
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="completed-tasks-log" className="border-none">
              <AccordionTrigger className="glass-card hover:no-underline rounded-xl px-4 py-3 border border-white/10 group">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded bg-logo-green/10 text-logo-green">
                    <CheckCircle className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest">
                    Archive Access: {completedScheduledTasks.length} Logged Events
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-4 px-1">
                {completedScheduledTasks.map(task => (
                  <div key={task.id} className="animate-pop-in">
                    <CompletedTaskLogItem task={task} />
                  </div>
                ))}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
};

export default DailyVibeRecapCard;