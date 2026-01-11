"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';
import { SessionContext, UserProfile } from '@/hooks/use-session';
import { showSuccess, showError } from '@/utils/toast';
import { isToday, parseISO, addMinutes, startOfDay, isBefore, addDays, addHours, differenceInMinutes, format } from 'date-fns';
import { MAX_ENERGY, RECHARGE_BUTTON_AMOUNT, DAILY_CHALLENGE_TASKS_REQUIRED, REGEN_POD_MAX_DURATION_MINUTES } from '@/lib/constants';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DBScheduledTask, ScheduledItem } from '@/types/scheduler';
import { calculateSchedule, setTimeOnDate } from '@/lib/scheduler-utils';
import { MealAssignment } from '@/hooks/use-meals';
import isEqual from 'lodash.isequal';
import { Loader2 } from 'lucide-react';

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
  const [regenPodDurationMinutes, setRegenPodDurationMinutes] = useState(0);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const initialSessionLoadedRef = useRef(false);
  
  const [todayString, setTodayString] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  const isLoading = isAuthLoading || isProfileLoading;

  // Use a ref for the profile to avoid dependency loops in callbacks
  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const [activeItemToday, setActiveItemToday] = useState<ScheduledItem | null>(null);
  const [nextItemToday, setNextItemToday] = useState<ScheduledItem | null>(null);

  // Update today's date string periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const current = format(new Date(), 'yyyy-MM-dd');
      setTodayString(prev => prev !== current ? current : prev);
    }, 1000 * 60 * 15);
    return () => clearInterval(interval);
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
    setIsProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`*`)
        .eq('id', userId)
        .single();

      if (error) {
        console.warn("[SessionProvider] Profile not found or error:", error.message);
        setProfile(null);
      } else if (data) {
        const profileDataWithDefaultTimezone = { 
          ...data, 
          timezone: data.timezone || 'UTC' 
        } as UserProfile;
        
        setProfile(prev => isEqual(prev, profileDataWithDefaultTimezone) ? prev : profileDataWithDefaultTimezone);
        
        if (profileDataWithDefaultTimezone.is_in_regen_pod && profileDataWithDefaultTimezone.regen_pod_start_time) {
          const start = parseISO(profileDataWithDefaultTimezone.regen_pod_start_time);
          const elapsed = differenceInMinutes(new Date(), start);
          setRegenPodDurationMinutes(Math.max(0, REGEN_POD_MAX_DURATION_MINUTES - elapsed));
        } else {
          setRegenPodDurationMinutes(0);
        }
      }
    } catch (e) {
      console.error("[SessionProvider] Unexpected error fetching profile:", e);
    } finally {
      setIsProfileLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) await fetchProfile(user.id);
  }, [user?.id, fetchProfile]);

  const rechargeEnergy = useCallback(async (amount: number = RECHARGE_BUTTON_AMOUNT) => {
    if (!user || !profile) return;
    const newEnergy = Math.min(MAX_ENERGY, profile.energy + amount);
    const { error } = await supabase.from('profiles').update({ energy: newEnergy }).eq('id', user.id);
    if (!error) await refreshProfile();
    else showError("Failed to update energy.");
  }, [user, profile, refreshProfile]);

  const triggerLevelUp = useCallback((level: number) => {
    setShowLevelUp(true);
    setLevelUpLevel(level);
  }, []);

  const resetLevelUp = useCallback(() => {
    setShowLevelUp(false);
    setLevelUpLevel(0);
  }, []);

  const resetDailyStreak = useCallback(async () => {
    if (!user) return;
    const { error } = await supabase.from('profiles').update({ daily_streak: 0, last_streak_update: null }).eq('id', user.id);
    if (!error) await refreshProfile();
  }, [user, refreshProfile]);

  const claimDailyReward = useCallback(async (xpAmount: number, energyAmount: number) => {
    if (!user || !profile) return;
    const { error } = await supabase.from('profiles').update({ 
      xp: profile.xp + xpAmount, 
      energy: Math.min(MAX_ENERGY, profile.energy + energyAmount), 
      last_daily_reward_claim: new Date().toISOString() 
    }).eq('id', user.id);
    
    if (!error) {
      await refreshProfile();
      showSuccess("Reward claimed!");
    } else {
      showError("Failed to claim reward.");
    }
  }, [user, profile, refreshProfile]);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!user) return;
    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
    if (!error) await refreshProfile();
    else showError("Failed to update profile.");
  }, [user, refreshProfile]);

  const updateBlockedDays = useCallback(async (dateString: string, isBlocked: boolean) => {
    if (!user || !profile) return;
    let newBlockedDays = profile.blocked_days ? [...profile.blocked_days] : [];
    if (isBlocked) { 
      if (!newBlockedDays.includes(dateString)) newBlockedDays.push(dateString); 
    } else { 
      newBlockedDays = newBlockedDays.filter(day => day !== dateString); 
    }
    const { error } = await supabase.from('profiles').update({ blocked_days: newBlockedDays }).eq('id', user.id);
    if (!error) { 
      await refreshProfile(); 
      showSuccess(isBlocked ? `Day ${dateString} blocked.` : `Day ${dateString} unblocked.`); 
    }
  }, [user, profile, refreshProfile]);

  const triggerEnergyRegen = useCallback(async () => {
    if (!user) return;
    try {
      const { error } = await supabase.functions.invoke('trigger-energy-regen');
      if (!error) await refreshProfile();
    } catch (e: any) {
      console.error("[SessionProvider] Energy regen trigger failed:", e.message);
    }
  }, [user, refreshProfile]);

  const startRegenPodState = useCallback(async (activityName: string, durationMinutes: number) => {
    if (!user) return;
    setRegenPodDurationMinutes(durationMinutes);
    const { error } = await supabase.from('profiles').update({ 
      is_in_regen_pod: true, 
      regen_pod_start_time: new Date().toISOString() 
    }).eq('id', user.id);
    if (!error) await refreshProfile();
  }, [user, refreshProfile]);

  const exitRegenPodState = useCallback(async () => {
    if (!user || !profile?.is_in_regen_pod) return;
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/calculate-pod-exit`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${session?.access_token}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ startTime: profile.regen_pod_start_time, endTime: new Date().toISOString() }),
      });
    } catch (e) {
      console.error("[SessionProvider] Error calculating pod exit:", e);
    } finally {
      const { error } = await supabase.from('profiles').update({ 
        is_in_regen_pod: false, 
        regen_pod_start_time: null 
      }).eq('id', user.id);
      if (!error) { 
        await refreshProfile(); 
        setRegenPodDurationMinutes(0); 
      }
    }
  }, [user, profile, refreshProfile, session?.access_token]);

  // Auth State Listener
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log("[SessionProvider] Auth state change:", event);
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      
      if (currentSession?.user) {
        await fetchProfile(currentSession.user.id);
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        queryClient.clear();
        setRedirectPath('/login');
      }
      setIsAuthLoading(false);
    });
    
    return () => authListener.subscription.unsubscribe();
  }, [fetchProfile, queryClient]);

  // Initial Session Load
  useEffect(() => {
    const loadInitialSession = async () => {
      if (initialSessionLoadedRef.current) return;
      initialSessionLoadedRef.current = true;
      
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        
        if (initialSession?.user) {
          await fetchProfile(initialSession.user.id);
        } else if (location.pathname !== '/login') {
          setRedirectPath('/login');
        }
      } catch (e) {
        console.error("[SessionProvider] Error during initial session load:", e);
      } finally {
        setIsAuthLoading(false);
      }
    };
    loadInitialSession();
  }, [fetchProfile, location.pathname]);

  // Handle Redirects
  useEffect(() => {
    if (!isAuthLoading && redirectPath && location.pathname !== redirectPath) {
      navigate(redirectPath, { replace: true });
      setRedirectPath(null);
    }
  }, [redirectPath, navigate, location.pathname, isAuthLoading]);

  // Data fetching for today's tasks and meals
  const { data: dbScheduledTasksToday = [] } = useQuery<DBScheduledTask[]>({
    queryKey: ['scheduledTasksToday', user?.id, todayString],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase.from('scheduled_tasks').select('*').eq('user_id', user.id).eq('scheduled_date', todayString);
      if (error) throw error;
      return data as DBScheduledTask[];
    },
    enabled: !!user?.id && !isAuthLoading,
  });

  const { data: mealAssignmentsToday = [] } = useQuery<MealAssignment[]>({
    queryKey: ['mealAssignmentsToday', user?.id, todayString],
    queryFn: async () => {
      if (!user?.id || !todayString) return [];
      const { data, error } = await supabase.from('meal_assignments').select('*, meal_idea:meal_ideas(*)').eq('assigned_date', todayString).eq('user_id', user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && !isAuthLoading,
  });

  // Calculate today's schedule for focused item tracking
  const calculatedScheduleToday = useMemo(() => {
    if (!profile) return null;
    const dayStart = parseISO(todayString);
    const start = profile.default_auto_schedule_start_time ? setTimeOnDate(dayStart, profile.default_auto_schedule_start_time) : dayStart;
    let end = profile.default_auto_schedule_end_time ? setTimeOnDate(dayStart, profile.default_auto_schedule_end_time) : addHours(dayStart, 17);
    if (isBefore(end, start)) end = addDays(end, 1);
    
    return calculateSchedule(
      dbScheduledTasksToday, 
      todayString, 
      start, 
      end, 
      profile.is_in_regen_pod, 
      profile.regen_pod_start_time ? parseISO(profile.regen_pod_start_time) : null, 
      regenPodDurationMinutes, 
      new Date(), 
      profile.breakfast_time, 
      profile.lunch_time, 
      profile.dinner_time, 
      profile.breakfast_duration_minutes, 
      profile.lunch_duration_minutes, 
      profile.dinner_duration_minutes, 
      profile.reflection_count || 0, 
      profile.reflection_times || [], 
      profile.reflection_durations || [], 
      mealAssignmentsToday, 
      profile.blocked_days?.includes(todayString) ?? false
    );
  }, [dbScheduledTasksToday, profile, regenPodDurationMinutes, mealAssignmentsToday, todayString]);

  // Update active and next items periodically
  useEffect(() => {
    const timer = setInterval(() => {
      if (!calculatedScheduleToday) return;
      const now = new Date();
      const newActive = calculatedScheduleToday.items.find(i => now >= i.startTime && now < i.endTime) || null;
      const newNext = calculatedScheduleToday.items.find(i => i.startTime > now) || null;
      
      setActiveItemToday(prev => isEqual(prev, newActive) ? prev : newActive);
      setNextItemToday(prev => isEqual(prev, newNext) ? prev : newNext);
    }, 10000);
    return () => clearInterval(timer);
  }, [calculatedScheduleToday]); 

  const contextValue = useMemo(() => ({
    session, 
    user, 
    profile, 
    isLoading, 
    refreshProfile, 
    rechargeEnergy, 
    showLevelUp, 
    levelUpLevel, 
    triggerLevelUp, 
    resetLevelUp, 
    resetDailyStreak, 
    claimDailyReward, 
    updateNotificationPreferences: async (p: any) => updateProfile(p), 
    updateProfile, 
    updateSettings: async (p: any) => updateProfile(p), 
    updateBlockedDays, 
    updateSkippedDayOffSuggestions: async () => {}, 
    triggerEnergyRegen, 
    activeItemToday, 
    nextItemToday, 
    startRegenPodState, 
    exitRegenPodState, 
    regenPodDurationMinutes
  }), [
    session, user, profile, isLoading, refreshProfile, rechargeEnergy, showLevelUp, levelUpLevel, 
    triggerLevelUp, resetLevelUp, resetDailyStreak, claimDailyReward, updateProfile, updateBlockedDays, 
    triggerEnergyRegen, activeItemToday, nextItemToday, startRegenPodState, exitRegenPodState, regenPodDurationMinutes
  ]);

  return (
    <SessionContext.Provider value={contextValue}>
      {!isAuthLoading ? children : (
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-muted-foreground animate-pulse">Initializing AetherFlow...</p>
          </div>
        </div>
      )}
    </SessionContext.Provider>
  );
};