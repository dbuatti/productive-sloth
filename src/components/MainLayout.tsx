import React, { useState, useCallback } from 'react';
import AppHeader from './AppHeader';
import NavigationDrawer from './NavigationDrawer'; // Updated import
import { useIsMobile } from '@/hooks/use-mobile';
import ProgressBarHeader from './ProgressBarHeader';
import FocusAnchor from './FocusAnchor';
import { useLocation } from 'react-router-dom';
import { useSession } from '@/hooks/use-session';
import EnergyDeficitWarning from './EnergyDeficitWarning';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const { activeItemToday, profile } = useSession();
  
  // NEW: State to control the navigation drawer visibility
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Removed sidebar collapse logic as we are switching to a drawer model

  const shouldShowFocusAnchor = activeItemToday;
  const energyInDeficit = profile && profile.energy < 0;

  const mainContent = (
    <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 overflow-auto">
      {energyInDeficit && <EnergyDeficitWarning currentEnergy={profile.energy} />}
      {children}
    </main>
  );

  // The hamburger button logic is now centralized in AppHeader, 
  // and it controls the isDrawerOpen state.

  return (
    <div className="flex min-h-screen w-full flex-col">
      {/* Navigation Drawer (Controlled by state, used for both mobile and desktop) */}
      <NavigationDrawer 
        isOpen={isDrawerOpen} 
        onOpenChange={setIsDrawerOpen} 
        side="left"
      />

      {/* Header: Always visible, contains the hamburger trigger */}
      <AppHeader onMenuToggle={() => setIsDrawerOpen(true)} />
      
      {/* Progress Bar Header */}
      <ProgressBarHeader />
      
      {/* Main Content Area */}
      {mainContent}

      {shouldShowFocusAnchor && <FocusAnchor />}
    </div>
  );
};

export default MainLayout;