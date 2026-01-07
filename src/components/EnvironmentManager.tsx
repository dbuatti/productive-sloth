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
  Star // Added Star icon for default indicator
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
import { cn } from '@/lib/utils'; // Import cn for styling
import { Switch } from '@/components/ui/switch'; // Import Switch

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
    is_default: false, // Default for new environments is false
  });
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);

  const handleAddEnvironment = () => {
    if (!newEnvironment.label.trim()) {
      showError('Environment label is required');
      return;
    }
    
    addEnvironment({
      ...newEnvironment,
      value: newEnvironment.label.toLowerCase().replace(/\s+/g, '_'), // Generate value from label
    });
    
    setNewEnvironment({
      label: '',
      icon: 'Home',
      color: '#FF6B6B',
      drain_multiplier: 1.0,
      is_default: false,
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
      value: newEnvironment.label.toLowerCase().replace(/\s+/g, '_'), // Generate value from label
      icon: newEnvironment.icon,
      color: newEnvironment.color,
      drain_multiplier: newEnvironment.drain_multiplier,
      is_default: newEnvironment.is_default, // Include is_default in update
    });
    
    setEditingId(null);
    setNewEnvironment({
      label: '',
      icon: 'Home',
      color: '#FF6B6B',
      drain_multiplier: 1.0,
      is_default: false,
    });
  };

  const startEditing = (env: any) => {
    setEditingId(env.id);
    setNewEnvironment({
      label: env.label,
      icon: env.icon,
      color: env.color,
      drain_multiplier: env.drain_multiplier,
      is_default: env.is_default, // Load current is_default status
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setNewEnvironment({
      label: '',
      icon: 'Home',
      color: '#FF6B6B',
      drain_multiplier: 1.0,
      is_default: false,
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

  const getIconComponent = (iconName: string) => {
    const icon = iconOptions.find(opt => opt.value === iconName);
    return icon ? icon.icon : Home;
  };

  if (isLoading) {
    return <div>Loading environments...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Your Environments</h3>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
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
                />
              </div>
              <div>
                <Label htmlFor="icon">Icon</Label>
                <Select 
                  value={newEnvironment.icon} 
                  onValueChange={(value) => setNewEnvironment({...newEnvironment, icon: value})}
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
                />
              </div>
              <Button onClick={handleAddEnvironment}>Add Environment</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {environments.map((env) => {
          const IconComponent = getIconComponent(env.icon);
          const isEditing = editingId === env.id;
          
          return (
            <Card key={env.id} className="relative p-4">
              <CardHeader className="flex-row items-center justify-between space-y-0 p-0 mb-4">
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                  <IconComponent className="h-6 w-6" style={{ color: env.color }} />
                  <span>{env.label}</span>
                </CardTitle>
                {env.is_default && !isEditing && (
                  <Badge 
                    variant="default"
                    className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold uppercase tracking-tight flex items-center gap-1"
                  >
                    <Star className="h-3 w-3 fill-current" /> Default
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-3 p-0">
                {isEditing ? (
                  <>
                    <div>
                      <Label>Label</Label>
                      <Input
                        value={newEnvironment.label}
                        onChange={(e) => setNewEnvironment({...newEnvironment, label: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label>Icon</Label>
                      <Select 
                        value={newEnvironment.icon} 
                        onValueChange={(value) => setNewEnvironment({...newEnvironment, icon: value})}
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
                            aria-label={color.label}
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
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm bg-background/50">
                      <Label>Is Default?</Label>
                      <Switch
                        checked={newEnvironment.is_default}
                        onCheckedChange={(checked) => setNewEnvironment({...newEnvironment, is_default: checked})}
                      />
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button size="sm" onClick={() => handleUpdateEnvironment(env.id)}>
                        <Save className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                      <Button variant="outline" size="sm" onClick={cancelEditing}>
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
                      >
                        <Edit className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={() => handleDeleteEnvironment(env.id, env.label)}
                        disabled={env.is_default} // Disable delete if it's still a default
                        type="button"
                        className="flex items-center gap-1"
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