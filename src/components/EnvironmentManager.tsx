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
  Home, Laptop, Globe, Music, Plus, Trash2, Target, Loader2, RefreshCw, Layers, Clock, Zap, Star, GripVertical, Info
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
import { differenceInMinutes } from 'date-fns';
import { setTimeOnDate } from '@/lib/scheduler-utils';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent 
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

// --- Constants for Add Dialog ---
const iconOptions = [
  { value: 'Home', label: 'Home' },
  { value: 'Laptop', label: 'Laptop' },
  { value: 'Globe', label: 'Globe' },
  { value: 'Music', label: 'Music' },
  { value: 'Briefcase', label: 'Work' },
  { value: 'Coffee', label: 'Cafe' },
  { value: 'Star', label: 'Focus' },
  { value: 'Target', label: 'Objective' },
];

const colorOptions = [
  { value: '#FF6B6B', label: 'Red' },
  { value: '#4ECDC4', label: 'Teal' },
  { value: '#FFE66D', label: 'Yellow' },
  { value: '#1A535C', label: 'Dark Green' },
  { value: '#FF9F1C', label: 'Orange' },
  { value: '#2EC4B6', label: 'Turquoise' },
  { value: '#E71D36', label: 'Crimson' },
];

// --- Sub-component: Draggable Blueprint Block ---
const SortableBlueprintBlock = ({ env, isPm = false }: { env: Environment, isPm?: boolean }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: isPm ? `${env.value}-pm` : env.value });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 0,
    backgroundColor: `${env.color}${isPm ? '20' : '40'}`, 
    borderColor: `${env.color}${isPm ? '40' : '80'}` 
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      className={cn(
        "h-8 rounded-md flex-1 min-w-[50px] flex items-center justify-center transition-all cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50 scale-105 rotate-2",
        !isPm ? "shadow-sm border" : "border border-dashed opacity-60"
      )}
    >
      <span className="text-[9px] font-black uppercase tracking-tighter text-foreground/70">
        {env.label.substring(0, 4)}
      </span>
    </div>
  );
};

