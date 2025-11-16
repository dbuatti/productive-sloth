import React from 'react';
import AppHeader from './AppHeader';
import Sidebar from './Sidebar';
import MobileSidebar from './MobileSidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import ProgressBarHeader from './ProgressBarHeader';
import FocusAnchor from './FocusAnchor'; // Import FocusAnchor
import { useLocation } from 'react-router-dom'; // Import useLocation
import { useSession } from '@/hooks/use-session'; // Import useSession

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const isMobile = useIsMobile();
  const location = useLocation(); // Get current location
  const { activeItemToday } = useSession(); // Get active item from session

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

  const shouldShowFocusAnchor = activeItemToday && location.pathname !== '/scheduler';

  return (
    <div className="flex min-h-screen w-full flex-col">
      {isMobile ? (
        <>
          <AppHeader mobileNav={<MobileSidebar />} />
          <ProgressBarHeader />
          <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 overflow-auto">
            {children}
          </main>
        </>
      ) : (
        <Sidebar defaultLayout={defaultLayout}>
          <div className="flex flex-col h-full">
            <AppHeader />
            <ProgressBarHeader />
            <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 overflow-auto">
              {children}
            </main>
          </div>
        </Sidebar>
      )}
      {shouldShowFocusAnchor && <FocusAnchor />} {/* Render FocusAnchor conditionally */}
    </div>
  );
};

export default MainLayout;