"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';
import { SessionContext, UserProfile } from '@/hooks/use-session';
import { showSuccess, showError } from '@/utils/toast';
import { parseISO, differenceInMinutes, format, isBefore, addDays, addHours, isSameDay, max, min } from 'date-fns';
import { MAX_ENERGY, RECHARGE_BUTTON_AMOUNT, REGEN_POD_MAX_DURATION_MINUTES } from '@/lib/constants';
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
  
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  
  const [todayString, setTodayString] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  const [activeItemToday, setActiveItemToday] = useState<ScheduledItem | null>(null);
  const [nextItemToday, setNextItemToday] = useState<ScheduledItem | null>(null);

  // Hard stability guard for profile fetching
  const lastFetchTimeRef = useRef<number>(0);
  const fetchingProfileForId = useRef<string | null>(null);

  const fetchProfile = useCallback(async (userId: string, isManualRefresh = false) => {
    const now = Date.now();
    if (!isManualRefresh && now - lastFetchTimeRef.current < 2000) return null;
    if (fetchingProfileForId.current === userId && !isManualRefresh) return null;
    
    lastFetchTimeRef.current = now;
    fetchingProfileForId.current = userId;
    setIsProfileLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`*`)
        .eq('id', userId)
        .single();

      if (error) {
        setProfile(null);
        return null;
      } else if (data) {
        const profileData = { ...data, timezone: data.timezone || 'UTC' } as UserProfile;
        
        setProfile(prev => {
          if (isEqual(prev, profileData)) return prev;
          return profileData;
        });
        
        if (profileData.is_in_regen_pod && profileData.regen_pod_start_time) {
          const start = parseISO(profileData.regen_pod_start_time);
          const elapsed = differenceInMinutes(new Date(), start);
          setRegenPodDurationMinutes(Math.max(0, REGEN_POD_MAX_DURATION_MINUTES - elapsed));
        } else {
          setRegenPodDurationMinutes(0);
        }
        return profileData;
      }
      return null;
    } finally {
      setIsProfileLoading(false);
      fetchingProfileForId.current = null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) await fetchProfile(user.id, true);
  }, [user?.id, fetchProfile]);

  useEffect(() => {
    if (user?.id) {
      fetchProfile(user.id);
    } else {
      setProfile(null);
    }
  }, [user?.id, fetchProfile]);

  const rechargeEnergy = useCallback(async (amount: number = RECHARGE_BUTTON_AMOUNT) => {
    if (!user || !profile) return;
    const newEnergy = Math.min(MAX_ENERGY, profile.energy + amount);
    const { error } = await supabase.from('profiles').update({ energy: newEnergy }).eq('id', user.id);
    if (!error) await refreshProfile();
  }, [user, profile, refreshProfile]);

  const triggerLevelUp = useCallback((level: number) => {
    setShowLevelUp(true);
    setLevelUpLevel(level);
  }, []);

  const resetLevelUp = useCallback(() => {
    setShowLevelUp(false);
    setLevelUpLevel(0);
  }, []);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!user) return;
    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
    if (!error) await refreshProfile();
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

  const claimDailyReward = useCallback(async (xpAmount: number, energyAmount: number) => {
    if (!user || !profile) return;
    const { error } = await supabase
      .from('profiles')
      .update({
        xp: profile.xp + xpAmount,
        energy: Math.min(MAX_ENERGY, profile.energy + energyAmount),
        last_daily_reward_claim: new Date().toISOString()
      })
      .eq('id', user.id);
    
    if (!error) {
      await refreshProfile();
      showSuccess("Daily challenge reward claimed!");
    } else {
      showError("Failed to claim reward.");
    }
  }, [user, profile, refreshProfile]);

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

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setIsAuthLoading(false);
      if (event === 'SIGNED_OUT') {
        setProfile(null);
        queryClient.clear();
      }
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);

  useEffect(() => {
    if (!isAuthLoading) {
      if (!user && location.pathname !== '/login') {
        navigate('/login', { replace: true });
      } else if (user && location.pathname === '/login') {
        navigate('/', { replace: true });
      }
    }
  }, [isAuthLoading, user, location.pathname, navigate]);

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

  useEffect(() => {
    if (!calculatedScheduleToday) return;
    const updateFocusItems = () => {
      const now = new Date();
      const newActive = calculatedScheduleToday.items.find(i => now >= i.startTime && now < i.endTime) || null;
      const newNext = calculatedScheduleToday.items.find(i => i.startTime > now) || null;
      setActiveItemToday(prev => isEqual(prev, newActive) ? prev : newActive);
      setNextItemToday(prev => isEqual(prev, newNext) ? prev : newNext);
    };
    updateFocusItems();
    const timer = setInterval(updateFocusItems, 15000);
    return () => clearInterval(timer);
  }, [calculatedScheduleToday]); 

  const contextValue = useMemo(() => ({
    session, user, profile, isLoading: isAuthLoading, refreshProfile, rechargeEnergy, showLevelUp, levelUpLevel, 
    triggerLevelUp, resetLevelUp, resetDailyStreak: async () => {}, claimDailyReward, 
    updateNotificationPreferences: async (p: any) => updateProfile(p), 
    updateProfile, 
    updateSettings: async (p: any) => updateProfile(p), 
    updateBlockedDays, 
    updateSkippedDayOffSuggestions: async () => {}, 
    triggerEnergyRegen: async () => {}, activeItemToday, nextItemToday, startRegenPodState, exitRegenPodState, regenPodDurationMinutes
  }), [
    session, user, profile, isAuthLoading, refreshProfile, rechargeEnergy, showLevelUp, levelUpLevel, 
    triggerLevelUp, resetLevelUp, claimDailyReward, updateProfile, updateBlockedDays, 
    activeItemToday, nextItemToday, startRegenPodState, exitRegenPodState, regenPodDurationMinutes
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