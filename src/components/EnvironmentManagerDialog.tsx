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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useUserEnvironments, UserEnvironment, NewUserEnvironment } from '@/hooks/use-user-environments';
import { Loader2, Plus, Edit, Trash2, X, LayoutDashboard, ChevronUp, ChevronDown } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getLucideIcon, availableIconNames } from '@/lib/icons'; // Import icon utilities

const environmentSchema = z.object({
  name: z.string().min(1, "Name is required.").max(50, "Name cannot exceed 50 characters."),
  icon_name: z.string().min(1, "Icon is required."),
});

type EnvironmentFormValues = z.infer<typeof environmentSchema>;

interface EnvironmentManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EnvironmentManagerDialog: React.FC<EnvironmentManagerDialogProps> = ({ open, onOpenChange }) => {
  const { environments, isLoading, addEnvironment, updateEnvironment, deleteEnvironment, updateEnvironmentOrder } = useUserEnvironments();
  const [editingEnvironment, setEditingEnvironment] = useState<UserEnvironment | null>(null);

  const form = useForm<EnvironmentFormValues>({
    resolver: zodResolver(environmentSchema),
    defaultValues: {
      name: '',
      icon_name: 'Laptop', // Default icon
    },
    mode: 'onChange',
  });

  useEffect(() => {
    if (editingEnvironment) {
      form.reset({
        name: editingEnvironment.name,
        icon_name: editingEnvironment.icon_name,
      });
    } else {
      form.reset({
        name: '',
        icon_name: 'Laptop',
      });
    }
  }, [editingEnvironment, form]);

  const onSubmit = (values: EnvironmentFormValues) => {
    if (editingEnvironment) {
      updateEnvironment({
        id: editingEnvironment.id,
        name: values.name,
        icon_name: values.icon_name,
      });
      setEditingEnvironment(null);
    } else {
      addEnvironment(values as NewUserEnvironment);
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) {
      deleteEnvironment(id);
    }
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...environments];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;

    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    updateEnvironmentOrder(newOrder);
  };

  const isSubmitting = form.formState.isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6 text-primary" /> Manage Environments
          </DialogTitle>
          <DialogDescription>
            Define and order the environments where you perform your tasks.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-grow overflow-hidden py-4 space-y-4">
          <h3 className="text-lg font-semibold">Your Environments ({environments.length})</h3>
          <ScrollArea className="h-48 border rounded-md p-2">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : environments.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No environments defined yet. Default ones will be added automatically.</p>
            ) : (
              <div className="space-y-2">
                {environments.map((env, index) => {
                  const Icon = getLucideIcon(env.icon_name);
                  return (
                    <div key={env.id} className="flex items-center justify-between p-2 bg-secondary/50 rounded-md">
                      <div className="flex items-center gap-2">
                        {Icon && <Icon className="h-4 w-4 text-primary" />}
                        <span className="font-medium">{env.name}</span>
                      </div>
                      <div className="flex gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleMove(index, 'up')}
                              disabled={index === 0}
                              className="h-8 w-8 text-muted-foreground hover:bg-primary/10"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Move Up</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleMove(index, 'down')}
                              disabled={index === environments.length - 1}
                              className="h-8 w-8 text-muted-foreground hover:bg-primary/10"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Move Down</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => setEditingEnvironment(env)}
                              className="h-8 w-8 text-primary hover:bg-primary/10"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleDelete(env.id, env.name)}
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          <h3 className="text-lg font-semibold mt-6">{editingEnvironment ? `Edit: ${editingEnvironment.name}` : 'Add New Environment'}</h3>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Environment Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Home Office, Gym, Library" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="icon_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Icon</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an icon" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-60 overflow-y-auto">
                        {availableIconNames.sort().map(iconName => {
                          const Icon = getLucideIcon(iconName);
                          return Icon ? (
                            <SelectItem key={iconName} value={iconName}>
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4" /> {iconName}
                              </div>
                            </SelectItem>
                          ) : null;
                        })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="pt-4">
                {editingEnvironment && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setEditingEnvironment(null)}
                    className="flex items-center gap-2"
                  >
                    <X className="h-4 w-4" /> Cancel Edit
                  </Button>
                )}
                <Button type="submit" disabled={isSubmitting} className="flex items-center gap-2">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingEnvironment ? <Edit className="h-4 w-4" /> : <Plus className="h-4 w-4" />)}
                  {editingEnvironment ? 'Save Changes' : 'Add Environment'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EnvironmentManagerDialog;