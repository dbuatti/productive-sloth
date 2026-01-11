"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Tooltip, TooltipContent, TooltipTrigger 
} from '@/components/ui/tooltip';
import { 
  Home, Laptop, Globe, Music, Plus, Edit, Trash2, Save, X, Star, Target, Loader2, Sparkles, RefreshCw, Layers, Clock, Zap
} from 'lucide-react';
import { useEnvironments, Environment } from '@/hooks/use-environments';
import { useRetiredTasks } from '@/hooks/use-retired-tasks';
import { useSession } from '@/hooks/use-session';
import { showError, showSuccess } from '@/utils/toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn, getLucideIconComponent } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import { parseISO, differenceInMinutes } from 'date-fns';
import { setTimeOnDate } from '@/lib/scheduler-utils';

const iconOptions = [
  { value: 'Home', label: 'Home', icon: Home },
  { value: 'Laptop', label: 'Laptop', icon: Laptop },
  { value: 'Globe', label: 'Globe', icon: Globe },
  { value: 'Music', label: 'Music', icon: Music },
];

const colorOptions = [
  { value: '#FF6B6B', label: 'Red' },
  { value: '#4ECDC4', label: 'Teal' },
  { value: '#45B7D1', label: 'Blue' },
  { value: '#96CEB4', label: 'Green' },
  { value: '#FFEAA7', label: 'Yellow' },
  { value: '#DDA0DD', label: 'Purple' },
  { value: '#FFB347', label: 'Orange' },
];

