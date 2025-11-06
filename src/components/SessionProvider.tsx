import React, { useState, useEffect } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { SessionContext } from '@/hooks/use-session';
import { dismissToast } from '@/utils/toast';

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let loadingToastId: string | undefined;

    const { data: authListener } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        if (currentSession && window.location.pathname === '/login') {
          navigate('/');
        }
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        if (window.location.pathname !== '/login') {
          navigate('/login');
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
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      setIsLoading(false);
      
      if (!initialSession && window.location.pathname !== '/login') {
        navigate('/login');
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate, isLoading]);

  return (
    <SessionContext.Provider value={{ session, user, isLoading }}>
      {children}
    </SessionContext.Provider>
  );
};