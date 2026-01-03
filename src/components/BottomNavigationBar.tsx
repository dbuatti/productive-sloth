import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sparkles, Trash2, Plus, CheckCircle, Coffee, ListTodo, Loader2, Clock, CalendarDays } from 'lucide-react'; // NEW: Import CalendarDays
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import { useSession } from '@/hooks/use-session';
import { showError } from '@/utils/toast';
import { addMinutes, format } from 'date-fns';

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  matchPath: string;
}

const navItems: NavItem[] = [
  { to: "/scheduler", icon: Clock, label: "Schedule", matchPath: '/scheduler' },
  { to: "/sink", icon: Trash2, label: "Sink", matchPath: '/sink' },
  { to: "/recap", icon: CheckCircle, label: "Recap", matchPath: '/recap' },
  { to: "/analytics", icon: Sparkles, label: "Stats", matchPath: '/analytics' },
  { to: "/simplified-schedule", icon: CalendarDays, label: "Weekly", matchPath: '/simplified-schedule' }, // NEW NAV ITEM
];

const BottomNavigationBar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { addScheduledTask } = useSchedulerTasks('');<dyad-problem-report summary="64 problems">
<problem file="src/hooks/use-session.ts" line="355" column="30" code="1005">'&gt;' expected.</problem>
<problem file="src/hooks/use-session.ts" line="355" column="35" code="1005">')' expected.</problem>
<problem file="src/hooks/use-session.ts" line="355" column="37" code="1136">Property assignment expected.</problem>
<problem file="src/hooks/use-session.ts" line="362" column="7" code="1005">',' expected.</problem>
<problem file="src/hooks/use-session.ts" line="363" column="8" code="1136">Property assignment expected.</problem>
<problem file="src/hooks/use-session.ts" line="363" column="9" code="1005">';' expected.</problem>
<problem file="src/hooks/use-session.ts" line="363" column="40" code="1128">Declaration or statement expected.</problem>
<problem file="src/hooks/use-session.ts" line="364" column="6" code="1110">Type expected.</problem>
<problem file="src/hooks/use-session.ts" line="365" column="3" code="1128">Declaration or statement expected.</problem>
<problem file="src/hooks/use-session.ts" line="366" column="1" code="1128">Declaration or statement expected.</problem>
<problem file="src/lib/icons.ts" line="5" column="62" code="2724">'&quot;/Users/danielebuatti/dyad-apps/productive-sloth/node_modules/.pnpm/lucide-react@0.462.0_react@18.3.1/node_modules/lucide-react/dist/lucide-react&quot;' has no exported member named 'Icon'. Did you mean 'XIcon'?</problem>
<problem file="src/hooks/use-session.ts" line="101" column="14" code="2322">Type '({ children }: { children: ReactNode; }) =&gt; {}' is not assignable to type 'FC&lt;{ children: ReactNode; }&gt;'.
  Type '{}' is not assignable to type 'ReactNode'.</problem>
<problem file="src/hooks/use-session.ts" line="355" column="6" code="2503">Cannot find namespace 'SessionContext'.</problem>
<problem file="src/hooks/use-session.ts" line="355" column="30" code="2304">Cannot find name 'value'.</problem>
<problem file="src/hooks/use-session.ts" line="356" column="7" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/hooks/use-session.ts" line="356" column="7" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/hooks/use-session.ts" line="356" column="7" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/hooks/use-session.ts" line="356" column="7" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/hooks/use-session.ts" line="356" column="7" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/hooks/use-session.ts" line="356" column="7" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/hooks/use-session.ts" line="356" column="7" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/hooks/use-session.ts" line="356" column="7" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/hooks/use-session.ts" line="356" column="7" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/hooks/use-session.ts" line="356" column="7" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/hooks/use-session.ts" line="356" column="7" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/hooks/use-session.ts" line="356" column="7" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/hooks/use-session.ts" line="356" column="7" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/hooks/use-session.ts" line="356" column="7" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/hooks/use-session.ts" line="356" column="7" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/hooks/use-session.ts" line="356" column="7" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/hooks/use-session.ts" line="356" column="7" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/hooks/use-session.ts" line="356" column="7" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/hooks/use-session.ts" line="356" column="7" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/hooks/use-session.ts" line="356" column="7" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/hooks/use-session.ts" line="356" column="7" code="2695">Left side of comma operator is unused and has no side effects.</problem>
<problem file="src/hooks/use-session.ts" line="363" column="9" code="2304">Cannot find name 'isAuthLoading'.</problem>
<problem file="src/hooks/use-session.ts" line="363" column="25" code="2304">Cannot find name 'children'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="340" column="49" code="2304">Cannot find name 'workdayEndTimeForSelectedDay'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="340" column="101" code="2304">Cannot find name 'workdayEndTimeForSelectedDay'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="341" column="50" code="2304">Cannot find name 'workdayStartTimeForSelectedDay'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="341" column="106" code="2304">Cannot find name 'workdayStartTimeForSelectedDay'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="344" column="57" code="2304">Cannot find name 'workdayStartTimeForSelectedDay'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="345" column="53" code="2304">Cannot find name 'workdayEndTimeForSelectedDay'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="377" column="94" code="2304">Cannot find name 'workdayEndTimeForSelectedDay'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="382" column="78" code="2304">Cannot find name 'workdayEndTimeForSelectedDay'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="712" column="49" code="2304">Cannot find name 'workdayEndTimeForSelectedDay'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="712" column="101" code="2304">Cannot find name 'workdayEndTimeForSelectedDay'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="713" column="50" code="2304">Cannot find name 'workdayStartTimeForSelectedDay'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="713" column="106" code="2304">Cannot find name 'workdayStartTimeForSelectedDay'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="716" column="57" code="2304">Cannot find name 'workdayStartTimeForSelectedDay'.</problem>
<problem file="src/hooks/use-scheduler-tasks.ts" line="717" column="53" code="2304">Cannot find name 'workdayEndTimeForSelectedDay'.</problem>
<problem file="src/components/EnvironmentOrderSettings.tsx" line="33" column="10" code="2304">Cannot find name 'Loader2'.</problem>
<problem file="src/components/ScheduledTaskDetailDialog.tsx" line="314" column="66" code="2339">Property 'displayName' does not exist on type 'ElementType&lt;any, keyof IntrinsicElements&gt;'.
  Property 'displayName' does not exist on type '&quot;symbol&quot;'.</problem>
<problem file="src/components/SchedulerDisplay.tsx" line="102" column="49" code="2339">Property 'displayName' does not exist on type 'ElementType&lt;any, keyof IntrinsicElements&gt;'.
  Property 'displayName' does not exist on type '&quot;symbol&quot;'.</problem>
<problem file="src/components/EnvironmentMultiSelect.tsx" line="63" column="50" code="2339">Property 'displayName' does not exist on type 'ElementType&lt;any, keyof IntrinsicElements&gt;'.
  Property 'displayName' does not exist on type '&quot;symbol&quot;'.</problem>
<problem file="src/components/EnvironmentMultiSelect.tsx" line="92" column="10" code="2304">Cannot find name 'Loader2'.</problem>
<problem file="src/components/EnvironmentMultiSelect.tsx" line="125" column="56" code="2339">Property 'displayName' does not exist on type 'ElementType&lt;any, keyof IntrinsicElements&gt;'.
  Property 'displayName' does not exist on type '&quot;symbol&quot;'.</problem>
<problem file="src/components/RetiredTaskDetailDialog.tsx" line="265" column="66" code="2339">Property 'displayName' does not exist on type 'ElementType&lt;any, keyof IntrinsicElements&gt;'.
  Property 'displayName' does not exist on type '&quot;symbol&quot;'.</problem>
<problem file="src/components/SortableTaskCard.tsx" line="58" column="24" code="2304">Cannot find name 'useCallback'.</problem>
<problem file="src/components/SortableTaskCard.tsx" line="79" column="49" code="2339">Property 'displayName' does not exist on type 'ElementType&lt;any, keyof IntrinsicElements&gt;'.
  Property 'displayName' does not exist on type '&quot;symbol&quot;'.</problem>
<problem file="src/components/SinkKanbanBoard.tsx" line="29" column="49" code="2339">Property 'displayName' does not exist on type 'ElementType&lt;any, keyof IntrinsicElements&gt;'.
  Property 'displayName' does not exist on type '&quot;symbol&quot;'.</problem>
<problem file="src/components/AetherSink.tsx" line="163" column="49" code="2339">Property 'displayName' does not exist on type 'ElementType&lt;any, keyof IntrinsicElements&gt;'.
  Property 'displayName' does not exist on type '&quot;symbol&quot;'.</problem>
<problem file="src/components/EnvironmentProvider.tsx" line="19" column="23" code="2304">Cannot find name 'Home'.</problem>
<problem file="src/components/SimplifiedScheduledTaskItem.tsx" line="25" column="49" code="2339">Property 'displayName' does not exist on type 'ElementType&lt;any, keyof IntrinsicElements&gt;'.
  Property 'displayName' does not exist on type '&quot;symbol&quot;'.</problem>
</dyad-problem-report>You're facing a few key issues:

