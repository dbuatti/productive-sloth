import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';
import { SessionContext, UserProfile } from '@/hooks/use-session';
import { showSuccess, showError } from '@/utils/toast';
import { isToday, parseISO, isPast, addMinutes, startOfDay, isBefore, addDays, addHours, differenceInMinutes, format } from 'date-fns';
import { 
  MAX_ENERGY, 
  RECHARGE_BUTTON_AMOUNT, 
  LOW_ENERGY_THRESHOLD, 
  LOW_ENERGY_NOTIFICATION_COOLDOWN_MINUTES,
  DAILY_CHALLENGE_TASKS_REQUIRED,
  REGEN_POD_MAX_DURATION_MINUTES,
} from '@/lib/constants';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DBScheduledTask, ScheduledItem } from '@/types/scheduler';
import { calculateSchedule, setTimeOnDate } from '@/lib/scheduler-utils';
import { useEnvironmentContext } from '@/hooks/use-environment-context';

const SUPABASE_PROJECT_ID = "yfgapigmiyclgryqdgne";
const SUPABASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co`;

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpLevel, setLevelUpLevel] = useState(0);
  const [T_current, setT_current] = useState(new Date());
  const [regenPodDurationMinutes, setRegenPodDurationMinutes] = useState(0);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { selectedEnvironments } = useEnvironmentContext();
  const initialSessionLoadedRef = useRef(false);

  const isLoading = isAuthLoading || isProfileLoading;

  useEffect(() => {
    const interval = setInterval(() => setT_current(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
    setIsProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url, xp, level, daily_streak, last_streak_update, energy, last_daily_reward_claim, last_daily_reward_notification, last_low_energy_notification, tasks_completed_today, enable_daily_challenge_notifications, enable_low_energy_notifications, daily_challenge_target, default_auto_schedule_start_time, default_auto_schedule_end_time, enable_delete_hotkeys, enable_aethersink_backup, last_energy_regen_at, is_in_regen_pod, regen_pod_start_time')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('[SessionProvider] Error fetching profile:', error);
        setProfile(null);
      } else if (data) {
        setProfile(data as UserProfile);
        if (data.is_in_regen_pod && data.regen_pod_start_time) {
            const start = parseISO(data.regen_pod_start_time);
            const elapsed = differenceInMinutes(new Date(), start);
            const remaining = REGEN_POD_MAX_DURATION_MINUTES - elapsed;
            setRegenPodDurationMinutes(Math.max(0, remaining));
        } else {
            setRegenPodDurationMinutes(0);
        }
      }
    } catch (e) {
        console.error('[SessionProvider] Unexpected error during profile fetch:', e);
        setProfile(null);
    } finally {
        setIsProfileLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  }, [user?.id, fetchProfile]);

  // --- Profile/Energy/Settings Actions ---
  const rechargeEnergy = useCallback(async (amount: number = RECHARGE_BUTTON_AMOUNT) => {
    if (!user || !profile) return;
    const newEnergy = Math.min(MAX_ENERGY, profile.energy + amount);
    const { error } = await supabase.from('profiles').update({ energy: newEnergy }).eq('id', user.id);
    if (!error) await refreshProfile();
  }, [user, profile, refreshProfile]);

  const triggerLevelUp = useCallback((level: number) => { setLevelUpLevel(level); setShowLevelUp(true); }, []);
  const resetLevelUp = useCallback(() => { setShowLevelUp(false); setLevelUpLevel(0); }, []);

  const startRegenPodState = useCallback(async (durationMinutes: number) => {
    if (!user) return;
    setRegenPodDurationMinutes(durationMinutes);
    const { error } = await supabase.from('profiles').update({ is_in_regen_pod: true, regen_pod_start_time: new Date().toISOString() }).eq('id', user.id);
    if (!error) await refreshProfile();
  }, [user, refreshProfile]);

  const exitRegenPodState = useCallback(async () => {
    if (!user || !profile?.is_in_regen_pod) return;
    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/calculate-pod-exit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
            body: JSON.stringify({ startTime: profile.regen_pod_start_time, endTime: new Date().toISOString() }),
        });
        if (response.ok) showSuccess("Pod exited.");
    } catch (error) { console.error(error); } 
    finally {
        await supabase.from('profiles').update({ is_in_regen_pod: false, regen_pod_start_time: null }).eq('id', user.id);
        await refreshProfile();
        setRegenPodDurationMinutes(0);
    }
  }, [user, profile, refreshProfile, session?.access_token]);

  // --- Auth Logic ---
  useEffect(() => {
    const handleAuthChange = async (event: string, currentSession: Session | null) => {
      console.log(`[SessionProvider] Auth Event: ${event}`);
      
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        await fetchProfile(currentSession.user.id);
        if (location.pathname === '/login') setRedirectPath('/');
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        queryClient.clear();
        if (location.pathname !== '/login') setRedirectPath('/login');
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((event, currentSession) => {
      handleAuthChange(event, currentSession);
    });

    const loadInitialSession = async () => {
      if (initialSessionLoadedRef.current) return;
      initialSessionLoadedRef.current = true;

      try {
        // Try refresh first to catch session recovery
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        
        if (initialSession?.user) {
          await fetchProfile(initialSession.user.id);
          if (location.pathname === '/login') setRedirectPath('/');
        } else {
          // Only redirect if we are actually NOT on the login page
          if (location.pathname !== '/login') setRedirectPath('/login');
        }
      } catch (error) {
        console.error("[SessionProvider] Error during initial session load:", error);
      } finally {
        setIsAuthLoading(false);
      }
    };

    loadInitialSession();

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [fetchProfile, queryClient, location.pathname]);

  // Redirect Handler
  useEffect(() => {
    if (!isAuthLoading && redirectPath && location.pathname !== redirectPath) {
      console.log(`[SessionProvider] Redirecting to: ${redirectPath}`);
      navigate(redirectPath, { replace: true });
      setRedirectPath(null);
    }
  }, [redirectPath, navigate, location.pathname, isAuthLoading]);

  // --- Scheduling Logic (React Query) ---
  const { data: dbScheduledTasksToday = [] } = useQuery<DBScheduledTask[]>({
    queryKey: ['scheduledTasksToday', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase.from('scheduled_tasks')
        .select('*').eq('user_id', user.id).eq('scheduled_date', format(new Date(), 'yyyy-MM-dd'));
      if (error) throw error;
      return data as DBScheduledTask[];
    },
    enabled: !!user?.id && !isAuthLoading,
  });

  const calculatedScheduleToday = useMemo(() => {
    if (!profile || !dbScheduledTasksToday) return null;
    const workdayStart = profile.default_auto_schedule_start_time ? setTimeOnDate(startOfDay(T_current), profile.default_auto_schedule_start_time) : startOfDay(T_current);
    let workdayEnd = profile.default_auto_schedule_end_time ? setTimeOnDate(startOfDay(T_current), profile.default_auto_schedule_end_time) : addHours(startOfDay(T_current), 17);
    if (isBefore(workdayEnd, workdayStart)) workdayEnd = addDays(workdayEnd, 1);

    return calculateSchedule(
      dbScheduledTasksToday, format(new Date(), 'yyyy-MM-dd'), workdayStart, workdayEnd,
      profile.is_in_regen_pod, profile.regen_pod_start_time ? parseISO(profile.regen_pod_start_time) : null,
      regenPodDurationMinutes, T_current
    );
  }, [dbScheduledTasksToday, profile, regenPodDurationMinutes, T_current]);

  const activeItemToday = useMemo(() => 
    calculatedScheduleToday?.items.find(item => T_current >= item.startTime && T_current < item.endTime) || null, 
  [calculatedScheduleToday, T_current]);

  const nextItemToday = useMemo(() => 
    calculatedScheduleToday?.items.find(item => item.startTime > T_current) || null, 
  [calculatedScheduleToday, T_current]);

  return (
    <SessionContext.Provider value={{ 
      session, user, profile, isLoading, refreshProfile, rechargeEnergy,
      showLevelUp, levelUpLevel, triggerLevelUp, resetLevelUp,
      activeItemToday, nextItemToday, T_current,
      startRegenPodState, exitRegenPodState, regenPodDurationMinutes
    }}>
      {/* IMPORTANT: We don't render children until we know the initial auth check is done.
          This prevents the protected components from mounting and immediately failing.
      */}
      {!isAuthLoading ? children : null}
    </SessionContext.Provider>
  );
};