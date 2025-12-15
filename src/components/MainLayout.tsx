import React from 'react';
import AppHeader from './AppHeader';
import { useIsMobile } from '@/hooks/use-mobile';
import ProgressBarHeader from './ProgressBarHeader';
import FocusAnchor from './FocusAnchor';
import { useLocation } from 'react-router-dom';
import { useSession } from '@/hooks/use-session';
import EnergyDeficitWarning from './EnergyDeficitWarning';
import BottomNavigationBar from './BottomNavigationBar';
import MobileStatusIndicator from './MobileStatusIndicator';
import { cn } from '@/lib/utils';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const isMobile = useIsMobile();
  const { activeItemToday, profile } = useSession();
  const shouldShowFocusAnchor = activeItemToday;
  const energyInDeficit = profile && profile.energy < 0;

  // Since the sidebar is removed, the desktop layout is full width.
  // The desktop progress bar is sticky top-0 (~h-8). Offset ~52px (36px + gap-4).
  // The mobile header is h-16, progress bar is sticky top-16 (~h-8). Total offset ~100px.
  const mainContent = (
    <main className={cn(
      "flex flex-1 flex-col gap-4 px-4 overflow-auto",
      "pt-[52px] lg:pt-[52px]", // Adjusted top padding: 52px (Progress Bar height + gap)
      // Dynamic bottom padding for mobile navigation/status indicator
      isMobile && activeItemToday ? "pb-28" : (isMobile ? "pb-20" : "pb-4")
    )}>
      {energyInDeficit && <EnergyDeficitWarning currentEnergy={profile.energy} />}
      <div className="max-w-5xl w-full mx-auto">
        {children}
      </div>
    </main>
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Main Content Area (Header + Progress Bar + Page Content) */}
      <div className="flex flex-col flex-1 min-w-0 w-full">
        {/* Header (No longer needs onMenuToggle) */}
        <AppHeader />
        
        {/* Progress Bar Header (Sticks below the header) */}
        <ProgressBarHeader />
        
        {/* Page Content */}
        {mainContent}
        
        {/* Desktop Focus Anchor (Hidden on mobile) */}
        {shouldShowFocusAnchor && <FocusAnchor />}
      </div>
      
      {/* Mobile Status Indicator (Above Bottom Nav) */}
      {isMobile && activeItemToday && <MobileStatusIndicator />}
      
      {/* Bottom Navigation Bar for Mobile */}
      {isMobile && <BottomNavigationBar />}
    </div>
  );
};

export default MainLayout;