const EnvironmentManager: React.FC = () => {
  const { profile } = useSession();
  const { environments, isLoading, addEnvironment, updateEnvironment, deleteEnvironment } = useEnvironments();
  const { retiredTasks } = useRetiredTasks();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  
  // Calculate Workday Duration for conversion
  const workdayDuration = useMemo(() => {
    if (!profile?.default_auto_schedule_start_time || !profile?.default_auto_schedule_end_time) return 480;
    const now = new Date();
    const start = setTimeOnDate(now, profile.default_auto_schedule_start_time);
    let end = setTimeOnDate(now, profile.default_auto_schedule_end_time);
    if (end < start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    return differenceInMinutes(end, start);
  }, [profile]);

  const totalAllocatedWeight = useMemo(() => {
    return environments.reduce((sum, env) => sum + (env.target_weight || 0), 0);
  }, [environments]);

  const [newEnvironment, setNewEnvironment] = useState({
    label: '',
    icon: 'Home',
    color: '#FF6B6B',
    drain_multiplier: 1.0,
    target_weight: 0,
  });

  const handleAddEnvironment = () => {
    if (!newEnvironment.label.trim()) return showError('Environment label is required');
    if (totalAllocatedWeight + newEnvironment.target_weight > 100) return showError('Total spatial budget cannot exceed 100%');
    
    addEnvironment({
      ...newEnvironment,
      value: newEnvironment.label.toLowerCase().replace(/\s+/g, '_'),
    });
    
    setNewEnvironment({ label: '', icon: 'Home', color: '#FF6B6B', drain_multiplier: 1.0, target_weight: 0 });
    setIsAddDialogOpen(false);
  };

  const handleWeightUpdate = useCallback((id: string, weight: number) => {
    const env = environments.find(e => e.id === id);
    if (!env) return;
    updateEnvironment({ id, target_weight: weight });
  }, [environments, updateEnvironment]);

  // Logic for Auto-Balance by Sink Volume
  const handleAutoBalanceBySink = async () => {
    if (retiredTasks.length === 0) return showError("No tasks in Aether Sink to analyze.");
    
    const durationByEnv = new Map<string, number>();
    let totalDuration = 0;

    retiredTasks.forEach(task => {
      const env = task.task_environment || 'laptop';
      const dur = task.duration || 30;
      durationByEnv.set(env, (durationByEnv.get(env) || 0) + dur);
      totalDuration += dur;
    });

    if (totalDuration === 0) return;

    // Distribute 100% based on proportion
    for (const env of environments) {
      const sinkDuration = durationByEnv.get(env.value) || 0;
      const calculatedWeight = Math.round((sinkDuration / totalDuration) * 100);
      await updateEnvironment({ id: env.id, target_weight: calculatedWeight });
    }
    
    showSuccess("Spatial budget re-aligned with Sink volume.");
  };

  if (isLoading) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading Spatial Dashboard...</div>;

  return (
    <div className="space-y-8">
      {/* --- 1. DYNAMIC BUDGET HEADER --- */}
      <Card className="p-4 bg-background/40 backdrop-blur-md border-white/5 shadow-inner">
        <div className="flex items-center justify-between mb-4">
           <div className="space-y-1">
             <h3 className="text-sm font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
               <Target className="h-4 w-4" /> Global Time Quota
             </h3>
             <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest opacity-60">Distribution of Workday: {workdayDuration}m</p>
           </div>
           
           <div className="flex gap-2">
             <Tooltip>
               <TooltipTrigger asChild>
                 <Button variant="outline" size="sm" onClick={handleAutoBalanceBySink} className="h-8 text-[10px] font-black uppercase tracking-widest gap-2 bg-primary/5 hover:bg-primary/10 border-primary/20">
                   <RefreshCw className="h-3 w-3" /> Auto-Sync Budget
                 </Button>
               </TooltipTrigger>
               <TooltipContent>Match percentages to your Sink's actual task volume</TooltipContent>
             </Tooltip>

             <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="aether" className="h-8 text-[10px] font-black uppercase tracking-widest">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Zone
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader><DialogTitle>New Workspace Zone</DialogTitle></DialogHeader>
                  <div className="space-y-6 py-4">
                    <div className="space-y-2">
                      <Label>Label</Label>
                      <Input value={newEnvironment.label} onChange={(e) => setNewEnvironment({...newEnvironment, label: e.target.value})} placeholder="e.g., Studio, Office" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Icon</Label>
                        <Select value={newEnvironment.icon} onValueChange={(v) => setNewEnvironment({...newEnvironment, icon: v})}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{iconOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Color</Label>
                        <div className="flex flex-wrap gap-1.5">{colorOptions.map(c => <button key={c.value} className={cn("h-6 w-6 rounded-full border-2 transition-all", newEnvironment.color === c.value ? "border-foreground scale-110" : "border-transparent")} style={{ backgroundColor: c.value }} onClick={() => setNewEnvironment({...newEnvironment, color: c.value})} />)}</div>
                      </div>
                    </div>
                    <Button onClick={handleAddEnvironment} className="w-full">Create Zone</Button>
                  </div>
                </DialogContent>
              </Dialog>
           </div>
        </div>

        {/* Master Multi-Segment Bar */}
        <div className="relative h-6 w-full rounded-full bg-secondary/50 flex overflow-hidden shadow-inner border border-white/5 mb-2">
          {environments.map((env, i) => (
            <Tooltip key={env.id}>
              <TooltipTrigger asChild>
                <div 
                  className="h-full transition-all duration-700 ease-aether-out relative group"
                  style={{ width: `${env.target_weight}%`, backgroundColor: env.color }}
                >
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </TooltipTrigger>
              <TooltipContent className="font-bold">{env.label}: {env.target_weight}%</TooltipContent>
            </Tooltip>
          ))}
          {totalAllocatedWeight < 100 && (
            <div 
              className="h-full bg-muted-foreground/10 flex items-center justify-center"
              style={{ width: `${100 - totalAllocatedWeight}%` }}
            >
              <span className="text-[8px] font-black opacity-20 uppercase">Spare: {100 - totalAllocatedWeight}%</span>
            </div>
          )}
        </div>
        
        <div className="flex justify-between items-center px-1">
           <span className={cn("text-[9px] font-black uppercase tracking-widest", totalAllocatedWeight > 100 ? "text-destructive" : "text-muted-foreground/40")}>
             {totalAllocatedWeight}% Allocated
           </span>
           {totalAllocatedWeight !== 100 && (
             <span className="text-[9px] font-bold text-logo-yellow animate-pulse">Attention: Target 100% for full efficiency</span>
           )}
        </div>
      </Card>

      {/* --- 2. QUICK-SLIDE CARDS --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {environments.map((env) => {
          const Icon = getLucideIconComponent(env.icon);
          const predictedMinutes = Math.round(workdayDuration * (env.target_weight / 100));
          
          return (
            <Card key={env.id} className="relative group overflow-hidden border-white/5 bg-card/40 transition-all hover:shadow-lg">
              {/* Sidebar color accent */}
              <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: env.color }} />
              
              <CardHeader className="pb-3 pt-4 px-6 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-background/50 shadow-inner" style={{ color: env.color }}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-black uppercase tracking-tight">{env.label}</span>
                </div>
                
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/40 hover:text-destructive" onClick={() => setDeleteTarget({ id: env.id, label: env.label })}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              
              <CardContent className="px-6 pb-5 space-y-5">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-2">
                       <span className="text-2xl font-black font-mono tracking-tighter" style={{ color: env.color }}>
                         {env.target_weight}%
                       </span>
                       <span className="text-[10px] font-bold uppercase text-muted-foreground/60 tracking-widest">Budget</span>
                    </div>
                    
                    <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-primary/5 border border-primary/10">
                      <Clock className="h-3 w-3 text-primary" />
                      <span className="text-xs font-mono font-bold text-foreground">~{predictedMinutes}m</span>
                    </div>
                  </div>

                  <Slider 
                    value={[env.target_weight]} 
                    onValueChange={([v]) => handleWeightUpdate(env.id, v)} 
                    max={100} 
                    step={5} 
                    className="py-1 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                   <div className="flex items-center gap-4">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/40">Drain Index</span>
                        <span className="text-xs font-mono font-bold text-logo-yellow">{env.drain_multiplier}x</span>
                      </div>
                   </div>
                   
                   <div className="flex items-center gap-2">
                     <span className="text-[9px] font-bold uppercase tracking-widest opacity-30">Status:</span>
                     <Badge variant="outline" className={cn("text-[8px] h-4 font-black uppercase px-1.5", env.target_weight > 0 ? "bg-logo-green/10 text-logo-green border-logo-green/20" : "opacity-30")}>
                        {env.target_weight > 0 ? "Active" : "Idle"}
                     </Badge>
                   </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* --- 4. INTERACTIVE VIBE PREVIEW --- */}
      <Card className="p-5 bg-gradient-to-br from-primary/[0.03] to-secondary/[0.03] border-primary/10 rounded-2xl">
         <CardHeader className="p-0 pb-4">
           <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-foreground/60 flex items-center gap-2">
             <Layers className="h-4 w-4 text-primary" /> Sequence Blueprint
           </CardTitle>
           <p className="text-[10px] text-muted-foreground italic font-medium">Estimated sequence of environment blocks for your next Auto-Balance.</p>
         </CardHeader>
         
         <CardContent className="p-0 space-y-4">
            <div className="flex items-center gap-2 w-full h-10 px-2 rounded-xl bg-background/50 border border-white/5 overflow-hidden">
               {/* PREVIEW BLOCKS: Simple simulation of AM/PM spread if enabled */}
               {environments.filter(e => e.target_weight > 0).map((env, i) => (
                 <div 
                   key={`am-${env.id}`} 
                   className="h-6 rounded-md flex-1 min-w-[30px] flex items-center justify-center transition-all duration-500 hover:scale-105"
                   style={{ backgroundColor: `${env.color}40`, border: `1px solid ${env.color}80` }}
                 >
                   <span className="text-[8px] font-black uppercase tracking-tighter opacity-50">{env.label.substring(0, 3)}</span>
                 </div>
               ))}
               {profile?.enable_macro_spread && environments.filter(e => e.target_weight > 0).reverse().map((env, i) => (
                 <div 
                   key={`pm-${env.id}`} 
                   className="h-6 rounded-md flex-1 min-w-[30px] flex items-center justify-center transition-all duration-500 hover:scale-105"
                   style={{ backgroundColor: `${env.color}20`, border: `1px dashed ${env.color}40` }}
                 >
                   <span className="text-[8px] font-black uppercase tracking-tighter opacity-30">{env.label.substring(0, 3)}</span>
                 </div>
               ))}
            </div>
            <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest text-muted-foreground/30 px-1">
               <span>Workday Start</span>
               {profile?.enable_macro_spread && <span>AM/PM Reset</span>}
               <span>Workday End</span>
            </div>
         </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dismantle Zone?</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete "{deleteTarget?.label}"? This will remove the spatial quota associated with this environment.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if(deleteTarget) deleteEnvironment(deleteTarget.id); setDeleteTarget(null); }} className="bg-destructive hover:bg-destructive/90">Dismantle</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EnvironmentManager;