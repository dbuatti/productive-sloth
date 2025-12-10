import { useState, useEffect, useCallback, useMemo } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { ScheduledItem } from '@/types/scheduler';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, isSameDay, addMinutes, startOfDay } from 'date-fns';
import { LOW_ENERGY_THRESHOLD, MAX_ENERGY, REGEN_POD_RATE_PER_MINUTE } from '@/lib/constants';
import { calculateSchedule } from '@/lib/scheduler-utils';
import { DBScheduledTask } from '@/types/scheduler';

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  updated_at: string | null;
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
  enable_delete_hotkeys: boolean | null;
  enable_aethersink_backup: boolean;
  last_energy_regen_at: string | null;
  is_in_regen_pod: boolean;
  regen_pod_start_time: string | null;
  journey_start_date: string | null;
  last_active_at: string | null;
  timezone: string | null;
}

interface UseSessionReturn {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  session: Session | null;
  T_current: Date;
  activeItemToday: ScheduledItem | null;
  nextItemToday: ScheduledItem | null;
  refreshProfile: () => Promise<void>;
  rechargeEnergy: () => Promise<void>;
  startRegenPodState: (durationMinutes: number) => Promise<void>;
  exitRegenPodState: () => Promise<void>;
  regenPodDurationMinutes: number;
}

export const useSession = (): UseSessionReturn => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const queryClient = useQueryClient();
  const T_current = useMemo(() => new Date(), []);

  const {
    data: profile,
    isLoading: isProfileLoading,
    refetch: refetchProfile,
  } = useQuery<Profile | null>({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
        
      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }
      
      return data;
    },
    enabled: !!user?.id,
  });

  const {
    data: scheduledTasksToday,
    isLoading: isScheduledTasksLoading,
  } = useQuery<DBScheduledTask[]>({
    queryKey: ['scheduledTasksToday', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('scheduled_tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('scheduled_date', today)
        .order('start_time', { ascending: true });
        
      if (error) {
        console.error('Error fetching scheduled tasks:', error);
        return [];
      }
      
      return data || [];
    },
    enabled: !!user?.id,
  });

  const calculatedSchedule = useMemo(() => {
    if (!profile || !scheduledTasksToday) return null;
    
    const today = new Date();
    const workdayStart = profile.default_auto_schedule_start_time 
      ? new Date(`${format(today, 'yyyy-MM-dd')}T${profile.default_auto_schedule_start_time}`) 
      : startOfDay(today);
    const workdayEnd = profile.default_auto_schedule_end_time 
      ? new Date(`${format(today, 'yyyy-MM-dd')}T${profile.default_auto_schedule_end_time}`) 
      : addMinutes(workdayStart, 9 * 60);
      
    return calculateSchedule(
      scheduledTasksToday,
      format(today, 'yyyy-MM-dd'),
      workdayStart,
      workdayEnd,
      profile.is_in_regen_pod,
      profile.regen_pod_start_time ? parseISO(profile.regen_pod_start_time) : null,
      profile.is_in_regen_pod 
        ? Math.min(
            Math.ceil((MAX_ENERGY - (profile.energy || 0)) / REGEN_POD_RATE_PER_MINUTE),
            120
          )
        : 0,
      T_current
    );
  }, [profile, scheduledTasksToday, T_current]);

  const activeItemToday = useMemo(() => {
    if (!calculatedSchedule) return null;
    
    const now = T_current;
    return calculatedSchedule.items.find(item => 
      isSameDay(item.startTime, now) && 
      item.startTime <= now && 
      item.endTime > now
    ) || null;
  }, [calculatedSchedule, T_current]);

  const nextItemToday = useMemo(() => {
    if (!calculatedSchedule) return null;
    
    const now = T_current;
    return calculatedSchedule.items.find(item => 
      isSameDay(item.startTime, now) && 
      item.startTime > now
    ) || null;
  }, [calculatedSchedule, T_current]);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      setUser(currentSession?.user || null);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user || null);
    });

    getSession();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = useCallback(async () => {
    await refetchProfile();
  }, [refetchProfile]);

  const rechargeEnergy = useCallback(async () => {
    if (!user?.id || !profile) return;
    
    const newEnergy = Math.min(MAX_ENERGY, (profile.energy || 0) + 20);
    
    const { error } = await supabase
      .from('profiles')
      .update({ energy: newEnergy })
      .eq('id', user.id);
      
    if (error) {
      console.error('Error recharging energy:', error);
    } else {
      queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
    }
  }, [user?.id, profile, queryClient]);

  const startRegenPodState = useCallback(async (durationMinutes: number) => {
    if (!user?.id || !profile) return;
    
    const startTime = new Date().toISOString();
    
    const { error } = await supabase
      .from('profiles')
      .update({ 
        is_in_regen_pod: true,
        regen_pod_start_time: startTime
      })
      .eq('id', user.id);
      
    if (error) {
      console.error('Error starting regen pod:', error);
    } else {
      queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
    }
  }, [user?.id, profile, queryClient]);

  const exitRegenPodState = useCallback(async () => {
    if (!user?.id || !profile) return;
    
    const { error } = await supabase
      .from('profiles')
      .update({ 
        is_in_regen_pod: false,
        regen_pod_start_time: null
      })
      .eq('id', user.id);
      
    if (error) {
      console.error('Error exiting regen pod:', error);
    } else {
      queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
    }
  }, [user?.id, profile, queryClient]);

  const regenPodDurationMinutes = useMemo(() => {
    if (!profile?.is_in_regen_pod || !profile.regen_pod_start_time) return 0;
    
    const startTime = parseISO(profile.regen_pod_start_time);
    const now = new Date();
    return Math.floor((now.getTime() - startTime.getTime()) / (1000 * 60));
  }, [profile]);

  return {
    user,
    profile,
    isLoading: isProfileLoading || isScheduledTasksLoading,
    session,
    T_current,
    activeItemToday,
    nextItemToday,
    refreshProfile,
    rechargeEnergy,
    startRegenPodState,
    exitRegenPodState,
    regenPodDurationMinutes,
  };
};