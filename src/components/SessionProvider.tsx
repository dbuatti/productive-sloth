import React, { useState, useEffect, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { SessionContext, UserProfile } from '@/hooks/use-session';
import { dismissToast } from '@/utils/toast';

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null); // State for user profile
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, avatar_url')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found, which is fine for new users
      console.error('Error fetching profile:', error);
      setProfile(null);
    } else if (data) {
      setProfile(data as UserProfile);
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
    let loadingToastId: string | undefined;

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        if (currentSession?.user) {
          await fetchProfile(currentSession.user.id); // Fetch profile on sign-in/initial session
        }
        if (currentSession && window.location.pathname === '/login') {
          navigate('/');
        }
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setProfile(null); // Clear profile on sign-out
        if (window.location.pathname !== '/login') {
          navigate('/login');
        }
      } else if (event === 'USER_UPDATED') {
        setUser(currentSession?.user ?? null);
        if (currentSession?.user) {
          await fetchProfile(currentSession.user.id); // Refresh profile if user metadata updates
        }
      }
      
      if (isLoading) {
        setIsLoading(false);
      }
      
      if (loadingToastId) {
        dismissToast(loadingToastId);
      }
    });

    // Initial load check
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      if (initialSession?.user) {
        await fetchProfile(initialSession.user.id); // Fetch profile on initial session load
      }
      setIsLoading(false);
      
      if (!initialSession && window.location.pathname !== '/login') {
        navigate('/login');
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate, isLoading, fetchProfile, user?.id]); // Added user.id to dependencies

  return (
    <SessionContext.Provider value={{ session, user, profile, isLoading, refreshProfile }}>
      {children}
    </SessionContext.Provider>
  );
};