import React, { useState, useCallback } from 'react';
import AppHeader from './AppHeader';
import Sidebar from './Sidebar';
import MobileSidebar from './MobileSidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import ProgressBarHeader from './ProgressBarHeader';
import FocusAnchor from './FocusAnchor';
import { useLocation } from 'react-router-dom';
import { useSession } from '@/hooks/use-session';
import EnergyDeficitWarning from './EnergyDeficitWarning'; // NEW: Import EnergyDeficitWarning
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const { activeItemToday, profile } = useSession();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const handleCollapseChange = useCallback((collapsed: boolean) => {
    setIsSidebarCollapsed(collapsed);
  }, []);

  // Function to manually toggle collapse state (used by desktop hamburger)
  const toggleSidebarCollapse = () => {
    // This relies on the Sidebar component's internal state management via cookies/local storage
    // For simplicity and to trigger the ResizablePanel's internal logic, we'll rely on a direct DOM manipulation
    // or a state change that forces the Sidebar to re-render and check its stored state.
    // Since the Sidebar already uses cookies/local storage, we can just toggle the cookie value.
    const newCollapsedState = !isSidebarCollapsed;
    document.cookie = `react-resizable-panels:collapsed=${JSON.stringify(newCollapsedState)}`;
    setIsSidebarCollapsed(newCollapsedState);
    window.location.reload(); // Force reload to apply panel state change reliably
  };

  // Attempt to read default layout from cookie
  const defaultLayout = React.useMemo(() => {
    if (typeof window !== 'undefined') {
      const savedLayout = document.cookie.split('; ').find((c) => c.startsWith('react-resizable-panels:layout='));
      if (savedLayout) {
        return JSON.parse(savedLayout.split('=')[1]);
      }
    }
    return undefined;
  }, []);

  const shouldShowFocusAnchor = activeItemToday;
  const energyInDeficit = profile && profile.energy < 0;

  const mainContent = (
    <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 overflow-auto">
      {energyInDeficit && <EnergyDeficitWarning currentEnergy={profile.energy} />}
      {children}
    </main>
  );

  // Desktop Hamburger Button (only visible when sidebar is collapsed)
  const desktopHamburger = isSidebarCollapsed && !isMobile ? (
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={toggleSidebarCollapse} 
      className="h-10 w-10 text-muted-foreground hover:text-primary"
    >
      <Menu className="h-6 w-6" />
      <span className="sr-only">Expand Sidebar</span>
    </Button>
  ) : null;

  return (
    <div className="flex min-h-screen w-full flex-col">
      {isMobile ? (
        <>
          <AppHeader mobileNav={<MobileSidebar />} />
          <ProgressBarHeader />
          {mainContent}
        </>
      ) : (
        <Sidebar defaultLayout={defaultLayout} onCollapseChange={handleCollapseChange}>
          <div className="flex flex-col h-full">
            <AppHeader desktopHamburger={desktopHamburger} /> {/* Pass desktopHamburger */}
            <ProgressBarHeader />
            {mainContent}
          </div>
        </Sidebar>
      )}
      {shouldShowFocusAnchor && <FocusAnchor />}
    </div>
  );
};

export default MainLayout;