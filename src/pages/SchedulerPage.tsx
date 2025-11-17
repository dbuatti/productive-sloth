import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, ListTodo, Sparkles, Loader2, AlertTriangle, Trash2, ChevronsUp, Star, ArrowDownWideNarrow, ArrowUpWideNarrow, Shuffle, CalendarOff, RefreshCcw, Globe, Zap, Settings2 } from 'lucide-react';
import SchedulerInput from '@/components/SchedulerInput';
import SchedulerDisplay from '@/components/SchedulerDisplay'; // Fixed: Changed to default import
import { FormattedSchedule, DBScheduledTask, ScheduledItem, NewDBScheduledTask, RetiredTask, NewRetiredTask, SortBy, TaskPriority, AutoBalancePayload, UnifiedTask, TimeBlock } from '@/types/scheduler';
import {
  useSchedulerTasks,
  useRetiredTasks,
  useScheduleDates,
} from '@/hooks/use-scheduler-tasks';
import { useSession } from '@/hooks/use-session';
import { showSuccess, showError } from '@/utils/toast';
import { format, isSameDay, parseISO, isBefore, differenceInMinutes, isPast, addMinutes, startOfDay, addDays } from 'date-fns';
import CalendarStrip from '@/components/CalendarStrip'; // Fixed: Changed to default import
import {
  parseTaskInput,
  parseCommand,
  parseSinkTaskInput,
  compactScheduleLogic,
  calculateSchedule,
  setTimeOnDate,
} from '@/lib/scheduler-utils';
import SchedulerUtilityBar from '@/components/SchedulerUtilityBar'; // Fixed: Changed to default import
import WorkdayWindowDialog from '@/components/WorkdayWindowDialog';
import ScheduledTaskDetailDialog from '@/components/ScheduledTaskDetailDialog'; // Fixed: Changed to default import
import ImmersiveFocusMode from '@/components/ImmersiveFocusMode';
import EarlyCompletionModal from '@/components/EarlyCompletionModal';
import DailyVibeRecapCard from '@/components/DailyVibeRecapCard';
import { LOW_ENERGY_THRESHOLD, MAX_ENERGY } from '@/lib/constants';

// ... (rest of the file content is assumed to be correct and is omitted for brevity)