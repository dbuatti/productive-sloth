"use client";

import React, { useState, useEffect, useContext, createContext, useMemo } from 'react';

interface CurrentTimeContextType {
  T_current: Date;
}

export const CurrentTimeContext = createContext<CurrentTimeContextType | undefined>(undefined);

export const useCurrentTime = () => {
  const context = useContext(CurrentTimeContext);
  if (context === undefined) {
    throw new Error('useCurrentTime must be used within a CurrentTimeProvider');
  }
  return context;
};

export const CurrentTimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [T_current, setT_current] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setT_current(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const contextValue = useMemo(() => ({ T_current }), [T_current]);

  return (
    <CurrentTimeContext.Provider value={contextValue}>
      {children}
    </CurrentTimeContext.Provider>
  );
};