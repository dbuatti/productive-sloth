import React, { useState, useEffect, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { SessionContext, UserProfile } from '@/hooks/use-session';
import { dismissToast } from '@/utils/toast';

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Keep true initially
  const navigate = useNavigate();

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, avatar_url, xp, level, daily_streak, last_streak_update') // Select new streak columns
      .eq('id', userId); // Removed .single()

    if (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
    } else if (data && data.length > 0) {
      setProfile(data[0] as UserProfile); // Take the first profile if found
    } else {
      setProfile(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    const handleAuthChange = async (event: string, currentSession: Session | null) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (currentSession?.user) {
        await fetchProfile(currentSession.user.id);
      } else {
        setProfile(null);
      }

      if (event === 'SIGNED_IN' && window.location.pathname === '/login') {
        navigate('/');
      } else if (event === 'SIGNED_OUT' && window.location.pathname !== '/login') {
        navigate('/login');
      }
      // For USER_UPDATED, profile is already refreshed above.
      // For INITIAL_SESSION, the initial load logic below handles navigation.
    };

    // Set up auth listener
    const { data: authListener } = supabase.auth.onAuthStateChange((event, currentSession) => {
      handleAuthChange(event, currentSession);
    });

    // Initial session check and loading state management
    const loadSessionAndProfile = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        if (initialSession?.user) {
          await fetchProfile(initialSession.user.id);
        } else {
          setProfile(null);
        }

        // Handle initial navigation after session and profile are loaded
        if (!initialSession && window.location.pathname !== '/login') {
          navigate('/login');
        } else if (initialSession && window.location.pathname === '/login') {
          navigate('/');
        }

      } catch (error) {
        console.error("Error during initial session load:", error);
        // Even on error, we should stop loading to prevent infinite spinner
        setSession(null);
        setUser(null);
        setProfile(null);
        if (window.location.pathname !== '/login') {
          navigate('/login');
        }
      } finally {
        setIsLoading(false); // Always set to false after initial load attempt
      }
    };

    loadSessionAndProfile();

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate, fetchProfile]); // Removed isLoading and user?.id from dependencies to prevent re-runs

  return (
    <SessionContext.Provider value={{ session, user, profile, isLoading, refreshProfile }}>
      {children}
    </SessionContext.Provider>
  );
};