"use client";

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Home, 
  Laptop, 
  Globe, 
  Music, 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X,
  Star,
  Target,
  Loader2 // ADDED
} from 'lucide-react';
import { useEnvironments } from '@/hooks/use-environments';
import { showError, showSuccess } from '@/utils/toast';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
} from '@/components/ui/alert-dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { cn, getLucideIconComponent } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';

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
  const { environments, isLoading, addEnvironment, updateEnvironment, deleteEnvironment } = useEnvironments();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newEnvironment, setNewEnvironment] = useState({
    label: '',
    icon: 'Home',
    color: '#FF6B6B',
    drain_multiplier: 1.0,
    target_weight: 0,
  });
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);

  const totalAllocatedWeight = useMemo(() => {
    return environments.reduce((sum, env) => sum + (env.target_weight || 0), 0);
  }, [environments]);

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

  const handleUpdateEnvironment = (id: string) => {
    const env = environments.find(e => e.id === id);
    if (!env) return;
    
    const otherWeight = totalAllocatedWeight - env.target_weight;
    if (otherWeight + newEnvironment.target_weight > 100) return showError('Total spatial budget cannot exceed 100%');
    
    updateEnvironment({
      id,
      label: newEnvironment.label,
      value: newEnvironment.label.toLowerCase().replace(/\s+/g, '_'),
      icon: newEnvironment.icon,
      color: newEnvironment.color,
      drain_multiplier: newEnvironment.drain_multiplier,
      target_weight: newEnvironment.target_weight,
    });
    
    setEditingId(null);
    showSuccess(`${newEnvironment.label} updated.`);
  };

  const startEditing = (env: any) => {
    setEditingId(env.id);
    setNewEnvironment({
      label: env.label,
      icon: env.icon,
      color: env.color,
      drain_multiplier: env.drain_multiplier,
      target_weight: env.target_weight || 0,
    });
  };

  if (isLoading) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading environments...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-bold">Spatial Zones</h3>
          <p className="text-xs text-muted-foreground">Manage your physical environments and time budgets.</p>
        </div>
        
        <div className="flex items-center gap-4">
           <div className={cn(
             "px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-inner",
             totalAllocatedWeight > 100 ? "bg-destructive/10 border-destructive text-destructive" : "bg-primary/5 border-primary/20 text-primary"
           )}>
             <Target className="h-3 w-3" />
             Budget: {totalAllocatedWeight}% / 100%
           </div>

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-full shadow-md">
                <Plus className="h-4 w-4 mr-2" />
                Add Zone
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md animate-pop-in">
              <DialogHeader>
                <DialogTitle>Define New Zone</DialogTitle>
              </DialogHeader>
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
                      <SelectContent>
                        {iconOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Color</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {colorOptions.map(c => (
                        <button key={c.value} className={cn("h-6 w-6 rounded-full border-2 transition-all", newEnvironment.color === c.value ? "border-foreground scale-110 shadow-md" : "border-transparent")} style={{ backgroundColor: c.value }} onClick={() => setNewEnvironment({...newEnvironment, color: c.value})} />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="flex items-center gap-2">Time Budget <span className="text-primary font-bold">{newEnvironment.target_weight}%</span></Label>
                  </div>
                  <Slider value={[newEnvironment.target_weight]} onValueChange={([v]) => setNewEnvironment({...newEnvironment, target_weight: v})} max={100} step={5} />
                  <p className="text-[10px] text-muted-foreground italic">Fractions of free time allocated to this environment during auto-balance.</p>
                </div>

                <Button onClick={handleAddEnvironment} className="w-full">Create Zone</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {environments.map((env) => {
          const Icon = getLucideIconComponent(env.icon);
          const isEditing = editingId === env.id;
          
          return (
            <Card key={env.id} className={cn("relative overflow-hidden transition-all", isEditing ? "ring-2 ring-primary border-primary" : "hover:shadow-md")}>
              <div className="absolute top-0 right-0 p-3 flex gap-1">
                 {!isEditing && (
                    <>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary/60 hover:text-primary hover:bg-primary/5" onClick={() => startEditing(env)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/40 hover:text-destructive hover:bg-destructive/5" onClick={() => setDeleteTarget({ id: env.id, label: env.label })}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                 )}
              </div>

              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3 text-lg font-black uppercase tracking-tight">
                  <div className="p-2 rounded-xl shadow-inner bg-background/50" style={{ color: env.color }}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <span>{env.label}</span>
                </CardTitle>
              </CardHeader>
              
              <CardContent className="space-y-6">
                {isEditing ? (
                  <div className="space-y-6 animate-pop-in">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest opacity-50">Zone Identity</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Input value={newEnvironment.label} onChange={(e) => setNewEnvironment({...newEnvironment, label: e.target.value})} className="h-9 font-bold" />
                        <Select value={newEnvironment.icon} onValueChange={(v) => setNewEnvironment({...newEnvironment, icon: v})}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {iconOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <Label className="text-[10px] font-black uppercase tracking-widest opacity-50">Spatial Quota</Label>
                        <span className="text-sm font-black text-primary">{newEnvironment.target_weight}%</span>
                      </div>
                      <Slider value={[newEnvironment.target_weight]} onValueChange={([v]) => setNewEnvironment({...newEnvironment, target_weight: v})} max={100} step={5} className="py-2" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest opacity-50">Drain Rate</Label>
                          <Input type="number" step="0.1" value={newEnvironment.drain_multiplier} onChange={(e) => setNewEnvironment({...newEnvironment, drain_multiplier: parseFloat(e.target.value) || 1.0})} className="h-9 font-mono" />
                        </div>
                        <div className="flex items-end gap-2">
                          <Button size="sm" onClick={() => handleUpdateEnvironment(env.id)} className="flex-1"><Save className="h-4 w-4 mr-1" /> Save</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="h-9 w-9 p-0"><X className="h-4 w-4" /></Button>
                        </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">
                      <span>Budget Allocation</span>
                      <span className="text-foreground">{env.target_weight || 0}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-secondary overflow-hidden shadow-inner">
                      <div className="h-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(0,0,0,0.1)]" style={{ width: `${env.target_weight || 0}%`, backgroundColor: env.color }} />
                    </div>
                    
                    <div className="flex items-center gap-6 pt-2 border-t border-white/5">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">Drain Index</span>
                        <span className="text-sm font-mono font-bold text-logo-yellow">{env.drain_multiplier}x</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">Status</span>
                        <span className={cn("text-[10px] font-black uppercase", (env.target_weight || 0) > 0 ? "text-logo-green" : "text-muted-foreground/40")}>
                          {(env.target_weight || 0) > 0 ? "Active Load" : "Idle Zone"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

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