const EnvironmentManager: React.FC = () => {
  const { profile, updateProfile } = useSession();
  const { environments, isLoading, addEnvironment, updateEnvironment, deleteEnvironment } = useEnvironments();
  const { retiredTasks } = useRetiredTasks();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);

  // DND Sensors for Blueprint
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  
  // Calculate Sink Stats for Capacity Indicators
  const sinkStats = useMemo(() => {
    const stats = new Map<string, { duration: number, count: number }>();
    retiredTasks.forEach(task => {
      const env = task.task_environment || 'laptop';
      const current = stats.get(env) || { duration: 0, count: 0 };
      stats.set(env, {
        duration: current.duration + (task.duration || 30),
        count: current.count + 1
      });
    });
    return stats;
  }, [retiredTasks]);

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

  // --- Logic 1: Proportional Auto-Shrink ---
  const handleWeightUpdate = useCallback(async (id: string, newWeight: number) => {
    const targetEnv = environments.find(e => e.id === id);
    if (!targetEnv) return;

    const delta = newWeight - (targetEnv.target_weight || 0);
    if (delta <= 0) {
      // Reducing is simple
      await updateEnvironment({ id, target_weight: newWeight });
      return;
    }

    // Increasing: Need to shrink others
    const otherActiveEnvs = environments.filter(e => e.id !== id && e.target_weight > 0);
    const sumOthers = otherActiveEnvs.reduce((s, e) => s + e.target_weight, 0);

    if (sumOthers === 0) {
      // No one else to shrink, just cap at 100
      await updateEnvironment({ id, target_weight: Math.min(100, newWeight) });
      return;
    }

    const updates = [];
    let remainingExcess = delta;

    // Proportional reduction
    for (let i = 0; i < otherActiveEnvs.length; i++) {
      const env = otherActiveEnvs[i];
      const ratio = env.target_weight / sumOthers;
      // Step-size of 5 for sliders
      const reduction = Math.min(env.target_weight, Math.floor((delta * ratio) / 5) * 5);
      
      if (reduction > 0) {
        updates.push({ id: env.id, target_weight: env.target_weight - reduction });
        remainingExcess -= reduction;
      }
    }

    // Final update for the target
    updates.push({ id, target_weight: newWeight - remainingExcess });

    // Execute batch updates
    for (const update of updates) {
      await updateEnvironment(update);
    }
  }, [environments, updateEnvironment]);

  // --- Logic 5: Smart-Sync Modes ---
  const handleAutoBalance = async (mode: 'volume' | 'count') => {
    if (retiredTasks.length === 0) return showError("No tasks in Aether Sink to analyze.");
    
    let totalValue = 0;
    const envValues = new Map<string, number>();

    retiredTasks.forEach(task => {
      const env = task.task_environment || 'laptop';
      const val = mode === 'volume' ? (task.duration || 30) : 1;
      envValues.set(env, (envValues.get(env) || 0) + val);
      totalValue += val;
    });

    if (totalValue === 0) return;

    // Distribute 100% (snapped to 5% increments)
    for (const env of environments) {
      const sinkVal = envValues.get(env.value) || 0;
      const rawWeight = (sinkVal / totalValue) * 100;
      const snappedWeight = Math.round(rawWeight / 5) * 5;
      await updateEnvironment({ id: env.id, target_weight: snappedWeight });
    }
    
    showSuccess(`Spatial budget re-aligned by ${mode}.`);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const currentOrder = profile?.custom_environment_order || environments.map(e => e.value);
    const oldIndex = currentOrder.indexOf(active.id as string);
    const newIndex = currentOrder.indexOf(over.id as string);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = arrayMove(currentOrder, oldIndex, newIndex);
      updateProfile({ custom_environment_order: newOrder });
    }
  };

  const handleAddEnvironment = () => {
    if (!newEnvironment.label.trim()) return showError('Environment label is required');
    addEnvironment({
      ...newEnvironment,
      value: newEnvironment.label.toLowerCase().replace(/\s+/g, '_'),
    });
    setNewEnvironment({ label: '', icon: 'Home', color: '#FF6B6B', drain_multiplier: 1.0, target_weight: 0 });
    setIsAddDialogOpen(false);
  };

  const sortedEnvsByOrder = useMemo(() => {
    const order = profile?.custom_environment_order || [];
    return [...environments].sort((a, b) => {
      const idxA = order.indexOf(a.value);
      const idxB = order.indexOf(b.value);
      if (idxA === -1 && idxB === -1) return 0;
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
  }, [environments, profile?.custom_environment_order]);

  if (isLoading) return <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8">
      {/* --- 1. DYNAMIC BUDGET HEADER --- */}
      <Card className="p-4 bg-background/40 backdrop-blur-md border-white/5 shadow-inner">
        <div className="flex items-center justify-between mb-4">
           <div className="space-y-1">
             <h3 className="text-sm font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
               <Target className="h-4 w-4" /> Spatial Budgeting
             </h3>
             <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest opacity-60">Global Time Pool: {workdayDuration}m</p>
           </div>
           
           <div className="flex gap-2">
             <DropdownMenu>
               <DropdownMenuTrigger asChild>
                 <Button variant="outline" size="sm" className="h-8 text-[10px] font-black uppercase tracking-widest gap-2 bg-primary/5 border-primary/20">
                   <RefreshCw className="h-3 w-3" /> Auto-Sync
                 </Button>
               </DropdownMenuTrigger>
               <DropdownMenuContent align="end" className="glass-card">
                 <DropdownMenuItem onClick={() => handleAutoBalance('volume')} className="text-[10px] font-bold uppercase gap-2">
                   <Clock className="h-3 w-3" /> By Task Duration
                 </DropdownMenuItem>
                 <DropdownMenuItem onClick={() => handleAutoBalance('count')} className="text-[10px] font-bold uppercase gap-2">
                   <Layers className="h-3 w-3" /> By Task Count
                 </DropdownMenuItem>
               </DropdownMenuContent>
             </DropdownMenu>

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

        <div className="relative h-6 w-full rounded-full bg-secondary/50 flex overflow-hidden shadow-inner border border-white/5 mb-2">
          {environments.map((env) => (
            <div 
              key={env.id}
              className="h-full transition-all duration-700 ease-aether-out relative group"
              style={{ width: `${env.target_weight}%`, backgroundColor: env.color }}
            >
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          ))}
          {totalAllocatedWeight < 100 && (
            <div className="h-full bg-muted-foreground/10 flex items-center justify-center" style={{ width: `${100 - totalAllocatedWeight}%` }}>
              <span className="text-[8px] font-black opacity-20 uppercase">Empty: {100 - totalAllocatedWeight}%</span>
            </div>
          )}
        </div>
      </Card>

      {/* --- 2. DYNAMIC CARDS WITH HIBERNATION & DENSITY --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {environments.map((env) => {
          const Icon = getLucideIconComponent(env.icon);
          const predictedMinutes = Math.round(workdayDuration * (env.target_weight / 100));
          const actualSinkDuration = sinkStats.get(env.value)?.duration || 0;
          const capacityRatio = predictedMinutes > 0 ? Math.min(100, (actualSinkDuration / predictedMinutes) * 100) : 0;
          const isHibernating = env.target_weight === 0;
          
          return (
            <Card key={env.id} className={cn(
              "relative group overflow-hidden border-white/5 bg-card/40 transition-all duration-500",
              isHibernating && "opacity-40 grayscale blur-[0.5px] scale-[0.98] hover:opacity-100 hover:grayscale-0 hover:blur-0"
            )}>
              <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: env.color }} />
              
              <CardHeader className="pb-3 pt-4 px-6 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-background/50 shadow-inner" style={{ color: env.color }}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-black uppercase tracking-tight">{env.label}</span>
                    {isHibernating && <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Hibernating</span>}
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/40 hover:text-destructive" onClick={() => setDeleteTarget({ id: env.id, label: env.label })}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </CardHeader>
              
              <CardContent className="px-6 pb-5 space-y-5">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-2">
                       <span className="text-2xl font-black font-mono tracking-tighter" style={{ color: env.color }}>{env.target_weight}%</span>
                    </div>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-primary/5 border border-primary/10">
                          <Clock className="h-3 w-3 text-primary" />
                          <span className="text-xs font-mono font-bold text-foreground">~{predictedMinutes}m</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="text-[10px] font-bold">Sink Inventory: {actualSinkDuration}m available</TooltipContent>
                    </Tooltip>
                  </div>

                  {/* Slider with Density Indicator */}
                  <div className="relative pt-1">
                    {/* Capacity Track (point 3) */}
                    <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1.5 bg-secondary/50 rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full transition-all duration-1000",
                          capacityRatio >= 100 ? "bg-logo-green/30" : "bg-primary/20"
                        )}
                        style={{ width: `${capacityRatio}%` }}
                      />
                    </div>
                    <Slider 
                      value={[env.target_weight]} 
                      onValueChange={([v]) => handleWeightUpdate(env.id, v)} 
                      max={100} 
                      step={5} 
                      className="relative z-10 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                   <div className="flex items-center gap-4">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/40">Density</span>
                        <span className={cn("text-xs font-mono font-bold", actualSinkDuration >= predictedMinutes ? "text-logo-green" : "text-logo-yellow")}>
                          {actualSinkDuration}m / {predictedMinutes}m
                        </span>
                      </div>
                   </div>
                   <Badge variant="outline" className={cn("text-[8px] h-4 font-black uppercase px-1.5", env.target_weight > 0 ? "bg-logo-green/10 text-logo-green" : "opacity-30")}>
                      {env.target_weight > 0 ? "Active" : "Idle"}
                   </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* --- 4. INTERACTIVE SEQUENCE BLUEPRINT --- */}
      <Card className="p-5 bg-gradient-to-br from-primary/[0.03] to-secondary/[0.03] border-primary/10 rounded-2xl">
         <CardHeader className="p-0 pb-4">
           <div className="flex items-center justify-between">
             <div className="space-y-1">
               <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-foreground/60 flex items-center gap-2">
                 <Layers className="h-4 w-4 text-primary" /> Sequence Blueprint
               </CardTitle>
               <p className="text-[10px] text-muted-foreground italic font-medium">Drag blocks to reorder your Spatial Sequence.</p>
             </div>
             <Tooltip>
               <TooltipTrigger asChild>
                 <Info className="h-3 w-3 text-muted-foreground/30" />
               </TooltipTrigger>
               <TooltipContent className="max-w-[200px] text-[10px]">Auto-Balance processes environments in this specific order. Move your most important zone to the front.</TooltipContent>
             </Tooltip>
           </div>
         </CardHeader>
         
         <CardContent className="p-0 space-y-4">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <div className="flex items-center gap-2 w-full h-12 px-2 rounded-xl bg-background/50 border border-white/5 overflow-hidden">
                <SortableContext items={sortedEnvsByOrder.map(e => e.value)} strategy={horizontalListSortingStrategy}>
                   {sortedEnvsByOrder.filter(e => e.target_weight > 0).map((env) => (
                     <SortableBlueprintBlock key={env.id} env={env} />
                   ))}
                </SortableContext>
                
                {profile?.enable_macro_spread && (
                  <>
                    <div className="h-6 w-px bg-white/10 mx-1" />
                    {sortedEnvsByOrder.filter(e => e.target_weight > 0).reverse().map((env) => (
                      <div 
                        key={`pm-${env.id}`} 
                        className="h-8 rounded-md flex-1 min-w-[50px] flex items-center justify-center border border-dashed opacity-40 grayscale"
                        style={{ backgroundColor: `${env.color}10`, borderColor: `${env.color}30` }}
                      >
                         <span className="text-[8px] font-black uppercase tracking-tighter opacity-50">{env.label.substring(0, 3)}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </DndContext>
            <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest text-muted-foreground/30 px-1">
               <span>Start</span>
               {profile?.enable_macro_spread && <span>AM/PM Reset</span>}
               <span>End</span>
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