"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Tooltip, TooltipContent, TooltipTrigger 
} from '@/components/ui/tooltip';
import { 
  Home, Laptop, Globe, Music, Plus, Trash2, Target, Loader2, RefreshCw, Layers, Clock, Zap, Star, GripVertical, Info, Lock, Unlock, Scale
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

// --- Constants for Zone Customization ---
const iconOptions = [
  { value: 'Home', label: 'Home' },
  { value: 'Laptop', label: 'Digital' },
  { value: 'Globe', label: 'Away' },
  { value: 'Music', label: 'Piano' },
  { value: 'Briefcase', label: 'Work' },
  { value: 'Coffee', label: 'Rest' },
  { value: 'Star', label: 'Focus' },
];

const colorOptions = [
  { value: '#FF6B6B', label: 'Coral' },
  { value: '#4ECDC4', label: 'Teal' },
  { value: '#FFE66D', label: 'Sunshine' },
  { value: '#1A535C', label: 'Forest' },
  { value: '#FF9F1C', label: 'Orange' },
  { value: '#00A8E8', label: 'Sky' },
  { value: '#A594F9', label: 'Purple' },
];

// --- Sub-component: Draggable Blueprint Block ---
const SortableBlueprintBlock = ({ env, weight }: { env: Environment, weight: number }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: env.value });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 0,
    backgroundColor: `${env.color}40`, 
    borderColor: `${env.color}80`,
    width: `${weight}%`
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      className={cn(
        "h-8 rounded-md flex items-center justify-center transition-all cursor-grab active:cursor-grabbing shadow-sm border overflow-hidden",
        isDragging && "opacity-50 scale-105 rotate-2"
      )}
    >
      <span className="text-[9px] font-black uppercase tracking-tighter text-foreground/70 truncate px-1">
        {env.label}
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

  // --- Logic: Optimistic UI State ---
  const [localWeights, setLocalWeights] = useState<Record<string, number>>({});
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set());
  const isUpdatingRef = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync server state to local state
  useEffect(() => {
    if (!isUpdatingRef.current) {
      const weights: Record<string, number> = {};
      environments.forEach(e => {
        weights[e.id] = e.target_weight || 0;
      });
      setLocalWeights(weights);
    }
  }, [environments]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  
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
    return environments.reduce((sum, env) => sum + (localWeights[env.id] || 0), 0);
  }, [environments, localWeights]);

  const [newEnvironment, setNewEnvironment] = useState({
    label: '', icon: 'Home', color: '#FF6B6B', drain_multiplier: 1.0, target_weight: 0,
  });

  const toggleLock = (id: string) => {
    setLockedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // --- Logic: Proportional Balancing "Zero-Sum" Game ---
  const handleWeightUpdate = useCallback((id: string, newWeight: number) => {
    if (lockedIds.has(id)) return;
    
    isUpdatingRef.current = true;
    const currentWeights = { ...localWeights };
    const oldWeight = currentWeights[id] || 0;
    const delta = newWeight - oldWeight;

    if (delta === 0) return;

    let updatedWeights = { ...currentWeights };
    updatedWeights[id] = newWeight;

    // Determine target total
    const currentTotal = Object.values(currentWeights).reduce((s, w) => s + w, 0);
    
    // Proportional Shrink/Grow logic
    const otherEnvs = environments.filter(e => e.id !== id && !lockedIds.has(e.id));
    const sumOthers = otherEnvs.reduce((s, e) => s + (currentWeights[e.id] || 0), 0);

    if (sumOthers > 0 || (delta < 0 && sumOthers < 100)) {
      let remainingDelta = delta;
      
      // Sort others so we prioritize shrinking larger ones if delta > 0
      const sortedOthers = [...otherEnvs].sort((a, b) => 
        delta > 0 ? (currentWeights[b.id] - currentWeights[a.id]) : (currentWeights[a.id] - currentWeights[b.id])
      );

      for (const env of sortedOthers) {
        const ratio = (currentWeights[env.id] || 0) / (sumOthers || 1);
        let adjustment = Math.round((delta * ratio) / 5) * 5;
        
        if (delta > 0) { // Increasing current, shrinking others
           adjustment = Math.min(currentWeights[env.id], adjustment);
        } else { // Decreasing current, growing others
           // If sumOthers is 0 but we need to grow, just split delta evenly
           if (sumOthers === 0) adjustment = Math.round((delta / otherEnvs.length) / 5) * 5;
        }

        updatedWeights[env.id] -= adjustment;
        remainingDelta -= adjustment;
      }
      
      // Force 100% cap on primary
      updatedWeights[id] = newWeight - remainingDelta;
    }

    setLocalWeights(updatedWeights);

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        for (const [envId, weight] of Object.entries(updatedWeights)) {
          const original = environments.find(e => e.id === envId);
          if (original && original.target_weight !== weight) {
            await updateEnvironment({ id: envId, target_weight: weight });
          }
        }
        isUpdatingRef.current = false;
      } catch (e) {
        isUpdatingRef.current = false;
      }
    }, 800);
  }, [localWeights, environments, lockedIds, updateEnvironment]);

  const handleEqualizeAll = async () => {
    const activeEnvs = environments;
    if (activeEnvs.length === 0) return;
    
    const equalWeight = Math.floor(100 / activeEnvs.length / 5) * 5;
    const newWeights: Record<string, number> = {};
    
    let total = 0;
    for (let i = 0; i < activeEnvs.length; i++) {
       const w = i === activeEnvs.length - 1 ? 100 - total : equalWeight;
       newWeights[activeEnvs[i].id] = w;
       total += w;
       await updateEnvironment({ id: activeEnvs[i].id, target_weight: w });
    }
    
    setLocalWeights(newWeights);
    showSuccess("Spatial budget equalized across all zones.");
  };

  const handleAutoBalance = async (mode: 'volume' | 'count') => {
    if (retiredTasks.length === 0) return showError("Aether Sink is empty.");
    
    let totalValue = 0;
    const envValues = new Map<string, number>();

    retiredTasks.forEach(task => {
      const env = task.task_environment || 'laptop';
      const val = mode === 'volume' ? (task.duration || 30) : 1;
      envValues.set(env, (envValues.get(env) || 0) + val);
      totalValue += val;
    });

    const newWeights: Record<string, number> = { ...localWeights };
    for (const env of environments) {
      if (lockedIds.has(env.id)) continue;
      const sinkVal = envValues.get(env.value) || 0;
      const rawWeight = (sinkVal / totalValue) * 100;
      const snappedWeight = Math.round(rawWeight / 5) * 5;
      newWeights[env.id] = snappedWeight;
      await updateEnvironment({ id: env.id, target_weight: snappedWeight });
    }
    
    setLocalWeights(newWeights);
    showSuccess(`Budget re-aligned by ${mode}.`);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const currentOrder = profile?.custom_environment_order || environments.map(e => e.value);
    const oldIndex = currentOrder.indexOf(active.id as string);
    const newIndex = currentOrder.indexOf(over.id as string);
    if (oldIndex !== -1 && newIndex !== -1) {
      updateProfile({ custom_environment_order: arrayMove(currentOrder, oldIndex, newIndex) });
    }
  };

  const handleAddEnvironment = () => {
    if (!newEnvironment.label.trim()) return showError('Label required');
    addEnvironment({ ...newEnvironment, value: newEnvironment.label.toLowerCase().replace(/\s+/g, '_') });
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
    <div className="space-y-8 relative">
      {/* --- 1. STICKY DYNAMIC BUDGET HEADER --- */}
      <div className="sticky top-0 z-30 pt-4 pb-6 bg-background/80 backdrop-blur-xl -mx-4 px-4 border-b border-white/5">
        <Card className="p-4 bg-background/40 border-white/10 shadow-xl overflow-hidden relative">
          {/* Removed Gradient Overlay */}
          <div className="relative flex items-center justify-between mb-4">
             <div className="space-y-1">
               <h3 className="text-sm font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                 <Target className="h-4 w-4" /> Global Spatial Quota
               </h3>
               <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest opacity-60">Allocated: {totalAllocatedWeight}% / 100%</p>
             </div>
             
             <div className="flex gap-2">
               <Tooltip>
                 <TooltipTrigger asChild>
                   <Button variant="outline" size="sm" onClick={handleEqualizeAll} className="h-8 px-3 text-[10px] font-black uppercase tracking-widest gap-2 bg-background/50">
                     <Scale className="h-3 w-3" /> Equalize
                   </Button>
                 </TooltipTrigger>
                 <TooltipContent>Split budget evenly</TooltipContent>
               </Tooltip>

               <DropdownMenu>
                 <DropdownMenuTrigger asChild>
                   <Button variant="outline" size="sm" className="h-8 px-3 text-[10px] font-black uppercase tracking-widest gap-2 bg-primary/5 border-primary/20">
                     <RefreshCw className="h-3 w-3" /> Auto-Sync
                   </Button>
                 </DropdownMenuTrigger>
                 <DropdownMenuContent align="end" className="glass-card">
                   <DropdownMenuItem onClick={() => handleAutoBalance('volume')} className="text-[10px] font-bold uppercase gap-2"><Clock className="h-3 w-3" /> By Sink Volume</DropdownMenuItem>
                   <DropdownMenuItem onClick={() => handleAutoBalance('count')} className="text-[10px] font-bold uppercase gap-2"><Layers className="h-3 w-3" /> By Sink Count</DropdownMenuItem>
                 </DropdownMenuContent>
               </DropdownMenu>

               <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="aether" className="h-8 px-4 text-[10px] font-black uppercase tracking-widest shadow-md">
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

          <div className="relative h-6 w-full rounded-full bg-secondary/50 flex overflow-hidden shadow-inner border border-white/5 mb-1">
            {environments.map((env) => (
              <div 
                key={env.id}
                className="h-full transition-all duration-700 ease-aether-out relative group"
                style={{ width: `${localWeights[env.id] ?? 0}%`, backgroundColor: env.color }}
              >
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
            {totalAllocatedWeight < 100 && (
              <div className="h-full bg-muted-foreground/10 flex items-center justify-center transition-all duration-500" style={{ width: `${100 - totalAllocatedWeight}%` }}>
                <span className="text-[8px] font-black opacity-20 uppercase">Available: {100 - totalAllocatedWeight}%</span>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* --- 2. DYNAMIC ZONE CARDS --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {environments.map((env) => {
          const Icon = getLucideIconComponent(env.icon);
          const weight = localWeights[env.id] ?? 0;
          const predictedMinutes = Math.round(workdayDuration * (weight / 100));
          const actualSinkDuration = sinkStats.get(env.value)?.duration || 0;
          const capacityRatio = predictedMinutes > 0 ? (actualSinkDuration / predictedMinutes) * 100 : 0;
          const isOverBudgeted = actualSinkDuration < predictedMinutes * 0.5 && weight > 20;
          const isUnderBudgeted = actualSinkDuration > predictedMinutes && weight > 0;
          const isLocked = lockedIds.has(env.id);
          
          return (
            <Card key={env.id} className={cn(
              "relative group overflow-hidden border-white/5 bg-card/40 transition-all duration-500",
              weight === 0 && "opacity-40 grayscale blur-[0.5px] scale-[0.98] hover:opacity-100 hover:grayscale-0 hover:blur-0",
              isLocked && "ring-1 ring-primary/40 shadow-lg shadow-primary/5"
            )}>
              <div className="absolute left-0 top-0 bottom-0 w-1 transition-all duration-500" style={{ backgroundColor: env.color, width: isLocked ? '4px' : '2px' }} />
              
              <CardHeader className="pb-3 pt-4 px-6 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-background/50 shadow-inner" style={{ color: env.color }}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-black uppercase tracking-tight">{env.label}</span>
                    <div className="flex items-center gap-2">
                       {weight === 0 && <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Hibernating</span>}
                       {isLocked && <span className="text-[8px] font-black text-primary uppercase tracking-widest flex items-center gap-1"><Lock className="h-2 w-2" /> Locked</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className={cn("h-8 w-8 rounded-full transition-all", isLocked ? "text-primary bg-primary/10" : "text-muted-foreground/30 hover:text-primary")} onClick={() => toggleLock(env.id)}>
                        {isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{isLocked ? "Unlock Weight" : "Lock Weight"}</TooltipContent>
                  </Tooltip>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/40 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setDeleteTarget({ id: env.id, label: env.label })}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </CardHeader>
              
              <CardContent className="px-6 pb-5 space-y-5">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-black font-mono tracking-tighter" style={{ color: env.color }}>{weight}%</span>
                    
                    <div className={cn(
                      "flex items-center gap-2 px-2 py-1 rounded-md transition-colors",
                      isUnderBudgeted ? "bg-destructive/10 text-destructive border border-destructive/20" : "bg-primary/5 text-foreground border border-primary/10"
                    )}>
                      <Clock className="h-3 w-3" />
                      <span className="text-xs font-mono font-bold">~{predictedMinutes}m</span>
                    </div>
                  </div>

                  <div className="relative pt-1">
                    {/* UNDER-BUDGET DENSITY OVERLAY */}
                    {isUnderBudgeted && (
                      <div className="absolute -top-3 left-0 right-0 flex justify-center animate-bounce">
                         <Badge variant="destructive" className="h-4 text-[8px] px-1 font-black uppercase">Quota Deficit</Badge>
                      </div>
                    )}
                    
                    <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1.5 bg-secondary/50 rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full transition-all duration-1000",
                          capacityRatio >= 100 ? "bg-logo-green/40" : "bg-primary/20",
                          isUnderBudgeted && "bg-destructive/40"
                        )}
                        style={{ width: `${Math.min(100, capacityRatio)}%` }}
                      />
                    </div>
                    <Slider 
                      value={[weight]} 
                      onValueChange={([v]) => handleWeightUpdate(env.id, v)} 
                      max={100} 
                      step={5} 
                      disabled={isLocked}
                      className={cn("relative z-10 cursor-pointer", isLocked && "opacity-50 cursor-not-allowed")}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                   <div className="flex flex-col">
                      <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/40">Density Matrix</span>
                      <span className={cn("text-xs font-mono font-bold", isUnderBudgeted ? "text-destructive" : (capacityRatio > 80 ? "text-logo-green" : "text-logo-yellow"))}>
                        {actualSinkDuration}m Sink / {predictedMinutes}m Budget
                      </span>
                   </div>
                   <Badge variant="outline" className={cn("text-[8px] h-4 font-black uppercase px-1.5", weight > 0 ? "bg-logo-green/10 text-logo-green" : "opacity-30")}>
                      {weight > 0 ? "Active" : "Idle"}
                   </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* --- 4. BLUEPRINT INTERACTION --- */}
      <Card className="p-5 bg-secondary/5 border-primary/10 rounded-2xl">
         <CardHeader className="p-0 pb-4">
           <div className="flex items-center justify-between">
             <div className="space-y-1">
               <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-foreground/60 flex items-center gap-2">
                 <Layers className="h-4 w-4 text-primary" /> Sequence Blueprint
               </CardTitle>
               <p className="text-[10px] text-muted-foreground italic font-medium">Drag blocks to refine your Spatial Chain.</p>
             </div>
             <Tooltip>
               <TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground/30" /></TooltipTrigger>
               <TooltipContent className="max-w-[200px] text-[10px]">The Engine processes zones in this order. If Macro-Spread is ON, the chain repeats twice daily.</TooltipContent>
             </Tooltip>
           </div>
         </CardHeader>
         
         <CardContent className="p-0 space-y-4">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <div className={cn(
                "flex items-center gap-2 w-full h-14 px-2 rounded-xl bg-background/50 border border-white/5 overflow-hidden transition-all",
                profile?.enable_macro_spread && "h-24 flex-wrap content-center"
              )}>
                <SortableContext items={sortedEnvsByOrder.map(e => e.value)} strategy={horizontalListSortingStrategy}>
                   {sortedEnvsByOrder.filter(e => (localWeights[e.id] || 0) > 0).map((env) => (
                     <SortableBlueprintBlock key={env.id} env={env} weight={profile?.enable_macro_spread ? (localWeights[env.id] || 0) / 2 : (localWeights[env.id] || 0)} />
                   ))}
                   {profile?.enable_macro_spread && (
                      <div className="w-full flex items-center gap-1 h-2 opacity-20 py-1"><div className="h-px flex-1 bg-white" /> <span className="text-[8px] uppercase font-black">Macro Split</span> <div className="h-px flex-1 bg-white" /></div>
                   )}
                   {profile?.enable_macro_spread && sortedEnvsByOrder.filter(e => (localWeights[e.id] || 0) > 0).map((env) => (
                     <div key={`split-${env.id}`} className="h-8 rounded-md border border-dashed opacity-50 flex items-center justify-center" style={{ width: `${(localWeights[env.id] || 0) / 2}%`, backgroundColor: `${env.color}20`, borderColor: env.color }}>
                        <span className="text-[7px] font-black uppercase text-foreground/40">{env.label}</span>
                     </div>
                   ))}
                </SortableContext>
              </div>
            </DndContext>
            <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest text-muted-foreground/30 px-1">
               <span>Morning Launch</span>
               <span>Evening Descent</span>
            </div>
         </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dismantle Zone?</AlertDialogTitle>
            <AlertDialogDescription>Remove spatial quota for "{deleteTarget?.label}"? This zone's weight will be redistributed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if(deleteTarget) deleteEnvironment(deleteTarget.id); setDeleteTarget(null); }} className="bg-destructive hover:bg-destructive/90">Dismantle</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EnvironmentManager;