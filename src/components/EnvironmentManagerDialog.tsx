import React, { useEffect, useState, useMemo } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Edit, Trash2, X, Home, Laptop, Globe, Music, Icon as LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEnvironmentContext, lucideIconMap, EnvironmentOption } from '@/hooks/use-environment-context';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { UserEnvironment } from '@/types/scheduler';

// Schema for environment form
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
  const { 
    environmentOptions, 
    isLoadingEnvironments, 
    addEnvironment, 
    updateEnvironment, 
    deleteEnvironment 
  } = useEnvironmentContext();
  
  const [editingEnvironment, setEditingEnvironment] = useState<UserEnvironment | null>(null);

  // Filter for only custom environments
  const customEnvironments = useMemo(() => {
    return environmentOptions.filter(opt => opt.isCustom).map(opt => {
      // Find the original UserEnvironment object to get the ID
      const originalEnv = (environmentOptions as (EnvironmentOption & UserEnvironment)[]).find(e => e.value === opt.value && e.isCustom);
      return {
        id: originalEnv?.id || '', // Fallback for safety, though it should exist
        user_id: originalEnv?.user_id || '',
        name: opt.value, // The value is the name for custom environments
        icon_name: originalEnv?.iconName || 'Laptop', // Use iconName
        order_index: originalEnv?.order_index || 0,
        created_at: originalEnv?.created_at || new Date().toISOString(),
      } as UserEnvironment;
    });
  }, [environmentOptions]);

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

  const onSubmit = async (values: EnvironmentFormValues) => {
    if (editingEnvironment) {
      await updateEnvironment(editingEnvironment.id, {
        name: values.name,
        icon_name: values.icon_name,
      });
      setEditingEnvironment(null);
    } else {
      await addEnvironment({
        name: values.name,
        icon_name: values.icon_name,
        order_index: customEnvironments.length, // Add to the end
      });
    }
    form.reset();
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete the environment "${name}"? This cannot be undone.`)) {
      await deleteEnvironment(id);
      if (editingEnvironment?.id === id) {
        setEditingEnvironment(null);
      }
    }
  };

  const isSubmitting = form.formState.isSubmitting;

  // Get a list of all available Lucide icons (for the select dropdown)
  const availableIcons = Object.keys(lucideIconMap).sort();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-6 w-6 text-primary" /> Manage Environments
          </DialogTitle>
          <DialogDescription>
            Add, edit, or remove custom environments for your tasks.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-grow overflow-hidden py-4 space-y-4">
          <h3 className="text-lg font-semibold">Your Custom Environments ({customEnvironments.length})</h3>
          <ScrollArea className="h-48 border rounded-md p-2">
            {isLoadingEnvironments ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : customEnvironments.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No custom environments defined yet.</p>
            ) : (
              <div className="space-y-2">
                {customEnvironments.map(env => {
                  const IconComponent = lucideIconMap[env.icon_name] || Home;
                  return (
                    <div key={env.id} className="flex items-center justify-between p-2 bg-secondary/50 rounded-md">
                      <div className="flex items-center gap-2">
                        <IconComponent className="h-5 w-5 text-primary" />
                        <span className="font-medium">{env.name}</span>
                      </div>
                      <div className="flex gap-1">
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

          <h3 className="text-lg font-semibold mt-6">{editingEnvironment ? `Edit Environment: ${editingEnvironment.name}` : 'Add New Environment'}</h3>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Environment Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Gym, Library" {...field} />
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
                        {availableIcons.map(iconName => {
                          const IconComponent = lucideIconMap[iconName] || Home;
                          return (
                            <SelectItem key={iconName} value={iconName}>
                              <div className="flex items-center gap-2">
                                <IconComponent className="h-4 w-4" />
                                {iconName}
                              </div>
                            </SelectItem>
                          );
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