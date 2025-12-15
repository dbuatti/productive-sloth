import React, { useState, useCallback } from 'react';
import AppHeader from './AppHeader';
import { useIsMobile } from '@/hooks/use-mobile';
import ProgressBarHeader from './ProgressBarHeader';
import FocusAnchor from './FocusAnchor';
import { useLocation } from 'react-router-dom';
import { useSession } from '@/hooks/use-session';
import EnergyDeficitWarning from './EnergyDeficitWarning';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import Navigation from './Navigation';
import BottomNavigationBar from './BottomNavigationBar';
import MobileStatusIndicator from './MobileStatusIndicator';
import { cn } from '@/lib/utils';
import { Settings, TrendingUp, BookOpen } from 'lucide-react'; // Added icons for mobile menu links
import { NavLink } from 'react-router-dom'; // Added NavLink for mobile menu links

interface MainLayoutProps {
  children: React.ReactNode;
}

const MobileNavigationLinks: React.FC<{ onLinkClick: () => void }> = ({ onLinkClick }) => (
  <nav className="grid items-start px-4 text-sm font-medium space-y-1">
    <NavLink
      to="/analytics"
      onClick={onLinkClick}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-4 rounded-lg px-4 py-3 text-base text-muted-foreground transition-all hover:text-primary relative",
          isActive && "bg-sidebar-accent text-primary hover:text-primary border-l-4 border-primary -ml-4 pl-4"
        )
      }
    >
      <TrendingUp className="h-6 w-6" />
      <span className="text-base font-medium">Analytics</span>
    </NavLink>
    <NavLink
      to="/documentation"
      onClick={onLinkClick}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-4 rounded-lg px-4 py-3 text-base text-muted-foreground transition-all hover:text-primary relative",
          isActive && "bg-sidebar-accent text-primary hover:text-primary border-l-4 border-primary -ml-4 pl-4"
        )
      }
    >
      <BookOpen className="h-6 w-6" />
      <span className="text-base font-medium">Documentation</span>
    </NavLink>
    <NavLink
      to="/settings"
      onClick={onLinkClick}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-4 rounded-lg px-4 py-3 text-base text-muted-foreground transition-all hover:text-primary relative",
          isActive && "bg-sidebar-accent text-primary hover:text-primary border-l-4 border-primary -ml-4 pl-4"
        )
      }
    >
      <Settings className="h-6 w-6" />
      <span className="text-base font-medium">Settings</span>
    </NavLink>
  </nav>
);


const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const { activeItemToday, profile } = useSession();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const shouldShowFocusAnchor = activeItemToday;
  const energyInDeficit = profile && profile.energy < 0;

  const handleMenuToggle = useCallback(() => {
    setIsMobileMenuOpen(prev => !prev);
  }, []);

  const handleLinkClick = useCallback(() => {
    setIsMobileMenuOpen(false);
  }, []);

  // On mobile (lg:hidden), header is h-16, progress bar is sticky top-16 (~h-8). Total offset ~100px.
  // On desktop (lg:block), header is hidden, progress bar is sticky top-0 (~h-8). Offset ~52px (36px + gap-4).
  const mainContent = (
    <main className={cn(
      "flex flex-1 flex-col gap-4 px-4 overflow-auto",
      "pt-[100px] lg:pt-[52px]", // Adjusted top padding for desktop (lg:pt-[52px])
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
      {/* Desktop Sidebar is removed. */}
      
      {/* Mobile Sheet Navigation (Hamburger Menu) */}
      {isMobile && (
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetContent side="left" className="w-[250px] p-0 flex flex-col bg-sidebar">
            {/* Replicate Sidebar content structure for mobile */}
            <div className="flex h-16 items-center px-4 border-b border-sidebar-border">
              <img src="/aetherflow-logo.png" alt="Logo" className="h-8 w-auto" />
              <span className="ml-2 text-lg font-bold text-sidebar-foreground">AetherFlow</span>
            </div>
            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {/* Use the new consolidated links for the mobile menu */}
              <MobileNavigationLinks onLinkClick={handleLinkClick} />
            </div>
          </SheetContent>
        </Sheet>
      )}
      
      {/* Main Content Area (Header + Progress Bar + Page Content) */}
      <div className="flex flex-col flex-1 min-w-0 w-full">
        {/* Header (Pass toggle function) */}
        <AppHeader onMenuToggle={handleMenuToggle} />
        
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