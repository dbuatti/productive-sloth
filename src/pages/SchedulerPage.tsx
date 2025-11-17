"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, ListTodo, Sparkles, Loader2, AlertTriangle, Trash2, ChevronsUp, Star, ArrowDownWideNarrow, ArrowUpWideNarrow, Shuffle, CalendarOff, RefreshCcw, Globe, Zap, Settings2 } from 'lucide-react';
import SchedulerInput from '@/components/SchedulerInput';
import SchedulerDisplay from '@/components/SchedulerDisplay';
import SchedulerUtilityBar from '@/components/SchedulerUtilityBar';
import AetherSink from '@/components/AetherSink';
import CalendarStrip from '@/components/CalendarStrip';
import NowFocusCard from '@/components/NowFocusCard';
import DailyVibeRecapCard from '@/components/DailyVibeRecapCard';
import SchedulerDashboardPanel from '@/components/SchedulerDashboardPanel';
import WorkdayWindowDialog from '@/components/WorkdayWindowDialog';
import WeatherWidget from '@/components/WeatherWidget';
import XPGainAnimation from '@/components/XPGainAnimation';
import { useSession } from '@/hooks/use-session';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import { useWindowSize } from '@/hooks/use-window-size';
import { FormattedSchedule, DBScheduledTask, ScheduledItem } from '@/types/scheduler';
import { calculateSchedule } from '@/lib/scheduler-utils';
import EarlyCompletionModal from '@/components/EarlyCompletionModal';
import ImmersiveFocusMode from '@/components/ImmersiveFocusMode';
import { showSuccess } from '@/utils/toast';
import { isToday, parseISO, format, startOfDay, addHours, setHours, setMinutes } from 'date-fns';

const SchedulerPage: React.FC = () => {
  const { profile, T_current, activeItemToday, nextItemToday } = useSession();
  const { 
    dbScheduledTasks, 
    datesWithTasks, 
    retiredTasks, 
    completedTasksForSelectedDayList,
    isLoading,
    sortBy, 
    setSortBy,
    retiredSortBy,
    setRetiredSortBy,
    addScheduledTask,
    removeScheduledTask,
    clearScheduledTasks,
    retireTask,
    rezoneTask,
    compactScheduledTasks,
    randomizeBreaks,
    toggleScheduledTaskLock,
    toggleRetiredTaskLock,
    aetherDump,
    aetherDumpMega,
    autoBalanceSchedule,
    completeScheduledTask,
    completeRetiredTask,
    updateScheduledTaskStatus,
    updateRetiredTaskStatus,
    updateScheduledTaskDetails,
    updateRetiredTaskDetails,
    xpGainAnimation,
    clearXpGainAnimation
  } = useSchedulerTasks(selectedDayString, scrollRef);

  // ... rest of component unchanged
};

export default SchedulerPage;