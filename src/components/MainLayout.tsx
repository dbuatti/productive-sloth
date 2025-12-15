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
import { Settings, TrendingUp, BookOpen, Clock, Trash2, CheckCircle, Code } from 'lucide-react';
import { NavLink } from 'react-router-dom'; 
import DesktopHeaderControls from './DesktopHeaderControls'; 
import { Separator } from '@/components/ui/separator';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MobileNavigationLinks: React.FC<{ onLinkClick: () => void }> = ({ onLinkClick }) => (
  <nav className="grid items-start px-4 text-sm font-medium space-y-1">
    {/* Primary Navigation Links */}
    <NavLink
      to="/scheduler"
      onClick={onLinkClick}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-4 rounded-lg px-4 py-3 text-base text-muted-foreground transition-all hover:text-primary relative",
          isActive && "bg-sidebar-accent text-primary hover:text-primary border-l-4 border-primary -ml-4 pl-4"
        )
      }
    >
      <Clock className="h-6 w-6" />
      <span className="text-base font-medium">Vibe Schedule</span>
    </NavLink>
    <NavLink
      to="/sink"
      onClick={onLinkClick}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-4 rounded-lg px-4 py-3 text-base text-muted-foreground transition-all hover:text-primary relative",
          isActive && "bg-sidebar-accent text-primary hover:text-primary border-l-4 border-primary -ml-4 pl-4"
        )
      }
    >
      <Trash2 className="h-6 w-6" />
      <span className="text-base font-medium">Aether Sink</span>
    </NavLink>
    <NavLink
      to="/recap"
      onClick={onLinkClick}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-4 rounded-lg px-4 py-3 text-base text-muted-foreground transition-all hover:text-primary relative",
          isActive && "bg-sidebar-accent text-primary hover:text-primary border-l-4 border-primary -ml-4 pl-4"
        )
      }
    >
      <CheckCircle className="h-6 w-6" />
      <span className="text-base font-medium">Daily Recap</span>
    </NavLink>
    
    <Separator className="my-2" />

    {/* Secondary Pages */}
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
      to="/model"
      onClick={onLinkClick}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-4 rounded-lg px-4 py-3 text-base text-muted-foreground transition-all hover:text-primary relative",
          isActive && "bg-sidebar-accent text-primary hover:text-primary border-l-4 border-primary -ml-4 pl-4"
        )
      }
    >
      <Code className="h-6 w-6" />
      <span className="text-base font-medium">App Model & Reference</span>
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
  // On desktop (lg:block), header is h-16, progress bar is sticky top-16 (~h-8). Total offset ~100px.
  const mainContent = (
    <main className={cn(
      "flex flex-1 flex-col gap-4 px-4 overflow-auto",
      "pt-[100px] lg:pt-[100px]", // Adjusted top padding for both mobile and desktop (h-16 header + h-8 progress bar + gap)
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
      {/* Desktop Header Controls (Visible on large screens) */}
      {!isMobile && <DesktopHeaderControls />}
      
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
        {/* Header (Pass toggle function) - Only visible on mobile */}
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