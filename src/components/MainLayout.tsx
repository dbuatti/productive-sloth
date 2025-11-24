import React, { useState, useCallback } from 'react';
import AppHeader from './AppHeader';
import { useIsMobile } from '@/hooks/use-mobile';
import ProgressBarHeader from './ProgressBarHeader';
import FocusAnchor from './FocusAnchor';
import { useLocation } from 'react-router-dom';
import { useSession } from '@/hooks/use-session';
import EnergyDeficitWarning from './EnergyDeficitWarning';
import Sidebar from './Sidebar'; // NEW: Import Sidebar

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const { activeItemToday, profile } = useSession();
  
  const shouldShowFocusAnchor = activeItemToday;
  const energyInDeficit = profile && profile.energy < 0;

  const mainContent = (
    <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
      {energyInDeficit && <EnergyDeficitWarning currentEnergy={profile.energy} />}
      {children}
    </main>
  );

  return (
    <div className="flex min-h-screen w-full"> {/* Horizontal layout container */}
      {/* Sidebar (Permanent on large screens) */}
      <Sidebar />

      {/* Main Content Area (Header + Progress Bar + Page Content) */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header (Only mobile controls remain here) */}
        <AppHeader />
        
        {/* Progress Bar Header (Sticks below the header) */}
        <ProgressBarHeader />
        
        {/* Page Content */}
        {mainContent}

        {shouldShowFocusAnchor && <FocusAnchor />}
      </div>
    </div>
  );
};

export default MainLayout;