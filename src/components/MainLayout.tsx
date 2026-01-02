import React, { useState, useCallback } from 'react';
import AppHeader from './AppHeader';
import { useIsMobile } from '@/hooks/use-mobile';
import ProgressBarHeader from './ProgressBarHeader';
import FocusAnchor from './FocusAnchor';
import { useLocation } from 'react-router-dom';
import { useSession } from '@/hooks/use-session';
import EnergyDeficitWarning from './EnergyDeficitWarning';
import Navigation from './Navigation';
import BottomNavigationBar from './BottomNavigationBar';
import MobileStatusIndicator from './MobileStatusIndicator';
import { cn } from '@/lib/utils';
import DesktopHeaderControls from './DesktopHeaderControls'; 
import { Separator } from '@/components/ui/separator'; 

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const { activeItemToday, profile } = useSession();
  const shouldShowFocusAnchor = activeItemToday;
  const energyInDeficit = profile && profile.energy < 0;

  // Determine if we are on the simplified schedule page
  const isSimplifiedSchedulePage = location.pathname === '/simplified-schedule';

  // Desktop sidebar state (always open on desktop, but can be collapsed)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // The mobile menu sheet is removed as navigation is handled by BottomNavigationBar.
  // The AppHeader now only handles the logo/profile on mobile.

  const sidebarWidth = isSidebarCollapsed ? "w-[72px]" : "w-[250px]";
  const contentPaddingLeft = isSidebarCollapsed ? "lg:pl-[72px]" : "lg:pl-[250px]";

  const mainContent = (
    <main className={cn(
      "flex flex-1 flex-col gap-4 overflow-auto",
      // Apply horizontal padding only if NOT on the simplified schedule page
      !isSimplifiedSchedulePage && "px-4 md:px-8", // Increased desktop padding
      // Adjusted top padding: pt-0 for simplified schedule, pt-[100px] otherwise
      isSimplifiedSchedulePage ? "pt-0" : "pt-[100px]", 
      // Dynamic bottom padding for mobile navigation/status indicator
      isMobile && activeItemToday ? "pb-28" : (isMobile ? "pb-20" : "pb-4")
    )}>
      {energyInDeficit && <EnergyDeficitWarning currentEnergy={profile.energy} />}
      <div className={cn(
        "w-full" // Removed max-w-5xl here
      )}>
        {children}
      </div>
    </main>
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      
      {/* Desktop Sidebar (Visible on large screens, hidden on simplified schedule page) */}
      {!isMobile && !isSimplifiedSchedulePage && (
        <div 
          className={cn(
            "fixed top-0 left-0 z-30 h-screen border-r bg-sidebar transition-all duration-300 ease-in-out pt-16",
            sidebarWidth
          )}
        >
          <div className="flex h-full flex-col overflow-y-auto">
            <div className="flex-1 py-4">
              <Navigation isCollapsed={isSidebarCollapsed} />
            </div>
            {/* Optional: Add a collapse toggle button here if needed */}
          </div>
        </div>
      )}

      {/* Desktop Header Controls (Visible on large screens, hidden on simplified schedule page) */}
      {!isMobile && !isSimplifiedSchedulePage && <DesktopHeaderControls />}
      
      {/* Main Content Area (Header + Progress Bar + Page Content) */}
      <div className={cn("flex flex-col flex-1 min-w-0 w-full", !isSimplifiedSchedulePage && contentPaddingLeft)}>
        
        {/* Header (Only visible on mobile, hidden on simplified schedule page) */}
        {isMobile && !isSimplifiedSchedulePage && <AppHeader onMenuToggle={() => {}} />} {/* onMenuToggle is now a placeholder */}
        
        {/* Progress Bar Header (Sticks below the header, hidden on simplified schedule page) */}
        {!isSimplifiedSchedulePage && <ProgressBarHeader />}
        
        {/* Page Content */}
        {mainContent}
        
        {/* Desktop Focus Anchor (Hidden on mobile and simplified schedule page) */}
        {shouldShowFocusAnchor && !isSimplifiedSchedulePage && <FocusAnchor />}
      </div>
      
      {/* Mobile Status Indicator (Above Bottom Nav, hidden on simplified schedule page) */}
      {isMobile && activeItemToday && !isSimplifiedSchedulePage && <MobileStatusIndicator />}
      
      {/* Bottom Navigation Bar for Mobile (Hidden on simplified schedule page) */}
      {isMobile && !isSimplifiedSchedulePage && <BottomNavigationBar />}
    </div>
  );
};

export default MainLayout;