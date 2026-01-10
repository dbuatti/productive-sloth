import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  Briefcase, // Added
  Coffee,    // Added
  Info,      // Added
  Zap        // Added
} from 'lucide-react';
import { useEnvironments } from '@/hooks/use-environments';
import { showError } from '@/utils/toast';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
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
import { Switch } from '@/components/ui/switch';
import { useEnvironmentContext } from '@/hooks/use-environment-context'; // Import useEnvironmentContext

const iconOptions = [
  { value: 'Home', label: 'Home', icon: Home },
  { value: 'Laptop', label: 'Laptop', icon: Laptop },
  { value: 'Globe', label: 'Globe', icon: Globe },
  { value: 'Music', label: 'Music', icon: Music },
  { value: 'Briefcase', label: 'Briefcase', icon: Briefcase }, // Added Briefcase
  { value: 'Coffee', label: 'Coffee', icon: Coffee }, // Added Coffee
  { value: 'Star', label: 'Star', icon: Star }, // Added Star
  { value: 'Info', label: 'Info', icon: Info }, // Added Info
  { value: 'Zap', label: 'Zap', icon: Zap }, // Added Zap
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
  const { allUserEnvironments, isLoadingEnvironments } = useEnvironmentContext(); // Use dynamic environments
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newEnvironment, setNewEnvironment] = useState({
    label: '',
    icon: 'Home',
    color: '#FF6B6B',
    drain_multiplier: 1.0,
  });
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);

  const handleAddEnvironment = () => {
    if (!newEnvironment.label.trim()) {
      showError('Environment label is required');
      return;
    }
    
    addEnvironment({
      ...newEnvironment,
      value: newEnvironment.label.toLowerCase().replace(/\s+/g, '_'),
    });
    
    setNewEnvironment({
      label: '',
      icon: 'Home',
      color: '#FF6B6B',
      drain_multiplier: 1.0,
    });
    setIsAddDialogOpen(false);
  };

  const handleUpdateEnvironment = (id: string) => {
    const env = environments.find(e => e.id === id);
    if (!env) return;
    
    if (!newEnvironment.label.trim()) {
      showError('Environment label is required');
      return;
    }
    
    updateEnvironment({
      id,
      label: newEnvironment.label,
      value: newEnvironment.label.toLowerCase().replace(/\s+/g, '_'),
      icon: newEnvironment.icon,
      color: newEnvironment.color,
      drain_multiplier: newEnvironment.drain_multiplier,
    });
    
    setEditingId(null);
    setNewEnvironment({
      label: '',
      icon: 'Home',
      color: '#FF6B6B',
      drain_multiplier: 1.0,
    });
  };

  const startEditing = (env: any) => {
    setEditingId(env.id);
    setNewEnvironment({
      label: env.label,
      icon: env.icon,
      color: env.color,
      drain_multiplier: env.drain_multiplier,
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setNewEnvironment({
      label: '',
      icon: 'Home',
      color: '#FF6B6B',
      drain_multiplier: 1.0,
    });
  };

  const handleDeleteEnvironment = (id: string, label: string) => {
    setDeleteTarget({ id, label });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    
    deleteEnvironment(deleteTarget.id);
    setDeleteTarget(null);
  };

  const IconComponent = getLucideIconComponent;

  if (isLoading) {
    return <div>Loading environments...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Your Environments</h3>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button aria-label="Add New Environment">
              <Plus className="h-4 w-4 mr-2" />
              Add Environment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Environment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="label">Label</Label>
                <Input
                  id="label"
                  value={newEnvironment.label}
                  onChange={(e) => setNewEnvironment({...newEnvironment, label: e.target.value})}
                  placeholder="e.g., Coffee Shop"
                  aria-label="Environment Label"
                />
              </div>
              <div>
                <Label htmlFor="icon">Icon</Label>
                <Select 
                  value={newEnvironment.icon} 
                  onValueChange={(value) => setNewEnvironment({...newEnvironment, icon: value})}
                  aria-label="Environment Icon"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select icon" />
                  </SelectTrigger>
                  <SelectContent>
                    {iconOptions.map((icon) => {
                      const IconComponent = icon.icon;
                      return (
                        <SelectItem key={icon.value} value={icon.value}>
                          <div className="flex items-center gap-2">
                            <IconComponent className="h-4 w-4" />
                            {icon.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="color">Color</Label>
                <div className="flex gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color.value}
                      className={`h-8 w-8 rounded-full ${newEnvironment.color === color.value ? 'ring-2 ring-primary' : ''}`}
                      style={{ backgroundColor: color.value }}
                      onClick={() => setNewEnvironment({...newEnvironment, color: color.value})}
                      aria-label={color.label}
                    />
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="drain">Energy Drain Multiplier</Label>
                <Input
                  id="drain"
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="3"
                  value={newEnvironment.drain_multiplier}
                  onChange={(e) => setNewEnvironment({...newEnvironment, drain_multiplier: parseFloat(e.target.value) || 1.0})}
                  aria-label="Energy Drain Multiplier"
                />
              </div>
              <Button onClick={handleAddEnvironment} aria-label="Add Environment">Add Environment</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {environments.map((env) => {
          const CurrentIconComponent = IconComponent(env.icon);
          const isEditing = editingId === env.id;
          
          return (
            <Card key={env.id} className="relative p-4">
              <CardHeader className="flex-row items-center justify-between space-y-0 p-0 mb-4">
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                  <CurrentIconComponent className="h-6 w-6" style={{ color: env.color }} />
                  <span>{env.label}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-0">
                {isEditing ? (
                  <>
                    <div>
                      <Label>Label</Label>
                      <Input
                        value={newEnvironment.label}
                        onChange={(e) => setNewEnvironment({...newEnvironment, label: e.target.value})}
                        aria-label={`Edit Label for ${env.label}`}
                      />
                    </div>
                    <div>
                      <Label>Icon</Label>
                      <Select 
                        value={newEnvironment.icon} 
                        onValueChange={(value) => setNewEnvironment({...newEnvironment, icon: value})}
                        aria-label={`Edit Icon for ${env.label}`}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select icon" />
                        </SelectTrigger>
                        <SelectContent>
                          {iconOptions.map((icon) => {
                            const IconComponent = icon.icon;
                            return (
                              <SelectItem key={icon.value} value={icon.value}>
                                <div className="flex items-center gap-2">
                                  <IconComponent className="h-4 w-4" />
                                  {icon.label}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Color</Label>
                      <div className="flex gap-2">
                        {colorOptions.map((color) => (
                          <button
                            key={color.value}
                            className={`h-6 w-6 rounded-full ${newEnvironment.color === color.value ? 'ring-2 ring-primary' : ''}`}
                            style={{ backgroundColor: color.value }}
                            onClick={() => setNewEnvironment({...newEnvironment, color: color.value})}
                            aria-label={`Select ${color.label} color for ${env.label}`}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label>Drain Multiplier</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="3"
                        value={newEnvironment.drain_multiplier}
                        onChange={(e) => setNewEnvironment({...newEnvironment, drain_multiplier: parseFloat(e.target.value) || 1.0})}
                        aria-label={`Edit Drain Multiplier for ${env.label}`}
                      />
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button size="sm" onClick={() => handleUpdateEnvironment(env.id)} aria-label={`Save changes for ${env.label}`}>
                        <Save className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                      <Button variant="outline" size="sm" onClick={cancelEditing} aria-label={`Cancel editing ${env.label}`}>
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col space-y-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground/80">Value:</span>
                        <code className="bg-muted px-2 py-0.5 rounded text-xs">{env.value}</code>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground/80">Drain:</span>
                        <span>{env.drain_multiplier}x</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground/80">Color:</span>
                        <div 
                          className="h-4 w-4 rounded-full border border-border" 
                          style={{ backgroundColor: env.color }}
                        />
                        <span className="text-xs">{env.color}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button 
                        variant="outline"
                        size="sm" 
                        onClick={() => startEditing(env)}
                        className="flex items-center gap-1 text-primary hover:bg-primary/10"
                        aria-label={`Edit ${env.label}`}
                      >
                        <Edit className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={() => handleDeleteEnvironment(env.id, env.label)}
                        type="button"
                        className="flex items-center gap-1"
                        aria-label={`Delete ${env.label}`}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Environment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the environment "{deleteTarget?.label}"? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EnvironmentManager;