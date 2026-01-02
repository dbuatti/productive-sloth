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
      // Use smaller padding on mobile for a more expansive feel
      !isSimplifiedSchedulePage && "px-3 md:px-8", 
      // Removed pt-[100px] from here, padding is now handled by the parent div
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
            "fixed top-0 left-0 right-0 z-30 h-screen border-r bg-sidebar transition-all duration-300 ease-in-out pt-[92px]", // Adjusted pt for sidebar to match new header height
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

      {/* Consolidated Fixed Header */}
      <ProgressBarHeader />
      
      {/* Main Content Area */}
      <div className={cn(
        "flex flex-col flex-1 min-w-0 w-full", 
        !isSimplifiedSchedulePage && contentPaddingLeft,
        "pt-[92px]" // Add padding-top here to push content below fixed header (h-16 + py-3 = ~92px)
      )}>
        {mainContent}
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