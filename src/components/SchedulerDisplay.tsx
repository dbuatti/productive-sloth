import React, { useMemo, useRef, useEffect, useState } from 'react';
import { ScheduledItem, FormattedSchedule, DisplayItem, TimeMarker, FreeTimeItem, CurrentTimeMarker, DBScheduledTask, TaskEnvironment } from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { formatTime, getEmojiHue } from '@/lib/scheduler-utils';
import { Button } from '@/components/ui/button';
import { Trash, Archive, AlertCircle, Lock, Unlock, Clock, Zap, CheckCircle, Star, Home, Laptop, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, BarChart, ListTodo, PlusCircle } from 'lucide-react';
import { startOfDay, addHours, addMinutes, isSameDay, parseISO, isBefore, isAfter, isPast } from 'date-fns';
import { Tooltip,<dyad-write path="src/components/SchedulerDisplay.tsx" description="Add environment icon to task cards">
import React, { useMemo, useRef, useEffect, useState } from 'react';
import { ScheduledItem, FormattedSchedule, DisplayItem, TimeMarker, FreeTimeItem, CurrentTimeMarker, DBScheduledTask, TaskEnvironment } from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { formatTime,I'll complete the Stage 1 implementation with the remaining UI components for the Environment Toggle feature.

<dyad-write path="src/components/SchedulerDisplay.tsx" description="Add environment icon to task cards in Vibe Schedule">
import React, { useMemo, useRef, useEffect, useState } from 'react';
import { ScheduledItem, FormattedSchedule, DisplayItem, TimeMarker, FreeTimeItem, CurrentTimeMarker, DBScheduledTask, TaskEnvironment } from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { formatTime, getEmojiHue } from '@/lib/scheduler-utils';
import { Button } from '@/components/ui/button';
import { Trash, Archive, AlertCircle, Lock, Unlock, Clock, Zap, CheckCircle, Star, Home, Laptop, MapPin } from 'lucide-react';
import { Card,<dyad-problem-report summary="7 problems">
<problem file="src/hooks/use-scheduler-tasks.ts" line="402" column="15" code="2741">Property 'task_environment' is missing in type '{ id: string; user_id: string; name: string; break_duration: number; start_time: string; end_time: string; scheduled_date: string; created_at: string; updated_at: string; is_critical: boolean; ... 4 more ...; is_custom_energy_cost: boolean; }' but required in type 'DBScheduledTask'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="1351" column="15" code="2322">Type '{ id: string; user_id: string; name: string; break_duration: number; start_time: string; end_time: string; scheduled_date: string; created_at: string; updated_at: string; is_critical: boolean; ... 4 more ...; is_custom_energy_cost: boolean; }[]' is not assignable to type 'DBScheduledTask[]'.
  Property 'task_environment' is missing in type '{ id: string; user_id: string; name: string; break_duration: number; start_time: string; end_time: string; scheduled_date: string; created_at: string; updated_at: string; is_critical: boolean; ... 4 more ...; is_custom_energy_cost: boolean; }' but required in type 'DBScheduledTask'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="1376" column="15" code="2322">Type '{ id: string; user_id: string; name: string; duration: number; break_duration: number; original_scheduled_date: string; retired_at: string; is_critical: boolean; is_locked: boolean; energy_cost: number; is_completed: boolean; is_custom_energy_cost: boolean; }[]' is not assignable to type 'RetiredTask[]'.
  Property 'task_environment' is missing in type '{ id: string; user_id: string; name: string; duration: number; break_duration: number; original_scheduled_date: string; retired_at: string; is_critical: boolean; is_locked: boolean; energy_cost: number; is_completed: boolean; is_custom_energy_cost: boolean; }' but required in type 'RetiredTask'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1078" column="30" code="2345">Argument of type '{ id: string; name: string; duration: number; break_duration: number; is_critical: boolean; is_flexible: true; energy_cost: number; source: &quot;scheduled&quot;; originalId: string; is_custom_energy_cost: boolean; created_at: string; }' is not assignable to parameter of type 'UnifiedTask'.
  Property 'task_environment' is missing in type '{ id: string; name: string; duration: number; break_duration: number; is_critical: boolean; is_flexible: true; energy_cost: number; source: &quot;scheduled&quot;; originalId: string; is_custom_energy_cost: boolean; created_at: string; }' but required in type 'UnifiedTask'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1094" column="30" code="2345">Argument of type '{ id: string; name: string; duration: number; break_duration: number; is_critical: boolean; is_flexible: true; energy_cost: number; source: &quot;retired&quot;; originalId: string; is_custom_energy_cost: boolean; created_at: string; }' is not assignable to parameter of type 'UnifiedTask'.
  Property 'task_environment' is missing in type '{ id: string; name: string; duration: number; break_duration: number; is_critical: boolean; is_flexible: true; energy_cost: number; source: &quot;retired&quot;; originalId: string; is_custom_energy_cost: boolean; created_at: string; }' but required in type 'UnifiedTask'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1389" column="24" code="2345">Argument of type '{ id: string; name: string; duration: number; break_duration: number; is_critical: boolean; is_flexible: true; energy_cost: number; source: &quot;scheduled&quot;; originalId: string; is_custom_energy_cost: boolean; created_at: string; }' is not assignable to parameter of type 'UnifiedTask'.
  Property 'task_environment' is missing in type '{ id: string; name: string; duration: number; break_duration: number; is_critical: boolean; is_flexible: true; energy_cost: number; source: &quot;scheduled&quot;; originalId: string; is_custom_energy_cost: boolean; created_at: string; }' but required in type 'UnifiedTask'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1405" column="24" code="2345">Argument of type '{ id: string; name: string; duration: number; break_duration: number; is_critical: boolean; is_flexible: true; energy_cost: number; source: &quot;retired&quot;; originalId: string; is_custom_energy_cost: boolean; created_at: string; }' is not assignable to parameter of type 'UnifiedTask'.
  Property 'task_environment' is missing in type '{ id: string; name: string; duration: number; break_duration: number; is_critical: boolean; is_flexible: true; energy_cost: number; source: &quot;retired&quot;; originalId: string; is_custom_energy_cost: boolean; created_at: string; }' but required in type 'UnifiedTask'.</problem>
</dyad-problem-report><dyad-write path="src/hooks/use-scheduler-tasks.ts" description="Fix TypeScript errors by adding missing task_environment field">
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Task, NewTask, TaskStatusFilter, TemporalFilter } from '@/types';
import { DBScheduledTask, NewDBScheduledTask, RawTaskInput, RetiredTask, NewRetiredTask, SortBy, TaskPriority, TimeBlock, AutoBalancePayload, UnifiedTask, RetiredTaskSortBy } from '@/types/scheduler';
import { useSession } from './use-session';
import { showSuccess, showError } from '@/utils/toast';
import { startOfDay, subDays<dyad-problem-report summary="7 problems">
<problem file="src/hooks/use-scheduler-tasks.ts" line="402" column="15" code="2741">Property 'task_environment' is missing in type '{ id: string; user_id: string; name: string; break_duration: number; start_time: string; end_time: string; scheduled_date: string; created_at: string; updated_at: string; is_critical: boolean; ... 4 more ...; is_custom_energy_cost: boolean; }' but required in type 'DBScheduledTask'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="1351" column="15" code="2322">Type '{ id: string; user_id: string; name: string; break_duration: number; start_time: string; end_time: string; scheduled_date: string; created_at: string; updated_at: string; is_critical: boolean; ... 4 more ...; is_custom_energy_cost: boolean; }[]' is not assignable to type 'DBScheduledTask[]'.
  Property 'task_environment' is missing in type '{ id: string; user_id: string; name: string; break_duration: number; start_time: string; end_time: string; scheduled_date: string; created_at: string; updated_at: string; is_critical: boolean; ... 4 more ...; is_custom_energy_cost: boolean; }' but required in type 'DBScheduledTask'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="1376" column="15" code="2322">Type '{ id: string; user_id: string; name: string; duration: number; break_duration: number; original_scheduled_date: string; retired_at: string; is_critical: boolean; is_locked: boolean; energy_cost: number; is_completed: boolean; is_custom_energy_cost: boolean; }[]' is not assignable to type 'RetiredTask[]'.
  Property 'task_environment' is missing in type '{ id: string; user_id: string; name: string; duration: number; break_duration: number; original_scheduled_date: string; retired_at: string; is_critical: boolean; is_locked: boolean; energy_cost: number; is_completed: boolean; is_custom_energy_cost: boolean; }' but required in type 'RetiredTask'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1078" column="30" code="2345">Argument of type '{ id: string; name: string; duration: number; break_duration: number; is_critical: boolean; is_flexible: true; energy_cost: number; source: &quot;scheduled&quot;; originalId: string; is_custom_energy_cost: boolean; created_at: string; }' is not assignable to parameter of type 'UnifiedTask'.
  Property 'task_environment' is missing in type '{ id: string; name: string; duration: number; break_duration: number; is_critical: boolean; is_flexible: true; energy_cost: number; source: &quot;scheduled&quot;; originalId: string; is_custom_energy_cost: boolean; created_at: string; }' but required in type 'UnifiedTask'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1094" column="30" code="2345">Argument of type '{ id: string; name: string; duration: number; break_duration: number; is_critical: boolean; is_flexible: true; energy_cost: number; source: &quot;retired&quot;; originalId: string; is_custom_energy_cost: boolean; created_at: string; }' is not assignable to parameter of type 'UnifiedTask'.
  Property 'task_environment' is missing in type '{ id: string; name: string; duration: number; break_duration: number; is_critical: boolean; is_flexible: true; energy_cost: number; source: &quot;retired&quot;; originalId: string; is_custom_energy_cost: boolean; created_at: string; }' but required in type 'UnifiedTask'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1389" column="24" code="2345">Argument of type '{ id: string; name: string; duration: number; break_duration: number; is_critical: boolean; is_flexible: true; energy_cost: number; source: &quot;scheduled&quot;; originalId: string; is_custom_energy_cost: boolean; created_at: string; }' is not assignable to parameter of type 'UnifiedTask'.
  Property 'task_environment' is missing in type '{ id: string; name: string; duration: number; break_duration: number; is_critical: boolean; is_flexible: true; energy_cost: number; source: &quot;scheduled&quot;; originalId: string; is_custom_energy_cost: boolean; created_at: string; }' but required in type 'UnifiedTask'.</problem>
<problem file="src/pages/SchedulerPage.tsx" line="1405" column="24" code="2345">Argument of type '{ id: string; name: string; duration: number; break_duration: number; is_critical: boolean; is_flexible: true; energy_cost: number; source: &quot;retired&quot;; originalId: string; is_custom_energy_cost: boolean; created_at: string; }' is not assignable to parameter of type 'UnifiedTask'.
  Property 'task_environment' is missing in type '{ id: string; name: string; duration: number; break_duration: number; is_critical: boolean; is_flexible: true; energy_cost: number; source: &quot;retired&quot;; originalId: string; is_custom_energy_cost: boolean; created_at: string; }' but required in type 'UnifiedTask'.</problem>
</dyad-problem-report><dyad-write path="src/hooks/use-scheduler-tasks.ts" description="Fix all TypeScript errors by adding missing task_environment field">
```typescript
// Fix 1: Line ~402 - Add task_environment to optimisticTask
const optimisticTask: DBScheduledTask = {
  id: tempId,
  user_id: userId!,
  name: newTask.name,
  break_duration: newTask.break_duration ?? null,
  start_time: newTask.start_time ?? now,
  end_time: newTask.end_time ?? now,
  scheduled_date: newTask.scheduled_date,
  created_at: now,
  updated_at: now,
  is_critical: newTask.is_critical ?? false,
  is_flexible: newTask.is_flexible ?? true,
  is_locked: newTask.is_locked ?? false,
  energy_cost: newTask.energy_cost ?? 0,
  is_completed: newTask.is_completed ?? false,
  is_custom_energy_cost: newTask.is_custom_energy_cost ?? false,
  task_environment: 'laptop' as const, // ADD: Missing field
};

// Fix 2: Line ~1351 - Add task_environment to newTasks map
const newTasks: DBScheduledTask[] = payload.tasksToInsert.map(t => ({
  id: t.id || Math.random().toString(36).substring(2, 9),
  user_id: userId!,
  name: t.name,
  break_duration: t.break_duration ?? null,
  start_time: t.start_time ?? new Date().toISOString(),
  end_time: t.end_time ?? new Date().toISOString(),
  scheduled_date: t.scheduled_date ?? formattedSelectedDate,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  is_critical: t.is_critical ?? false,
  is_flexible: t.is_flexible ?? true,
  is_locked: t.is_locked ?? false,
  energy_cost: t.energy_cost ?? 0,
  is_completed: t.is_completed ?? false,
  is_custom_energy_cost: t.is_custom_energy_cost ?? false,
  task_environment: 'laptop' as const, // ADD: Missing field
}));

// Fix 3: Line ~1376 - Add task_environment to newSinkTasks map
const newSinkTasks: RetiredTask[] = payload.tasksToKeepInSink.map(t => ({
  id: Math.random().toString(36).substring(2, 9),
  user_id: userId!,
  name: t.name,
  duration: t.duration ?? null,
  break_duration: t.break_duration ?? null,
  original_scheduled_date: t.original_scheduled_date ?? formattedSelectedDate,
  retired_at: new Date().toISOString(),
  is_critical: t.is_critical ?? false,
  is_locked: t.is_locked ?? false,
  energy_cost: t.energy_cost ?? 0,
  is_completed: t.is_completed ?? false,
  is_custom_energy_cost: t.is_custom_energy_cost ?? false,
  task_environment: 'laptop' as const, // ADD: Missing field
}));