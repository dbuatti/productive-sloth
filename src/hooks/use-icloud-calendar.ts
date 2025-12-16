import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from './use-session';
import { showSuccess, showError } from '@/utils/toast';
import { AvailableCalendar, UserCalendar, SyncedScheduledTask } from '@/types/calendar';
import { DBScheduledTask } from '@/types/scheduler';
import { format, parseISO, addMinutes } from 'date-fns';

// Supabase Project ID and URL are needed to invoke the Edge Function
const SUPABASE_PROJECT_ID = "yfgapigmiyclgryqdgne";
const SUPABASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co`;

export const useICloudCalendar = () => {
  const queryClient = useQueryClient();
  const { user, session } = useSession();
  const userId = user?.id;
  const syncQueryKey = ['iCloudUserCalendars', userId];

  // --- 1. Fetch User's Selected/Synced Calendars (from DB) ---
  const fetchUserCalendars = useCallback(async (): Promise<UserCalendar[]> => {
    if (!userId) return [];
    const { data, error } = await supabase
      .from('user_calendars')
      .select('*')
      .eq('user_id', userId);

    if (error) throw new Error(error.message);
    return data as UserCalendar[];
  }, [userId]);

  const { data: userCalendars = [], isLoading: isLoadingUserCalendars } = useQuery<UserCalendar[]>({
    queryKey: syncQueryKey,
    queryFn: fetchUserCalendars,
    enabled: !!userId,
  });

  // --- 2. Fetch Available Calendars (Mock API Call via Edge Function) ---
  const fetchAvailableCalendars = useCallback(async (): Promise<AvailableCalendar[]> => {
    if (!userId || !session?.access_token) return [];
    
    // In a real app, this would initiate the OAuth flow if needed, 
    // then fetch the list of calendars using the stored credentials.
    const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/get-icloud-calendars`;

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch available calendars.');
    }
    const data = await response.json();
    return data.calendars as AvailableCalendar[];
  }, [userId, session?.access_token]);

  const { data: availableCalendars = [], isLoading: isLoadingAvailableCalendars } = useQuery<AvailableCalendar[]>({
    queryKey: ['availableICloudCalendars', userId],
    queryFn: fetchAvailableCalendars,
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // Cache available list for 5 minutes
  });

  // --- 3. Mutations for Managing User Calendars (DB) ---

  const updateCalendarSelectionMutation = useMutation({
    mutationFn: async (calendar: { calendar_id: string, calendar_name: string, is_enabled: boolean }) => {
      if (!userId) throw new Error("User not authenticated.");
      
      const existing = userCalendars.find(uc => uc.calendar_id === calendar.calendar_id);
      
      if (existing) {
        // Update existing entry
        const { error } = await supabase
          .from('user_calendars')
          .update({ is_enabled: calendar.is_enabled })
          .eq('id', existing.id)
          .eq('user_id', userId);
        if (error) throw new Error(error.message);
      } else if (calendar.is_enabled) {
        // Insert new entry if enabling
        const { error } = await supabase
          .from('user_calendars')
          .insert({ 
            user_id: userId, 
            calendar_id: calendar.calendar_id, 
            calendar_name: calendar.calendar_name, 
            is_enabled: true 
          });
        if (error) throw new Error(error.message);
      }
      // If disabling a non-existent calendar, do nothing.
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: syncQueryKey });
      // No success toast here, handled by SettingsPage
    },
    onError: (e) => {
      showError(`Failed to update calendar selection: ${e.message}`);
    }
  });

  // --- 4. Sync Events Mutation (Triggers Edge Function) ---

  const syncEventsMutation = useMutation({
    mutationFn: async (calendarIdsToSync: string[]) => {
      if (!userId || !session?.access_token) throw new Error("User not authenticated.");
      if (calendarIdsToSync.length === 0) {
        showError("No calendars enabled for sync.");
        return { syncedCount: 0, deletedCount: 0 };
      }

      const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/sync-icloud-events`;

      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ 
          userId, 
          calendarIds: calendarIdsToSync,
          // Sync events for the next 30 days
          startDate: format(new Date(), 'yyyy-MM-dd'),
          endDate: format(addMinutes(new Date(), 30 * 24 * 60), 'yyyy-MM-dd'),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sync calendar events.');
      }
      const data = await response.json();
      return data as { syncedCount: number, deletedCount: number };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks', userId] });
      queryClient.invalidateQueries({ queryKey: ['datesWithTasks', userId] });
      queryClient.invalidateQueries({ queryKey: syncQueryKey }); // Update last_synced_at
      showSuccess(`Sync complete: ${data.syncedCount} events updated, ${data.deletedCount} removed.`);
    },
    onError: (e) => {
      showError(`Calendar sync failed: ${e.message}`);
    }
  });

  // --- 5. Combined State and Actions ---

  const isSyncEnabled = userCalendars.some(uc => uc.is_enabled);
  const calendarsToSync = userCalendars.filter(uc => uc.is_enabled).map(uc => uc.calendar_id);

  const toggleCalendarSelection = useCallback((calendar: AvailableCalendar, isEnabled: boolean) => {
    updateCalendarSelectionMutation.mutate({
      calendar_id: calendar.id,
      calendar_name: calendar.name,
      is_enabled: isEnabled,
    });
  }, [updateCalendarSelectionMutation]);

  const triggerSync = useCallback(() => {
    if (calendarsToSync.length > 0) {
      syncEventsMutation.mutate(calendarsToSync);
    } else {
      showError("No calendars selected for synchronization.");
    }
  }, [calendarsToSync, syncEventsMutation]);

  return {
    // Data
    availableCalendars,
    userCalendars,
    isSyncEnabled,
    calendarsToSync,
    
    // Loading States
    isLoadingAvailableCalendars,
    isLoadingUserCalendars,
    isSyncing: syncEventsMutation.isPending,
    
    // Actions
    toggleCalendarSelection,
    triggerSync,
    
    // Mutations
    updateCalendarSelectionMutation,
    syncEventsMutation,
  };
};