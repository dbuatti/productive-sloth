"use client";

import React, { useState, useCallback } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import AppUnifiedHeader from './AppUnifiedHeader';
import FocusAnchor from './FocusAnchor';
import { useLocation } from 'react-router-dom';
import { useSession } from '@/hooks/use-session';
import EnergyDeficitWarning from './EnergyDeficitWarning';
import Navigation from './Navigation';
import BottomNavigationBar from './BottomNavigationBar';
import MobileStatusIndicator from './MobileStatusIndicator';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const { activeItemToday, profile } = useSession();
  const shouldShowFocusAnchor = activeItemToday;
  const energyInDeficit = profile && profile.energy < 0;

  // Define full-width routes
  const fullWidthRoutes = ['/scheduler', '/sink', '/simplified-schedule'];
  const isFullWidth = fullWidthRoutes.some(route => location.pathname.startsWith(route));

  // State for mobile menu
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen(prev => !prev);
  }, []);

  // State for desktop sidebar collapse
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const toggleSidebarCollapse = useCallback(() => {
    setIsSidebarCollapsed(prev => !prev);
  }, []);

  const sidebarWidth = isSidebarCollapsed ? "w-[72px]" : "w-[250px]";
  const contentPaddingLeft = isMobile ? "lg:pl-0" : (isSidebarCollapsed ? "lg:pl-[72px]" : "lg:pl-[250px]");

  const mainContent = (
    <main className={cn(
      "flex flex-1 flex-col gap-4 overflow-auto",
      isMobile && activeItemToday ? "pb-28" : (isMobile ? "pb-20" : "pb-4"),
    )}>
      <div className={cn(
        "w-full",
        "px-3 md:px-8",
        // Apply full-width styling for specific pages
        isFullWidth && !isMobile ? "max-w-full px-0" : "max-w-4xl mx-auto"
      )}>
        {energyInDeficit && <EnergyDeficitWarning currentEnergy={profile.energy} />}
        {children}
      </div>
    </main>
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      
      {/* Mobile Navigation Drawer */}
      {isMobile && (
        <Sheet open={isMobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="w-[250px] p-0 flex flex-col bg-sidebar border-r border-border/50">
            <SheetHeader className="px-4 pt-4 pb-2 border-b border-border/50">
              <SheetTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
                <img 
                  src="/aetherflow-logo.png" 
                  alt="AetherFlow Logo" 
                  className="h-8 w-auto drop-shadow-[0_0_8px_rgba(var(--primary),0.3)]"
                />
                AetherFlow
              </SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto py-4">
              <Navigation isCollapsed={false} onLinkClick={() => setMobileMenuOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Desktop Sidebar */}
      {!isMobile && !isFullWidth && (
        <div 
          className={cn(
            "fixed top-0 left-0 z-30 h-screen border-r border-border/50 bg-sidebar transition-all duration-300 ease-in-out pt-[64px]",
            sidebarWidth
          )}
        >
          <div className="flex h-full flex-col overflow-y-auto">
            <div className="flex-1 py-4">
              <Navigation isCollapsed={isSidebarCollapsed} />
            </div>
            <div className="sticky bottom-0 bg-sidebar border-t border-border/50 p-2 flex justify-center">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebarCollapse}
                className="h-8 w-8 text-muted-foreground hover:bg-secondary/50"
              >
                {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                <span className="sr-only">{isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Consolidated Fixed Header */}
      <div className={cn(
        "fixed top-0 left-0 right-0 z-50",
        contentPaddingLeft
      )}>
        <AppUnifiedHeader onToggleMobileMenu={toggleMobileMenu} />
      </div>
      
      {/* Main Content Area */}
      <div className={cn(
        "flex flex-col flex-1 min-w-0 w-full", 
        contentPaddingLeft,
        "pt-[64px]"
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