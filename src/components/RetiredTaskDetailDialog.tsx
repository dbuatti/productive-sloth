import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, parseISO } from "date-fns";
import { X, Save, Loader2, Zap, Lock, Unlock, Home, Laptop, Globe, Music } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { Switch } from '@/components/ui/switch';
import { RetiredTask, TaskEnvironment } from "@/types/scheduler";
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import { showSuccess, showError } from "@/utils/toast";
import { calculateEnergyCost } from '@/lib/scheduler-utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { environmentOptions } from '@/hooks/use-environment-context';

const formSchema = z.object({
  name: z.string().min(1, { message: "Name is required." }).max(255),
  duration: z.coerce.number().min(1, "Duration must be at least 1 minute.").optional().nullable(),
  break_duration: z.coerce.number().min(0).optional().nullable(),
  is_critical: z.boolean().default(false),
  is_backburner: z.boolean().default(false),
  is_locked: z.boolean().default(false),
  is_completed: z.boolean().default(false),
  energy_cost: z.coerce.number().min(0).default(0),
  is_custom_energy_cost: z.boolean().default(false),
  task_environment: z.enum(['home', 'laptop', 'away', 'piano', 'laptop_piano']).default('laptop'),
});

type RetiredTaskDetailFormValues = z.infer<typeof formSchema>;

interface RetiredTaskDetailSheetProps {
  task: RetiredTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const RetiredTaskDetailDialog: React.FC<RetiredTaskDetailSheetProps> = ({
  task,
  open,
  onOpenChange,
}) => {
  const { updateRetiredTaskDetails, completeRetiredTask, updateRetiredTaskStatus } = useSchedulerTasks('', null);
  // ... rest of the component logic
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-80 flex flex-col p-6 space-y-6 animate-slide-in-right">
        {/* ... content ... */}
      </SheetContent>
    </Sheet>
  );
};

export default RetiredTaskDetailDialog;