import React, { useContext } from 'react';
import { Session, User } from '@supabase/supabase-js';

interface SessionContextType {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
}

export const SessionContext = React.createContext<SessionContextType | undefined>(undefined);

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionContextProvider');
  }
  return context;
};