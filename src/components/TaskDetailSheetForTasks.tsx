import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { X, Save, Loader2, Zap, Sparkles, BatteryCharging } from "lucide-react";

import {
// ... (rest of imports)

// ... (formSchema definition)

type TaskDetailFormValues = z.infer<typeof formSchema>;

interface TaskDetailSheetProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TaskDetailSheet: React.FC<TaskDetailSheetProps> = ({
  task,
  open,
  onOpenChange,
}) => {
  const { updateTask } = useTasks();
  const { profile } = useSession();
  const [calculatedEnergyCost, setCalculatedEnergyCost] = useState(0); // NEW: State for calculated energy cost

  const form = useForm<TaskDetailFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "MEDIUM",
      dueDate: new Date(),
      isCritical: false,
      isBackburner: false, // NEW: Default to false
      energy_cost: 0, // Will be set by useEffect
      is_custom_energy_cost: false, // Will be set by useEffect
    },
  });

  useEffect(() => {
    if (task) {
      form.reset({
        title: task.title,
        description: task.description || "",
        priority: task.priority,
        dueDate: task.due_date ? new Date(task.due_date) : new Date(), 
        isCritical: task.is_critical,
        isBackburner: task.is_backburner, // FIX 8: Now valid if Task type is updated
        energy_cost: task.energy_cost, // NEW: Set initial energy cost
        is_custom_energy_cost: task.is_custom_energy_cost, // NEW: Set initial custom energy cost flag
      });
      // NEW: Set initial calculated cost, but only if not custom
      if (!task.is_custom_energy_cost) {
        setCalculatedEnergyCost(calculateEnergyCost(DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION, task.is_critical, task.is_backburner)); // FIX 9: Now valid if Task type is updated
      } else {
        setCalculatedEnergyCost(task.energy_cost); // If custom, display the custom value
      }
    }
  }, [task, form]);

  // NEW: Effect to recalculate energy cost when isCritical or isBackburner changes
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      // Only recalculate if custom energy cost is NOT enabled
      if (!value.is_custom_energy_cost && (name === 'isCritical' || name === 'isBackburner')) {
        const newEnergyCost = calculateEnergyCost(
          DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION, 
          value.isCritical ?? false,
          value.isBackburner ?? false // NEW: Pass backburner status
        );
        setCalculatedEnergyCost(newEnergyCost);
        form.setValue('energy_cost', newEnergyCost, { shouldValidate: true });
      } else if (name === 'is_custom_energy_cost' && !value.is_custom_energy_cost) {
        // If custom energy cost is turned OFF, immediately recalculate and set
        const isCritical = form.getValues('isCritical');
        const isBackburner = form.getValues('isBackburner'); // NEW: Get backburner status
        const newEnergyCost = calculateEnergyCost(
          DEFAULT_TASK_DURATION_FOR_ENERGY_CALCULATION, 
          isCritical ?? false,
          isBackburner ?? false // NEW: Pass backburner status
        );
        setCalculatedEnergyCost(newEnergyCost);
        form.setValue('energy_cost', newEnergyCost, { shouldValidate: true });
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);


  const handleSubmit = async (values: TaskDetailFormValues) => {
    if (!task) return;

    const descriptionValue = values.description?.trim() === '' ? null : values.description;

    try {
      await updateTask({
        id: task.id,
        title: values.title,
        description: descriptionValue,
        priority: values.priority,
        due_date: values.dueDate.toISOString(),
        is_critical: values.isCritical,
        is_backburner: values.isBackburner, // FIX 10: Now valid if Task type is updated
        energy_cost: values.is_custom_energy_cost ? values.energy_cost : calculatedEnergyCost, // NEW: Use custom or calculated
        is_custom_energy_cost: values.is_custom_energy_cost, // NEW: Pass custom energy cost flag
      });
      showSuccess("Task updated successfully!");
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save task:", error);
    }
  };

// ... (rest of file)