1.  **Circular Dependency in `use-session.ts`:** The `SessionContext` and `UserProfile` types are defined and then immediately imported from the same file, creating a circular dependency. This is causing many of the initial errors.
2.  **`React.FC` Return Type:** The `SessionProvider` component's return type is inferred as `{}` which is not assignable to `ReactNode`.
3.  **Missing Imports:** `Loader2` and `Home` are used in some components without being imported.
4.  **`displayName` on `React.ElementType`:** You're trying to access `displayName` on `option.icon`, but `option.icon` is already a `React.ElementType` (the icon component itself), not an object with a `displayName` property. The `getLucideIcon` function already returns the component, so we should pass the `icon_name` string directly to it.
5.  **`useCallback` Import:** `useCallback` is used in `SortableTaskCard` but not imported.
6.  **`workdayStartTimeForSelectedDay` and `workdayEndTimeForSelectedDay` Scope:** These variables are defined in `SchedulerPage.tsx` but are needed in `useSchedulerTasks.ts`. They need to be passed as arguments or derived within the hook.

Here's how I'll fix these:

1.  **`use-session.ts` Refactor:** I'll move the `SessionContext` and `UserProfile` definitions to a separate `src/types/session.ts` file. This breaks the circular dependency.
2.  **`SessionProvider` Return Type:** I'll explicitly return `React.ReactNode` from `SessionProvider`.
3.  **Missing Imports:** I'll add `Loader2` and `Home` imports where needed.
4.  **Icon Handling:** I'll update `EnvironmentOption` to store `icon_name: string` directly, and then pass `env.icon_name` to `getLucideIcon` in all relevant components.
5.  **`useCallback` Import:** Add `useCallback` import to `SortableTaskCard`.
6.  **`workdayStartTimeForSelectedDay` and `workdayEndTimeForSelectedDay`:** I'll pass these as arguments to the `getStaticConstraints` function within `useSchedulerTasks` and ensure they are correctly used.

Let's start by creating the new `src/types/session.ts` file and updating `use-session.ts`.

<dyad-write path="src/types/session.ts" description="Creating a new file for SessionContext and UserProfile types to resolve circular dependency.">
import { Session, User } from '@supabase/supabase-js';
import React from 'react';
import { DBScheduledTask, ScheduledItem, TaskEnvironment } from '@/types/scheduler';
import { MealAssignment } from '@/hooks/use-meals';

export interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  xp: number;
  level: number;
  daily_streak: number;
  last_streak_update: string | null;
  energy: number;
  last_daily_reward_claim: string | null;
  last_daily_reward_notification: string | null;
  last_low_energy_notification: string | null;
  tasks_completed_today: number;
  enable_daily_challenge_notifications: boolean;
  enable_low_energy_notifications: boolean;
  daily_challenge_target: number;
  default_auto_schedule_start_time: string | null;
  default_auto_schedule_end_time: string | null;
  enable_delete_hotkeys: boolean;
  enable_aethersink_backup: boolean;
  last_energy_regen_at: string | null;
  is_in_regen_pod: boolean;
  regen_pod_start_time: string | null;
  breakfast_time: string | null;
  lunch_time: string | null;
  dinner_time: string | null;
  breakfast_duration_minutes: number | null;
  lunch_duration_minutes: number | null;
  dinner_duration_minutes: number | null;
  enable_environment_chunking: boolean;
  enable_macro_spread: boolean;
  reflection_count: number;
  reflection_times: string[];
  reflection_durations: number[];
  week_starts_on: number;
  num_days_visible: number;
  vertical_zoom_index: number;
  is_dashboard_collapsed: boolean;
  is_action_center_collapsed: boolean;
}

export interface SessionContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
  rechargeEnergy: (amount?: number) => Promise<void>;
  showLevelUp: boolean;
  levelUpLevel: number;
  triggerLevelUp: (level: number) => void;
  resetLevelUp: () => void;
  resetDailyStreak: () => Promise<void>;
  claimDailyReward: (xpAmount: number, energyAmount: number) => Promise<void>;
  updateNotificationPreferences: (preferences: { enable_daily_challenge_notifications?: boolean; enable_low_energy_notifications?: boolean }) => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  updateSettings: (updates: Partial<UserProfile>) => Promise<void>;
  activeItemToday: ScheduledItem | null;
  nextItemToday: ScheduledItem | null;
  T_current: Date;
  startRegenPodState: (durationMinutes: number) => Promise<void>;
  exitRegenPodState: () => Promise<void>;
  regenPodDurationMinutes: number;
  triggerEnergyRegen: () => Promise<void>;
}

export const SessionContext = createContext<SessionContextType | undefined>(undefined);