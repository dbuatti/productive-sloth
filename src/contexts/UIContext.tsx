"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface UIContextType {
  isNowFocusCardVisible: boolean;
  setNowFocusCardVisible: (visible: boolean) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isNowFocusCardVisible, setNowFocusCardVisible] = useState(true); // Default to true, assuming it's visible on load

  return (
    <UIContext.Provider value={{ isNowFocusCardVisible, setNowFocusCardVisible }}>
      {children}
    </UIContext.Provider>
  );
};

export const useUIContext = () => {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUIContext must be used within a UIProvider');
  }
  return context;
};