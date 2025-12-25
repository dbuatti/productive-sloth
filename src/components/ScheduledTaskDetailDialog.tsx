import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, parseISO, setHours, setMinutes, isBefore, addDays } from "date-fns";
import { X, Save, Loader2, Zap, Lock, Unlock, Home, Laptop, Globe, Music } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { DBScheduledTask, TaskEnvironment } from "@/types/scheduler";
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import { showSuccess, showError } from "@/utils/toast";
import { Switch } from '@/components/ui/switch';
import { calculateEnergyCost, setTimeOnDate } from '@/lib/scheduler-utils';
import { environmentOptions } from '@/hooks/use-environment-context';

const formSchema = z.object({
  name: z.string().min(1, { message: "Name is required." }).max(255),
  start_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
  end_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
  break_duration: z.coerce.number().min(0).optional().nullable(),
  is_critical: z.boolean().default(false),
  is_flexible: z.boolean().default(true),
  is_locked: z.boolean().default(false),
  energy_cost: z.coerce.number().min(0).default(0),
  is_custom_energy_cost: z.boolean().default(false),
  task_environment: z.enum(['home', 'laptop', 'away', 'piano', 'laptop_piano']).default('laptop'),
});

type ScheduledTaskDetailFormValues = z.infer<typeof formSchema>;

interface ScheduledTaskDetailDialogProps {
  task: DBScheduledTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDayString: string;
}

const ScheduledTaskDetailDialog: React.FC<ScheduledTaskDetailDialogProps> = ({ 
  task,
  open,
  onOpenChange,
  selectedDayString,
}) => {
  const { updateScheduledTaskDetails } = useSchedulerTasks(selectedDayString, null);
  // ... rest of the component logic
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto p-6 animate-pop-in">
        {/* ... content ... */}
      </DialogContent>
    </Dialog>
  );
};

export default ScheduledTaskDetailDialog;